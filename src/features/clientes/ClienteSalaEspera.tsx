import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {useCustomerLinks} from '../../services/useCustomerLinks';
import { barberStore } from '../../services/store';
import {isLiveBackend,addOrder,refreshLiveData,mapOrder} from '../../services/liveBackend';
import { formatCurrency } from '../../utils/formatters';
import { Product, ProductCategory, OrderItem, Order } from '../../types';
import {
  Coffee,
  Sparkles,
  Shirt,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  QrCode,
  Clock,
  ArrowRight,
} from 'lucide-react';

export const ClienteSalaEspera: React.FC = () => {
  const { state, currentUser, currentShop, currency, addToast } = useApp();
  const [activeCategory, setActiveCategory] = useState<ProductCategory>('food_drinks');
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [lastGeneratedOrder, setLastGeneratedOrder] = useState<Order | null>(null);

  const {items:linkedBusinesses}=useCustomerLinks(currentUser?.id);
  const bookedTenant=state.appointments.find(appointment=>appointment.customerId===currentUser?.id)?.businessId;
  const shopId=bookedTenant||linkedBusinesses[0]?.tenant_id||currentShop?.id||'';

  // Products visible in waiting room
  const availableProducts = state.products.filter(
    p => p.businessId === shopId && p.isVisibleInWaitingRoom && p.category === activeCategory && p.stock > 0
  );

  const cartTotal = cart.reduce((acc, it) => acc + it.product.price * it.quantity, 0);

  const handleAddToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          addToast(`Solo hay ${product.stock} unidades disponibles en existencia`, 'error');
          return prev;
        }
        return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product, quantity: 1 }];
    });
    addToast(`${product.name} agregado al carrito de la sala`, 'info');
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setCart(prev =>
      prev
        .map(i => {
          if (i.product.id === productId) {
            const nextQty = i.quantity + delta;
            return nextQty > 0 ? { ...i, quantity: nextQty } : null;
          }
          return i;
        })
        .filter(Boolean) as { product: Product; quantity: number }[]
    );
  };

  const handleConfirmOrder = async () => {
    if (!cart.length) return;

    const items: OrderItem[] = cart.map(it => ({
      productId: it.product.id,
      productName: it.product.name,
      category: it.product.category,
      unitPrice: it.product.price,
      quantity: it.quantity,
      subtotal: it.product.price * it.quantity,
    }));

    if(isLiveBackend){
      try{
        const raw=await addOrder(shopId,currentUser?.name||currentUser?.email||'Cliente',
          cart.map(item=>({productId:item.product.id,quantity:item.quantity})));
        setLastGeneratedOrder({...mapOrder(raw,shopId),items});
        setCart([]);
        await refreshLiveData();
        addToast('Pedido registrado en BarberOS','success');
      }catch(error){addToast(error instanceof Error?error.message:'Error creando pedido','error');}
      return;
    }
    const order = barberStore.createOrder(
      shopId,
      currentUser?.id || 'usr-client-1',
      currentUser?.name || 'Camilo Andrés Torres',
      items
    );

    setLastGeneratedOrder(order);
    setCart([]);
    addToast(`¡Pedido confirmado! Código de recogida: ${order.pickupCode}`, 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242424]">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">
            Consumo & Boutique en Sala
          </span>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Sala de Espera Digital</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Pide un café, cerveza fría o llévate tus ceras favoritas mientras esperas tu corte
          </p>
        </div>
      </div>

      {/* Confirmed Order Card with Obligatory Pickup Code */}
      {lastGeneratedOrder && (
        <div className="p-6 rounded-3xl bg-emerald-500/10 border-2 border-emerald-500/40 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs mb-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Pedido Confirmado en Barra</span>
              </div>
              <h2 className="text-lg font-bold text-white">Muestra este código en recepción para reclamar</h2>
              <p className="text-xs text-neutral-300 mt-1">
                {lastGeneratedOrder.items.map(i => `${i.quantity}x ${i.productName}`).join(' · ')}
              </p>
            </div>

            <div className="p-4 bg-black/80 rounded-2xl border border-neutral-700 text-center shrink-0">
              <span className="text-[10px] text-neutral-400 uppercase font-semibold block">Código de Recogida:</span>
              <span className="text-3xl font-mono font-black text-[var(--gold-primary)] tracking-widest block mt-0.5">
                {lastGeneratedOrder.pickupCode}
              </span>
              <span className="text-[10px] text-neutral-400 block mt-1">Total: {formatCurrency(lastGeneratedOrder.total, currency)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Two Column Layout: Categories & Products on Left, Cart on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Products */}
        <div className="lg:col-span-8 space-y-4">
          {/* Category Switcher */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setActiveCategory('food_drinks')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                activeCategory === 'food_drinks'
                  ? 'bg-[var(--gold-primary)] text-black shadow-md'
                  : 'bg-[#141414] border border-[#262626] text-neutral-300 hover:border-neutral-700'
              }`}
            >
              <Coffee className="w-4 h-4" />
              <span>Café & Bebidas Frías</span>
            </button>

            <button
              onClick={() => setActiveCategory('beauty')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                activeCategory === 'beauty'
                  ? 'bg-[var(--gold-primary)] text-black shadow-md'
                  : 'bg-[#141414] border border-[#262626] text-neutral-300 hover:border-neutral-700'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Ceras & Cuidado de Barba</span>
            </button>

            <button
              onClick={() => setActiveCategory('barbershop_merch')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                activeCategory === 'barbershop_merch'
                  ? 'bg-[var(--gold-primary)] text-black shadow-md'
                  : 'bg-[#141414] border border-[#262626] text-neutral-300 hover:border-neutral-700'
              }`}
            >
              <Shirt className="w-4 h-4" />
              <span>Merch Oficial</span>
            </button>
          </div>

          {/* Product Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {availableProducts.map(prod => (
              <div
                key={prod.id}
                className="bg-[#141414] border border-[#262626] rounded-2xl p-4 flex flex-col justify-between hover:border-neutral-700 transition-colors"
              >
                <div>
                  <div className="flex items-start gap-3 mb-3">
                    <img src={prod.photo} alt={prod.name} className="w-16 h-16 rounded-xl object-cover border border-neutral-700 shrink-0" />
                    <div>
                      <h3 className="text-xs font-bold text-white leading-tight">{prod.name}</h3>
                      <p className="text-[11px] text-neutral-400 mt-1 line-clamp-2">{prod.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[var(--gold-primary)] font-bold text-sm">
                      {formatCurrency(prod.price, currency)}
                    </span>
                    <span className="text-[10px] text-neutral-500 font-sans">{prod.stock} disponibles</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-neutral-800">
                  <button
                    onClick={() => handleAddToCart(prod)}
                    className="w-full py-2 rounded-xl bg-[#202020] hover:bg-[var(--gold-primary)] hover:text-black font-semibold text-xs text-neutral-200 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar al Pedido</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Live Cart Drawer */}
        <div className="lg:col-span-4 bg-[#141414] border border-[#262626] rounded-2xl p-5 shadow-xl flex flex-col justify-between sticky top-20">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-[var(--gold-primary)]" />
                <h3 className="text-sm font-bold text-white">Mi Carrito de Sala</h3>
              </div>
              <span className="text-xs font-mono text-neutral-400">{cart.length} items</span>
            </div>

            {cart.length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-500 space-y-2">
                <Coffee className="w-8 h-8 mx-auto text-neutral-700" />
                <p>Tu carrito está vacío. Agrega una bebida o producto para recoger en barra.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {cart.map(item => (
                  <div key={item.product.id} className="p-2.5 bg-[#181818] rounded-xl border border-neutral-800 text-xs flex items-center justify-between gap-2">
                    <div className="truncate">
                      <div className="font-bold text-white truncate">{item.product.name}</div>
                      <div className="text-[11px] font-mono text-[var(--gold-primary)]">
                        {formatCurrency(item.product.price * item.quantity, currency)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleUpdateQuantity(item.product.id, -1)}
                        className="w-6 h-6 rounded-md bg-neutral-800 flex items-center justify-center text-neutral-300 hover:text-white"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-5 text-center font-mono font-bold text-white text-xs">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleUpdateQuantity(item.product.id, 1)}
                        className="w-6 h-6 rounded-md bg-neutral-800 flex items-center justify-center text-neutral-300 hover:text-white"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {cart.length > 0 && (
            <div className="mt-4 pt-3 border-t border-neutral-800 space-y-3">
              <div className="flex justify-between items-center text-sm font-bold">
                <span className="text-neutral-400">Total a pagar:</span>
                <span className="font-mono text-emerald-400">{formatCurrency(cartTotal, currency)}</span>
              </div>

              <button
                onClick={handleConfirmOrder}
                className="w-full py-3 rounded-xl bg-[var(--gold-primary)] text-black font-extrabold text-xs uppercase tracking-wider hover:bg-[var(--gold-hover)] transition-all shadow-lg shadow-[var(--gold-primary)]/10"
              >
                Generar Código de Recogida
              </button>
              <p className="text-[10px] text-neutral-500 text-center">
                Se generará un código para mostrar y pagar en caja al recibir tus productos.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
