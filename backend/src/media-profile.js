import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {failure,parseOrThrow} from './security.js';

const id=z.uuid();
const url=z.string().url().max(2048);
const image=z.object({data:z.string().min(10).max(6_000_000),category:z.enum(['products','shop','barber'])}).strict();
const shopProfile=z.object({
 name:z.string().trim().min(2).max(120),tagline:z.string().max(240),
 address:z.string().max(240),city:z.string().max(120),phone:z.string().max(40),
 email:z.union([z.literal(''),z.email().max(254)]).optional(),
 latitude:z.number().min(-90).max(90).nullable().optional(),
 longitude:z.number().min(-180).max(180).nullable().optional(),
 openingHours:z.object({days:z.string().max(80),open:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),close:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)}).strict().optional(),
 socialLinks:z.object({instagram:z.string().max(120),whatsapp:z.string().max(40)}).strict().optional()
}).strict().superRefine((data,ctx)=>{
 if((data.latitude===undefined)!==(data.longitude===undefined))
  ctx.addIssue({code:'custom',message:'Debes proporcionar ambas coordenadas',path:['latitude']});
});
const gallery=z.object({photos:z.array(url).max(10)}).strict();
export function verifyImage(buffer){
 if(buffer.length<12||buffer.length>4_000_000)failure(400,'Imagen vacía o mayor a 4 MB');
 if(buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff)return {ext:'jpg',mime:'image/jpeg'};
 if(buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {ext:'png',mime:'image/png'};
 if(buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP')return {ext:'webp',mime:'image/webp'};
 failure(400,'Formato no admitido. Usa JPEG, PNG o WebP');
}
export async function registerMediaProfileRoutes(app,{db,security,config}){
 const {authenticated,limited,requireTenant,service}=security;
 app.register(async routes=>{
  routes.addHook('preHandler',async req=>{await authenticated(req);await limited(req);if(!db)failure(503,'Base de datos no disponible');});
  // Upload avatar as the authenticated account owner. No tenant or role is required.
  // The file path is derived from req.actor.id, never from client-supplied identity.
  routes.post('/api/v1/me/avatar',{bodyLimit:6_500_000},async(req,reply)=>{
   if(!service)failure(503,'Servicio de imágenes no configurado');
   const x=parseOrThrow(z.object({data:z.string().min(10).max(6_000_000)}).strict(),req.body);
   const buffer=Buffer.from(x.data,'base64');
   const type=verifyImage(buffer);
   const key='avatars/'+req.actor.id+'/'+randomUUID()+'.'+type.ext;
   const {error}=await service.storage.from(config.mediaBucket).upload(key,buffer,{
    contentType:type.mime,upsert:false,cacheControl:'3600'
   });
   if(error)failure(502,'No se pudo subir la foto de perfil');
   const {data}=service.storage.from(config.mediaBucket).getPublicUrl(key);
   return reply.code(201).send({url:data.publicUrl});
  });
  // A barber can only edit a profile attached to their own auth user ID.
  // Contract, payouts, status and schedule fields are intentionally excluded.
  routes.patch('/api/v1/tenants/:tenantId/barbers/:barberId/professional-profile',async req=>{
   const tenant=parseOrThrow(id,req.params.tenantId),barber=parseOrThrow(id,req.params.barberId);
   await requireTenant(db,tenant,req.actor.id,['barber','owner']);
   const payload=z.object({
    name:z.string().trim().min(2).max(120),
    bio:z.string().trim().max(2000),
    specialties:z.array(z.string().trim().min(2).max(65)).max(8),
    experienceYears:z.number().int().min(0).max(70),
    instagramUrl:z.union([z.literal(''),z.string().url().max(160).refine(v=>v.startsWith('https://www.instagram.com/')||v.startsWith('https://instagram.com/'),'Solo se admiten enlaces de Instagram')]),
    professionalPhone:z.string().trim().max(40)
   }).strict();
   const x=parseOrThrow(payload,req.body);
   const row=await db.query(
    'UPDATE public.barbers SET name=$4,bio=$5,specialties=$6,experience_years=$7,instagram_url=$8,professional_phone=$9 WHERE tenant_id=$1 AND id=$2 AND user_id=$3 RETURNING *',
    [tenant,barber,req.actor.id,x.name,x.bio,x.specialties,x.experienceYears,x.instagramUrl,x.professionalPhone]);
   if(!row.rowCount)failure(403,'No puedes modificar el perfil de otro barbero');
   return row.rows[0];
  });
  routes.post('/api/v1/tenants/:tenantId/images', {bodyLimit:6_500_000},async(req,reply)=>{
   const tenant=parseOrThrow(id,req.params.tenantId);
   const role=await requireTenant(db,tenant,req.actor.id,['owner','manager','barber']);
   if(!service)failure(503,'Servicio de imágenes no configurado');
   const x=parseOrThrow(image,req.body);
   if(role==='barber'&&x.category!=='barber')failure(403,'Solo puedes subir imágenes profesionales propias');
   const buffer=Buffer.from(x.data,'base64');
   const type=verifyImage(buffer);
   const key=tenant+'/'+x.category+'/'+randomUUID()+'.'+type.ext;
   const {error}=await service.storage.from(config.mediaBucket).upload(key,buffer,{contentType:type.mime,upsert:false,cacheControl:'3600'});
   if(error)failure(502,'Error al subir la imagen a Storage');
   const {data}=service.storage.from(config.mediaBucket).getPublicUrl(key);
   return reply.code(201).send({url:data.publicUrl,path:key});
  });
  routes.patch('/api/v1/tenants/:tenantId/profile',async req=>{
   const tenant=parseOrThrow(id,req.params.tenantId);
   await requireTenant(db,tenant,req.actor.id,['owner','manager']);
   const x=parseOrThrow(shopProfile,req.body);
   const result=await db.query(`UPDATE public.tenants
     SET name=$2,tagline=$3,address=$4,city=$5,phone=$6,
         email=COALESCE($7,email),
         latitude=CASE WHEN $8::boolean THEN $9::numeric ELSE latitude END,
         longitude=CASE WHEN $8::boolean THEN $10::numeric ELSE longitude END,
         opening_hours=COALESCE($11::jsonb,opening_hours),
         social_links=COALESCE($12::jsonb,social_links)
     WHERE id=$1 AND status='active' RETURNING *`,
     [tenant,x.name,x.tagline,x.address,x.city,x.phone,x.email??null,
       x.latitude!==undefined,x.latitude??null,x.longitude??null,
       x.openingHours?JSON.stringify(x.openingHours):null,
       x.socialLinks?JSON.stringify(x.socialLinks):null]);
   if(!result.rowCount)failure(404,'Barbería no encontrada');
   return result.rows[0];
  });
  routes.patch('/api/v1/tenants/:tenantId/products/:productId/photo',async req=>{
   const tenant=parseOrThrow(id,req.params.tenantId),product=parseOrThrow(id,req.params.productId);
   await requireTenant(db,tenant,req.actor.id,['owner','manager']);
   const x=parseOrThrow(z.object({url}).strict(),req.body);
   const result=await db.query('UPDATE public.products SET photo_url=$3,updated_at=now() WHERE tenant_id=$1 AND id=$2 RETURNING id,photo_url',[tenant,product,x.url]);
   if(!result.rowCount)failure(404,'Producto no encontrado');
   return result.rows[0];
  });
  routes.patch('/api/v1/tenants/:tenantId/barbers/:barberId/photo',async req=>{
   const tenant=parseOrThrow(id,req.params.tenantId),barber=parseOrThrow(id,req.params.barberId);
   const role=await requireTenant(db,tenant,req.actor.id,['owner','manager','barber']);
   if(role==='barber'){
     const own=await db.query('SELECT 1 FROM public.barbers WHERE tenant_id=$1 AND id=$2 AND user_id=$3',[tenant,barber,req.actor.id]);
     if(!own.rowCount)failure(403,'Solo puedes editar tu perfil profesional');
   }
   const x=parseOrThrow(z.object({url}).strict(),req.body);
   const result=await db.query('UPDATE public.barbers SET photo_url=$3 WHERE tenant_id=$1 AND id=$2 RETURNING id,photo_url',[tenant,barber,x.url]);
   if(!result.rowCount)failure(404,'Barbero no encontrado');
   return result.rows[0];
  });
  routes.patch('/api/v1/tenants/:tenantId/branding',async req=>{
   const tenant=parseOrThrow(id,req.params.tenantId);
   await requireTenant(db,tenant,req.actor.id,['owner','manager']);
   const x=parseOrThrow(z.object({kind:z.enum(['logo','cover']),url}).strict(),req.body);
   const column=x.kind==='logo'?'logo_url':'cover_url';
   const result=await db.query('UPDATE public.tenants SET '+column+'=$2 WHERE id=$1 RETURNING logo_url,cover_url',[tenant,x.url]);
   if(!result.rowCount)failure(404,'Barbería no encontrada');
   return result.rows[0];
  });
  routes.patch('/api/v1/tenants/:tenantId/barbers/:barberId/contract',async req=>{
   const tenant=parseOrThrow(id,req.params.tenantId),barber=parseOrThrow(id,req.params.barberId);
   await requireTenant(db,tenant,req.actor.id,['owner','manager']);
   const x=parseOrThrow(z.object({
     contractType:z.enum(['commission','chair_rental','hybrid']),
     commissionRate:z.number().min(0).max(1),
     chairRentalFee:z.number().int().min(0).max(1_000_000_000),
     chairRentalPeriod:z.enum(['daily','weekly','biweekly','monthly']),
     status:z.enum(['active','inactive'])
   }).strict().superRefine((v,ctx)=>{
     if(v.contractType==='chair_rental'&&v.chairRentalFee<=0)
       ctx.addIssue({code:'custom',message:'El arriendo requiere una cuota mayor que cero',path:['chairRentalFee']});
     if(v.contractType==='hybrid'&&(v.chairRentalFee<=0||v.commissionRate<=0))
       ctx.addIssue({code:'custom',message:'La modalidad híbrida requiere una cuota y una comisión',path:['chairRentalFee']});
   }),req.body);
   const row=await db.query(`UPDATE public.barbers
     SET contract_type=$3,commission_rate=$4,chair_rental_fee=$5,
         chair_rental_period=$6,status=$7
     WHERE tenant_id=$1 AND id=$2 RETURNING id,contract_type,commission_rate,chair_rental_fee,chair_rental_period,status`,
     [tenant,barber,x.contractType,x.commissionRate,x.chairRentalFee,x.chairRentalPeriod,x.status]);
   if(!row.rowCount)failure(404,'Barbero no encontrado');
   return row.rows[0];
  });
  routes.patch('/api/v1/tenants/:tenantId/gallery',async req=>{
   const tenant=parseOrThrow(id,req.params.tenantId);
   await requireTenant(db,tenant,req.actor.id,['owner','manager']);
   const x=parseOrThrow(gallery,req.body);
   const result=await db.query('UPDATE public.tenants SET portfolio=$2 WHERE id=$1 RETURNING portfolio',[tenant,x.photos]);
   if(!result.rowCount)failure(404,'Barbería no encontrada');
   return result.rows[0];
  });
  routes.patch('/api/v1/tenants/:tenantId/barbers/:barberId/gallery',async req=>{
   const tenant=parseOrThrow(id,req.params.tenantId),barber=parseOrThrow(id,req.params.barberId);
   const role=await requireTenant(db,tenant,req.actor.id,['owner','manager','barber']);
   if(role==='barber'){
     const own=await db.query('SELECT 1 FROM public.barbers WHERE tenant_id=$1 AND id=$2 AND user_id=$3',[tenant,barber,req.actor.id]);
     if(!own.rowCount)failure(403,'Solo puedes editar tu perfil profesional');
   }
   const x=parseOrThrow(gallery,req.body);
   const result=await db.query('UPDATE public.barbers SET portfolio=$3 WHERE tenant_id=$1 AND id=$2 RETURNING portfolio',[tenant,barber,x.photos]);
   if(!result.rowCount)failure(404,'Barbero no encontrado');
   return result.rows[0];
  });
 });
}
