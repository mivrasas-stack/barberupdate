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
 const {authenticated,limited,requireTenant}=security;
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
