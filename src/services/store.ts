import {
  User,
  Barbershop,
  Barber,
  Service,
  Appointment,
  AppointmentStatus,
  Transaction,
  CashClosing,
  Product,
  Order,
  Review,
  LoyaltyAccount,
  SubscriptionPlan,
  CommercialPageConfig,
  ThemePalette,
  CurrencyType,
  PaymentMethod,
} from '../types';
import {
  INITIAL_USERS,
  INITIAL_BARBERSHOPS,
  INITIAL_BARBERS,
  INITIAL_SERVICES,
  INITIAL_PRODUCTS,
  INITIAL_APPOINTMENTS,
  INITIAL_TRANSACTIONS,
  INITIAL_CASH_CLOSINGS,
  INITIAL_ORDERS,
  INITIAL_REVIEWS,
  INITIAL_LOYALTY,
  INITIAL_PLANS,
  INITIAL_COMMERCIAL_PAGE,
  INITIAL_PALETTES,
} from './mockData';
import { generatePickupCode } from '../utils/formatters';

const STORAGE_KEY = 'barberos_state_v2';

export interface BarberOSState {
  users: User[];
  barbershops: Barbershop[];
  barbers: Barber[];
  services: Service[];
  products: Product[];
  appointments: Appointment[];
  transactions: Transaction[];
  cashClosings: CashClosing[];
  orders: Order[];
  reviews: Review[];
  loyalty: Record<string, LoyaltyAccount>; // customerId -> account
  plans: SubscriptionPlan[];
  commercialConfig: CommercialPageConfig;
  palettes: ThemePalette[];
  activePaletteId: string;
  currency: CurrencyType;
}

const getInitialState = (): BarberOSState => {
  return {
    users: INITIAL_USERS,
    barbershops: INITIAL_BARBERSHOPS,
    barbers: INITIAL_BARBERS,
    services: INITIAL_SERVICES,
    products: INITIAL_PRODUCTS,
    appointments: INITIAL_APPOINTMENTS,
    transactions: INITIAL_TRANSACTIONS,
    cashClosings: INITIAL_CASH_CLOSINGS,
    orders: INITIAL_ORDERS,
    reviews: INITIAL_REVIEWS,
    loyalty: {
      'usr-client-1': INITIAL_LOYALTY,
    },
    plans: INITIAL_PLANS,
    commercialConfig: INITIAL_COMMERCIAL_PAGE,
    palettes: INITIAL_PALETTES,
    activePaletteId: 'obsidian-gold',
    currency: 'COP',
  };
};

// The live app must not display seeded identities, fabricated revenue or mock bookings,
// including during the first paint before an authenticated API response arrives.
const getLiveEmptyState = (): BarberOSState => ({
  ...getInitialState(),
  users: [], barbershops: [], barbers: [], services: [], products: [],
  appointments: [], transactions: [], cashClosings: [], orders: [], reviews: [],
  loyalty: {}, plans: [],
});

class Store {
  private state: BarberOSState;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.state = this.loadFromStorage();
  }

  private loadFromStorage(): BarberOSState {
    if(import.meta.env.VITE_BACKEND_MODE==='live'){
      // This key was used only for synthetic demo records; never carry it into live.
      localStorage.removeItem(STORAGE_KEY);
      try {
        const liveSaved = sessionStorage.getItem('barberos_live_state_v1');
        if (liveSaved) {
          return JSON.parse(liveSaved);
        }
      } catch (e) {
        console.warn('Could not parse stored live BarberOS state', e);
      }
      return getLiveEmptyState();
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Could not parse stored BarberOS state, using defaults', e);
    }
    return getInitialState();
  }

  private persist() {
    // Never write authenticated customers, appointments or tenants to demo localStorage.
    if(import.meta.env.VITE_BACKEND_MODE==='live'){this.notify();return;}
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn('Could not persist BarberOS state', e);
    }
    this.notify();
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  public getState(): BarberOSState {
    return this.state;
  }

  // Remote data never inherits mock identities, fake sales or local demo records.
  // Keep the user's existing visual theme without changing any UI component.
  public hydrateFromBackend(data: Partial<BarberOSState>): void {
    this.state = {
      ...getLiveEmptyState(),
      palettes: this.state.palettes,
      activePaletteId: this.state.activePaletteId,
      currency: this.state.currency,
      users: [], barbershops: [], barbers: [], services: [], products: [],
      appointments: [], transactions: [], cashClosings: [], orders: [], reviews: [],
      loyalty: {}, ...data,
    };
    if(import.meta.env.VITE_BACKEND_MODE==='live'){
      try{
        sessionStorage.setItem('barberos_live_state_v1', JSON.stringify(this.state));
      }catch{}
    }
    this.notify(); // Do not persist authenticated tenant data to demo localStorage.
  }

  public clearRemoteSession(): void {
    if(import.meta.env.VITE_BACKEND_MODE==='live'){
      try{sessionStorage.removeItem('barberos_live_state_v1');}catch{}
    }
    this.hydrateFromBackend({});
  }

  public resetToFactory(): void {
    if(import.meta.env.VITE_BACKEND_MODE==='live'){
      this.clearRemoteSession();
      return;
    }
    this.state = getInitialState();
    localStorage.removeItem(STORAGE_KEY);
    this.persist();
  }

  // --- Palettes & Settings ---
  public setActivePalette(paletteId: string): void {
    this.state.activePaletteId = paletteId;
    this.persist();
  }

  public updatePaletteCustom(palette: ThemePalette): void {
    const idx = this.state.palettes.findIndex(p => p.id === palette.id);
    if (idx >= 0) {
      this.state.palettes[idx] = palette;
    } else {
      this.state.palettes.push(palette);
    }
    this.state.activePaletteId = palette.id;
    this.persist();
  }

  public setCurrency(currency: CurrencyType): void {
    this.state.currency = currency;
    this.persist();
  }

  // --- Appointments ---
  public createAppointment(data: Omit<Appointment, 'id' | 'createdAt'>): { success: boolean; error?: string; appointment?: Appointment } {
    // Check overlap for the same barber
    const hasOverlap = this.state.appointments.some(apt => {
      if (apt.barberId !== data.barberId || apt.date !== data.date || apt.status === 'cancelled') {
        return false;
      }
      // Check if start time clashes
      return apt.startTime === data.startTime;
    });

    if (hasOverlap) {
      return { success: false, error: 'El barbero ya tiene una cita asignada en ese mismo horario.' };
    }

    const newApt: Appointment = {
      ...data,
      id: `apt-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    this.state.appointments.unshift(newApt);
    this.persist();
    return { success: true, appointment: newApt };
  }

  public updateAppointmentStatus(
    id: string,
    newStatus: AppointmentStatus,
    paymentMethod: PaymentMethod = 'cash'
  ): void {
    const apt = this.state.appointments.find(a => a.id === id);
    if (!apt) return;

    const previousStatus = apt.status;
    apt.status = newStatus;

    if (newStatus === 'completed' && previousStatus !== 'completed') {
      apt.completedAt = new Date().toISOString();
      apt.paymentMethod = paymentMethod;

      // Avoid duplicate revenue: check if transaction already registered
      const existingTxn = this.state.transactions.find(t => t.referenceId === apt.id);
      if (!existingTxn) {
        const newTxn: Transaction = {
          id: `txn-${Date.now()}`,
          businessId: apt.businessId,
          barberId: apt.barberId,
          type: 'income',
          category: 'haircut_service',
          concept: `Servicio: ${apt.serviceName} - ${apt.customerName}`,
          amount: apt.finalPrice,
          paymentMethod: paymentMethod,
          date: new Date().toISOString(),
          referenceId: apt.id,
        };
        this.state.transactions.unshift(newTxn);

        // Add loyalty points to customer if exists
        this.awardLoyaltyPoints(apt.customerId, Math.floor(apt.finalPrice / 1000), `Corte finalizado: ${apt.serviceName}`);
      }
    }

    this.persist();
  }

  public registerWalkIn(
    customerName: string,
    customerPhone: string,
    barberId: string,
    serviceId: string,
    businessId?: string
  ): Appointment {
    const barber = this.state.barbers.find(b => b.id === barberId);
    const service = this.state.services.find(s => s.id === serviceId);
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const todayStr = now.toISOString().split('T')[0];

    const apt: Appointment = {
      id: `walkin-${Date.now()}`,
      businessId,
      barberId,
      customerId: `walkin-cust-${Date.now()}`,
      customerName: customerName || 'Cliente en Espera',
      customerPhone: customerPhone || '+57 300 000 0000',
      serviceId,
      serviceName: service?.name || 'Servicio de Barbería',
      date: todayStr,
      startTime: timeStr,
      endTime: timeStr,
      durationMinutes: service?.durationMinutes || 40,
      price: service?.price || 40000,
      discount: 0,
      finalPrice: service?.price || 40000,
      status: 'waiting',
      isWalkIn: true,
      walkInQueueTime: timeStr,
      notes: 'Llegada sin cita previa (Walk-in)',
      createdAt: now.toISOString(),
    };

    this.state.appointments.unshift(apt);
    this.persist();
    return apt;
  }

  // --- Transactions & Cash Closing ---
  public addTransaction(txn: Omit<Transaction, 'id' | 'date'>): Transaction {
    const newTxn: Transaction = {
      ...txn,
      id: `txn-${Date.now()}`,
      date: new Date().toISOString(),
    };
    this.state.transactions.unshift(newTxn);
    this.persist();
    return newTxn;
  }

  public recordCashClosing(closing: Omit<CashClosing, 'id' | 'status'>): CashClosing {
    const newClosing: CashClosing = {
      ...closing,
      id: `cash-close-${Date.now()}`,
      status: 'closed',
    };
    this.state.cashClosings.unshift(newClosing);
    this.persist();
    return newClosing;
  }

  // --- Products & Orders ---
  public updateProductStock(productId: string, quantityDelta: number, reason: string): boolean {
    const prod = this.state.products.find(p => p.id === productId);
    if (!prod) return false;
    if (prod.stock + quantityDelta < 0) return false; // Prevent negative stock
    prod.stock += quantityDelta;
    this.persist();
    return true;
  }

  public createProduct(prod: Omit<Product, 'id' | 'createdAt'>): Product {
    const newProd: Product = {
      ...prod,
      id: `prod-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.state.products.unshift(newProd);
    this.persist();
    return newProd;
  }

  public createOrder(
    businessId: string,
    customerId: string,
    customerName: string,
    items: Order['items']
  ): Order {
    const total = items.reduce((acc, it) => acc + it.subtotal, 0);
    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      businessId,
      customerId,
      customerName,
      pickupCode: generatePickupCode(),
      items,
      total,
      status: 'received',
      createdAt: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    };

    // Deduct stock for items
    items.forEach(it => {
      this.updateProductStock(it.productId, -it.quantity, `Pedido sala de espera ${newOrder.pickupCode}`);
    });

    this.state.orders.unshift(newOrder);
    this.persist();
    return newOrder;
  }

  public updateOrderStatus(orderId: string, newStatus: Order['status']): void {
    const order = this.state.orders.find(o => o.id === orderId);
    if (!order) return;
    order.status = newStatus;
    if (newStatus === 'delivered') {
      order.deliveredAt = new Date().toISOString();
      // Record transaction
      this.addTransaction({
        businessId: order.businessId,
        type: 'income',
        category: 'product_sale',
        concept: `Venta Productos Sala: Código ${order.pickupCode} - ${order.customerName}`,
        amount: order.total,
        paymentMethod: 'cash',
        referenceId: order.id,
      });
    }
    this.persist();
  }

  // --- Reviews ---
  public addReview(review: Omit<Review, 'id' | 'date'>): Review {
    const newRev: Review = {
      ...review,
      id: `rev-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
    };
    this.state.reviews.unshift(newRev);

    // Recalculate barber rating if applicable
    if (review.barberId) {
      const barberRevs = this.state.reviews.filter(r => r.barberId === review.barberId);
      const barber = this.state.barbers.find(b => b.id === review.barberId);
      if (barber) {
        const avg = barberRevs.reduce((acc, r) => acc + r.rating, 0) / barberRevs.length;
        barber.rating = Number(avg.toFixed(2));
        barber.reviewsCount = barberRevs.length;
      }
    }

    // Recalculate shop rating if applicable
    if (review.businessId) {
      const shopRevs = this.state.reviews.filter(r => r.businessId === review.businessId);
      const shop = this.state.barbershops.find(s => s.id === review.businessId);
      if (shop) {
        const avg = shopRevs.reduce((acc, r) => acc + r.rating, 0) / shopRevs.length;
        shop.rating = Number(avg.toFixed(2));
        shop.reviewsCount = shopRevs.length;
      }
    }

    this.persist();
    return newRev;
  }

  // --- Barbershop Management ---
  public updateBarbershop(id: string, updates: Partial<Barbershop>): { success: boolean; shop?: Barbershop; error?: string } {
    const shop = this.state.barbershops.find(s => s.id === id);
    if (!shop) return { success: false, error: 'Barbería no encontrada.' };
    Object.assign(shop, updates);
    this.persist();
    return { success: true, shop };
  }

  // --- Barber Management ---
  public updateBarber(id: string, updates: Partial<Barber>): { success: boolean; barber?: Barber; error?: string } {
    const barber = this.state.barbers.find(b => b.id === id);
    if (!barber) return { success: false, error: 'Barbero no encontrado.' };
    Object.assign(barber, updates);
    this.persist();
    return { success: true, barber };
  }

  // --- Portfolio Management (Max 10 photos) ---
  public addPortfolioPhoto(entityType: 'barber' | 'barbershop', entityId: string, photoUrl: string): { success: boolean; error?: string } {
    if (entityType === 'barber') {
      const barber = this.state.barbers.find(b => b.id === entityId);
      if (!barber) return { success: false, error: 'Barbero no encontrado.' };
      if (barber.portfolio.length >= 10) return { success: false, error: 'Límite máximo de 10 fotografías alcanzado.' };
      barber.portfolio.push(photoUrl);
    } else {
      const shop = this.state.barbershops.find(s => s.id === entityId);
      if (!shop) return { success: false, error: 'Barbería no encontrada.' };
      if (shop.portfolio.length >= 10) return { success: false, error: 'Límite máximo de 10 fotografías alcanzado.' };
      shop.portfolio.push(photoUrl);
    }
    this.persist();
    return { success: true };
  }

  public removePortfolioPhoto(entityType: 'barber' | 'barbershop', entityId: string, index: number): void {
    if (entityType === 'barber') {
      const barber = this.state.barbers.find(b => b.id === entityId);
      if (barber) barber.portfolio.splice(index, 1);
    } else {
      const shop = this.state.barbershops.find(s => s.id === entityId);
      if (shop) shop.portfolio.splice(index, 1);
    }
    this.persist();
  }

  // --- Loyalty Points ---
  public awardLoyaltyPoints(customerId: string, points: number, concept: string): void {
    if (!this.state.loyalty[customerId]) {
      this.state.loyalty[customerId] = {
        customerId,
        points: 0,
        visitsCount: 0,
        currentStreak: 1,
        achievements: [],
        pointHistory: [],
      };
    }
    const acc = this.state.loyalty[customerId];
    acc.points += points;
    acc.visitsCount += 1;
    acc.pointHistory.unshift({
      id: `ph-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      concept,
      points,
    });
    this.persist();
  }

  // --- Commercial Page Config Editor ---
  public updateCommercialConfig(config: CommercialPageConfig): void {
    this.state.commercialConfig = {
      ...config,
      updatedAt: new Date().toISOString().split('T')[0],
    };
    this.persist();
  }

  // --- Plans Management ---
  public updatePlan(plan: SubscriptionPlan): void {
    const idx = this.state.plans.findIndex(p => p.id === plan.id);
    if (idx >= 0) {
      this.state.plans[idx] = plan;
      this.persist();
    }
  }

  public createPlan(plan: Omit<SubscriptionPlan, 'id'>): SubscriptionPlan {
    const newPlan: SubscriptionPlan = {
      ...plan,
      id: `plan-${Date.now()}`,
    };
    this.state.plans.push(newPlan);
    this.persist();
    return newPlan;
  }
}

export const barberStore = new Store();
