import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {failure,parseOrThrow} from './security.js';

const id=z.uuid();
const url=z.string().url().max(2048);
const image=z.object({data:z.string().min(10).max(6_000_000),category:z.enum(['products','shop','barber'])}).strict();
const shopProfile=z.object({
 name:z.string().trim().min(2).max(120),tagline:z.string().max(240),
 address:z.string().max(240),city:z.string().max(120),phone:z.string().max(40)
}).strict();
const gallery=z.object({photos:z.array(url).max(10)}).strict();
function verifyImage(buffer){
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
  routes.post('/api/v1/tenants/:tenantId/images', {bodyLimit:6_500_000},async(req,reply)=>{
   const tenant=parseOrThrow(id,req.params.tenantId);
   await requireTenant(db,tenant,req.actor.id,['owner','manager']);
   if(!service)failure(503,'Servicio de imágenes no configurado');
   const x=parseOrThrow(image,req.body);
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
   const result=await db.query(`UPDATE public.tenants SET name=$2,tagline=$3,address=$4,city=$5,phone=$6
     WHERE id=$1 AND status='active' RETURNING *`,[tenant,x.name,x.tagline,x.address,x.city,x.phone]);
   if(!result.rowCount)failure(404,'Barbería no encontrada');
   return result.rows[0];
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
   await requireTenant(db,tenant,req.actor.id,['owner','manager']);
   const x=parseOrThrow(gallery,req.body);
   const result=await db.query('UPDATE public.barbers SET portfolio=$3 WHERE tenant_id=$1 AND id=$2 RETURNING portfolio',[tenant,barber,x.photos]);
   if(!result.rowCount)failure(404,'Barbero no encontrado');
   return result.rows[0];
  });
 });
}
