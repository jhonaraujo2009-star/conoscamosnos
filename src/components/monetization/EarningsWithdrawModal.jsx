import { useEffect, useState } from 'react';
import {
  ArrowDownToLine,
  Building2,
  CheckCircle2,
  Clock,
  DollarSign,
  Gem,
  Info,
  X,
  XCircle,
} from 'lucide-react';
import { ECONOMY_CONFIG, WITHDRAWAL_PAYOUT_METHODS } from '../../config/constants';
import { requestDiamondsWithdrawal, subscribeMyWithdrawals } from '../../services/withdrawalService';
import { calculateWithdrawalBreakdown, formatUSD } from '../../utils/formatters';

export default function EarningsWithdrawModal({ isOpen, onClose, userProfile, onSuccess, onError }) {
  const availableDiamonds = Number(userProfile?.earningsDiamonds || 0);
  const pendingDiamonds = Number(userProfile?.pendingWithdrawalDiamonds || 0);
  const totalWithdrawnUSD = Number(userProfile?.totalWithdrawnUSD || 0);

  const [amountDiamonds, setAmountDiamonds] = useState(
    Math.max(ECONOMY_CONFIG.minWithdrawalDiamonds, availableDiamonds)
  );
  const [selectedMethod, setSelectedMethod] = useState(WITHDRAWAL_PAYOUT_METHODS[0]);
  const [payoutDetails, setPayoutDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [withdrawals, setWithdrawals] = useState([]);

  useEffect(() => {
    if (!isOpen || !userProfile?.uid) return;
    setAmountDiamonds(
      availableDiamonds >= ECONOMY_CONFIG.minWithdrawalDiamonds
        ? availableDiamonds
        : ECONOMY_CONFIG.minWithdrawalDiamonds
    );
    const unsub = subscribeMyWithdrawals(userProfile.uid, setWithdrawals);
    return () => unsub();
  }, [isOpen, userProfile?.uid, availableDiamonds]);

  if (!isOpen) return null;

  const availableSummary = calculateWithdrawalBreakdown(availableDiamonds);
  const preview = calculateWithdrawalBreakdown(amountDiamonds);
  const canWithdraw = availableDiamonds >= ECONOMY_CONFIG.minWithdrawalDiamonds;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await requestDiamondsWithdrawal({
        user: userProfile,
        amountDiamonds,
        payoutMethod: selectedMethod,
        payoutDetails,
      });
      setPayoutDetails('');
      onSuccess?.(
        `💸 Solicitud de retiro enviada por ${formatUSD(res.netPayoutUSD)} USD. La empresa procesará tu pago.`
      );
    } catch (err) {
      onError?.(err.message || 'No se pudo procesar tu solicitud de retiro.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md max-h-[92dvh] bg-white rounded-t-[32px] sm:rounded-[32px] flex flex-col overflow-hidden shadow-2xl animate-sheet-up">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-200/80 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center text-white shadow-md">
              <Gem className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-extrabold text-zinc-900">Mis Ganancias y Retiros</h3>
              <p className="text-xs text-zinc-500">
                Convierte tus regalos recibidos en dinero real
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-zinc-100 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-5 bg-[#F4F4F6]">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-sky-50 via-white to-indigo-50 border border-sky-200 shadow-card">
              <p className="text-[11px] text-sky-800 font-bold flex items-center gap-1">
                <Gem className="w-3.5 h-3.5 text-sky-500" />
                Diamantes Disponibles
              </p>
              <p className="font-display text-2xl font-extrabold text-slate-900 mt-1">{availableDiamonds}</p>
              <p className="text-xs font-extrabold text-emerald-600 mt-0.5">
                ≈ {formatUSD(availableSummary.netPayoutUSD)} netos
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-card space-y-1.5">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-extrabold">En revisión</p>
                <p className="text-sm font-extrabold text-amber-600">{pendingDiamonds} 💎</p>
              </div>
              <div className="pt-1 border-t border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase font-extrabold">Total Cobrado</p>
                <p className="text-sm font-extrabold text-emerald-600">{formatUSD(totalWithdrawnUSD)}</p>
              </div>
            </div>
          </div>

          {/* How the company payout model works */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-card text-xs text-slate-600 space-y-2.5">
            <div className="flex items-center gap-1.5 font-extrabold text-slate-900">
              <Building2 className="w-4 h-4 text-sky-500" />
              Reglas de retiro en $ USD / Binance USDT
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Todos los <strong>regalos virtuales</strong> que te envían (comprados con monedas) suman{' '}
              <strong>1 Diamante (💎) por moneda</strong> (valor base {formatUSD(ECONOMY_CONFIG.baseDiamondValueUSD)}/💎).
              Al retirar en dinero real recibes el <strong>{Math.round(ECONOMY_CONFIG.creatorShareRatio * 100)}% neto</strong>{' '}
              (<strong>${ECONOMY_CONFIG.diamondToNetUSDRate.toFixed(3)} USD/💎</strong>) y la plataforma retiene{' '}
              {Math.round(ECONOMY_CONFIG.platformFeeRatio * 100)}% para pasarelas y operación.
            </p>
            <div className="grid grid-cols-3 gap-1.5 pt-1 text-center">
              {[500, 1000, 5000].map((sample) => (
                <div key={sample} className="p-2 rounded-xl bg-slate-50 border border-slate-200/80">
                  <p className="text-[11px] font-extrabold text-sky-700">{sample} 💎</p>
                  <p className="text-[11px] font-black text-emerald-600">
                    {formatUSD(sample * ECONOMY_CONFIG.diamondToNetUSDRate)}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-[10px] font-semibold text-emerald-700">
              💡 Con <strong>Binance Pay</strong> cobras en USDT (1 USDT = $1.00 USD) directo a tu Binance Pay ID o correo.
            </p>
          </div>

          {/* Withdrawal Request Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5 p-4 rounded-2xl bg-white border border-slate-200/90 shadow-card">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                <ArrowDownToLine className="w-4 h-4 text-emerald-600" />
                Solicitar Pago a mi Cuenta
              </h4>
              <span className="text-[11px] font-bold text-slate-400">
                Mín: {ECONOMY_CONFIG.minWithdrawalDiamonds} 💎
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-600 font-bold">Cantidad de Diamantes</label>
                {canWithdraw && (
                  <button
                    type="button"
                    onClick={() => setAmountDiamonds(availableDiamonds)}
                    className="text-[11px] font-extrabold text-sky-600 hover:underline"
                  >
                    Retirar todo ({availableDiamonds})
                  </button>
                )}
              </div>
              <input
                type="number"
                min={ECONOMY_CONFIG.minWithdrawalDiamonds}
                max={Math.max(ECONOMY_CONFIG.minWithdrawalDiamonds, availableDiamonds)}
                value={amountDiamonds}
                onChange={(e) => setAmountDiamonds(Number(e.target.value))}
                disabled={!canWithdraw}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-extrabold text-slate-900 focus:outline-none focus:bg-white focus:border-sky-500 disabled:opacity-50"
              />
            </div>

            {/* Breakdown */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1">
              <div className="flex justify-between text-slate-500">
                <span>Valor bruto regalos:</span>
                <span>{formatUSD(preview.grossUSD)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Comisión plataforma (40%):</span>
                <span>-{formatUSD(preview.platformFeeUSD)}</span>
              </div>
              <div className="flex justify-between font-extrabold text-emerald-600 pt-1 border-t border-slate-200">
                <span>Monto neto que recibirás:</span>
                <span>{formatUSD(preview.netPayoutUSD)} USD</span>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-600 font-bold block mb-1">
                Método de cobro preferido
              </label>
              <select
                value={selectedMethod.id}
                onChange={(e) => {
                  const found = WITHDRAWAL_PAYOUT_METHODS.find((m) => m.id === e.target.value);
                  if (found) setSelectedMethod(found);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:bg-white focus:border-sky-500"
              >
                {WITHDRAWAL_PAYOUT_METHODS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-600 font-bold block mb-1">
                Datos de tu billetera / cuenta
              </label>
              <input
                type="text"
                value={payoutDetails}
                onChange={(e) => setPayoutDetails(e.target.value)}
                placeholder={selectedMethod.placeholder}
                required
                disabled={!canWithdraw}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-sky-500 disabled:opacity-50"
              />
            </div>

            {!canWithdraw && (
              <div className="flex items-center gap-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 font-medium">
                <Info className="w-4 h-4 shrink-0 text-amber-600" />
                <span>
                  Necesitas al menos <strong>{ECONOMY_CONFIG.minWithdrawalDiamonds} diamantes</strong>{' '}
                  ({formatUSD(ECONOMY_CONFIG.minWithdrawalDiamonds * ECONOMY_CONFIG.diamondToNetUSDRate)}) para solicitar tu retiro.
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={!canWithdraw || submitting}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 to-emerald-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md hover:brightness-105 disabled:opacity-40 transition"
            >
              <DollarSign className="w-4 h-4" />
              {submitting ? 'Enviando solicitud...' : `Solicitar Retiro (${formatUSD(preview.netPayoutUSD)})`}
            </button>
          </form>

          {/* Withdrawal History */}
          {withdrawals.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Historial de Retiros
              </p>
              {withdrawals.map((w) => (
                <div
                  key={w.id}
                  className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-1.5 text-xs shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-900">
                      {formatUSD(w.netPayoutUSD)} USD ({w.amountDiamonds} 💎)
                    </span>
                    {w.status === 'pending' && (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3" /> En proceso
                      </span>
                    )}
                    {w.status === 'paid' && (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Pagado
                      </span>
                    )}
                    {w.status === 'rejected' && (
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-bold flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Reembolsado
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {w.payoutMethodName} • {w.payoutDetails}
                  </p>
                  {w.payoutReference && (
                    <p className="text-[11px] text-emerald-700 font-mono font-semibold">
                      Ref. pago: {w.payoutReference}
                    </p>
                  )}
                  {w.rejectionReason && (
                    <p className="text-[11px] text-rose-600">
                      Motivo: {w.rejectionReason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
