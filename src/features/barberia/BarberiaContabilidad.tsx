import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { barberStore } from '../../services/store';
import {isLiveBackend,recordTransaction,closeCash,refreshLiveData} from '../../services/liveBackend';
import { formatCurrency, formatDate, exportToCSV } from '../../utils/formatters';
import { Transaction, PaymentMethod, CashClosing } from '../../types';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Plus,
  Download,
  DollarSign,
  CreditCard,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Lock,
  X,
  FileSpreadsheet,
} from 'lucide-react';

export const BarberiaContabilidad: React.FC = () => {
  const { currentShop, state, currency, addToast } = useApp();
  const [activeTab, setActiveTab] = useState<'summary' | 'transactions' | 'cash_closing'>('summary');

  // Modals
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isCashClosingModalOpen, setIsCashClosingModalOpen] = useState(false);

  // Form states for Expense
  const [expenseConcept, setExpenseConcept] = useState('');
  const [expenseAmount, setExpenseAmount] = useState(0);
  const [expenseCategory, setExpenseCategory] = useState<Transaction['category']>('inventory_purchase');
  const [expensePaymentMethod, setExpensePaymentMethod] = useState<PaymentMethod>('cash');
  const [expenseNotes, setExpenseNotes] = useState('');

  // Form states for Cash Closing
  const [openingCash, setOpeningCash] = useState(200000); // 200.000 base
  const [cashCounted, setCashCounted] = useState(0);
  const [closingNotes, setClosingNotes] = useState('');

  const shopId = currentShop?.id || 'shop-1';

  // Filter transactions for this shop
  const transactions = state.transactions.filter(t => t.businessId === shopId);

  // Financial aggregates
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  const netProfit = totalIncome - totalExpenses;

  // Breakdown by payment method
  const cashIncome = transactions
    .filter(t => t.type === 'income' && (t.paymentMethod === 'cash' || t.paymentMethod === 'split'))
    .reduce((acc, t) => acc + t.amount, 0);

  const electronicIncome = transactions
    .filter(t => t.type === 'income' && t.paymentMethod !== 'cash')
    .reduce((acc, t) => acc + t.amount, 0);

  const cashExpenses = transactions
    .filter(t => t.type === 'expense' && t.paymentMethod === 'cash')
    .reduce((acc, t) => acc + t.amount, 0);

  const theoreticalCashBalance = openingCash + cashIncome - cashExpenses;

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseConcept || expenseAmount <= 0) return;
    if(isLiveBackend){
      try{
        await recordTransaction(shopId,{type:'expense',category:expenseCategory,concept:expenseConcept,
          amount:expenseAmount,paymentMethod:expensePaymentMethod});
        await refreshLiveData();
        addToast('Gasto registrado en el backend','success');
        setIsExpenseModalOpen(false);setExpenseConcept('');setExpenseAmount(0);setExpenseNotes('');
      }catch(error){addToast(error instanceof Error?error.message:'Error guardando gasto','error');}
      return;
    }

    barberStore.addTransaction({
      businessId: shopId,
      type: 'expense',
      category: expenseCategory,
      concept: expenseConcept,
      amount: expenseAmount,
      paymentMethod: expensePaymentMethod,
      notes: expenseNotes,
    });

    addToast(`Gasto registrado: ${expenseConcept} (${formatCurrency(expenseAmount, currency)})`, 'success');
    setIsExpenseModalOpen(false);
    setExpenseConcept('');
    setExpenseAmount(0);
    setExpenseNotes('');
  };

  const handlePerformCashClosing = async (e: React.FormEvent) => {
    e.preventDefault();
    const diff = cashCounted - theoreticalCashBalance;
    if(isLiveBackend){
      try{
        await closeCash(shopId,{
          id:'',businessId:shopId,date:new Date().toISOString().slice(0,10),
          openedAt:'',closedAt:'',responsibleName:'',
          openingCash,cashIncome,electronicIncome,expensesPaidFromCash:cashExpenses,
          withdrawals:0,theoreticalCash:theoreticalCashBalance,actualCashCounted:cashCounted,
          difference:diff,notes:closingNotes,status:'closed'
        });
        await refreshLiveData();
        addToast('Cierre de caja guardado en el backend','success');
        setIsCashClosingModalOpen(false);setClosingNotes('');
      }catch(error){addToast(error instanceof Error?error.message:'No se pudo cerrar caja','error');}
      return;
    }

    barberStore.recordCashClosing({
      businessId: shopId,
      date: new Date().toISOString().split('T')[0],
      openedAt: '08:00',
      closedAt: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      responsibleName: 'Mateo Restrepo (Administrador)',
      openingCash,
      cashIncome,
      electronicIncome,
      expensesPaidFromCash: cashExpenses,
      withdrawals: 0,
      theoreticalCash: theoreticalCashBalance,
      actualCashCounted: cashCounted,
      difference: diff,
      notes: closingNotes || (diff === 0 ? 'Cierre de caja cuadrado a la perfección' : 'Cierre con diferencia registrada'),
    });

    addToast('Cierre de caja guardado con éxito en el historial contable', 'success');
    setIsCashClosingModalOpen(false);
    setClosingNotes('');
  };

  const handleExportCSV = () => {
    const rows = transactions.map(t => ({
      ID: t.id,
      Fecha: t.date,
      Tipo: t.type === 'income' ? 'Ingreso' : 'Egreso',
      Categoria: t.category,
      Concepto: t.concept,
      Monto_COP: t.amount,
      Metodo_Pago: t.paymentMethod,
      Notas: t.notes || '',
    }));
    exportToCSV(`reporte_contable_${shopId}_${new Date().toISOString().split('T')[0]}`, rows);
    addToast('Reporte contable CSV descargado exitosamente', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242424]">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">
            Gestión Financiera
          </span>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Contabilidad & Control de Caja</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Libro de ingresos y egresos, pagos electrónicos (Nequi, Daviplata) y arqueo de caja
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#202020] border border-neutral-700 text-xs font-semibold text-neutral-200 hover:text-white transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold hover:bg-red-500/25 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Registrar Gasto</span>
          </button>

          <button
            onClick={() => {
              setCashCounted(theoreticalCashBalance);
              setIsCashClosingModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--gold-primary)] text-black text-xs font-bold hover:bg-[var(--gold-hover)] transition-all shadow-md"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Cierre de Caja</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#262626] pb-2 text-xs">
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-3.5 py-1.5 rounded-lg font-bold transition-colors ${
            activeTab === 'summary' ? 'bg-[var(--gold-primary)] text-black' : 'text-neutral-400 hover:text-white'
          }`}
        >
          Resumen Financiero
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-3.5 py-1.5 rounded-lg font-bold transition-colors ${
            activeTab === 'transactions' ? 'bg-[var(--gold-primary)] text-black' : 'text-neutral-400 hover:text-white'
          }`}
        >
          Movimientos Detallados ({transactions.length})
        </button>
        <button
          onClick={() => setActiveTab('cash_closing')}
          className={`px-3.5 py-1.5 rounded-lg font-bold transition-colors ${
            activeTab === 'cash_closing' ? 'bg-[var(--gold-primary)] text-black' : 'text-neutral-400 hover:text-white'
          }`}
        >
          Historial de Cierres ({state.cashClosings.length})
        </button>
      </div>

      {activeTab === 'summary' && (
        <div className="space-y-6">
          {/* KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-[#141414] border border-[#262626]">
              <span className="text-xs text-neutral-400 font-medium block mb-1">Ingresos Brutos</span>
              <div className="text-2xl font-bold font-mono text-emerald-400">
                {formatCurrency(totalIncome, currency)}
              </div>
              <span className="text-[10px] text-neutral-500 mt-2 block">Cortes + Boutique + Bebidas</span>
            </div>

            <div className="p-4 rounded-2xl bg-[#141414] border border-[#262626]">
              <span className="text-xs text-neutral-400 font-medium block mb-1">Gastos Operativos</span>
              <div className="text-2xl font-bold font-mono text-red-400">
                {formatCurrency(totalExpenses, currency)}
              </div>
              <span className="text-[10px] text-neutral-500 mt-2 block">Insumos, nómina, arriendo</span>
            </div>

            <div className="p-4 rounded-2xl bg-[#141414] border border-[#262626]">
              <span className="text-xs text-neutral-400 font-medium block mb-1">Ganancia Neta Estimada</span>
              <div className="text-2xl font-bold font-mono text-[var(--gold-primary)]">
                {formatCurrency(netProfit, currency)}
              </div>
              <span className="text-[10px] text-neutral-500 mt-2 block">Margen operativo calculado</span>
            </div>

            <div className="p-4 rounded-2xl bg-[#141414] border border-[#262626]">
              <span className="text-xs text-neutral-400 font-medium block mb-1">Saldo Teórico en Caja Física</span>
              <div className="text-2xl font-bold font-mono text-white">
                {formatCurrency(theoreticalCashBalance, currency)}
              </div>
              <span className="text-[10px] text-neutral-500 mt-2 block">Base inicial + Efectivo</span>
            </div>
          </div>

          {/* Payment Method Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl bg-[#141414] border border-[#262626]">
              <h3 className="text-sm font-bold text-white mb-3">Ingresos por Método de Pago</h3>
              <div className="space-y-3">
                <div className="p-3 bg-[#181818] rounded-xl border border-neutral-800 flex justify-between items-center text-xs">
                  <span className="text-neutral-300 font-medium">Nequi & Daviplata</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {formatCurrency(electronicIncome, currency)}
                  </span>
                </div>
                <div className="p-3 bg-[#181818] rounded-xl border border-neutral-800 flex justify-between items-center text-xs">
                  <span className="text-neutral-300 font-medium">Efectivo en Caja</span>
                  <span className="font-mono font-bold text-white">
                    {formatCurrency(cashIncome, currency)}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#141414] border border-[#262626] flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-white mb-2">Comprobación de Cuadre de Caja</h3>
                <p className="text-xs text-neutral-400">
                  Controla la apertura y cierre al final de la jornada laboral para evitar discrepancias entre el dinero teórico del sistema y el dinero contado en la gaveta.
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-neutral-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-neutral-500 block">Base de Apertura</span>
                  <span className="text-sm font-mono font-bold text-white">{formatCurrency(openingCash, currency)}</span>
                </div>
                <button
                  onClick={() => setIsCashClosingModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-[var(--gold-primary)] text-black font-bold text-xs hover:bg-[var(--gold-hover)]"
                >
                  Realizar Arqueo Hoy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="bg-[#141414] border border-[#262626] rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#262626] bg-[#181818] text-neutral-400">
                <th className="py-3 px-4 font-semibold">Fecha / Hora</th>
                <th className="py-3 px-4 font-semibold">Tipo</th>
                <th className="py-3 px-4 font-semibold">Concepto</th>
                <th className="py-3 px-4 font-semibold">Categoría</th>
                <th className="py-3 px-4 font-semibold">Método de Pago</th>
                <th className="py-3 px-4 font-semibold text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e1e]">
              {transactions.map(txn => (
                <tr key={txn.id} className="hover:bg-[#181818] transition-colors">
                  <td className="py-3 px-4 font-mono text-neutral-400 text-[11px]">
                    {txn.date.split('T')[0]} {txn.date.split('T')[1]?.slice(0, 5)}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        txn.type === 'income'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}
                    >
                      {txn.type === 'income' ? 'Ingreso' : 'Egreso'}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-white">{txn.concept}</td>
                  <td className="py-3 px-4 text-neutral-400">{txn.category}</td>
                  <td className="py-3 px-4 font-mono text-neutral-300 uppercase text-[11px]">{txn.paymentMethod}</td>
                  <td className={`py-3 px-4 text-right font-mono font-bold ${txn.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {txn.type === 'income' ? '+' : '-'} {formatCurrency(txn.amount, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'cash_closing' && (
        <div className="space-y-4">
          <div className="bg-[#141414] border border-[#262626] rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#262626] bg-[#181818] text-neutral-400">
                  <th className="py-3 px-4 font-semibold">Fecha</th>
                  <th className="py-3 px-4 font-semibold">Responsable</th>
                  <th className="py-3 px-4 font-semibold">Base Inicial</th>
                  <th className="py-3 px-4 font-semibold">Teórico</th>
                  <th className="py-3 px-4 font-semibold">Contado en Gaveta</th>
                  <th className="py-3 px-4 font-semibold">Diferencia</th>
                  <th className="py-3 px-4 font-semibold">Observaciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e1e]">
                {state.cashClosings.map(c => (
                  <tr key={c.id} className="hover:bg-[#181818] transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-white">{c.date}</td>
                    <td className="py-3 px-4 text-neutral-300">{c.responsibleName}</td>
                    <td className="py-3 px-4 font-mono text-neutral-400">{formatCurrency(c.openingCash, currency)}</td>
                    <td className="py-3 px-4 font-mono text-neutral-300">{formatCurrency(c.theoreticalCash, currency)}</td>
                    <td className="py-3 px-4 font-mono font-bold text-white">{formatCurrency(c.actualCashCounted, currency)}</td>
                    <td className="py-3 px-4 font-mono">
                      {c.difference === 0 ? (
                        <span className="text-emerald-400 font-bold">$ 0</span>
                      ) : (
                        <span className={c.difference > 0 ? 'text-blue-400' : 'text-red-400'}>
                          {c.difference > 0 ? '+' : ''} {formatCurrency(c.difference, currency)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-neutral-400 text-[11px]">{c.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Registrar Gasto */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#141414] border border-[#262626] rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
              <h3 className="text-sm font-bold text-white">Registrar Gasto de Operación</h3>
              <button
                onClick={() => setIsExpenseModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="py-4 space-y-3 text-xs">
              <div>
                <label className="text-neutral-400 block mb-1">Concepto del Gasto</label>
                <input
                  type="text"
                  required
                  value={expenseConcept}
                  onChange={e => setExpenseConcept(e.target.value)}
                  placeholder="Ej. Compra de toallas y desinfectante Barbicide"
                  className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Valor (COP)</label>
                <input
                  type="number"
                  required
                  min={100}
                  value={expenseAmount}
                  onChange={e => setExpenseAmount(Number(e.target.value))}
                  className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-neutral-400 block mb-1">Categoría</label>
                  <select
                    value={expenseCategory}
                    onChange={e => setExpenseCategory(e.target.value as any)}
                    className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white"
                  >
                    <option value="inventory_purchase">Compra Insumos</option>
                    <option value="rent">Arriendo Local</option>
                    <option value="utilities">Servicios Públicos</option>
                    <option value="payroll">Nómina / Comisiones</option>
                    <option value="maintenance">Mantenimiento</option>
                    <option value="marketing">Publicidad</option>
                    <option value="other">Otros Gastos</option>
                  </select>
                </div>

                <div>
                  <label className="text-neutral-400 block mb-1">Pagado con</label>
                  <select
                    value={expensePaymentMethod}
                    onChange={e => setExpensePaymentMethod(e.target.value as any)}
                    className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white"
                  >
                    <option value="cash">Efectivo de Caja</option>
                    <option value="transfer">Transferencia</option>
                    <option value="nequi">Nequi</option>
                    <option value="debit">Tarjeta Débito</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Notas u Observaciones</label>
                <input
                  type="text"
                  value={expenseNotes}
                  onChange={e => setExpenseNotes(e.target.value)}
                  placeholder="Número de factura o recibo..."
                  className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div className="pt-3 border-t border-[#262626] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 text-neutral-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600"
                >
                  Confirmar Gasto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Arqueo y Cierre de Caja */}
      {isCashClosingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-[#141414] border border-[#262626] rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-[var(--gold-primary)]" />
                <h3 className="text-base font-bold text-white">Arqueo y Cierre Diario de Caja</h3>
              </div>
              <button
                onClick={() => setIsCashClosingModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePerformCashClosing} className="py-4 space-y-4 text-xs">
              <div className="p-3 bg-[#181818] rounded-xl border border-neutral-800 space-y-2">
                <div className="flex justify-between text-neutral-400">
                  <span>Base Inicial en Caja:</span>
                  <span className="font-mono text-white">{formatCurrency(openingCash, currency)}</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>(+) Ingresos en Efectivo:</span>
                  <span className="font-mono text-emerald-400">+{formatCurrency(cashIncome, currency)}</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>(-) Gastos Pagados de Caja:</span>
                  <span className="font-mono text-red-400">-{formatCurrency(cashExpenses, currency)}</span>
                </div>
                <div className="pt-2 border-t border-neutral-700 flex justify-between font-bold text-sm">
                  <span className="text-white">Saldo Teórico en Caja:</span>
                  <span className="font-mono text-[var(--gold-primary)]">
                    {formatCurrency(theoreticalCashBalance, currency)}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-neutral-300 block mb-1 font-semibold">
                  Dinero Real Contado en Gaveta (Efectivo Físico):
                </label>
                <input
                  type="number"
                  required
                  value={cashCounted}
                  onChange={e => setCashCounted(Number(e.target.value))}
                  className="w-full bg-[#181818] border border-[var(--gold-primary)] rounded-xl px-4 py-2.5 text-base font-mono font-bold text-white"
                />
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="text-neutral-400">Diferencia:</span>
                  <span className={`font-mono font-bold ${cashCounted - theoreticalCashBalance === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {cashCounted - theoreticalCashBalance === 0
                      ? 'Sin diferencia (Cuadre Exacto)'
                      : formatCurrency(cashCounted - theoreticalCashBalance, currency)}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Observaciones del Cierre</label>
                <textarea
                  rows={2}
                  value={closingNotes}
                  onChange={e => setClosingNotes(e.target.value)}
                  placeholder="Observaciones de turno..."
                  className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg p-2 text-white"
                />
              </div>

              <div className="pt-3 border-t border-[#262626] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCashClosingModalOpen(false)}
                  className="px-4 py-2 text-neutral-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[var(--gold-primary)] text-black font-bold hover:bg-[var(--gold-hover)]"
                >
                  Confirmar y Guardar Cierre
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
