import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Gem, Loader2, MessageSquareHeart } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { updateUserProfile } from '../../services/userService';
import { createDebouncedAutoSaver } from '../../utils/autoSaveHelpers';
import {
  PAID_MESSAGE_DEFAULT_PRICE,
  PAID_MESSAGE_MAX_PRICE,
  PAID_MESSAGE_MIN_PRICE,
  PAID_MESSAGE_PRICE_PRESETS,
  clampPaidMessagePrice,
} from '../../utils/chatHelpers';
import { calculateWithdrawalBreakdown, formatUSD } from '../../utils/formatters';

/**
 * Sección "Monetización de Mensajes Directos" con auto-guardado instantáneo en Firestore:
 * - Toggle `allowPaidMessages`
 * - Selector de tarifa en diamantes (`10`, `25`, `50`, `100` o monto personalizado) -> `messagePriceDiamonds`
 */
export default function PaidMessagesSettingsCard({
  userProfile,
  onSuccess,
  onError,
  compact = false,
}) {
  const { economyConfig } = useAuth();
  const uid = userProfile?.uid || '';
  const allowPaid = Boolean(userProfile?.allowPaidMessages);
  const remotePrice = clampPaidMessagePrice(
    userProfile?.messagePriceDiamonds,
    PAID_MESSAGE_DEFAULT_PRICE
  );

  const [busyToggle, setBusyToggle] = useState(false);
  const [priceDraft, setPriceDraft] = useState(String(remotePrice));
  const [saveState, setSaveState] = useState('idle'); // 'idle' | 'saving' | 'saved'

  const uidRef = useRef(uid);
  const lastSavedPriceRef = useRef(remotePrice);
  const onErrorRef = useRef(onError);
  uidRef.current = uid;
  onErrorRef.current = onError;

  const priceSaverRef = useRef(null);
  if (!priceSaverRef.current) {
    priceSaverRef.current = createDebouncedAutoSaver({
      delayMs: 550,
      onSave: async (nextPrice) => {
        const activeUid = uidRef.current;
        if (!activeUid) return;
        if (nextPrice === lastSavedPriceRef.current) {
          setSaveState('saved');
          return;
        }
        setSaveState('saving');
        try {
          await updateUserProfile(activeUid, { messagePriceDiamonds: nextPrice });
          lastSavedPriceRef.current = nextPrice;
          setSaveState('saved');
        } catch (err) {
          setSaveState('idle');
          onErrorRef.current?.(err?.message || 'No se pudo guardar la tarifa en diamantes.');
        }
      },
    });
  }

  useEffect(() => {
    if (!priceSaverRef.current?.isBusyOrPending() && remotePrice !== lastSavedPriceRef.current) {
      lastSavedPriceRef.current = remotePrice;
      setPriceDraft(String(remotePrice));
    }
  }, [remotePrice]);

  useEffect(() => {
    return () => {
      priceSaverRef.current?.flush();
    };
  }, []);

  if (!uid) return null;

  const effectivePrice = clampPaidMessagePrice(priceDraft, remotePrice);
  const { netPayoutUSD } = calculateWithdrawalBreakdown(effectivePrice, economyConfig);

  const handleToggleAllow = async () => {
    if (busyToggle) return;
    const nextVal = !allowPaid;
    setBusyToggle(true);
    try {
      const updates = { allowPaidMessages: nextVal };
      if (nextVal && !userProfile?.messagePriceDiamonds) {
        updates.messagePriceDiamonds = effectivePrice;
        lastSavedPriceRef.current = effectivePrice;
      }
      await updateUserProfile(uid, updates);
      onSuccess?.(
        nextVal
          ? `💎 Mensajes prioritarios activados (${effectivePrice} 💎 por solicitud sin match).`
          : 'Mensajes directos sin match desactivados. Solo podrás chatear con tus Matches.'
      );
    } catch (err) {
      onError?.(err?.message || 'No se pudo actualizar esta opción.');
    } finally {
      setBusyToggle(false);
    }
  };

  const handleSelectPreset = (amount) => {
    const clean = clampPaidMessagePrice(amount, PAID_MESSAGE_DEFAULT_PRICE);
    setPriceDraft(String(clean));
    setSaveState('saving');
    priceSaverRef.current?.schedule(clean, { immediate: true });
  };

  const handleCustomChange = (raw) => {
    const digitsOnly = String(raw || '').replace(/[^\d]/g, '');
    setPriceDraft(digitsOnly);
    const parsed = Math.floor(Number(digitsOnly));
    if (
      Number.isFinite(parsed) &&
      parsed >= PAID_MESSAGE_MIN_PRICE &&
      parsed <= PAID_MESSAGE_MAX_PRICE
    ) {
      setSaveState('saving');
      priceSaverRef.current?.schedule(parsed, { immediate: false });
    }
  };

  const handleCustomBlur = () => {
    const clamped = clampPaidMessagePrice(priceDraft, remotePrice);
    setPriceDraft(String(clamped));
    if (clamped !== lastSavedPriceRef.current) {
      priceSaverRef.current?.schedule(clamped, { immediate: true });
    }
    priceSaverRef.current?.flush();
  };

  return (
    <div
      className={`relative overflow-hidden rounded-[26px] border transition-all ${
        compact ? 'p-4' : 'p-4 sm:p-5'
      } ${
        allowPaid
          ? 'bg-gradient-to-br from-[#FFF9EE] via-white to-[#FFF1F5] border-amber-300/75 shadow-[0_14px_34px_-14px_rgba(217,119,6,0.22)]'
          : 'bg-white border-zinc-200/80 shadow-card'
      }`}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 w-32 h-32 rounded-full bg-amber-300/15 blur-2xl" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border transition ${
              allowPaid
                ? 'bg-gradient-to-br from-amber-400 via-amber-500 to-[#FF2E54] text-white border-transparent shadow-md shadow-amber-500/20'
                : 'bg-amber-50 text-amber-700 border-amber-200/80'
            }`}
          >
            <MessageSquareHeart className="w-5 h-5" />
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-xs sm:text-sm font-black text-zinc-900 leading-tight">
                Monetización de Mensajes Directos
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-amber-100/90 border border-amber-200 text-[9.5px] font-black uppercase tracking-wider text-amber-800">
                Solicitudes VIP
              </span>
            </div>
            <p className="text-[11px] text-zinc-600 leading-relaxed">
              Permitir mensajes directos pagados (sin match). Quienes quieran escribirte sin Match deberán enviarte diamantes y su mensaje llegará a tu bandeja prioritaria.
            </p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={allowPaid}
          disabled={busyToggle}
          onClick={handleToggleAllow}
          className={`relative w-12 h-7 rounded-full shrink-0 transition-all duration-200 mt-0.5 ${
            allowPaid
              ? 'bg-gradient-to-r from-amber-500 to-[#FF2E54] shadow-sm shadow-amber-500/25'
              : 'bg-zinc-300/90'
          } disabled:opacity-50`}
          aria-label="Permitir mensajes directos pagados sin match"
        >
          <span
            className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
              allowPaid ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {allowPaid && (
        <div className="relative mt-4 pt-3.5 border-t border-amber-200/60 space-y-3 animate-sheet-up">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold text-zinc-800 flex items-center gap-1.5">
              <Gem className="w-3.5 h-3.5 text-sky-500" />
              Tarifa por mensaje directo
            </span>
            <span className="text-[10.5px] font-bold text-emerald-700 inline-flex items-center gap-1">
              {saveState === 'saving' ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                  <span className="text-amber-700">Guardando...</span>
                </>
              ) : saveState === 'saved' ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Guardado</span>
                </>
              ) : (
                <span>Ganas {formatUSD(netPayoutUSD)} USD / msg</span>
              )}
            </span>
          </div>

          {/* Opciones rápidas */}
          <div className="grid grid-cols-4 gap-2">
            {PAID_MESSAGE_PRICE_PRESETS.map((amount) => {
              const selected = effectivePrice === amount;
              return (
                <button
                  key={amount}
                  type="button"
                  onClick={() => handleSelectPreset(amount)}
                  className={`py-2 px-1 rounded-2xl text-xs font-black transition active:scale-95 border ${
                    selected
                      ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
                      : 'bg-white text-zinc-800 border-zinc-200 hover:border-amber-300 hover:bg-amber-50/50'
                  }`}
                >
                  {amount} 💎
                </button>
              );
            })}
          </div>

          {/* Monto personalizado */}
          <div className="flex items-center gap-2.5 bg-white rounded-2xl border border-zinc-200/90 px-3.5 py-2 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/15 transition">
            <span className="text-[11px] font-extrabold text-zinc-500 shrink-0">
              Personalizado:
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={PAID_MESSAGE_MIN_PRICE}
              max={PAID_MESSAGE_MAX_PRICE}
              value={priceDraft}
              onChange={(e) => handleCustomChange(e.target.value)}
              onBlur={handleCustomBlur}
              className="flex-1 min-w-0 bg-transparent text-sm font-black text-zinc-900 focus:outline-none tabular-nums"
              placeholder={String(PAID_MESSAGE_DEFAULT_PRICE)}
            />
            <span className="text-xs font-black text-sky-600 shrink-0">💎</span>
          </div>

          <p className="text-[10.5px] text-zinc-500 leading-snug">
            Recibirás <strong className="text-zinc-800">{effectivePrice} 💎 retirables</strong> ({formatUSD(netPayoutUSD)} USD) en tu bóveda por cada mensaje prioritario que te envíen.
          </p>
        </div>
      )}
    </div>
  );
}
