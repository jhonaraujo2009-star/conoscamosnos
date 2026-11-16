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
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-lg max-h-[94vh] bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/50 flex items-center justify-center text-indigo-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Panel Super Admin</h3>
              <p className="text-xs text-slate-400">Tesorería Global, Auditoría y Pagos</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Company Treasury Overview */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
              <p className="text-[10px] font-bold uppercase text-emerald-300 flex items-center gap-1">
                <ArrowDownLeft className="w-3.5 h-3.5" /> Ingresos Empresa
              </p>
              <p className="text-lg font-extrabold text-white mt-0.5">
                {formatUSD(companyStats.totalRevenueUSD)}
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30">
              <p className="text-[10px] font-bold uppercase text-cyan-300 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" /> Pagado a Usuarios
              </p>
              <p className="text-lg font-extrabold text-white mt-0.5">
                {formatUSD(companyStats.totalPaidToCreatorsUSD)}
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30">
              <p className="text-[10px] font-bold uppercase text-amber-300 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5" /> Retiros Pendientes
              </p>
              <p className="text-base font-extrabold text-amber-200 mt-0.5">
                {formatUSD(companyStats.pendingPayoutsUSD)}
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-indigo-500/15 border border-indigo-500/35">
              <p className="text-[10px] font-bold uppercase text-indigo-300 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" /> Balance Neto Empresa
              </p>
              <p className="text-base font-extrabold text-white mt-0.5">
                {formatUSD(companyStats.netCompanyBalanceUSD)}
              </p>
            </div>
          </div>

          {/* Section Switcher */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-slate-950 border border-slate-800">
            <button
              type="button"
              onClick={() => { setActiveTab('recharges'); setStatusFilter('pending'); }}
              className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                activeTab === 'recharges'
                  ? 'bg-indigo-500 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              Recargas ({companyStats.pendingRechargesCount})
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('withdrawals'); setStatusFilter('pending'); }}
              className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                activeTab === 'withdrawals'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
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
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                  statusFilter === f.id
                    ? 'bg-white text-slate-950 border-white'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
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
                    className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-white">
                          {req.countryFlag} {req.userName}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {req.methodName} ({req.currency}) • Ref: <span className="font-mono text-slate-200">{req.referenceNumber}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-extrabold text-emerald-400">
                          {formatUSD(req.amountUSD)}
                        </p>
                        <p className="text-xs font-bold text-amber-300">
                          +{req.coinsToCredit} monedas
                        </p>
                      </div>
                    </div>

                    {req.proofUrl && (
                      <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
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
                          className="absolute bottom-2 right-2 px-2.5 py-1 rounded-full bg-slate-950/85 text-[11px] text-white flex items-center gap-1"
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
                          className="py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-rose-500/25 disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" /> Rechazar
                        </button>
                        <button
                          type="button"
                          disabled={busyId === req.id}
                          onClick={() => handleApproveRecharge(req)}
                          className="py-2.5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1.5 hover:brightness-110 disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {busyId === req.id ? 'Procesando...' : 'Aprobar y Acreditar'}
                        </button>
                      </div>
                    ) : (
                      <p className="text-[11px] font-bold uppercase text-slate-400">
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
                    className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-white">
                          {w.countryFlag} {w.userName}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {w.payoutMethodName}: <span className="text-cyan-200">{w.payoutDetails}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-extrabold text-emerald-400">
                          Pagar {formatUSD(w.netPayoutUSD)}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {w.amountDiamonds} 💎 (Fee empresa: {formatUSD(w.platformFeeUSD)})
                        </p>
                      </div>
                    </div>

                    {w.status === 'pending' ? (
                      <div className="space-y-2 pt-1">
                        <input
                          type="text"
                          placeholder="Referencia / TxID del pago enviado por la empresa"
                          value={payoutRefs[w.id] || ''}
                          onChange={(e) =>
                            setPayoutRefs((prev) => ({ ...prev, [w.id]: e.target.value }))
                          }
                          className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs focus:outline-none focus:border-cyan-400"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={busyId === w.id}
                            onClick={() => handleRejectWithdrawal(w)}
                            className="py-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold hover:bg-rose-500/25 disabled:opacity-50"
                          >
                            Rechazar y Devolver 💎
                          </button>
                          <button
                            type="button"
                            disabled={busyId === w.id}
                            onClick={() => handlePayWithdrawal(w)}
                            className="py-2 rounded-xl bg-cyan-400 text-slate-950 text-xs font-extrabold hover:brightness-110 disabled:opacity-50"
                          >
                            {busyId === w.id ? 'Guardando...' : 'Confirmar Pago Realizado'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 flex justify-between">
                        <span>Estado: <strong className="uppercase">{w.status}</strong></span>
                        {w.payoutReference && <span className="font-mono text-emerald-300">Ref: {w.payoutReference}</span>}
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
          className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setPreviewImg(null)}
        >
          <img src={previewImg} alt="Vista ampliada" className="max-w-full max-h-full rounded-2xl" />
        </div>
      )}
    </div>
  );
}
