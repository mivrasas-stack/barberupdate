import { randomBytes, createHash } from 'node:crypto';
import { z } from 'zod';
import { failure, parseOrThrow } from './security.js';

const id=z.uuid();
const word=(n=120)=>z.string().trim().min(1).max(n);
const buyerName=word(120);
const orderPayload=z.object({
  customerName:buyerName,
  items:z.array(z.object({productId:id,quantity:z.number().int().min(1).max(100)}).strict()).min(1).max(30)
}).strict();
const statusPayload=z.object({status:z.enum(['preparing','ready','delivered','cancelled'])}).strict();
const reviewPayload=z.object({appointmentId:id,rating:z.number().int().min(1).max(5),comment:z.string().max(2000).default('')}).strict();
const cashPayload=z.object({
  closingDate:z.iso.date(),
  openingCashMinor:z.number().int().min(0),
  withdrawalsMinor:z.number().int().min(0),
  actualCashMinor:z.number().int().min(0),
  notes:z.string().max(2000).default('')
}).strict();
const safeKey=(key)=>typeof key==='string'&&/^[A-Za-z0-9_-]{12,100}$/.test(key);
const pickupCode=()=> 'PK-'+randomBytes(4).toString('hex').toUpperCase();

export async function registerBusinessRoutes(app,{db,security}) {
  const {authenticated,limited,requireTenant}=security;
  app.register(async api=>{
    api.addHook('preHandler',async req=>{
      await authenticated(req);await limited(req);
      if(!db) failure(503,'Base de datos no configurada');
    });
    api.get('/api/v1/tenants/:tenantId/orders',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      await requireTenant(db,tenant,req.actor.id,['owner','manager']);
      return (await db.query('SELECT * FROM public.orders WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 200',[tenant])).rows;
    });
    api.get('/api/v1/me/orders',async req=>{
      return (await db.query('SELECT id,tenant_id,total_minor,status,pickup_code,created_at FROM public.orders WHERE customer_user_id=$1 ORDER BY created_at DESC LIMIT 200',[req.actor.id])).rows;
    });
    api.post('/api/v1/tenants/:tenantId/orders',async(req,reply)=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      const x=parseOrThrow(orderPayload,req.body);
      const key=req.headers['idempotency-key'];
      if(!safeKey(key)) failure(400,'Idempotency-Key requerido');
      // Duplicate lines are consolidated before locking rows in deterministic ID order.
      const qty=new Map();
      for(const item of x.items) qty.set(item.productId,(qty.get(item.productId)||0)+item.quantity);
      const ids=[...qty.keys()].sort();
      for(const p of ids) if(qty.get(p)>1000) failure(400,'Cantidad excesiva');
      const requestHash=createHash('sha256').update(JSON.stringify([x.customerName,ids.map(p=>[p,qty.get(p)])])).digest('hex');
      const created=await db.transaction(async tx=>{
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[tenant+':'+req.actor.id+':order:'+key]);
        const existing=await tx.query('SELECT * FROM public.orders WHERE tenant_id=$1 AND customer_user_id=$2 AND idempotency_key=$3',[tenant,req.actor.id,key]);
        if(existing.rowCount) {
          if(existing.rows[0].request_hash && existing.rows[0].request_hash!==requestHash) failure(409,'Idempotency-Key reutilizada con datos diferentes');
          return {order:existing.rows[0],repeated:true};
        }
        const shop=await tx.query("SELECT id FROM public.tenants WHERE id=$1 AND status='active'",[tenant]);
        if(!shop.rowCount) failure(404,'Negocio no disponible');
        const locked=await tx.query('SELECT id,name,price_minor,stock FROM public.products WHERE tenant_id=$1 AND id=ANY($2::uuid[]) AND is_active=true ORDER BY id FOR UPDATE',[tenant,ids]);
        if(locked.rows.length!==ids.length) failure(400,'Producto no disponible');
        let total=0;
        for(const item of locked.rows){
          if(item.stock<qty.get(item.id)) failure(409,'Stock insuficiente');
          total+=Number(item.price_minor)*qty.get(item.id);
          if(!Number.isSafeInteger(total)||total>1000000000000) failure(400,'Total fuera de rango');
        }
        const ordered=await tx.query("INSERT INTO public.orders(tenant_id,customer_user_id,customer_name,pickup_code,total_minor,idempotency_key,request_hash) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",[tenant,req.actor.id,x.customerName,pickupCode(),total,key,requestHash]);
        const order=ordered.rows[0];
        for(const item of locked.rows){
          const n=qty.get(item.id);
          await tx.query('UPDATE public.products SET stock=stock-$3,updated_at=now() WHERE tenant_id=$1 AND id=$2',[tenant,item.id,n]);
          await tx.query('INSERT INTO public.inventory_movements(tenant_id,product_id,delta,reason,user_id) VALUES($1,$2,$3,$4,$5)',[tenant,item.id,-n,'order:'+order.id,req.actor.id]);
          await tx.query('INSERT INTO public.order_items(tenant_id,order_id,product_id,product_name,unit_price_minor,quantity) VALUES($1,$2,$3,$4,$5,$6)',[tenant,order.id,item.id,item.name,item.price_minor,n]);
        }
        return {order,repeated:false};
      });
      return reply.code(created.repeated?200:201).send(created.order);
    });
    api.patch('/api/v1/tenants/:tenantId/orders/:orderId/status',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      const orderId=parseOrThrow(id,req.params.orderId);
      await requireTenant(db,tenant,req.actor.id,['owner','manager']);
      const x=parseOrThrow(statusPayload,req.body);
      return db.transaction(async tx=>{
        const rows=await tx.query('SELECT * FROM public.orders WHERE id=$1 AND tenant_id=$2 FOR UPDATE',[orderId,tenant]);
        if(!rows.rowCount) failure(404,'Pedido no encontrado');
        const before=rows.rows[0];
        const allowed={received:['preparing','cancelled'],preparing:['ready','cancelled'],ready:['delivered','cancelled'],delivered:[],cancelled:[]};
        if(!allowed[before.status].includes(x.status)) failure(409,'Estado del pedido invalido');
        if(x.status==='cancelled'){
          const confirmed=await tx.query("SELECT 1 FROM public.manual_payments WHERE tenant_id=$1 AND order_id=$2 AND status='confirmed' LIMIT 1",[tenant,orderId]);
          if(confirmed.rowCount) failure(409,'Pedido con pagos registrados: requiere un proceso de reembolso antes de cancelar');
          await tx.query("UPDATE public.manual_payments SET status='voided',voided_by=$3,voided_at=now() WHERE tenant_id=$1 AND order_id=$2 AND status='pending'",[tenant,orderId,req.actor.id]);
          const items=await tx.query('SELECT product_id,quantity FROM public.order_items WHERE order_id=$1 AND tenant_id=$2 ORDER BY product_id',[orderId,tenant]);
          for(const item of items.rows){
            await tx.query('UPDATE public.products SET stock=stock+$3,updated_at=now() WHERE tenant_id=$1 AND id=$2',[tenant,item.product_id,item.quantity]);
            await tx.query('INSERT INTO public.inventory_movements(tenant_id,product_id,delta,reason,user_id) VALUES($1,$2,$3,$4,$5)',[tenant,item.product_id,item.quantity,'cancel:'+orderId,req.actor.id]);
          }
        }
        return (await tx.query('UPDATE public.orders SET status=$3,updated_at=now() WHERE id=$1 AND tenant_id=$2 RETURNING *',[orderId,tenant,x.status])).rows[0];
      });
    });
    api.post('/api/v1/tenants/:tenantId/reviews',async(req,reply)=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      const x=parseOrThrow(reviewPayload,req.body);
      const review=await db.transaction(async tx=>{
        const appt=await tx.query("SELECT barber_id FROM public.appointments WHERE tenant_id=$1 AND id=$2 AND customer_user_id=$3 AND status='completed'",[tenant,x.appointmentId,req.actor.id]);
        if(!appt.rowCount) failure(403,'Solo se puede reseñar una cita propia completada');
        return (await tx.query('INSERT INTO public.reviews(tenant_id,appointment_id,barber_id,customer_user_id,rating,comment) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[tenant,x.appointmentId,appt.rows[0].barber_id,req.actor.id,x.rating,x.comment])).rows[0];
      });
      return reply.code(201).send(review);
    });
    api.get('/api/v1/tenants/:tenantId/reviews',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      await requireTenant(db,tenant,req.actor.id,['owner','manager']);
      return (await db.query('SELECT id,tenant_id,barber_id,rating,comment,created_at FROM public.reviews WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 200',[tenant])).rows;
    });
    api.get('/api/v1/me/loyalty',async req=>{
      return (await db.query('SELECT tenant_id,points,visits_count,updated_at FROM public.loyalty_accounts WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 200',[req.actor.id])).rows;
    });
    api.post('/api/v1/tenants/:tenantId/cash-closings',async(req,reply)=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      await requireTenant(db,tenant,req.actor.id,['owner','manager']);
      const x=parseOrThrow(cashPayload,req.body);
      const close=await db.transaction(async tx=>{
        const business=await tx.query('SELECT time_zone FROM public.tenants WHERE id=$1 AND status=$2',[tenant,'active']);
        if(!business.rowCount) failure(404,'Negocio no disponible');
        // Prevent new financial movements racing with the close of the same local day.
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[tenant+':cash:'+x.closingDate]);
        const totals=await tx.query(
          "SELECT coalesce(sum(amount_minor) FILTER(WHERE type='income' AND payment_method='cash'),0)::bigint AS cash_income,coalesce(sum(amount_minor) FILTER(WHERE type='income' AND payment_method<>'cash'),0)::bigint AS electronic_income,coalesce(sum(amount_minor) FILTER(WHERE type='expense' AND payment_method='cash'),0)::bigint AS cash_expenses FROM public.transactions WHERE tenant_id=$1 AND (created_at AT TIME ZONE $2)::date=$3::date",
          [tenant,business.rows[0].time_zone,x.closingDate]);
        const t=totals.rows[0];
        return (await tx.query('INSERT INTO public.cash_closings(tenant_id,closing_date,opening_cash_minor,cash_income_minor,electronic_income_minor,cash_expenses_minor,withdrawals_minor,actual_cash_minor,notes,closed_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
          [tenant,x.closingDate,x.openingCashMinor,t.cash_income,t.electronic_income,t.cash_expenses,x.withdrawalsMinor,x.actualCashMinor,x.notes,req.actor.id])).rows[0];
      });
      return reply.code(201).send(close);
    });
    api.get('/api/v1/tenants/:tenantId/cash-closings',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      await requireTenant(db,tenant,req.actor.id,['owner','manager']);
      return (await db.query('SELECT * FROM public.cash_closings WHERE tenant_id=$1 ORDER BY closing_date DESC LIMIT 200',[tenant])).rows;
    });
    api.get('/api/v1/tenants/:tenantId/subscription',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      await requireTenant(db,tenant,req.actor.id,['owner']);
      return (await db.query('SELECT ts.id,ts.plan_id,ts.status,ts.period_starts_at,ts.period_ends_at FROM public.tenant_subscriptions ts WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 1',[tenant])).rows[0]||null;
    });
  });
  app.get('/api/v1/public/plans',async req=>{
    await limited(req);
    if(!db) failure(503,'Base de datos no configurada');
    return (await db.query('SELECT id,name,audience,monthly_minor,annual_minor,currency,max_barbers,max_portfolio_images,features,billing_enabled FROM public.subscription_plans WHERE is_active ORDER BY monthly_minor LIMIT 100')).rows;
  });
}
