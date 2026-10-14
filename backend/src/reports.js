import {z} from 'zod';
import {failure,parseOrThrow} from './security.js';

const id=z.uuid();
const rangeSchema=z.object({from:z.iso.date(),to:z.iso.date()}).strict();
export function checkedReportRange(query,now=Date.now()){
  const {from,to}=parseOrThrow(rangeSchema,query);
  const start=Date.parse(from+'T00:00:00Z'),end=Date.parse(to+'T00:00:00Z');
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<start||end-start>366*86400000||
      start>now+366*86400000) failure(400,'El rango debe ser entre 1 y 367 dias');
  return {from,to};
}
export async function registerReportRoutes(app,{db,security}){
  const {authenticated,limited,requireTenant}=security;
  app.register(async routes=>{
    routes.addHook('preHandler',async req=>{
      await authenticated(req);await limited(req);
      if(!db) failure(503,'Base de datos no configurada');
    });
    routes.get('/api/v1/tenants/:tenantId/reports/overview',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      await requireTenant(db,tenant,req.actor.id,['owner','manager']);
      const dates=checkedReportRange(req.query);
      const [bookings,finances,orders,reviews]=await Promise.all([
        db.query(
          "SELECT count(*)::int AS total, count(*) FILTER(WHERE a.status='completed')::int AS completed, count(*) FILTER(WHERE a.status='cancelled')::int AS cancelled, coalesce(sum(a.price_minor) FILTER(WHERE a.status='completed'),0)::bigint AS completed_service_value_minor FROM public.appointments a JOIN public.tenants t ON t.id=a.tenant_id WHERE a.tenant_id=$1 AND (a.starts_at AT TIME ZONE t.time_zone)::date BETWEEN $2::date AND $3::date",
          [tenant,dates.from,dates.to]),
        db.query(
          "SELECT coalesce(sum(amount_minor) FILTER(WHERE type='income'),0)::bigint AS recorded_income_minor,coalesce(sum(amount_minor) FILTER(WHERE type='expense'),0)::bigint AS recorded_expenses_minor,count(*)::int AS entries FROM public.transactions x JOIN public.tenants t ON t.id=x.tenant_id WHERE x.tenant_id=$1 AND (x.created_at AT TIME ZONE t.time_zone)::date BETWEEN $2::date AND $3::date",
          [tenant,dates.from,dates.to]),
        db.query(
          "SELECT count(*)::int AS total,count(*) FILTER(WHERE o.status='delivered')::int AS delivered,coalesce(sum(o.total_minor) FILTER(WHERE o.status='delivered'),0)::bigint AS delivered_order_value_minor FROM public.orders o JOIN public.tenants t ON t.id=o.tenant_id WHERE o.tenant_id=$1 AND (o.created_at AT TIME ZONE t.time_zone)::date BETWEEN $2::date AND $3::date",
          [tenant,dates.from,dates.to]),
        db.query(
          "SELECT count(*)::int AS total,coalesce(round(avg(r.rating),2),0)::numeric AS average FROM public.reviews r JOIN public.tenants t ON t.id=r.tenant_id WHERE r.tenant_id=$1 AND (r.created_at AT TIME ZONE t.time_zone)::date BETWEEN $2::date AND $3::date",
          [tenant,dates.from,dates.to])
      ]);
      return {period:dates,bookings:bookings.rows[0],finances:finances.rows[0],
        orders:orders.rows[0],reviews:reviews.rows[0],
        disclaimer:'Los valores de servicios y pedidos no equivalen a pagos liquidados. Solo las transacciones registradas representan movimientos de caja.'};
    });
    routes.get('/api/v1/tenants/:tenantId/reports/barbers',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      await requireTenant(db,tenant,req.actor.id,['owner','manager']);
      const dates=checkedReportRange(req.query);
      return (await db.query(
        "SELECT b.id,b.name,b.commission_rate,count(a.id) FILTER(WHERE a.status='completed')::int AS completed_services,coalesce(sum(a.price_minor) FILTER(WHERE a.status='completed'),0)::bigint AS service_value_minor,coalesce(round(sum(a.price_minor) FILTER(WHERE a.status='completed')*b.commission_rate),0)::bigint AS estimated_commission_minor FROM public.barbers b LEFT JOIN public.appointments a ON a.barber_id=b.id AND a.tenant_id=b.tenant_id AND (a.starts_at AT TIME ZONE (SELECT time_zone FROM public.tenants WHERE id=b.tenant_id))::date BETWEEN $2::date AND $3::date WHERE b.tenant_id=$1 GROUP BY b.id ORDER BY completed_services DESC,b.name LIMIT 200",
        [tenant,dates.from,dates.to])).rows;
    });
    routes.get('/api/v1/tenants/:tenantId/inventory/low-stock',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      await requireTenant(db,tenant,req.actor.id,['owner','manager']);
      const q=parseOrThrow(z.object({threshold:z.coerce.number().int().min(0).max(1000).default(5)}).strict(),req.query);
      return (await db.query(
        'SELECT id,sku,name,stock,price_minor FROM public.products WHERE tenant_id=$1 AND is_active=true AND stock<=$2 ORDER BY stock,sku LIMIT 200',
        [tenant,q.threshold])).rows;
    });
  });
}
