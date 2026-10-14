import React from 'react';
import {isLiveBackend} from './services/liveBackend';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/common/Header';
import { RoleSwitcherBar } from './components/common/RoleSwitcherBar';
import { PaletteValidatorModal } from './components/common/PaletteValidatorModal';
import { ToastContainer } from './components/common/ToastContainer';

// Auth View
import { LoginView } from './features/auth/LoginView';

// Superadmin Views
import { AdminLayout } from './features/admin/AdminLayout';
import { AdminInicio } from './features/admin/AdminInicio';
import { AdminDashboard } from './features/admin/AdminDashboard';
import { AdminUsers } from './features/admin/AdminUsers';
import { AdminBarbershops } from './features/admin/AdminBarbershops';
import { AdminSubscriptions } from './features/admin/AdminSubscriptions';
import { AdminPlans } from './features/admin/AdminPlans';
import { AdminCommercialEditor } from './features/admin/AdminCommercialEditor';
import { AdminAdministrators } from './features/admin/AdminAdministrators';

// Barbershop Owner Views
import { BarberiaLayout } from './features/barberia/BarberiaLayout';
import { BarberiaInicio } from './features/barberia/BarberiaInicio';
import { BarberiaDashboard } from './features/barberia/BarberiaDashboard';
import { BarberiaAgenda } from './features/barberia/BarberiaAgenda';
import { BarberiaContabilidad } from './features/barberia/BarberiaContabilidad';
import { BarberiaBarberos } from './features/barberia/BarberiaBarberos';
import { BarberiaClientes } from './features/barberia/BarberiaClientes';
import { BarberiaBoutique } from './features/barberia/BarberiaBoutique';
import { BarberiaServicios } from './features/barberia/BarberiaServicios';
import { BarberiaPerfil } from './features/barberia/BarberiaPerfil';
import { BarberiaQRView } from './features/barberia/BarberiaQRView';
import { BarberiaResenas } from './features/barberia/BarberiaResenas';
import { BarberiaReportes } from './features/barberia/BarberiaReportes';

// Independent Barber Views
import { BarberoLayout } from './features/barbero/BarberoLayout';
import { BarberoInicio } from './features/barbero/BarberoInicio';
import { BarberoDashboard } from './features/barbero/BarberoDashboard';
import { BarberoAgenda } from './features/barbero/BarberoAgenda';
import { BarberoPerfil } from './features/barbero/BarberoPerfil';

// Client Portal Views
import { ClienteLayout } from './features/clientes/ClienteLayout';
import { ClienteInicio } from './features/clientes/ClienteInicio';
import { ClienteDashboard } from './features/clientes/ClienteDashboard';
import { ClienteReservas } from './features/clientes/ClienteReservas';
import { ClienteSalaEspera } from './features/clientes/ClienteSalaEspera';
import { ClienteFidelizacion } from './features/clientes/ClienteFidelizacion';
import { ClienteHistorial } from './features/clientes/ClienteHistorial';
import { ClienteQRScanner } from './features/clientes/ClienteQRScanner';
import { ClientePerfil } from './features/clientes/ClientePerfil';

const AppContent: React.FC = () => {
  const { activeRoute, currentUser } = useApp();

  // If on login route or not logged in
  if (activeRoute === '/login' || (!currentUser && !activeRoute.startsWith('/vincular'))) {
    return <LoginView />;
  }

  // Real data permissions always come from Supabase membership, never a hash URL.
  if(isLiveBackend&&activeRoute.startsWith('/admin')&&currentUser?.role!=='superadmin')return <LoginView />;
  if(isLiveBackend&&activeRoute.startsWith('/barberia/')&&currentUser?.role!=='owner')return <LoginView />;
  if(isLiveBackend&&activeRoute.startsWith('/barbero/')&&
    !['barber_employee','barber_independent','owner'].includes(currentUser?.role||''))return <LoginView />;

  // --- Area 1: Administrador Global ---
  if (activeRoute.startsWith('/admin')) {
    let child = <AdminInicio />;
    if (activeRoute.includes('/dashboard')) child = <AdminDashboard />;
    else if (activeRoute.includes('/usuarios')) child = <AdminUsers />;
    else if (activeRoute.includes('/franquicias')) child = <AdminBarbershops />;
    else if (activeRoute.includes('/suscripciones')) child = <AdminSubscriptions />;
    else if (activeRoute.includes('/planes')) child = <AdminPlans />;
    else if (activeRoute.includes('/editor-comercial')) child = <AdminCommercialEditor />;
    else if (activeRoute.includes('/administradores')) child = <AdminAdministrators />;
    else if (activeRoute.includes('/inicio') || activeRoute === '/admin') child = <AdminInicio />;

    return (
      <AdminLayout>
        {child}
      </AdminLayout>
    );
  }

  // --- Area 2: Propietarios y Administradores de Barberías ---
  if (activeRoute.startsWith('/barberia/')) {
    const subRoute = activeRoute.split('/')[3] || 'inicio';
    let child = <BarberiaInicio />;
    if (subRoute === 'dashboard') child = <BarberiaDashboard />;
    else if (subRoute === 'inicio') child = <BarberiaInicio />;
    else if (subRoute === 'agenda') child = <BarberiaAgenda />;
    else if (subRoute === 'contabilidad') child = <BarberiaContabilidad />;
    else if (subRoute === 'barberos') child = <BarberiaBarberos />;
    else if (subRoute === 'clientes') child = <BarberiaClientes />;
    else if (subRoute === 'boutique') child = <BarberiaBoutique />;
    else if (subRoute === 'servicios') child = <BarberiaServicios />;
    else if (subRoute === 'perfil') child = <BarberiaPerfil />;
    else if (subRoute === 'qr') child = <BarberiaQRView />;
    else if (subRoute === 'resenas') child = <BarberiaResenas />;
    else if (subRoute === 'reportes') child = <BarberiaReportes />;

    return (
      <BarberiaLayout>
        {child}
      </BarberiaLayout>
    );
  }

  // --- Area 3: Barberos Independientes ---
  if (activeRoute.startsWith('/barbero/')) {
    const subRoute = activeRoute.split('/')[3] || 'inicio';
    let child = <BarberoInicio />;
    if (subRoute === 'dashboard') child = <BarberoDashboard />;
    else if (subRoute === 'inicio') child = <BarberoInicio />;
    else if (subRoute === 'agenda') child = <BarberoAgenda />;
    else if (subRoute === 'contabilidad') child = <BarberiaContabilidad />; // Reusing accounting module for independent cash
    else if (subRoute === 'clientes') child = <BarberiaClientes />;
    else if (subRoute === 'boutique') child = <BarberiaBoutique />;
    else if (subRoute === 'servicios') child = <BarberiaServicios />;
    else if (subRoute === 'perfil') child = <BarberoPerfil />;
    else if (subRoute === 'qr') child = <BarberiaQRView />;

    return (
      <BarberoLayout>
        {child}
      </BarberoLayout>
    );
  }

  // --- Area 4: Portal de Clientes ---
  if (activeRoute.startsWith('/clientes') || activeRoute.startsWith('/vincular')) {
    let child = <ClienteInicio />;
    if (activeRoute.includes('/dashboard')) child = <ClienteDashboard />;
    else if (activeRoute.includes('/citas/nueva')) child = <ClienteReservas />;
    else if (activeRoute.includes('/sala-espera')) child = <ClienteSalaEspera />;
    else if (activeRoute.includes('/fidelizacion')) child = <ClienteFidelizacion />;
    else if (activeRoute.includes('/historial') || activeRoute.includes('/resenas')) child = <ClienteHistorial />;
    else if (activeRoute.includes('/vincular') || activeRoute.includes('/qr')) child = <ClienteQRScanner />;
    else if (activeRoute.includes('/perfil')) child = <ClientePerfil />;
    else if (activeRoute.includes('/inicio') || activeRoute === '/clientes') child = <ClienteInicio />;

    return (
      <ClienteLayout>
        {child}
      </ClienteLayout>
    );
  }

  // Fallback
  return <LoginView />;
};

// The reference login is full-bleed, without the application's global bars.
// All existing authenticated views still render the same Header/RoleSwitcher as before.
const AppFrame: React.FC = () => {
  const { activeRoute, currentUser } = useApp();
  const deniedRealRoute = Boolean(isLiveBackend && currentUser && (
    (activeRoute.startsWith('/admin') && currentUser.role !== 'superadmin') ||
    (activeRoute.startsWith('/barberia/') && currentUser.role !== 'owner') ||
    (activeRoute.startsWith('/barbero/') &&
      !['barber_employee', 'barber_independent', 'owner'].includes(currentUser.role))
  ));
  const isLogin = activeRoute === '/login'
    || (!currentUser && !activeRoute.startsWith('/vincular')) || deniedRealRoute;
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col font-sans">
      {!isLogin && <Header />}
      <div className="flex-1">
        <AppContent />
      </div>
      {!isLogin && <RoleSwitcherBar />}
      <PaletteValidatorModal />
      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppFrame />
    </AppProvider>
  );
}
