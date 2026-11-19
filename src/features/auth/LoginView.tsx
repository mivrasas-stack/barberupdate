import React, { useEffect, useState } from 'react';
import { ArrowRight, LockKeyhole, Mail } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {PasswordInput} from '../../components/common/PasswordInput';
import type { UserRole } from '../../types';
import { isLiveBackend, requestPasswordReset, verifyPasswordResetCode, setPasswordWithWhatsApp, registerWithEmail, isPasswordSetupPending, savePasswordFromLink, cancelPasswordSetup } from '../../services/liveBackend';

/**
 * Login only. Reproduces the BarberNow visual supplied by the owner.
 * No changes to the rest of the application's layouts, palette or components.
 */
export const LoginView: React.FC = () => {
  const { state, loginAs, loginWithCredentials, addToast } = useApp();
  const [email, setEmail] = useState(isLiveBackend ? '' : 'contacto@barberclub.co');
  const [password, setPassword] = useState(isLiveBackend ? '' : '••••••••••••');
  const selectedRole: UserRole = 'owner';
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [busy, setBusy] = useState(false);
  const [passwordSetup,setPasswordSetup] = useState(isPasswordSetupPending);
  const [newPassword,setNewPassword]=useState('');
  const [confirmPassword,setConfirmPassword]=useState('');
  const [recoveryStep,setRecoveryStep]=useState<'code'|'password'|null>(null);
  const [recoveryChallenge,setRecoveryChallenge]=useState('');
  const [recoveryCode,setRecoveryCode]=useState('');
  const [recoveryToken,setRecoveryToken]=useState('');
  const [recoveryPassword,setRecoveryPassword]=useState('');
  const [recoveryConfirm,setRecoveryConfirm]=useState('');
  const [recoveryResendUntil,setRecoveryResendUntil]=useState(0);
  const [recoveryResendCountdown,setRecoveryResendCountdown]=useState(0);
  useEffect(()=>{
    if(recoveryStep!=='code')return;
    const update=()=>setRecoveryResendCountdown(Math.max(0,Math.ceil((recoveryResendUntil-Date.now())/1000)));
    update();
    const timer=window.setInterval(update,1000);
    return()=>window.clearInterval(timer);
  },[recoveryStep,recoveryResendUntil]);
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
        await registerWithEmail(email, password);
        addToast('Revisa tu correo si se requiere confirmar la cuenta; después inicia sesión.', 'success');
        setMode('login');
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
    setBusy(true);
    try {
      const result=await requestPasswordReset(email.trim());
      setRecoveryChallenge(result.challengeId);
      setRecoveryCode('');
      setRecoveryStep('code');
      setRecoveryResendUntil(Date.now()+60000);
      addToast('Solicitamos el código de seguridad a tu WhatsApp registrado.', 'info');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'No fue posible solicitar la recuperación', 'error');
    } finally {setBusy(false);}
  };
  const resendRecoveryCode=async()=>{
    if(busy||recoveryResendCountdown>0||!email.trim())return;
    setBusy(true);
    try{
      const next=await requestPasswordReset(email.trim());
      setRecoveryChallenge(next.challengeId);
      setRecoveryCode('');
      setRecoveryResendUntil(Date.now()+60000);
      addToast('Se solicitó otro código al WhatsApp registrado. El anterior deja de ser válido.', 'info');
    }catch(error){
      addToast(error instanceof Error?error.message:'No se pudo solicitar otro código','error');
    }finally{setBusy(false);}
  };
  const confirmRecoveryCode=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(busy)return;
    setBusy(true);
    try{
      const result=await verifyPasswordResetCode(recoveryChallenge,recoveryCode);
      setRecoveryToken(result.resetToken);
      setRecoveryStep('password');
      setRecoveryCode('');
      addToast('Código correcto. Ahora crea tu nueva contraseña.','success');
    }catch(error){addToast(error instanceof Error?error.message:'Código incorrecto o vencido','error');}
    finally{setBusy(false);}
  };
  const finishRecovery=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(busy)return;
    if(recoveryPassword.length<6||recoveryPassword!==recoveryConfirm){
      addToast('Escribe al menos 6 caracteres y verifica que ambas contraseñas coincidan.','error');return;
    }
    setBusy(true);
    try{
      await setPasswordWithWhatsApp(recoveryToken,recoveryPassword);
      setRecoveryStep(null);setRecoveryToken('');setRecoveryChallenge('');
      setRecoveryPassword('');setRecoveryConfirm('');setPassword('');
      addToast('¡Contraseña actualizada! Ya puedes iniciar sesión.','success');
    }catch(error){addToast(error instanceof Error?error.message:'No se pudo cambiar la contraseña','error');}
    finally{setBusy(false);}
  };

  if(recoveryStep)return (
    <main className="min-h-screen flex items-center justify-center bg-[#090909] px-4 py-10 text-white">
      <form onSubmit={recoveryStep==='code'?confirmRecoveryCode:finishRecovery}
        className="w-full max-w-md space-y-5 rounded-2xl border border-[#303030] bg-[#181818] p-6 sm:p-8">
        <div className="flex justify-center"><LockKeyhole className="h-8 w-8 text-[var(--gold-primary)]"/></div>
        <h1 className="text-center text-2xl font-bold">
          {recoveryStep==='code'?'Verifica tu WhatsApp':'Restablece tu contraseña'}
        </h1>
        <p className="text-center text-sm leading-relaxed text-neutral-400">
          {recoveryStep==='code'
            ?'Si tienes un celular registrado, recibirás allí un código de 8 dígitos. Expira en 5 minutos. No necesitas escribir +57.'
            :'Elige una nueva contraseña de mínimo 6 caracteres.'}
        </p>
        {recoveryStep==='code'?(
          <div className="space-y-2">
            <label htmlFor="recovery-whatsapp-code" className="text-sm">Código de WhatsApp</label>
            <input id="recovery-whatsapp-code" required autoFocus type="text" inputMode="numeric" autoComplete="one-time-code"
              pattern="[0-9]{8}" maxLength={8} value={recoveryCode}
              onChange={e=>setRecoveryCode(e.target.value.replace(/\D/g,''))}
              placeholder="00000000"
              className="w-full rounded-xl border border-neutral-600 bg-[#101010] px-4 py-3 text-center font-mono text-xl tracking-widest"/>
            <button type="button" disabled={busy||recoveryResendCountdown>0}
              onClick={()=>void resendRecoveryCode()}
              className="w-full rounded-lg border border-[var(--gold-primary)]/40 px-4 py-3 text-sm font-semibold text-[var(--gold-primary)] disabled:cursor-not-allowed disabled:opacity-50">
              {recoveryResendCountdown>0?'Reenviar código por WhatsApp ('+recoveryResendCountdown+' s)':'Reenviar código por WhatsApp'}
            </button>
            <p className="text-xs leading-relaxed text-neutral-400">
              ¿No llega el código? Pide al superadmin comprobar si tu celular aparece en otras cuentas.
              Un número compartido debe verificarse antes de permitir recuperar la contraseña.
            </p>
          </div>
        ):(
          <>
            <div className="space-y-2">
              <label htmlFor="recovery-new-password" className="text-sm">Nueva contraseña</label>
              <PasswordInput id="recovery-new-password" fieldLabel="nueva contraseña" required minLength={6}
                autoComplete="new-password" value={recoveryPassword} onChange={e=>setRecoveryPassword(e.target.value)}
                className="w-full rounded-xl border border-neutral-600 bg-[#101010] px-4 py-3 text-white"/>
            </div>
            <div className="space-y-2">
              <label htmlFor="recovery-confirm-password" className="text-sm">Confirma tu nueva contraseña</label>
              <PasswordInput id="recovery-confirm-password" fieldLabel="confirmación de contraseña" required minLength={6}
                autoComplete="new-password" value={recoveryConfirm} onChange={e=>setRecoveryConfirm(e.target.value)}
                className="w-full rounded-xl border border-neutral-600 bg-[#101010] px-4 py-3 text-white"/>
            </div>
            {recoveryPassword&&recoveryConfirm&&recoveryPassword!==recoveryConfirm&&
              <p role="alert" className="text-xs text-rose-300">Las contraseñas no coinciden.</p>}
          </>
        )}
        <button disabled={busy} type="submit"
          className="w-full rounded-xl bg-[var(--gold-primary)] px-4 py-3 font-bold text-black disabled:opacity-50">
          {busy?'Verificando…':recoveryStep==='code'?'Validar código':'Guardar nueva contraseña'}
        </button>
        <button type="button" onClick={()=>{setRecoveryStep(null);setRecoveryCode('');setRecoveryToken('');}}
          className="w-full text-center text-xs text-neutral-400 hover:text-white">Volver al inicio de sesión</button>
      </form>
    </main>
  );

  if(passwordSetup)return (
    <main className="min-h-screen flex items-center justify-center bg-[#090909] text-white px-4">
      <form onSubmit={finishSetup} className="w-full max-w-md rounded-2xl border border-[#303030] bg-[#181818] p-7 space-y-5">
        <h1 className="text-2xl font-bold">Activa tu cuenta BarberNow</h1>
        <p className="text-sm text-neutral-400">Define una contraseña para ingresar de manera segura. Debe contener al menos 6 caracteres.</p>
        <div className="space-y-2">
          <label htmlFor="setup-new-password" className="block text-sm">Nueva contraseña</label>
          <PasswordInput id="setup-new-password" fieldLabel="nueva contraseña" autoComplete="new-password" required minLength={6}
            value={newPassword} onChange={e=>setNewPassword(e.target.value)}
            className="block w-full rounded-xl bg-[#111] border border-[#333] px-4 py-3"/>
        </div>
        <div className="space-y-2">
          <label htmlFor="setup-confirm-password" className="block text-sm">Confirmar contraseña</label>
          <PasswordInput id="setup-confirm-password" fieldLabel="confirmación de contraseña" autoComplete="new-password" required minLength={6}
            value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}
            className="block w-full rounded-xl bg-[#111] border border-[#333] px-4 py-3"/>
        </div>
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
                <PasswordInput
                  id="barber-password"
                  fieldLabel="contraseña"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={mode === 'register' ? 8 : undefined}
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