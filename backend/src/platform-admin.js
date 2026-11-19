import { z } from 'zod';
import { failure, parseOrThrow } from './security.js';
import {defaultWorkIntervals} from './business-hours.js';

const id = z.uuid();
const text = (n) => z.string().trim().min(1).max(n);
const email = z.email().max(150);
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80);
const userPayload = z.object({
  name: text(120), email, phone: z.string().trim().max(40).default(''),
  role: z.enum(['owner', 'barber_employee', 'client']),
  tenantId: id.optional(),
}).strict().refine(x => x.role !== 'barber_employee' || Boolean(x.tenantId), {
  message: 'Selecciona una barbería para el barbero', path: ['tenantId'],
});
// Admin mutations require explicit authorization and never expose stored passwords.
const manualPassword=z.object({password:z.string().min(6).max(128)}).strict();
const confirmDeletion=z.object({confirmation:z.literal('ELIMINAR')}).strict();
const isArchived=user=>Boolean(user?.app_metadata?.barbernow_deleted_at);

const shopPayload = z.object({
  name: text(120), slug, ownerUserId: id,
  city: text(120), address: text(300),
  phone: z.string().trim().max(40).default(''),
  email: z.union([email, z.literal('')]).default(''),
  tagline: z.string().trim().max(250).default(''),
  timeZone: z.string().trim().min(1).max(80).default('America/Bogota'),
  ownerIsBarber: z.boolean().default(false),
}).strict();

// A professional profile is separate from the tenant membership; never replace 'owner' with 'barber'.
export async function createProfessionalProfile(tx, tenantId, userId, name, prefix='barbero') {
  const existing = await tx.query('SELECT * FROM public.barbers WHERE tenant_id=$1 AND user_id=$2 LIMIT 1', [tenantId, userId]);
  if (existing.rowCount) return existing.rows[0];
  const urlSlug = prefix + '-' + userId.replace(/-/g, '').slice(0,16);
  const inserted = await tx.query(
    'INSERT INTO public.barbers(tenant_id,user_id,name,slug,bio,commission_rate) VALUES($1,$2,$3,$4,$5,0) RETURNING *',
    [tenantId,userId,name,urlSlug,'']
  );
  const barber = inserted.rows[0];
  // New professionals inherit their shop's REAL schedule, not hard-coded 09:00–18:00.
  const business=await tx.query('SELECT opening_hours FROM public.tenants WHERE id=$1',[tenantId]);
  if(!business.rowCount)failure(404,'Barbería no disponible');
  for (const item of defaultWorkIntervals(business.rows[0].opening_hours)) {
    await tx.query(
      'INSERT INTO public.barber_work_intervals(tenant_id,barber_id,weekday,start_minute,end_minute) VALUES($1,$2,$3,$4,$5)',
      [tenantId,barber.id,item.weekday,item.startMinute,item.endMinute]
    );
  }
  return barber;
}

export async function registerPlatformAdminRoutes(app,{db,security,config}) {
  const {authenticated,limited,service} = security;
  app.register(async api => {
    api.addHook('preHandler', async req => {
      await authenticated(req);
      await limited(req);
      if (!db || !service) failure(503,'Administración de plataforma no disponible');
      const granted=await db.query('SELECT 1 FROM public.platform_admins WHERE user_id=$1',[req.actor.id]);
      if (!granted.rowCount) failure(403,'Solo administradores globales');
    });

    api.get('/api/v1/platform/users', async () => {
      const authUsers=[];
      for(let page=1;page<=10;page++){
        const {data,error}=await service.auth.admin.listUsers({page,perPage:200});
        if(error)failure(503,'No se pudo consultar el directorio de usuarios');
        authUsers.push(...(data?.users||[]).filter(u=>!isArchived(u)));
        if((data?.users||[]).length<200)break;
      }
      if(!authUsers.length)return [];
      const ids=authUsers.map(u=>u.id);
      const [members,links,owned,admins]=await Promise.all([
        db.query('SELECT m.user_id,m.tenant_id,m.role,m.created_at,t.name AS shop_name FROM public.tenant_members m JOIN public.tenants t ON t.id=m.tenant_id WHERE m.user_id=ANY($1::uuid[]) ORDER BY m.created_at ASC',[ids]),
        db.query('SELECT l.user_id,l.tenant_id,l.linked_at,t.name AS shop_name FROM public.customer_links l JOIN public.tenants t ON t.id=l.tenant_id WHERE l.user_id=ANY($1::uuid[]) ORDER BY l.linked_at ASC',[ids]),
        db.query('SELECT owner_user_id AS user_id,id AS tenant_id,name AS shop_name,created_at FROM public.tenants WHERE owner_user_id=ANY($1::uuid[])',[ids]),
        db.query('SELECT user_id FROM public.platform_admins WHERE user_id=ANY($1::uuid[])',[ids]),
      ]);
      const memberByUser=new Map();
      const associated=new Map();
      function append(row,kind,date){
        if(!associated.has(row.user_id))associated.set(row.user_id,new Map());
        const list=associated.get(row.user_id),existing=list.get(row.tenant_id);
        const added=date?new Date(date).getTime():Number.POSITIVE_INFINITY;
        if(!existing||added<new Date(existing.linkedAt||'9999-12-31').getTime())
          list.set(row.tenant_id,{id:row.tenant_id,name:row.shop_name,linkedAt:date||'',relation:kind});
      }
      for(const row of members.rows){
        if(!memberByUser.has(row.user_id))memberByUser.set(row.user_id,row);
        append(row,row.role,row.created_at);
      }
      for(const row of links.rows)append(row,'client',row.linked_at);
      for(const row of owned.rows)append(row,'owner',row.created_at);
      const globalAdmins=new Set(admins.rows.map(a=>a.user_id));
      return authUsers.map(u=>{
        const membership=memberByUser.get(u.id);
        const shops=[...(associated.get(u.id)?.values()||[])].sort((a,b)=>a.name.localeCompare(b.name,'es'));
        const metadata=u.user_metadata||{};
        const role=globalAdmins.has(u.id)?'superadmin':
          (owned.rows.some(t=>t.user_id===u.id)||membership?.role==='owner'||membership?.role==='manager')?'owner':
          membership?.role==='barber'?'barber_employee':'client';
        const banned=Boolean(u.banned_until&&new Date(u.banned_until).getTime()>Date.now());
        return {
          id:u.id,name:String(metadata.name||metadata.full_name||u.email?.split('@')[0]||'Usuario'),
          email:u.email||'',phone:String(metadata.phone||u.phone||''),avatar:String(metadata.avatar_url||''),
          role,businessId:membership?.tenant_id||shops[0]?.id||null,barbershops:shops,
          status:banned?'suspended':u.email_confirmed_at?'active':'pending',
          createdAt:u.created_at||'',lastLogin:u.last_sign_in_at||'',
        };
      });
    });

    async function targetForMutation(targetId,actorId,{passwordOnly=false}={}){
      if(targetId===actorId)failure(403,'No puedes modificar tu propia cuenta desde esta pantalla');
      const {data,error}=await service.auth.admin.getUserById(targetId);
      if(error||!data?.user||isArchived(data.user))failure(404,'El usuario no existe o fue retirado');
      const protectedUser=await db.query(
        passwordOnly
          ? 'SELECT 1 FROM public.platform_admins WHERE user_id=$1 LIMIT 1'
          : 'SELECT 1 FROM public.platform_admins WHERE user_id=$1 UNION ALL SELECT 1 FROM public.tenants WHERE owner_user_id=$1 UNION ALL SELECT 1 FROM public.tenant_members WHERE user_id=$1 AND role IN (\'owner\',\'manager\') LIMIT 1',
        [targetId]);
      if(protectedUser.rowCount&&passwordOnly)
        failure(409,'Por seguridad no se puede cambiar la contraseña de otro superadministrador desde esta pantalla.');
      if(!passwordOnly){
        // Only the caller's own admin account and a live shop's owner are protected.
        // Other invited/test accounts, including expired ownership roles, can be retired.
        const owned=await db.query("SELECT name FROM public.tenants WHERE owner_user_id=$1 AND status='active' LIMIT 1",[targetId]);
        if(owned.rowCount)failure(409,'Esta cuenta es propietaria de una barbería activa ('+owned.rows[0].name+'). Transfiere primero el negocio para conservar sus reservas y permisos.');
      }
      return data.user;
    }

    api.post('/api/v1/platform/users/:userId/password',async(req)=>{
      const userId=parseOrThrow(id,req.params.userId);
      const payload=parseOrThrow(manualPassword,req.body);
      await targetForMutation(userId,req.actor.id,{passwordOnly:true});
      const {error}=await service.auth.admin.updateUserById(userId,{password:payload.password});
      if(error)failure(503,'No se pudo restablecer la contraseña. Inténtalo de nuevo.');
      req.log.info({action:'admin_password_reset',admin:req.actor.id,target:userId},'Administrator reset a user password');
      return {ok:true};
    });

    api.delete('/api/v1/platform/users/:userId',async(req)=>{
      const userId=parseOrThrow(id,req.params.userId);
      parseOrThrow(confirmDeletion,req.body);
      const user=await targetForMutation(userId,req.actor.id);
      // Business history (appointments, invoices, rewards) keeps references to user IDs.
      // Disable access and remove the identity from the live directory instead of
      // cascading away business-critical data. This is explicitly a logical removal.
      const metadata={...(user.app_metadata||{}),barbernow_deleted_at:new Date().toISOString()};
      const {error}=await service.auth.admin.updateUserById(userId,{
        ban_duration:'876000h',app_metadata:metadata,
      });
      if(error)failure(503,'No se pudo retirar la cuenta. Inténtalo de nuevo.');
      // Disabling the identity must also stop future business-initiated WhatsApp
      // notices. Historical messages and appointment records are preserved.
      await db.transaction(async tx=>{
        await tx.query("UPDATE public.whatsapp_consents SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=$1 AND revoked_at IS NULL",[userId]);
        await tx.query("UPDATE public.whatsapp_messages SET status='suppressed',failure_code='account_removed',updated_at=now() WHERE user_id=$1 AND status='queued'",[userId]);
      });
      req.log.info({action:'admin_user_archived',admin:req.actor.id,target:userId},'Administrator archived account and blocked login');
      return {ok:true,removed:true,historyPreserved:true};
    });

    api.post('/api/v1/platform/users', async (req,reply) => {
      const x=parseOrThrow(userPayload,req.body);
      if(x.tenantId){
        const shop=await db.query("SELECT id FROM public.tenants WHERE id=$1 AND status='active'",[x.tenantId]);
        if(!shop.rowCount)failure(404,'La barbería seleccionada no existe o no está activa');
      }
      // Supabase sends a secure invitation; no plaintext password ever passes through this dashboard.
      const approvedOrigin=config?.origins?.find(origin=>origin.startsWith('https://')) || config?.origins?.[0];
      const {data,error}=await service.auth.admin.inviteUserByEmail(x.email,{
        data:{name:x.name,phone:x.phone},
        ...(approvedOrigin?{redirectTo:approvedOrigin+'/login'}:{}),
      });
      if(error||!data?.user?.id) failure(409,'No se pudo invitar al usuario; comprueba el correo y la configuración de invitaciones');
      const created=data.user;
      try {
        if(x.tenantId && x.role!=='client'){
          await db.transaction(async tx => {
            await tx.query(
              'INSERT INTO public.tenant_members(tenant_id,user_id,role) VALUES($1,$2,$3)',
              [x.tenantId,created.id,x.role==='owner'?'owner':'barber']
            );
            if(x.role==='barber_employee')await createProfessionalProfile(tx,x.tenantId,created.id,x.name);
          });
        }
      }catch(error){
        // Do not silently claim success after Auth succeeded but membership failed.
        throw Object.assign(new Error('Invitación enviada, pero falló la vinculación a la barbería. Requiere revisión del administrador.'),{statusCode:409});
      }
      return reply.code(201).send({id:created.id,email:x.email,invited:true});
    });

    api.post('/api/v1/platform/tenants', async(req,reply) => {
      const x=parseOrThrow(shopPayload,req.body);
      const {data,error}=await service.auth.admin.getUserById(x.ownerUserId);
      if(error||!data?.user)failure(404,'El propietario debe ser un usuario registrado');
      const row=await db.transaction(async tx=>{
        const created=(await tx.query(
          'INSERT INTO public.tenants(name,slug,owner_user_id,currency,time_zone,business_kind,city,address,phone,email,tagline) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',
          [x.name,x.slug,x.ownerUserId,'COP',x.timeZone,'barbershop',x.city,x.address,x.phone,x.email,x.tagline]
        )).rows[0];
        // Do not downgrade an existing role in another tenant.
        await tx.query("INSERT INTO public.tenant_members(tenant_id,user_id,role) VALUES($1,$2,'owner')",[created.id,x.ownerUserId]);
        if(x.ownerIsBarber){
          const professionalName=String(data.user.user_metadata?.name||data.user.user_metadata?.full_name||data.user.email?.split('@')[0]||'Propietario');
          await createProfessionalProfile(tx,created.id,x.ownerUserId,professionalName,'propietario');
        }
        return created;
      });
      return reply.code(201).send(row);
    });
  });
}