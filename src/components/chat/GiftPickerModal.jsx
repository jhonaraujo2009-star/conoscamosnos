import { Coins, Gem, Gift, Sparkles, X } from 'lucide-react';
import { ECONOMY_CONFIG, VIRTUAL_GIFTS } from '../../config/constants';
import { calculateGiftEconomics, formatUSD } from '../../utils/formatters';

export default function GiftPickerModal({
  isOpen,
  onClose,
  recipientName,
  userCoins = 0,
  sendingGiftId = null,
  onSelectGift,
  onOpenCoinStore,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md bg-white rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl animate-sheet-up">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#FF2E54] to-amber-400 flex items-center justify-center text-white shadow-md shadow-[#FF2E54]/20">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-extrabold text-zinc-900">
                Enviar Regalo a {recipientName}
              </h3>
              <p className="text-xs text-zinc-500">
                Tu regalo acredita Diamantes reales a su perfil
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

        <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200/80 mb-2.5">
          <span className="text-xs font-bold text-amber-900">Tu saldo disponible</span>
          <div className="flex items-center gap-3">
            <span className="text-sm font-extrabold text-amber-800 flex items-center gap-1">
              <Coins className="w-4 h-4 text-amber-500" />
              {userCoins}
            </span>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCoinStore?.();
              }}
              className="px-3 py-1 rounded-full bg-zinc-900 text-white text-[11px] font-extrabold shadow-sm hover:bg-zinc-800"
            >
              + Recargar
            </button>
          </div>
        </div>

        <div className="px-3.5 py-2 rounded-2xl bg-sky-50 border border-sky-200/80 text-[11px] text-sky-900 font-medium mb-4 flex items-center gap-2">
          <Gem className="w-4 h-4 text-sky-500 shrink-0" />
          <span>
            <strong>Regla clara:</strong> cada <strong>1 moneda</strong> regalada entrega{' '}
            <strong>1 💎</strong> (${ECONOMY_CONFIG.diamondToNetUSDRate.toFixed(3)} USD netos retirables en Binance/USD para quien recibe).
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
                  onSelectGift(gift);
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
                      Entrega +{eco.diamonds} 💎 ({formatUSD(eco.netPayoutUSD)} retirables)
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
                  <Coins className="w-3.5 h-3.5 text-amber-500" />
                  {busy ? 'Enviando...' : `${gift.price}`}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
