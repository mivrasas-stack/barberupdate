// Official WhatsApp Cloud API, outgoing approved templates only.
export const TEMPLATES = Object.freeze({
 confirmation: 'confirmacion_de_reserva',
 barber_new: 'nueva_cita_barbero',
 cancellation: 'cita_cancelada',
 reminder: 'recordatorio_cita_cliente',
});
export function normalizePhone(value) {
 const raw=String(value||'').trim();
 const digits=raw.replace(/[^0-9]/g,'');
 // BarberOS uses Colombian mobile numbers: normalize local 3XXXXXXXXX to +57.
 if(/^3\d{9}$/.test(digits)) return '57'+digits;
 // Already country-code-qualified E.164 input (without the '+' in API payload).
 if(/^\+?[1-9]\d{10,14}$/.test(raw.replace(/[\s()-]/g,''))) return digits;
 return null;
}
export function localDateTime(instant,timeZone) {
 const date=new Date(instant);
 const fmt=new Intl.DateTimeFormat('es-CO',{timeZone,day:'2-digit',month:'2-digit',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true});
 const parts=Object.fromEntries(fmt.formatToParts(date).map(x=>[x.type,x.value]));
 return {date:`${parts.day}/${parts.month}/${parts.year}`,time:`${parts.hour}:${parts.minute} ${parts.dayPeriod||''}`.trim()};
}
export function templateParams(kind,row){
 const {date,time}=localDateTime(row.starts_at,row.time_zone);
 switch(kind){
  case 'confirmation': return [row.customer_name,row.shop_name,date,time,row.barber_name];
  case 'barber_new': return [row.barber_name,row.customer_name,date,time];
  case 'cancellation': return [row.customer_name,row.shop_name];
  case 'reminder': return [row.customer_name,row.barber_name,date,time];
  default: throw Error('Unsupported template');
 }
}
export async function sendWhatsappTemplate(config,{to,kind,params},fetchImpl=fetch){
 const normalized=normalizePhone(to);
 if(!normalized)throw Error('Numero de WhatsApp invalido');
 if(!config.whatsappAccessToken||!config.whatsappPhoneNumberId)throw Error('Credenciales WhatsApp ausentes');
 const body={messaging_product:'whatsapp',to:normalized,type:'template',template:{
  name:TEMPLATES[kind],language:{code:config.whatsappLanguage||'es'},
  components:[{type:'body',parameters:params.map(value=>({type:'text',text:String(value)}))}]
 }};
 const endpoint=`https://graph.facebook.com/${config.whatsappGraphVersion}/${encodeURIComponent(config.whatsappPhoneNumberId)}/messages`;
 const response=await fetchImpl(endpoint,{method:'POST',headers:{Authorization:`Bearer ${config.whatsappAccessToken}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
 if(!response.ok){
  const error=new Error(`Meta WhatsApp HTTP ${response.status}`);error.status=response.status;throw error;
 }
 const data=await response.json();
 if(!data.messages?.[0]?.id)throw Error('Meta no devolvio identificador de mensaje');
 return data.messages[0].id;
}
// Durable queue, no external HTTP during booking transaction. SELECT FOR UPDATE
// serializes workers. Ambiguous network failure can still cause a retry/duplicate.
export async function deliverWhatsappBatch(db,config,fetchImpl=fetch){
 if(!config.whatsappSendEnabled)return 0;
 if(!config.whatsappAccessToken||!config.whatsappPhoneNumberId)throw Error('WhatsApp habilitado sin credenciales');
 return db.transaction(async tx=>{
  const {rows}=await tx.query(`SELECT w.id,w.kind,a.starts_at,a.status AS appointment_status,a.customer_name,a.customer_phone,
   a.whatsapp_opt_in,t.name AS shop_name,t.time_zone,b.name AS barber_name,b.whatsapp_phone,b.whatsapp_opt_in AS barber_opt_in
   FROM public.whatsapp_deliveries w
   JOIN public.appointments a ON a.id=w.appointment_id AND a.tenant_id=w.tenant_id
   JOIN public.tenants t ON t.id=w.tenant_id
   JOIN public.barbers b ON b.id=a.barber_id AND b.tenant_id=a.tenant_id
   WHERE w.status='pending' AND w.next_attempt_at<=now() AND w.due_at<=now()
   ORDER BY w.due_at,w.id LIMIT 10 FOR UPDATE OF w SKIP LOCKED`);
  for(const row of rows){
   const current=['pending','confirmed'].includes(row.appointment_status);
   const valid=(row.kind==='cancellation' ? row.appointment_status==='no_show'&&row.whatsapp_opt_in :
    row.kind==='barber_new' ? current&&row.barber_opt_in :
    current&&row.whatsapp_opt_in) &&
    (row.kind!=='reminder'||new Date(row.starts_at).getTime()>Date.now());
   const recipient=row.kind==='barber_new'?row.whatsapp_phone:row.customer_phone;
   if(!valid||!normalizePhone(recipient)){
    await tx.query("UPDATE public.whatsapp_deliveries SET status='skipped',last_error='Not eligible or missing phone' WHERE id=$1",[row.id]);
    continue;
   }
   try{
    const messageId=await sendWhatsappTemplate(config,{to:recipient,kind:row.kind,params:templateParams(row.kind,row)},fetchImpl);
    await tx.query("UPDATE public.whatsapp_deliveries SET status='sent',sent_at=now(),meta_message_id=$2,attempts=attempts+1,last_error=NULL WHERE id=$1",[row.id,messageId]);
   }catch(error){
    const permanent=error.status>=400&&error.status<500&&error.status!==429;
    await tx.query(`UPDATE public.whatsapp_deliveries SET attempts=attempts+1,
       status=CASE WHEN $2::boolean OR attempts>=5 THEN 'failed' ELSE 'pending' END,
       next_attempt_at=now()+((LEAST(3600,POWER(2,attempts)::int*30))*interval '1 second'),
       last_error=$3 WHERE id=$1`,[row.id,Boolean(permanent),String(error.message).slice(0,180)]);
   }
  }
  return rows.length;
 });
}
