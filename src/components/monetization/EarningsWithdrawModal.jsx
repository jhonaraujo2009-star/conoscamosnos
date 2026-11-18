import { useEffect, useState } from 'react';
import {
  ArrowDownToLine,
  Building2,
  CheckCircle2,
  Clock,
  Coins,
  DollarSign,
  Gem,
  Info,
  Lock,
  RefreshCw,
  X,
  XCircle,
} from 'lucide-react';
import { ECONOMY_CONFIG, WITHDRAWAL_PAYOUT_METHODS } from '../../config/constants';
import { subscribeUserPayoutAccount } from '../../services/userService';
import {
  convertDiamondsToCoins,
  requestDiamondsWithdrawal,
  subscribeMyWithdrawals,
} from '../../services/withdrawalService';
import { calculateWithdrawalBreakdown, formatUSD } from '../../utils/formatters';
import GiftShowcaseCard from './GiftShowcaseCard';

const MIN_SWAP_DIAMONDS = 10;

export default function EarningsWithdrawModal({ isOpen, onClose, userProfile, onSuccess, onError }) {
  const availableDiamonds = Number(userProfile?.earningsDiamonds || 0);
  const currentCoins = Number(userProfile?.coins || 0);
  const pendingDiamonds = Number(userProfile?.pendingWithdrawalDiamonds || 0);
  const totalWithdrawnUSD = Number(userProfile?.totalWithdrawnUSD || 0);

  const [activeMode, setActiveMode] = useState('withdraw');
  const [amountDiamonds, setAmountDiamonds] = useState(
    Math.max(ECONOMY_CONFIG.minWithdrawalDiamonds, availableDiamonds)
  );
  const [swapAmount, setSwapAmount] = useState(Math.max(MIN_SWAP_DIAMONDS, availableDiamonds));
  const [selectedMethod, setSelectedMethod] = useState(WITHDRAWAL_PAYOUT_METHODS[0]);
  const [payoutDetails, setPayoutDetails] = useState('');
  const [savedPayoutAccount, setSavedPayoutAccount] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [withdrawals, setWithdrawals] = useState([]);

  useEffect(() => {
    if (!isOpen || !userProfile?.uid) return;
    setAmountDiamonds(
      availableDiamonds >= ECONOMY_CONFIG.minWithdrawalDiamonds
        ? availableDiamonds
        : ECONOMY_CONFIG.minWithdrawalDiamonds
    );
    setSwapAmount(availableDiamonds >= MIN_SWAP_DIAMONDS ? availableDiamonds : MIN_SWAP_DIAMONDS);
    const unsubW = subscribeMyWithdrawals(userProfile.uid, setWithdrawals);
    const unsubPayout = subscribeUserPayoutAccount(userProfile.uid, (saved) => {
      setSavedPayoutAccount(saved);
      if (saved?.accountValue) {
        const matched = WITHDRAWAL_PAYOUT_METHODS.find((m) => m.id === saved.methodId);
        if (matched) setSelectedMethod(matched);
        const formatted = saved.holderName
          ? `${saved.accountValue} (${saved.holderName})`
          : saved.accountValue;
        setPayoutDetails((prev) => (prev ? prev : formatted));
      }
    });
    return () => {
      unsubW();
      unsubPayout();
    };
  }, [isOpen, userProfile?.uid, availableDiamonds]);

  if (!isOpen) return null;

  const availableSummary = calculateWithdrawalBreakdown(availableDiamonds);
  const preview = calculateWithdrawalBreakdown(amountDiamonds);
  const canWithdraw = availableDiamonds >= ECONOMY_CONFIG.minWithdrawalDiamonds;
  const canSwap = availableDiamonds >= MIN_SWAP_DIAMONDS;

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

  const handleSwapToCoins = async (e) => {
    e.preventDefault();
    if (!userProfile?.uid || swapping) return;
    setSwapping(true);
    try {
      const res = await convertDiamondsToCoins({
        userId: userProfile.uid,
        amountDiamonds: swapAmount,
      });
      onSuccess?.(`🪙 Canjeaste ${res.converted} 💎 por ${res.converted} Monedas internas.`);
    } catch (err) {
      onError?.(err.message || 'No se pudo completar el canje a monedas.');
    } finally {
      setSwapping(false);
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
            <div className="flex items-start gap-1.5 pt-1 border-t border-slate-100 text-[10px] text-slate-500">
              <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span>
                Economía separada: tus <strong>{currentCoins} monedas compradas</strong> solo sirven para regalar y nunca se retiran; únicamente los <strong>diamantes que recibes</strong> pueden venderse en $ USD o canjearse 1:1 a monedas.
              </span>
            </div>
          </div>

          <GiftShowcaseCard
            user={userProfile}
            title="Regalos que has recibido"
            emptyText="Cuando alguien te envíe un regalo, se mostrará aquí del más valioso al menor."
          />

          {/* Selector de acción: Vender por $ USD vs Canjear a Monedas */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-white border border-slate-200/90 shadow-sm">
            <button
              type="button"
              onClick={() => setActiveMode('withdraw')}
              className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                activeMode === 'withdraw'
                  ? 'bg-slate-900 text-white shadow'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              Vender por $ USD
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('convert')}
              className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                activeMode === 'convert'
                  ? 'bg-amber-500 text-white shadow'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Canjear a Monedas
            </button>
          </div>

          {activeMode === 'withdraw' ? (
            /* Withdrawal Request Form */
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
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="text-xs text-slate-600 font-bold">
                  Datos de tu billetera / cuenta
                </label>
                {savedPayoutAccount?.accountValue && (
                  <button
                    type="button"
                    onClick={() => {
                      const matched = WITHDRAWAL_PAYOUT_METHODS.find(
                        (m) => m.id === savedPayoutAccount.methodId
                      );
                      if (matched) setSelectedMethod(matched);
                      setPayoutDetails(
                        savedPayoutAccount.holderName
                          ? `${savedPayoutAccount.accountValue} (${savedPayoutAccount.holderName})`
                          : savedPayoutAccount.accountValue
                      );
                    }}
                    className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full hover:bg-emerald-100 transition"
                  >
                    ✓ Usar guardada ({savedPayoutAccount.methodName?.split(' ')[0]})
                  </button>
                )}
              </div>
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
          ) : (
            <form onSubmit={handleSwapToCoins} className="space-y-3.5 p-4 rounded-2xl bg-white border border-slate-200/90 shadow-card">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-amber-500" />
                  Vender Diamantes por Monedas (1:1)
                </h4>
                <span className="text-[11px] font-bold text-slate-400">
                  Mín: {MIN_SWAP_DIAMONDS} 💎
                </span>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Convierte parte de los regalos que recibiste en monedas internas para enviar regalos o activar Boost sin esperar al mínimo de retiro en dólares. Esta conversión es irreversible y las monedas resultantes no son retirables en efectivo.
              </p>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-slate-600 font-bold">Diamantes a canjear</label>
                  {canSwap && (
                    <button
                      type="button"
                      onClick={() => setSwapAmount(availableDiamonds)}
                      className="text-[11px] font-extrabold text-amber-600 hover:underline"
                    >
                      Canjear todo ({availableDiamonds})
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  min={MIN_SWAP_DIAMONDS}
                  max={Math.max(MIN_SWAP_DIAMONDS, availableDiamonds)}
                  value={swapAmount}
                  onChange={(e) => setSwapAmount(Number(e.target.value))}
                  disabled={!canSwap}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-extrabold text-slate-900 focus:outline-none focus:bg-white focus:border-amber-500 disabled:opacity-50"
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs flex items-center justify-between font-extrabold text-amber-900">
                <span>Recibirás al instante:</span>
                <span>+{Math.max(0, Math.floor(Number(swapAmount || 0)))} 🪙</span>
              </div>

              {!canSwap && (
                <div className="flex items-center gap-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 font-medium">
                  <Info className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>
                    Necesitas al menos <strong>{MIN_SWAP_DIAMONDS} diamantes</strong> recibidos para convertirlos a monedas.
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={!canSwap || swapping || Number(swapAmount || 0) > availableDiamonds || Number(swapAmount || 0) < MIN_SWAP_DIAMONDS}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md hover:brightness-105 disabled:opacity-40 transition"
              >
                <Coins className="w-4 h-4" />
                {swapping ? 'Canjeando...' : `Convertir ${Math.max(0, Math.floor(Number(swapAmount || 0)))} 💎 en Monedas`}
              </button>
            </form>
          )}

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
