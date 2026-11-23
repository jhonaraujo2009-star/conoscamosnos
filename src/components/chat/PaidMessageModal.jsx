import { useEffect, useState } from 'react';
import { BadgeCheck, Crown, Gem, Loader2, Send, Sparkles, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  PAID_MESSAGE_DEFAULT_PRICE,
  PAID_MESSAGE_MAX_LENGTH,
  clampPaidMessagePrice,
} from '../../utils/chatHelpers';
import {
  calculateWithdrawalBreakdown,
  formatUSD,
  getPrimaryPhoto,
  isProfileVerified,
} from '../../utils/formatters';

export default function PaidMessageModal({
  isOpen,
  targetUser,
  userDiamonds = 0,
  sending = false,
  onClose,
  onSend,
  onOpenDiamondStore,
}) {
  const { economyConfig } = useAuth();
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setMessage('');
    }
  }, [isOpen, targetUser?.uid, targetUser?.id]);

  if (!isOpen || !targetUser) return null;

  const price = clampPaidMessagePrice(
    targetUser.messagePriceDiamonds,
    PAID_MESSAGE_DEFAULT_PRICE
  );
  const canAfford = userDiamonds >= price;
  const verified = isProfileVerified(targetUser);
  const firstName = (targetUser.name || 'esta persona').split(' ')[0];
  const { netPayoutUSD } = calculateWithdrawalBreakdown(price, economyConfig);

  const quickOpeners = [
    `Hola ${firstName}, me encantó tu perfil ✨ ¿Conversamos?`,
    `¡Hola ${firstName}! Vi tu perfil y quise saludarte directo.`,
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (sending) return;
    if (!canAfford) {
      onClose?.();
      onOpenDiamondStore?.('buy');
      return;
    }
    const clean = message.trim();
    if (!clean) return;
    await onSend?.(clean);
  };

  return (
    <div
      onClick={() => !sending && onClose?.()}
      className="fixed inset-0 z-[65] bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[92dvh] bg-white rounded-t-[32px] sm:rounded-[32px] flex flex-col overflow-hidden shadow-2xl animate-sheet-up"
      >
        {/* Cabecera Obsidian-Gold */}
        <div className="relative px-5 py-5 bg-gradient-to-br from-[#190913] via-[#2B0C1F] to-[#120810] text-white">
          <button
            type="button"
            disabled={sending}
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3.5 pr-8">
            <div className="relative shrink-0">
              <div className="p-[2px] rounded-2xl bg-gradient-to-br from-amber-300 via-yellow-200 to-sky-400 shadow-lg">
                <img
                  src={getPrimaryPhoto(targetUser, 200)}
                  alt={targetUser.name}
                  className="w-16 h-16 rounded-[14px] object-cover bg-zinc-900"
                />
              </div>
              <span className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-zinc-950 flex items-center justify-center shadow">
                <Crown className="w-3.5 h-3.5" />
              </span>
            </div>

            <div className="min-w-0">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/35 text-amber-200 text-[10px] font-black uppercase tracking-wider">
                <Sparkles className="w-2.5 h-2.5" /> Mensaje Prioritario · {price} 💎
              </span>
              <h3 className="font-display text-lg font-black text-white truncate mt-1 flex items-center gap-1">
                <span className="truncate">
                  Envía un mensaje prioritario por {price} 💎
                </span>
              </h3>
              <p className="text-[11px] text-rose-100/80 leading-snug mt-0.5 flex items-center gap-1">
                <span className="truncate">
                  Para <strong className="text-white">{targetUser.name}</strong>
                </span>
                {verified && (
                  <BadgeCheck className="w-3.5 h-3.5 text-sky-400 fill-sky-400 stroke-white shrink-0" />
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Cuerpo */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto no-scrollbar p-5 pb-safe space-y-4 bg-[#FBF7F4]"
        >
          {/* Saldo de Diamantes */}
          <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-white border border-sky-200/80 shadow-card">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-zinc-500">Tus Diamantes disponibles</p>
              <p
                className={`text-sm font-black flex items-center gap-1 tabular-nums ${
                  canAfford ? 'text-sky-700' : 'text-[#FF2E54]'
                }`}
              >
                <Gem className="w-4 h-4 text-sky-500" />
                {userDiamonds} 💎
                {!canAfford && (
                  <span className="text-[10.5px] font-bold text-[#FF2E54] ml-1">
                    (Faltan {price - userDiamonds} 💎)
                  </span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose?.();
                onOpenDiamondStore?.('buy');
              }}
              className="px-3.5 py-2 rounded-full bg-zinc-900 text-white text-xs font-extrabold hover:bg-zinc-800 shadow-sm transition shrink-0"
            >
              + Recargar 💎
            </button>
          </div>

          {/* Nota de valor */}
          <div className="px-3.5 py-2.5 rounded-2xl bg-amber-50/90 border border-amber-200/80 text-[11px] text-amber-950 font-medium leading-relaxed">
            Tu mensaje llegará destacado a la bandeja de <strong>Solicitudes VIP</strong> de {firstName} sin necesidad de Match previo. {firstName} recibe <strong>{price} 💎</strong> ({formatUSD(netPayoutUSD)} USD) en su bóveda.
          </div>

          {/* Sugerencias rápidas */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
              Frases rápidas
            </p>
            <div className="flex flex-wrap gap-1.5">
              {quickOpeners.map((opener, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setMessage(opener)}
                  className="px-3 py-1.5 rounded-full bg-white hover:bg-rose-50 border border-zinc-200 hover:border-rose-200 text-[11px] font-bold text-zinc-700 hover:text-[#FF2E54] transition text-left"
                >
                  {opener}
                </button>
              ))}
            </div>
          </div>

          {/* Campo de texto */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-extrabold text-zinc-700">
                Tu mensaje prioritario
              </label>
              <span className="text-[10.5px] font-bold text-zinc-400 tabular-nums">
                {message.length}/{PAID_MESSAGE_MAX_LENGTH}
              </span>
            </div>
            <textarea
              rows={3}
              maxLength={PAID_MESSAGE_MAX_LENGTH}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`Escribe un mensaje especial para ${firstName}...`}
              className="w-full p-3.5 rounded-2xl bg-white border border-zinc-200 text-sm text-zinc-900 placeholder:text-zinc-400 font-medium focus:outline-none focus:border-[#FF2E54] focus:ring-2 focus:ring-[#FF2E54]/10 resize-none transition"
            />
          </div>

          {/* Botón enviar */}
          <button
            type="submit"
            disabled={sending || (canAfford && !message.trim())}
            className={`w-full py-3.5 px-5 rounded-full text-xs sm:text-sm font-black shadow-lg active:scale-[0.98] disabled:opacity-50 transition flex items-center justify-center gap-2 ${
              canAfford
                ? 'bg-gradient-to-r from-[#FF2E54] via-rose-500 to-amber-500 text-white hover:brightness-105'
                : 'bg-zinc-900 text-white hover:bg-zinc-800'
            }`}
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enviando mensaje prioritario...
              </>
            ) : canAfford ? (
              <>
                <Send className="w-4 h-4" />
                Enviar por {price} 💎
              </>
            ) : (
              <>
                <Gem className="w-4 h-4 text-sky-300" />
                Recargar Diamantes ({price} 💎)
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
