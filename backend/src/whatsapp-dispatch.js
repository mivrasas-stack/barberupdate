import {createTemplateMessage,isWhatsAppDeliveryAllowed,normalizeWhatsAppPhone,sendWhatsAppTemplate,validateTemplateName} from './whatsapp-cloud.js';

const validStatuses=['pending','confirmed'];
const paramsAllowed=new Set(['customer_name','business_name','barber_name','service_name','date','time']);
function getParams(row,template){
  if(!template||typeof template!=='object'||!Array.isArray(template.params)||template.params.length>10)throw new TypeError('Template mappings must define 0-10 parameters');
  const date=new Date(row.starts_at);
  const locale='es-CO';
  const timezone=row.time_zone||'America/Bogota';
  const dictionary={
    customer_name:row.customer_name,
    business_name:row.business_name,
    barber_name:row.barber_name,
    service_name:row.service_name,
    date:new Intl.DateTimeFormat(locale,{timeZone:timezone,dateStyle:'long'}).format(date),
    time:new Intl.DateTimeFormat(locale,{timeZone:timezone,timeStyle:'short'}).format(date),
  };
  return template.params.map(key=>{
    if(!paramsAllowed.has(key))throw new TypeError('Unknown WhatsApp template placeholder');
    const value=String(dictionary[key]||'').trim();
    if(!value)throw new TypeError('Missing WhatsApp template placeholder');
    return value;
  });
}
async function setStatus(db,id,status,failureCode=null,providerId=null){
  await db.query('UPDATE public.whatsapp_messages SET status=$2,failure_code=$3,provider_message_id=COALESCE($4,provider_message_id),sent_at=CASE WHEN $2=$5 THEN now() ELSE sent_at END,updated_at=now() WHERE id=$1',[id,status,failureCode,providerId,'sent']);
}
function eventIsCurrent(job,appointment){
  if(job.event_kind==='cancelled')return appointment.status==='cancelled';
  if(!validStatuses.includes(appointment.status))return false;
  if(job.event_kind==='reminder'||job.event_kind==='rescheduled')
    return appointment.reschedule_count===job.event_version;
  return job.event_version===0;
}

export async function processWhatsAppJobs({db,config,fetcher=fetch,maxBatch=10}){
  if(!config.whatsappSendEnabled)return {disabled:true,attempted:0};
  if(!config.whatsappAccessToken||!config.whatsappPhoneNumberId)
    throw Error('WhatsApp sending enabled but server credentials are missing');
  if(!db)throw Error('WhatsApp worker requires the database');
  // Do not retry ambiguous in-flight requests after process crashes: Meta may have accepted them.
  await db.query("UPDATE public.whatsapp_messages SET status='manual_review',failure_code='lease_expired',updated_at=now() WHERE status='sending' AND lease_until<now()");
  let attempted=0;
  for(let i=0;i<Math.max(1,Math.min(25,maxBatch));i++){
    const job=await db.transaction(async tx=>{
      const found=await tx.query("SELECT * FROM public.whatsapp_messages WHERE status='queued' AND scheduled_at<=now() AND next_attempt_at<=now() ORDER BY next_attempt_at,id LIMIT 1 FOR UPDATE SKIP LOCKED");
      if(!found.rowCount)return null;
      const row=found.rows[0];
      await tx.query("UPDATE public.whatsapp_messages SET status='sending',attempts=attempts+1,lease_until=now()+interval '2 minutes',updated_at=now() WHERE id=$1",[row.id]);
      return row;
    });
    if(!job)break;
    attempted++;
    try{
      const found=await db.query(
        "SELECT a.customer_name,a.customer_phone,a.starts_at,a.status,a.reschedule_count,t.name AS business_name,t.time_zone,s.name AS service_name,b.name AS barber_name,c.enabled,c.language_code,c.templates,op.consented_at,op.revoked_at FROM public.whatsapp_messages m JOIN public.appointments a ON a.id=m.appointment_id AND a.tenant_id=m.tenant_id JOIN public.tenants t ON t.id=m.tenant_id AND t.status='active' JOIN public.services s ON s.id=a.service_id AND s.tenant_id=a.tenant_id JOIN public.barbers b ON b.id=a.barber_id AND b.tenant_id=a.tenant_id LEFT JOIN public.whatsapp_tenant_settings c ON c.tenant_id=m.tenant_id LEFT JOIN public.whatsapp_consents op ON op.tenant_id=m.tenant_id AND op.user_id=m.user_id AND op.phone_e164=m.phone_e164 WHERE m.id=$1",
        [job.id]);
      const row=found.rows[0];
      const spec=row?.templates?.[job.event_kind];
      const eligible=row&&eventIsCurrent(job,row)&&
        normalizeWhatsAppPhone(row.customer_phone)===normalizeWhatsAppPhone(job.phone_e164)&&
        isWhatsAppDeliveryAllowed({
          tenantEnabled:row.enabled,
          consentAt:row.consented_at,
          revokedAt:row.revoked_at,
          templateName:spec?.name,
          appointmentStatus:job.event_kind==='cancelled'?'confirmed':row.status,
        });
      if(!eligible){await setStatus(db,job.id,'suppressed','not_eligible');continue;}
      const message=createTemplateMessage({to:job.phone_e164,name:validateTemplateName(spec.name),
        language:row.language_code,parameters:getParams(row,spec)});
      const {messageId}=await sendWhatsAppTemplate({
        accessToken:config.whatsappAccessToken,
        phoneNumberId:config.whatsappPhoneNumberId,
        graphVersion:config.whatsappGraphVersion,
        message,fetcher
      });
      await setStatus(db,job.id,'sent',null,messageId);
    }catch(err){
      // A transport failure has uncertain outcome: manual review prevents duplicate messages.
      if(err.ambiguous===true){
        await setStatus(db,job.id,'manual_review','meta_unconfirmed');
      }else if(err.retryable===true&&Number.isInteger(err.status)){
        await db.query("UPDATE public.whatsapp_messages SET status=CASE WHEN attempts<6 THEN 'queued' ELSE 'failed' END,failure_code=$2,next_attempt_at=now()+(LEAST(3600,power(2,LEAST(attempts,10))::int*10)::int*interval '1 second'),updated_at=now() WHERE id=$1",[job.id,'meta_'+err.status]);
      }else if(Number.isInteger(err.status)){
        await setStatus(db,job.id,'failed','meta_'+err.status);
      }else{
        await setStatus(db,job.id,'manual_review','ambiguous_or_invalid');
      }
    }
  }
  return {disabled:false,attempted};
}
