import { z } from 'zod';
import { failure, parseOrThrow } from './security.js';

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
  // The public booking endpoint only offers slots when work intervals exist.
  for (let day=1; day<=6; day++) {
    await tx.query(
      'INSERT INTO public.barber_work_intervals(tenant_id,barber_id,weekday,start_minute,end_minute) VALUES($1,$2,$3,540,1080)',
      [tenantId,barber.id,day]
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
      for (let page=1; page<=5; page++) {
        const {data,error}=await service.auth.admin.listUsers({page,perPage:200});
        if (error) failure(503,'No se pudo consultar el directorio de usuarios');
        authUsers.push(...(data?.users||[]));
        if ((data?.users||[]).length<200) break;
      }
      if (!authUsers.length) return [];
      const ids=authUsers.map(u=>u.id);
      const [members,admins]=await Promise.all([
        db.query('SELECT user_id,tenant_id,role FROM public.tenant_members WHERE user_id=ANY($1::uuid[]) ORDER BY created_at ASC',[ids]),
        db.query('SELECT user_id FROM public.platform_admins WHERE user_id=ANY($1::uuid[])',[ids]),
      ]);
      const memberships=new Map();
      for(const m of members.rows) if (!memberships.has(m.user_id)) memberships.set(m.user_id,m);
      const platformAdmins=new Set(admins.rows.map(a=>a.user_id));
      return authUsers.map(u=>{
        const membership=memberships.get(u.id);
        const metadata=u.user_metadata||{};
        const role=platformAdmins.has(u.id)?'superadmin':membership?.role==='owner'||membership?.role==='manager'?'owner':membership?.role==='barber'?'barber_employee':'client';
        const banned=Boolean(u.banned_until && new Date(u.banned_until).getTime()>Date.now());
        return {
          id:u.id, name:String(metadata.name||metadata.full_name||u.email?.split('@')[0]||'Usuario'),
          email:u.email||'', phone:String(metadata.phone||''), avatar:String(metadata.avatar_url||''),
          role, businessId:membership?.tenant_id||null,
          status:banned?'suspended':u.email_confirmed_at?'active':'pending',
          createdAt:u.created_at||'', lastLogin:u.last_sign_in_at||'',
        };
      });
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
