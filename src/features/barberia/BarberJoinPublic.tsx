import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, LockKeyhole, LogOut } from 'lucide-react';
import {
  backendRequest,
  clearSession,
  getCachedUser,
  hasSession,
  registerWithEmail,
  signIn,
  updateAuthProfile
} from '../../services/liveBackend';

type JoinMode = 'register' | 'login' | 'profile';

/** QR público para profesionales: el propietario aprueba la solicitud en su panel. */
export function BarberJoinPublic() {
  const code = window.location.pathname.split('/')[2] || '';
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<JoinMode>('register');
  const [sessionActive, setSessionActive] = useState(() => hasSession());
  const [connectedUser, setConnectedUser] = useState(() => getCachedUser());
  const [name, setName] = useState(() => getCachedUser()?.name || '');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetch('/api/v1/public/barber-invites/' + encodeURIComponent(code), { signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Invitación inválida o vencida');
        if (!data.name) throw new Error('No se encontró la barbería de esta invitación');
        setTarget(data.name);
      })
      .catch(err => {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'No se pudo validar el código QR');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [code]);

  const switchMode = (next: 'register' | 'login') => {
    if (busy) return;
    setMode(next);
    setError('');
    setStatus('');
    setPassword('');
    setConfirmPassword('');
  };

  const changeAccount = () => {
    clearSession();
    setSessionActive(false);
    setConnectedUser(null);
    setMode('login');
    setName('');
    setPhone('');
    setEmail('');
    setPassword('');
    setConsent(false);
    setError('');
    setStatus('');
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !target || submitted) return;

    if (mode === 'register' && !sessionActive && password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (mode !== 'login' && !consent) {
      setError('Debes aceptar la vinculación para continuar.');
      return;
    }
    if (mode !== 'login' && (name.trim().length < 2 || phone.trim().length < 7)) {
      setError('Ingresa tu nombre completo y un teléfono de contacto válido.');
      return;
    }

    setBusy(true);
    setError('');
    setStatus('');
    try {
      if (!sessionActive) {
        if (mode === 'register') {
          await registerWithEmail(email.trim(), password, {
            fullName: name.trim(), phone: phone.trim()
          });
          try {
            await signIn(email.trim(), password);
          } catch {
            setMode('login');
            setPassword('');
            setConfirmPassword('');
            setStatus('Cuenta creada. Confirma tu correo si Supabase lo solicita y luego entra en «Ya tengo cuenta» para terminar la solicitud.');
            return;
          }
        } else {
          await signIn(email.trim(), password);
          setSessionActive(true);
          setConnectedUser(getCachedUser());
          setMode('profile');
          setPassword('');
          setStatus('Sesión iniciada. Completa tus datos para solicitar la vinculación.');
          return;
        }
        setSessionActive(true);
        setConnectedUser(getCachedUser());
        setPassword('');
        setConfirmPassword('');
      }

      // Los datos de contacto quedan en el perfil de Auth. La solicitud del
      // negocio conserva el contrato actual del backend: solo fullName.
      await updateAuthProfile({ fullName: name.trim(), phone: phone.trim() });
      await backendRequest('/barber-join/' + encodeURIComponent(code), {
        method: 'POST',
        body: JSON.stringify({ fullName: name.trim() })
      });
      setSubmitted(true);
      setStatus('¡Solicitud enviada! El propietario de ' + target + ' debe aprobar tu ingreso antes de que puedas acceder como barbero.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la solicitud. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const showProfile = sessionActive || mode === 'profile';
  const showContact = showProfile || mode === 'register';
  const inputClass = 'w-full rounded-xl border border-[#414141] bg-[#101010] px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-[#d7a940] focus:ring-1 focus:ring-[#d7a940]';
  const labelClass = 'mb-2 block text-xs font-medium text-neutral-200';

  return (
    <main data-testid="barber-join-public" className="min-h-screen bg-[#090909] px-4 py-8 text-white">
      <div className="mx-auto w-full max-w-[480px]">
        <a href="/" className="inline-block text-xs font-semibold text-[#dbac40] hover:underline">← BarberNow</a>
        <section className="mt-6 rounded-3xl border border-[#303030] bg-[#151515] px-6 py-8 shadow-2xl sm:px-8">
          <img src="/branding/barbernow-logo.png" alt="BarberNow" className="mx-auto mb-4 h-20 w-auto object-contain" draggable={false} />
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#ddb04b]">Vinculación por código QR</p>
            <h1 className="mt-2 break-words text-[22px] font-black leading-tight">{target || 'Conectando con tu barbería...'}</h1>
            <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-neutral-400">
              Únete al equipo profesional de esta barbería. Envía tu solicitud y espera la aprobación del propietario.
            </p>
          </div>

          {loading && <p role="status" className="mt-7 text-center text-sm text-neutral-400">Validando invitación...</p>}
          {error && <p role="alert" className="mt-5 rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200">{error}</p>}
          {status && <p role="status" className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-3 text-sm text-emerald-200">{status}</p>}

          {submitted ? (
            <div className="mt-6 flex flex-col items-center gap-3 text-center">
              <CheckCircle2 aria-hidden="true" className="h-10 w-10 text-emerald-400" />
              <p className="text-xs text-neutral-400">Puedes cerrar esta página. Tu solicitud quedará pendiente de revisión.</p>
            </div>
          ) : !!target && (
            <>
              {sessionActive ? (
                <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-[#343434] bg-[#202020] px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{connectedUser?.email || 'Sesión iniciada'}</p>
                    <p className="text-[11px] text-neutral-400">Cuenta conectada</p>
                  </div>
                  <button type="button" onClick={changeAccount} disabled={busy} className="flex shrink-0 items-center gap-1 text-xs text-[#ddb04b] hover:underline disabled:opacity-50">
                    <LogOut aria-hidden="true" className="h-3.5 w-3.5" /> Cambiar cuenta
                  </button>
                </div>
              ) : (
                <div role="group" aria-label="Tipo de acceso" className="mt-6 flex gap-1 rounded-xl bg-[#222222] p-1">
                  <button type="button" aria-pressed={mode === 'register'} onClick={() => switchMode('register')} disabled={busy}
                    className={'flex-1 rounded-lg px-2 py-2.5 text-xs transition-colors disabled:opacity-50 ' + (mode === 'register' ? 'bg-[#d6a940] font-bold text-black' : 'text-neutral-400 hover:text-white')}>
                    Crear cuenta
                  </button>
                  <button type="button" aria-pressed={mode === 'login'} onClick={() => switchMode('login')} disabled={busy}
                    className={'flex-1 rounded-lg px-2 py-2.5 text-xs transition-colors disabled:opacity-50 ' + (mode === 'login' ? 'bg-[#d6a940] font-bold text-black' : 'text-neutral-400 hover:text-white')}>
                    Ya tengo cuenta
                  </button>
                </div>
              )}

              <form onSubmit={e => void submit(e)} className="mt-4 space-y-4">
                {showContact && (
                  <>
                    <div>
                      <label htmlFor="barber-join-name" className={labelClass}>Nombre y apellidos completos</label>
                      <input id="barber-join-name" className={inputClass} required minLength={2} maxLength={120} autoComplete="name"
                        value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre completo" />
                    </div>
                    <div>
                      <label htmlFor="barber-join-phone" className={labelClass}>Teléfono de contacto</label>
                      <input id="barber-join-phone" className={inputClass} type="tel" required minLength={7} maxLength={32} autoComplete="tel" inputMode="tel"
                        value={phone} onChange={e => setPhone(e.target.value)} placeholder="+57 300 123 4567" />
                    </div>
                  </>
                )}
                {!sessionActive && mode !== 'profile' && (
                  <>
                    <div>
                      <label htmlFor="barber-join-email" className={labelClass}>Correo electrónico</label>
                      <input id="barber-join-email" className={inputClass} type="email" required autoComplete="email"
                        value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com" />
                    </div>
                    <div>
                      <label htmlFor="barber-join-password" className={labelClass}>Contraseña {mode === 'register' ? '(mínimo 8 caracteres)' : ''}</label>
                      <input id="barber-join-password" className={inputClass} type="password" required
                        autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={mode === 'register' ? 8 : undefined}
                        value={password} onChange={e => setPassword(e.target.value)} />
                    </div>
                    {mode === 'register' && (
                      <div>
                        <label htmlFor="barber-join-confirm" className={labelClass}>Confirmar contraseña</label>
                        <input id="barber-join-confirm" className={inputClass} type="password" required minLength={8} autoComplete="new-password"
                          value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                      </div>
                    )}
                  </>
                )}
                {showContact && (
                  <label className="flex cursor-pointer items-start gap-2.5 text-[11px] leading-relaxed text-neutral-400">
                    <input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5 accent-[#d6a940]" />
                    <span>Acepto solicitar mi vinculación con {target} y compartir los datos necesarios para gestionar mi incorporación al equipo.</span>
                  </label>
                )}
                <button type="submit" disabled={busy || !target} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d6a940] px-4 py-3.5 text-sm font-extrabold text-black transition-colors hover:bg-[#edbd54] disabled:cursor-not-allowed disabled:opacity-50">
                  {busy ? 'Procesando...' : showProfile ? 'Solicitar vinculación' : mode === 'register' ? 'Registrarme y vincular' : 'Ingresar y continuar'}
                  {!busy && <ArrowRight aria-hidden="true" className="h-4 w-4" />}
                </button>
                <p className="text-center text-[11px] leading-relaxed text-neutral-500">
                  <LockKeyhole aria-hidden="true" className="mr-1 inline h-3 w-3" />
                  Tu contraseña se verifica con Supabase Auth, no se guarda en la barbería.
                </p>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
