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
import {isLiveBackend, signIn, signOut, clearSession, hasSession, loadAccount, backendRequest, registerOwnedShop, getCachedUser, setCachedUser} from '../services/liveBackend';

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
  loginWithCredentials: (email: string, password: string, requestedRole?: UserRole) => Promise<void>;
  logout: () => void;
  switchRolePersona: (role: UserRole) => void;

  // Active Context Entities
  currentShop: Barbershop | null;
  setCurrentShopSlug: (slug: string) => void;
  currentBarber: Barber | null;
  setCurrentBarberSlug: (slug: string) => void;

  // Navigation
  activeRoute: string;
  restoringSession: boolean;
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
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    return isLiveBackend && hasSession() ? getCachedUser() : null;
  });
  const [restoringSession, setRestoringSession] = useState(isLiveBackend && hasSession());
  const [activeRoute, setActiveRoute] = useState<string>(() => {
    return window.location.hash ? window.location.hash.slice(1) : '/login';
  });
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
    if(isLiveBackend){addToast('Ingresa con tu correo y contraseña reales. Los perfiles de demostración no dan acceso.', 'error');return;}
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

  const loginWithCredentials = async (email: string, password: string, requestedRole?: UserRole) => {
    if(!isLiveBackend)throw Error('El modo de datos reales no está configurado.');
    await signIn(email,password);
    try{
      let data=await loadAccount();
      // In real mode, authorize by the server-resolved role, never the login UI hint.
      if(data.user.role==='owner'&&data.shops.length===0){
        const shopName=window.prompt('Tu cuenta no tiene una barbería. Escribe el nombre para crearla:');
        if(shopName?.trim()){
          await registerOwnedShop(shopName);
          data=await loadAccount();
        }
      }
      barberStore.hydrateFromBackend({users:[data.user],barbershops:data.shops,barbers:data.barbers,
        services:data.services,products:data.products,appointments:data.appointments,
        transactions:data.transactions,orders:data.orders,plans:data.plans,cashClosings:data.cashClosings,reviews:data.reviews,loyalty:data.loyalty,loyaltyBalances:data.loyaltyBalances,rewards:data.rewards,redemptions:data.redemptions});
      setCurrentUser(data.user);
      setCachedUser(data.user);
      if(data.user.role==='owner')navigate(data.shops[0]?'/barberia/'+data.shops[0].slug+'/inicio':'/clientes/inicio');
      else if(data.user.role==='superadmin')navigate('/admin/inicio');
      else if(data.user.role==='barber_employee'||data.user.role==='barber_independent')
        navigate('/barbero/'+(data.barbers.find(b=>b.id===data.user.barberId)?.slug||data.barbers[0]?.slug||'barbero')+'/inicio');
      else navigate('/clientes/inicio');
      addToast('Sesión real iniciada correctamente', 'success');
    }catch(error){clearSession();setCachedUser(null);throw error;}
  };

  useEffect(()=>{
    if(!isLiveBackend||!hasSession()){setRestoringSession(false);return;}
    let alive=true;
    loadAccount().then(data=>{
      if(!alive)return;
      barberStore.hydrateFromBackend({users:[data.user],barbershops:data.shops,barbers:data.barbers,
        services:data.services,products:data.products,appointments:data.appointments,
        transactions:data.transactions,orders:data.orders,plans:data.plans,cashClosings:data.cashClosings,reviews:data.reviews,loyalty:data.loyalty,loyaltyBalances:data.loyaltyBalances,rewards:data.rewards,redemptions:data.redemptions});
      setCurrentUser(data.user);
      setCachedUser(data.user);
      const currentHash = window.location.hash.slice(1);
      if(!currentHash || currentHash === '/login'){
        if(data.user.role==='owner'&&data.shops[0])navigate('/barberia/'+data.shops[0].slug+'/inicio');
        else if(data.user.role==='superadmin')navigate('/admin/inicio');
        else if(data.user.role==='barber_employee'||data.user.role==='barber_independent')
          navigate('/barbero/'+(data.barbers.find(b=>b.id===data.user.barberId)?.slug||data.barbers[0]?.slug||'barbero')+'/inicio');
        else navigate('/clientes/inicio');
      }
    }).catch(()=>{if(alive){clearSession();setCachedUser(null);setCurrentUser(null);}}).finally(()=>{if(alive)setRestoringSession(false);});
    return ()=>{alive=false;};
  },[]);

  const logout = () => {
    if(isLiveBackend){void signOut().catch(()=>clearSession());barberStore.clearRemoteSession();}
    setCachedUser(null);
    setCurrentUser(null);
    navigate('/login');
    addToast('Sesión cerrada correctamente', 'info');
  };

  const switchRolePersona = (role: UserRole) => {
    if(isLiveBackend){addToast('Los roles reales los asigna la barbería desde el backend.', 'error');return;}
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
    if(isLiveBackend){addToast('El reinicio de datos simulados no está disponible en modo conectado.','info');return;}
    barberStore.resetToFactory();
    addToast('Datos de demostración reiniciados al estado original', 'info');
  };

  // Durable REST catch-up: WebSocket delivery from the provider is not guaranteed.
  // This changes data behavior only; no visual layout or CSS changes.
  useEffect(()=>{
    if(!isLiveBackend||!currentUser)return;
    let mounted=true,working=false;
    const key='barberos_notif_cursor_'+currentUser.id;
    const sync=async()=>{
      if(working)return;
      working=true;
      try{
        let cursor=sessionStorage.getItem(key)||'';
        for(let page=0;page<5;page++){
          const result=await backendRequest<{
            items:{id:string;title:string;body:string}[];
            nextCursor:string|null;hasMore:boolean
          }>('/me/notifications/sync?limit=50'+(cursor?'&cursor='+encodeURIComponent(cursor):''));
          if(!mounted)break;
          if(cursor&&result.items.length>0){
            addToast(result.items.length===1?result.items[0].title:
              result.items.length+' notificaciones nuevas','info');
          }
          if(result.nextCursor){
            cursor=result.nextCursor;sessionStorage.setItem(key,cursor);
          }
          if(!result.hasMore)break;
        }
      }catch{/* A failed poll leaves the cursor intact for the next attempt. */}
      finally{working=false;}
    };
    void sync();
    const timer=window.setInterval(()=>void sync(),30000);
    const online=()=>void sync();
    window.addEventListener('online',online);
    return ()=>{mounted=false;window.clearInterval(timer);window.removeEventListener('online',online);};
  },[currentUser?.id]);

  const activeRole: UserRole = currentUser?.role || 'client';

  return (
    <AppContext.Provider
      value={{
        currentUser,
        activeRole,
        loginAs,
        loginWithCredentials,
        logout,
        switchRolePersona,
        currentShop,
        setCurrentShopSlug,
        currentBarber,
        setCurrentBarberSlug,
        activeRoute, restoringSession,
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
