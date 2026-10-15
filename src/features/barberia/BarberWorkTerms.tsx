import React,{useEffect,useState} from 'react';
import type {Barber} from '../../types';
import {CopAmountInput} from '../../components/common/CopAmountInput';
import {backendRequest,refreshLiveData} from '../../services/liveBackend';
import {formatCurrency} from '../../utils/formatters';
import {Check,X} from 'lucide-react';

type Mode='commission'|'chair_rental'|'hybrid';
type Period='daily'|'weekly'|'biweekly'|'monthly';
type Props={
  tenant:string;
  barber:Barber;
  onClose:()=>void;
  onSaved:()=>void;
  addToast:(message:string,type:'success'|'error'|'info')=>void;
};
const periods:{value:Period;label:string}[]=[
  {value:'daily',label:'Diario'},{value:'weekly',label:'Semanal'},
  {value:'biweekly',label:'Quincenal'},{value:'monthly',label:'Mensual'}
];
const modes:{value:Mode;label:string;description:string}[]=[
 {value:'commission',label:'Comisión %',description:'Porcentaje sobre el valor del servicio'},
 {value:'chair_rental',label:'Arriendo de silla',description:'Cuota fija por un período; el barbero conserva sus cortes'},
 {value:'hybrid',label:'Híbrido',description:'Cuota periódica más porcentaje por servicio'}
];
export function BarberWorkTerms({tenant,barber,onClose,onSaved,addToast}:Props){
 const [mode,setMode]=useState<Mode>(barber.contractType||'commission');
 const [commission,setCommission]=useState(Math.round(barber.commissionRate*100));
 const [fee,setFee]=useState<number|null>(barber.chairRentalFee||null);
 const [period,setPeriod]=useState<Period>(barber.chairRentalPeriod||'monthly');
 const [status,setStatus]=useState<'active'|'inactive'>(barber.status);
 const [saving,setSaving]=useState(false);
 useEffect(()=>{
  setMode(barber.contractType||'commission');
  setCommission(Math.round(barber.commissionRate*100));
  setFee(barber.chairRentalFee||null);
  setPeriod(barber.chairRentalPeriod||'monthly');
  setStatus(barber.status);
 },[barber.id]);
 const save=async()=>{
  if(saving)return;
  const rent=mode==='commission'?0:fee;
  const rate=mode==='chair_rental'?0:commission;
  if(!Number.isInteger(rate)||rate<0||rate>100||
     (mode!=='commission'&&(rent===null||rent<=0))||
     (mode==='hybrid'&&rate<=0)){
    addToast('Revisa el porcentaje y el arriendo antes de guardar','error');
    return;
  }
  setSaving(true);
  try{
   await backendRequest('/tenants/'+tenant+'/barbers/'+barber.id+'/contract',{
    method:'PATCH',
    body:JSON.stringify({contractType:mode,commissionRate:rate/100,
      chairRentalFee:rent||0,chairRentalPeriod:period,status})
   });
   await refreshLiveData();
   addToast('Condiciones de trabajo actualizadas','success');
   onSaved();
  }catch(e){addToast(e instanceof Error?e.message:'No fue posible guardar las condiciones','error');}
  finally{setSaving(false);}
 };
 return <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
  <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl bg-[#141414] border border-[#292929] p-6 shadow-2xl text-white space-y-6">
   <div className="flex items-center justify-between gap-4">
    <div><div className="text-lg font-extrabold">{barber.name}</div><p className="text-xs text-neutral-400">Modalidad de trabajo y condiciones económicas</p></div>
    <button type="button" aria-label="Cerrar" onClick={onClose}><X className="w-5 h-5 text-neutral-400"/></button>
   </div>
   <div>
    <h3 className="text-sm font-bold mb-3">Modalidad de Trabajo y Liquidación</h3>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
     {modes.map(item=><button key={item.value} type="button" onClick={()=>setMode(item.value)}
       aria-pressed={mode===item.value}
       className={'text-left rounded-2xl border p-4 space-y-2 '+(mode===item.value?'border-amber-400 bg-amber-400/10':'border-neutral-800 bg-[#181818]')}>
      <div className="flex justify-between text-sm font-bold"><span>{item.label}</span>{mode===item.value&&<Check className="w-4 h-4 text-amber-400"/>}</div>
      <div className="text-xs text-neutral-400">{item.description}</div>
     </button>)}
    </div>
   </div>
   <div className="rounded-2xl border border-neutral-800 bg-[#191919] p-5 space-y-5">
    {mode!=='chair_rental'&&<div className="space-y-3">
     <div className="flex justify-between items-center text-xs gap-2">
       <span className="text-neutral-300">Porcentaje de comisión del barbero</span>
       <span className="text-emerald-400 font-bold">{commission}% Barbero / {100-commission}% Barbería</span>
     </div>
     <input type="range" min={0} max={100} step={1} value={commission}
       aria-label="Porcentaje de comisión" onChange={e=>setCommission(Number(e.target.value))}
       className="w-full accent-amber-400"/>
    </div>}
    {mode!=='commission'&&<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
     <div><label className="text-xs text-neutral-400 block mb-2">Cuota de arriendo (COP)</label>
       <CopAmountInput value={fee} onChange={setFee} required
         ariaLabel="Cuota de arriendo de silla en COP"
         className="bg-[#141414] border border-neutral-700 rounded-xl px-3 py-2"/>
     </div>
     <div><label className="text-xs text-neutral-400 block mb-2">Periodicidad del arriendo</label>
       <select value={period} onChange={e=>setPeriod(e.target.value as Period)}
         className="w-full bg-[#141414] border border-neutral-700 rounded-xl px-3 py-2 text-white">
        {periods.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
       </select>
     </div>
    </div>}
    <div className="border-t border-neutral-800 pt-4 flex items-center justify-between gap-4">
     <div><div className="text-sm font-semibold">Estado operativo</div><div className="text-xs text-neutral-400">Controla la asignación de citas al profesional</div></div>
     <select value={status} onChange={e=>setStatus(e.target.value as 'active'|'inactive')}
      className="bg-[#111] border border-neutral-700 rounded-xl px-3 py-2 text-white text-xs">
      <option value="active">Activo y operativo</option><option value="inactive">Inactivo</option>
     </select>
    </div>
   </div>
   <div className="rounded-2xl bg-black border border-neutral-800 p-5 text-sm space-y-2">
    <div className="text-amber-400 font-bold uppercase text-xs">Condiciones financieras pactadas</div>
    {mode==='commission'&&<div>La barbería recibe el {100-commission}% de cada servicio; el barbero recibe el {commission}%.</div>}
    {mode==='chair_rental'&&<div>Cuota de {formatCurrency(fee||0)} COP por período. El profesional conserva el 100% de sus cortes.</div>}
    {mode==='hybrid'&&<div>Cuota de {formatCurrency(fee||0)} COP por período más {100-commission}% del valor del servicio para la barbería.</div>}
    <p className="text-[11px] text-neutral-500">Esta configuración guarda las condiciones del acuerdo; no ejecuta pagos ni liquidaciones automáticamente.</p>
   </div>
   <div className="flex justify-end gap-3 border-t border-neutral-800 pt-4">
    <button type="button" onClick={onClose} disabled={saving} className="bg-neutral-800 rounded-xl px-4 py-2 text-sm">Cancelar</button>
    <button type="button" onClick={()=>void save()} disabled={saving}
     className="bg-amber-400 disabled:opacity-50 rounded-xl px-4 py-2 text-sm font-bold text-black">
     {saving?'Guardando...':'Guardar condiciones de trabajo'}
    </button>
   </div>
  </div>
 </div>;
}
