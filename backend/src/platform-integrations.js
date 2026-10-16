import {z} from 'zod';
import {failure,parseOrThrow} from './security.js';
import {decryptSecret,encryptSecret,integrationProviders,integrationSpec,masterKey,readIntegration,safeIntegrationView} from './integration-secrets.js';

const providerSchema=z.enum(['whatsapp','email','openai']);
const settingsSchema={
  whatsapp:z.object({phoneNumberId:z.union([z.literal(''),z.string().regex(/^[0-9]{5,25}$/)]).default(''),
    businessAccountId:z.union([z.literal(''),z.string().regex(/^[0-9]{5,25}$/)]).default(''),
    graphVersion:z.string().regex(/^v[0-9]{1,3}\.[0-9]{1,2}$/).default('v23.0')}).strict(),
  email:z.object({fromEmail:z.union([z.literal(''),z.email().max(254)]).default(''),
    fromName:z.string().max(120).default('Barber Paradise'),
    replyTo:z.union([z.literal(''),z.email().max(254)]).default('')}).strict(),
  openai:z.object({model:z.string().regex(/^[a-zA-Z0-9_.:-]{3,100}$/).default('gpt-4.1-mini'),
    systemPrompt:z.string().max(1200).default('')}).strict()
};
const secretSchema=z.string().min(1).max(8192);
const updateSchema=z.object({enabled:z.boolean(),settings:z.record(z.string(),z.unknown()),
  secrets:z.record(z.string(),secretSchema).default({})}).strict();

async function authorize(db,security,req){
  await security.authenticated(req);await security.limited(req);
  if(!db)failure(503,'Base de datos no configurada');
  const grant=await db.query('SELECT 1 FROM public.platform_admins WHERE user_id=$1',[req.actor.id]);
  if(!grant.rowCount)failure(403,'Solo superadministradores de plataforma');
}
function requireMaster(config){
  try{return masterKey(config.platformSecretsKey);}
  catch{failure(503,'Falta configurar PLATFORM_SECRETS_KEY en el servidor');}
}
function configuredFor(provider,row){
  if(!row)failure(422,'Guarda primero las credenciales');
  const spec=integrationSpec(provider);
  for(const k of spec.required)if(!row.secrets[k])failure(422,'Falta configurar '+k);
  if(provider==='whatsapp'&&!row.settings.phoneNumberId)failure(422,'Falta el Phone Number ID');
  if(provider==='email'&&!row.settings.fromEmail)failure(422,'Falta el remitente verificado');
  if(provider==='openai'&&!row.settings.model)failure(422,'Falta el modelo');
}
async function providerFetch(url,options={}){
  let res;
  try{res=await fetch(url,{...options,signal:AbortSignal.timeout(10000)});}
  catch{failure(422,'El proveedor no respondió. Comprueba conectividad y configuración');}
  if(!res.ok)failure(422,'El proveedor rechazó la prueba (HTTP '+res.status+'). Comprueba credenciales y permisos');
  return res.json().catch(()=>({}));
}
export async function registerPlatformIntegrationRoutes(app,{config,db,security}){
  app.register(async api=>{
    api.addHook('preHandler',req=>authorize(db,security,req));
    api.get('/api/v1/platform/integrations',async()=>{
      const result={};
      for(const p of integrationProviders)result[p]=safeIntegrationView(p,await readIntegration(db,p));
      return result;
    });
    api.put('/api/v1/platform/integrations/:provider',async req=>{
      const provider=parseOrThrow(providerSchema,req.params.provider);
      const x=parseOrThrow(updateSchema,req.body),settings=parseOrThrow(settingsSchema[provider],x.settings);
      const names=integrationSpec(provider).secretKeys;
      for(const key of Object.keys(x.secrets))if(!names.includes(key))failure(400,'Campo de credencial desconocido');
      const key=requireMaster(config);
      return db.transaction(async tx=>{
        const existing=await tx.query('SELECT secrets FROM public.platform_integrations WHERE provider=$1 FOR UPDATE',[provider]);
        const secrets={...(existing.rows[0]?.secrets||{})};
        for(const [name,value] of Object.entries(x.secrets))secrets[name]=encryptSecret(value,key);
        await tx.query(
          'INSERT INTO public.platform_integrations(provider,enabled,settings,secrets,updated_by) VALUES($1,$2,$3::jsonb,$4::jsonb,$5) ON CONFLICT(provider) DO UPDATE SET enabled=EXCLUDED.enabled,settings=EXCLUDED.settings,secrets=EXCLUDED.secrets,updated_by=EXCLUDED.updated_by,updated_at=now()',
          [provider,x.enabled,JSON.stringify(settings),JSON.stringify(secrets),req.actor.id]);
        return safeIntegrationView(provider,{enabled:x.enabled,settings,configured:Object.keys(secrets),updatedAt:new Date().toISOString()});
      });
    });
    api.post('/api/v1/platform/integrations/:provider/test',async req=>{
      const provider=parseOrThrow(providerSchema,req.params.provider),key=requireMaster(config);
      const row=await readIntegration(db,provider,config.platformSecretsKey);
      configuredFor(provider,row);
      if(provider==='whatsapp'){
        const {phoneNumberId,graphVersion}=row.settings;
        const result=await providerFetch('https://graph.facebook.com/'+encodeURIComponent(graphVersion)+'/'+encodeURIComponent(phoneNumberId)+'?fields=id,display_phone_number,verified_name',{
          headers:{Authorization:'Bearer '+row.secrets.accessToken}});
        return {ok:true,detail:'WhatsApp Cloud API respondió. Número: '+String(result.display_phone_number||'verificado')};
      }
      if(provider==='openai'){
        await providerFetch('https://api.openai.com/v1/models/'+encodeURIComponent(row.settings.model),{
          headers:{Authorization:'Bearer '+row.secrets.apiKey}});
        return {ok:true,detail:'OpenAI validó la clave y el modelo. No se generaron respuestas ni cargos por tokens.'};
      }
      // An email test sends only to the authenticated platform admin, never a supplied recipient.
      if(!req.actor.email||!z.email().safeParse(req.actor.email).success)failure(422,'El superadmin necesita un correo verificado');
      await providerFetch('https://api.resend.com/emails',{
        method:'POST',
        headers:{Authorization:'Bearer '+row.secrets.apiKey,'Content-Type':'application/json'},
        body:JSON.stringify({from:row.settings.fromName+' <'+row.settings.fromEmail+'>',
          to:[req.actor.email],reply_to:row.settings.replyTo||undefined,
          subject:'Prueba de correo - Barber Paradise',
          text:'Tu servicio de correo de Barber Paradise responde correctamente.'})
      });
      return {ok:true,detail:'Resend aceptó el correo de prueba para tu cuenta de superadmin. Revisa la bandeja de entrada.'};
    });
  });
}
