export const TEMPLATES=Object.freeze({
 confirmation:'confirmacion_de_reserva',
 barber_new:'nueva_cita_barbero',
 cancellation:'cita_cancelada',
 reminder:'recordatorio_cita_cliente'
});
export function normalizePhone(value){
 const digits=String(value||'').replace(/\D/g,'');
 if(/^3\d{9}$/.test(digits))return '57'+digits;
 if(/^[1-9]\d{10,14}$/.test(digits))return digits;
 return null;
}
export function localDateTime(value,zone='America/Bogota'){
 const pieces=new Intl.DateTimeFormat('es-CO',{timeZone:zone,day:'2-digit',month:'2-digit',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true}).formatToParts(new Date(value));
 const p=Object.fromEntries(pieces.map(x=>[x.type,x.value]));
 return {date:`${p.day}/${p.month}/${p.year}`,time:`${p.hour}:${p.minute} ${p.dayPeriod||''}`.trim()};
}
export function templateParams(kind,a){
 const {date,time}=localDateTime(a.starts_at,a.time_zone);
 switch(kind){
 case 'confirmation':return [a.customer_name,a.shop_name,date,time,a.barber_name];
 case 'barber_new':return [a.barber_name,a.customer_name,date,time];
 case 'cancellation':return [a.customer_name,a.shop_name];
 case 'reminder':return [a.customer_name,a.barber_name,date,time];
 default:throw Error('Plantilla desconocida');
 }
}
export async function sendWhatsappTemplate(config,{to,kind,params},fetchImpl=fetch){
 const recipient=normalizePhone(to);
 if(!recipient)throw Error('Destinatario WhatsApp invalido');
 if(!config.whatsappAccessToken||!config.whatsappPhoneNumberId)throw Error('Configuracion de Meta incompleta');
 if(!Object.hasOwn(TEMPLATES,kind))throw Error('Plantilla desconocida');
 const template={name:TEMPLATES[kind],language:{code:config.whatsappLanguage||'es'}};
 if(params.length)template.components=[{type:'body',parameters:params.map(p=>({type:'text',text:String(p)}))}];
 const res=await fetchImpl(`https://graph.facebook.com/${config.whatsappGraphVersion||'v23.0'}/${encodeURIComponent(config.whatsappPhoneNumberId)}/messages`,{
 method:'POST',
 headers:{'Content-Type':'application/json',Authorization:'Bearer '+config.whatsappAccessToken},
 body:JSON.stringify({messaging_product:'whatsapp',to:recipient,type:'template',template}),
 signal:AbortSignal.timeout(8000)
 });
 if(!res.ok){
  let detail={};try{detail=await res.json()}catch{}
  const code=detail?.error?.code,subcode=detail?.error?.error_subcode;
  const err=new Error(`Meta WhatsApp HTTP ${res.status}${code?' code '+code:''}${subcode?' subcode '+subcode:''}`);
  err.status=res.status;throw err;
 }
 const result=await res.json();
 const messageId=result.messages?.[0]?.id;
 if(!messageId)throw Error('Meta no confirmo recepcion del mensaje');
 return messageId;
}
export async function deliverWhatsappBatch(db,config,fetchImpl=fetch){
 if(!config.whatsappSendEnabled)return 0;
 if(!config.whatsappAccessToken||!config.whatsappPhoneNumberId)throw Error('WhatsApp activo sin credenciales de Meta');
 return db.transaction(async tx=>{
  const {rows}=await tx.query(`SELECT w.id,w.kind,a.starts_at,a.status AS appointment_status,
  a.customer_name,a.customer_phone,a.whatsapp_opt_in,
  t.name AS shop_name,t.time_zone,b.name AS barber_name,b.whatsapp_phone,b.whatsapp_opt_in AS barber_opt_in
  FROM public.whatsapp_deliveries w
  JOIN public.appointments a ON a.id=w.appointment_id AND a.tenant_id=w.tenant_id
  JOIN public.tenants t ON t.id=w.tenant_id
  JOIN public.barbers b ON b.id=a.barber_id AND b.tenant_id=a.tenant_id
  WHERE w.status='pending' AND w.next_attempt_at<=now() AND w.due_at<=now()
  ORDER BY w.due_at,w.id LIMIT 10 FOR UPDATE OF w SKIP LOCKED`);
  for(const row of rows){
   const active=['pending','confirmed'].includes(row.appointment_status);
   const eligible=(row.kind==='cancellation'?row.appointment_status==='no_show'&&row.whatsapp_opt_in:
    row.kind==='barber_new'?active&&row.barber_opt_in:active&&row.whatsapp_opt_in)
    &&(row.kind!=='reminder'||new Date(row.starts_at).getTime()>Date.now());
   const recipient=row.kind==='barber_new'?row.whatsapp_phone:row.customer_phone;
   if(!eligible||!normalizePhone(recipient)){
    await tx.query("UPDATE public.whatsapp_deliveries SET status='skipped',last_error='Sin consentimiento, telefono o estado valido' WHERE id=$1",[row.id]);
    continue;
   }
   try{
    const metaId=await sendWhatsappTemplate(config,{to:recipient,kind:row.kind,params:templateParams(row.kind,row)},fetchImpl);
    await tx.query("UPDATE public.whatsapp_deliveries SET status='sent',sent_at=now(),meta_message_id=$2,attempts=attempts+1,last_error=NULL WHERE id=$1",[row.id,metaId]);
   }catch(e){
    const permanent=e.status>=400&&e.status<500&&e.status!==429;
    await tx.query(`UPDATE public.whatsapp_deliveries SET attempts=attempts+1,
    status=CASE WHEN $2::boolean OR attempts>=5 THEN 'failed' ELSE 'pending' END,
    next_attempt_at=now()+((LEAST(3600,POWER(2,attempts)::int*30))*interval '1 second'),
    last_error=$3 WHERE id=$1`,[row.id,Boolean(permanent),String(e.message).slice(0,180)]);
    console.warn('WhatsApp dispatch failed:',e.message);
   }
  }
  return rows.length;
 });
}
