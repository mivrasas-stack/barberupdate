import React,{useState} from 'react';
import {Camera,Loader2} from 'lucide-react';
import {backendRequest} from '../../services/liveBackend';

type Props={
 tenantId?:string;
 label?:string;
 onSaved:(url:string)=>Promise<void>;
};

/** Shared file picker for customer + barber profile photos. Never accept fabricated URLs. */
export function ProfilePhotoUploader({tenantId,label='Subir foto de perfil',onSaved}:Props){
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const handleFile=async(file:File)=>{
  if(busy)return;
  setError('');
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){
   setError('Selecciona una imagen JPG, PNG o WebP.');return;
  }
  if(file.size>15_000_000){setError('La foto original no debe superar 15 MB.');return;}
  setBusy(true);
  try{
   const bitmap=await createImageBitmap(file);
   let blob:Blob;
   try{
    const maxEdge=960;
    const ratio=Math.min(1,maxEdge/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*ratio));
    canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
    const ctx=canvas.getContext('2d');
    if(!ctx)throw Error('Tu navegador no pudo preparar la fotografía.');
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(result=>
      result?resolve(result):reject(Error('No fue posible comprimir la foto.')),'image/webp',0.82));
   }finally{bitmap.close();}
   if(blob.size>4_000_000)throw Error('La foto comprimida excede 4 MB. Prueba otra.');
   const data=await new Promise<string>((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(Error('No fue posible leer la foto.'));
    reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');
    reader.readAsDataURL(blob);
   });
   const endpoint=tenantId
    ?'/tenants/'+encodeURIComponent(tenantId)+'/images'
    :'/me/avatar';
   const result=await backendRequest<{url:string}>(endpoint,{
    method:'POST',body:JSON.stringify(tenantId?{data,category:'barber'}:{data})
   });
   await onSaved(result.url);
  }catch(error){setError(error instanceof Error?error.message:'No se pudo guardar la foto de perfil.');}
  finally{setBusy(false);}
 };
 return (
  <div className="space-y-1.5 text-xs">
   <label className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-colors ${busy?'bg-neutral-600 text-neutral-300 cursor-wait':'bg-[var(--gold-primary)] text-black cursor-pointer hover:bg-[var(--gold-hover)]'}`}>
    {busy?<Loader2 className="w-4 h-4 animate-spin"/>:<Camera className="w-4 h-4"/>}
    {busy?'Guardando fotografía...':label}
    <input aria-label={label} type="file" accept="image/png,image/jpeg,image/webp"
     className="sr-only" disabled={busy} onChange={event=>{
      const image=event.target.files?.[0];
      if(image)void handleFile(image);
      event.target.value='';
     }}/>
   </label>
   <p className="text-[11px] text-neutral-500">JPG, PNG o WebP · máximo 15 MB antes de procesar.</p>
   {error&&<p role="alert" className="text-rose-300">{error}</p>}
  </div>
 );
}
