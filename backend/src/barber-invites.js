import {randomBytes,createHash} from 'node:crypto';
import {z} from 'zod';
import {failure,parseOrThrow} from './security.js';

const uuid=z.uuid();
const invitation=z.string().regex(/^[a-f0-9]{64}$/);
const hash=code=>createHash('sha256').update(code).digest('hex');
const name=z.string().trim().min(2).max(120);
const ownerRoles=['owner','manager'];

export async function registerBarberInviteRoutes(app,{db,security}){
 const {authenticated,limited,requireTenant}=security;
 app.get('/api/v1/public/barber-invites/:code',async req=>{
   await limited(req);
   const code=parseOrThrow(invitation,req.params.code);
   const found=await db.query(`SELECT t.id AS tenant_id,t.name FROM public.barber_invites i
     JOIN public.tenants t ON t.id=i.tenant_id WHERE i.code_hash=$1
     AND i.expires_at>now() AND t.status='active'`,[hash(code)]);
   if(!found.rowCount)failure(404,'Invitaci�n vencida o inv�lida');
   return found.rows[0];
 });
 app.register(async routes=>{
   routes.addHook('preHandler',async req=>{await authenticated(req);await limited(req);if(!db)failure(503,'Base de datos no configurada');});
   routes.post('/api/v1/tenants/:tenantId/barber-invites',async req=>{
     const tenant=parseOrThrow(uuid,req.params.tenantId);
     await requireTenant(db,tenant,req.actor.id,ownerRoles);
     const code=randomBytes(32).toString('hex');
     await db.query('INSERT INTO public.barber_invites(tenant_id,code_hash,expires_at) VALUES($1,$2,now()+interval \'7 days\')',[tenant,hash(code)]);
     return {code,expiresInDays:7};
   });
   routes.post('/api/v1/barber-join/:code',async(req,reply)=>{
     const code=parseOrThrow(invitation,req.params.code);
     const input=parseOrThrow(z.object({fullName:name}).strict(),req.body);
     const result=await db.transaction(async tx=>{
       const target=await tx.query(`SELECT t.id FROM public.barber_invites i
         JOIN public.tenants t ON t.id=i.tenant_id WHERE i.code_hash=$1
         AND i.expires_at>now() AND t.status='active' FOR SHARE OF i`,[hash(code)]);
       if(!target.rowCount)failure(404,'Invitaci�n vencida o inv�lida');
       const tenant=target.rows[0].id;
       const existing=await tx.query('SELECT 1 FROM public.tenant_members WHERE user_id=$1',[req.actor.id]);
       if(existing.rowCount)failure(409,'Esta cuenta ya pertenece a un equipo profesional');
       const row=await tx.query(`INSERT INTO public.barber_join_requests(tenant_id,user_id,full_name)
         VALUES($1,$2,$3) ON CONFLICT(tenant_id,user_id) DO UPDATE
         SET full_name=excluded.full_name,status='pending',reviewed_at=null
         RETURNING id,status`,[tenant,req.actor.id,input.fullName]);
       return row.rows[0];
     });
     return reply.code(202).send(result);
   });
   routes.get('/api/v1/tenants/:tenantId/barber-requests',async req=>{
     const tenant=parseOrThrow(uuid,req.params.tenantId);
     await requireTenant(db,tenant,req.actor.id,ownerRoles);
     return (await db.query(`SELECT id,full_name,created_at,status FROM public.barber_join_requests
       WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 100`,[tenant])).rows;
   });
   routes.post('/api/v1/tenants/:tenantId/barber-requests/:requestId/decision',async req=>{
     const tenant=parseOrThrow(uuid,req.params.tenantId);
     const id=parseOrThrow(uuid,req.params.requestId);
     await requireTenant(db,tenant,req.actor.id,ownerRoles);
     const input=parseOrThrow(z.object({approve:z.boolean()}).strict(),req.body);
     return db.transaction(async tx=>{
       const match=await tx.query(`SELECT * FROM public.barber_join_requests
         WHERE id=$1 AND tenant_id=$2 FOR UPDATE`,[id,tenant]);
       if(!match.rowCount)failure(404,'Solicitud no encontrada');
       const request=match.rows[0];
       if(request.status!=='pending')failure(409,'La solicitud ya fue atendida');
       if(input.approve){
         const prior=await tx.query('SELECT 1 FROM public.tenant_members WHERE user_id=$1',[request.user_id]);
         if(prior.rowCount)failure(409,'El usuario ya pertenece a otro equipo');
         await tx.query("INSERT INTO public.tenant_members(tenant_id,user_id,role) VALUES($1,$2,'barber')",[tenant,request.user_id]);
         const slug='barber-'+request.user_id.slice(0,12);
         await tx.query(`INSERT INTO public.barbers(tenant_id,user_id,name,slug,bio,commission_rate)
           VALUES($1,$2,$3,$4,'',0)`,[tenant,request.user_id,request.full_name,slug]);
       }
       await tx.query('UPDATE public.barber_join_requests SET status=$3,reviewed_at=now() WHERE id=$1 AND tenant_id=$2',
         [id,tenant,input.approve?'approved':'rejected']);
       return {status:input.approve?'approved':'rejected'};
     });
   });
 });
}
