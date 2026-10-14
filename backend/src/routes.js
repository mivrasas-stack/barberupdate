import { z } from 'zod';
import { createHash } from 'node:crypto';
import { failure, parseOrThrow, uuid } from './security.js';

const id = z.uuid();
const word = (max=160) => z.string().trim().min(1).max(max);
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80);
const owners = ['owner','manager'];
const appointmentStatuses = ['pending','confirmed','waiting','in_service','completed','cancelled','no_show'];
export function endOfBooking(value, duration, now=Date.now()) {
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms) || ms < now-60000 || ms > now+365*86400000) failure(400,'Fecha fuera de rango');
  if (!Number.isInteger(duration) || duration<5 || duration>600) failure(400,'Duracion fuera de rango');
  return new Date(ms+duration*60000).toISOString();
}
const tenantSchema = z.object({ name:word(120),slug,currency:z.enum(['COP','USD','EUR']).default('COP'),timeZone:word(80).default('America/Bogota') }).strict();
const bookingSchema = z.object({ barberId:id,serviceId:id,startsAt:z.iso.datetime({offset:true}),customerName:word(120),customerPhone:word(32),notes:z.string().max(2000).default('') }).strict();

export async function registerRoutes(app,{config,db,security}) {
  const {authenticated,limited,requireTenant,service}=security;
  app.register(async routes=>{
    routes.addHook('preHandler',async req=>{
      await authenticated(req); await limited(req);
      if(!db) failure(503,'Base de datos no configurada');
    });
    // Platform privileges are verified server-side; never inferred from client roles or JWT metadata.
    routes.get('/api/v1/me',async req=>{
      const granted=await db.query('SELECT 1 FROM public.platform_admins WHERE user_id=$1',[req.actor.id]);
      return {id:req.actor.id,email:req.actor.email,platformRole:granted.rowCount?'superadmin':null};
    });
    routes.get('/api/v1/platform/tenants',async req=>{
      const granted=await db.query('SELECT 1 FROM public.platform_admins WHERE user_id=$1',[req.actor.id]);
      if(!granted.rowCount)failure(403,'Solo administradores globales');
      return (await db.query(
        'SELECT id,name,slug,currency,time_zone,status,business_kind FROM public.tenants ORDER BY created_at DESC LIMIT 100'
      )).rows;
    });
    routes.get('/api/v1/tenants',async req=>{
      const result=await db.query('SELECT t.id,t.name,t.slug,t.currency,t.time_zone,t.status,t.business_kind,m.role FROM public.tenants t JOIN public.tenant_members m ON m.tenant_id=t.id WHERE m.user_id=$1 ORDER BY t.created_at DESC LIMIT 100',[req.actor.id]);
      return result.rows;
    });
    routes.post('/api/v1/tenants',async (req,reply)=>{
      const x=parseOrThrow(tenantSchema,req.body);
      const row=await db.transaction(async tx=>{
        const a=await tx.query('INSERT INTO public.tenants(name,slug,owner_user_id,currency,time_zone) VALUES($1,$2,$3,$4,$5) RETURNING *',[x.name,x.slug,req.actor.id,x.currency,x.timeZone]);
        await tx.query("INSERT INTO public.tenant_members(tenant_id,user_id,role) VALUES($1,$2,'owner')",[a.rows[0].id,req.actor.id]);
        return a.rows[0];
      });
      return reply.code(201).send(row);
    });
    routes.get('/api/v1/tenants/:tenantId/members',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      await requireTenant(db,tenant,req.actor.id,owners);
      return (await db.query('SELECT user_id,role,created_at FROM public.tenant_members WHERE tenant_id=$1 ORDER BY created_at',[tenant])).rows;
    });
    routes.post('/api/v1/tenants/:tenantId/members',async (req,reply)=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      await requireTenant(db,tenant,req.actor.id,['owner']);
      const x=parseOrThrow(z.object({userId:id,role:z.enum(['manager','barber'])}).strict(),req.body);
      if(!service) failure(503,'Administracion de usuarios no configurada');
      const target=await service.auth.admin.getUserById(x.userId);
      if(target.error||!target.data?.user) failure(404,'Usuario no registrado en Supabase Auth');
      const row=await db.query("INSERT INTO public.tenant_members(tenant_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT(tenant_id,user_id) DO UPDATE SET role=EXCLUDED.role WHERE tenant_members.role <> 'owner' RETURNING tenant_id,user_id,role",[tenant,x.userId,x.role]);
      if(!row.rowCount) failure(409,'El propietario no puede perder su rol');
      return reply.code(201).send(row.rows[0]);
    });
    routes.get('/api/v1/tenants/:tenantId/barbers',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      await requireTenant(db,tenant,req.actor.id);
      return (await db.query('SELECT id,tenant_id,slug,name,bio,status,commission_rate,user_id,created_at FROM public.barbers WHERE tenant_id=$1 ORDER BY name LIMIT 200',[tenant])).rows;
    });
    routes.post('/api/v1/tenants/:tenantId/barbers',async (req,reply)=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      await requireTenant(db,tenant,req.actor.id,owners);
      const x=parseOrThrow(z.object({name:word(120),slug,userId:id.nullish(),bio:z.string().max(2000).default(''),commissionRate:z.number().min(0).max(1).default(0)}).strict(),req.body);
      if(x.userId){
        const member=await db.query("SELECT 1 FROM public.tenant_members WHERE tenant_id=$1 AND user_id=$2 AND role='barber'",[tenant,x.userId]);
        if(!member.rowCount) failure(400,'El barbero debe ser miembro de la empresa con rol barber');
      }
      const row=await db.query('INSERT INTO public.barbers(tenant_id,name,slug,user_id,bio,commission_rate) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[tenant,x.name,x.slug,x.userId||null,x.bio,x.commissionRate]);
      return reply.code(201).send(row.rows[0]);
    });
    routes.get('/api/v1/tenants/:tenantId/services',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      await requireTenant(db,tenant,req.actor.id);
      return (await db.query('SELECT * FROM public.services WHERE tenant_id=$1 ORDER BY name LIMIT 200',[tenant])).rows;
    });
    routes.post('/api/v1/tenants/:tenantId/services',async (req,reply)=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      await requireTenant(db,tenant,req.actor.id,owners);
      const x=parseOrThrow(z.object({name:word(120),description:z.string().max(2000).default(''),priceMinor:z.number().int().min(0).max(1000000000),durationMinutes:z.number().int().min(5).max(600),category:word(60)}).strict(),req.body);
      const row=await db.query('INSERT INTO public.services(tenant_id,name,description,price_minor,duration_minutes,category) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[tenant,x.name,x.description,x.priceMinor,x.durationMinutes,x.category]);
      return reply.code(201).send(row.rows[0]);
    });
    routes.patch('/api/v1/tenants/:tenantId/services/:serviceId',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId),serviceId=parseOrThrow(id,req.params.serviceId);
      await requireTenant(db,tenant,req.actor.id,owners);
      const x=parseOrThrow(z.object({
        name:word(120),description:z.string().max(2000).default(''),
        priceMinor:z.number().int().min(0).max(1000000000),
        durationMinutes:z.number().int().min(5).max(600),category:word(60)
      }).strict(),req.body);
      const changed=await db.query(
        'UPDATE public.services SET name=$3,description=$4,price_minor=$5,duration_minutes=$6,category=$7 WHERE tenant_id=$1 AND id=$2 RETURNING *',
        [tenant,serviceId,x.name,x.description,x.priceMinor,x.durationMinutes,x.category]);
      if(!changed.rowCount)failure(404,'Servicio no encontrado');
      return changed.rows[0];
    });
    routes.post('/api/v1/tenants/:tenantId/bookings',async (req,reply)=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      const x=parseOrThrow(bookingSchema,req.body);
      const key=req.headers['idempotency-key'];
      if(typeof key!=='string'||!/^[a-zA-Z0-9_-]{12,100}$/.test(key)) failure(400,'Idempotency-Key requerido (12-100 caracteres)');
      const startsAt=new Date(x.startsAt).toISOString();
      endOfBooking(startsAt,30);
      const requestHash=createHash('sha256').update(JSON.stringify([x.barberId,x.serviceId,startsAt,x.customerName,x.customerPhone,x.notes])).digest('hex');
      const booking=await db.transaction(async tx=>{
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[tenant+':'+req.actor.id+':booking:'+key]);
        const existing=await tx.query('SELECT * FROM public.appointments WHERE tenant_id=$1 AND created_by=$2 AND idempotency_key=$3',[tenant,req.actor.id,key]);
        if(existing.rowCount) {
          if(existing.rows[0].request_hash && existing.rows[0].request_hash!==requestHash) failure(409,'Idempotency-Key reutilizada con datos diferentes');
          return {row:existing.rows[0],repeated:true};
        }
        // Serialize slot reservation with work-hour and time-off changes.
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[tenant+':schedule:'+x.barberId]);
        // One PostgreSQL round trip validates tenant + active barber + service,
        // computes authoritative duration/price and inserts the reservation.
        // The database exclusion constraint and schedule trigger remain authoritative.
        const inserted=await tx.query(
          "INSERT INTO public.appointments(tenant_id,barber_id,service_id,customer_user_id,customer_name,customer_phone,created_by,starts_at,ends_at,price_minor,notes,idempotency_key,request_hash) SELECT $1,b.id,s.id,$4,$5,$6,$4,$7::timestamptz,$7::timestamptz + s.duration_minutes * interval '1 minute',s.price_minor,$8,$9,$10 FROM public.services s JOIN public.tenants t ON t.id=s.tenant_id AND t.status='active' JOIN public.barbers b ON b.tenant_id=s.tenant_id AND b.id=$2 AND b.status='active' WHERE s.tenant_id=$1 AND s.id=$3 AND s.is_active=true RETURNING *",
          [tenant,x.barberId,x.serviceId,req.actor.id,x.customerName,x.customerPhone,startsAt,x.notes,key,requestHash]);
        if(!inserted.rowCount) failure(404,'Servicio o barbero no disponible');
        return {row:inserted.rows[0],repeated:false};
      });
      return reply.code(booking.repeated?200:201).send(booking.row);
    });
    routes.get('/api/v1/me/bookings',async req=>{
      return (await db.query('SELECT id,tenant_id,barber_id,service_id,starts_at,ends_at,status,price_minor,created_at FROM public.appointments WHERE customer_user_id=$1 ORDER BY starts_at DESC LIMIT 100',[req.actor.id])).rows;
    });
    routes.get('/api/v1/tenants/:tenantId/appointments',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      const role=await requireTenant(db,tenant,req.actor.id);
      const q=parseOrThrow(z.object({start:z.iso.datetime({offset:true}),end:z.iso.datetime({offset:true})}),req.query);
      const start=Date.parse(q.start),end=Date.parse(q.end);
      if(end<=start||end-start>31*86400000) failure(400,'Rango maximo 31 dias');
      const result=await db.query("SELECT a.* FROM public.appointments a JOIN public.barbers b ON b.id=a.barber_id AND b.tenant_id=a.tenant_id WHERE a.tenant_id=$1 AND a.starts_at >= $2 AND a.starts_at < $3 AND ($4 <> 'barber' OR b.user_id=$5) ORDER BY a.starts_at LIMIT 500",[tenant,q.start,q.end,role,req.actor.id]);
      return result.rows;
    });
    routes.patch('/api/v1/tenants/:tenantId/appointments/:appointmentId/status',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId),apt=parseOrThrow(id,req.params.appointmentId);
      const role=await requireTenant(db,tenant,req.actor.id,['owner','manager','barber']);
      const x=parseOrThrow(z.object({status:z.enum(appointmentStatuses)}).strict(),req.body);
      return db.transaction(async tx=>{
        const found=await tx.query('SELECT a.*,b.user_id AS barber_user_id FROM public.appointments a JOIN public.barbers b ON b.id=a.barber_id AND b.tenant_id=a.tenant_id WHERE a.tenant_id=$1 AND a.id=$2 FOR UPDATE OF a',[tenant,apt]);
        if(!found.rowCount) failure(404,'Reserva no encontrada');
        const old=found.rows[0];
        if(role==='barber'&&old.barber_user_id!==req.actor.id) failure(403,'No autorizado');
        const transitions={pending:['confirmed','cancelled'],confirmed:['waiting','cancelled','no_show'],waiting:['in_service','cancelled','no_show'],in_service:['completed'],completed:[],cancelled:[],no_show:[]};
        if(!transitions[old.status]?.includes(x.status)) failure(409,'Transicion no permitida');
        return (await tx.query('UPDATE public.appointments SET status=$3,updated_at=now() WHERE tenant_id=$1 AND id=$2 RETURNING *',[tenant,apt,x.status])).rows[0];
      });
    });
    routes.get('/api/v1/tenants/:tenantId/products',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId);await requireTenant(db,tenant,req.actor.id);
      return (await db.query('SELECT * FROM public.products WHERE tenant_id=$1 ORDER BY name LIMIT 300',[tenant])).rows;
    });
    routes.post('/api/v1/tenants/:tenantId/products',async (req,reply)=>{
      const tenant=parseOrThrow(id,req.params.tenantId);await requireTenant(db,tenant,req.actor.id,owners);
      const x=parseOrThrow(z.object({
        name:word(120),sku:word(80),priceMinor:z.number().int().min(0),
        stock:z.number().int().min(0).default(0),
        description:z.string().max(2000).default(''),
        photoUrl:z.string().max(2048).default(''),
        category:z.enum(['beauty','food_drinks','barbershop_merch']).default('beauty'),
        costMinor:z.number().int().min(0).default(0),
        minStock:z.number().int().min(0).default(0),
        waitingRoomVisible:z.boolean().default(true)
      }).strict(),req.body);
      const row=await db.query(
        'INSERT INTO public.products(tenant_id,name,sku,price_minor,stock,description,photo_url,category,cost_minor,min_stock,waiting_room_visible) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',
        [tenant,x.name,x.sku,x.priceMinor,x.stock,x.description,x.photoUrl,x.category,x.costMinor,x.minStock,x.waitingRoomVisible]);
      return reply.code(201).send(row.rows[0]);
    });
    routes.post('/api/v1/tenants/:tenantId/products/:productId/stock',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId),product=parseOrThrow(id,req.params.productId);
      await requireTenant(db,tenant,req.actor.id,owners);
      const x=parseOrThrow(z.object({delta:z.number().int().min(-100000).max(100000).refine(v=>v!==0),reason:word(200)}).strict(),req.body);
      return db.transaction(async tx=>{
        const row=await tx.query('UPDATE public.products SET stock=stock+$3,updated_at=now() WHERE tenant_id=$1 AND id=$2 AND stock+$3>=0 RETURNING *',[tenant,product,x.delta]);
        if(!row.rowCount) failure(409,'Stock insuficiente o producto inexistente');
        await tx.query('INSERT INTO public.inventory_movements(tenant_id,product_id,delta,reason,user_id) VALUES($1,$2,$3,$4,$5)',[tenant,product,x.delta,x.reason,req.actor.id]);
        return row.rows[0];
      });
    });
    routes.patch('/api/v1/tenants/:tenantId/products/:productId/visibility',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId),product=parseOrThrow(id,req.params.productId);
      await requireTenant(db,tenant,req.actor.id,owners);
      const x=parseOrThrow(z.object({visible:z.boolean()}).strict(),req.body);
      const row=await db.query('UPDATE public.products SET waiting_room_visible=$3,updated_at=now() WHERE tenant_id=$1 AND id=$2 RETURNING *',
        [tenant,product,x.visible]);
      if(!row.rowCount)failure(404,'Producto no encontrado');
      return row.rows[0];
    });
    routes.get('/api/v1/tenants/:tenantId/transactions',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId);await requireTenant(db,tenant,req.actor.id,owners);
      return (await db.query('SELECT * FROM public.transactions WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 300',[tenant])).rows;
    });
    routes.post('/api/v1/tenants/:tenantId/transactions',async (req,reply)=>{
      const tenant=parseOrThrow(id,req.params.tenantId);await requireTenant(db,tenant,req.actor.id,owners);
      const x=parseOrThrow(z.object({type:z.enum(['income','expense']),category:word(70),concept:word(250),amountMinor:z.number().int().positive(),paymentMethod:z.enum(['cash','debit','credit','transfer','nequi','daviplata','split'])}).strict(),req.body);
      const row=await db.transaction(async tx=>{
        const today=await tx.query("SELECT (now() AT TIME ZONE time_zone)::date::text AS local_day FROM public.tenants WHERE id=$1 AND status='active'",[tenant]);
        if(!today.rowCount) failure(404,'Negocio no disponible');
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[tenant+':cash:'+today.rows[0].local_day]);
        return (await tx.query('INSERT INTO public.transactions(tenant_id,type,category,concept,amount_minor,payment_method,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
          [tenant,x.type,x.category,x.concept,x.amountMinor,x.paymentMethod,req.actor.id])).rows[0];
      });
      return reply.code(201).send(row);
    });
    routes.post('/api/v1/tenants/:tenantId/media/signed-upload',async (req,reply)=>{
      const tenant=parseOrThrow(id,req.params.tenantId);await requireTenant(db,tenant,req.actor.id,owners);
      if(!service) failure(503,'Storage no configurado');
      const x=parseOrThrow(z.object({mimeType:z.enum(['image/jpeg','image/png','image/webp']),kind:z.enum(['logo','cover','portfolio','service','product'])}).strict(),req.body);
      const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[x.mimeType];
      const path=tenant+'/'+x.kind+'/'+uuid()+'.'+ext;
      const signed=await service.storage.from(config.mediaBucket).createSignedUploadUrl(path);
      if(signed.error) failure(503,'No se pudo firmar la carga');
      await db.query('INSERT INTO public.media_assets(tenant_id,owner_user_id,storage_bucket,storage_path,mime_type,kind) VALUES($1,$2,$3,$4,$5,$6)',[tenant,req.actor.id,config.mediaBucket,path,x.mimeType,x.kind]);
      return reply.code(201).send({bucket:config.mediaBucket,path,signedUrl:signed.data.signedUrl,token:signed.data.token});
    });
  });
  app.get('/api/v1/public/tenants',async req=>{
    await limited(req);if(!db)failure(503,'Base de datos no configurada');
    return (await db.query("SELECT id,name,slug,currency,time_zone FROM public.tenants WHERE status='active' ORDER BY name LIMIT 100")).rows;
  });
  app.get('/api/v1/public/tenants/:tenantId/products',async req=>{
    await limited(req);if(!db)failure(503,'Base de datos no configurada');
    const tenant=parseOrThrow(id,req.params.tenantId);
    return (await db.query("SELECT p.id,p.name,p.sku,p.price_minor,p.stock,p.description,p.photo_url,p.category,p.cost_minor,p.min_stock,p.waiting_room_visible FROM public.products p JOIN public.tenants t ON t.id=p.tenant_id WHERE p.tenant_id=$1 AND p.is_active=true AND p.waiting_room_visible=true AND t.status='active' ORDER BY p.name LIMIT 200",[tenant])).rows;
  });
  app.get('/api/v1/public/tenants/:slug/catalog',async req=>{
    await limited(req); if(!db) failure(503,'Base de datos no configurada');
    const name=parseOrThrow(slug,req.params.slug);
    const t=await db.query("SELECT id,name,slug,currency,time_zone FROM public.tenants WHERE slug=$1 AND status='active'",[name]);
    if(!t.rowCount) failure(404,'Negocio no encontrado');
    const tenant=t.rows[0];
    const [barbers,services]=await Promise.all([
      db.query("SELECT id,slug,name,bio FROM public.barbers WHERE tenant_id=$1 AND status='active' ORDER BY name LIMIT 100",[tenant.id]),
      db.query("SELECT id,name,description,price_minor,duration_minutes,category FROM public.services WHERE tenant_id=$1 AND is_active=true ORDER BY name LIMIT 100",[tenant.id])
    ]);
    return {tenant,barbers:barbers.rows,services:services.rows};
  });
}
