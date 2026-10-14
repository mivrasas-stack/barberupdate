import {createHmac,timingSafeEqual} from 'node:crypto';

export const TEMPLATE_KINDS=Object.freeze(['confirmation','reminder','rescheduled','cancelled']);
const namePattern=/^[a-z][a-z0-9_]{0,511}$/;
const graphVersionPattern=/^v[0-9]{1,2}\.[0-9]$/;
const phoneIdPattern=/^[0-9]{5,25}$/;

export function normalizeWhatsAppPhone(phone){
  if(typeof phone!=='string')throw new TypeError('Invalid WhatsApp phone number');
  if(/[\r\n\0]/.test(phone))throw new TypeError('Invalid multiline WhatsApp phone number');
  const number=phone.trim().replace(/[\s()\-.]/g,'');
  if(!/^\+?[1-9][0-9]{7,14}$/.test(number))throw new TypeError('WhatsApp requires an international phone number');
  return number.replace(/^\+/,'');
}

export function validateTemplateName(name){
  if(typeof name!=='string'||!namePattern.test(name))throw new TypeError('Invalid approved template name');
  return name;
}

export function createTemplateMessage({to,name,language='es_CO',parameters=[]}){
  if(!/^[a-z]{2,3}_[A-Z]{2}$/.test(language))throw new TypeError('Invalid template language');
  if(!Array.isArray(parameters)||parameters.length>10||parameters.some(x=>typeof x!=='string'||x.length>1024||!x.trim())){
    throw new TypeError('Invalid template parameters');
  }
  return {
    messaging_product:'whatsapp',
    recipient_type:'individual',
    to:normalizeWhatsAppPhone(to),
    type:'template',
    template:{
      name:validateTemplateName(name),
      language:{code:language},
      components:parameters.length?[{type:'body',parameters:parameters.map(text=>({type:'text',text}))}]:[],
    },
  };
}

export function verifyWhatsAppSignature({appSecret,rawBody,signature}){
  if(typeof appSecret!=='string'||!appSecret||typeof signature!=='string'||!/^sha256=[a-f0-9]{64}$/i.test(signature))return false;
  if(!Buffer.isBuffer(rawBody))return false;
  const given=Buffer.from(signature.slice(7),'hex');
  const expected=createHmac('sha256',appSecret).update(rawBody).digest();
  return given.length===expected.length&&timingSafeEqual(given,expected);
}

// Intentionally never log request/response bodies or token; Meta responses can contain customer PII.
export async function sendWhatsAppTemplate({accessToken,phoneNumberId,graphVersion='v23.0',message,fetcher=fetch,timeoutMs=12000}){
  if(typeof accessToken!=='string'||!accessToken||/[\r\n]/.test(accessToken))throw new TypeError('Missing server-side WhatsApp access token');
  if(!phoneIdPattern.test(String(phoneNumberId)))throw new TypeError('Invalid WhatsApp phone number ID');
  if(!graphVersionPattern.test(graphVersion))throw new TypeError('Invalid WhatsApp Graph API version');
  if(!message||message.type!=='template')throw new TypeError('Only approved WhatsApp templates may be sent');
  // Revalidate the payload; callers may not bypass constraints with arbitrary URLs/types.
  const validated=createTemplateMessage({
    to:message.to,name:message.template?.name,language:message.template?.language?.code,
    parameters:(message.template?.components||[]).flatMap(x=>(x.parameters||[]).map(p=>p.text)),
  });
  const response=await fetcher('https://graph.facebook.com/'+graphVersion+'/'+phoneNumberId+'/messages',{
    method:'POST',
    headers:{authorization:'Bearer '+accessToken,'content-type':'application/json'},
    body:JSON.stringify(validated),
    signal:AbortSignal.timeout(Math.min(30000,Math.max(1000,timeoutMs))),
  });
  if(!response.ok){
    const error=new Error('WhatsApp Cloud API rejected template request');
    error.status=response.status;
    error.retryable=response.status===429||response.status>=500;
    throw error;
  }
  const body=await response.json();
  const messageId=body?.messages?.[0]?.id;
  if(typeof messageId!=='string'||!messageId.startsWith('wamid.'))throw new Error('WhatsApp accepted request without valid message ID');
  return {messageId};
}

export function isWhatsAppDeliveryAllowed({tenantEnabled,consentAt,revokedAt,templateName,appointmentStatus}){
  return tenantEnabled===true&&Boolean(consentAt)&&!revokedAt&&
    typeof templateName==='string'&&namePattern.test(templateName)&&
    ['pending','confirmed'].includes(appointmentStatus);
}
