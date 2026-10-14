import React,{useState} from 'react';
import {backendRequest} from '../../services/liveBackend';

type Props={tenant:string;category:'products'|'shop'|'barber';onUploaded:(url:string)=>void;label?:string};
export function ImageUploader({tenant,category,onUploaded,label='Subir imagen'}:Props){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[url,setUrl]=useState(''),[external,setExternal]=useState(false);
 const upload=async(file:File)=>{
  if(busy)return;
  setError('');
  if(file.size>4_000_000){setError('La imagen debe pesar menos de 4 MB');return;}
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setError('Solo JPEG, PNG o WebP');return;}
  setBusy(true);
  try{
   const data=await new Promise<string>((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(Error('No se pudo leer el archivo'));
    reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');
    reader.readAsDataURL(file);
   });
   const result=await backendRequest<{url:string}>('/tenants/'+encodeURIComponent(tenant)+'/images',{method:'POST',body:JSON.stringify({data,category})});
   onUploaded(result.url);
  }catch(e){setError(e instanceof Error?e.message:'No se pudo subir la imagen');}
  finally{setBusy(false);}
 };
 return <div className="space-y-2 text-xs">
  <label className="inline-flex cursor-pointer bg-[var(--gold-primary)] text-black font-bold rounded-lg px-4 py-2">
   {busy?'Subiendo...':label}
   <input aria-label={label} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy||!tenant} className="sr-only" onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f);e.target.value='';}}/>
  </label>
  <button type="button" onClick={()=>setExternal(!external)} className="ml-2 underline text-neutral-400">Usar URL externa</button>
  {external&&<div className="flex gap-2"><input aria-label="URL externa" className="bg-neutral-900 border border-neutral-700 rounded p-2 flex-1 min-w-0" type="url" placeholder="https://..." value={url} onChange={e=>setUrl(e.target.value)}/><button type="button" className="rounded border px-2" onClick={()=>{try{const u=new URL(url);if(u.protocol!=='https:')throw Error();onUploaded(url);setUrl('');setExternal(false);}catch{setError('Introduce una URL HTTPS válida');}}}>Usar</button></div>}
  {error&&<p role="alert" className="text-red-400">{error}</p>}
 </div>;
}
