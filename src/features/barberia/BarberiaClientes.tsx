import React,{useEffect,useMemo,useState} from 'react';
import {useApp} from '../../context/AppContext';
import {formatCurrency} from '../../utils/formatters';
import {isLiveBackend,listTenantCustomers,type TenantCustomer} from '../../services/liveBackend';
import {Search,UserRound,RefreshCw,Users} from 'lucide-react';

/** One customer per account and tenant, including QR links without appointments. */
export const BarberiaClientes:React.FC=()=>{
 const {currentShop,state,currency}=useApp();
 const shopId=currentShop?.id||'';
 const [search,setSearch]=useState('');
 const [rows,setRows]=useState<TenantCustomer[]>([]);
 const [loading,setLoading]=useState(isLiveBackend);
 const [error,setError]=useState('');
 const [revision,setRevision]=useState(0);
 useEffect(()=>{
  if(!isLiveBackend){setLoading(false);return;}
  if(!shopId){setError('No se encontró la barbería seleccionada');setRows([]);setLoading(false);return;}
  let alive=true;
  setLoading(true);
  setError('');
  listTenantCustomers(shopId).then(result=>{
    if(alive)setRows(result);
  }).catch(err=>{
    if(alive){setRows([]);setError(err instanceof Error?err.message:'No fue posible cargar los clientes');}
  }).finally(()=>{if(alive)setLoading(false);});
  return()=>{alive=false};
 },[shopId,revision]);
 useEffect(()=>{
  if(!isLiveBackend)return;
  const refresh=()=>setRevision(n=>n+1);
  window.addEventListener('focus',refresh);
  return()=>window.removeEventListener('focus',refresh);
 },[]);

 const customers=useMemo(()=>{
  if(isLiveBackend)return rows;
  // Demo mode is explicitly identified and never invents missing contact details or avatars.
  const appts=state.appointments.filter(a=>a.businessId===shopId&&a.customerId);
  const ids=[...new Set(appts.map(a=>a.customerId))];
  return ids.map(id=>{
   const related=appts.filter(a=>a.customerId===id);
   const done=related.filter(a=>a.status==='completed');
   const last=[...done].sort((a,b)=>(b.date+b.startTime).localeCompare(a.date+a.startTime))[0];
   const user=state.users.find(u=>u.id===id);
   return {id,name:user?.name||related[0]?.customerName||'Cliente',
    email:user?.email||'',phone:user?.phone||related[0]?.customerPhone||'',
    avatar:'',linkedByQr:false,linkedAt:null,visits:done.length,
    totalSpent:done.reduce((acc,a)=>acc+a.finalPrice,0),
    lastService:last?.serviceName||null,lastServiceAt:last?.date||null,
    points:0} as TenantCustomer;
  });
 },[rows,shopId,state.appointments,state.users]);

 const filtered=customers.filter(c=>{
  const q=search.trim().toLocaleLowerCase('es-CO');
  return !q||[c.name,c.email,c.phone].some(value=>value.toLocaleLowerCase('es-CO').includes(q));
 });
 const formatDate=(value:string|null)=>{
  if(!value)return '';
  const date=new Date(value.length===10?value+'T12:00:00':value);
  return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('es-CO',{
   timeZone:'America/Bogota',year:'numeric',month:'short',day:'numeric'
  }).format(date):'';
 };

 return <div className="space-y-6">
  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#242424] pb-4">
   <div>
    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">Fidelización & CRM</span>
    <h1 className="text-2xl font-extrabold text-white">Clientes de la Barbería</h1>
    <p className="mt-1 text-xs text-neutral-400">Clientes vinculados por QR y clientes con citas en esta barbería, sin duplicados.</p>
   </div>
   {isLiveBackend&&<button type="button" onClick={()=>setRevision(n=>n+1)} disabled={loading}
    className="flex items-center gap-2 rounded-xl border border-neutral-700 px-4 py-2.5 text-xs text-neutral-200 disabled:opacity-40">
    <RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`}/>Actualizar clientes
   </button>}
  </div>
  {!isLiveBackend&&<p className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300">
    Modo demostración. Los datos de esta vista no corresponden a clientes registrados por QR.</p>}
  <div className="flex items-center justify-between gap-3">
   <div className="relative flex-1">
    <Search className="absolute top-1/2 left-3 w-4 h-4 -translate-y-1/2 text-neutral-500"/>
    <input type="search" value={search} onChange={e=>setSearch(e.target.value)}
     placeholder="Buscar por nombre, correo o teléfono..."
     aria-label="Buscar clientes"
     className="w-full rounded-xl border border-[#262626] bg-[#141414] py-2.5 pl-9 pr-4 text-xs text-white outline-none focus:border-[var(--gold-primary)]"/>
   </div>
   <span className="whitespace-nowrap text-xs text-neutral-400">{filtered.length} clientes</span>
  </div>
  {error&&<p role="alert" className="rounded-xl border border-rose-500/30 p-4 text-xs text-rose-300">{error}</p>}
  {loading&&<p role="status" className="rounded-xl border border-[#262626] bg-[#141414] p-5 text-sm text-neutral-400">Consultando clientes vinculados y su información actual...</p>}
  {!loading&&!error&&filtered.length===0&&<div className="rounded-2xl border border-[#262626] bg-[#141414] p-8 text-center">
   <Users className="w-7 h-7 text-neutral-500 mx-auto mb-3"/>
   <p className="text-sm text-white font-semibold">{search?'No hay coincidencias':'Todavía no hay clientes registrados'}</p>
   <p className="mt-1 text-xs text-neutral-400">{search?'Prueba otro nombre o teléfono.':'Los clientes aparecerán al vincularse mediante QR o reservar en esta barbería.'}</p>
  </div>}
  {!loading&&!error&&filtered.length>0&&<div className="overflow-hidden rounded-2xl border border-[#262626] bg-[#141414] shadow-xl">
   <div className="overflow-x-auto">
    <table className="w-full text-left text-xs">
     <thead><tr className="border-b border-[#262626] bg-[#181818] text-neutral-400">
      <th scope="col" className="px-4 py-3 font-semibold">Cliente</th>
      <th scope="col" className="px-4 py-3 font-semibold">Teléfono / WhatsApp</th>
      <th scope="col" className="px-4 py-3 font-semibold">Visitas completadas</th>
      <th scope="col" className="px-4 py-3 font-semibold">Último servicio</th>
      <th scope="col" className="px-4 py-3 font-semibold">Gasto acumulado</th>
      <th scope="col" className="px-4 py-3 font-semibold">Vinculación y puntos</th>
     </tr></thead>
     <tbody className="divide-y divide-[#222222]">
      {filtered.map(customer=><tr key={customer.id} className="hover:bg-[#191919]">
       <td className="px-4 py-3">
        <div className="flex items-center gap-3">
         {customer.avatar?
          <img src={customer.avatar} alt={'Foto de '+customer.name} className="w-9 h-9 shrink-0 rounded-full border border-neutral-700 object-cover"
           onError={e=>{e.currentTarget.style.display='none';e.currentTarget.nextElementSibling?.classList.remove('hidden');}}/>:null}
         <div className={`w-9 h-9 shrink-0 items-center justify-center rounded-full border border-neutral-700 bg-[#272727] ${customer.avatar?'hidden':'flex'}`}>
          <UserRound className="w-4 h-4 text-neutral-400"/>
         </div>
         <div className="min-w-[110px]">
          <div className="font-bold text-white">{customer.name}</div>
          {customer.email&&<div className="text-[11px] text-neutral-400">{customer.email}</div>}
         </div>
        </div>
       </td>
       <td className="px-4 py-3 font-mono text-neutral-300">{customer.phone||'No registrado'}</td>
       <td className="px-4 py-3 font-mono font-bold text-white">{customer.visits}</td>
       <td className="px-4 py-3 text-neutral-300">
        <div>{customer.lastService||'Sin servicios completados'}</div>
        {customer.lastServiceAt&&<div className="text-[10px] font-mono text-neutral-500">{formatDate(customer.lastServiceAt)}</div>}
       </td>
       <td className="px-4 py-3 font-mono font-bold text-[var(--gold-primary)]">{formatCurrency(customer.totalSpent,currency)}</td>
       <td className="px-4 py-3">
        <span className="inline-flex whitespace-nowrap rounded border border-[var(--gold-primary)]/30 bg-[var(--gold-primary)]/10 px-2 py-1 text-[10px] font-bold text-[var(--gold-primary)]">
         {customer.linkedByQr?'Vinculado por QR':'Cliente con cita'}
        </span>
        <p className="mt-1 font-mono text-[11px] text-neutral-400">{customer.points} puntos</p>
       </td>
      </tr>)}
     </tbody>
    </table>
   </div>
  </div>}
 </div>;
};
