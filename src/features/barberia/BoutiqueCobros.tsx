import React,{useEffect,useState} from 'react';
import {useApp} from '../../context/AppContext';
import {backendRequest,isLiveBackend,refreshLiveData} from '../../services/liveBackend';
import {formatCurrency} from '../../utils/formatters';
import {CreditCard,ReceiptText,Search,ShieldCheck,RotateCcw,CheckCircle2} from 'lucide-react';

type PaymentMethod='cash'|'transfer'|'nequi'|'daviplata'|'debit'|'credit';
type OrderLine={
  productId:string;productName:string;category:'beauty'|'food_drinks'|'barbershop_merch';
  quantity:number;unitPriceMinor:number;subtotalMinor:number
};
type PickupOrder={
  id:string;pickupCode:string;customerName:string;status:string;totalMinor:number;createdAt:string;
  items:OrderLine[];confirmedMinor:number;refundedMinor:number;balanceMinor:number;
  pendingPayments:{id:string;amountMinor:number;method:PaymentMethod;createdAt:string}[];
  verification:string
};
type PaidReceipt={paymentId:string;pickupCode:string;customerName:string;amountMinor:number;method:PaymentMethod;reference:string};
const methods:{id:PaymentMethod;label:string}[]=[
  {id:'cash',label:'Efectivo'},{id:'nequi',label:'Nequi'},
  {id:'daviplata',label:'Daviplata'},{id:'transfer',label:'Transferencia'},
  {id:'debit',label:'Tarjeta débito'},{id:'credit',label:'Tarjeta crédito'}
];
const categoryLabel:Record<OrderLine['category'],string>={
  beauty:'Productos de belleza',food_drinks:'Comidas y bebidas',barbershop_merch:'Merchandising'
};
const statusLabel:Record<string,string>={received:'Recibido',preparing:'En preparación',ready:'Listo para entregar',delivered:'Entregado',cancelled:'Cancelado'};
const field='w-full bg-[#111111] border border-[#363636] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[var(--gold-primary)]';

export const BoutiqueCobros:React.FC<{tenantId:string}>=({tenantId})=>{
  const {currency,addToast,navigate,currentShop}=useApp();
  const [code,setCode]=useState('');
  const [order,setOrder]=useState<PickupOrder|null>(null);
  const [method,setMethod]=useState<PaymentMethod>('cash');
  const [reference,setReference]=useState('');
  const [received,setReceived]=useState(false);
  const [busy,setBusy]=useState(false);
  const [key,setKey]=useState('');
  const [receipt,setReceipt]=useState<PaidReceipt|null>(null);
  useEffect(()=>{
    setCode('');setOrder(null);setReceipt(null);setReceived(false);setReference('');setKey('');
  },[tenantId]);

  const fetchOrder=async(pickup:string,reset=false)=>{
    const record=await backendRequest<PickupOrder>(
      '/tenants/'+encodeURIComponent(tenantId)+'/orders/by-pickup-code?code='+encodeURIComponent(pickup.trim().toUpperCase()));
    setOrder(record);
    if(reset){
      setReceipt(null);
      setReference('');
      setReceived(false);
      setMethod(record.pendingPayments[0]?.method||'cash');
      setKey('pay'+crypto.randomUUID().replace(/-/g,''));
    }
    return record;
  };
  const searchOrder=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(!isLiveBackend){addToast('El cobro requiere la conexión real al servidor','error');return;}
    setOrder(null);setReceipt(null);
    setBusy(true);
    try{await fetchOrder(code,true);}
    catch(error){addToast(error instanceof Error?error.message:'No fue posible consultar el pedido','error');}
    finally{setBusy(false);}
  };
  const confirmPayment=async()=>{
    if(!order||busy||order.status==='cancelled'||order.balanceMinor<=0)return;
    if(!received){addToast('Confirma que recibiste y verificaste el dinero antes de registrar el cobro','error');return;}
    if(method!=='cash'&&reference.trim().length<3){
      addToast('Ingresa la referencia del comprobante para ese método de pago','error');return;
    }
    if(order.pendingPayments.length>1){
      addToast('El pedido tiene varios pagos pendientes. Revísalos antes de continuar.','error');return;
    }
    const pending=order.pendingPayments[0];
    if(pending&&(pending.method!==method||pending.amountMinor!==order.balanceMinor)){
      addToast('Hay un cobro pendiente diferente. Confírmalo o anúlalo antes de registrar otro.','error');return;
    }
    setBusy(true);
    try{
      const created=pending||await backendRequest<{id:string;amount_minor:number;method:PaymentMethod}>(
        '/tenants/'+encodeURIComponent(tenantId)+'/orders/'+encodeURIComponent(order.id)+'/payments/manual',
        {method:'POST',body:JSON.stringify({amountMinor:order.balanceMinor,method}),
          headers:{'Idempotency-Key':key}});
      const confirmation=await backendRequest<{id:string;amount_minor:number;method:PaymentMethod}>(
        '/tenants/'+encodeURIComponent(tenantId)+'/payments/'+encodeURIComponent(created.id)+'/confirm-manual',
        {method:'POST',body:JSON.stringify({...(method==='cash'?{}:{reference:reference.trim()})})});
      setReceipt({paymentId:confirmation.id,pickupCode:order.pickupCode,customerName:order.customerName,
        amountMinor:Number(confirmation.amount_minor),method:confirmation.method,reference:reference.trim()});
      // The payment and accounting entry are already committed at this point.
      try{await refreshLiveData();await fetchOrder(order.pickupCode);}
      catch{addToast('Cobro registrado. Actualiza la pantalla para ver el estado reciente.','info');}
      addToast('¡Pago confirmado! El ingreso se registró automáticamente en Contabilidad.','success');
      setReceived(false);
    }catch(error){
      addToast(error instanceof Error?error.message:'No se pudo confirmar el cobro','error');
      // If the first request succeeded but the confirmation failed, re-fetch the
      // pending payment instead of accidentally creating another charge.
      try{await fetchOrder(order.pickupCode);}catch{/* keep visible order for retries */}
    }finally{setBusy(false);}
  };
  const markDelivered=async()=>{
    if(!order || busy || order.balanceMinor>0 || order.status==='cancelled' || order.status==='delivered')return;
    if(!window.confirm('¿Ya entregaste físicamente los artículos del pedido '+order.pickupCode+' al cliente?'))return;
    setBusy(true);
    try{
      await backendRequest('/tenants/'+encodeURIComponent(tenantId)+'/orders/'+encodeURIComponent(order.id)+'/deliver',{method:'POST'});
      try{await refreshLiveData();}catch{/* the delivery has committed */}
      await fetchOrder(order.pickupCode);
      addToast('Pedido marcado como entregado, sin generar otro cobro.','success');
    }catch(err){addToast(err instanceof Error?err.message:'No se pudo registrar la entrega','error');}
    finally{setBusy(false);}
  };
  const voidPending=async(paymentId:string)=>{
    if(!order||busy)return;
    if(!window.confirm('¿Anular este intento de cobro pendiente? Esto NO devuelve dinero y no afecta pagos ya confirmados.'))return;
    setBusy(true);
    try{
      await backendRequest('/tenants/'+encodeURIComponent(tenantId)+'/payments/'+encodeURIComponent(paymentId)+'/void-pending',{method:'POST'});
      await fetchOrder(order.pickupCode);
      setKey('pay'+crypto.randomUUID().replace(/-/g,''));
      setReceived(false);
      addToast('Intento pendiente anulado. Puedes elegir otro medio de pago.','success');
    }catch(err){addToast(err instanceof Error?err.message:'No se pudo anular el intento','error');}
    finally{setBusy(false);}
  };

  return <section className="space-y-5 max-w-4xl mx-auto">
    <div className="bg-[#141414] border border-[#303030] rounded-2xl p-5 sm:p-6 space-y-4">
      <div className="flex items-start gap-3">
        <ReceiptText className="w-7 h-7 text-[var(--gold-primary)] shrink-0"/>
        <div><h2 className="text-lg font-extrabold text-white">Cobrar pedido de sala de espera</h2>
          <p className="text-xs text-neutral-400 mt-1">Consulta el código del cliente y revisa todos sus artículos: productos, comidas, bebidas y merch.</p></div>
      </div>
      <form onSubmit={e=>void searchOrder(e)} className="flex flex-col sm:flex-row gap-3">
        <label className="flex-1 text-xs font-semibold text-neutral-300">Código de recogida
          <input type="text" autoComplete="off" autoCapitalize="characters" placeholder="PK-1234ABCD"
            pattern="PK-[a-zA-Z0-9]{8}" maxLength={11} required value={code}
            onChange={e=>{setCode(e.target.value.toUpperCase().trim());setOrder(null);setReceipt(null);}}
            className={field+' block mt-2 font-mono tracking-wider'}/>
        </label>
        <button type="submit" disabled={busy} className="sm:self-end flex items-center justify-center gap-2 bg-[var(--gold-primary)] text-black px-5 py-3 rounded-xl font-bold text-sm disabled:opacity-50">
          <Search size={17}/>{busy?'Consultando...':'Buscar pedido'}
        </button>
      </form>
    </div>

    {order&&<div className="bg-[#141414] border border-[#303030] rounded-2xl p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div><span className="text-xs text-neutral-500 uppercase">Pedido {order.pickupCode}</span>
          <h3 className="text-xl font-bold text-white">{order.customerName}</h3>
          <p className="text-xs text-neutral-400 mt-1">Estado: {statusLabel[order.status]||order.status}</p></div>
        <button type="button" disabled={busy} onClick={()=>void fetchOrder(order.pickupCode).catch(err=>addToast(err instanceof Error?err.message:'No se pudo actualizar','error'))}
          className="flex items-center gap-2 text-xs text-neutral-300 border border-[#333] px-3 py-2 rounded-xl disabled:opacity-50"><RotateCcw size={15}/>Actualizar</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead><tr className="text-neutral-400 border-b border-neutral-700"><th className="py-3">Artículo / Categoría</th><th className="py-3 text-center">Cant.</th><th className="py-3 text-right">Precio</th><th className="py-3 text-right">Subtotal</th></tr></thead>
          <tbody>{order.items.map((item,i)=><tr key={item.productId+'-'+i} className="border-b border-[#292929]">
            <td className="py-3 text-white font-semibold">{item.productName}<span className="block text-[11px] text-neutral-500 font-normal">{categoryLabel[item.category]||'Producto'}</span></td>
            <td className="py-3 text-center text-neutral-300">{item.quantity}</td>
            <td className="py-3 text-right text-neutral-300 whitespace-nowrap">{formatCurrency(item.unitPriceMinor,currency)}</td>
            <td className="py-3 text-right font-semibold text-white whitespace-nowrap">{formatCurrency(item.subtotalMinor,currency)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="bg-[#1c1c1c] rounded-xl p-4 space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-neutral-400">Total del pedido</span><strong className="text-white">{formatCurrency(order.totalMinor,currency)}</strong></div>
        <div className="flex justify-between"><span className="text-neutral-400">Pagos netos confirmados</span><strong className="text-emerald-300">{formatCurrency(order.confirmedMinor-order.refundedMinor,currency)}</strong></div>
        <div className="flex justify-between border-t border-[#343434] pt-2"><span className="font-semibold text-white">Saldo por cobrar</span><strong className="text-lg text-[var(--gold-primary)]">{formatCurrency(order.balanceMinor,currency)}</strong></div>
      </div>
      {order.status==='cancelled'?<p className="text-rose-300 text-sm">El pedido está cancelado y no admite nuevos pagos.</p>:
       order.balanceMinor<=0?<div className="flex items-center gap-2 text-emerald-300 text-sm"><CheckCircle2 size={20}/>El pedido está pagado. No se generará otro cobro.</div>:
       <div className="space-y-4">
         <div>
           <p className="font-semibold text-sm text-white mb-2">Método de pago recibido</p>
           <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
             {methods.map(m=><button key={m.id} type="button" disabled={busy||Boolean(order.pendingPayments.length)}
               aria-pressed={method===m.id} onClick={()=>{setMethod(m.id);setReceived(false);}}
               className={'p-3 rounded-xl border text-xs font-semibold disabled:opacity-50 '+(method===m.id?'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10 text-[var(--gold-primary)]':'border-[#343434] text-neutral-300')}>{m.label}</button>)}
           </div>
         </div>
         {method!=='cash'&&<label className="block text-xs text-neutral-300 font-semibold">Referencia del pago o comprobante *
           <input className={field+' mt-2 block'} value={reference} onChange={e=>setReference(e.target.value)} maxLength={120}
             placeholder="Número de aprobación o comprobante" required minLength={3}/>
         </label>}
         {order.pendingPayments.length>0&&<div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs space-y-2">
           <p className="text-amber-300 font-bold">Este pedido tiene {order.pendingPayments.length} intento(s) de pago pendiente(s).</p>
           {order.pendingPayments.map(p=><div key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-neutral-300">
             <span>{methods.find(m=>m.id===p.method)?.label||p.method} — {formatCurrency(p.amountMinor,currency)}</span>
             <button type="button" disabled={busy} onClick={()=>void voidPending(p.id)} className="underline text-amber-300 disabled:opacity-50">Anular intento pendiente</button>
           </div>)}
         </div>}
         <label className="flex items-start gap-3 text-xs text-neutral-300 bg-[#1c1c1c] rounded-xl p-3">
           <input type="checkbox" checked={received} onChange={e=>setReceived(e.target.checked)} className="mt-0.5 accent-amber-400"/>
           <span>Confirmo que ya recibí y verifiqué este pago de forma presencial o externa. Esta acción registrará un ingreso en Contabilidad. No ejecuta ningún cobro bancario en línea.</span>
         </label>
         <button type="button" disabled={busy||!received||order.pendingPayments.length>1}
           onClick={()=>void confirmPayment()} className="w-full flex justify-center items-center gap-2 bg-[var(--gold-primary)] text-black p-3 rounded-xl text-sm font-bold disabled:opacity-50">
           <ShieldCheck size={18}/>{busy?'Registrando...':'Confirmar pago y registrar ingreso'}
         </button>
       </div>}
      {order.balanceMinor<=0 && order.status!=='cancelled' && order.status!=='delivered'&&
        <button type="button" disabled={busy} onClick={()=>void markDelivered()}
          className="w-full rounded-xl border border-emerald-500/40 px-5 py-3 text-sm text-emerald-300 font-bold disabled:opacity-50">
          Marcar pedido como entregado al cliente
        </button>}
      {order.status==='delivered'&&<p className="text-sm text-emerald-300 font-semibold">Pedido entregado al cliente.</p>}
      <p className="text-[11px] text-neutral-500">El inventario se descuenta al crear el pedido; al confirmar el pago se genera el ingreso contable, sin descontar inventario dos veces. Marca la entrega solo cuando el cliente reciba sus artículos.</p>
    </div>}

    {receipt&&<div role="status" className="bg-emerald-500/10 border border-emerald-500/40 rounded-2xl p-5 space-y-2">
      <h3 className="flex items-center gap-2 text-emerald-300 font-bold text-base"><CheckCircle2 size={20}/>Pago registrado correctamente</h3>
      <p className="text-sm text-white">Pedido {receipt.pickupCode} · {receipt.customerName}</p>
      <p className="text-sm text-white">Ingreso: <strong>{formatCurrency(receipt.amountMinor,currency)}</strong> — {methods.find(m=>m.id===receipt.method)?.label}</p>
      <p className="text-xs text-neutral-400">Comprobante interno: {receipt.paymentId}</p>
      {receipt.reference&&<p className="text-xs text-neutral-400">Referencia: {receipt.reference}</p>}
      <button type="button" onClick={()=>navigate('/barberia/'+(currentShop?.slug||'')+'/contabilidad')}
        className="flex items-center gap-2 text-xs font-bold text-[var(--gold-primary)] underline pt-2"><CreditCard size={16}/>Ver ingreso en Contabilidad</button>
    </div>}
  </section>;
};
