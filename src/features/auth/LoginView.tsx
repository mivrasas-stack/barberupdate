import React, { useState } from 'react';
import { ArrowRight, LockKeyhole, Mail } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { UserRole } from '../../types';
import { isLiveBackend, requestPasswordReset, registerWithEmail, verifyWhatsAppAuthCode, resetPasswordByWhatsApp, resendWhatsAppAuthCode, activateWhatsAppInvitation, isPasswordSetupPending, savePasswordFromLink, cancelPasswordSetup } from '../../services/liveBackend';

/**
 * Login only. Reproduces the BarberNow visual supplied by the owner.
 * No changes to the rest of the application's layouts, palette or components.
 */
export const LoginView: React.FC = () => {
  const { state, loginAs, loginWithCredentials, addToast } = useApp();
  const [email, setEmail] = useState(isLiveBackend ? '' : 'contacto@barberclub.co');
  const [password, setPassword] = useState(isLiveBackend ? '' : '••••••••••••');
  const [phone,setPhone]=useState('');
  const [fullName,setFullName]=useState('');
  const [otpMode,setOtpMode]=useState<'signup'|'recovery'|null>(null);
  const [invitationChallenge]=useState(()=>new URLSearchParams(window.location.search).get('invite')||'');
  const [inviteCode,setInviteCode]=useState('');
  const [invitePassword,setInvitePassword]=useState('');
  const [inviteConfirm,setInviteConfirm]=useState('');
  const [otpChallenge,setOtpChallenge]=useState('');
  const [otpCode,setOtpCode]=useState('');
  const [resetPassword,setResetPassword]=useState('');
  const [confirmReset,setConfirmReset]=useState('');
  const selectedRole: UserRole = 'owner';
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [busy, setBusy] = useState(false);
  const [passwordSetup,setPasswordSetup] = useState(isPasswordSetupPending);
  const [newPassword,setNewPassword]=useState('');
  const [confirmPassword,setConfirmPassword]=useState('');
  const finishSetup=async(event:React.FormEvent)=>{
    event.preventDefault();
    if(busy)return;
    if(newPassword!==confirmPassword){addToast('Las contraseñas no coinciden','error');return;}
    setBusy(true);
    try{
      const accountEmail=await savePasswordFromLink(newPassword);
      if(accountEmail)setEmail(accountEmail);
      setPassword('');
      setPasswordSetup(false);
      addToast('Contraseña guardada. Ya puedes iniciar sesión.','success');
    }catch(error){addToast(error instanceof Error?error.message:'No se pudo activar la cuenta','error');}
    finally{setBusy(false);}
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === 'register') {
        if (!isLiveBackend) {
          addToast('El registro requiere el backend real.', 'info');
          return;
        }
        const result=await registerWithEmail(email,password,{fullName:fullName.trim(),phone});
        if(!result.challengeId)throw Error('No fue posible crear el código de verificación.');
        setOtpChallenge(result.challengeId);
        setOtpCode('');
        setOtpMode('signup');
        addToast('Enviamos un código a tu WhatsApp. No necesitas escribir +57.','success');
        return;
      }
      if (isLiveBackend) {
        await loginWithCredentials(email, password, selectedRole);
      } else {
        const user = state.users.find(u => u.email === email)
          || state.users.find(u => u.role === selectedRole)
          || state.users[1];
        if (user) loginAs(user);
      }
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'No fue posible ingresar', 'error');
    } finally {
      setBusy(false);
    }
  };

  const forgotPassword = async () => {
    if (!isLiveBackend) {
      addToast('Esta opción requiere el backend real.', 'info');
      return;
    }
    if (!email.trim()) {
      addToast('Escribe primero tu correo electrónico para recuperar la contraseña.', 'info');
      return;
    }
    try {
      const response=await requestPasswordReset(email.trim());
      if(response.challengeId){
        setOtpChallenge(response.challengeId);setOtpCode('');setOtpMode('recovery');
        addToast('Solicitamos el código por WhatsApp al celular verificado de tu cuenta.','success');
      }else addToast('Si la cuenta tiene un celular verificado, recibirá un código. Si no, inicia sesión con tu contraseña actual para verificarlo.','info');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'No fue posible solicitar la recuperación', 'error');
    }
  };

  const confirmWhatsApp=async(event:React.FormEvent)=>{
    event.preventDefault();
    if(busy)return;
    if(!/^\d{8}$/.test(otpCode)){addToast('Introduce los 8 dígitos recibidos en WhatsApp.','error');return;}
    if(otpMode==='recovery'&&(resetPassword!==confirmReset||resetPassword.length<12)){
      addToast('La contraseña debe tener 12 caracteres o más y coincidir.','error');return;
    }
    setBusy(true);
    try{
      const result=await verifyWhatsAppAuthCode(otpChallenge,otpCode,otpMode!);
      if(otpMode==='recovery'){
        if(!result.recoveryToken)throw Error('No se pudo validar el código para recuperar la contraseña.');
        await resetPasswordByWhatsApp(result.recoveryToken,resetPassword);
        setPassword(resetPassword);
        setOtpMode(null);setMode('login');
        addToast('Contraseña actualizada. Ya puedes iniciar sesión con BarberNow.','success');
      }else{
        setOtpMode(null);
        await loginWithCredentials(email,password,selectedRole);
        addToast('WhatsApp verificado. Tu cuenta está activada.','success');
      }
      setOtpCode('');
    }catch(error){addToast(error instanceof Error?error.message:'No fue posible validar WhatsApp','error');}
    finally{setBusy(false);}
  };

  const acceptInvitation=async(event:React.FormEvent)=>{
    event.preventDefault();
    if(!/^\d{8}$/.test(inviteCode)||invitePassword.length<12||invitePassword!==inviteConfirm){
      addToast('Revisa el código y confirma una contraseña de 12 o más caracteres.','error');
      return;
    }
    setBusy(true);
    try{
      await activateWhatsAppInvitation(invitationChallenge,inviteCode,invitePassword);
      window.location.assign('/login');
    }catch(e){addToast(e instanceof Error?e.message:'No se pudo activar la invitación.','error');}
    finally{setBusy(false);}
  };
  if(invitationChallenge)return <main className="min-h-screen flex items-center justify-center bg-[#090909] px-4 text-white">
    <form onSubmit={e=>void acceptInvitation(e)}
      className="w-full max-w-md space-y-4 rounded-2xl border border-[#303030] bg-[#151515] p-7">
      <img src="/branding/barbernow-logo.png" alt="BarberNow" className="mx-auto h-16 w-auto"/>
      <h1 className="text-center text-2xl font-bold">Activa tu cuenta BarberNow</h1>
      <p className="text-center text-sm text-neutral-400">Ingresa los 8 dígitos recibidos por WhatsApp y elige tu contraseña. El código vence en 5 minutos.</p>
      <label className="block text-sm">Código de WhatsApp
        <input required type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={8} pattern="[0-9]{8}"
          value={inviteCode} onChange={e=>setInviteCode(e.target.value.replace(/\D/g,''))}
          className="mt-2 w-full rounded-xl border border-neutral-700 bg-[#101010] px-4 py-3 text-center font-mono text-xl tracking-widest"/>
      </label>
      <label className="block text-sm">Crea una contraseña segura
        <input required type="password" autoComplete="new-password" minLength={12}
          value={invitePassword} onChange={e=>setInvitePassword(e.target.value)}
          className="mt-2 w-full rounded-xl border border-neutral-700 bg-[#101010] px-4 py-3"/>
      </label>
      <label className="block text-sm">Confirmar contraseña
        <input required type="password" autoComplete="new-password" minLength={12}
          value={inviteConfirm} onChange={e=>setInviteConfirm(e.target.value)}
          className="mt-2 w-full rounded-xl border border-neutral-700 bg-[#101010] px-4 py-3"/>
      </label>
      <button disabled={busy} type="submit"
        className="w-full rounded-xl bg-[var(--gold-primary)] px-4 py-3 font-bold text-black disabled:opacity-50">
        {busy?'Verificando...':'Activar mi cuenta'}
      </button>
      <p className="text-xs text-neutral-500">Si el código venció, solicita al administrador que genere una invitación nueva.</p>
    </form>
  </main>;

  if(otpMode)return <main className="min-h-screen bg-[#090909] text-white flex items-center justify-center px-4">
    <form onSubmit={e=>void confirmWhatsApp(e)}
      className="w-full max-w-md space-y-5 rounded-2xl border border-[#303030] bg-[#181818] p-7">
      <img src="/branding/barbernow-logo.png" alt="BarberNow" className="h-16 w-auto mx-auto"/>
      <h1 className="text-center text-xl font-bold">Código de seguridad de WhatsApp</h1>
      <p className="text-center text-sm text-neutral-400">Escribe los 8 dígitos recibidos. El código vence en 5 minutos y solo se usa una vez.</p>
      <label className="block text-sm">Código de verificación
        <input required autoFocus type="text" inputMode="numeric" autoComplete="one-time-code"
          maxLength={8} pattern="[0-9]{8}" value={otpCode} onChange={e=>setOtpCode(e.target.value.replace(/\D/g,''))}
          className="mt-2 block w-full rounded-xl border border-neutral-600 bg-[#101010] px-4 py-3 text-center font-mono text-2xl tracking-widest"/>
      </label>
      {otpMode==='recovery'&&<>
        <label className="block text-sm">Nueva contraseña
          <input required type="password" minLength={12} value={resetPassword} onChange={e=>setResetPassword(e.target.value)}
            className="mt-2 block w-full rounded-xl border border-neutral-600 bg-[#101010] px-4 py-3"/>
        </label>
        <label className="block text-sm">Confirma tu contraseña
          <input required type="password" minLength={12} value={confirmReset} onChange={e=>setConfirmReset(e.target.value)}
            className="mt-2 block w-full rounded-xl border border-neutral-600 bg-[#101010] px-4 py-3"/>
        </label>
      </>}
      <button type="submit" disabled={busy} className="w-full rounded-xl bg-[var(--gold-primary)] px-4 py-3 font-bold text-black disabled:opacity-50">
        {busy?'Validando...':otpMode==='recovery'?'Verificar y cambiar contraseña':'Verificar y entrar'}
      </button>
      <button type="button" disabled={busy} onClick={async()=>{
        setBusy(true);
        try{
          const next=otpMode==='signup'
            ?await resendWhatsAppAuthCode(email,password)
            :await requestPasswordReset(email);
          if(next.challengeId){
            setOtpChallenge(next.challengeId);setOtpCode('');
            addToast('Solicitamos otro código por WhatsApp.','success');
          }else addToast('Si existe un celular verificado, recibirá un código.','info');
        }catch(e){addToast(e instanceof Error?e.message:'No se pudo reenviar el código','error');}
        finally{setBusy(false);}
      }} className="block w-full text-center text-xs text-[var(--gold-primary)] disabled:opacity-40">
        Reenviar código
      </button>
      <button type="button" onClick={()=>{setOtpMode(null);setOtpCode('');}}
        className="block w-full text-center text-xs text-neutral-400">Volver al inicio</button>
    </form>
  </main>;

  if(passwordSetup)return (
    <main className="min-h-screen flex items-center justify-center bg-[#090909] text-white px-4">
      <form onSubmit={finishSetup} className="w-full max-w-md rounded-2xl border border-[#303030] bg-[#181818] p-7 space-y-5">
        <h1 className="text-2xl font-bold">Activa tu cuenta BarberNow</h1>
        <p className="text-sm text-neutral-400">Define una contraseña para ingresar de manera segura. Debe contener al menos 12 caracteres.</p>
        <label className="block text-sm space-y-2">Nueva contraseña
          <input type="password" autoComplete="new-password" required minLength={12} value={newPassword} onChange={e=>setNewPassword(e.target.value)} className="block w-full rounded-xl bg-[#111] border border-[#333] px-4 py-3"/>
        </label>
        <label className="block text-sm space-y-2">Confirmar contraseña
          <input type="password" autoComplete="new-password" required minLength={12} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} className="block w-full rounded-xl bg-[#111] border border-[#333] px-4 py-3"/>
        </label>
        <button type="submit" disabled={busy} className="w-full rounded-xl py-3 bg-[var(--gold-primary,#e5a700)] text-black font-bold disabled:opacity-50">{busy?'Guardando...':'Establecer contraseña'}</button>
        <button type="button" onClick={()=>{cancelPasswordSetup();setPasswordSetup(false);}} className="w-full text-xs text-neutral-400 hover:text-white">Cancelar y volver al inicio de sesión</button>
      </form>
    </main>
  );
  const landing = import.meta.env.VITE_PUBLIC_LANDING_URL as string | undefined;

  return (
    <main
      data-testid="barbernow-login"
      className="min-h-screen w-full bg-[#080808] text-white lg:flex"
      style={{ fontFamily: "'Inter', 'Montserrat', system-ui, sans-serif" }}
    >
      {/* Left-side image from the original BarberNow /login, with live text overlay. */}
      <section
        aria-label="BarberNow, exclusividad y estilo"
        className="relative h-[35vh] min-h-[240px] w-full overflow-hidden bg-[#070707] lg:sticky lg:top-0 lg:h-screen lg:w-1/2 lg:min-h-[640px] lg:shrink-0"
      >
        <img
          src="/images/barber-paradise-atmosphere.webp"
          alt="Barbería BarberNow, con sillones de barbero y paredes de ladrillo"
          className="absolute inset-0 h-full w-full object-cover object-center grayscale brightness-[0.42]"
          draggable={false}
        />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/25 to-black/10" />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
          <img
            src="/branding/barbernow-logo.png"
            alt="BarberNow"
            className="h-auto w-[min(310px,75vw)] object-contain drop-shadow-lg"
            draggable={false}
          />
          <span className="mt-5 text-[clamp(9px,0.9vw,15px)] tracking-[0.08em] text-gray-300">
            EXCLUSIVIDAD Y ESTILO — SAAS MULTI-TENANT
          </span>
        </div>
      </section>

      <section className="flex min-h-[65vh] w-full items-start justify-center bg-[#090909] px-4 pb-10 pt-5 sm:px-8 lg:min-h-screen lg:w-1/2 lg:px-8 lg:pt-[39px]">
        <div
          className="w-full max-w-[448px] rounded-[24px] border border-[#242424] bg-[#181818] px-[40px] pb-[38px] pt-[38px] shadow-[0_22px_54px_rgba(0,0,0,0.22)] max-[480px]:px-6"
        >
          <div className="mb-[22px] flex justify-center">
            <div className="flex h-[48px] w-[48px] items-center justify-center rounded-full bg-[#222222]">
              <LockKeyhole aria-hidden="true" className="h-[19px] w-[19px] text-[#e5a700]" strokeWidth={1.7} />
            </div>
          </div>

          <div className="mb-[38px] text-center">
            <h1 className="text-[35px] font-[850] uppercase leading-[1.04] tracking-[-1.3px] max-[420px]:text-[29px]">
              <span className="block text-[#f6f6f6]">
                {mode === 'login' ? 'BIENVENIDO' : 'CREA TU'}
              </span>
              <span className="mt-[2px] block text-[#818181]">
                {mode === 'login' ? 'DE VUELTA' : 'CUENTA'}
              </span>
            </h1>
            <p className="mt-[17px] text-[13px] font-normal text-[#aaaaaa]">
              {mode === 'login' ? 'Ingresa con tus credenciales verificadas.' : 'Únete a la experiencia BarberNow.'}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-[26px]">
            <div>
              <label
                htmlFor="barber-email"
                className="mb-[12px] block text-[10px] font-extrabold uppercase tracking-[1.8px] text-[#878787]"
              >
                Correo electrónico
              </label>
              <div className="relative">
                <Mail aria-hidden="true" className="absolute left-[16px] top-1/2 h-[19px] w-[19px] -translate-y-1/2 text-[#666666]" strokeWidth={1.8} />
                <input
                  id="barber-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="tu@correo.com"
                  className="h-[70px] w-full rounded-[12px] border border-[#252525] bg-[#111111] pl-[47px] pr-4 text-[13px] font-semibold text-[#f4f4f4] outline-none placeholder:text-[#6b6b6b] focus:border-[#b77d0a]"
                />
              </div>
            </div>
            {mode==='register'&&<div>
              <label htmlFor="barber-full-name" className="mb-[12px] block text-[10px] font-extrabold uppercase tracking-[1.8px] text-[#878787]">
                Nombre completo
              </label>
              <input id="barber-full-name" required autoComplete="name" minLength={2}
                value={fullName} onChange={e=>setFullName(e.target.value)}
                className="h-[60px] w-full rounded-xl border border-[#252525] bg-[#111] px-4 text-white"/>
            </div>}
            {mode==='register'&&<div>
              <label htmlFor="barber-phone" className="mb-[12px] block text-[10px] font-extrabold uppercase tracking-[1.8px] text-[#878787]">
                Tu celular de WhatsApp
              </label>
              <input id="barber-phone" required type="tel" inputMode="numeric" autoComplete="tel"
                value={phone} onChange={e=>setPhone(e.target.value)} placeholder="3001234567"
                className="h-[60px] w-full rounded-xl border border-[#252525] bg-[#111] px-4 text-white"/>
              <p className="mt-2 text-xs text-neutral-500">10 dígitos colombianos. No escribas +57.</p>
            </div>}
            <div>
              <div className="mb-[12px] flex items-center justify-between gap-2">
                <label
                  htmlFor="barber-password"
                  className="text-[10px] font-extrabold uppercase tracking-[1.8px] text-[#878787]"
                >
                  Contraseña
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => void forgotPassword()}
                    className="text-right text-[10px] font-semibold uppercase text-[#e6a800] transition-colors hover:text-[#ffc63b]"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>
              <div className="relative">
                <LockKeyhole aria-hidden="true" className="absolute left-[16px] top-1/2 h-[19px] w-[19px] -translate-y-1/2 text-[#666666]" strokeWidth={1.7} />
                <input
                  id="barber-password"
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={mode === 'register' ? 12 : undefined}
                  placeholder="••••••••"
                  className="h-[70px] w-full rounded-[12px] border border-[#252525] bg-[#111111] pl-[47px] pr-4 text-[13px] font-semibold text-[#f4f4f4] outline-none placeholder:text-[#696969] focus:border-[#b77d0a]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="flex h-[50px] w-full items-center justify-center gap-3 rounded-[13px] bg-gradient-to-r from-[#ffba15] to-[#f29a00] text-[12px] font-extrabold uppercase tracking-[1px] text-[#0c0905] shadow-[0_7px_22px_rgba(239,159,0,0.14)] transition-[filter,transform] hover:brightness-110 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
            >
              {busy ? 'VALIDANDO...' : mode === 'register' ? 'REGISTRARME' : 'INICIAR SESIÓN'}
              {!busy && <ArrowRight aria-hidden="true" className="h-[16px] w-[16px]" strokeWidth={2.2} />}
            </button>
          </form>

          <div className="mt-[31px] border-t border-[#272727] pt-[18px] text-center">
            <p className="text-[12px] text-[#8c8c8c]">
              {mode === 'login' ? '¿No tienes una cuenta?' : '¿Ya tienes una cuenta?'}{' '}
              <button
                type="button"
                className="font-extrabold text-[#f3f3f3] hover:text-[#ffc019]"
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              >
                {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
              </button>
            </p>
            {landing ? (
              <a href={landing} className="mt-[24px] block text-[12px] font-semibold uppercase tracking-[0.6px] text-[#606060] hover:text-[#b7b7b7]">
                Volver a la página web
              </a>
            ) : (
              <a href="/" className="mt-[24px] block text-[12px] font-semibold uppercase tracking-[0.6px] text-[#585858] hover:text-[#b7b7b7]">
                Volver a la página web
              </a>
            )}
          </div>
        </div>
      </section>
    </main>
  );
};

[executed on device: vmi3669516 (22a9c8cd-8866-4186-9071-dab9301dff16)]