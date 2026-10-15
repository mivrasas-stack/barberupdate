import {z} from 'zod';
import {failure,parseOrThrow} from './security.js';

// A QR grants discovery, never access to a business's private data.
// Permanent enrollment is always tied to a verified Supabase Auth user.
const code=z.string().trim().toUpperCase().regex(/^[A-F0-9]{24}$/,'Código de vinculación inválido');
const uuid=z.uuid();
const profile=z.object({
  code,
  fullName:z.string().trim().min(2).max(120),
  phone:z.string().trim().min(7).max(32).regex(/^[+0-9 ()-]+$/)
}).strict();
const linkedQuery=`
 SELECT t.id AS tenant_id,t.slug,t.name,t.business_kind,
        b.id AS barber_id,b.name AS barber_name,b.slug AS barber_slug,
        l.linked_at
 FROM public.customer_links l
 JOIN public.tenants t ON t.id=l.tenant_id AND t.status='active'
 LEFT JOIN public.barbers b ON b.id=l.barber_id AND b.tenant_id=t.id
 WHERE l.user_id=$1 ORDER BY l.linked_at DESC LIMIT 100
`;
export async function registerCustomerLinkRoutes(app,{db,security}){
 const {authenticated,limited,requireTenant,service}=security;
 app.register(async publicRoutes=>{
   publicRoutes.addHook('preHandler',async req=>{
     await limited(req);if(!db)failure(503,'Base de datos no configurada');
   });
   publicRoutes.get('/api/v1/public/links/:code',async req=>{
     const key=parseOrThrow(code,req.params.code);
     const rows=await db.query(`
       SELECT t.id AS tenant_id,t.slug,t.name,t.business_kind,t.link_code,
         b.id AS barber_id,b.name AS barber_name,b.slug AS barber_slug
       FROM public.tenants t
       LEFT JOIN LATERAL (
         SELECT id,name,slug FROM public.barbers
         WHERE tenant_id=t.id AND status='active' AND user_id=t.owner_user_id
         ORDER BY created_at LIMIT 1
       ) b ON t.business_kind='independent'
       WHERE t.link_code=$1 AND t.status='active'
     `,[key]);
     if(!rows.rowCount)failure(404,'QR no registrado o negocio inactivo');
     return rows.rows[0];
   });
 });
 app.register(async secure=>{
   secure.addHook('preHandler',async req=>{
     await authenticated(req);await limited(req);
     if(!db)failure(503,'Base de datos no configurada');
   });
   // Real CRM roster: QR-linked customers are visible even without appointments.
   // Booking-only customers remain visible; each account is counted once per tenant.
   // Only staff of this tenant may request it, and Auth metadata is resolved server-side.
   secure.get('/api/v1/tenants/:tenantId/customers',async req=>{
     const tenant=parseOrThrow(uuid,req.params.tenantId);
     await requireTenant(db,tenant,req.actor.id,['owner','manager','barber']);
     if(!service?.auth?.admin?.getUserById)failure(503,'Servicio de perfiles no disponible');
     const results=await db.query(`
       WITH customers AS (
         SELECT user_id,linked_at,true AS linked_by_qr
           FROM public.customer_links WHERE tenant_id=$1
         UNION ALL
         SELECT DISTINCT a.customer_user_id,NULL::timestamptz,false
           FROM public.appointments a
           WHERE a.tenant_id=$1 AND a.customer_user_id IS NOT NULL
             AND NOT EXISTS (
               SELECT 1 FROM public.customer_links l
               WHERE l.tenant_id=$1 AND l.user_id=a.customer_user_id
             )
       ),
       visits AS (
         SELECT a.customer_user_id,
           count(*) FILTER (WHERE a.status='completed')::integer AS completed_visits,
           coalesce(sum(a.price_minor) FILTER (WHERE a.status='completed'),0)::bigint AS total_spent,
           max(a.starts_at) FILTER (WHERE a.status='completed') AS last_service_at
         FROM public.appointments a
         WHERE a.tenant_id=$1 AND a.customer_user_id IS NOT NULL
         GROUP BY a.customer_user_id
       )
       SELECT c.user_id,c.linked_at,c.linked_by_qr,
         coalesce(cp.full_name,booking_profile.customer_name) AS full_name,
         coalesce(cp.phone,booking_profile.customer_phone) AS phone,
         coalesce(v.completed_visits,0)::integer AS completed_visits,
         coalesce(v.total_spent,0)::bigint AS total_spent,
         v.last_service_at,
         (SELECT s.name FROM public.appointments a2
            JOIN public.services s ON s.tenant_id=a2.tenant_id AND s.id=a2.service_id
           WHERE a2.tenant_id=$1 AND a2.customer_user_id=c.user_id AND a2.status='completed'
           ORDER BY a2.starts_at DESC LIMIT 1) AS last_service,
         coalesce(loyalty.points,0)::integer AS points
       FROM customers c
       LEFT JOIN public.customer_profiles cp ON cp.user_id=c.user_id
       LEFT JOIN LATERAL (
         SELECT a3.customer_name,a3.customer_phone FROM public.appointments a3
         WHERE a3.tenant_id=$1 AND a3.customer_user_id=c.user_id
         ORDER BY a3.starts_at DESC LIMIT 1
       ) booking_profile ON true
       LEFT JOIN visits v ON v.customer_user_id=c.user_id
       LEFT JOIN public.loyalty_accounts loyalty ON loyalty.tenant_id=$1 AND loyalty.user_id=c.user_id
       ORDER BY c.linked_by_qr DESC,c.linked_at DESC NULLS LAST,c.user_id
       LIMIT 200
     `,[tenant]);
     // Supabase Auth is the source of the avatar/email after profile updates.
     // Bounded concurrency avoids triggering one large burst of admin API calls.
     const rows=results.rows;
     const enriched=new Array(rows.length);
     let cursor=0;
     const workers=Array.from({length:Math.min(6,rows.length)},async()=>{
       while(cursor<rows.length){
         const index=cursor++;
         const row=rows[index];
         let authUser=null;
         try{
           const {data,error}=await service.auth.admin.getUserById(row.user_id);
           if(error)req.log.warn({userId:row.user_id},'Unable to resolve customer avatar');
           else authUser=data?.user||null;
         }catch(_error){
           req.log.warn({userId:row.user_id},'Unable to retrieve customer profile');
         }
         enriched[index]={
           id:row.user_id,
           name:authUser?.user_metadata?.full_name||authUser?.user_metadata?.name||row.full_name||'Cliente',
           email:row.linked_by_qr?(authUser?.email||''):'' ,
           phone:authUser?.user_metadata?.phone||row.phone||'',
           avatar:authUser?.user_metadata?.avatar_url||'',
           linkedByQr:row.linked_by_qr===true,
           linkedAt:row.linked_at,
           visits:Number(row.completed_visits)||0,
           totalSpent:Number(row.total_spent)||0,
           lastService:row.last_service||null,
           lastServiceAt:row.last_service_at||null,
           points:Number(row.points)||0
         };
       }
     });
     await Promise.all(workers);
     return enriched;
   });
   secure.get('/api/v1/tenants/:tenantId/link-code',async req=>{
     const tenant=parseOrThrow(uuid,req.params.tenantId);
     await requireTenant(db,tenant,req.actor.id,['owner','manager']);
     const rows=await db.query(`
       SELECT id AS tenant_id,name,slug,business_kind,link_code
       FROM public.tenants WHERE id=$1 AND status='active'
     `,[tenant]);
     if(!rows.rowCount)failure(404,'Negocio no disponible');
     return rows.rows[0];
   });
   secure.get('/api/v1/me/links',async req=>{
     const [links,details]=await Promise.all([
       db.query(linkedQuery,[req.actor.id]),
       db.query('SELECT full_name,phone FROM public.customer_profiles WHERE user_id=$1',[req.actor.id])
     ]);
     return {items:links.rows,profile:details.rows[0]||null};
   });
   secure.post('/api/v1/me/links',async(req,reply)=>{
     const input=parseOrThrow(profile,req.body);
     const result=await db.transaction(async tx=>{
       const target=await tx.query(`
         SELECT t.id,t.name,t.business_kind,b.id AS barber_id
         FROM public.tenants t
         LEFT JOIN LATERAL(
           SELECT id FROM public.barbers
           WHERE tenant_id=t.id AND user_id=t.owner_user_id AND status='active'
           ORDER BY created_at LIMIT 1
         ) b ON t.business_kind='independent'
         WHERE t.link_code=$1 AND t.status='active'
         FOR SHARE OF t
       `,[input.code]);
       if(!target.rowCount)failure(404,'El código no corresponde a un negocio activo');
       if(target.rows[0].business_kind==='independent'&&!target.rows[0].barber_id)
         failure(409,'Este profesional todavía no tiene su perfil activo');
       const membership=await tx.query(
         'SELECT 1 FROM public.tenant_members WHERE user_id=$1 LIMIT 1',[req.actor.id]);
       const admin=await tx.query('SELECT 1 FROM public.platform_admins WHERE user_id=$1',[req.actor.id]);
       if(membership.rowCount||admin.rowCount)failure(403,'La vinculación está reservada para clientes');
       await tx.query(`
         INSERT INTO public.customer_profiles(user_id,full_name,phone)
         VALUES($1,$2,$3)
         ON CONFLICT(user_id) DO UPDATE SET full_name=excluded.full_name,phone=excluded.phone,updated_at=now()
       `,[req.actor.id,input.fullName,input.phone]);
       const linked=await tx.query(`
         INSERT INTO public.customer_links(user_id,tenant_id,barber_id)
         VALUES($1,$2,$3)
         ON CONFLICT(user_id,tenant_id) DO UPDATE SET barber_id=EXCLUDED.barber_id
         RETURNING linked_at
       `,[req.actor.id,target.rows[0].id,target.rows[0].barber_id]);
       return {tenantId:target.rows[0].id,name:target.rows[0].name,
         kind:target.rows[0].business_kind,linkedAt:linked.rows[0].linked_at};
     });
     return reply.code(200).send(result);
   });
 });
}
