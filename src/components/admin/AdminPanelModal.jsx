import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Coins,
  DollarSign,
  ExternalLink,
  Gem,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import {
  approvePaymentRequest,
  rejectPaymentRequest,
  subscribeAllPaymentRequests,
  subscribeAllPaymentTransactions,
} from '../../services/monetizationService';
import {
  markWithdrawalPaid,
  rejectWithdrawalRequest,
  subscribeAllWithdrawals,
} from '../../services/withdrawalService';
import { formatUSD } from '../../utils/formatters';

export default function AdminPanelModal({ isOpen, onClose, userProfile, onSuccess, onError }) {
  const [activeTab, setActiveTab] = useState('recharges'); // 'recharges' | 'withdrawals'
  const [statusFilter, setStatusFilter] = useState('pending');
  const [paymentRequests, setPaymentRequests] = useState([]);
  const [paymentTxs, setPaymentTxs] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [payoutRefs, setPayoutRefs] = useState({});
  const [previewImg, setPreviewImg] = useState(null);

  useEffect(() => {
    if (!isOpen || userProfile?.role !== 'admin') return;
    const unsubReqs = subscribeAllPaymentRequests(setPaymentRequests);
    const unsubTxs = subscribeAllPaymentTransactions(setPaymentTxs);
    const unsubWithdrawals = subscribeAllWithdrawals(setWithdrawals);
    return () => {
      unsubReqs();
      unsubTxs();
      unsubWithdrawals();
    };
  }, [isOpen, userProfile?.role]);

  const companyStats = useMemo(() => {
    const manualApprovedUSD = paymentRequests
      .filter((r) => r.status === 'approved')
      .reduce((acc, r) => acc + Number(r.amountUSD || 0), 0);
    const autoUSD = paymentTxs
      .filter((t) => t.status === 'completed')
      .reduce((acc, t) => acc + Number(t.amountUSD || 0), 0);
    const totalRevenueUSD = manualApprovedUSD + autoUSD;

    const totalPaidToCreatorsUSD = withdrawals
      .filter((w) => w.status === 'paid')
      .reduce((acc, w) => acc + Number(w.netPayoutUSD || 0), 0);

    const pendingPayoutsUSD = withdrawals
      .filter((w) => w.status === 'pending')
      .reduce((acc, w) => acc + Number(w.netPayoutUSD || 0), 0);

    const netCompanyBalanceUSD = totalRevenueUSD - totalPaidToCreatorsUSD;

    return {
      totalRevenueUSD,
      totalPaidToCreatorsUSD,
      pendingPayoutsUSD,
      netCompanyBalanceUSD,
      pendingRechargesCount: paymentRequests.filter((r) => r.status === 'pending').length,
      pendingWithdrawalsCount: withdrawals.filter((w) => w.status === 'pending').length,
    };
  }, [paymentRequests, paymentTxs, withdrawals]);

  if (!isOpen || userProfile?.role !== 'admin') return null;

  const filteredRecharges = paymentRequests.filter((r) =>
    statusFilter === 'all' ? true : r.status === statusFilter
  );
  const filteredWithdrawals = withdrawals.filter((w) =>
    statusFilter === 'all' ? true : w.status === statusFilter
  );

  const handleApproveRecharge = async (req) => {
    setBusyId(req.id);
    try {
      await approvePaymentRequest({ requestId: req.id, adminId: userProfile.uid });
      onSuccess?.(`✅ Aprobado: +${req.coinsToCredit} monedas acreditadas a ${req.userName}.`);
    } catch (err) {
      onError?.(err.message || 'Error al aprobar solicitud.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRejectRecharge = async (req) => {
    setBusyId(req.id);
    try {
      await rejectPaymentRequest({ requestId: req.id, adminId: userProfile.uid });
      onSuccess?.(`Solicitud de ${req.userName} rechazada.`);
    } catch (err) {
      onError?.(err.message || 'Error al rechazar.');
    } finally {
      setBusyId(null);
    }
  };

  const handlePayWithdrawal = async (w) => {
    const refText = payoutRefs[w.id] || '';
    if (!refText.trim()) {
      return onError?.('Ingresa el número de referencia del pago enviado por la empresa.');
    }
    setBusyId(w.id);
    try {
      await markWithdrawalPaid({
        withdrawalId: w.id,
        adminId: userProfile.uid,
        payoutReference: refText,
      });
      onSuccess?.(`💸 Pago de ${formatUSD(w.netPayoutUSD)} confirmado para ${w.userName}.`);
    } catch (err) {
      onError?.(err.message || 'No se pudo confirmar el pago.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRejectWithdrawal = async (w) => {
    setBusyId(w.id);
    try {
      await rejectWithdrawalRequest({
        withdrawalId: w.id,
        adminId: userProfile.uid,
      });
      onSuccess?.(`Retiro rechazado. Los ${w.amountDiamonds} diamantes regresaron a ${w.userName}.`);
    } catch (err) {
      onError?.(err.message || 'Error al rechazar retiro.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-lg max-h-[94vh] bg-white border border-rose-100 rounded-t-[32px] sm:rounded-[32px] flex flex-col overflow-hidden shadow-luxury">
        {/* Header */}
        <div className="px-5 py-4 border-b border-rose-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-extrabold text-slate-900">Panel Super Admin</h3>
              <p className="text-xs text-slate-500">Tesorería Global, Auditoría y Pagos</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FAF7F5]">
          {/* Company Treasury Overview */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
              <p className="text-[10px] font-extrabold uppercase text-emerald-700 flex items-center gap-1">
                <ArrowDownLeft className="w-3.5 h-3.5" /> Ingresos Empresa
              </p>
              <p className="font-display text-lg font-extrabold text-slate-900 mt-0.5">
                {formatUSD(companyStats.totalRevenueUSD)}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200">
              <p className="text-[10px] font-extrabold uppercase text-sky-700 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" /> Pagado a Usuarios
              </p>
              <p className="font-display text-lg font-extrabold text-slate-900 mt-0.5">
                {formatUSD(companyStats.totalPaidToCreatorsUSD)}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
              <p className="text-[10px] font-extrabold uppercase text-amber-800 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5" /> Retiros Pendientes
              </p>
              <p className="font-display text-base font-extrabold text-amber-900 mt-0.5">
                {formatUSD(companyStats.pendingPayoutsUSD)}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200">
              <p className="text-[10px] font-extrabold uppercase text-indigo-700 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" /> Balance Neto Empresa
              </p>
              <p className="font-display text-base font-extrabold text-slate-900 mt-0.5">
                {formatUSD(companyStats.netCompanyBalanceUSD)}
              </p>
            </div>
          </div>

          {/* Section Switcher */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-slate-200/70 border border-slate-200">
            <button
              type="button"
              onClick={() => { setActiveTab('recharges'); setStatusFilter('pending'); }}
              className={`py-2 px-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                activeTab === 'recharges'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              Recargas ({companyStats.pendingRechargesCount})
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('withdrawals'); setStatusFilter('pending'); }}
              className={`py-2 px-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                activeTab === 'withdrawals'
                  ? 'bg-white text-sky-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Gem className="w-3.5 h-3.5" />
              Retiros ({companyStats.pendingWithdrawalsCount})
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { id: 'pending', label: 'Pendientes' },
              { id: activeTab === 'recharges' ? 'approved' : 'paid', label: activeTab === 'recharges' ? 'Aprobados' : 'Pagados' },
              { id: 'rejected', label: 'Rechazados' },
              { id: 'all', label: 'Todos' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition ${
                  statusFilter === f.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* TAB 1: Manual Coin Recharges */}
          {activeTab === 'recharges' && (
            <div className="space-y-3">
              {filteredRecharges.length === 0 ? (
                <p className="text-center text-xs text-slate-500 py-8">
                  No hay solicitudes de recarga en este filtro.
                </p>
              ) : (
                filteredRecharges.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-card space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-extrabold text-slate-900">
                          {req.countryFlag} {req.userName}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {req.methodName} ({req.currency}) • Ref: <span className="font-mono font-bold text-slate-800">{req.referenceNumber}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-extrabold text-emerald-600">
                          {formatUSD(req.amountUSD)}
                        </p>
                        <p className="text-xs font-extrabold text-amber-600">
                          +{req.coinsToCredit} monedas
                        </p>
                      </div>
                    </div>

                    {req.proofUrl && (
                      <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                        <img
                          src={req.proofUrl}
                          alt="Comprobante de pago"
                          className="w-full max-h-44 object-contain cursor-pointer"
                          onClick={() => setPreviewImg(req.proofUrl)}
                        />
                        <a
                          href={req.proofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="absolute bottom-2 right-2 px-2.5 py-1 rounded-full bg-white/90 border border-slate-200 text-[11px] font-bold text-slate-800 flex items-center gap-1 shadow"
                        >
                          Abrir <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {req.status === 'pending' ? (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={busyId === req.id}
                          onClick={() => handleRejectRecharge(req)}
                          className="py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-extrabold flex items-center justify-center gap-1.5 hover:bg-rose-100 disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" /> Rechazar
                        </button>
                        <button
                          type="button"
                          disabled={busyId === req.id}
                          onClick={() => handleApproveRecharge(req)}
                          className="py-2.5 rounded-xl bg-emerald-500 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 hover:brightness-105 disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {busyId === req.id ? 'Procesando...' : 'Aprobar y Acreditar'}
                        </button>
                      </div>
                    ) : (
                      <p className="text-[11px] font-extrabold uppercase text-slate-500">
                        Estado: {req.status}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: Creator Withdrawals */}
          {activeTab === 'withdrawals' && (
            <div className="space-y-3">
              {filteredWithdrawals.length === 0 ? (
                <p className="text-center text-xs text-slate-500 py-8">
                  No hay solicitudes de retiro en este filtro.
                </p>
              ) : (
                filteredWithdrawals.map((w) => (
                  <div
                    key={w.id}
                    className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-card space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-extrabold text-slate-900">
                          {w.countryFlag} {w.userName}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {w.payoutMethodName}: <span className="font-bold text-sky-700">{w.payoutDetails}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-extrabold text-emerald-600">
                          Pagar {formatUSD(w.netPayoutUSD)}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {w.amountDiamonds} 💎 (Fee: {formatUSD(w.platformFeeUSD)})
                        </p>
                      </div>
                    </div>

                    {w.status === 'pending' ? (
                      <div className="space-y-2 pt-1">
                        <input
                          type="text"
                          placeholder="Referencia / TxID del pago enviado"
                          value={payoutRefs[w.id] || ''}
                          onChange={(e) =>
                            setPayoutRefs((prev) => ({ ...prev, [w.id]: e.target.value }))
                          }
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-sky-500"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={busyId === w.id}
                            onClick={() => handleRejectWithdrawal(w)}
                            className="py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-extrabold hover:bg-rose-100 disabled:opacity-50"
                          >
                            Rechazar y Devolver 💎
                          </button>
                          <button
                            type="button"
                            disabled={busyId === w.id}
                            onClick={() => handlePayWithdrawal(w)}
                            className="py-2 rounded-xl bg-sky-500 text-white text-xs font-extrabold hover:brightness-105 disabled:opacity-50"
                          >
                            {busyId === w.id ? 'Guardando...' : 'Confirmar Pago'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500 flex justify-between">
                        <span>Estado: <strong className="uppercase">{w.status}</strong></span>
                        {w.payoutReference && <span className="font-mono font-bold text-emerald-700">Ref: {w.payoutReference}</span>}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {previewImg && (
        <div
          className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewImg(null)}
        >
          <img src={previewImg} alt="Vista ampliada" className="max-w-full max-h-full rounded-2xl shadow-2xl" />
        </div>
      )}
    </div>
  );
}
