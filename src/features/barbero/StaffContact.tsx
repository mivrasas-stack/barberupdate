import React, {createContext, useContext, useEffect, useRef, useState} from 'react';
import {MessageCircle} from 'lucide-react';
import {useApp} from '../../context/AppContext';
import {backendRequest} from '../../services/liveBackend';
import {normalizeBookingWhatsAppPhone} from '../../utils/whatsappPhone';

type Contact = {phone:string; confirmed:boolean; barberId:string|null; enabled:boolean; templateReady:boolean};
type ContactState = {contact:Contact|null; save:(phone:string,enabled?:boolean)=>Promise<void>; loadError:string; reload:()=>void};
const ContactContext = createContext<ContactState|null>(null);
export const useStaffContact = () => useContext(ContactContext);

export function StaffContactProvider({tenantId,children}:{tenantId:string;children:React.ReactNode}) {
  const {updateCurrentUserProfile,addToast} = useApp();
  const [contact,setContact] = useState<Contact|null>(null);
  const [dismissed,setDismissed] = useState(false);
  const [loadError,setLoadError] = useState('');
  const [attempt,setAttempt] = useState(0);
  const path = '/tenants/'+encodeURIComponent(tenantId)+'/my-contact';
  useEffect(()=>{
    let active = true;
    setLoadError('');
    backendRequest<Contact>(path).then(data=>{if(active)setContact(data);})
      .catch(error=>{if(active)setLoadError(error.message || 'No se pudo cargar tu WhatsApp.');});
    return ()=>{active=false;};
  },[path,attempt]);
  async function save(phone:string,enabled?:boolean) {
    const saved = await backendRequest<Contact>(path,{method:'PATCH',body:JSON.stringify({phone,enabled})});
    setContact(saved);
    updateCurrentUserProfile({phone:saved.phone});
    addToast('Tu número de WhatsApp quedó guardado.','success');
  }
  return <ContactContext.Provider value={{contact,save,loadError,reload:()=>setAttempt(n=>n+1)}}>
    {children}
    {contact && !contact.confirmed && !dismissed && <ContactDialog onDismiss={()=>setDismissed(true)}/>}
  </ContactContext.Provider>;
}

function ContactDialog({onDismiss}:{onDismiss:()=>void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const el=dialog.current;
    el?.showModal();
    return ()=>el?.close();
  },[]);
  return <dialog ref={dialog} aria-labelledby="staff-contact-title" onCancel={onDismiss}
    className="fixed inset-0 m-auto w-[min(92vw,28rem)] max-h-[90dvh] overflow-y-auto rounded-2xl border border-neutral-700 bg-[#151517] p-6 text-white backdrop:bg-black/75">
    <ContactForm modal onDismiss={onDismiss}/>
  </dialog>;
}

function ContactForm({modal=false,onDismiss}:{modal?:boolean;onDismiss?:()=>void}) {
  const state = useStaffContact()!;
  const contact = state.contact!;
  const [phone,setPhone] = useState(contact.phone);
  const [enabled,setEnabled] = useState(contact.enabled);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const fieldId=React.useId();
  async function submit(event:React.FormEvent) {
    event.preventDefault();
    if(busy)return;
    const normalized=normalizeBookingWhatsAppPhone(phone);
    if(!normalized){setError('Escribe los 10 dígitos del celular colombiano o incluye el indicativo internacional.');return;}
    setBusy(true);setError('');
    try { await state.save(normalized,contact.barberId?enabled:undefined); }
    catch(e){setError(e instanceof Error?e.message:'No se pudo guardar tu número. Intenta de nuevo.');}
    finally{setBusy(false);}
  }
  return <form onSubmit={submit} className="space-y-4">
    <h2 id={modal?'staff-contact-title':undefined} className="flex items-center gap-2 font-bold text-white">
      <MessageCircle aria-hidden="true" className="h-5 w-5 text-[var(--gold-primary)]"/>
      {modal?'Actualiza tu número de WhatsApp':contact.barberId?'Nuevas citas por WhatsApp':'Mi WhatsApp'}
    </h2>
    <p className="text-sm text-neutral-300">Este será tu teléfono personal y el número de contacto que verán los clientes en tu perfil de barbero.</p>
    <label htmlFor={fieldId} className="block text-sm font-semibold">Mi WhatsApp</label>
    <input id={fieldId} type="tel" inputMode="tel" autoComplete="tel" required maxLength={32} disabled={busy}
      className="block w-full rounded-xl border border-neutral-600 bg-[#101010] px-4 py-3 text-white"
      value={phone} onChange={e=>setPhone(e.target.value)} placeholder="300 123 4567"/>
    {contact.barberId && <label className="flex items-start gap-3 text-sm text-neutral-200">
      <input type="checkbox" checked={enabled} disabled={busy} className="mt-1 accent-amber-400" onChange={e=>setEnabled(e.target.checked)}/>
      Recibir por WhatsApp los datos de las nuevas citas asignadas a mí.
    </label>}
    {contact.barberId && enabled && !contact.templateReady && <p className="text-xs text-amber-300">Los avisos empezarán cuando la plantilla esté activa en tu barbería.</p>}
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    <div className="flex flex-wrap items-center gap-3">
      <button type="submit" disabled={busy} className="rounded-xl bg-[var(--gold-primary)] px-5 py-3 text-sm font-bold text-black disabled:opacity-50">{busy?'Guardando…':'Guardar mi WhatsApp'}</button>
      {onDismiss && <button type="button" disabled={busy} onClick={onDismiss} className="rounded-xl px-4 py-3 text-sm text-neutral-300">Ahora no</button>}
    </div>
  </form>;
}

export function StaffContactSection() {
  const state = useStaffContact();
  if(!state)return null;
  return <section id="staff-contact" className="rounded-2xl border border-[#343434] bg-[#141414] p-5 sm:p-6">
    {state.contact?<ContactForm key={JSON.stringify(state.contact)}/>:state.loadError?
      <div role="alert">{state.loadError} <button onClick={state.reload} className="underline">Reintentar</button></div>:
      <p role="status">Cargando tu WhatsApp…</p>}
  </section>;
}
