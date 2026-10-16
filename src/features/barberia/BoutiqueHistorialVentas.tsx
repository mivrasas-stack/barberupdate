import React,{useEffect,useRef,useState} from 'react';
import {useApp} from '../../context/AppContext';
import {backendRequest} from '../../services/liveBackend';
import {formatCurrency} from '../../utils/formatters';
import {CheckCircle2,ChevronDown,History,RotateCcw,Search,ShoppingBag} from 'lucide-react';

type HistoryItem={productName:string;category:string;quantity:number;unitPriceMinor:number;subtotalMinor:number};
type HistoryPayment={id:string;amountMinor:number;method:string;confirmedAt:string;reference:string|null};
type HistorySale={
  id:string;pickupCode:string;customerName:string;status:string;totalMinor:number;
  confirmedMinor:number;refundedMinor:number;netMinor:number;
  createdAt:string;lastPaidAt:string|null;payments:HistoryPayment[];items:HistoryItem[]
};
type HistoryResponse={sales:HistorySale[];nextCursor:string|null};
const methodNames:Record<string,string>={
  cash:'Efectivo',nequi:'Nequi',daviplata:'Daviplata',
  transfer:'Transferencia',debit:'Tarjeta débito',credit:'Tarjeta crédito'
};
const categoryNames:Record<string,string>={
  beauty:'Belleza',food_drinks:'Comidas y bebidas',barbershop_merch:'Merch'
};
const statusNames:Record<string,string>={
  received:'Recibido',preparing:'En preparación',ready:'Listo',delivered:'Entregado',cancelled:'Cancelado'
};
const dateText=(input:string|null)=>{
  if(!input)return 'Sin fecha';
  const date=new Date(input);
  return Number.isNaN(date.valueOf())?'Sin fecha':new Intl.DateTimeFormat('es-CO',{
    dateStyle:'medium',timeStyle:'short'
  }).format(date);
};

export const BoutiqueHistorialVentas:React.FC<{tenantId:string}>=({tenantId})=>{
  const {currency}=useApp();
  const [search,setSearch]=useState('');
  const [appliedSearch,setAppliedSearch]=useState('');
  const [reload,setReload]=useState(0);
  const [sales,setSales]=useState<HistorySale[]>([]);
  const [nextCursor,setNextCursor]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const sequence=useRef(0);

  const load=async(cursor:string|null,filter:string,append:boolean)=>{
    const request=++sequence.current;
    setLoading(true);setError('');
    try{
      const params=new URLSearchParams({limit:'20'});
      if(cursor)params.set('cursor',cursor);
      if(filter)params.set('q',filter);
      const data=await backendRequest<HistoryResponse>(
        '/tenants/'+encodeURIComponent(tenantId)+'/orders/sales-history?'+params.toString());
      if(request!==sequence.current)return;
      setSales(previous=>append?[...previous,...data.sales]:data.sales);
      setNextCursor(data.nextCursor);
    }catch(err){
      if(request!==sequence.current)return;
      setError(err instanceof Error?err.message:'No se pudo cargar el historial de ventas');
      if(!append){setSales([]);setNextCursor(null);}
    }finally{
      if(request===sequence.current)setLoading(false);
    }
  };

  useEffect(()=>{
    setSales([]);setNextCursor(null);
    void load(null,appliedSearch,false);
    return ()=>{sequence.current++;};
  },[tenantId,appliedSearch,reload]);

  const onSearch=(event:React.FormEvent)=>{
    event.preventDefault();
    const value=search.trim().slice(0,80);
    setAppliedSearch(value);
    setReload(r=>r+1);
  };
  const visibleNet=sales.reduce((sum,sale)=>sum+sale.netMinor,0);

  return <section className="mx-auto max-w-5xl space-y-5">
    <div className="rounded-2xl border border-[#303030] bg-[#141414] p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <History className="h-7 w-7 shrink-0 text-[var(--gold-primary)]"/>
          <div><h2 className="text-xl font-extrabold text-white">Historial de ventas de Boutique</h2>
            <p className="mt-1 text-xs text-neutral-400">
              Consulta los cobros confirmados de productos, comidas, bebidas y merchandising.
              Los pedidos sin pagar no aparecen como ventas.
            </p>
          </div>
        </div>
        <button type="button" disabled={loading} onClick={()=>setReload(r=>r+1)}
          className="flex items-center gap-2 rounded-xl border border-[#383838] px-3 py-2 text-xs font-semibold text-neutral-300 disabled:opacity-50">
          <RotateCcw size={15}/> Actualizar
        </button>
      </div>
      <form onSubmit={onSearch} className="flex flex-col gap-2 sm:flex-row">
        <label className="flex-1 text-xs font-semibold text-neutral-300">
          Buscar por cliente o código (también en ventas anteriores)
          <input value={search} onChange={e=>setSearch(e.target.value)} maxLength={80}
            placeholder="Nombre del cliente o PK-1234ABCD"
            className="mt-2 block w-full rounded-xl border border-[#343434] bg-[#111] px-4 py-3 text-sm text-white focus:outline-none focus:border-[var(--gold-primary)]"/>
        </label>
        <button type="submit" disabled={loading} className="flex items-center justify-center gap-2 self-stretch rounded-xl bg-[var(--gold-primary)] px-5 py-3 text-sm font-bold text-black disabled:opacity-50 sm:self-end">
          <Search size={16}/> Buscar
        </button>
      </form>
    </div>

    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#303030] bg-[#141414] px-5 py-4">
      <div><span className="block text-[11px] text-neutral-500">Ventas cargadas</span>
        <strong className="text-lg text-white">{sales.length}</strong>
        {nextCursor&&<span className="ml-2 text-xs text-neutral-500">· Hay ventas anteriores</span>}
      </div>
      <div className="text-right"><span className="block text-[11px] text-neutral-500">Total neto de las ventas cargadas</span>
        <strong className="text-lg text-emerald-300">{formatCurrency(visibleNet,currency)}</strong>
      </div>
    </div>

    {error&&<div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
      {error} <button type="button" className="ml-2 underline" onClick={()=>setReload(r=>r+1)}>Reintentar</button>
    </div>}
    {!loading&&!error&&!sales.length&&<div className="rounded-2xl border border-[#303030] bg-[#141414] p-8 text-center text-neutral-400">
      <ShoppingBag className="mx-auto mb-3 h-8 w-8 text-neutral-500"/>
      <p className="font-semibold">No se encontraron ventas cobradas.</p>
      <p className="mt-2 text-xs">Las ventas aparecerán cuando confirmes un pago desde «Cobrar pedido por código».</p>
    </div>}

    <div className="space-y-3">
      {sales.map(sale=><article key={sale.id} className="overflow-hidden rounded-2xl border border-[#303030] bg-[#141414]">
        <div className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-start">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-[var(--gold-primary)]">{sale.pickupCode}</span>
              <span className={'rounded-full px-2.5 py-1 text-[10px] font-bold '+(sale.refundedMinor>=sale.confirmedMinor?'bg-red-500/15 text-red-300':sale.refundedMinor>0?'bg-amber-500/15 text-amber-300':'bg-emerald-500/15 text-emerald-300')}>
                {sale.refundedMinor>=sale.confirmedMinor?'Devuelta':sale.refundedMinor>0?'Devolución parcial':'Pago confirmado'}
              </span>
              <span className="rounded-full border border-[#383838] px-2.5 py-1 text-[10px] text-neutral-400">{statusNames[sale.status]||sale.status}</span>
            </div>
            <h3 className="text-base font-bold text-white">{sale.customerName}</h3>
            <div className="text-xs text-neutral-400">Cobrado: {dateText(sale.lastPaidAt)}</div>
            <div className="text-xs text-neutral-500">Pedido creado: {dateText(sale.createdAt)}</div>
          </div>
          <div className="sm:text-right">
            <span className="block text-xs text-neutral-400">Ingreso neto registrado</span>
            <strong className="text-xl text-emerald-300">{formatCurrency(sale.netMinor,currency)}</strong>
            <div className="mt-1 text-xs text-neutral-400">
              {sale.payments.map(p=>methodNames[p.method]||p.method).filter((v,i,a)=>a.indexOf(v)===i).join(' + ')||'Sin método'}
            </div>
            {sale.refundedMinor>0&&<div className="mt-1 text-xs text-amber-300">Devuelto: {formatCurrency(sale.refundedMinor,currency)}</div>}
          </div>
        </div>
        <details className="border-t border-[#2b2b2b] px-5 py-3">
          <summary className="flex cursor-pointer items-center justify-between gap-2 text-xs font-bold text-[var(--gold-primary)]">
            <span className="flex items-center gap-2"><CheckCircle2 size={15}/> Ver artículos y comprobantes ({sale.items.length})</span>
            <ChevronDown size={16}/>
          </summary>
          <div className="pt-4 space-y-4">
            <div className="overflow-x-auto"><table className="w-full text-xs text-left">
              <thead><tr className="border-b border-[#333] text-neutral-400">
                <th className="py-2">Artículo</th><th className="py-2 text-center">Cant.</th><th className="py-2 text-right">Precio</th><th className="py-2 text-right">Subtotal</th>
              </tr></thead>
              <tbody>{sale.items.map((item,index)=><tr key={sale.id+'-'+index} className="border-b border-[#242424]">
                <td className="py-3 font-semibold text-white">{item.productName}<span className="block font-normal text-neutral-500">{categoryNames[item.category]||'Artículo'}</span></td>
                <td className="text-center text-neutral-300">{item.quantity}</td>
                <td className="text-right text-neutral-300">{formatCurrency(item.unitPriceMinor,currency)}</td>
                <td className="text-right font-semibold text-white">{formatCurrency(item.subtotalMinor,currency)}</td>
              </tr>)}</tbody>
            </table></div>
            <div className="space-y-2 text-xs text-neutral-300">
              <div className="flex justify-between"><span>Valor del pedido</span><strong>{formatCurrency(sale.totalMinor,currency)}</strong></div>
              <div className="flex justify-between"><span>Cobrado</span><strong>{formatCurrency(sale.confirmedMinor,currency)}</strong></div>
              {sale.refundedMinor>0&&<div className="flex justify-between text-amber-300"><span>Devoluciones</span><strong>- {formatCurrency(sale.refundedMinor,currency)}</strong></div>}
              {sale.payments.map(payment=><div key={payment.id} className="rounded-xl bg-[#1d1d1d] p-3">
                <div className="flex flex-wrap justify-between gap-2"><span>{methodNames[payment.method]||payment.method} · {dateText(payment.confirmedAt)}</span>
                  <strong>{formatCurrency(payment.amountMinor,currency)}</strong></div>
                {payment.reference&&<p className="mt-1 break-all text-neutral-500">Referencia: {payment.reference}</p>}
                <p className="mt-1 break-all text-[10px] text-neutral-500">Comprobante interno: {payment.id}</p>
              </div>)}
            </div>
          </div>
        </details>
      </article>)}
    </div>

    {loading&&<p role="status" className="py-5 text-center text-xs text-neutral-400">Cargando ventas...</p>}
    {nextCursor&&!loading&&<button type="button" onClick={()=>void load(nextCursor,appliedSearch,true)}
      className="w-full rounded-xl border border-[var(--gold-primary)]/40 bg-[#171717] px-5 py-3 text-sm font-bold text-[var(--gold-primary)]">
      Cargar ventas anteriores
    </button>}
    <p className="text-xs text-neutral-500">El historial se basa en pagos realmente confirmados. Las devoluciones se descuentan del ingreso neto; los pedidos pendientes de cobro no se cuentan como ventas.</p>
  </section>;
};
