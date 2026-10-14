import {z} from 'zod';
import {failure,parseOrThrow} from './security.js';

// A QR grants discovery, never access to a business's private data.
// Permanent enrollment is always tied to a verified Supabase Auth user.
const code=z.string().trim().toUpperCase().regex(/^[A-F0-9]{24}$/,'Código de vinculación inválido');
const uuid=z.uuid();
const profile=z.object({
  code,
  fullName:z.string().trim().min(2).max(120),
  phone:z.string().trim().min(7).max(32).regex(/^[+0-9 ()-]+$/),
  linkScope:z.enum(['both','barber','shop']).optional()
}).strict();
const linkedQuery=`
 SELECT t.id AS tenant_id,t.slug,t.name,t.business_kind,
        b.id AS barber_id,b.name AS barber_name,b.slug AS barber_slug,
        l.link_scope,
        l.linked_at
 FROM public.customer_links l
 JOIN public.tenants t ON t.id=l.tenant_id AND t.status='active'
 LEFT JOIN public.barbers b ON b.id=l.barber_id AND b.tenant_id=t.id
 WHERE l.user_id=$1 ORDER BY l.linked_at DESC LIMIT 100
`;
export async function registerCustomerLinkRoutes(app,{db,security}){
 const {authenticated,limited,requireTenant}=security;
 app.register(async publicRoutes=>{
   publicRoutes.addHook('preHandler',async req=>{
     await limited(req);if(!db)failure(503,'Base de datos no configurada');
   });
   publicRoutes.get('/api/v1/public/links/:code',async req=>{
     const key=parseOrThrow(code,req.params.code);
     // 1. Check if this is a barber's personal QR
     const barberRows=await db.query(`
       SELECT t.id AS tenant_id,t.slug,t.name,t.business_kind,
         b.link_code,b.id AS barber_id,b.name AS barber_name,b.slug AS barber_slug,
         'barber' AS link_type
       FROM public.barbers b
       JOIN public.tenants t ON t.id=b.tenant_id
       WHERE b.link_code=$1 AND b.status='active' AND t.status='active'
     `,[key]);
     if(barberRows.rowCount)return barberRows.rows[0];

     // 2. Check if this is a barbershop / independent tenant QR
     const rows=await db.query(`
       SELECT t.id AS tenant_id,t.slug,t.name,t.business_kind,t.link_code,
         b.id AS barber_id,b.name AS barber_name,b.slug AS barber_slug,
         'shop' AS link_type
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
   secure.get('/api/v1/tenants/:tenantId/link-code',async req=>{
     const tenant=parseOrThrow(uuid,req.params.tenantId);
     const role=await requireTenant(db,tenant,req.actor.id,['owner','manager','barber']);

     // Check if user is a barber or requesting a specific barberId
     let barberRow=null;
     const requestedBarberId = req.query?.barberId ? parseOrThrow(uuid, req.query.barberId) : null;
     if (requestedBarberId) {
       const bRes = await db.query(
         `SELECT id, name, slug, link_code FROM public.barbers WHERE id=$1 AND tenant_id=$2 AND status='active'`,
         [requestedBarberId, tenant]
       );
       if (bRes.rowCount) barberRow = bRes.rows[0];
     } else if (role === 'barber') {
       const bRes = await db.query(
         `SELECT id, name, slug, link_code FROM public.barbers WHERE tenant_id=$1 AND user_id=$2 AND status='active' ORDER BY created_at LIMIT 1`,
         [tenant, req.actor.id]
       );
       if (bRes.rowCount) barberRow = bRes.rows[0];
     }

     const rows=await db.query(`
       SELECT id AS tenant_id,name,slug,business_kind,link_code
       FROM public.tenants WHERE id=$1 AND status='active'
     `,[tenant]);
     if(!rows.rowCount)failure(404,'Negocio no disponible');
     const base=rows.rows[0];
     if (barberRow) {
       return {
         ...base,
         link_code: barberRow.link_code,
         barber_id: barberRow.id,
         barber_name: barberRow.name,
         barber_slug: barberRow.slug,
         barber_link_code: barberRow.link_code,
         shop_link_code: base.link_code,
         link_type: 'barber'
       };
     }
     return {
       ...base,
       shop_link_code: base.link_code,
       link_type: 'shop'
     };
   });
    secure.get('/api/v1/tenants/:tenantId/customers',async req=>{
      const tenant=parseOrThrow(uuid,req.params.tenantId);
      await requireTenant(db,tenant,req.actor.id,['owner','manager','barber']);
      const query=`
        WITH linked_users AS (
          SELECT 
            l.user_id,
            l.linked_at,
            l.barber_id AS preferred_barber_id,
            b.name AS preferred_barber_name,
            p.full_name,
            p.phone
          FROM public.customer_links l
          LEFT JOIN public.customer_profiles p ON p.user_id = l.user_id
          LEFT JOIN public.barbers b ON b.id = l.barber_id
          WHERE l.tenant_id = $1
        ),
        appointment_users AS (
          SELECT
            a.customer_user_id AS user_id,
            MIN(a.starts_at) AS first_seen_at,
            MAX(a.starts_at) AS last_visit_at,
            COUNT(*) AS total_appointments,
            COUNT(*) FILTER (WHERE a.status = 'completed') AS completed_appointments,
            COALESCE(SUM(a.price_minor) FILTER (WHERE a.status = 'completed'), 0) AS total_spent_minor,
            (ARRAY_AGG(a.customer_name ORDER BY a.created_at DESC) FILTER (WHERE a.customer_name IS NOT NULL))[1] AS apt_name,
            (ARRAY_AGG(a.customer_phone ORDER BY a.created_at DESC) FILTER (WHERE a.customer_phone IS NOT NULL))[1] AS apt_phone
          FROM public.appointments a
          WHERE a.tenant_id = $1
          GROUP BY a.customer_user_id
        )
        SELECT 
          COALESCE(l.user_id, a.user_id) AS id,
          COALESCE(l.full_name, a.apt_name, 'Cliente Registrado') AS name,
          COALESCE(l.phone, a.apt_phone, '') AS phone,
          l.linked_at,
          (l.user_id IS NOT NULL) AS is_linked,
          l.preferred_barber_name,
          COALESCE(a.total_appointments, 0)::integer AS total_appointments,
          COALESCE(a.completed_appointments, 0)::integer AS completed_appointments,
          COALESCE(a.total_spent_minor, 0)::bigint AS total_spent_minor,
          a.last_visit_at
        FROM linked_users l
        FULL OUTER JOIN appointment_users a ON a.user_id = l.user_id
        ORDER BY l.linked_at DESC NULLS LAST, a.last_visit_at DESC NULLS LAST
      `;
      const res=await db.query(query,[tenant]);
      return {items:res.rows};
    });
   secure.get('/api/v1/me/links',async req=>{
     const [links,details]=await Promise.all([
       db.query(linkedQuery,[req.actor.id]),
       db.query('SELECT full_name,phone,avatar_url FROM public.customer_profiles WHERE user_id=$1',[req.actor.id])
     ]);
     return {items:links.rows,profile:details.rows[0]||null};
   });
   secure.patch('/api/v1/me/profile',async req=>{
     const schema=z.object({
       fullName:word(120).optional(),
       phone:z.string().min(7).max(32).optional(),
       avatarUrl:z.string().max(2048).optional()
     }).strict();
     const x=parseOrThrow(schema,req.body);
     const existing=await db.query('SELECT full_name,phone,avatar_url FROM public.customer_profiles WHERE user_id=$1',[req.actor.id]);
     const curName=x.fullName||existing.rows[0]?.full_name||'Cliente';
     const curPhone=x.phone||existing.rows[0]?.phone||'3000000000';
     const curAvatar=x.avatarUrl!==undefined?x.avatarUrl:(existing.rows[0]?.avatar_url||'');
     const res=await db.query(`
       INSERT INTO public.customer_profiles(user_id,full_name,phone,avatar_url)
       VALUES($1,$2,$3,$4)
       ON CONFLICT(user_id) DO UPDATE SET
         full_name=EXCLUDED.full_name,
         phone=EXCLUDED.phone,
         avatar_url=EXCLUDED.avatar_url,
         updated_at=now()
       RETURNING user_id,full_name,phone,avatar_url
     `,[req.actor.id,curName,curPhone,curAvatar]);
     return res.rows[0];
   });
   secure.post('/api/v1/me/links',async(req,reply)=>{
     const input=parseOrThrow(profile,req.body);
     const result=await db.transaction(async tx=>{
       // 1. Check if input.code belongs to a barber QR
       let target=await tx.query(`
         SELECT b.id AS barber_id,b.name AS barber_name,
                t.id AS tenant_id,t.name AS tenant_name,t.business_kind,
                'barber' AS link_type
         FROM public.barbers b
         JOIN public.tenants t ON t.id=b.tenant_id
         WHERE b.link_code=$1 AND b.status='active' AND t.status='active'
         FOR SHARE OF t
       `,[input.code]);

       // 2. If not, check if it belongs to a tenant QR
       if(!target.rowCount){
         target=await tx.query(`
           SELECT t.id AS tenant_id,t.name AS tenant_name,t.business_kind,
                  b.id AS barber_id,b.name AS barber_name,'shop' AS link_type
           FROM public.tenants t
           LEFT JOIN LATERAL(
             SELECT id,name FROM public.barbers
             WHERE tenant_id=t.id AND user_id=t.owner_user_id AND status='active'
             ORDER BY created_at LIMIT 1
           ) b ON t.business_kind='independent'
           WHERE t.link_code=$1 AND t.status='active'
           FOR SHARE OF t
         `,[input.code]);
       }

       if(!target.rowCount)failure(404,'El código no corresponde a un negocio activo');
       const entity=target.rows[0];
       if(entity.business_kind==='independent'&&!entity.barber_id)
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

       let scope=input.linkScope||'both';
       let targetBarberId=entity.barber_id||null;
       if(entity.link_type==='barber'){
         if(scope==='shop'){
           targetBarberId=null;
         }
       }else{
         if(entity.business_kind==='independent'){
           scope='both';
         }else{
           scope='shop';
           targetBarberId=null;
         }
       }

       const linked=await tx.query(`
         INSERT INTO public.customer_links(user_id,tenant_id,barber_id,link_scope)
         VALUES($1,$2,$3,$4)
         ON CONFLICT(user_id,tenant_id) DO UPDATE SET 
           barber_id=EXCLUDED.barber_id,
           link_scope=EXCLUDED.link_scope,
           linked_at=now()
         RETURNING linked_at
       `,[req.actor.id,entity.tenant_id,targetBarberId,scope]);

       return {
         tenantId:entity.tenant_id,
         name:entity.tenant_name,
         kind:entity.business_kind,
         barberId:targetBarberId,
         barberName:entity.barber_name||null,
         linkScope:scope,
         linkedAt:linked.rows[0].linked_at
       };
     });
     return reply.code(200).send(result);
   });
 });
}
