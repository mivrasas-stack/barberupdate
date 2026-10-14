/**
 * Contrato de Servicios & Adaptador HTTP para integración futura con Backend.
 * 
 * En modo de demostración (actual), las llamadas resuelven directamente contra
 * el repositorio reactivo local `barberStore`.
 * 
 * Cuando tu backend esté listo, simplemente cambia `USE_MOCK_ADAPTER = false`
 * y configura `VITE_API_BASE_URL` en tu archivo `.env`.
 */

import { barberStore } from './store';
import {
  Appointment,
  Barber,
  Barbershop,
  Product,
  Service,
  Transaction,
  CashClosing,
  Order,
  Review,
  SubscriptionPlan,
  User,
} from '../types';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
export const USE_MOCK_ADAPTER = true;

export interface IBarberOSApi {
  // Appointments
  getAppointments(filters?: { businessId?: string; barberId?: string; date?: string }): Promise<Appointment[]>;
  createAppointment(data: Omit<Appointment, 'id' | 'createdAt'>): Promise<{ success: boolean; data?: Appointment; error?: string }>;
  updateAppointmentStatus(id: string, status: Appointment['status'], paymentMethod?: Appointment['paymentMethod']): Promise<void>;
  registerWalkIn(data: { customerName: string; customerPhone: string; barberId: string; serviceId: string; businessId?: string }): Promise<Appointment>;

  // Products & Boutique
  getProducts(businessId?: string): Promise<Product[]>;
  updateProductStock(productId: string, delta: number, reason: string): Promise<boolean>;
  createOrder(businessId: string, customerId: string, customerName: string, items: Order['items']): Promise<Order>;

  // Accounting & Cash
  getTransactions(businessId?: string): Promise<Transaction[]>;
  recordCashClosing(closing: Omit<CashClosing, 'id' | 'status'>): Promise<CashClosing>;

  // Reviews & Ratings
  addReview(review: Omit<Review, 'id' | 'date'>): Promise<Review>;

  // Metadata & Entities
  getBarbershops(): Promise<Barbershop[]>;
  getBarbers(businessId?: string): Promise<Barber[]>;
  getServices(businessId?: string): Promise<Service[]>;
  getPlans(): Promise<SubscriptionPlan[]>;
  getUsers(): Promise<User[]>;
}

class MockBarberOSAdapter implements IBarberOSApi {
  async getAppointments(filters?: { businessId?: string; barberId?: string; date?: string }): Promise<Appointment[]> {
    let items = barberStore.getState().appointments;
    if (filters?.businessId) items = items.filter(a => a.businessId === filters.businessId);
    if (filters?.barberId) items = items.filter(a => a.barberId === filters.barberId);
    if (filters?.date) items = items.filter(a => a.date === filters.date);
    return items;
  }

  async createAppointment(data: Omit<Appointment, 'id' | 'createdAt'>): Promise<{ success: boolean; data?: Appointment; error?: string }> {
    const res = barberStore.createAppointment(data);
    return { success: res.success, data: res.appointment, error: res.error };
  }

  async updateAppointmentStatus(id: string, status: Appointment['status'], paymentMethod?: Appointment['paymentMethod']): Promise<void> {
    barberStore.updateAppointmentStatus(id, status, paymentMethod);
  }

  async registerWalkIn(data: { customerName: string; customerPhone: string; barberId: string; serviceId: string; businessId?: string }): Promise<Appointment> {
    return barberStore.registerWalkIn(data.customerName, data.customerPhone, data.barberId, data.serviceId, data.businessId);
  }

  async getProducts(businessId?: string): Promise<Product[]> {
    let items = barberStore.getState().products;
    if (businessId) items = items.filter(p => p.businessId === businessId);
    return items;
  }

  async updateProductStock(productId: string, delta: number, reason: string): Promise<boolean> {
    return barberStore.updateProductStock(productId, delta, reason);
  }

  async createOrder(businessId: string, customerId: string, customerName: string, items: Order['items']): Promise<Order> {
    return barberStore.createOrder(businessId, customerId, customerName, items);
  }

  async getTransactions(businessId?: string): Promise<Transaction[]> {
    let items = barberStore.getState().transactions;
    if (businessId) items = items.filter(t => t.businessId === businessId);
    return items;
  }

  async recordCashClosing(closing: Omit<CashClosing, 'id' | 'status'>): Promise<CashClosing> {
    return barberStore.recordCashClosing(closing);
  }

  async addReview(review: Omit<Review, 'id' | 'date'>): Promise<Review> {
    return barberStore.addReview(review);
  }

  async getBarbershops(): Promise<Barbershop[]> {
    return barberStore.getState().barbershops;
  }

  async getBarbers(businessId?: string): Promise<Barber[]> {
    let items = barberStore.getState().barbers;
    if (businessId) items = items.filter(b => b.businessId === businessId);
    return items;
  }

  async getServices(businessId?: string): Promise<Service[]> {
    let items = barberStore.getState().services;
    if (businessId) items = items.filter(s => s.businessId === businessId);
    return items;
  }

  async getPlans(): Promise<SubscriptionPlan[]> {
    return barberStore.getState().plans;
  }

  async getUsers(): Promise<User[]> {
    return barberStore.getState().users;
  }
}

/**
 * Cliente HTTP Real (stub preparado para cuando conectes tu backend)
 */
class HttpBarberOSAdapter implements IBarberOSApi {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    });
    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
    }
    return res.json();
  }

  async getAppointments(filters?: { businessId?: string; barberId?: string; date?: string }): Promise<Appointment[]> {
    const query = new URLSearchParams(filters as any).toString();
    return this.request<Appointment[]>(`/appointments?${query}`);
  }

  async createAppointment(data: Omit<Appointment, 'id' | 'createdAt'>): Promise<{ success: boolean; data?: Appointment; error?: string }> {
    return this.request<{ success: boolean; data?: Appointment; error?: string }>('/appointments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAppointmentStatus(id: string, status: Appointment['status'], paymentMethod?: Appointment['paymentMethod']): Promise<void> {
    await this.request(`/appointments/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, paymentMethod }),
    });
  }

  async registerWalkIn(data: any): Promise<Appointment> {
    return this.request<Appointment>('/appointments/walkin', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getProducts(businessId?: string): Promise<Product[]> {
    return this.request<Product[]>(`/products${businessId ? `?businessId=${businessId}` : ''}`);
  }

  async updateProductStock(productId: string, delta: number, reason: string): Promise<boolean> {
    const res = await this.request<{ success: boolean }>(`/products/${productId}/stock`, {
      method: 'POST',
      body: JSON.stringify({ delta, reason }),
    });
    return res.success;
  }

  async createOrder(businessId: string, customerId: string, customerName: string, items: Order['items']): Promise<Order> {
    return this.request<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify({ businessId, customerId, customerName, items }),
    });
  }

  async getTransactions(businessId?: string): Promise<Transaction[]> {
    return this.request<Transaction[]>(`/transactions${businessId ? `?businessId=${businessId}` : ''}`);
  }

  async recordCashClosing(closing: any): Promise<CashClosing> {
    return this.request<CashClosing>('/cash-closing', {
      method: 'POST',
      body: JSON.stringify(closing),
    });
  }

  async addReview(review: any): Promise<Review> {
    return this.request<Review>('/reviews', {
      method: 'POST',
      body: JSON.stringify(review),
    });
  }

  async getBarbershops(): Promise<Barbershop[]> {
    return this.request<Barbershop[]>('/barbershops');
  }

  async getBarbers(businessId?: string): Promise<Barber[]> {
    return this.request<Barber[]>(`/barbers${businessId ? `?businessId=${businessId}` : ''}`);
  }

  async getServices(businessId?: string): Promise<Service[]> {
    return this.request<Service[]>(`/services${businessId ? `?businessId=${businessId}` : ''}`);
  }

  async getPlans(): Promise<SubscriptionPlan[]> {
    return this.request<SubscriptionPlan[]>('/plans');
  }

  async getUsers(): Promise<User[]> {
    return this.request<User[]>('/users');
  }
}

export const api: IBarberOSApi = USE_MOCK_ADAPTER ? new MockBarberOSAdapter() : new HttpBarberOSAdapter();
