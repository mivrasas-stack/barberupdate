import React,{useEffect,useState} from 'react';
import {Bot,Mail,MessageCircle,KeyRound,Save,ShieldCheck,TestTube2,Eye,EyeOff,Copy} from 'lucide-react';
import {backendRequest,isLiveBackend} from '../../services/liveBackend';

type Provider='whatsapp'|'email'|'openai';
type Integration={provider:Provider;enabled:boolean;ready:boolean;settings:Record<string,string>;credentials:Record<string,boolean>;updatedAt:string|null};
const TYPES:Provider[]=['whatsapp','email','openai'];
const INITIAL:Record<Provider,Integration>={
 whatsapp:{provider:'whatsapp',enabled:false,ready:false,settings:{phoneNumberId:'',graphVersion:'v23.0'},credentials:{},updatedAt:null},
 email:{provider:'email',enabled:false,ready:false,settings:{fromEmail:'',fromName:'Barber Paradise',replyTo:''},credentials:{},updatedAt:null},
 openai:{provider:'openai',enabled:false,ready:false,settings:{model:'gpt-4.1-mini',systemPrompt:''},credentials:{},updatedAt:null}
};
const OPTIONS={
 whatsapp:{title:'WhatsApp Cloud API',description:'Citas, recordatorios y plantillas aprobadas por Meta.',fields:[['phoneNumberId','Phone Number ID'],['graphVersion','Versión Graph API']],keys:[['accessToken','Token permanente'],['appSecret','App Secret'],['webhookVerifyToken','Token de verificación']]},
 email:{title:'Correos · Resend',description:'Mensajes transaccionales con un remitente verificado.',fields:[['fromEmail','Correo remitente'],['fromName','Nombre remitente'],['replyTo','Responder a']],keys:[['apiKey','API Key de Resend']]},
 openai:{title:'OpenAI y bots',description:'Configura tu clave, modelo e instrucciones.',fields:[['model','Modelo'],['systemPrompt','Instrucciones del asistente']],keys:[['apiKey','API Key de OpenAI']]}
} as const;
export const AdminIntegrations:React.FC=()=>{
 const [tab,setTab]=useState<Provider>('whatsapp');
 const [saved,setSaved]=useState<Record<Provider,Integration>>(INITIAL);
 const [inputs,setInputs]=useState<Record<Provider,Record<string,string>>>({whatsapp:{},email:{},openai:{}});
 const [visible,setVisible]=useState<Record<string,boolean>>({});
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(isLiveBackend);
 const [notice,setNotice]=useState<{kind:'ok'|'error'|'info';message:string}|null>(null);
 useEffect(()=>{
   if(!isLiveBackend)return;
   let alive=true;
   backendRequest<Record<Provider,Integration>>('/platform/integrations')
     .then(res=>{if(alive)setSaved(res);})
     .catch(e=>{if(alive)setNotice({kind:'error',message:String(e.message)});})
     .finally(()=>{if(alive)setLoading(false);});
   return ()=>{alive=false;};
 },[]);
 const update=(key:string,value:string)=>setSaved(old=>({...old,[tab]:{...old[tab],settings:{...old[tab].settings,[key]:value}}}));
 const updateSecret=(key:string,value:string)=>setInputs(old=>({...old,[tab]:{...old[tab],[key]:value}}));
 const save=async()=>{
   setNotice(null);setBusy(true);
   try{
     const secrets=Object.fromEntries(Object.entries(inputs[tab]).filter(([,value])=>value.length>0));
     const updated=await backendRequest<Integration>('/platform/integrations/'+tab,{method:'PUT',
       body:JSON.stringify({enabled:saved[tab].enabled,settings:saved[tab].settings,secrets})});
     setSaved(old=>({...old,[tab]:updated}));
     setInputs(old=>({...old,[tab]:{}}));
     setNotice({kind:'ok',message:'Guardado con éxito. Las claves no se mostrarán de nuevo.'});
   }catch(e){setNotice({kind:'error',message:String((e as Error).message)});}
   finally{setBusy(false);}
 };
 const check=async()=>{
   if(Object.values(inputs[tab]).some(Boolean)){setNotice({kind:'info',message:'Guarda primero las claves nuevas.'});return;}
   setNotice(null);setBusy(true);
   try{
     const result=await backendRequest<{ok:boolean;detail:string}>('/platform/integrations/'+tab+'/test',{method:'POST'});
     setNotice({kind:'ok',message:result.detail});
   }catch(e){setNotice({kind:'error',message:String((e as Error).message)});}
   finally{setBusy(false);}
 };
 const generate=()=>{
   const value=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
   updateSecret('webhookVerifyToken',value);
   setVisible(v=>({...v,webhookVerifyToken:true}));
   setNotice({kind:'info',message:'Copia este token y pégalo en Meta. Tras guardarlo no volverá a mostrarse.'});
 };
 const option=OPTIONS[tab],config=saved[tab];
 return <div className="max-w-6xl space-y-6 pb-10">
  <div className="border-b border-neutral-800 pb-5">
   <p className="text-xs font-bold tracking-widest uppercase text-[var(--gold-primary)]">Superadmin / Configuración global</p>
   <h1 className="text-2xl font-extrabold text-white mt-2">Centro de Integraciones</h1>
   <p className="text-neutral-400 text-sm mt-2">Conecta WhatsApp, correos y OpenAI desde un solo panel. Tus credenciales se guardan cifradas en el servidor.</p>
  </div>
  {!isLiveBackend&&<div role="alert" className="p-4 rounded-xl bg-amber-950/30 border border-amber-600/40 text-amber-200 text-sm">El guardado de credenciales solo está disponible con el backend real conectado. El modo demo no almacena claves.</div>}
  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
   {TYPES.map(p=>{
    const Icon=p==='whatsapp'?MessageCircle:p==='email'?Mail:Bot;
    return <button type="button" key={p} onClick={()=>{setTab(p);setNotice(null);}} aria-pressed={tab===p}
      className={'text-left rounded-2xl border p-4 transition-colors '+(tab===p?'bg-[#2b2516] border-[var(--gold-primary)]':'bg-[#141414] border-neutral-800 hover:border-neutral-600')}>
      <Icon className="w-6 h-6 mb-3 text-[var(--gold-primary)]"/>
      <strong className="text-white text-sm block">{OPTIONS[p].title}</strong>
      <p className="text-neutral-400 text-xs leading-relaxed my-2">{OPTIONS[p].description}</p>
      <span className={'text-xs '+(saved[p].ready?'text-emerald-300':'text-neutral-500')}>{saved[p].ready?'● Claves guardadas':'○ Sin configurar'}</span>
    </button>;
   })}
  </div>
  <section className="bg-[#141414] border border-neutral-800 rounded-2xl p-4 sm:p-6 space-y-5">
   <div className="flex flex-wrap justify-between gap-3">
    <div><h2 className="text-white font-bold text-lg">{option.title}</h2><p className="text-xs text-neutral-500 mt-1">{loading?'Cargando...':config.updatedAt?'Actualizado: '+new Date(config.updatedAt).toLocaleString('es-CO'):'Sin guardar'}</p></div>
    <label className="flex items-center gap-2 text-white text-sm"><input type="checkbox" className="accent-amber-400" checked={config.enabled}
      disabled={!isLiveBackend||loading||busy} onChange={e=>setSaved(old=>({...old,[tab]:{...old[tab],enabled:e.target.checked}}))}/> Habilitar proveedor</label>
   </div>
   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    {option.fields.map(([key,label])=><label key={key} className={key==='systemPrompt'?'sm:col-span-2 space-y-2':'space-y-2'}>
     <span className="text-neutral-300 font-semibold text-xs block">{label}</span>
     {key==='systemPrompt'?<textarea rows={3} maxLength={1200} value={config.settings[key]||''} onChange={e=>update(key,e.target.value)}
        disabled={!isLiveBackend||loading||busy} className="w-full rounded-xl bg-[#0d0d0d] border border-neutral-700 text-white p-3 text-sm"/>
     :<input value={config.settings[key]||''} onChange={e=>update(key,e.target.value)}
        disabled={!isLiveBackend||loading||busy} className="w-full rounded-xl bg-[#0d0d0d] border border-neutral-700 text-white p-3 text-sm"/>}
    </label>)}
   </div>
   <div className="border-t border-neutral-800 pt-5">
    <h3 className="flex gap-2 items-center text-white font-semibold text-sm mb-4"><KeyRound className="w-4 h-4 text-[var(--gold-primary)]"/> Credenciales privadas</h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
     {option.keys.map(([key,label])=><div key={key} className="space-y-2">
      <div className="flex justify-between gap-3"><label htmlFor={'integration-'+key} className="text-xs text-neutral-300">{label}</label>
       <span className={config.credentials[key]?'text-emerald-300 text-[10px]':'text-neutral-500 text-[10px]'}>{config.credentials[key]?'Guardada':'Pendiente'}</span></div>
      <div className="flex gap-2">
       <input id={'integration-'+key} type={visible[key]?'text':'password'} autoComplete="new-password"
        placeholder={config.credentials[key]?'Vacío = conservar clave anterior':'Pega aquí tu clave'}
        value={inputs[tab][key]||''} onChange={e=>updateSecret(key,e.target.value)} disabled={!isLiveBackend||loading||busy}
        className="min-w-0 flex-1 rounded-xl bg-[#0d0d0d] border border-neutral-700 text-white p-3 text-sm"/>
       <button type="button" className="rounded-xl px-3 bg-neutral-800 text-white" aria-label={visible[key]?'Ocultar':'Mostrar'}
        onClick={()=>setVisible(v=>({...v,[key]:!v[key]}))}>{visible[key]?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}</button>
       {key==='webhookVerifyToken'&&inputs[tab][key]&&<button type="button" title="Copiar token" className="rounded-xl px-3 bg-neutral-800 text-white" onClick={()=>navigator.clipboard.writeText(inputs[tab][key])}><Copy className="w-4 h-4"/></button>}
      </div>
      {key==='webhookVerifyToken'&&<button type="button" onClick={generate} disabled={!isLiveBackend||busy} className="text-xs text-[var(--gold-primary)] hover:underline">Generar token seguro nuevo</button>}
     </div>)}
    </div>
   </div>
   {tab==='whatsapp'&&<p className="text-xs rounded-xl p-3 border border-neutral-800 bg-neutral-900 text-neutral-400">
    Endpoint webhook: /api/v1/whatsapp/webhook. Configura una URL pública HTTPS estable en Meta. Los envíos requieren plantillas aprobadas, consentimiento y habilitar el interruptor global del servidor.
   </p>}
   {tab==='email'&&<p className="text-xs rounded-xl p-3 border border-neutral-800 bg-neutral-900 text-neutral-400">Primero verifica tu dominio en Resend. La prueba envía un correo real exclusivamente al email de tu cuenta superadmin.</p>}
   {tab==='openai'&&<p className="text-xs rounded-xl p-3 border border-neutral-800 bg-neutral-900 text-neutral-400">Configurar OpenAI prepara las credenciales para futuros bots; no activa respuestas automáticas por sí solo.</p>}
   {notice&&<p role="status" className={'rounded-xl border p-3 text-xs '+(notice.kind==='ok'?'text-emerald-300 border-emerald-700/50':notice.kind==='error'?'text-red-300 border-red-700/50':'text-sky-300 border-sky-700/50')}>{notice.message}</p>}
   <div className="flex flex-wrap items-center gap-3">
    <button type="button" disabled={!isLiveBackend||loading||busy} onClick={save} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--gold-primary)] text-black font-bold text-sm disabled:opacity-40"><Save className="w-4 h-4"/>{busy?'Espera...':'Guardar configuración'}</button>
    <button type="button" disabled={!isLiveBackend||loading||busy||!config.ready} onClick={check} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-neutral-800 text-white font-semibold text-sm disabled:opacity-40"><TestTube2 className="w-4 h-4"/>{tab==='email'?'Enviar correo de prueba':'Probar conexión'}</button>
    <span className="inline-flex items-center gap-2 text-xs text-neutral-500"><ShieldCheck className="w-4 h-4 text-emerald-400"/> Solo Superadmin</span>
   </div>
  </section>
 </div>;
};
