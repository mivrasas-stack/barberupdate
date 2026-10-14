import { createHash } from 'node:crypto';
import { z } from 'zod';
import { failure, parseOrThrow } from './security.js';

// No live Wompi implementation, endpoints, API keys, webhooks or outbound calls.
// Provider-specific behavior belongs in a future, explicitly approved adapter.
export const paymentCapabilities = Object.freeze({
  manualPayments: { enabled: true, confirmation: 'staff_attested' },
  // Barber shop customer purchases remain wholly separate from SaaS checkout.
  onlinePayments: { enabled: false, providerSelected: null, providerConnected: false, scope: 'barbershop_orders' },
  platformBilling: { enabled: false, providerSelected: 'wompi', providerConnected: false,
    scope: 'barberos_saas_subscriptions', checkoutSurface: 'future_landing_page' },
  subscriptionBilling: { enabled: false },
});

const id=z.uuid();
const method=z.enum(['cash','transfer','debit','credit','nequi','daviplata']);
const createManual=z.object({
  amountMinor:z.number().int().positive().max(1000000000000),
  method,
}).strict();
const confirmManual=z.object({
  reference:z.string().trim().min(3).max(120).optional(),
}).strict();
const refundManual=z.object({
  amountMinor:z.number().int().positive().max(1000000000000),
  reason:z.string().trim().min(8).max(400),
  reference:z.string().trim().min(3).max(120).optional()
}).strict();
const paymentKey=key=>typeof key==='string'&&/^[a-zA-Z0-9_-]{12,100}$/.test(key);
export function isValidConfirmation(method,reference){
  return method==='cash'||typeof reference==='string'&&reference.trim().length>=3;
}

export async function registerPaymentsRoutes(app,{db,security}){
  const {authenticated,limited,requireTenant}=security;
  app.get('/api/v1/public/payment-capabilities',async req=>{
    await limited(req);
    return paymentCapabilities;
  });

  app.register(async routes=>{
    routes.addHook('preHandler',async req=>{
      await authenticated(req);await limited(req);
      if(!db) failure(503,'Base de datos no configurada');
    });
    routes.get('/api/v1/tenants/:tenantId/orders/:orderId/payments',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId),order=parseOrThrow(id,req.params.orderId);
      const isStaff=await db.query(
        "SELECT 1 FROM public.tenant_members m JOIN public.tenants t ON t.id=m.tenant_id WHERE m.tenant_id=$1 AND m.user_id=$2 AND m.role IN ('owner','manager') AND t.status='active'",
        [tenant,req.actor.id]);
      const orderResult=await db.query('SELECT customer_user_id,total_minor FROM public.orders WHERE tenant_id=$1 AND id=$2',[tenant,order]);
      if(!orderResult.rowCount) failure(404,'Pedido no encontrado');
      if(!isStaff.rowCount&&orderResult.rows[0].customer_user_id!==req.actor.id) failure(403,'Sin permiso para consultar este pedido');
      const rows=await db.query(
        'SELECT id,amount_minor,currency,method,status,reference,confirmed_at,created_at FROM public.manual_payments WHERE tenant_id=$1 AND order_id=$2 ORDER BY created_at',
        [tenant,order]);
      const refunds=await db.query(
        'SELECT id,payment_id,order_id,amount_minor,currency,method,reference,reason,created_at FROM public.manual_refunds WHERE tenant_id=$1 AND order_id=$2 ORDER BY created_at',
        [tenant,order]);
      const confirmed=rows.rows.filter(p=>p.status==='confirmed').reduce((sum,p)=>sum+Number(p.amount_minor),0);
      const refunded=refunds.rows.reduce((sum,r)=>sum+Number(r.amount_minor),0);
      const netReceived=confirmed-refunded;
      return {orderId:order,totalMinor:orderResult.rows[0].total_minor,confirmedMinor:confirmed,
        refundedMinor:refunded,netReceivedMinor:netReceived,
        balanceMinor:Math.max(0,Number(orderResult.rows[0].total_minor)-netReceived),
        payments:rows.rows,refunds:refunds.rows,
        paymentVerification:'Los cobros y devoluciones manuales son declaraciones del personal autorizado, no operaciones de Wompi.'};
    });
    routes.post('/api/v1/tenants/:tenantId/orders/:orderId/payments/manual',async(req,reply)=>{
      const tenant=parseOrThrow(id,req.params.tenantId),order=parseOrThrow(id,req.params.orderId);
      await requireTenant(db,tenant,req.actor.id,['owner','manager']);
      const x=parseOrThrow(createManual,req.body);
      const key=req.headers['idempotency-key'];
      if(!paymentKey(key)) failure(400,'Idempotency-Key requerido');
      const requestHash=createHash('sha256').update(JSON.stringify([order,x.amountMinor,x.method])).digest('hex');
      const created=await db.transaction(async tx=>{
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[tenant+':'+req.actor.id+':manual-payment:'+key]);
        const existing=await tx.query(
          'SELECT * FROM public.manual_payments WHERE tenant_id=$1 AND created_by=$2 AND idempotency_key=$3',
          [tenant,req.actor.id,key]);
        if(existing.rowCount){
          if(existing.rows[0].request_hash!==requestHash)failure(409,'Idempotency-Key reutilizada con otro pago');
          return {row:existing.rows[0],repeated:true};
        }
        const active=await tx.query("SELECT o.id,o.total_minor,o.status,t.currency FROM public.orders o JOIN public.tenants t ON t.id=o.tenant_id WHERE o.tenant_id=$1 AND o.id=$2 AND t.status='active' FOR UPDATE OF o",
          [tenant,order]);
        if(!active.rowCount) failure(404,'Pedido no encontrado');
        if(active.rows[0].status==='cancelled') failure(409,'No se pueden registrar pagos de pedidos cancelados');
        const paid=await tx.query(
          "SELECT coalesce(sum(amount_minor),0)::bigint AS amount FROM public.manual_payments WHERE tenant_id=$1 AND order_id=$2 AND status IN ('pending','confirmed')",
          [tenant,order]);
        if(Number(paid.rows[0].amount)+x.amountMinor>Number(active.rows[0].total_minor))failure(409,'El pago supera el saldo del pedido');
        const inserted=await tx.query(
          'INSERT INTO public.manual_payments(tenant_id,order_id,amount_minor,currency,method,idempotency_key,request_hash,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,order_id,amount_minor,currency,method,status,created_at',
          [tenant,order,x.amountMinor,active.rows[0].currency,x.method,key,requestHash,req.actor.id]);
        return {row:inserted.rows[0],repeated:false};
      });
      return reply.code(created.repeated?200:201).send(created.row);
    });
    routes.post('/api/v1/tenants/:tenantId/payments/:paymentId/confirm-manual',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId),payment=parseOrThrow(id,req.params.paymentId);
      await requireTenant(db,tenant,req.actor.id,['owner','manager']);
      const x=parseOrThrow(confirmManual,req.body);
      return db.transaction(async tx=>{
        // Lock order before payment to serialize cancellation and confirmation.
        const ids=await tx.query('SELECT order_id FROM public.manual_payments WHERE tenant_id=$1 AND id=$2',
          [tenant,payment]);
        if(!ids.rowCount)failure(404,'Pago no encontrado');
        const order=await tx.query('SELECT id,status FROM public.orders WHERE tenant_id=$1 AND id=$2 FOR UPDATE',
          [tenant,ids.rows[0].order_id]);
        if(!order.rowCount||order.rows[0].status==='cancelled')failure(409,'Pedido cancelado o no disponible');
        const found=await tx.query('SELECT * FROM public.manual_payments WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[tenant,payment]);
        if(found.rows[0].status!=='pending')failure(409,'El pago ya fue procesado');
        if(!isValidConfirmation(found.rows[0].method,x.reference))
          failure(400,'Referencia de comprobante requerida para este medio de pago');
        const localDate=await tx.query("SELECT (now() AT TIME ZONE time_zone)::date::text AS day FROM public.tenants WHERE id=$1 AND status='active'",[tenant]);
        if(!localDate.rowCount)failure(404,'Negocio no disponible');
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
          [tenant+':cash:'+localDate.rows[0].day]);
        // Checks are re-run while the order is locked. Confirmed status is staff
        // attestation of an offline collection, NEVER an online charge.
        const paid=await tx.query(
          "SELECT coalesce(sum(amount_minor),0)::bigint AS amount FROM public.manual_payments WHERE tenant_id=$1 AND order_id=$2 AND status='confirmed'",
          [tenant,order.rows[0].id]);
        const total=await tx.query('SELECT total_minor FROM public.orders WHERE id=$1 AND tenant_id=$2',[order.rows[0].id,tenant]);
        if(Number(paid.rows[0].amount)+Number(found.rows[0].amount_minor)>Number(total.rows[0].total_minor))
          failure(409,'El pago supera el total del pedido');
        const paymentResult=await tx.query(
          "UPDATE public.manual_payments SET status='confirmed',reference=$3,confirmed_by=$4,confirmed_at=now() WHERE tenant_id=$1 AND id=$2 RETURNING id,order_id,amount_minor,currency,method,status,confirmed_at",
          [tenant,payment,x.reference||null,req.actor.id]);
        await tx.query(
          "INSERT INTO public.transactions(tenant_id,type,category,concept,amount_minor,payment_method,reference_id,created_by) VALUES($1,'income','orders','Cobro manual de pedido',$2,$3,$4,$5)",
          [tenant,found.rows[0].amount_minor,found.rows[0].method,payment,req.actor.id]);
        return paymentResult.rows[0];
      });
    });
    routes.post('/api/v1/tenants/:tenantId/payments/:paymentId/refund-manual',async(req,reply)=>{
      const tenant=parseOrThrow(id,req.params.tenantId),payment=parseOrThrow(id,req.params.paymentId);
      await requireTenant(db,tenant,req.actor.id,['owner','manager']);
      const x=parseOrThrow(refundManual,req.body);
      const key=req.headers['idempotency-key'];
      if(!paymentKey(key))failure(400,'Idempotency-Key requerido');
      const requestHash=createHash('sha256').update(
        JSON.stringify([payment,x.amountMinor,x.reason,x.reference||null])).digest('hex');
      const saved=await db.transaction(async tx=>{
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
          [tenant+':'+req.actor.id+':refund:'+key]);
        const existing=await tx.query(
          'SELECT * FROM public.manual_refunds WHERE tenant_id=$1 AND created_by=$2 AND idempotency_key=$3',
          [tenant,req.actor.id,key]);
        if(existing.rowCount){
          if(existing.rows[0].request_hash!==requestHash)
            failure(409,'Idempotency-Key reutilizada con otra devolucion');
          return {row:existing.rows[0],repeated:true};
        }
        const source=await tx.query('SELECT order_id FROM public.manual_payments WHERE tenant_id=$1 AND id=$2',
          [tenant,payment]);
        if(!source.rowCount)failure(404,'Pago no encontrado');
        // Consistent lock order: order first, then original payment, then daily cash.
        const order=await tx.query('SELECT id,status FROM public.orders WHERE tenant_id=$1 AND id=$2 FOR UPDATE',
          [tenant,source.rows[0].order_id]);
        if(!order.rowCount||order.rows[0].status==='cancelled')
          failure(409,'Pedido cancelado o no disponible');
        const original=await tx.query(
          "SELECT * FROM public.manual_payments WHERE tenant_id=$1 AND id=$2 AND order_id=$3 FOR UPDATE",
          [tenant,payment,order.rows[0].id]);
        if(!original.rowCount||original.rows[0].status!=='confirmed')
          failure(409,'No se puede devolver un pago no confirmado');
        const pay=original.rows[0];
        if(!isValidConfirmation(pay.method,x.reference))
          failure(400,'Comprobante requerido para registrar devolucion por este metodo');
        const total=await tx.query(
          'SELECT coalesce(sum(amount_minor),0)::bigint AS refunded FROM public.manual_refunds WHERE tenant_id=$1 AND payment_id=$2',
          [tenant,payment]);
        if(BigInt(total.rows[0].refunded)+BigInt(x.amountMinor)>BigInt(pay.amount_minor))
          failure(409,'La devolucion supera el importe del pago confirmado');
        const day=await tx.query(
          "SELECT (now() AT TIME ZONE time_zone)::date::text AS local_day FROM public.tenants WHERE id=$1 AND status='active'",
          [tenant]);
        if(!day.rowCount)failure(404,'Negocio no disponible');
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
          [tenant+':cash:'+day.rows[0].local_day]);
        const refund=await tx.query(
          'INSERT INTO public.manual_refunds(tenant_id,payment_id,order_id,amount_minor,currency,method,reason,reference,created_by,idempotency_key,request_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id,payment_id,order_id,amount_minor,currency,method,reason,reference,created_at',
          [tenant,payment,pay.order_id,x.amountMinor,pay.currency,pay.method,x.reason,
            x.reference||null,req.actor.id,key,requestHash]);
        await tx.query(
          "INSERT INTO public.transactions(tenant_id,type,category,concept,amount_minor,payment_method,reference_id,created_by) VALUES($1,'expense','manual_refund','Devolucion manual de pedido',$2,$3,$4,$5)",
          [tenant,x.amountMinor,pay.method,refund.rows[0].id,req.actor.id]);
        return {row:refund.rows[0],repeated:false};
      });
      return reply.code(saved.repeated?200:201).send(saved.row);
    });
    routes.post('/api/v1/tenants/:tenantId/payments/:paymentId/void-pending',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId),payment=parseOrThrow(id,req.params.paymentId);
      await requireTenant(db,tenant,req.actor.id,['owner','manager']);
      const r=await db.query(
        "UPDATE public.manual_payments SET status='voided',voided_by=$3,voided_at=now() WHERE tenant_id=$1 AND id=$2 AND status='pending' RETURNING id,order_id,status",
        [tenant,payment,req.actor.id]);
      if(!r.rowCount)failure(409,'El pago no existe o ya fue procesado');
      return r.rows[0];
    });
  });
}
