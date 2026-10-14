import {timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {failure,parseOrThrow} from './security.js';
import {normalizeWhatsAppPhone,verifyWhatsAppSignature} from './whatsapp-cloud.js';

const id=z.uuid();
const kinds=['created','reminder','rescheduled','cancelled'];
const params=z.enum(['customer_name','business_name','barber_name','service_name','date','time']);
const template=z.object({name:z.string().regex(/^[a-z][a-z0-9_]{0,511}$/),params:z.array(params).max(10)}).strict();
const settings=z.object({
  enabled:z.boolean(),
  languageCode:z.string().regex(/^[a-z]{2,3}_[A-Z]{2}$/).default('es_CO'),
  reminderHours:z.number().int().min(1).max(168).default(24),
  templates:z.object({created:template.optional(),reminder:template.optional(),
    rescheduled:template.optional(),cancelled:template.optional()}).strict(),
}).strict();
const consentSchema=z.object({tenantId:id,phone:z.string().min(8).max(32),consent:z.boolean()}).strict();
function constantTimeMatch(a,b){
  if(!a||!b)return false;
  const x=Buffer.from(a),y=Buffer.from(b);
  return x.length===y.length&&timingSafeEqual(x,y);
}

export async function registerWhatsAppRoutes(app,{config,db,security}){
  const {authenticated,limited,requireTenant}=security;
  app.register(async api=>{
    api.addHook('preHandler',async req=>{
      await authenticated(req);await limited(req);
      if(!db)failure(503,'Base de datos no configurada');
    });
    api.get('/api/v1/tenants/:tenantId/whatsapp/settings',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      await requireTenant(db,tenant,req.actor.id,['owner','manager']);
      const row=await db.query('SELECT enabled,language_code,reminder_hours,templates FROM public.whatsapp_tenant_settings WHERE tenant_id=$1',[tenant]);
      return row.rows[0]||{enabled:false,language_code:'es_CO',reminder_hours:24,templates:{}};
    });
    api.put('/api/v1/tenants/:tenantId/whatsapp/settings',async req=>{
      const tenant=parseOrThrow(id,req.params.tenantId);
      await requireTenant(db,tenant,req.actor.id,['owner','manager']);
      const x=parseOrThrow(settings,req.body);
      if(x.enabled&&(!config.whatsappSendEnabled||!config.whatsappAccessToken||!config.whatsappPhoneNumberId))
        failure(409,'WhatsApp Cloud API aun no esta habilitada en el servidor');
      if(x.enabled&&!Object.values(x.templates).some(Boolean))
        failure(400,'Configura al menos una plantilla aprobada antes de activar WhatsApp');
      return db.transaction(async tx=>{
        const row=await tx.query('INSERT INTO public.whatsapp_tenant_settings(tenant_id,enabled,language_code,reminder_hours,templates) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(tenant_id) DO UPDATE SET enabled=EXCLUDED.enabled,language_code=EXCLUDED.language_code,reminder_hours=EXCLUDED.reminder_hours,templates=EXCLUDED.templates,updated_at=now() RETURNING enabled,language_code,reminder_hours,templates',
          [tenant,x.enabled,x.languageCode,x.reminderHours,JSON.stringify(x.templates)]);
        if(!x.enabled)await tx.query("UPDATE public.whatsapp_messages SET status='suppressed',failure_code='tenant_disabled',updated_at=now() WHERE tenant_id=$1 AND status='queued'",[tenant]);
        return row.rows[0];
      });
    });
    api.get('/api/v1/me/whatsapp/consents',async req=>{
      const rows=await db.query('SELECT tenant_id,phone_e164,consented_at,revoked_at FROM public.whatsapp_consents WHERE user_id=$1 ORDER BY consented_at DESC LIMIT 100',[req.actor.id]);
      return rows.rows;
    });
    api.post('/api/v1/me/whatsapp/consent',async req=>{
      const x=parseOrThrow(consentSchema,req.body);
      let phone;
      try{phone='+'+normalizeWhatsAppPhone(x.phone);}
      catch{failure(400,'Numero de WhatsApp invalido. Incluye indicativo de pais');}
      if(!x.consent){
        await db.query('UPDATE public.whatsapp_consents SET revoked_at=COALESCE(revoked_at,now()) WHERE tenant_id=$1 AND user_id=$2 AND phone_e164=$3',[x.tenantId,req.actor.id,phone]);
        return {consent:false};
      }
      const own=await db.query(
        "SELECT 1 FROM public.appointments WHERE tenant_id=$1 AND customer_user_id=$2 AND regexp_replace(customer_phone,'[[:space:]().-]','','g')=$3 LIMIT 1",
        [x.tenantId,req.actor.id,phone]);
      if(!own.rowCount)failure(403,'Solo puedes autorizar WhatsApp para el telefono de tus propias reservas');
      await db.transaction(async tx=>{
        await tx.query("INSERT INTO public.whatsapp_consents(tenant_id,user_id,phone_e164) VALUES($1,$2,$3) ON CONFLICT(tenant_id,user_id,phone_e164) DO UPDATE SET consented_at=now(),revoked_at=NULL",
          [x.tenantId,req.actor.id,phone]);
        const eligible=await tx.query("SELECT a.id,a.starts_at,a.reschedule_count,c.reminder_hours,c.templates FROM public.appointments a JOIN public.whatsapp_tenant_settings c ON c.tenant_id=a.tenant_id AND c.enabled=true WHERE a.tenant_id=$1 AND a.customer_user_id=$2 AND regexp_replace(a.customer_phone,'[[:space:]().-]','','g')=$3 AND a.status IN ('pending','confirmed') AND a.starts_at>now() ORDER BY a.starts_at LIMIT 100",
          [x.tenantId,req.actor.id,phone]);
        for(const a of eligible.rows){
          if(a.templates?.created?.name){
            await tx.query("INSERT INTO public.whatsapp_messages(tenant_id,appointment_id,user_id,phone_e164,event_kind,event_version,scheduled_at) VALUES($1,$2,$3,$4,'created',0,now()) ON CONFLICT DO NOTHING",
              [x.tenantId,a.id,req.actor.id,phone]);
          }
          if(a.templates?.reminder?.name&&new Date(a.starts_at).getTime()>Date.now()+a.reminder_hours*3600000){
            await tx.query("INSERT INTO public.whatsapp_messages(tenant_id,appointment_id,user_id,phone_e164,event_kind,event_version,scheduled_at) VALUES($1,$2,$3,$4,'reminder',$5,$6::timestamptz-make_interval(hours=>$7)) ON CONFLICT DO NOTHING",
              [x.tenantId,a.id,req.actor.id,phone,a.reschedule_count,a.starts_at,a.reminder_hours]);
          }
        }
      });
      return {consent:true};
    });
  });
  app.register(async webhook=>{
    // Scope the raw body parser to this route group. JSON reserialization breaks Meta signatures.
    webhook.addContentTypeParser('application/json',{parseAs:'buffer'},(_req,body,done)=>done(null,body));
    webhook.get('/api/v1/whatsapp/webhook',async(req,reply)=>{
      if(!config.whatsappWebhookVerifyToken)return reply.code(503).send('not configured');
      const q=req.query||{};
      if(q['hub.mode']!=='subscribe'||!constantTimeMatch(q['hub.verify_token'],config.whatsappWebhookVerifyToken))
        return reply.code(403).send('forbidden');
      return reply.type('text/plain').send(String(q['hub.challenge']||''));
    });
    webhook.post('/api/v1/whatsapp/webhook',async(req,reply)=>{
      if(!config.whatsappAppSecret||!db)return reply.code(503).send({error:'not configured'});
      const body=req.body;
      if(!verifyWhatsAppSignature({appSecret:config.whatsappAppSecret,rawBody:body,signature:req.headers['x-hub-signature-256']}))
        return reply.code(403).send({error:'invalid signature'});
      let data;
      try{data=JSON.parse(body.toString('utf8'));}
      catch{return reply.code(400).send({error:'invalid JSON'});}
      if(data?.object!=='whatsapp_business_account')return {ok:true};
      for(const item of data.entry||[]){
        for(const change of item.changes||[]){
          const value=change?.value;
          if(value?.metadata?.phone_number_id!==config.whatsappPhoneNumberId)continue;
          for(const status of value.statuses||[]){
            if(typeof status.id!=='string'||!['sent','delivered','read','failed'].includes(status.status))continue;
            await db.query("UPDATE public.whatsapp_messages SET status=CASE WHEN status='read' THEN status WHEN status='delivered' AND $2='sent' THEN status WHEN status IN ('sent','delivered') AND $2 IN ('sent','delivered','read','failed') THEN $2 ELSE status END,updated_at=now() WHERE provider_message_id=$1",
              [status.id,status.status]);
          }
        }
      }
      return {ok:true};
    });
  });
}
