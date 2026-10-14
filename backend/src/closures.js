import {z} from 'zod';
import {failure,parseOrThrow} from './security.js';
const id=z.uuid();
const day=z.iso.date();
const closure=z.object({
  date:day,
  reason:z.string().trim().max(250).default('')
}).strict();
const range=z.object({from:day,to:day}).strict();
export function validateClosureDate(value,now=Date.now()){
  const instant=Date.parse(value+'T12:00:00Z');
  if(!Number.isFinite(instant)||instant<now-2*86400000||instant>now+366*86400000)
    failure(400,'Fecha de cierre fuera de rango');
  return value;
}
export async function registerClosureRoutes(app,{db,security}){
  const {authenticated,limited,requireTenant}=security;
  app.register(async routes=>{
    routes.addHook('preHandler',async req=>{
      await authenticated(req);
      await limited(req);
      if(!db)failure(503,'Base de datos no configurada');
    });
    routes.get('/api/v1/tenants/:tenantId/closed-days',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      await requireTenant(db,tenant,req.actor.id);
      const x=parseOrThrow(range,req.query);
      const first=Date.parse(x.from+'T00:00:00Z'),last=Date.parse(x.to+'T00:00:00Z');
      if(last<first||last-first>366*86400000)
        failure(400,'Rango de calendario invalido');
      return (await db.query('SELECT closed_date,reason,created_at FROM public.tenant_closed_days WHERE tenant_id=$1 AND closed_date BETWEEN $2 AND $3 ORDER BY closed_date LIMIT 367',
        [tenant,x.from,x.to])).rows;
    });
    routes.post('/api/v1/tenants/:tenantId/closed-days',async(req,reply)=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      await requireTenant(db,tenant,req.actor.id,['owner','manager']);
      const x=parseOrThrow(closure,req.body);
      validateClosureDate(x.date);
      const r=await db.query(
        'INSERT INTO public.tenant_closed_days(tenant_id,closed_date,reason,created_by) VALUES($1,$2,$3,$4) RETURNING closed_date,reason,created_at',
        [tenant,x.date,x.reason,req.actor.id]);
      return reply.code(201).send(r.rows[0]);
    });
    routes.delete('/api/v1/tenants/:tenantId/closed-days/:date',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      await requireTenant(db,tenant,req.actor.id,['owner','manager']);
      const date=parseOrThrow(day,req.params.date);
      const r=await db.query(
        'DELETE FROM public.tenant_closed_days WHERE tenant_id=$1 AND closed_date=$2 RETURNING closed_date',
        [tenant,date]);
      if(!r.rowCount)failure(404,'Cierre no encontrado');
      return {deleted:true};
    });
  });
}