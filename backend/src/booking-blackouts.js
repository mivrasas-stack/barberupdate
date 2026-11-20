import {z} from 'zod';
import {failure,parseOrThrow} from './security.js';

const id=z.uuid();
const date=z.iso.date();
const period=z.object({from:date,to:date}).strict();
const request=z.object({periods:z.array(period).min(1).max(10)}).strict();
const editRequest=period;
export const dayIso=(value,zone='America/Bogota')=>{
  const bits=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(value);
  const get=k=>bits.find(x=>x.type===k)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};
export function validateBlackouts(periods,today=dayIso(new Date())){
  const endLimit=new Date(Date.parse(today+'T00:00:00Z')+366*86400000).toISOString().slice(0,10);
  const sorted=[...periods].sort((a,b)=>a.from.localeCompare(b.from));
  for(let i=0;i<sorted.length;i++){
    const p=sorted[i];
    if(p.from<today||p.to<p.from||p.to>endLimit)
      failure(400,'Selecciona fechas desde hoy y dentro de los próximos 366 días.');
    if(i&&sorted[i-1].to>=p.from)failure(409,'Los períodos de cierre no pueden superponerse.');
  }
  return sorted;
}
/** An active closure may have begun before today; retain its existing start while extending its end. */
export function validateBlackoutEdit(next,previous,today=dayIso(new Date())){
  const endLimit=new Date(Date.parse(today+'T00:00:00Z')+366*86400000).toISOString().slice(0,10);
  const originalActive=previous.from<=today&&previous.to>=today;
  const keepOriginalStart=originalActive&&next.from===previous.from;
  if(previous.to<today || (!keepOriginalStart&&next.from<today) ||
     next.to<next.from || next.to<today || next.to>endLimit)
    failure(400,'Solo puedes editar períodos vigentes o futuros, con una fecha final válida.');
  return next;
}

export async function registerBookingBlackoutRoutes(app,{db,security}){
  const {authenticated,limited,requireTenant}=security;
  app.register(async routes=>{
    routes.addHook('preHandler',async req=>{
      await authenticated(req);await limited(req);
      if(!db)failure(503,'Base de datos no configurada');
    });
    routes.get('/api/v1/tenants/:tenantId/booking-blackouts',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      await requireTenant(db,tenant,req.actor.id,['owner','manager']);
      return (await db.query(`SELECT id,start_date::text AS "from",end_date::text AS "to",reason
        FROM public.tenant_booking_blackouts WHERE tenant_id=$1 AND end_date>=current_date-1
        ORDER BY start_date,id LIMIT 200`,[tenant])).rows;
    });
    routes.post('/api/v1/tenants/:tenantId/booking-blackouts',async(req,reply)=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      await requireTenant(db,tenant,req.actor.id,['owner','manager']);
      const data=parseOrThrow(request,req.body);
      const sorted=validateBlackouts(data.periods);
      const saved=await db.transaction(async tx=>{
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[tenant+':booking-status']);
        const shop=await tx.query("SELECT time_zone FROM public.tenants WHERE id=$1 AND status='active'",[tenant]);
        if(!shop.rowCount)failure(404,'Barbería no disponible');
        validateBlackouts(sorted,dayIso(new Date(),shop.rows[0].time_zone));
        for(const period of sorted){
          const collision=await tx.query(`SELECT 1 FROM public.tenant_booking_blackouts
            WHERE tenant_id=$1 AND start_date<=$3::date AND end_date>=$2::date LIMIT 1`,
            [tenant,period.from,period.to]);
          if(collision.rowCount)failure(409,'Ya existe un cierre en alguna de las fechas. Edita el período existente.');
        }
        const rows=[];
        for(const period of sorted){
          const saved=await tx.query(`INSERT INTO public.tenant_booking_blackouts
            (tenant_id,start_date,end_date,created_by) VALUES($1,$2,$3,$4)
            RETURNING id,start_date::text AS "from",end_date::text AS "to",reason`,
            [tenant,period.from,period.to,req.actor.id]);
          rows.push(saved.rows[0]);
        }
        return rows;
      });
      return reply.code(201).send(saved);
    });
    routes.patch('/api/v1/tenants/:tenantId/booking-blackouts/:blackoutId',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId),blackout=parseOrThrow(id,req.params.blackoutId);
      await requireTenant(db,tenant,req.actor.id,['owner','manager']);
      const wanted=parseOrThrow(editRequest,req.body);
      return db.transaction(async tx=>{
        // Reuse the booking lock so reservations and closure edits cannot race.
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[tenant+':booking-status']);
        const shop=await tx.query("SELECT time_zone FROM public.tenants WHERE id=$1 AND status='active'",[tenant]);
        if(!shop.rowCount)failure(404,'Barbería no disponible');
        const previous=await tx.query(`SELECT start_date::text AS "from",end_date::text AS "to"
          FROM public.tenant_booking_blackouts WHERE tenant_id=$1 AND id=$2 FOR UPDATE`,[tenant,blackout]);
        if(!previous.rowCount)failure(404,'Período no encontrado');
        validateBlackoutEdit(wanted,previous.rows[0],dayIso(new Date(),shop.rows[0].time_zone));
        const overlap=await tx.query(`SELECT 1 FROM public.tenant_booking_blackouts
          WHERE tenant_id=$1 AND id<>$2 AND start_date<=$4::date AND end_date>=$3::date LIMIT 1`,
          [tenant,blackout,wanted.from,wanted.to]);
        if(overlap.rowCount)failure(409,'Este período se superpone con otro cierre programado.');
        const result=await tx.query(`UPDATE public.tenant_booking_blackouts
          SET start_date=$3::date,end_date=$4::date WHERE tenant_id=$1 AND id=$2
          RETURNING id,start_date::text AS "from",end_date::text AS "to",reason`,
          [tenant,blackout,wanted.from,wanted.to]);
        return result.rows[0];
      });
    });
    routes.delete('/api/v1/tenants/:tenantId/booking-blackouts/:blackoutId',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId),blackout=parseOrThrow(id,req.params.blackoutId);
      await requireTenant(db,tenant,req.actor.id,['owner','manager']);
      const result=await db.transaction(async tx=>{
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[tenant+':booking-status']);
        return tx.query('DELETE FROM public.tenant_booking_blackouts WHERE tenant_id=$1 AND id=$2 RETURNING id',[tenant,blackout]);
      });
      if(!result.rowCount)failure(404,'Período no encontrado');
      return {deleted:true};
    });
  });
}