import {createHmac,timingSafeEqual} from 'node:crypto';

export const TEMPLATE_KINDS=Object.freeze(['created','reminder','rescheduled','cancelled']);
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

export function createTemplateMessage({to,name,language='es_CO',parameters=[],headerText=null}){
  if(!/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(language))throw new TypeError('Invalid template language');
  if(!Array.isArray(parameters)||parameters.length>10||parameters.some(x=>typeof x!=='string'||x.length>1024||!x.trim())){
    throw new TypeError('Invalid template parameters');
  }
  if(headerText!==null&&(typeof headerText!=='string'||!headerText.trim()||headerText.length>60))
    throw new TypeError('Invalid WhatsApp template header text');
  const components=[];
  if(headerText!==null)components.push({type:'header',parameters:[{type:'text',text:headerText}]});
  if(parameters.length)components.push({type:'body',parameters:parameters.map(text=>({type:'text',text}))});
  return {
    messaging_product:'whatsapp',
    recipient_type:'individual',
    to:normalizeWhatsAppPhone(to),
    type:'template',
    template:{
      name:validateTemplateName(name),
      language:{code:language},
      components,
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
  const components=message.template?.components||[];
  if(!Array.isArray(components)||components.some(x=>!['header','body'].includes(x.type))||
     components.filter(x=>x.type==='header').length>1||components.filter(x=>x.type==='body').length>1)
    throw new TypeError('Unexpected WhatsApp template components');
  const header=components.find(x=>x.type==='header');
  if(header&&(!Array.isArray(header.parameters)||header.parameters.length!==1||header.parameters[0]?.type!=='text'))
    throw new TypeError('Invalid WhatsApp template header');
  const body=components.find(x=>x.type==='body');
  if(body&&(!Array.isArray(body.parameters)||body.parameters.some(p=>p.type!=='text')))
    throw new TypeError('Invalid WhatsApp template body');
  const validated=createTemplateMessage({
    to:message.to,name:message.template?.name,language:message.template?.language?.code,
    headerText:header?.parameters[0].text??null,
    parameters:(body?.parameters||[]).map(p=>p.text),
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
    error.retryable=response.status===429;
    error.ambiguous=response.status>=500;
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
