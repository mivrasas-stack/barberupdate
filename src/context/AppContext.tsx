import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  User,
  UserRole,
  Barbershop,
  Barber,
  CurrencyType,
  ThemePalette,
  Appointment,
  Transaction,
  CashClosing,
  Product,
  Order,
  Review,
  SubscriptionPlan,
  CommercialPageConfig,
} from '../types';
import { barberStore, BarberOSState } from '../services/store';

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppContextType {
  // Auth & Roles
  currentUser: User | null;
  activeRole: UserRole;
  loginAs: (user: User) => void;
  logout: () => void;
  switchRolePersona: (role: UserRole) => void;

  // Active Context Entities
  currentShop: Barbershop | null;
  setCurrentShopSlug: (slug: string) => void;
  currentBarber: Barber | null;
  setCurrentBarberSlug: (slug: string) => void;

  // Navigation
  activeRoute: string;
  navigate: (route: string) => void;

  // Store Entities (Reactive)
  state: BarberOSState;

  // Theme & Color Palette
  activePalette: ThemePalette;
  allPalettes: ThemePalette[];
  setActivePalette: (paletteId: string) => void;
  updateCustomPalette: (palette: ThemePalette) => void;
  isPaletteModalOpen: boolean;
  setIsPaletteModalOpen: (open: boolean) => void;

  // Currency & Formats
  currency: CurrencyType;
  setCurrency: (c: CurrencyType) => void;

  // Toasts
  toasts: ToastItem[];
  addToast: (message: string, type?: ToastItem['type']) => void;
  removeToast: (id: string) => void;

  // Reset demo
  resetDemoData: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [storeState, setStoreState] = useState<BarberOSState>(barberStore.getState());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeRoute, setActiveRoute] = useState<string>('/login');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isPaletteModalOpen, setIsPaletteModalOpen] = useState<boolean>(false);

  // Subscribe to store updates
  useEffect(() => {
    const unsubscribe = barberStore.subscribe(() => {
      setStoreState({ ...barberStore.getState() });
    });
    return unsubscribe;
  }, []);

  // Update CSS Variables when active palette changes
  const activePalette = useMemo(() => {
    return (
      storeState.palettes.find(p => p.id === storeState.activePaletteId) ||
      storeState.palettes[0]
    );
  }, [storeState.palettes, storeState.activePaletteId]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--bg-primary', activePalette.bgPrimary);
    root.style.setProperty('--bg-surface', activePalette.bgSurface);
    root.style.setProperty('--bg-surface-elevated', activePalette.bgSurfaceElevated);
    root.style.setProperty('--border-subtle', activePalette.borderSubtle);
    root.style.setProperty('--gold-primary', activePalette.goldPrimary);
    root.style.setProperty('--gold-hover', activePalette.goldHover);
    root.style.setProperty('--text-primary', activePalette.textPrimary);
    root.style.setProperty('--text-muted', activePalette.textMuted);
  }, [activePalette]);

  // Handle URL hash changes for direct routing & bookmarking
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash && hash !== activeRoute) {
        setActiveRoute(hash);
      }
    };
    if (window.location.hash) {
      handleHashChange();
    }
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [activeRoute]);

  const navigate = (route: string) => {
    setActiveRoute(route);
    window.location.hash = route;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addToast = (message: string, type: ToastItem['type'] = 'info') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const loginAs = (user: User) => {
    setCurrentUser(user);
    addToast(`Sesión iniciada como ${user.name} (${getRoleLabel(user.role)})`, 'success');

    // Route to user's home space
    if (user.role === 'superadmin') {
      navigate('/admin/inicio');
    } else if (user.role === 'owner') {
      const shop = storeState.barbershops.find(s => s.id === user.businessId) || storeState.barbershops[0];
      navigate(`/barberia/${shop.slug}/inicio`);
    } else if (user.role === 'barber_employee') {
      const barber = storeState.barbers.find(b => b.id === user.barberId) || storeState.barbers[0];
      navigate(`/barbero/${barber?.slug || 'carlos-mendoza'}/inicio`);
    } else if (user.role === 'barber_independent') {
      const barber = storeState.barbers.find(b => b.id === user.barberId) || storeState.barbers.find(b => b.isIndependent);
      navigate(`/barbero/${barber?.slug || 'alex-fade'}/inicio`);
    } else {
      navigate('/clientes/inicio');
    }
  };

  const logout = () => {
    setCurrentUser(null);
    navigate('/login');
    addToast('Sesión cerrada correctamente', 'info');
  };

  const switchRolePersona = (role: UserRole) => {
    const targetUser = storeState.users.find(u => u.role === role);
    if (targetUser) {
      loginAs(targetUser);
    }
  };

  const currentShop = useMemo(() => {
    if (activeRoute.startsWith('/barberia/')) {
      const parts = activeRoute.split('/');
      const slug = parts[2];
      const match = storeState.barbershops.find(s => s.slug === slug);
      if (match) return match;
    }
    if (currentUser?.businessId) {
      return storeState.barbershops.find(s => s.id === currentUser.businessId) || storeState.barbershops[0];
    }
    return storeState.barbershops[0];
  }, [activeRoute, currentUser, storeState.barbershops]);

  const setCurrentShopSlug = (slug: string) => {
    const currentSub = activeRoute.split('/').slice(3).join('/') || 'dashboard';
    navigate(`/barberia/${slug}/${currentSub}`);
  };

  const currentBarber = useMemo(() => {
    if (activeRoute.startsWith('/barbero/')) {
      const parts = activeRoute.split('/');
      const slug = parts[2];
      const match = storeState.barbers.find(b => b.slug === slug);
      if (match) return match;
    }
    if (currentUser?.barberId) {
      return storeState.barbers.find(b => b.id === currentUser.barberId) || null;
    }
    return storeState.barbers.find(b => b.isIndependent) || storeState.barbers[0];
  }, [activeRoute, currentUser, storeState.barbers]);

  const setCurrentBarberSlug = (slug: string) => {
    const currentSub = activeRoute.split('/').slice(3).join('/') || 'dashboard';
    navigate(`/barbero/${slug}/${currentSub}`);
  };

  const resetDemoData = () => {
    barberStore.resetToFactory();
    addToast('Datos de demostración reiniciados al estado original', 'info');
  };

  const activeRole: UserRole = currentUser?.role || 'client';

  return (
    <AppContext.Provider
      value={{
        currentUser,
        activeRole,
        loginAs,
        logout,
        switchRolePersona,
        currentShop,
        setCurrentShopSlug,
        currentBarber,
        setCurrentBarberSlug,
        activeRoute,
        navigate,
        state: storeState,
        activePalette,
        allPalettes: storeState.palettes,
        setActivePalette: (id: string) => barberStore.setActivePalette(id),
        updateCustomPalette: (p: ThemePalette) => barberStore.updatePaletteCustom(p),
        isPaletteModalOpen,
        setIsPaletteModalOpen,
        currency: storeState.currency,
        setCurrency: (c: CurrencyType) => barberStore.setCurrency(c),
        toasts,
        addToast,
        removeToast,
        resetDemoData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

const getRoleLabel = (role: UserRole): string => {
  switch (role) {
    case 'superadmin':
      return 'Superadministrador';
    case 'owner':
      return 'Propietario de Barbería';
    case 'barber_employee':
      return 'Barbero Asociado';
    case 'barber_independent':
      return 'Barbero Independiente';
    case 'client':
      return 'Cliente';
  }
};
