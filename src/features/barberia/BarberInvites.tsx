import React,{useEffect,useState} from 'react';
import QRCode from 'qrcode';
import {useApp} from '../../context/AppContext';
import {backendRequest} from '../../services/liveBackend';

type Request={id:string;full_name:string;status:string;created_at:string};
export function BarberInvites(){
 const {currentShop,addToast}=useApp();
 const [url,setUrl]=useState(''),[qr,setQr]=useState(''),[requests,setRequests]=useState<Request[]>([]);
 const [busy,setBusy]=useState(false);
 const tenant=currentShop?.id;
 const refresh=async()=>{if(tenant)setRequests(await backendRequest<Request[]>('/tenants/'+tenant+'/barber-requests'));};
 useEffect(()=>{void refresh().catch(()=>{});},[tenant]);
 const generate=async()=>{
  if(!tenant)return;
  setBusy(true);
  try{
   const result=await backendRequest<{code:string}>('/tenants/'+tenant+'/barber-invites',{method:'POST'});
   const link=location.origin+'/unirse-barbero/'+result.code;
   setUrl(link);setQr(await QRCode.toDataURL(link,{width:320}));
  }catch(e){addToast(e instanceof Error?e.message:'No se pudo crear invitaci�n','error');}
  finally{setBusy(false);}
 };
 const decide=async(id:string,approve:boolean)=>{
  if(!tenant)return;
  try{await backendRequest('/tenants/'+tenant+'/barber-requests/'+id+'/decision',{method:'POST',body:JSON.stringify({approve})});await refresh();addToast('Solicitud atendida','success');}
  catch(e){addToast(e instanceof Error?e.message:'Error al procesar solicitud','error');}
 };
 return <section className="rounded-2xl bg-[#161616] border border-neutral-700 p-5 space-y-4 text-white">
  <h2 className="font-bold text-lg">Vinculaci�n de barberos por QR</h2>
  <p className="text-sm text-neutral-400">Genera un enlace v�lido por 7 d�as. Cada profesional debe iniciar sesi�n y solicitar acceso. Solo el due�o aprueba su incorporaci�n.</p>
  <button type="button" disabled={busy} onClick={()=>void generate()} className="rounded-xl bg-amber-400 text-black px-4 py-2 font-bold">{busy?'Generando...':'Generar invitaci�n para barberos'}</button>
  {qr&&<div className="bg-white p-3 w-fit rounded-xl"><img src={qr} alt="QR de invitaci�n para barberos" width={210} height={210}/></div>}
  {url&&<div className="flex gap-2"><input aria-label="Enlace de invitaci�n" readOnly value={url} className="bg-neutral-900 rounded-lg p-2 flex-1 min-w-0 text-xs"/><button onClick={()=>void navigator.clipboard.writeText(url)} className="border px-3 rounded-lg">Copiar</button></div>}
  <h3 className="font-semibold">Solicitudes pendientes</h3>
  {requests.filter(r=>r.status==='pending').length===0&&<p className="text-sm text-neutral-400">Sin solicitudes pendientes.</p>}
  {requests.filter(r=>r.status==='pending').map(r=><div key={r.id} className="flex gap-2 items-center justify-between flex-wrap border-t border-neutral-700 py-3">
   <span>{r.full_name}</span><div className="flex gap-2">
   <button onClick={()=>void decide(r.id,true)} className="bg-emerald-700 rounded px-3 py-2">Aprobar</button>
   <button onClick={()=>void decide(r.id,false)} className="bg-red-800 rounded px-3 py-2">Rechazar</button></div></div>)}
  <button onClick={()=>void refresh().catch(e=>addToast(String(e),'error'))} className="text-xs underline">Actualizar solicitudes</button>
 </section>;
}
