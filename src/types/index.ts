export type UserRole = 
  | 'superadmin' 
  | 'owner' 
  | 'barber_employee' 
  | 'client';

export type CurrencyType = 'COP' | 'USD' | 'EUR';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatar: string;
  businessId?: string; // If owner, barber_employee, or linked client
  barberId?: string;   // If barber_employee
  createdAt: string;
  lastLogin: string;
  planId?: string;
  status: 'active' | 'suspended' | 'pending';
}

export interface Barbershop {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  logo: string;
  coverImage: string;
  ownerId: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  coordinates?: {lat:number;lng:number};
  planId: string;
  subscriptionStatus: 'active' | 'trial' | 'past_due' | 'cancelled';
  subscriptionRenewsAt: string;
  rating: number;
  reviewsCount: number;
  openingHours: {
    days: string;
    open: string;
    close: string;
  };
  socialLinks: {
    instagram?: string;
    whatsapp?: string;
  };
  portfolio: string[];
  publicCode: string;
  businessKind?: 'barbershop' | 'independent';
  createdAt: string;
}

export interface Barber {
  id: string;
  businessId?: string; // If null/empty, independent
  slug: string;
  name: string;
  photo: string;
  phone: string;
  email: string;
  specialties: string[];
  experienceYears?:number;
  instagramUrl?:string;
  bio: string;
  commissionRate: number; // e.g. 0.50 (50%)
  contractType?: 'commission'|'chair_rental'|'hybrid';
  chairRentalFee?: number;
  chairRentalPeriod?: 'daily'|'weekly'|'biweekly'|'monthly';
  status: 'active' | 'inactive';
  rating: number;
  reviewsCount: number;
  portfolio: string[]; // Max 10
  workDays: number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  workHours: { start: string; end: string };
  breakTime?: { start: string; end: string };
  isIndependent: boolean;
  publicCode: string;
}

export type ServiceCategory = 'haircut' | 'beard' | 'combo' | 'eyebrows' | 'treatments' | 'special';

export interface Service {
  id: string;
  businessId?: string;
  barberId?: string; // If custom to an independent barber
  name: string;
  description: string;
  price: number;
  durationMinutes: number;
  earnsLoyaltyPoints?: boolean;
  category: ServiceCategory;
  barberIds: string[]; // Allowed barbers (empty means all)
  isActive: boolean;
  image?: string;
  order: number;
}

export type AppointmentStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'waiting' 
  | 'in_service' 
  | 'completed' 
  | 'cancelled' 
  | 'no_show';

export type PaymentMethod = 'cash' | 'debit' | 'credit' | 'transfer' | 'nequi' | 'daviplata' | 'split';

export interface Appointment {
  id: string;
  businessId?: string;
  barberId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  serviceId: string;
  serviceName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  durationMinutes: number;
  price: number;
  discount: number;
  finalPrice: number;
  paymentMethod?: PaymentMethod;
  paymentDetails?: {
    cashAmount?: number;
    electronicAmount?: number;
    electronicProvider?: string;
  };
  status: AppointmentStatus;
  cancellationReason?: string;
  notes?: string;
  isWalkIn?: boolean; // Llegada sin cita previa
  walkInQueueTime?: string;
  completedAt?: string;
  createdAt: string;
}

export type TransactionType = 'income' | 'expense';
export type TransactionCategory = 
  | 'haircut_service' 
  | 'product_sale' 
  | 'beverage_food' 
  | 'rent' 
  | 'utilities' 
  | 'payroll' 
  | 'barber_commission' 
  | 'inventory_purchase' 
  | 'maintenance' 
  | 'marketing' 
  | 'other';

export interface Transaction {
  id: string;
  businessId?: string;
  barberId?: string;
  type: TransactionType;
  category: TransactionCategory;
  concept: string;
  amount: number;
  paymentMethod: PaymentMethod;
  date: string; // ISO
  referenceId?: string; // ID of appointment or order
  receiptUrl?: string;
  notes?: string;
}

export interface CashClosing {
  id: string;
  businessId?: string;
  barberId?: string;
  date: string;
  openedAt: string;
  closedAt: string;
  responsibleName: string;
  openingCash: number;
  cashIncome: number;
  electronicIncome: number;
  expensesPaidFromCash: number;
  withdrawals: number;
  theoreticalCash: number;
  actualCashCounted: number;
  difference: number; // positive = surplus, negative = deficit
  notes: string;
  status: 'closed' | 'open';
}

export type ProductCategory = 'beauty' | 'food_drinks' | 'barbershop_merch';

export interface Product {
  id: string;
  businessId?: string;
  barberId?: string;
  name: string;
  description: string;
  photo: string;
  category: ProductCategory;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  sku: string;
  barcode?: string;
  isActive: boolean;
  isVisibleInWaitingRoom: boolean;
  createdAt: string;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  businessId?: string;
  type: 'in' | 'out' | 'sale' | 'adjustment';
  quantity: number;
  reason: string;
  date: string;
  performedBy: string;
}

export type OrderStatus = 'received' | 'preparing' | 'ready' | 'delivered' | 'cancelled';

export interface OrderItem {
  productId: string;
  productName: string;
  category: ProductCategory;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

export interface Order {
  id: string;
  businessId: string;
  customerId: string;
  customerName: string;
  pickupCode: string; // e.g. "PK-7492"
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  createdAt: string;
  deliveredAt?: string;
}

export interface Review {
  id: string;
  businessId?: string;
  barberId?: string;
  customerId: string;
  customerName: string;
  customerAvatar: string;
  appointmentId?: string;
  rating: number; // 1-5
  comment: string;
  date: string;
}

export interface LoyaltyReward {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  pointsCost: number;
  isActive: boolean;
  availablePoints?: number;
}
export interface LoyaltyBalance {
  tenantId: string;
  points: number;
  visitsCount: number;
}
export interface LoyaltyRedemption {
  id: string;
  tenantId: string;
  rewardId: string;
  title: string;
  pointsCost: number;
  status: 'pending'|'fulfilled'|'cancelled';
  createdAt: string;
  userId?: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  iconName: string;
  unlockedAt?: string;
  isUnlocked: boolean;
}

export interface LoyaltyAccount {
  customerId: string;
  points: number;
  visitsCount: number;
  currentStreak: number;
  achievements: Achievement[];
  pointHistory: {
    id: string;
    date: string;
    concept: string;
    points: number; // + or -
  }[];
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  audience: 'independent' | 'barbershop';
  tagline: string;
  monthlyPrice: number;
  annualPrice: number;
  currency: string;
  maxBarbers: number; // 1 for independent, N for barbershop
  maxPortfolioImages: number;
  features: string[];
  isPopular?: boolean;
  isActive: boolean;
  order: number;
}

export interface CommercialPageConfig {
  heroTitle: string;
  heroSubtitle: string;
  highlightPhrase: string;
  benefits: { title: string; desc: string; icon: string }[];
  faqs: { question: string; answer: string }[];
  ctaButtonText: string;
  updatedAt: string;
}

export interface ThemePalette {
  id: string;
  name: string;
  bgPrimary: string;
  bgSurface: string;
  bgSurfaceElevated: string;
  borderSubtle: string;
  goldPrimary: string;
  goldHover: string;
  textPrimary: string;
  textMuted: string;
}
