import { z } from 'zod';
import { createHash } from 'node:crypto';
import { failure, parseOrThrow, uuid } from './security.js';
import { createProfessionalProfile } from './platform-admin.js';

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
const tenantSchema = z.object({ name:word(120),slug,currency:z.literal('COP').default('COP'),timeZone:word(80).default('America/Bogota') }).strict();
const servicePayload=z.object({
 name:word(120),description:z.string().max(2000).default(''),
 priceMinor:z.number().int().min(0).max(1000000000),
 durationMinutes:z.number().int().min(5).max(600),category:word(60),
 earnsLoyaltyPoints:z.boolean().optional()
}).strict();
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
        'SELECT id,name,slug,currency,time_zone,status,business_kind,owner_user_id,city,address,phone,email,tagline,opening_hours,logo_url,cover_url,created_at FROM public.tenants ORDER BY created_at DESC LIMIT 100'
      )).rows;
    });
    routes.get('/api/v1/tenants',async req=>{
      const result=await db.query('SELECT t.*,m.role FROM public.tenants t JOIN public.tenant_members m ON m.tenant_id=t.id WHERE m.user_id=$1 ORDER BY t.created_at DESC LIMIT 100',[req.actor.id]);
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
      return (await db.query('SELECT * FROM public.barbers WHERE tenant_id=$1 ORDER BY name LIMIT 200',[tenant])).rows;
    });
    routes.post('/api/v1/tenants/:tenantId/barbers',async (req,reply)=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      await requireTenant(db,tenant,req.actor.id,owners);
      const x=parseOrThrow(z.object({name:word(120),slug,userId:id.nullish(),bio:z.string().max(2000).default(''),commissionRate:z.number().min(0).max(1).default(0)}).strict(),req.body);
      if(x.userId){
        const member=await db.query("SELECT 1 FROM public.tenant_members WHERE tenant_id=$1 AND user_id=$2 AND role IN ('barber','owner')",[tenant,x.userId]);
        if(!member.rowCount) failure(400,'El barbero debe ser miembro de la empresa con rol barber');
      }
      const row=await db.query('INSERT INTO public.barbers(tenant_id,name,slug,user_id,bio,commission_rate) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[tenant,x.name,x.slug,x.userId||null,x.bio,x.commissionRate]);
      return reply.code(201).send(row.rows[0]);
    });
    routes.post('/api/v1/tenants/:tenantId/barbers/me',async (req,reply)=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      await requireTenant(db,tenant,req.actor.id,['owner']);
      const x=parseOrThrow(z.object({name:word(120)}).strict(),req.body);
      const result=await db.transaction(async tx=>{
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[tenant+':owner-professional:'+req.actor.id]);
        const existing=await tx.query('SELECT id FROM public.barbers WHERE tenant_id=$1 AND user_id=$2',[tenant,req.actor.id]);
        const barber=await createProfessionalProfile(tx,tenant,req.actor.id,x.name,'propietario');
        return {row:barber,created:!existing.rowCount};
      });
      return reply.code(result.created?201:200).send(result.row);
    });
    routes.get('/api/v1/tenants/:tenantId/services',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      await requireTenant(db,tenant,req.actor.id);
      return (await db.query('SELECT * FROM public.services WHERE tenant_id=$1 ORDER BY name LIMIT 200',[tenant])).rows;
    });
    routes.post('/api/v1/tenants/:tenantId/services',async (req,reply)=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      await requireTenant(db,tenant,req.actor.id,[...owners,'barber']);
      const x=parseOrThrow(servicePayload,req.body);
      const row=await db.query('INSERT INTO public.services(tenant_id,name,description,price_minor,duration_minutes,category,earns_loyalty_points) VALUES($1,$2,$3,$4,$5,$6,COALESCE($7,false)) RETURNING *',[tenant,x.name,x.description,x.priceMinor,x.durationMinutes,x.category,x.earnsLoyaltyPoints]);
      return reply.code(201).send(row.rows[0]);
    });
    routes.patch('/api/v1/tenants/:tenantId/services/:serviceId',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId),serviceId=parseOrThrow(id,req.params.serviceId);
      await requireTenant(db,tenant,req.actor.id,[...owners,'barber']);
      const x=parseOrThrow(servicePayload,req.body);
      const changed=await db.query(
        'UPDATE public.services SET name=$3,description=$4,price_minor=$5,duration_minutes=$6,category=$7,earns_loyalty_points=COALESCE($8,earns_loyalty_points) WHERE tenant_id=$1 AND id=$2 RETURNING *',
        [tenant,serviceId,x.name,x.description,x.priceMinor,x.durationMinutes,x.category,x.earnsLoyaltyPoints]);
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
        // Customers linked by QR may book only their affiliated tenant and,
        // for a professional-specific QR, that one barber. Preserve the
        // existing booking flow for accounts that have no QR affiliations.
        const links=await tx.query('SELECT tenant_id,barber_id FROM public.customer_links WHERE user_id=$1',[req.actor.id]);
        if(links.rowCount){
          const linked=links.rows.find(link=>link.tenant_id===tenant);
          if(!linked)failure(403,'Debes vincularte con esta barbería mediante su QR');
          if(linked.barber_id&&linked.barber_id!==x.barberId)
            failure(403,'Tu QR permite reservar solamente con el barbero vinculado');
        }
        // Serialize slot reservation with work-hour and time-off changes.
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[tenant+':schedule:'+x.barberId]);
        // One PostgreSQL round trip validates tenant + active barber + service,
        // computes authoritative duration/price and inserts an ALREADY CONFIRMED reservation.
        // Keep DB's legacy default for existing rows/other flows; new customer bookings
        // must not require an employee's confirmation.
        // The database exclusion constraint and schedule trigger remain authoritative.
        const inserted=await tx.query(
          "INSERT INTO public.appointments(tenant_id,barber_id,service_id,customer_user_id,customer_name,customer_phone,created_by,starts_at,ends_at,price_minor,notes,idempotency_key,request_hash,status) SELECT $1,b.id,s.id,$4,$5,$6,$4,$7::timestamptz,$7::timestamptz + s.duration_minutes * interval '1 minute',s.price_minor,$8,$9,$10,'confirmed' FROM public.services s JOIN public.tenants t ON t.id=s.tenant_id AND t.status='active' JOIN public.barbers b ON b.tenant_id=s.tenant_id AND b.id=$2 AND b.status='active' WHERE s.tenant_id=$1 AND s.id=$3 AND s.is_active=true RETURNING *",
          [tenant,x.barberId,x.serviceId,req.actor.id,x.customerName,x.customerPhone,startsAt,x.notes,key,requestHash]);
        if(!inserted.rowCount) failure(404,'Servicio o barbero no disponible');
        return {row:inserted.rows[0],repeated:false};
      });
      return reply.code(booking.repeated?200:201).send(booking.row);
    });
    routes.get('/api/v1/me/bookings',async req=>{
      return (await db.query('SELECT id,tenant_id,barber_id,service_id,customer_user_id,starts_at,ends_at,status,price_minor,created_at FROM public.appointments WHERE customer_user_id=$1 ORDER BY starts_at DESC LIMIT 100',[req.actor.id])).rows;
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
      const x=parseOrThrow(z.object({
        status:z.enum(appointmentStatuses),
        reason:z.string().trim().min(3).max(250).optional()
      }).strict(),req.body);
      return db.transaction(async tx=>{
        const found=await tx.query('SELECT a.*,b.user_id AS barber_user_id FROM public.appointments a JOIN public.barbers b ON b.id=a.barber_id AND b.tenant_id=a.tenant_id WHERE a.tenant_id=$1 AND a.id=$2 FOR UPDATE OF a',[tenant,apt]);
        if(!found.rowCount) failure(404,'Reserva no encontrada');
        const old=found.rows[0];
        if(role==='barber'&&old.barber_user_id!==req.actor.id) failure(403,'No autorizado');
        // Staff can start an arrived client's service directly from a confirmed booking.
        // A no-show cannot be recorded until 15 minutes after the booked start.
        const transitions={pending:['confirmed','in_service','cancelled','no_show'],confirmed:['waiting','in_service','cancelled','no_show'],waiting:['in_service','cancelled','no_show'],in_service:[],completed:[],cancelled:[],no_show:[]};
        if(['cancelled','no_show'].includes(x.status)&&!x.reason) failure(400,'Indica el motivo de cancelacion');
        if(!['cancelled','no_show'].includes(x.status)&&x.reason) failure(400,'Solo se puede guardar motivo al cancelar o marcar ausencia');
        if(x.status==='no_show'&&new Date(old.starts_at).getTime()>Date.now()-15*60*1000)
          failure(409,'Solo puedes marcar ausencia 15 minutos después de la hora reservada');
        if(!transitions[old.status]?.includes(x.status)) failure(409,'Transicion no permitida');
        return (await tx.query('UPDATE public.appointments SET status=$3,cancellation_reason=$4,updated_at=now() WHERE tenant_id=$1 AND id=$2 RETURNING *',[tenant,apt,x.status,x.reason||null])).rows[0];
      });
    });
    // Cash collected by an authorized staff member is recorded atomically with completion.
    // A receipt is an operator attestation, NOT an external payment-provider confirmation.
    const receiptOf=(appointment,transaction,currency)=>({
      appointmentId:appointment.id,
      customerName:appointment.customer_name,
      serviceName:appointment.service_name,
      startsAt:appointment.starts_at,
      completed:appointment.status==='completed',
      totalMinor:Number(appointment.price_minor),
      currency,
      paymentMethod:transaction?.payment_method||'courtesy',
      transactionId:transaction?.id||null,
      receivedAt:transaction?.created_at||appointment.updated_at,
      recordedBy:transaction?.created_by||null,
      reference:transaction?.notes||'',
      verification:'Cobro presencial declarado por personal autorizado; no verificado por banco o pasarela.'
    });
    routes.post('/api/v1/tenants/:tenantId/appointments/:appointmentId/finish-and-pay',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId),apt=parseOrThrow(id,req.params.appointmentId);
      const role=await requireTenant(db,tenant,req.actor.id,['owner','manager','barber']);
      const payload=parseOrThrow(z.object({
        method:z.enum(['cash','nequi','daviplata','transfer','debit','credit']),
        confirmReceived:z.literal(true),
        reference:z.string().trim().max(120).optional()
      }).strict(),req.body);
      return db.transaction(async tx=>{
        const found=await tx.query(
          'SELECT a.*,b.user_id AS barber_user_id,s.name AS service_name FROM public.appointments a JOIN public.barbers b ON b.id=a.barber_id AND b.tenant_id=a.tenant_id JOIN public.services s ON s.id=a.service_id AND s.tenant_id=a.tenant_id WHERE a.tenant_id=$1 AND a.id=$2 FOR UPDATE OF a',
          [tenant,apt]);
        if(!found.rowCount)failure(404,'Cita no encontrada');
        const appointment=found.rows[0];
        if(role==='barber'&&appointment.barber_user_id!==req.actor.id)failure(403,'No puedes cobrar citas de otro barbero');
        const oldPayment=await tx.query(
          "SELECT * FROM public.transactions WHERE tenant_id=$1 AND reference_id=$2 AND type='income'",
          [tenant,apt]);
        const existing=oldPayment.rows[0]||null;
        if(appointment.status==='completed'){
          if(existing&&existing.payment_method!==payload.method)failure(409,'La cita ya tiene un cobro registrado con otro metodo');
          if(!existing&&Number(appointment.price_minor)>0)failure(409,'Cita finalizada sin un registro de cobro; revisar en Caja');
          const shop=await tx.query("SELECT currency FROM public.tenants WHERE id=$1",[tenant]);
          return receiptOf(appointment,existing,shop.rows[0]?.currency||'COP');
        }
        if(appointment.status!=='in_service')failure(409,'Primero inicia el corte antes de cobrar');
        if(existing)failure(409,'La cita ya tiene un ingreso asociado. Revisa Caja antes de continuar.');
        const amount=Number(appointment.price_minor);
        if(!Number.isSafeInteger(amount)||amount<0)failure(409,'Precio de cita invalido');
        // Serialize with cash closing. If the day is closed, the database rejects
        // the accounting entry and the appointment remains in service (rollback).
        const shop=await tx.query(
          "SELECT (now() AT TIME ZONE time_zone)::date::text AS local_day,currency FROM public.tenants WHERE id=$1 AND status='active'",
          [tenant]);
        if(!shop.rowCount)failure(404,'Barberia no disponible');
        let transaction=null;
        if(amount>0){
          await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[tenant+':cash:'+shop.rows[0].local_day]);
          const notes='Cobro manual de servicio, cita '+apt+(payload.reference?' | Referencia: '+payload.reference:'');
          const saved=await tx.query(
            "INSERT INTO public.transactions(tenant_id,type,category,concept,amount_minor,payment_method,reference_id,created_by,notes) VALUES($1,'income','haircut_service',$2,$3,$4,$5,$6,$7) RETURNING *",
            [tenant,'Corte: '+String(appointment.service_name).slice(0,225),amount,payload.method,apt,req.actor.id,notes]);
          transaction=saved.rows[0];
        }
        const updated=await tx.query(
          "UPDATE public.appointments SET status='completed',updated_at=now() WHERE tenant_id=$1 AND id=$2 AND status='in_service' RETURNING *",
          [tenant,apt]);
        if(!updated.rowCount)failure(409,'El estado de la cita cambio, intenta nuevamente');
        return receiptOf({...appointment,...updated.rows[0]},transaction,shop.rows[0].currency);
      });
    });
    routes.get('/api/v1/tenants/:tenantId/appointments/:appointmentId/payment-receipt',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId),apt=parseOrThrow(id,req.params.appointmentId);
      const role=await requireTenant(db,tenant,req.actor.id,['owner','manager','barber']);
      const result=await db.query(
        'SELECT a.*,b.user_id AS barber_user_id,s.name AS service_name,t.currency FROM public.appointments a JOIN public.barbers b ON b.id=a.barber_id AND b.tenant_id=a.tenant_id JOIN public.services s ON s.id=a.service_id AND s.tenant_id=a.tenant_id JOIN public.tenants t ON t.id=a.tenant_id WHERE a.tenant_id=$1 AND a.id=$2',
        [tenant,apt]);
      if(!result.rowCount)failure(404,'Cita no encontrada');
      const a=result.rows[0];
      if(role==='barber'&&a.barber_user_id!==req.actor.id)failure(403,'Sin permiso');
      if(a.status!=='completed')failure(409,'Aun no existe comprobante de servicio finalizado');
      const entries=await db.query(
        "SELECT * FROM public.transactions WHERE tenant_id=$1 AND reference_id=$2 AND type='income'",[tenant,apt]);
      if(!entries.rowCount&&Number(a.price_minor)>0)failure(404,'Sin ingreso contabilizado para esta cita');
      return receiptOf(a,entries.rows[0]||null,a.currency);
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
    // Inventory editing is owner-only; do not change stock through this endpoint.
    // Stock movements remain separately audited through /stock.
    routes.patch('/api/v1/tenants/:tenantId/products/:productId',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId),product=parseOrThrow(id,req.params.productId);
      await requireTenant(db,tenant,req.actor.id,owners);
      const x=parseOrThrow(z.object({
        name:word(120),sku:word(80),priceMinor:z.number().int().min(0),
        description:z.string().max(2000),photoUrl:z.string().max(2048),
        category:z.enum(['beauty','food_drinks','barbershop_merch']),
        costMinor:z.number().int().min(0),minStock:z.number().int().min(0)
      }).strict(),req.body);
      const row=await db.query(
        'UPDATE public.products SET name=$3,sku=$4,price_minor=$5,description=$6,photo_url=$7,category=$8,cost_minor=$9,min_stock=$10,updated_at=now() WHERE tenant_id=$1 AND id=$2 AND is_active=true RETURNING *',
        [tenant,product,x.name,x.sku,x.priceMinor,x.description,x.photoUrl,x.category,x.costMinor,x.minStock]);
      if(!row.rowCount)failure(404,'Producto activo no encontrado');
      return row.rows[0];
    });
    // Soft delete preserves order_items and inventory_movements for auditing.
    routes.delete('/api/v1/tenants/:tenantId/products/:productId',async(req,reply)=>{
      const tenant=parseOrThrow(id,req.params.tenantId),product=parseOrThrow(id,req.params.productId);
      await requireTenant(db,tenant,req.actor.id,owners);
      const row=await db.query(
        'UPDATE public.products SET is_active=false,waiting_room_visible=false,updated_at=now() WHERE tenant_id=$1 AND id=$2 AND is_active=true RETURNING id',
        [tenant,product]);
      if(!row.rowCount)failure(404,'Producto activo no encontrado');
      return reply.code(200).send({id:row.rows[0].id,archived:true});
    });
    routes.patch('/api/v1/tenants/:tenantId/products/:productId/restore',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId),product=parseOrThrow(id,req.params.productId);
      await requireTenant(db,tenant,req.actor.id,owners);
      const row=await db.query('UPDATE public.products SET is_active=true,updated_at=now() WHERE tenant_id=$1 AND id=$2 AND is_active=false RETURNING *',[tenant,product]);
      if(!row.rowCount)failure(404,'Producto archivado no encontrado');
      return row.rows[0];
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
      const x=parseOrThrow(z.object({type:z.enum(['income','expense']),category:word(70),concept:word(250),amountMinor:z.number().int().positive(),paymentMethod:z.enum(['cash','debit','credit','transfer','nequi','daviplata','split']),notes:z.string().trim().max(1000).default('')}).strict(),req.body);
      const row=await db.transaction(async tx=>{
        const today=await tx.query("SELECT (now() AT TIME ZONE time_zone)::date::text AS local_day FROM public.tenants WHERE id=$1 AND status='active'",[tenant]);
        if(!today.rowCount) failure(404,'Negocio no disponible');
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[tenant+':cash:'+today.rows[0].local_day]);
        return (await tx.query('INSERT INTO public.transactions(tenant_id,type,category,concept,amount_minor,payment_method,created_by,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
          [tenant,x.type,x.category,x.concept,x.amountMinor,x.paymentMethod,req.actor.id,x.notes])).rows[0];
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
    return (await db.query("SELECT id,name,slug,currency,time_zone,business_kind,logo_url,cover_url,tagline,address,city,phone,portfolio FROM public.tenants WHERE status='active' ORDER BY name LIMIT 100")).rows;
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
      db.query("SELECT id,slug,name,bio,photo_url,portfolio,specialties,experience_years,instagram_url,professional_phone FROM public.barbers WHERE tenant_id=$1 AND status='active' ORDER BY name LIMIT 100",[tenant.id]),
      db.query("SELECT id,name,description,price_minor,duration_minutes,category FROM public.services WHERE tenant_id=$1 AND is_active=true ORDER BY name LIMIT 100",[tenant.id])
    ]);
    return {tenant,barbers:barbers.rows,services:services.rows};
  });
}
