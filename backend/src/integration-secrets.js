import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';

const specs={
  whatsapp:{secretKeys:['accessToken','appSecret','webhookVerifyToken'],required:['accessToken']},
  email:{secretKeys:['apiKey'],required:['apiKey']},
  openai:{secretKeys:['apiKey'],required:['apiKey']},
};
export const integrationProviders=Object.keys(specs);
export function integrationSpec(provider){
  const spec=specs[provider];
  if(!spec)throw new Error('Unknown provider');
  return spec;
}
export function masterKey(value){
  const raw=Buffer.from(value||'','base64');
  if(raw.length!==32||!value||!/^[-A-Za-z0-9_+/=]+$/.test(value))
    throw new Error('PLATFORM_SECRETS_KEY must be 32 cryptographically random bytes encoded as base64');
  return raw;
}
export function encryptSecret(plaintext,key){
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
  const ciphertext=Buffer.concat([cipher.update(plaintext,'utf8'),cipher.final()]);
  return [iv.toString('base64'),cipher.getAuthTag().toString('base64'),ciphertext.toString('base64')].join('.');
}
export function decryptSecret(value,key){
  const parts=String(value||'').split('.');
  if(parts.length!==3)throw new Error('Invalid encrypted secret');
  const [iv,tag,body]=parts.map(x=>Buffer.from(x,'base64'));
  if(iv.length!==12||tag.length!==16)throw new Error('Invalid encrypted secret');
  const decipher=createDecipheriv('aes-256-gcm',key,iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body),decipher.final()]).toString('utf8');
}
export async function readIntegration(db,provider,keyValue){
  integrationSpec(provider);
  if(!db)return null;
  const result=await db.query('SELECT enabled,settings,secrets,updated_at FROM public.platform_integrations WHERE provider=$1',[provider]);
  if(!result.rowCount)return null;
  const row=result.rows[0],stored=row.secrets||{};
  const key=keyValue?masterKey(keyValue):null;
  const secrets={};
  if(key)for(const name of integrationSpec(provider).secretKeys)if(stored[name])secrets[name]=decryptSecret(stored[name],key);
  return {enabled:row.enabled,settings:row.settings||{},secrets,configured:Object.keys(stored).filter(k=>Boolean(stored[k])),updatedAt:row.updated_at};
}
export function safeIntegrationView(provider,row){
  const spec=integrationSpec(provider),configured=row?.configured||[];
  return {provider,enabled:Boolean(row?.enabled),settings:row?.settings||{},
    credentials:Object.fromEntries(spec.secretKeys.map(k=>[k,configured.includes(k)])),
    ready:spec.required.every(k=>configured.includes(k))&&
      (provider!=='whatsapp'||Boolean(row?.settings?.phoneNumberId)),
    updatedAt:row?.updatedAt||null};
}

/** Resolve server-side runtime WhatsApp credentials, with an explicit platform kill switch.
 * Legacy env configuration remains available until the platform vault is set up.
 * Never return these values to a browser response.
 */
export async function resolveWhatsAppIntegration(db,config){
  if(!db||!config.platformSecretsKey)return config;
  const row=await readIntegration(db,'whatsapp',config.platformSecretsKey);
  if(!row)return config;
  return {...config,
    whatsappSendEnabled:config.whatsappSendEnabled&&row.enabled,
    // Once an admin config exists, never fall back to stale ENV credentials.
    whatsappAccessToken:row.secrets.accessToken||'',
    whatsappAppSecret:row.secrets.appSecret||'',
    whatsappWebhookVerifyToken:row.secrets.webhookVerifyToken||'',
    whatsappPhoneNumberId:row.settings.phoneNumberId||'',
    whatsappBusinessAccountId:row.settings.businessAccountId||'',
    whatsappGraphVersion:row.settings.graphVersion||config.whatsappGraphVersion
  };
}
