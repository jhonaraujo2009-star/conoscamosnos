import { Coins, Gift, Sparkles, X } from 'lucide-react';
import { VIRTUAL_GIFTS } from '../../config/constants';

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
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-500 to-amber-400 flex items-center justify-center text-white shadow">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">
                Enviar Regalo a {recipientName}
              </h3>
              <p className="text-xs text-slate-400">
                Tu regalo acredita Diamantes reales a su cuenta
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

        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 mb-4">
          <span className="text-xs text-slate-400">Tu saldo</span>
          <div className="flex items-center gap-3">
            <span className="text-sm font-extrabold text-amber-300 flex items-center gap-1">
              <Coins className="w-4 h-4 text-amber-400" />
              {userCoins}
            </span>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCoinStore();
              }}
              className="px-2.5 py-1 rounded-full bg-amber-400 text-slate-950 text-[11px] font-extrabold hover:bg-amber-300"
            >
              + Recargar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {VIRTUAL_GIFTS.map((gift) => {
            const canAfford = userCoins >= gift.price;
            const busy = sendingGiftId === gift.id;
            return (
              <button
                key={gift.id}
                type="button"
                disabled={Boolean(sendingGiftId)}
                onClick={() => {
                  if (!canAfford) {
                    onClose();
                    onOpenCoinStore();
                    return;
                  }
                  onSelectGift(gift);
                }}
                className={`p-3.5 rounded-2xl bg-gradient-to-br ${gift.accent} border text-left transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 ${
                  gift.id === 'diamond' ? 'col-span-2 flex items-center justify-between gap-3' : ''
                }`}
              >
                <div className={gift.id === 'diamond' ? 'flex items-center gap-3' : ''}>
                  <span className="text-3xl block drop-shadow">{gift.icon}</span>
                  <div>
                    <p className="text-sm font-extrabold text-white mt-1 flex items-center gap-1">
                      {gift.name}
                      {gift.id === 'diamond' && <Sparkles className="w-3.5 h-3.5 text-cyan-300" />}
                    </p>
                    <p className="text-[11px] text-slate-300/90 leading-tight">{gift.tagline}</p>
                  </div>
                </div>

                <div
                  className={`mt-2.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold ${
                    canAfford
                      ? 'bg-slate-950/80 text-amber-300'
                      : 'bg-rose-950/80 text-rose-200'
                  }`}
                >
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
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
