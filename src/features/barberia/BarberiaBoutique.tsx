import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { barberStore } from '../../services/store';
import { formatCurrency } from '../../utils/formatters';
import { Product, ProductCategory } from '../../types';
import {isLiveBackend, addProduct, adjustStock, setProductVisibility, refreshLiveData} from '../../services/liveBackend';
import {
  ShoppingBag,
  Sparkles,
  Coffee,
  Shirt,
  Plus,
  Search,
  AlertTriangle,
  Eye,
  EyeOff,
  X,
  PackagePlus,
  PackageMinus,
  CheckCircle2,
} from 'lucide-react';

export const BarberiaBoutique: React.FC = () => {
  const { currentShop, state, currency, addToast } = useApp();
  const [activeCategory, setActiveCategory] = useState<ProductCategory>('beauty');
  const [search, setSearch] = useState('');

  // Modals
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjustQuantity, setAdjustQuantity] = useState(1);
  const [adjustReason, setAdjustReason] = useState('Reposición de proveedor');

  // Form states for New Product
  const [newProdName, setNewProdName] = useState('');
  const [newProdDesc, setNewProdDesc] = useState('');
  const [newProdPhoto, setNewProdPhoto] = useState('https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=200&auto=format&fit=crop&q=80');
  const [newProdPrice, setNewProdPrice] = useState(50000);
  const [newProdCost, setNewProdCost] = useState(25000);
  const [newProdStock, setNewProdStock] = useState(10);
  const [newProdMinStock, setNewProdMinStock] = useState(4);
  const [newProdSku, setNewProdSku] = useState('SKU-NEW-01');

  const shopId = currentShop?.id || 'shop-1';

  const products = state.products.filter(p => {
    const matchesShop = p.businessId === shopId;
    const matchesCategory = p.category === activeCategory;
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    return matchesShop && matchesCategory && matchesSearch;
  });

  const lowStockCount = state.products.filter(
    p => p.businessId === shopId && p.stock <= p.minStock
  ).length;

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if(isLiveBackend){
      try{
        await addProduct(shopId,{name:newProdName,sku:newProdSku,price:newProdPrice,stock:newProdStock,
          description:newProdDesc,photo:newProdPhoto,category:activeCategory,cost:newProdCost,
          minStock:newProdMinStock,isVisibleInWaitingRoom:true});
        await refreshLiveData();
        addToast('Producto creado en el backend', 'success');
        setIsNewProductModalOpen(false);
        setNewProdName('');setNewProdDesc('');
      }catch(e){addToast(e instanceof Error?e.message:'No se pudo crear el producto','error');}
      return;
    }
    barberStore.createProduct({
      businessId: shopId,
      name: newProdName,
      description: newProdDesc,
      photo: newProdPhoto,
      category: activeCategory,
      price: newProdPrice,
      cost: newProdCost,
      stock: newProdStock,
      minStock: newProdMinStock,
      sku: newProdSku,
      isActive: true,
      isVisibleInWaitingRoom: true,
    });
    addToast(`Producto ${newProdName} creado exitosamente`, 'success');
    setIsNewProductModalOpen(false);
    setNewProdName('');
    setNewProdDesc('');
  };

  const handleAdjustStock = async (isAddition: boolean) => {
    if (!adjustingProduct) return;
    if(isLiveBackend){
      try{
        const delta=isAddition?adjustQuantity:-adjustQuantity;
        await adjustStock(shopId,adjustingProduct.id,delta,adjustReason);
        await refreshLiveData();
        addToast('Inventario actualizado en el backend','success');
        setAdjustingProduct(null);
      }catch(e){addToast(e instanceof Error?e.message:'Error de inventario','error');}
      return;
    }
    const delta = isAddition ? adjustQuantity : -adjustQuantity;
    const ok = barberStore.updateProductStock(adjustingProduct.id, delta, adjustReason);
    if (!ok) {
      addToast('No es posible reducir el inventario por debajo de 0 unidades.', 'error');
      return;
    }
    addToast(`Stock actualizado para ${adjustingProduct.name}`, 'success');
    setAdjustingProduct(null);
  };

  const handleToggleWaitingRoom = (prod: Product) => {
    if(isLiveBackend){
      void setProductVisibility(shopId,prod.id,!prod.isVisibleInWaitingRoom).then(refreshLiveData)
        .then(()=>addToast('Visibilidad actualizada en el backend','success'))
        .catch(e=>addToast(e instanceof Error?e.message:'Error al actualizar visibilidad','error'));
      return;
    }
    prod.isVisibleInWaitingRoom = !prod.isVisibleInWaitingRoom;
    barberStore.updateProductStock(prod.id, 0, 'Cambio de visibilidad sala');
    addToast(`Visibilidad en sala de espera: ${prod.isVisibleInWaitingRoom ? 'Visible' : 'Oculto'}`, 'info');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242424]">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">
            Boutique & Mercancías
          </span>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Inventario de Barbería</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Administra productos de belleza, comidas & bebidas de sala de espera y merchandising
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lowStockCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{lowStockCount} con bajo stock</span>
            </div>
          )}

          <button
            onClick={() => setIsNewProductModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--gold-primary)] text-black text-xs font-bold hover:bg-[var(--gold-hover)] transition-all shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Producto</span>
          </button>
        </div>
      </div>

      {/* 3 Main Category Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => setActiveCategory('beauty')}
          className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all ${
            activeCategory === 'beauty'
              ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10 shadow-lg shadow-[var(--gold-primary)]/5'
              : 'border-[#262626] bg-[#141414] hover:border-neutral-700'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs uppercase font-bold text-neutral-400 block">Pestaña A</span>
            <span className="text-sm font-bold text-white">Productos de Belleza</span>
            <span className="text-[11px] text-neutral-500 block">Ceras, pomadas, aceites, champús</span>
          </div>
        </button>

        <button
          onClick={() => setActiveCategory('food_drinks')}
          className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all ${
            activeCategory === 'food_drinks'
              ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10 shadow-lg shadow-[var(--gold-primary)]/5'
              : 'border-[#262626] bg-[#141414] hover:border-neutral-700'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Coffee className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs uppercase font-bold text-neutral-400 block">Pestaña B</span>
            <span className="text-sm font-bold text-white">Comidas & Bebidas</span>
            <span className="text-[11px] text-neutral-500 block">Café, cervezas, Red Bull, agua</span>
          </div>
        </button>

        <button
          onClick={() => setActiveCategory('barbershop_merch')}
          className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all ${
            activeCategory === 'barbershop_merch'
              ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10 shadow-lg shadow-[var(--gold-primary)]/5'
              : 'border-[#262626] bg-[#141414] hover:border-neutral-700'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Shirt className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs uppercase font-bold text-neutral-400 block">Pestaña C</span>
            <span className="text-sm font-bold text-white">Merch & Barbería</span>
            <span className="text-[11px] text-neutral-500 block">Camisetas, gorras, peines, capas</span>
          </div>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Buscar productos en ${activeCategory === 'beauty' ? 'Belleza' : activeCategory === 'food_drinks' ? 'Bebidas y Comidas' : 'Merch'}...`}
          className="w-full bg-[#141414] border border-[#262626] rounded-xl pl-9 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--gold-primary)] transition-colors"
        />
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map(prod => {
          const isLowStock = prod.stock <= prod.minStock;
          const margin = prod.price - prod.cost;

          return (
            <div
              key={prod.id}
              className={`bg-[#141414] border rounded-2xl p-4 flex flex-col justify-between transition-all ${
                isLowStock ? 'border-amber-500/40 bg-amber-500/5' : 'border-[#262626]'
              }`}
            >
              <div>
                <div className="flex items-start gap-3 mb-3">
                  <img
                    src={prod.photo}
                    alt={prod.name}
                    className="w-16 h-16 rounded-xl object-cover border border-neutral-700 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-neutral-500">{prod.sku}</span>
                      <button
                        onClick={() => handleToggleWaitingRoom(prod)}
                        className={`text-[10px] flex items-center gap-1 font-semibold ${
                          prod.isVisibleInWaitingRoom ? 'text-emerald-400' : 'text-neutral-500'
                        }`}
                        title="Visibilidad para clientes en sala de espera"
                      >
                        {prod.isVisibleInWaitingRoom ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        <span>{prod.isVisibleInWaitingRoom ? 'En Sala' : 'Oculto'}</span>
                      </button>
                    </div>
                    <h3 className="text-xs font-bold text-white mt-0.5 truncate">{prod.name}</h3>
                    <p className="text-[11px] text-neutral-400 line-clamp-2 mt-0.5">{prod.description}</p>
                  </div>
                </div>

                <div className="p-3 bg-[#181818] rounded-xl border border-neutral-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Precio Venta:</span>
                    <span className="font-mono font-bold text-[var(--gold-primary)]">
                      {formatCurrency(prod.price, currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-neutral-500">Costo Adquisición:</span>
                    <span className="font-mono text-neutral-300">{formatCurrency(prod.cost, currency)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-neutral-500">Margen Bruto:</span>
                    <span className="font-mono text-emerald-400">+{formatCurrency(margin, currency)}</span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Existencias Disponibles:</span>
                  <div className="text-right">
                    <span className={`font-mono font-bold text-sm ${isLowStock ? 'text-amber-400' : 'text-white'}`}>
                      {prod.stock} u.
                    </span>
                    <span className="text-[10px] text-neutral-500 block">mínimo {prod.minStock}</span>
                  </div>
                </div>
              </div>

              {/* Adjust Stock Button */}
              <div className="mt-4 pt-3 border-t border-neutral-800 flex items-center justify-between">
                <button
                  onClick={() => {
                    setAdjustingProduct(prod);
                    setAdjustQuantity(1);
                  }}
                  className="w-full py-1.5 rounded-lg bg-[#202020] hover:bg-[#282828] text-xs font-semibold text-neutral-200 hover:text-white transition-colors text-center"
                >
                  Ajustar Inventario (+ / -)
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Ajustar Inventario */}
      {adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-[#141414] border border-[#262626] rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
              <h3 className="text-sm font-bold text-white">Ajustar Stock: {adjustingProduct.name}</h3>
              <button
                onClick={() => setAdjustingProduct(null)}
                className="p-1 text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="p-3 bg-[#181818] rounded-xl border border-neutral-800">
                <div className="text-neutral-400">Stock Actual en Sistema:</div>
                <div className="text-xl font-mono font-bold text-white">{adjustingProduct.stock} unidades</div>
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Cantidad a Ajustar</label>
                <input
                  type="number"
                  min={1}
                  value={adjustQuantity}
                  onChange={e => setAdjustQuantity(Number(e.target.value))}
                  className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Motivo / Justificación</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div className="pt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleAdjustStock(false)}
                  className="py-2.5 rounded-xl bg-red-500/20 text-red-300 border border-red-500/30 font-bold hover:bg-red-500/30 flex items-center justify-center gap-1.5"
                >
                  <PackageMinus className="w-4 h-4" />
                  <span>Salida / Merma</span>
                </button>
                <button
                  onClick={() => handleAdjustStock(true)}
                  className="py-2.5 rounded-xl bg-emerald-500 text-black font-bold hover:bg-emerald-400 flex items-center justify-center gap-1.5"
                >
                  <PackagePlus className="w-4 h-4" />
                  <span>Entrada / Compra</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nuevo Producto */}
      {isNewProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-[#141414] border border-[#262626] rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
              <h3 className="text-base font-bold text-white">Crear Producto para Boutique</h3>
              <button
                onClick={() => setIsNewProductModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="py-4 space-y-3 text-xs">
              <div>
                <label className="text-neutral-400 block mb-1">Nombre Comercial del Producto</label>
                <input
                  type="text"
                  required
                  value={newProdName}
                  onChange={e => setNewProdName(e.target.value)}
                  placeholder="Ej. Cera Fijadora Mate Barber Club"
                  className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={newProdDesc}
                  onChange={e => setNewProdDesc(e.target.value)}
                  placeholder="Detalles de fragancia, fijación o ingredientes..."
                  className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-neutral-400 block mb-1">Precio de Venta (COP)</label>
                  <input
                    type="number"
                    required
                    value={newProdPrice}
                    onChange={e => setNewProdPrice(Number(e.target.value))}
                    className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-neutral-400 block mb-1">Costo Adquisición (COP)</label>
                  <input
                    type="number"
                    required
                    value={newProdCost}
                    onChange={e => setNewProdCost(Number(e.target.value))}
                    className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-neutral-400 block mb-1">Stock Inicial</label>
                  <input
                    type="number"
                    value={newProdStock}
                    onChange={e => setNewProdStock(Number(e.target.value))}
                    className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-neutral-400 block mb-1">Stock Mínimo</label>
                  <input
                    type="number"
                    value={newProdMinStock}
                    onChange={e => setNewProdMinStock(Number(e.target.value))}
                    className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-neutral-400 block mb-1">Código SKU</label>
                  <input
                    type="text"
                    value={newProdSku}
                    onChange={e => setNewProdSku(e.target.value)}
                    className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#262626] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewProductModalOpen(false)}
                  className="px-4 py-2 text-neutral-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[var(--gold-primary)] text-black font-bold hover:bg-[var(--gold-hover)]"
                >
                  Guardar Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
