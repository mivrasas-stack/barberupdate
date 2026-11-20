import React,{useEffect,useState} from 'react';
import {CalendarDays,Pencil,Plus,Trash2,X} from 'lucide-react';
import {backendRequest} from '../../services/liveBackend';

export type BookingBlackout={id:string;from:string;to:string;reason:string};
type Draft={key:number;from:string;to:string};
export function bookingToday(){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const get=(name:string)=>parts.find(part=>part.type===name)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
const maxDate=(today:string)=>new Date(Date.parse(today+'T00:00:00Z')+366*86400000).toISOString().slice(0,10);
const field='w-full min-h-12 rounded-xl border border-white/15 bg-[#212124] px-3 py-2 text-sm text-white [color-scheme:dark] focus:border-[var(--gold-primary)] outline-none';

export const BookingClosureDialog:React.FC<{
  tenantId:string;onClose:()=>void;onSaved:()=>void;
}>=({tenantId,onClose,onSaved})=>{
  const [saved,setSaved]=useState<BookingBlackout[]>([]);
  const [drafts,setDrafts]=useState<Draft[]>([]);
  const [editing,setEditing]=useState<BookingBlackout|null>(null);
  const [editFrom,setEditFrom]=useState('');
  const [editTo,setEditTo]=useState('');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const today=bookingToday();
  const latest=maxDate(today);
  const reload=async()=>{
    const result=await backendRequest<BookingBlackout[]>('/tenants/'+encodeURIComponent(tenantId)+'/booking-blackouts');
    setSaved(result);
  };
  useEffect(()=>{
    let active=true;
    void backendRequest<BookingBlackout[]>('/tenants/'+encodeURIComponent(tenantId)+'/booking-blackouts')
      .then(result=>{if(active)setSaved(result);})
      .catch(err=>{if(active)setError(err instanceof Error?err.message:'No se pudieron consultar cierres.');})
      .finally(()=>{if(active)setLoading(false);});
    const keydown=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};
    window.addEventListener('keydown',keydown);
    return()=>{active=false;window.removeEventListener('keydown',keydown);};
  },[tenantId]);
  const add=()=>setDrafts(rows=>[...rows,{key:Date.now()+Math.random(),from:today,to:today}]);
  const update=(key:number,patch:Partial<Draft>)=>setDrafts(rows=>rows.map(row=>row.key===key?{...row,...patch}:row));
  const save=async()=>{
    setError('');
    if(!drafts.length){setError('Agrega al menos un período.');return;}
    const periods=drafts.map(({from,to})=>({from,to}));
    if(periods.some(p=>!p.from||!p.to||p.from<today||p.to<p.from||p.to>latest)){
      setError('Revisa las fechas: no deben estar en el pasado y el último día debe ser posterior o igual al primero.');return;
    }
    const sorted=[...periods].sort((a,b)=>a.from.localeCompare(b.from));
    if(sorted.some((p,i)=>i>0&&sorted[i-1].to>=p.from)||
      sorted.some(p=>saved.some(s=>p.from<=s.to&&p.to>=s.from))){
      setError('Hay períodos superpuestos. Ajusta las fechas antes de guardar.');return;
    }
    setBusy(true);
    try{
      await backendRequest('/tenants/'+encodeURIComponent(tenantId)+'/booking-blackouts',{
        method:'POST',body:JSON.stringify({periods:sorted})
      });
      await reload();setDrafts([]);onSaved();
    }catch(err){setError(err instanceof Error?err.message:'No se pudieron guardar los cierres.');}
    finally{setBusy(false);}
  };
  const beginEdit=(period:BookingBlackout)=>{
    setEditing(period);setEditFrom(period.from);setEditTo(period.to);setError('');
  };
  const saveEdit=async()=>{
    if(!editing||busy)return;
    setError('');
    const keptStartedDate=editing.from<today&&editing.to>=today&&editFrom===editing.from;
    if(!editFrom||!editTo||(!keptStartedDate&&editFrom<today)||editTo<today||
      editTo<editFrom||editTo>latest){
      setError('Revisa las fechas del cierre. Puedes extender un cierre activo sin cambiar su fecha de inicio original.');return;
    }
    if(saved.some(period=>period.id!==editing.id&&editFrom<=period.to&&editTo>=period.from)){
      setError('Las fechas se superponen con otro cierre programado.');return;
    }
    setBusy(true);
    try{
      await backendRequest('/tenants/'+encodeURIComponent(tenantId)+'/booking-blackouts/'+encodeURIComponent(editing.id),{
        method:'PATCH',body:JSON.stringify({from:editFrom,to:editTo})
      });
      await reload();setEditing(null);onSaved();
    }catch(err){setError(err instanceof Error?err.message:'No se pudo modificar el cierre.');}
    finally{setBusy(false);}
  };
  const remove=async(id:string)=>{
    setError('');setBusy(true);
    try{
      await backendRequest('/tenants/'+encodeURIComponent(tenantId)+'/booking-blackouts/'+encodeURIComponent(id),{method:'DELETE'});
      await reload();if(editing?.id===id)setEditing(null);onSaved();
    }catch(err){setError(err instanceof Error?err.message:'No se pudo quitar el cierre.');}
    finally{setBusy(false);}
  };
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3 sm:p-6" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div role="dialog" aria-modal="true" aria-labelledby="booking-closure-title" className="w-full max-w-xl max-h-[92dvh] overflow-y-auto rounded-3xl border border-[#45403a] bg-[#151517] p-4 sm:p-6 shadow-2xl space-y-5">
      <div className="flex justify-between items-start gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-[var(--gold-primary)]/15 p-2.5 text-[var(--gold-primary)]"><CalendarDays className="w-5 h-5"/></div>
          <div>
            <h2 id="booking-closure-title" className="text-lg font-bold text-white">Programar cierre de reservas</h2>
            <p className="mt-1 text-xs leading-relaxed text-neutral-400">Elige los días en que no aceptarás nuevas reservas. Al finalizar cada período, se habilitan solos los horarios habituales.</p>
          </div>
        </div>
        <button type="button" aria-label="Cerrar ventana" onClick={onClose} className="shrink-0 rounded-xl p-2 text-neutral-400 hover:bg-white/10"><X className="w-5 h-5"/></button>
      </div>
      <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-3 text-xs leading-relaxed text-amber-100">
        La fecha «Hasta» es el <strong>último día sin nuevas reservas</strong>. Se reabren al día siguiente. Las citas ya agendadas y los horarios semanales no cambian.
      </div>
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-white">Cierres programados</h3>
        {loading?<p className="text-xs text-neutral-400">Consultando cierres...</p>:saved.length===0?<p className="text-xs text-neutral-400">No tienes cierres programados.</p>:
          saved.map(period=><div key={period.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#333338] bg-[#202024] px-3 py-3">
            <div className="min-w-0"><p className="text-sm font-medium text-white">{period.from===period.to?period.from:period.from+' al '+period.to}</p><p className="text-[11px] text-neutral-400">Reservas reabiertas automáticamente al terminar</p></div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" disabled={busy||period.to<today} onClick={()=>beginEdit(period)} aria-label={'Editar cierre '+period.from} className="flex min-h-10 items-center gap-1 rounded-lg border border-[var(--gold-primary)]/40 px-2.5 text-xs font-semibold text-[var(--gold-primary)] disabled:opacity-40"><Pencil className="w-3.5 h-3.5"/> Editar</button>
              <button type="button" disabled={busy} onClick={()=>void remove(period.id)} aria-label={'Quitar cierre '+period.from} className="shrink-0 rounded-lg border border-red-400/30 px-2.5 py-2 text-xs text-red-300 disabled:opacity-50"><Trash2 className="w-4 h-4"/></button>
            </div>
          </div>)}
      </div>
      {editing&&<div className="space-y-3 rounded-2xl border border-[var(--gold-primary)]/50 bg-[#201e1a] p-4">
        <h3 className="text-sm font-bold text-white">Editar cierre programado</h3>
        <p className="text-xs leading-relaxed text-neutral-400">Modifica el inicio o prolonga la fecha final. Se conserva el mismo cierre y las citas existentes.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block text-xs text-neutral-300">Desde
            <input type="date" aria-label="Editar fecha desde" value={editFrom}
              min={editing.from<today&&editing.to>=today?editing.from:today} max={latest}
              onChange={e=>{setEditFrom(e.target.value);if(e.target.value>editTo)setEditTo(e.target.value);}}
              className={field}/>
          </label>
          <label className="block text-xs text-neutral-300">Hasta (último día cerrado)
            <input type="date" aria-label="Editar fecha hasta" value={editTo}
              min={editFrom>today?editFrom:today} max={latest} onChange={e=>setEditTo(e.target.value)} className={field}/>
          </label>
        </div>
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
          <button type="button" disabled={busy} onClick={()=>{setEditing(null);setError('');}} className="min-h-11 rounded-xl border border-white/15 px-4 text-xs font-semibold text-neutral-200">Cancelar edición</button>
          <button type="button" disabled={busy} onClick={()=>void saveEdit()} className="min-h-11 rounded-xl bg-[var(--gold-primary)] px-4 text-xs font-bold text-black disabled:opacity-40">{busy?'Guardando...':'Guardar cambios'}</button>
        </div>
      </div>}
      <div className="space-y-3 border-t border-[#323237] pt-4">
        <h3 className="text-sm font-semibold text-white">Agregar período</h3>
        {drafts.map((period,i)=><div key={period.key} className="rounded-2xl border border-[#333338] bg-[#1d1d20] p-3 space-y-3">
          <div className="flex justify-between items-center"><p className="text-xs font-semibold text-neutral-200">Período {i+1}</p><button type="button" aria-label={'Quitar período '+(i+1)} onClick={()=>setDrafts(v=>v.filter(d=>d.key!==period.key))} className="text-xs text-red-300">Quitar</button></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs text-neutral-300">Desde<input aria-label={'Desde período '+(i+1)} type="date" min={today} max={latest} value={period.from} onChange={e=>update(period.key,{from:e.target.value,to:e.target.value>period.to?e.target.value:period.to})} className={field}/></label>
            <label className="block text-xs text-neutral-300">Hasta (inclusive)<input aria-label={'Hasta período '+(i+1)} type="date" min={period.from||today} max={latest} value={period.to} onChange={e=>update(period.key,{to:e.target.value})} className={field}/></label>
          </div>
        </div>)}
        <button type="button" disabled={busy||drafts.length>=10} onClick={add} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--gold-primary)]/70 text-sm font-semibold text-[var(--gold-primary)] disabled:opacity-40"><Plus className="w-4 h-4"/> Agregar otro día o período</button>
      </div>
      {error&&<p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-3 text-xs text-red-200">{error}</p>}
      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 border-t border-[#333338] pt-4">
        <button type="button" onClick={onClose} className="min-h-12 rounded-xl border border-white/15 px-5 text-sm text-neutral-200">Cerrar</button>
        <button type="button" disabled={busy||loading||!drafts.length} onClick={()=>void save()} className="min-h-12 rounded-xl bg-[var(--gold-primary)] px-5 text-sm font-bold text-black disabled:opacity-40">{busy?'Guardando...':'Guardar cierres'}</button>
      </div>
    </div>
  </div>;
};