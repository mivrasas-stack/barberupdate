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
export async function registerSchedulingRoutes(app,{db,security}) {
  const {authenticated,limited,requireTenant}=security;
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
    const {rows}=await db.query(
      "SELECT g.starts_at,g.ends_at FROM public.tenants t JOIN public.barbers b ON b.tenant_id=t.id AND b.id=$2 AND b.status='active' JOIN public.services s ON s.tenant_id=t.id AND s.id=$3 AND s.is_active=true JOIN public.barber_work_intervals w ON w.tenant_id=t.id AND w.barber_id=b.id AND w.weekday=EXTRACT(DOW FROM $4::date)::integer CROSS JOIN LATERAL (SELECT (($4::date + make_interval(mins=>m)) AT TIME ZONE t.time_zone) AS starts_at, (($4::date + make_interval(mins=>m+s.duration_minutes)) AT TIME ZONE t.time_zone) AS ends_at FROM generate_series(w.start_minute,w.end_minute-s.duration_minutes,15) AS m) g WHERE t.id=$1 AND t.status='active' AND g.starts_at>now()+interval '5 minutes' AND NOT EXISTS (SELECT 1 FROM public.appointments a WHERE a.tenant_id=t.id AND a.barber_id=b.id AND a.status IN ('pending','confirmed','waiting','in_service') AND a.starts_at<g.ends_at AND a.ends_at>g.starts_at) AND NOT EXISTS (SELECT 1 FROM public.barber_time_off o WHERE o.tenant_id=t.id AND o.barber_id=b.id AND o.starts_at<g.ends_at AND o.ends_at>g.starts_at) ORDER BY g.starts_at LIMIT 100",
      [tenant,q.barberId,q.serviceId,q.date]
    );
    return {date:q.date,barberId:q.barberId,serviceId:q.serviceId,slots:rows};
  });
}
