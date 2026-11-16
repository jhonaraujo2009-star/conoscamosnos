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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md max-h-[92vh] bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-400 to-indigo-500 flex items-center justify-center text-slate-950 shadow">
              <Gem className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Mis Ganancias y Retiros</h3>
              <p className="text-xs text-slate-400">
                Convierte tus regalos recibidos en dinero real
              </p>
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

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/15 border border-cyan-500/40">
              <p className="text-[11px] text-cyan-200 font-semibold flex items-center gap-1">
                <Gem className="w-3.5 h-3.5 text-cyan-400" />
                Diamantes Disponibles
              </p>
              <p className="text-xl font-extrabold text-white mt-1">{availableDiamonds}</p>
              <p className="text-xs font-bold text-emerald-400 mt-0.5">
                ≈ {formatUSD(availableSummary.netPayoutUSD)} netos
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold">En revisión</p>
                <p className="text-sm font-bold text-amber-300">{pendingDiamonds} 💎</p>
              </div>
              <div className="pt-1 border-t border-slate-800">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Total Cobrado</p>
                <p className="text-sm font-bold text-emerald-400">{formatUSD(totalWithdrawnUSD)}</p>
              </div>
            </div>
          </div>

          {/* How the company payout model works */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-cyan-300">
              <Building2 className="w-4 h-4" />
              ¿Cómo funcionan los pagos de la empresa?
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              El dinero real de las recargas ingresa a la empresa. Cada regalo virtual que recibes
              suma <strong>1 Diamante por moneda</strong> (valor base {formatUSD(ECONOMY_CONFIG.baseDiamondValueUSD)}/💎).
              Tú recibes el <strong>{Math.round(ECONOMY_CONFIG.creatorShareRatio * 100)}% neto</strong> ({formatUSD(ECONOMY_CONFIG.diamondToNetUSDRate)}/💎)
              y la empresa retiene el <strong>{Math.round(ECONOMY_CONFIG.platformFeeRatio * 100)}%</strong> por operación y pasarelas.
            </p>
          </div>

          {/* Withdrawal Request Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5 p-4 rounded-2xl bg-slate-950 border border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                <ArrowDownToLine className="w-4 h-4 text-emerald-400" />
                Solicitar Pago a mi Cuenta
              </h4>
              <span className="text-[11px] text-slate-400">
                Mín: {ECONOMY_CONFIG.minWithdrawalDiamonds} 💎
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-400 font-semibold">Cantidad de Diamantes</label>
                {canWithdraw && (
                  <button
                    type="button"
                    onClick={() => setAmountDiamonds(availableDiamonds)}
                    className="text-[11px] font-bold text-cyan-400 hover:underline"
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
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm font-bold text-white focus:outline-none focus:border-cyan-400 disabled:opacity-50"
              />
            </div>

            {/* Breakdown */}
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800/80 text-xs space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Valor bruto regalos:</span>
                <span>{formatUSD(preview.grossUSD)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Comisión empresa (40%):</span>
                <span>-{formatUSD(preview.platformFeeUSD)}</span>
              </div>
              <div className="flex justify-between font-extrabold text-emerald-400 pt-1 border-t border-slate-800">
                <span>Monto real que recibirás:</span>
                <span>{formatUSD(preview.netPayoutUSD)} USD</span>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 font-semibold block mb-1">
                Método de cobro preferido
              </label>
              <select
                value={selectedMethod.id}
                onChange={(e) => {
                  const found = WITHDRAWAL_PAYOUT_METHODS.find((m) => m.id === e.target.value);
                  if (found) setSelectedMethod(found);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm focus:outline-none focus:border-cyan-400"
              >
                {WITHDRAWAL_PAYOUT_METHODS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 font-semibold block mb-1">
                Datos de tu billetera / cuenta
              </label>
              <input
                type="text"
                value={payoutDetails}
                onChange={(e) => setPayoutDetails(e.target.value)}
                placeholder={selectedMethod.placeholder}
                required
                disabled={!canWithdraw}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm focus:outline-none focus:border-cyan-400 disabled:opacity-50"
              />
            </div>

            {!canWithdraw && (
              <div className="flex items-center gap-2 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5">
                <Info className="w-4 h-4 shrink-0" />
                <span>
                  Necesitas al menos <strong>{ECONOMY_CONFIG.minWithdrawalDiamonds} diamantes</strong>{' '}
                  ({formatUSD(ECONOMY_CONFIG.minWithdrawalDiamonds * ECONOMY_CONFIG.diamondToNetUSDRate)}) para solicitar tu retiro.
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={!canWithdraw || submitting}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-40 transition"
            >
              <DollarSign className="w-4 h-4" />
              {submitting ? 'Enviando solicitud...' : `Solicitar Retiro (${formatUSD(preview.netPayoutUSD)})`}
            </button>
          </form>

          {/* Withdrawal History */}
          {withdrawals.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Historial de Retiros
              </p>
              {withdrawals.map((w) => (
                <div
                  key={w.id}
                  className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-white">
                      {formatUSD(w.netPayoutUSD)} USD ({w.amountDiamonds} 💎)
                    </span>
                    {w.status === 'pending' && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3" /> En proceso
                      </span>
                    )}
                    {w.status === 'paid' && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Pagado
                      </span>
                    )}
                    {w.status === 'rejected' && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Reembolsado
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {w.payoutMethodName} • {w.payoutDetails}
                  </p>
                  {w.payoutReference && (
                    <p className="text-[11px] text-emerald-300 font-mono">
                      Ref. pago empresa: {w.payoutReference}
                    </p>
                  )}
                  {w.rejectionReason && (
                    <p className="text-[11px] text-rose-300">
                      Motivo: {w.rejectionReason} (Diamantes devueltos a tu saldo)
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
