import { useEffect, useState } from 'react';
import {
  ArrowDownToLine,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coins,
  Copy,
  DollarSign,
  Gem,
  Info,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import {
  ECONOMY_CONFIG,
  WITHDRAWAL_PAYOUT_METHODS,
  resolveAccessPolicy,
} from '../../config/constants';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeUserPayoutAccount } from '../../services/userService';
import {
  convertDiamondsToCoins,
  requestDiamondsWithdrawal,
  subscribeMyWithdrawals,
} from '../../services/withdrawalService';
import { calculateWithdrawalBreakdown, formatUSD } from '../../utils/formatters';
import LuxuryModalHeader from '../layout/LuxuryModalHeader';
import GiftShowcaseCard from './GiftShowcaseCard';

const MIN_SWAP_DIAMONDS = 10;

export default function EarningsWithdrawModal({ isOpen, onClose, userProfile, onSuccess, onError }) {
  const { economyConfig } = useAuth();
  const liveEconomy = economyConfig || ECONOMY_CONFIG;
  const coinsPerDiamond = resolveAccessPolicy(liveEconomy).coinsPerDiamond;
  const availableDiamonds = Number(userProfile?.earningsDiamonds || 0);
  const currentCoins = Number(userProfile?.coins || 0);
  const pendingDiamonds = Number(userProfile?.pendingWithdrawalDiamonds || 0);
  const totalWithdrawnUSD = Number(userProfile?.totalWithdrawnUSD || 0);

  const [activeMode, setActiveMode] = useState('withdraw');
  const [rulesOpen, setRulesOpen] = useState(false);
  const [copiedRefId, setCopiedRefId] = useState('');
  const [amountDiamonds, setAmountDiamonds] = useState(
    Math.max(liveEconomy.minWithdrawalDiamonds, availableDiamonds)
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
      availableDiamonds >= liveEconomy.minWithdrawalDiamonds
        ? availableDiamonds
        : liveEconomy.minWithdrawalDiamonds
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
  }, [isOpen, userProfile?.uid, availableDiamonds, liveEconomy.minWithdrawalDiamonds]);

  if (!isOpen) return null;

  const availableSummary = calculateWithdrawalBreakdown(availableDiamonds, liveEconomy);
  const preview = calculateWithdrawalBreakdown(amountDiamonds, liveEconomy);
  const minDiamonds = Number(liveEconomy.minWithdrawalDiamonds || 500);
  const canWithdraw = availableDiamonds >= minDiamonds;
  const canSwap = availableDiamonds >= MIN_SWAP_DIAMONDS;
  const minProgressPct = Math.min(100, Math.round((availableDiamonds / minDiamonds) * 100));

  const handleCopyRef = async (id, text) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedRefId(id);
      setTimeout(() => setCopiedRefId((prev) => (prev === id ? '' : prev)), 1800);
    } catch {
      onError?.('No se pudo copiar la referencia.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await requestDiamondsWithdrawal({
        user: userProfile,
        amountDiamonds,
        payoutMethod: selectedMethod,
        payoutDetails,
        economyConfig: liveEconomy,
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
      onSuccess?.(
        `🪙 Canjeaste ${res.convertedDiamonds || swapAmount} 💎 por +${res.coinsAdded || res.converted} Monedas internas.`
      );
    } catch (err) {
      onError?.(err.message || 'No se pudo completar el canje a monedas.');
    } finally {
      setSwapping(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md max-h-[92dvh] bg-[#FAF7F9] rounded-t-[32px] sm:rounded-[32px] flex flex-col overflow-hidden shadow-2xl animate-sheet-up">
        <LuxuryModalHeader
          icon={Gem}
          iconClassName="bg-gradient-to-br from-sky-400 via-cyan-400 to-emerald-400 text-zinc-950 shadow-lg shadow-sky-500/20"
          eyebrow="Bóveda Privada de Creador"
          title="Ganancias y Retiros"
          subtitle="Convierte regalos recibidos en USD reales"
          onClose={onClose}
          closeLabel="Cerrar ganancias"
        />

        <div className="flex-1 overflow-y-auto no-scrollbar p-4 sm:p-5 space-y-4 bg-[#FAF7F9]">
          {/* Tarjeta Hero de Balance */}
          <div className="rounded-[26px] p-4 sm:p-5 bg-gradient-to-br from-sky-50 via-white to-emerald-50/70 border border-sky-200/80 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-sky-700 flex items-center gap-1">
                  <Gem className="w-3.5 h-3.5 text-sky-500" />
                  Diamantes Disponibles
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-display text-3xl font-black text-zinc-900 tabular-nums">
                    {availableDiamonds}
                  </span>
                  <span className="text-sm font-black text-emerald-600">
                    ≈ {formatUSD(availableSummary.netPayoutUSD)} netos
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setRulesOpen((v) => !v)}
                className="px-2.5 py-1 rounded-full bg-white border border-sky-200 text-sky-700 text-[10.5px] font-extrabold inline-flex items-center gap-1 shrink-0 hover:bg-sky-50 transition"
              >
                <Info className="w-3 h-3" />
                Reglas
                <ChevronDown
                  className={`w-3 h-3 transition-transform ${rulesOpen ? 'rotate-180' : ''}`}
                />
              </button>
            </div>

            {/* Meta para retiro */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10.5px] font-bold">
                <span className="text-zinc-500">
                  {canWithdraw
                    ? '✓ Ya superaste el mínimo de retiro'
                    : `Progreso al mínimo (${minDiamonds} 💎)`}
                </span>
                <span className="text-sky-700 tabular-nums">{minProgressPct}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white border border-sky-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    canWithdraw
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      : 'bg-gradient-to-r from-sky-400 to-indigo-500'
                  }`}
                  style={{ width: `${Math.max(4, minProgressPct)}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="p-2.5 rounded-2xl bg-white/90 border border-zinc-200/70">
                <p className="text-[10px] font-extrabold uppercase text-zinc-400">En revisión</p>
                <p className="text-sm font-black text-amber-600 tabular-nums">{pendingDiamonds} 💎</p>
              </div>
              <div className="p-2.5 rounded-2xl bg-white/90 border border-zinc-200/70">
                <p className="text-[10px] font-extrabold uppercase text-zinc-400">Total cobrado</p>
                <p className="text-sm font-black text-emerald-600 tabular-nums">
                  {formatUSD(totalWithdrawnUSD)}
                </p>
              </div>
            </div>
          </div>

          {rulesOpen && (
            <div className="p-4 rounded-2xl bg-white border border-zinc-200/80 shadow-sm text-[11px] text-zinc-600 space-y-2 leading-relaxed">
              <p>
                Cada regalo que recibes suma <strong>1 💎 por moneda</strong> (valor base{' '}
                {formatUSD(liveEconomy.baseDiamondValueUSD)}/💎). Al retirar a dinero real recibes{' '}
                <strong>{Math.round(liveEconomy.creatorShareRatio * 100)}% neto</strong> (
                <strong>${liveEconomy.diamondToNetUSDRate.toFixed(3)} USD/💎</strong>) por Binance
                Pay, Zinli o Pago Móvil.
              </p>
              <p className="text-zinc-500">
                Tus <strong>{currentCoins} monedas</strong> sirven para desbloquear chats, ver Likes y Boost VIP; únicamente tus <strong>diamantes ganados por regalos</strong> son retirables en USD o canjeables a monedas (1 💎 = {coinsPerDiamond} 🪙).
              </p>
            </div>
          )}

          {/* Selector de acción: Vender por $ USD vs Canjear a Monedas */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-zinc-200/70 border border-zinc-200">
            <button
              type="button"
              onClick={() => setActiveMode('withdraw')}
              className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                activeMode === 'withdraw'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
              Retirar a $ USD
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('convert')}
              className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                activeMode === 'convert'
                  ? 'bg-white text-amber-700 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
              Canjear a Monedas
            </button>
          </div>

          {activeMode === 'withdraw' ? (
            <form
              onSubmit={handleSubmit}
              className="space-y-4 p-4 rounded-3xl bg-white border border-zinc-200/85 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-zinc-900 flex items-center gap-1.5">
                  <ArrowDownToLine className="w-4 h-4 text-emerald-600" />
                  Solicitar Pago
                </h4>
                <span className="text-[11px] font-bold text-zinc-400">Mín: {minDiamonds} 💎</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-zinc-600 font-bold">Diamantes a retirar</label>
                  {canWithdraw && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAmountDiamonds(minDiamonds)}
                        className="px-2 py-0.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-[10px] font-extrabold text-zinc-700"
                      >
                        Mín
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setAmountDiamonds(Math.max(minDiamonds, Math.floor(availableDiamonds / 2)))
                        }
                        className="px-2 py-0.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-[10px] font-extrabold text-zinc-700"
                      >
                        50%
                      </button>
                      <button
                        type="button"
                        onClick={() => setAmountDiamonds(availableDiamonds)}
                        className="px-2 py-0.5 rounded-full bg-sky-50 hover:bg-sky-100 text-[10px] font-extrabold text-sky-700"
                      >
                        Máximo
                      </button>
                    </div>
                  )}
                </div>

                <input
                  type="number"
                  min={minDiamonds}
                  max={Math.max(minDiamonds, availableDiamonds)}
                  value={amountDiamonds}
                  onChange={(e) => setAmountDiamonds(Number(e.target.value))}
                  disabled={!canWithdraw}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-black text-zinc-900 focus:outline-none focus:bg-white focus:border-sky-500 disabled:opacity-50"
                />
              </div>

              <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/80 text-xs space-y-1">
                <div className="flex justify-between text-zinc-500">
                  <span>Valor bruto regalos:</span>
                  <span>{formatUSD(preview.grossUSD)}</span>
                </div>
                <div className="flex justify-between text-zinc-500">
                  <span>Fee plataforma ({Math.round(liveEconomy.platformFeeRatio * 100)}%):</span>
                  <span>-{formatUSD(preview.platformFeeUSD)}</span>
                </div>
                <div className="flex justify-between font-black text-emerald-600 pt-1.5 border-t border-zinc-200">
                  <span>Recibes en tu cuenta:</span>
                  <span>{formatUSD(preview.netPayoutUSD)} USD</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-zinc-600 font-bold block">
                  Elige cómo quieres cobrar
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {WITHDRAWAL_PAYOUT_METHODS.map((m) => {
                    const active = selectedMethod.id === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedMethod(m)}
                        className={`px-3 py-2 rounded-xl border text-[11px] font-extrabold text-left truncate transition ${
                          active
                            ? 'bg-zinc-900 text-white border-zinc-900'
                            : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:border-zinc-300'
                        }`}
                      >
                        {m.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="text-xs text-zinc-600 font-bold">Tu billetera / correo</label>
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
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm text-zinc-900 focus:outline-none focus:bg-white focus:border-sky-500 disabled:opacity-50"
                />
              </div>

              {!canWithdraw && (
                <div className="flex items-center gap-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl p-3 font-medium">
                  <Info className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>
                    Te faltan <strong>{minDiamonds - availableDiamonds} diamantes</strong> para
                    alcanzar el retiro mínimo ({formatUSD(minDiamonds * liveEconomy.diamondToNetUSDRate)}).
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={!canWithdraw || submitting}
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md hover:brightness-105 disabled:opacity-40 transition"
              >
                <DollarSign className="w-4 h-4" />
                {submitting ? 'Enviando solicitud...' : `Solicitar Retiro (${formatUSD(preview.netPayoutUSD)})`}
              </button>
            </form>
          ) : (
            <form
              onSubmit={handleSwapToCoins}
              className="space-y-3.5 p-4 rounded-3xl bg-white border border-zinc-200/85 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-zinc-900 flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-amber-500" />
                  Canjear Ganancias por Monedas
                </h4>
                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  1 💎 = {coinsPerDiamond} 🪙
                </span>
              </div>

              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Usa tus diamantes ganados para desbloquear chats, enviar mensajes, revelar Likes o activar Boost VIP. Conversión irreversible (no retirable en efectivo).
              </p>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-zinc-600 font-bold">Diamantes ganados a canjear (mín. {MIN_SWAP_DIAMONDS} 💎)</label>
                  {canSwap && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSwapAmount(MIN_SWAP_DIAMONDS)}
                        className="px-2 py-0.5 rounded-full bg-zinc-100 text-[10px] font-extrabold text-zinc-700"
                      >
                        10
                      </button>
                      <button
                        type="button"
                        onClick={() => setSwapAmount(availableDiamonds)}
                        className="px-2 py-0.5 rounded-full bg-amber-50 text-[10px] font-extrabold text-amber-700"
                      >
                        Todo ({availableDiamonds})
                      </button>
                    </div>
                  )}
                </div>
                <input
                  type="number"
                  min={MIN_SWAP_DIAMONDS}
                  max={Math.max(MIN_SWAP_DIAMONDS, availableDiamonds)}
                  value={swapAmount}
                  onChange={(e) => setSwapAmount(Number(e.target.value))}
                  disabled={!canSwap}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-black text-zinc-900 focus:outline-none focus:bg-white focus:border-amber-500 disabled:opacity-50"
                />
              </div>

              <div className="p-3 rounded-2xl bg-amber-50/75 border border-amber-200/80 text-xs flex items-center justify-between font-black text-amber-900">
                <span>Recibirás al instante:</span>
                <span>+{Math.max(0, Math.floor(Number(swapAmount || 0)) * coinsPerDiamond)} 🪙</span>
              </div>

              <button
                type="submit"
                disabled={
                  !canSwap ||
                  swapping ||
                  Number(swapAmount || 0) > availableDiamonds ||
                  Number(swapAmount || 0) < MIN_SWAP_DIAMONDS
                }
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md hover:brightness-105 disabled:opacity-40 transition"
              >
                <Coins className="w-4 h-4" />
                {swapping
                  ? 'Canjeando...'
                  : `Convertir ${Math.max(0, Math.floor(Number(swapAmount || 0)))} 💎 en Monedas`}
              </button>
            </form>
          )}

          <GiftShowcaseCard
            user={userProfile}
            title="Regalos que has recibido"
            emptyText="Cuando alguien te envíe un regalo, se mostrará aquí del más valioso al menor."
          />

          {withdrawals.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-500">
                Historial de Retiros
              </p>
              {withdrawals.map((w) => (
                <div
                  key={w.id}
                  className="p-3.5 rounded-2xl bg-white border border-zinc-200/85 space-y-1.5 text-xs shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-zinc-900">
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
                  <p className="text-[11px] text-zinc-500">
                    {w.payoutMethodName} · {w.payoutDetails}
                  </p>
                  {w.payoutReference && (
                    <button
                      type="button"
                      onClick={() => handleCopyRef(w.id, w.payoutReference)}
                      className="text-[11px] text-emerald-700 font-mono font-bold inline-flex items-center gap-1 hover:underline"
                    >
                      Ref. pago: {w.payoutReference}
                      {copiedRefId === w.id ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Copy className="w-3 h-3 opacity-70" />
                      )}
                    </button>
                  )}
                  {w.rejectionReason && (
                    <p className="text-[11px] text-rose-600">Motivo: {w.rejectionReason}</p>
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
