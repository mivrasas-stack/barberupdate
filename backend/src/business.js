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
const rewardPayload=z.object({
 title:word(120),description:z.string().max(500).default(''),
 pointsCost:z.number().int().min(1).max(1000000),
 isActive:z.boolean().default(true)
}).strict();
const rewardPatch=rewardPayload.partial().refine(x=>Object.keys(x).length>0);
const redeemPayload=z.object({rewardId:id}).strict();
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
    // A pickup code is a cashier lookup, not proof of payment.
    // Scope every read to the authenticated owner's/manager's tenant.
    api.get('/api/v1/tenants/:tenantId/orders/by-pickup-code',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      await requireTenant(db,tenant,req.actor.id,['owner','manager']);
      const {code}=parseOrThrow(z.object({
        code:z.string().trim().toUpperCase().regex(/^PK-[A-Z0-9]{8}$/)
      }).strict(),req.query);
      const found=await db.query(
        'SELECT id,pickup_code,customer_name,status,total_minor,created_at FROM public.orders WHERE tenant_id=$1 AND pickup_code=$2 LIMIT 1',
        [tenant,code]);
      if(!found.rowCount)failure(404,'No existe un pedido con ese código en esta barbería');
      const order=found.rows[0];
      // Persisted order lines are authoritative: prices, categories and inventory
      // must never be supplied by the cashier's browser.
      const [items,payments,refunds]=await Promise.all([
        db.query(
          'SELECT oi.product_id,oi.product_name,oi.quantity,oi.unit_price_minor,oi.subtotal_minor,COALESCE(p.category,\'beauty\') AS category FROM public.order_items oi LEFT JOIN public.products p ON p.tenant_id=oi.tenant_id AND p.id=oi.product_id WHERE oi.tenant_id=$1 AND oi.order_id=$2 ORDER BY oi.product_name,oi.id',
          [tenant,order.id]),
        db.query(
          "SELECT id,amount_minor,method,status,created_at FROM public.manual_payments WHERE tenant_id=$1 AND order_id=$2 AND status IN ('pending','confirmed') ORDER BY created_at",
          [tenant,order.id]),
        db.query('SELECT coalesce(sum(amount_minor),0)::bigint AS refunded FROM public.manual_refunds WHERE tenant_id=$1 AND order_id=$2',
          [tenant,order.id])
      ]);
      const confirmed=payments.rows.filter(p=>p.status==='confirmed').reduce((sum,p)=>sum+Number(p.amount_minor),0);
      const refunded=Number(refunds.rows[0]?.refunded||0);
      const total=Number(order.total_minor);
      return {
        id:order.id,pickupCode:order.pickup_code,customerName:order.customer_name,
        status:order.status,totalMinor:total,createdAt:order.created_at,
        items:items.rows.map(line=>({
          productId:line.product_id,productName:line.product_name,category:line.category,
          quantity:Number(line.quantity),unitPriceMinor:Number(line.unit_price_minor),
          subtotalMinor:Number(line.subtotal_minor)
        })),
        confirmedMinor:confirmed,refundedMinor:refunded,
        balanceMinor:Math.max(0,total-confirmed+refunded),
        pendingPayments:payments.rows.filter(p=>p.status==='pending').map(p=>({
          id:p.id,amountMinor:Number(p.amount_minor),method:p.method,createdAt:p.created_at
        })),
        verification:'El pago es manual: el personal debe comprobar que recibió el dinero antes de confirmarlo.'
      };
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
    // Staff can hand over a code-verified order only after the real offline
    // collection was confirmed in full. Delivery does not post another income.
    api.post('/api/v1/tenants/:tenantId/orders/:orderId/deliver',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId),orderId=parseOrThrow(id,req.params.orderId);
      await requireTenant(db,tenant,req.actor.id,['owner','manager']);
      return db.transaction(async tx=>{
        const found=await tx.query('SELECT id,total_minor,status FROM public.orders WHERE id=$1 AND tenant_id=$2 FOR UPDATE',[orderId,tenant]);
        if(!found.rowCount)failure(404,'Pedido no encontrado');
        const order=found.rows[0];
        if(order.status==='cancelled')failure(409,'Pedido cancelado');
        if(order.status==='delivered')return order;
        const totals=await tx.query(
          "SELECT (SELECT coalesce(sum(amount_minor),0) FROM public.manual_payments WHERE tenant_id=$1 AND order_id=$2 AND status='confirmed')::bigint AS confirmed,(SELECT coalesce(sum(amount_minor),0) FROM public.manual_refunds WHERE tenant_id=$1 AND order_id=$2)::bigint AS refunded",
          [tenant,orderId]);
        if(Number(totals.rows[0].confirmed||0)-Number(totals.rows[0].refunded||0)<Number(order.total_minor))
          failure(409,'Confirma el pago completo antes de entregar el pedido');
        return (await tx.query(
          "UPDATE public.orders SET status='delivered',updated_at=now() WHERE id=$1 AND tenant_id=$2 RETURNING id,status,total_minor,pickup_code",
          [orderId,tenant])).rows[0];
      });
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
          const balances=await tx.query(
            "SELECT (SELECT coalesce(sum(amount_minor),0) FROM public.manual_payments WHERE tenant_id=$1 AND order_id=$2 AND status='confirmed')::bigint - (SELECT coalesce(sum(amount_minor),0) FROM public.manual_refunds WHERE tenant_id=$1 AND order_id=$2)::bigint AS outstanding",
            [tenant,orderId]);
          if(BigInt(balances.rows[0].outstanding)!==0n)
            failure(409,'Se requiere registrar la devolucion total del dinero antes de cancelar');
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
        const recorded=(await tx.query('INSERT INTO public.reviews(tenant_id,appointment_id,barber_id,customer_user_id,rating,comment) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[tenant,x.appointmentId,appt.rows[0].barber_id,req.actor.id,x.rating,x.comment])).rows[0];
        // Bonus applied once, in the same transaction as the unique appointment review.
        await tx.query('INSERT INTO public.loyalty_accounts(tenant_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[tenant,req.actor.id]);
        await tx.query('INSERT INTO public.loyalty_events(tenant_id,user_id,points_delta,description) VALUES($1,$2,25,$3)',
          [tenant,req.actor.id,'Reseña de cita '+x.appointmentId]);
        await tx.query('UPDATE public.loyalty_accounts SET points=points+25,updated_at=now() WHERE tenant_id=$1 AND user_id=$2',[tenant,req.actor.id]);
        return recorded;
      });
      return reply.code(201).send(review);
    });
    api.get('/api/v1/tenants/:tenantId/reviews',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      await requireTenant(db,tenant,req.actor.id,['owner','manager']);
      return (await db.query(
        'SELECT r.id,r.tenant_id,r.appointment_id,r.barber_id,r.customer_user_id,r.rating,r.comment,r.created_at,a.customer_name,a.service_id,a.starts_at FROM public.reviews r JOIN public.appointments a ON a.id=r.appointment_id AND a.tenant_id=r.tenant_id WHERE r.tenant_id=$1 ORDER BY r.created_at DESC LIMIT 200',[tenant])).rows;
    });
    api.get('/api/v1/me/loyalty',async req=>{
      return (await db.query('SELECT tenant_id,points,visits_count,updated_at FROM public.loyalty_accounts WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 200',[req.actor.id])).rows;
    });

    // Customer reviews are read only from their own completed bookings.
    api.get('/api/v1/me/reviews',async req=>{
      return (await db.query('SELECT r.* FROM public.reviews r WHERE r.customer_user_id=$1 ORDER BY r.created_at DESC LIMIT 200',[req.actor.id])).rows;
    });
    api.get('/api/v1/me/loyalty-events',async req=>{
      return (await db.query('SELECT id,tenant_id,points_delta,description,created_at FROM public.loyalty_events WHERE user_id=$1 ORDER BY created_at DESC LIMIT 200',[req.actor.id])).rows;
    });
    api.get('/api/v1/me/rewards',async req=>{
      // Catalog of active rewards, with balances kept separate by tenant.
      return (await db.query("SELECT r.id,r.tenant_id,r.title,r.description,r.points_cost,r.is_active,coalesce(a.points,0)::integer AS available_points FROM public.loyalty_rewards r JOIN public.tenants t ON t.id=r.tenant_id AND t.status='active' LEFT JOIN public.loyalty_accounts a ON a.tenant_id=r.tenant_id AND a.user_id=$1 WHERE r.is_active=true ORDER BY r.tenant_id,r.points_cost LIMIT 300",[req.actor.id])).rows;
    });
    api.get('/api/v1/me/redemptions',async req=>{
      return (await db.query('SELECT d.id,d.tenant_id,d.reward_id,d.points_cost,d.status,d.created_at,r.title FROM public.loyalty_redemptions d JOIN public.loyalty_rewards r ON r.id=d.reward_id AND r.tenant_id=d.tenant_id WHERE d.user_id=$1 ORDER BY d.created_at DESC LIMIT 100',[req.actor.id])).rows;
    });
    api.post('/api/v1/tenants/:tenantId/redeem',async(req,reply)=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      const x=parseOrThrow(redeemPayload,req.body);
      const key=req.headers['idempotency-key'];
      if(!safeKey(key)) failure(400,'Idempotency-Key requerido');
      const response=await db.transaction(async tx=>{
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[tenant+':'+req.actor.id+':redeem:'+key]);
        // Deduplicate retrying client requests to prevent double-charge.
        const past=await tx.query('SELECT d.* FROM public.loyalty_redemptions d WHERE d.tenant_id=$1 AND d.user_id=$2 AND d.idempotency_key=$3',[tenant,req.actor.id,key]);
        if(past.rowCount){
          if(past.rows[0].reward_id!==x.rewardId) failure(409,'La clave de reintento ya se usó para otra recompensa');
          return {row:past.rows[0],repeated:true};
        }
        const reward=await tx.query("SELECT r.id,r.points_cost FROM public.loyalty_rewards r JOIN public.tenants t ON t.id=r.tenant_id AND t.status='active' WHERE r.tenant_id=$1 AND r.id=$2 AND r.is_active=true",[tenant,x.rewardId]);
        if(!reward.rowCount) failure(404,'Recompensa no disponible');
        const cost=reward.rows[0].points_cost;
        const balance=await tx.query('UPDATE public.loyalty_accounts SET points=points-$3,updated_at=now() WHERE tenant_id=$1 AND user_id=$2 AND points >=$3 RETURNING points',[tenant,req.actor.id,cost]);
        if(!balance.rowCount) failure(409,'Puntos insuficientes en esta barbería');
        const row=(await tx.query('INSERT INTO public.loyalty_redemptions(tenant_id,user_id,reward_id,points_cost,idempotency_key) VALUES($1,$2,$3,$4,$5) RETURNING *',[tenant,req.actor.id,x.rewardId,cost,key])).rows[0];
        await tx.query('INSERT INTO public.loyalty_events(tenant_id,user_id,points_delta,description) VALUES($1,$2,$3,$4)',[tenant,req.actor.id,-cost,'Canje de recompensa '+x.rewardId]);
        return {row,repeated:false};
      });
      return reply.code(response.repeated?200:201).send(response.row);
    });
    api.get('/api/v1/tenants/:tenantId/rewards',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      await requireTenant(db,tenant,req.actor.id,['owner','manager']);
      return (await db.query('SELECT * FROM public.loyalty_rewards WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 200',[tenant])).rows;
    });
    api.post('/api/v1/tenants/:tenantId/rewards',async(req,reply)=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      await requireTenant(db,tenant,req.actor.id,['owner','manager']);
      const x=parseOrThrow(rewardPayload,req.body);
      const row=await db.query('INSERT INTO public.loyalty_rewards(tenant_id,title,description,points_cost,is_active) VALUES($1,$2,$3,$4,$5) RETURNING *',[tenant,x.title,x.description,x.pointsCost,x.isActive]);
      return reply.code(201).send(row.rows[0]);
    });
    api.patch('/api/v1/tenants/:tenantId/rewards/:rewardId',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId),rewardId=parseOrThrow(id,req.params.rewardId);
      await requireTenant(db,tenant,req.actor.id,['owner','manager']);
      const x=parseOrThrow(rewardPatch,req.body);
      const changed=await db.query('UPDATE public.loyalty_rewards SET title=coalesce($3,title),description=coalesce($4,description),points_cost=coalesce($5,points_cost),is_active=coalesce($6,is_active),updated_at=now() WHERE tenant_id=$1 AND id=$2 RETURNING *',[tenant,rewardId,x.title??null,x.description??null,x.pointsCost??null,x.isActive??null]);
      if(!changed.rowCount) failure(404,'Recompensa no encontrada');
      return changed.rows[0];
    });
    api.get('/api/v1/tenants/:tenantId/redemptions',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      await requireTenant(db,tenant,req.actor.id,['owner','manager']);
      return (await db.query('SELECT d.id,d.user_id,d.points_cost,d.status,d.created_at,r.title FROM public.loyalty_redemptions d JOIN public.loyalty_rewards r ON r.tenant_id=d.tenant_id AND r.id=d.reward_id WHERE d.tenant_id=$1 ORDER BY d.created_at DESC LIMIT 200',[tenant])).rows;
    });
    api.patch('/api/v1/tenants/:tenantId/redemptions/:redemptionId/fulfill',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId),redemptionId=parseOrThrow(id,req.params.redemptionId);
      await requireTenant(db,tenant,req.actor.id,['owner','manager']);
      const changed=await db.query("UPDATE public.loyalty_redemptions SET status='fulfilled',fulfilled_at=now() WHERE tenant_id=$1 AND id=$2 AND status='pending' RETURNING *",[tenant,redemptionId]);
      if(!changed.rowCount) failure(409,'Este canje no existe o ya fue gestionado');
      return changed.rows[0];
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
