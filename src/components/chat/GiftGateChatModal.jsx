import { BadgeCheck, Coins, Crown, Gem, Gift, Lock, Sparkles, X } from 'lucide-react';
import { ECONOMY_CONFIG, VIRTUAL_GIFTS } from '../../config/constants';
import { calculateGiftEconomics, formatUSD, getPrimaryPhoto, isProfileVerified } from '../../utils/formatters';

export default function GiftGateChatModal({
  isOpen,
  targetUser,
  userCoins = 0,
  sendingGiftId = null,
  onClose,
  onSelectGift,
  onOpenCoinStore,
}) {
  if (!isOpen || !targetUser) return null;

  const verified = isProfileVerified(targetUser);
  const firstName = (targetUser.name || 'este perfil').split(' ')[0];

  return (
    <div className="fixed inset-0 z-[65] bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md max-h-[92dvh] bg-white rounded-t-[32px] sm:rounded-[32px] flex flex-col overflow-hidden shadow-2xl animate-sheet-up">
        {/* Luxury Obsidian-Gold Header */}
        <div className="relative px-5 py-5 bg-gradient-to-br from-[#190813] via-[#2A0B1D] to-[#120710] text-white">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3.5 pr-8">
            <div className="relative shrink-0">
              <img
                src={getPrimaryPhoto(targetUser, 200)}
                alt={targetUser.name}
                className="w-16 h-16 rounded-2xl object-cover ring-2 ring-amber-300/60 shadow-lg"
              />
              <span className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-zinc-950 flex items-center justify-center shadow">
                <Crown className="w-3.5 h-3.5" />
              </span>
            </div>

            <div className="min-w-0">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/30 text-amber-200 text-[10px] font-black uppercase tracking-wider">
                <Lock className="w-2.5 h-2.5" /> Chat Exclusivo con Regalo
              </span>
              <h3 className="font-display text-lg font-black text-white truncate mt-1 flex items-center gap-1">
                <span className="truncate">{targetUser.name}</span>
                {verified && (
                  <BadgeCheck className="w-4 h-4 text-sky-400 fill-sky-400 stroke-white shrink-0" />
                )}
              </h3>
              <p className="text-[11px] text-rose-100/80 leading-snug mt-0.5">
                {firstName} solo recibe chats nuevos si le envías cualquier regalo virtual.
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-4 bg-[#F4F4F6]">
          <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-white border border-amber-200/80 shadow-card">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-zinc-500">Tu saldo disponible</p>
              <p className="text-sm font-black text-amber-700 flex items-center gap-1">
                <Coins className="w-4 h-4 text-amber-500" />
                {userCoins} monedas
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCoinStore?.();
              }}
              className="px-3.5 py-2 rounded-full bg-zinc-900 text-white text-xs font-extrabold hover:bg-zinc-800 shadow-sm transition shrink-0"
            >
              + Recargar
            </button>
          </div>

          <div className="px-3.5 py-2.5 rounded-2xl bg-sky-50 border border-sky-200/80 text-[11px] text-sky-900 font-medium flex items-start gap-2">
            <Gem className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
            <span>
              Al enviar <strong>cualquier regalo</strong> (desde 🌹 10 monedas), desbloqueas su chat privado al instante y {firstName} recibe <strong>1 💎 por moneda</strong> (${ECONOMY_CONFIG.diamondToNetUSDRate.toFixed(3)} USD/💎 retirables).
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {VIRTUAL_GIFTS.map((gift) => {
              const canAfford = userCoins >= gift.price;
              const busy = sendingGiftId === gift.id;
              const eco = calculateGiftEconomics(gift.price);
              return (
                <button
                  key={gift.id}
                  type="button"
                  disabled={Boolean(sendingGiftId)}
                  onClick={() => {
                    if (!canAfford) {
                      onClose();
                      onOpenCoinStore?.();
                      return;
                    }
                    onSelectGift?.(gift);
                  }}
                  className={`p-3.5 rounded-2xl bg-gradient-to-br ${gift.accent} border text-left transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 shadow-sm ${
                    gift.id === 'diamond' ? 'col-span-2 flex items-center justify-between gap-3' : ''
                  }`}
                >
                  <div className={gift.id === 'diamond' ? 'flex items-center gap-3' : ''}>
                    <span className="text-3xl block drop-shadow-sm">{gift.icon}</span>
                    <div>
                      <p className="text-sm font-extrabold text-zinc-900 mt-1 flex items-center gap-1">
                        {gift.name}
                        {gift.id === 'diamond' && <Sparkles className="w-3.5 h-3.5 text-indigo-500" />}
                      </p>
                      <p className="text-[11px] text-zinc-600 leading-tight">{gift.tagline}</p>
                      <p className="text-[10px] font-bold text-sky-700 mt-1">
                        +{eco.diamonds} 💎 ({formatUSD(eco.netPayoutUSD)})
                      </p>
                    </div>
                  </div>

                  <div
                    className={`mt-2.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold border ${
                      canAfford
                        ? 'bg-white border-amber-200 text-amber-800 shadow-sm'
                        : 'bg-rose-50 border-rose-200 text-[#FF2E54]'
                    }`}
                  >
                    <Gift className="w-3.5 h-3.5 text-amber-500" />
                    {busy ? 'Desbloqueando...' : `${gift.price} 🪙`}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
