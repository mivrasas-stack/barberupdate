import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {failure,parseOrThrow} from './security.js';
import {checkBusinessSlot} from './business-hours.js';
import {normalizeBookingPhone} from './whatsapp-cloud.js';

const id=z.uuid();
const attendee=z.object({
  barberId:id,serviceId:id,startsAt:z.iso.datetime({offset:true}),
  customerName:z.string().trim().min(2).max(120),
  notes:z.string().max(2000).default('')
}).strict();
const groupSchema=z.object({
  appointments:z.array(attendee).min(2).max(4),
  customerPhone:z.string().trim().min(7).max(32),
  whatsappOptIn:z.boolean().default(false)
}).strict();

function localDate(instant,zone){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'})
    .formatToParts(new Date(instant));
  const part=(name)=>parts.find(x=>x.type===name)?.value;
  return part('year')+'-'+part('month')+'-'+part('day');
}

export function validateGroupCollisions(appointments){
  for(let i=0;i<appointments.length;i++){
    const first=appointments[i];
    for(let j=0;j<i;j++){
      const other=appointments[j];
      if(first.barberId===other.barberId&&first.startsAt<other.endsAt&&first.endsAt>other.startsAt)
        failure(409,'Un mismo barbero no puede atender dos personas a la vez. Selecciona otra hora o barbero.');
    }
  }
}

export async function registerGroupBookingRoutes(app,{db,security}){
  const {authenticated,limited}=security;
  app.get('/api/v1/public/tenants/:tenantId/booking-status',async req=>{
    await limited(req);
    if(!db)failure(503,'Base de datos no configurada');
    const tenant=parseOrThrow(id,req.params.tenantId);
    const result=await db.query("SELECT accepting_bookings FROM public.tenants WHERE id=$1 AND status='active'",[tenant]);
    if(!result.rowCount)failure(404,'Barbería no disponible');
    return {acceptingBookings:result.rows[0].accepting_bookings!==false};
  });
  app.patch('/api/v1/tenants/:tenantId/booking-status',async req=>{
    await authenticated(req);await limited(req);
    if(!db)failure(503,'Base de datos no configurada');
    const tenant=parseOrThrow(id,req.params.tenantId);
    await security.requireTenant(db,tenant,req.actor.id,['owner','manager']);
    const data=parseOrThrow(z.object({acceptingBookings:z.boolean()}).strict(),req.body);
    const row=await db.transaction(async tx=>{
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[tenant+':booking-status']);
      const updated=await tx.query(
        "UPDATE public.tenants SET accepting_bookings=$2 WHERE id=$1 AND status='active' RETURNING accepting_bookings",
        [tenant,data.acceptingBookings]);
      if(!updated.rowCount)failure(404,'Barbería no disponible');
      return updated.rows[0];
    });
    return {acceptingBookings:row.accepting_bookings};
  });
  app.post('/api/v1/tenants/:tenantId/group-bookings',async(req,reply)=>{
    await authenticated(req);await limited(req);
    if(!db)failure(503,'Base de datos no configurada');
    const tenant=parseOrThrow(id,req.params.tenantId);
    const {appointments,customerPhone,whatsappOptIn}=parseOrThrow(groupSchema,req.body);
    const key=req.headers['idempotency-key'];
    if(typeof key!=='string'||!/^[a-zA-Z0-9_-]{12,85}$/.test(key))
      failure(400,'Idempotency-Key requerido');
    const keys=appointments.map((_,i)=>key+'_'+i);
    const starts=appointments.map(a=>new Date(a.startsAt).getTime());
    const now=Date.now();
    if(starts.some(x=>!Number.isFinite(x)||x<now-60000||x>now+365*86400000))
      failure(400,'Fecha de reserva fuera de rango');
    let phone=customerPhone;
    if(whatsappOptIn){
      try{phone=normalizeBookingPhone(customerPhone);}
      catch(error){failure(400,error.message);}
    }
    const hashes=appointments.map((a,i)=>createHash('sha256')
      .update(JSON.stringify([i,a.barberId,a.serviceId,new Date(a.startsAt).toISOString(),a.customerName,phone,a.notes,whatsappOptIn]))
      .digest('hex'));
    const result=await db.transaction(async tx=>{
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
        [tenant+':'+req.actor.id+':group-booking:'+key]);
      const previous=await tx.query(
        'SELECT * FROM public.appointments WHERE tenant_id=$1 AND created_by=$2 AND idempotency_key=ANY($3::text[]) ORDER BY idempotency_key',
        [tenant,req.actor.id,keys]);
      if(previous.rowCount){
        if(previous.rowCount!==appointments.length||
           previous.rows.some(r=>hashes[keys.indexOf(r.idempotency_key)]!==r.request_hash))
          failure(409,'La solicitud ya se utilizó para otras reservas');
        return {appointments:previous.rows,groupId:previous.rows[0].booking_group_id,repeated:true};
      }
      // Serialize pause/resume and reservations to prevent a late booking after pause.
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[tenant+':booking-status']);
      const shop=await tx.query(
        "SELECT opening_hours,time_zone,accepting_bookings FROM public.tenants WHERE id=$1 AND status='active'",[tenant]);
      if(!shop.rowCount)failure(404,'Barbería no disponible');
      if(shop.rows[0].accepting_bookings===false)
        failure(409,'Esta barbería tiene las reservas temporalmente cerradas');
      const blackout=await tx.query(`SELECT 1 FROM public.tenant_booking_blackouts
        WHERE tenant_id=$1 AND ($2::timestamptz AT TIME ZONE $3)::date BETWEEN start_date AND end_date LIMIT 1`,
        [tenant,appointments[0].startsAt,shop.rows[0].time_zone]);
      if(blackout.rowCount)failure(409,'Las nuevas reservas están cerradas para esta fecha.');
      const zone=shop.rows[0].time_zone;
      if(new Set(starts.map(t=>localDate(t,zone))).size!==1)
        failure(400,'Todas las citas del grupo deben ser para el mismo día');
      const links=await tx.query('SELECT tenant_id,barber_id FROM public.customer_links WHERE user_id=$1',[req.actor.id]);
      if(links.rowCount){
        const assigned=links.rows.find(r=>r.tenant_id===tenant);
        if(!assigned)failure(403,'Debes vincularte con esta barbería mediante su QR');
        if(assigned.barber_id&&appointments[0].barberId!==assigned.barber_id)
          failure(403,'Tu cita principal debe ser con el barbero vinculado por tu QR');
      }
      for(const barber of [...new Set(appointments.map(a=>a.barberId))].sort())
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[tenant+':schedule:'+barber]);
      const details=[];
      for(const a of appointments){
        const data=await tx.query(
          "SELECT b.id AS barber_id,s.duration_minutes FROM public.barbers b JOIN public.services s ON s.tenant_id=b.tenant_id WHERE b.tenant_id=$1 AND b.id=$2 AND b.status='active' AND s.id=$3 AND s.is_active=true",
          [tenant,a.barberId,a.serviceId]);
        if(!data.rowCount)failure(404,'Servicio o barbero no disponible');
        const startsAt=new Date(a.startsAt).toISOString();
        const endsAt=new Date(Date.parse(startsAt)+Number(data.rows[0].duration_minutes)*60000).toISOString();
        if(!checkBusinessSlot(shop.rows[0].opening_hours,zone,startsAt,endsAt))
          failure(409,'Una cita está fuera del horario de la barbería');
        // Only offer and accept slots within the professional's own shifts.
        const shift=await tx.query(
          "SELECT EXISTS(SELECT 1 FROM public.barber_work_intervals w WHERE w.tenant_id=$1 AND w.barber_id=$2 AND w.weekday=EXTRACT(DOW FROM $3::timestamptz AT TIME ZONE $5)::int AND w.start_minute<=EXTRACT(HOUR FROM $3::timestamptz AT TIME ZONE $5)::int*60+EXTRACT(MINUTE FROM $3::timestamptz AT TIME ZONE $5)::int AND w.end_minute>=EXTRACT(HOUR FROM $4::timestamptz AT TIME ZONE $5)::int*60+EXTRACT(MINUTE FROM $4::timestamptz AT TIME ZONE $5)::int AND ($3::timestamptz AT TIME ZONE $5)::date=($4::timestamptz AT TIME ZONE $5)::date) AS scheduled, EXISTS(SELECT 1 FROM public.barber_time_off o WHERE o.tenant_id=$1 AND o.barber_id=$2 AND o.starts_at<$4::timestamptz AND o.ends_at>$3::timestamptz) AS time_off",
          [tenant,a.barberId,startsAt,endsAt,zone]);
        if(!shift.rows[0]?.scheduled||shift.rows[0]?.time_off)
          failure(409,'Uno de los horarios ya no está disponible');
        details.push({...a,startsAt,endsAt});
      }
      validateGroupCollisions(details);
      if(whatsappOptIn){
        await tx.query(
          'INSERT INTO public.whatsapp_consents(tenant_id,user_id,phone_e164) VALUES($1,$2,$3) ON CONFLICT(tenant_id,user_id,phone_e164) DO UPDATE SET consented_at=now(),revoked_at=NULL',
          [tenant,req.actor.id,phone]);
      }
      const groupId=randomUUID();
      const created=[];
      for(let i=0;i<details.length;i++){
        const a=details[i];
        const inserted=await tx.query(
          "INSERT INTO public.appointments(tenant_id,barber_id,service_id,customer_user_id,customer_name,customer_phone,created_by,starts_at,ends_at,price_minor,notes,idempotency_key,request_hash,status,booking_group_id) SELECT $1,b.id,s.id,$4,$5,$6,$4,$7::timestamptz,$8::timestamptz,s.price_minor,$9,$10,$11,'confirmed',$12::uuid FROM public.services s JOIN public.tenants t ON t.id=s.tenant_id AND t.status='active' JOIN public.barbers b ON b.tenant_id=s.tenant_id AND b.id=$2 AND b.status='active' WHERE s.tenant_id=$1 AND s.id=$3 AND s.is_active=true RETURNING *",
          [tenant,a.barberId,a.serviceId,req.actor.id,a.customerName,phone,a.startsAt,a.endsAt,a.notes,keys[i],hashes[i],groupId]);
        if(!inserted.rowCount)failure(409,'Uno de los horarios ya no está disponible');
        created.push(inserted.rows[0]);
      }
      return {appointments:created,groupId,repeated:false};
    });
    return reply.code(result.repeated?200:201).send({groupId:result.groupId,appointments:result.appointments});
  });
}