import React, { useEffect, useState } from 'react';
import { ArrowRight, LockKeyhole, Mail, Scissors, User, Phone, CheckCircle2, AlertCircle, LogOut, ShieldCheck } from 'lucide-react';
import { hasSession, signIn, registerWithEmail, backendRequest, getCachedUser, clearSession } from '../../services/liveBackend';

export function BarberJoinPublic() {
  const code = location.pathname.split('/')[2] || '';
  const [target, setTarget] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sessionActive, setSessionActive] = useState(() => hasSession());
  const [connectedUser, setConnectedUser] = useState(() => getCachedUser());

  useEffect(() => {
    if (!code) return;
    fetch('/api/v1/public/barber-invites/' + encodeURIComponent(code))
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Invitación no válida');
        setTarget(d.name);
      })
      .catch(e => setError(e instanceof Error ? e.message : String(e)));
  }, [code]);

  const handleLogout = () => {
    clearSession();
    setSessionActive(false);
    setConnectedUser(null);
    setMessage('');
    setError('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    if (mode === 'register' && !sessionActive) {
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden');
        return;
      }
      if (password.length < 8) {
        setError('La contraseña debe tener mínimo 8 caracteres');
        return;
      }
    }

    setBusy(true);
    setMessage('');
    setError('');

    try {
      if (!sessionActive) {
        if (mode === 'register') {
          await registerWithEmail(email.trim(), password);
          if (!hasSession()) {
            await signIn(email.trim(), password);
          }
        } else {
          await signIn(email.trim(), password);
        }
        setSessionActive(hasSession());
        setConnectedUser(getCachedUser());
      }

      await backendRequest('/barber-join/' + encodeURIComponent(code), {
        method: 'POST',
        body: JSON.stringify({ fullName: name.trim() || connectedUser?.name || 'Barbero Profesional' })
      });

      setMessage('¡Solicitud enviada con éxito! El propietario de ' + (target || 'la barbería') + ' debe aprobar tu vinculación.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar la solicitud');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main
      data-testid="barber-join-public"
      className="min-h-screen w-full bg-[#080808] text-white lg:flex"
      style={{ fontFamily: "'Inter', 'Montserrat', system-ui, sans-serif" }}
    >
      {/* Left-side hero matching Barber Paradise Login visual */}
      <section
        aria-label="Barber Paradise, exclusividad y estilo"
        className="relative h-[35vh] min-h-[240px] w-full overflow-hidden bg-[#070707] lg:sticky lg:top-0 lg:h-screen lg:w-1/2 lg:min-h-[640px] lg:shrink-0"
      >
        <img
          src="/images/barber-paradise-atmosphere.webp"
          alt="Barbería Barber Paradise, con sillones de barbero y paredes de ladrillo"
          className="absolute inset-0 h-full w-full object-cover object-center grayscale brightness-[0.42]"
          draggable={false}
        />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/25 to-black/10" />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
          <strong className="text-[clamp(20px,2.2vw,39px)] font-extrabold tracking-[0.24em] text-white drop-shadow-lg">
            BARBER PARADISE
          </strong>
          <span className="mt-5 text-[clamp(9px,0.9vw,15px)] tracking-[0.08em] text-gray-300">
            ÚNETE AL EQUIPO PROFESIONAL
          </span>
        </div>
      </section>

      {/* Right-side form container */}
      <section className="flex min-h-[65vh] w-full items-start justify-center bg-[#090909] px-4 pb-10 pt-5 sm:px-8 lg:min-h-screen lg:w-1/2 lg:px-8 lg:pt-[39px]">
        <div className="w-full max-w-[460px] rounded-[24px] border border-[#242424] bg-[#181818] px-[40px] pb-[38px] pt-[38px] shadow-[0_22px_54px_rgba(0,0,0,0.22)] max-[480px]:px-6">
          <div className="mb-[20px] flex justify-center">
            <div className="flex h-[48px] w-[48px] items-center justify-center rounded-full bg-[#222222]">
              <Scissors aria-hidden="true" className="h-[20px] w-[20px] text-[#e5a700]" strokeWidth={1.8} />
            </div>
          </div>

          <div className="mb-[24px] text-center">
            <h1 className="text-[28px] font-[850] uppercase leading-[1.1] tracking-[-0.8px] max-[420px]:text-[22px]">
              <span className="block text-[#f6f6f6]">UNIRSE AL EQUIPO DE</span>
              <span className="mt-[3px] block text-[#e5a700] break-words">
                {target || 'Barbería'}
              </span>
            </h1>
            <p className="mt-[10px] text-[13px] font-normal text-[#aaaaaa]">
              Envía tu postulación para integrarte al equipo y gestionar tus turnos.
            </p>
          </div>

          {/* If there's already an active session */}
          {sessionActive ? (
            <div className="space-y-5">
              <div className="rounded-[14px] bg-[#121212] border border-[#2a2a2a] p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#242424] flex items-center justify-center text-[var(--gold-primary)] font-bold text-sm">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>{connectedUser?.name || 'Sesión activa'}</span>
                      <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                        Conectado
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-400">{connectedUser?.email || 'Cuenta autenticada'}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Cerrar sesión e ingresar con otra cuenta"
                  className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={e => void submit(e)} className="space-y-4">
                <div>
                  <label
                    htmlFor="barber-fullname-active"
                    className="mb-[8px] block text-[10px] font-extrabold uppercase tracking-[1.8px] text-[#878787]"
                  >
                    Nombre profesional con el que te conocerán
                  </label>
                  <div className="relative">
                    <User aria-hidden="true" className="absolute left-[16px] top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#666666]" />
                    <input
                      id="barber-fullname-active"
                      type="text"
                      required
                      minLength={2}
                      value={name || connectedUser?.name || ''}
                      onChange={e => setName(e.target.value)}
                      placeholder="Tu nombre y apellidos"
                      className="h-[54px] w-full rounded-[12px] border border-[#252525] bg-[#111111] pl-[45px] pr-4 text-[13px] font-semibold text-[#f4f4f4] outline-none focus:border-[#b77d0a]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy || !target}
                  className="flex h-[50px] w-full items-center justify-center gap-2 rounded-[13px] bg-gradient-to-r from-[#ffba15] to-[#f29a00] text-[12px] font-extrabold uppercase tracking-[1px] text-[#0c0905] shadow-[0_7px_22px_rgba(239,159,0,0.14)] transition-[filter,transform] hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
                >
                  {busy ? 'ENVIANDO...' : 'SOLICITAR VINCULACIÓN AHORA'}
                  {!busy && <ArrowRight className="h-[16px] w-[16px]" />}
                </button>
              </form>
            </div>
          ) : (
            <>
              {/* Mode Switcher Tabs */}
              <div className="mb-[20px] grid grid-cols-2 gap-1.5 rounded-[12px] bg-[#111111] p-1.5 border border-[#252525]">
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setMessage('');
                    setError('');
                  }}
                  className={`h-[36px] rounded-[9px] text-[11px] font-extrabold uppercase tracking-[0.8px] transition-all ${
                    mode === 'register'
                      ? 'bg-[#222222] text-[#ffba15] shadow-sm'
                      : 'text-[#878787] hover:text-[#cccccc]'
                  }`}
                >
                  Crear cuenta
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setMessage('');
                    setError('');
                  }}
                  className={`h-[36px] rounded-[9px] text-[11px] font-extrabold uppercase tracking-[0.8px] transition-all ${
                    mode === 'login'
                      ? 'bg-[#222222] text-[#ffba15] shadow-sm'
                      : 'text-[#878787] hover:text-[#cccccc]'
                  }`}
                >
                  Ya tengo cuenta
                </button>
              </div>

              <form onSubmit={e => void submit(e)} className="space-y-[18px]">
                {mode === 'register' && (
                  <div>
                    <label
                      htmlFor="barber-fullname"
                      className="mb-[8px] block text-[10px] font-extrabold uppercase tracking-[1.8px] text-[#878787]"
                    >
                      Nombre completo
                    </label>
                    <div className="relative">
                      <User aria-hidden="true" className="absolute left-[16px] top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#666666]" />
                      <input
                        id="barber-fullname"
                        type="text"
                        required
                        minLength={2}
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Tu nombre y apellidos"
                        className="h-[52px] w-full rounded-[12px] border border-[#252525] bg-[#111111] pl-[45px] pr-4 text-[13px] font-semibold text-[#f4f4f4] outline-none placeholder:text-[#6b6b6b] focus:border-[#b77d0a]"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="barber-email"
                    className="mb-[8px] block text-[10px] font-extrabold uppercase tracking-[1.8px] text-[#878787]"
                  >
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <Mail aria-hidden="true" className="absolute left-[16px] top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#666666]" />
                    <input
                      id="barber-email"
                      type="email"
                      autoComplete="username"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="tu@correo.com"
                      className="h-[52px] w-full rounded-[12px] border border-[#252525] bg-[#111111] pl-[45px] pr-4 text-[13px] font-semibold text-[#f4f4f4] outline-none placeholder:text-[#6b6b6b] focus:border-[#b77d0a]"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="barber-password"
                    className="mb-[8px] block text-[10px] font-extrabold uppercase tracking-[1.8px] text-[#878787]"
                  >
                    Contraseña {mode === 'register' ? '(mínimo 8 caracteres)' : ''}
                  </label>
                  <div className="relative">
                    <LockKeyhole aria-hidden="true" className="absolute left-[16px] top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#666666]" />
                    <input
                      id="barber-password"
                      type="password"
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      required
                      minLength={mode === 'register' ? 8 : undefined}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-[52px] w-full rounded-[12px] border border-[#252525] bg-[#111111] pl-[45px] pr-4 text-[13px] font-semibold text-[#f4f4f4] outline-none placeholder:text-[#696969] focus:border-[#b77d0a]"
                    />
                  </div>
                </div>

                {mode === 'register' && (
                  <div>
                    <label
                      htmlFor="barber-confirm-password"
                      className="mb-[8px] block text-[10px] font-extrabold uppercase tracking-[1.8px] text-[#878787]"
                    >
                      Confirmar contraseña
                    </label>
                    <div className="relative">
                      <LockKeyhole aria-hidden="true" className="absolute left-[16px] top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#666666]" />
                      <input
                        id="barber-confirm-password"
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={8}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="h-[52px] w-full rounded-[12px] border border-[#252525] bg-[#111111] pl-[45px] pr-4 text-[13px] font-semibold text-[#f4f4f4] outline-none placeholder:text-[#696969] focus:border-[#b77d0a]"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy || !target}
                  className="flex h-[50px] w-full items-center justify-center gap-3 rounded-[13px] bg-gradient-to-r from-[#ffba15] to-[#f29a00] text-[12px] font-extrabold uppercase tracking-[1px] text-[#0c0905] shadow-[0_7px_22px_rgba(239,159,0,0.14)] transition-[filter,transform] hover:brightness-110 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
                >
                  {busy ? 'PROCESANDO...' : mode === 'register' ? 'REGISTRARME Y SOLICITAR' : 'INGRESAR Y VINCULARME'}
                  {!busy && <ArrowRight aria-hidden="true" className="h-[16px] w-[16px]" strokeWidth={2.2} />}
                </button>
              </form>
            </>
          )}

          {message && (
            <div
              role="status"
              className="mt-5 flex items-start gap-3 rounded-[12px] border border-amber-500/30 bg-amber-950/20 p-3.5 text-[13px] text-amber-200"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <span>{message}</span>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-3 rounded-[12px] border border-red-500/30 bg-red-950/20 p-3.5 text-[13px] text-red-200"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-[24px] border-t border-[#272727] pt-[16px] text-center">
            <a
              href="/login"
              className="block text-[11px] font-semibold uppercase tracking-[0.6px] text-[#606060] hover:text-[#b7b7b7]"
            >
              Ir al inicio de sesión general
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
