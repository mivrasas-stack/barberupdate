import React,{useEffect,useState} from 'react';
import {backendRequest} from '../../services/liveBackend';

type Kind='created'|'reminder'|'rescheduled'|'cancelled';
type Spec={name:string;params:string[]};
type State={enabled:boolean;language_code:string;reminder_hours:number;templates:Partial<Record<Kind,Spec>>};
const kinds:Kind[]=['created','reminder','rescheduled','cancelled'];
const labels:Record<Kind,string>={
  created:'Nueva reserva',reminder:'Recordatorio previo',
  rescheduled:'Reprogramación',cancelled:'Cancelación',
};
const allowed=['customer_name','business_name','barber_name','service_name','date','time'];
const defaultParameters='customer_name,business_name,date,time';

export function BarberiaWhatsapp({tenant,addToast}:{tenant:string;addToast:(message:string,type:'success'|'error'|'info')=>void}){
  const [loaded,setLoaded]=useState(false);
  const [saving,setSaving]=useState(false);
  const [enabled,setEnabled]=useState(false);
  const [languageCode,setLanguageCode]=useState('es_CO');
  const [reminderHours,setReminderHours]=useState<number|null>(null);
  const [names,setNames]=useState<Record<Kind,string>>({created:'',reminder:'',rescheduled:'',cancelled:''});
  const [parameters,setParameters]=useState<Record<Kind,string>>({
    created:defaultParameters,reminder:defaultParameters,rescheduled:defaultParameters,cancelled:defaultParameters,
  });
  useEffect(()=>{
    let active=true;
    setLoaded(false);
    backendRequest<State>('/tenants/'+tenant+'/whatsapp/settings')
      .then(value=>{
        if(!active)return;
        setEnabled(value.enabled);
        setLanguageCode(value.language_code);
        setReminderHours(value.reminder_hours);
        setNames({created:value.templates.created?.name||'',reminder:value.templates.reminder?.name||'',
          rescheduled:value.templates.rescheduled?.name||'',cancelled:value.templates.cancelled?.name||''});
        setParameters(Object.fromEntries(kinds.map(kind=>[kind,
          (value.templates[kind]?.params||defaultParameters.split(',')).join(',')])) as Record<Kind,string>);
      })
      .catch(()=>{if(active)addToast('No fue posible cargar las plantillas de WhatsApp','error')})
      .finally(()=>{if(active)setLoaded(true)});
    return()=>{active=false};
  },[tenant]);
  const save=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(saving)return;
    if(reminderHours===null||reminderHours<1||reminderHours>168||!Number.isInteger(reminderHours)){
      addToast('Indica entre 1 y 168 horas para el recordatorio','error');return;
    }
    const templates:Partial<Record<Kind,Spec>>={};
    for(const kind of kinds){
      const name=names[kind].trim();
      if(!name)continue;
      if(!/^[a-z][a-z0-9_]{0,511}$/.test(name)){
        addToast('Usa los nombres exactos aprobados por Meta, en minúsculas y guiones bajos','error');return;
      }
      const params=parameters[kind].split(',').map(x=>x.trim()).filter(Boolean);
      if(params.length>10||params.some(x=>!allowed.includes(x))){
        addToast('Parámetros permitidos: '+allowed.join(', '),'error');return;
      }
      templates[kind]={name,params};
    }
    setSaving(true);
    try{
      await backendRequest('/tenants/'+tenant+'/whatsapp/settings',{
        method:'PUT',body:JSON.stringify({enabled,languageCode,reminderHours,templates})
      });
      addToast('Configuración de plantillas de WhatsApp guardada','success');
    }catch(error){addToast(error instanceof Error?error.message:'Error al guardar plantillas','error')}
    finally{setSaving(false)}
  };
  return <form onSubmit={e=>void save(e)} className="rounded-2xl border border-neutral-700 bg-[#141414] p-5 space-y-4">
    <div>
      <h2 className="text-sm font-bold text-white">Avisos automáticos por WhatsApp Cloud API</h2>
      <p className="text-xs text-neutral-400 mt-1">Las plantillas deben existir y estar aprobadas en Meta. Los avisos solo se envían a clientes que autorizaron WhatsApp. Inicialmente desactivado.</p>
    </div>
    <label className="flex items-center gap-2 text-xs text-neutral-300">
      <input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)} className="accent-emerald-500"/>
      Activar avisos para esta barbería
    </label>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label className="text-xs text-neutral-400 space-y-1">Idioma aprobado en Meta
        <input value={languageCode} onChange={e=>setLanguageCode(e.target.value)} placeholder="es_CO" maxLength={6}
          className="w-full bg-[#181818] border border-neutral-700 rounded-lg p-2 text-white"/>
      </label>
      <label className="text-xs text-neutral-400 space-y-1">Anticipación del recordatorio (horas)
        <input type="number" min={1} max={168} placeholder="0" value={reminderHours??''} onChange={e=>setReminderHours(e.target.value===''?null:Number(e.target.value))}
          className="w-full bg-[#181818] border border-neutral-700 rounded-lg p-2 text-white"/>
      </label>
    </div>
    <p className="text-xs text-neutral-500">Marcadores disponibles: {allowed.join(', ')}. Deben coincidir en número y orden con cada plantilla aprobada.</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {kinds.map(kind=><div key={kind} className="rounded-xl bg-[#181818] border border-neutral-800 p-3 space-y-2">
        <label className="text-xs text-neutral-300 block">{labels[kind]}
          <input value={names[kind]} onChange={e=>setNames(cur=>({...cur,[kind]:e.target.value}))}
            placeholder="Nombre exacto de plantilla aprobada" className="mt-1 block w-full p-2 bg-[#101010] border border-neutral-700 rounded-lg text-white" />
        </label>
        <label className="text-[11px] text-neutral-400 block">Parámetros, separados por comas
          <input value={parameters[kind]} onChange={e=>setParameters(cur=>({...cur,[kind]:e.target.value}))}
            className="mt-1 block w-full p-2 bg-[#101010] border border-neutral-700 rounded-lg text-white" />
        </label>
      </div>)}
    </div>
    <button type="submit" disabled={!loaded||saving} className="bg-[var(--gold-primary)] text-black font-bold px-4 py-2 rounded-xl text-xs disabled:opacity-50">
      {saving?'Guardando...':'Guardar plantillas'}
    </button>
  </form>;
}
