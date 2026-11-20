import {z} from 'zod';
import {failure,parseOrThrow} from './security.js';
import {normalizeBookingPhone} from './whatsapp-cloud.js';

const id=z.uuid();
const payload=z.object({
  enabled:z.boolean(),
  phone:z.string().trim().max(32).default('')
}).strict();

export async function registerBarberWhatsAppRoutes(app,{db,security}){
 const {authenticated,limited,requireTenant}=security;
 app.register(async routes=>{
  routes.addHook('preHandler',async req=>{
   await authenticated(req);await limited(req);
   if(!db)failure(503,'La base de datos no está disponible');
  });
  const ownBarber=async(req)=>{
   const tenant=parseOrThrow(id,req.params.tenantId);
   const barber=parseOrThrow(id,req.params.barberId);
   await requireTenant(db,tenant,req.actor.id,['owner','barber']);
   const result=await db.query(
    'SELECT id,user_id,whatsapp_phone,whatsapp_opt_in,status FROM public.barbers WHERE tenant_id=$1 AND id=$2',
    [tenant,barber]);
   if(!result.rowCount||result.rows[0].user_id!==req.actor.id)
     failure(403,'Solo puedes activar las notificaciones de tu propio perfil profesional');
   return {tenant,barber,record:result.rows[0]};
  };
  const getTemplateReady=async tenant=>{
    const r=await db.query(
      "SELECT enabled,templates->'barber_created'->>'name' AS template_name FROM public.whatsapp_tenant_settings WHERE tenant_id=$1",
      [tenant]);
    return r.rows[0]?.enabled===true&&Boolean(r.rows[0]?.template_name);
  };
  routes.get('/api/v1/tenants/:tenantId/barbers/:barberId/whatsapp-notifications',async req=>{
   const {record,tenant}=await ownBarber(req);
   return {enabled:record.whatsapp_opt_in===true,phone:record.whatsapp_phone||'',
     templateReady:await getTemplateReady(tenant)};
  });
  routes.patch('/api/v1/tenants/:tenantId/barbers/:barberId/whatsapp-notifications',async req=>{
   const {tenant,barber,record}=await ownBarber(req);
   const data=parseOrThrow(payload,req.body);
   let phone=String(record.whatsapp_phone||'');
   if(data.enabled){
    try{phone=normalizeBookingPhone(data.phone);}
    catch{failure(400,'Introduce un celular válido para recibir citas por WhatsApp, por ejemplo 3001234567');}
   }
   await db.transaction(async tx=>{
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[tenant+':barber-whatsapp:'+barber]);
    const updated=await tx.query(
     'UPDATE public.barbers SET whatsapp_phone=$3,whatsapp_opt_in=$4 WHERE tenant_id=$1 AND id=$2 AND user_id=$5 RETURNING id',
     [tenant,barber,phone,data.enabled,req.actor.id]);
    if(!updated.rowCount)failure(403,'No puedes modificar el WhatsApp de otro profesional');
    if(!data.enabled||phone!==record.whatsapp_phone){
     await tx.query(`UPDATE public.whatsapp_messages m SET status='suppressed',failure_code='barber_opt_out',updated_at=now()
       FROM public.appointments a WHERE m.appointment_id=a.id AND a.barber_id=$2
         AND m.tenant_id=$1 AND m.event_kind='barber_created'
         AND m.status='queued'`,[tenant,barber]);
    }
   });
   return {enabled:data.enabled,phone:data.enabled?phone:'',templateReady:await getTemplateReady(tenant)};
  });
 });
}