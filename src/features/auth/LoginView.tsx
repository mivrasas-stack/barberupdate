import React, { useState } from 'react';
import { ArrowRight, LockKeyhole, Mail } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { UserRole } from '../../types';
import { isLiveBackend, requestPasswordReset, registerWithEmail } from '../../services/liveBackend';

/**
 * Login only. Reproduces the Barber Paradise visual supplied by the owner.
 * No changes to the rest of the application's layouts, palette or components.
 */
export const LoginView: React.FC = () => {
  const { state, loginAs, loginWithCredentials, addToast } = useApp();
  const [email, setEmail] = useState(isLiveBackend ? '' : 'contacto@barberclub.co');
  const [password, setPassword] = useState(isLiveBackend ? '' : '••••••••••••');
  const selectedRole: UserRole = 'owner';
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [busy, setBusy] = useState(false);

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
    try {
      await requestPasswordReset(email.trim());
      addToast('Si existe la cuenta, recibirás instrucciones para recuperar tu contraseña.', 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'No fue posible solicitar la recuperación', 'error');
    }
  };

  const landing = import.meta.env.VITE_PUBLIC_LANDING_URL as string | undefined;

  return (
    <main
      data-testid="barber-paradise-login"
      className="min-h-screen w-full bg-[#080808] text-white lg:flex"
      style={{ fontFamily: "'Inter', 'Montserrat', system-ui, sans-serif" }}
    >
      {/* Exact Barber Paradise photographic panel from the provided reference.
          The brand inscription is already part of this photo. */}
      <section
        aria-label="Barber Paradise, exclusividad y estilo"
        className="relative h-[35vh] min-h-[240px] w-full overflow-hidden bg-[#070707] lg:sticky lg:top-0 lg:h-screen lg:w-1/2 lg:min-h-[640px] lg:shrink-0"
      >
        <img
          src="/images/barber-paradise-login.webp"
          alt="Interior en blanco y negro de Barber Paradise, con sillón de barbero y paredes de ladrillo"
          className="absolute inset-0 h-full w-full object-cover object-center"
          draggable={false}
        />
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
              {mode === 'login' ? 'Ingresa con tus credenciales verificadas.' : 'Únete a la experiencia Barber Paradise.'}
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
                <input
                  id="barber-password"
                  type="password"
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
              <p className="mt-[24px] text-[12px] font-semibold uppercase tracking-[0.6px] text-[#585858]">
                Volver a la página web
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
};
