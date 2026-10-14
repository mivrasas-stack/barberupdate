import { z } from 'zod';
import { failure, parseOrThrow } from './security.js';

const id=z.uuid();
const date=z.iso.date();
const minute=z.number().int().min(0).max(1440);
const hours=z.object({
  intervals:z.array(z.object({
    weekday:z.number().int().min(0).max(6),
    startMinute:minute.refine(n=>n<1440),
    endMinute:minute.refine(n=>n>0),
  }).strict()).max(28)
}).strict();
const timeOff=z.object({
  startsAt:z.iso.datetime({offset:true}),
  endsAt:z.iso.datetime({offset:true}),
  reason:z.string().max(250).default('')
}).strict();
const idempotentRange=({startsAt,endsAt})=>{
  const s=Date.parse(startsAt),e=Date.parse(endsAt);
  if(!Number.isFinite(s)||!Number.isFinite(e)||e<=s||e-s>45*86400000||s<Date.now()-60000)
    failure(400,'Rango de ausencia invalido');
};
export function validateWorkIntervals(intervals) {
  const ordered=[...intervals].sort((a,b)=>a.weekday-b.weekday||a.startMinute-b.startMinute);
  for(let i=0;i<ordered.length;i++) {
    const x=ordered[i];
    if(x.endMinute<=x.startMinute) failure(400,'El final debe ser posterior al inicio');
    if(i && ordered[i-1].weekday===x.weekday && ordered[i-1].endMinute>x.startMinute)
      failure(400,'Horarios superpuestos');
  }
  return ordered;
}
export function validateSlotDate(value,now=Date.now()) {
  const t=Date.parse(value+'T12:00:00Z');
  if(!Number.isFinite(t)||t<now-2*86400000||t>now+366*86400000) failure(400,'Fecha fuera de rango');
}
const rescheduleBody=z.object({
  startsAt:z.iso.datetime({offset:true}),
  barberId:id.optional()
}).strict();

export async function registerSchedulingRoutes(app,{db,security}) {
  const {authenticated,limited,requireTenant}=security;
  async function reschedule(req,tenantId,appointmentId,customerOnly){
    const value=parseOrThrow(rescheduleBody,req.body);
    const newStart=new Date(value.startsAt);
    const minimum=Date.now()+(customerOnly?2*3600000:5*60000);
    if(newStart.getTime()<minimum||newStart.getTime()>Date.now()+365*86400000)
      failure(400,'La nueva cita debe estar dentro del plazo permitido');
    return db.transaction(async tx=>{
      const original=await tx.query(
        'SELECT id,tenant_id,customer_user_id,barber_id,service_id,starts_at,ends_at,status,reschedule_count FROM public.appointments WHERE tenant_id=$1 AND id=$2',
        [tenantId,appointmentId]);
      if(!original.rowCount) failure(404,'Reserva no encontrada');
      const before=original.rows[0];
      if(customerOnly){
        if(before.customer_user_id!==req.actor.id) failure(403,'Solo puedes modificar una reserva propia');
        if(new Date(before.starts_at).getTime()<Date.now()+2*3600000)
          failure(409,'Reprogramacion disponible hasta 2 horas antes');
      }
      if(!['pending','confirmed'].includes(before.status)) failure(409,'Reserva no reprogramable');
      const newBarber=value.barberId||before.barber_id;
      const oldStarts=new Date(before.starts_at).getTime();
      if(newStart.getTime()===oldStarts&&newBarber===before.barber_id)
        failure(409,'La reserva ya se encuentra en ese horario');
      // Consistent advisory-lock order serializes scheduling changes and new
      // bookings on both the previous and the requested barber calendars.
      for(const barber of [...new Set([before.barber_id,newBarber])].sort()){
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
          [tenantId+':schedule:'+barber]);
      }
      const locked=await tx.query(
        'SELECT barber_id,starts_at,status,ends_at FROM public.appointments WHERE tenant_id=$1 AND id=$2 FOR UPDATE',
        [tenantId,appointmentId]);
      const current=locked.rows[0];
      if(current.barber_id!==before.barber_id ||
        new Date(current.starts_at).getTime()!==oldStarts ||
        current.status!==before.status)failure(409,'La reserva cambio durante la reprogramacion: recarga la agenda');
      const target=await tx.query(
        "SELECT b.id FROM public.barbers b JOIN public.tenants t ON t.id=b.tenant_id WHERE b.tenant_id=$1 AND b.id=$2 AND b.status='active' AND t.status='active'",
        [tenantId,newBarber]);
      if(!target.rowCount)failure(404,'Barbero no disponible');
      const duration=new Date(before.ends_at).getTime()-oldStarts;
      if(!Number.isFinite(duration)||duration<300000||duration>600*60000)
        failure(409,'Duracion original invalida');
      const newEnd=new Date(newStart.getTime()+duration);
      return (await tx.query(
        'UPDATE public.appointments SET barber_id=$3,starts_at=$4,ends_at=$5,updated_at=now() WHERE id=$2 AND tenant_id=$1 RETURNING id,tenant_id,barber_id,service_id,starts_at,ends_at,status,reschedule_count',
        [tenantId,appointmentId,newBarber,newStart.toISOString(),newEnd.toISOString()]
      )).rows[0];
    });
  }
  const memberAccess=async(req,tenant,barber)=>{
    const role=await requireTenant(db,tenant,req.actor.id);
    if(role==='barber'){
      const b=await db.query('SELECT id FROM public.barbers WHERE id=$1 AND tenant_id=$2 AND user_id=$3',
        [barber,tenant,req.actor.id]);
      if(!b.rowCount) failure(403,'Solo puedes consultar tu propia agenda');
    }
    return role;
  };
  app.register(async routes=>{
    routes.addHook('preHandler',async req=>{
      await authenticated(req);
      await limited(req);
      if(!db) failure(503,'Base de datos no configurada');
    });
    routes.patch('/api/v1/me/bookings/:appointmentId/reschedule',async req=>{
      const appointment=parseOrThrow(id,req.params.appointmentId);
      const row=await db.query('SELECT tenant_id FROM public.appointments WHERE id=$1 AND customer_user_id=$2',[appointment,req.actor.id]);
      if(!row.rowCount) failure(404,'Reserva propia no encontrada');
      return reschedule(req,row.rows[0].tenant_id,appointment,true);
    });
    routes.patch('/api/v1/tenants/:tenantId/appointments/:appointmentId/reschedule',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      const appointment=parseOrThrow(id,req.params.appointmentId);
      await requireTenant(db,tenant,req.actor.id,['owner','manager']);
      return reschedule(req,tenant,appointment,false);
    });
    routes.get('/api/v1/tenants/:tenantId/barbers/:barberId/hours',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId),barber=parseOrThrow(id,req.params.barberId);
      await memberAccess(req,tenant,barber);
      return (await db.query('SELECT id,weekday,start_minute,end_minute FROM public.barber_work_intervals WHERE tenant_id=$1 AND barber_id=$2 ORDER BY weekday,start_minute',
        [tenant,barber])).rows;
    });
    routes.put('/api/v1/tenants/:tenantId/barbers/:barberId/hours',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId),barber=parseOrThrow(id,req.params.barberId);
      await requireTenant(db,tenant,req.actor.id,['owner','manager']);
      const items=validateWorkIntervals(parseOrThrow(hours,req.body).intervals);
      return db.transaction(async tx=>{
        // Lock the barber record to serialize schedule edits and off requests.
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[tenant+':schedule:'+barber]);
        const b=await tx.query('SELECT id FROM public.barbers WHERE tenant_id=$1 AND id=$2',[tenant,barber]);
        if(!b.rowCount) failure(404,'Barbero no encontrado');
        await tx.query('DELETE FROM public.barber_work_intervals WHERE tenant_id=$1 AND barber_id=$2',[tenant,barber]);
        for(const x of items){
          await tx.query('INSERT INTO public.barber_work_intervals(tenant_id,barber_id,weekday,start_minute,end_minute) VALUES($1,$2,$3,$4,$5)',
            [tenant,barber,x.weekday,x.startMinute,x.endMinute]);
        }
        // Never invalidate bookings already accepted by changing work hours.
        const bad=await tx.query(
          "SELECT a.id FROM public.appointments a JOIN public.tenants t ON t.id=a.tenant_id WHERE a.tenant_id=$1 AND a.barber_id=$2 AND a.starts_at>now() AND a.status IN ('pending','confirmed','waiting','in_service') AND NOT EXISTS (SELECT 1 FROM public.barber_work_intervals w WHERE w.tenant_id=a.tenant_id AND w.barber_id=a.barber_id AND w.weekday=EXTRACT(DOW FROM a.starts_at AT TIME ZONE t.time_zone)::integer AND w.start_minute<=EXTRACT(HOUR FROM a.starts_at AT TIME ZONE t.time_zone)::integer*60+EXTRACT(MINUTE FROM a.starts_at AT TIME ZONE t.time_zone)::integer AND w.end_minute>=EXTRACT(HOUR FROM a.ends_at AT TIME ZONE t.time_zone)::integer*60+EXTRACT(MINUTE FROM a.ends_at AT TIME ZONE t.time_zone)::integer AND (a.starts_at AT TIME ZONE t.time_zone)::date=(a.ends_at AT TIME ZONE t.time_zone)::date) LIMIT 1",
          [tenant,barber]);
        if(bad.rowCount) failure(409,'El horario invalida una reserva existente');
        return (await tx.query('SELECT id,weekday,start_minute,end_minute FROM public.barber_work_intervals WHERE tenant_id=$1 AND barber_id=$2 ORDER BY weekday,start_minute',
          [tenant,barber])).rows;
      });
    });
    routes.get('/api/v1/tenants/:tenantId/barbers/:barberId/time-off',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId),barber=parseOrThrow(id,req.params.barberId);
      await memberAccess(req,tenant,barber);
      return (await db.query('SELECT id,starts_at,ends_at,reason FROM public.barber_time_off WHERE tenant_id=$1 AND barber_id=$2 AND ends_at>now() ORDER BY starts_at LIMIT 200',
        [tenant,barber])).rows;
    });
    routes.post('/api/v1/tenants/:tenantId/barbers/:barberId/time-off',async(req,reply)=>{
      const tenant=parseOrThrow(id,req.params.tenantId),barber=parseOrThrow(id,req.params.barberId);
      await requireTenant(db,tenant,req.actor.id,['owner','manager']);
      const x=parseOrThrow(timeOff,req.body);idempotentRange(x);
      const row=await db.transaction(async tx=>{
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[tenant+':schedule:'+barber]);
        const b=await tx.query('SELECT id FROM public.barbers WHERE tenant_id=$1 AND id=$2',[tenant,barber]);
        if(!b.rowCount) failure(404,'Barbero no encontrado');
        const existing=await tx.query("SELECT id FROM public.appointments WHERE tenant_id=$1 AND barber_id=$2 AND status IN ('pending','confirmed','waiting','in_service') AND starts_at<$4 AND ends_at>$3 LIMIT 1",
          [tenant,barber,x.startsAt,x.endsAt]);
        if(existing.rowCount) failure(409,'Primero debes reprogramar las reservas afectadas');
        return (await tx.query('INSERT INTO public.barber_time_off(tenant_id,barber_id,starts_at,ends_at,reason,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,starts_at,ends_at,reason',
          [tenant,barber,x.startsAt,x.endsAt,x.reason,req.actor.id])).rows[0];
      });
      return reply.code(201).send(row);
    });
    routes.delete('/api/v1/tenants/:tenantId/barbers/:barberId/time-off/:offId',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId),barber=parseOrThrow(id,req.params.barberId),off=parseOrThrow(id,req.params.offId);
      await requireTenant(db,tenant,req.actor.id,['owner','manager']);
      const r=await db.query('DELETE FROM public.barber_time_off WHERE id=$1 AND tenant_id=$2 AND barber_id=$3 RETURNING id',
        [off,tenant,barber]);
      if(!r.rowCount) failure(404,'Ausencia no encontrada');
      return {deleted:true};
    });
  });
  app.get('/api/v1/public/tenants/:tenantId/availability',async req=>{
    await limited(req);
    if(!db) failure(503,'Base de datos no configurada');
    const tenant=parseOrThrow(id,req.params.tenantId);
    const q=parseOrThrow(z.object({barberId:id,serviceId:id,date}).strict(),req.query);
    validateSlotDate(q.date);
    const countRes=await db.query(
      'SELECT 1 FROM public.barber_work_intervals WHERE tenant_id=$1 AND barber_id=$2 LIMIT 1',
      [tenant,q.barberId]);
    if(!countRes.rowCount){
      const barberCheck=await db.query(
        "SELECT 1 FROM public.barbers WHERE tenant_id=$1 AND id=$2 AND status='active'",
        [tenant,q.barberId]);
      if(barberCheck.rowCount){
        await db.query(
          `INSERT INTO public.barber_work_intervals(tenant_id,barber_id,weekday,start_minute,end_minute)
           VALUES
             ($1,$2,0,540,1140),
             ($1,$2,1,540,1140),
             ($1,$2,2,540,1140),
             ($1,$2,3,540,1140),
             ($1,$2,4,540,1140),
             ($1,$2,5,540,1140),
             ($1,$2,6,540,1140)
           ON CONFLICT (tenant_id,barber_id,weekday,start_minute) DO NOTHING`,
          [tenant,q.barberId]);
      }
    }
    const {rows}=await db.query(
      "SELECT g.starts_at,g.ends_at FROM public.tenants t JOIN public.barbers b ON b.tenant_id=t.id AND b.id=$2 AND b.status='active' JOIN public.services s ON s.tenant_id=t.id AND s.id=$3 AND s.is_active=true JOIN public.barber_work_intervals w ON w.tenant_id=t.id AND w.barber_id=b.id AND w.weekday=EXTRACT(DOW FROM $4::date)::integer CROSS JOIN LATERAL (SELECT (($4::date + make_interval(mins=>m)) AT TIME ZONE t.time_zone) AS starts_at, (($4::date + make_interval(mins=>m+s.duration_minutes)) AT TIME ZONE t.time_zone) AS ends_at FROM generate_series(w.start_minute,w.end_minute-s.duration_minutes,15) AS m) g WHERE t.id=$1 AND t.status='active' AND g.starts_at>now()+interval '5 minutes' AND NOT EXISTS (SELECT 1 FROM public.tenant_closed_days d WHERE d.tenant_id=t.id AND d.closed_date=$4::date) AND NOT EXISTS (SELECT 1 FROM public.appointments a WHERE a.tenant_id=t.id AND a.barber_id=b.id AND a.status IN ('pending','confirmed','waiting','in_service') AND a.starts_at<g.ends_at AND a.ends_at>g.starts_at) AND NOT EXISTS (SELECT 1 FROM public.barber_time_off o WHERE o.tenant_id=t.id AND o.barber_id=b.id AND o.starts_at<g.ends_at AND o.ends_at>g.starts_at) ORDER BY g.starts_at LIMIT 100",
      [tenant,q.barberId,q.serviceId,q.date]
    );
    return {date:q.date,barberId:q.barberId,serviceId:q.serviceId,slots:rows};
  });
}
