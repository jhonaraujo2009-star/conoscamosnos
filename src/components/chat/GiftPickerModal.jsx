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
    <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md bg-white border border-rose-100 rounded-t-[32px] sm:rounded-[32px] p-6 shadow-luxury">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-500 to-amber-400 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-extrabold text-slate-900">
                Enviar Regalo a {recipientName}
              </h3>
              <p className="text-xs text-slate-500">
                Tu regalo acredita Diamantes reales a su perfil
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 mb-4">
          <span className="text-xs font-semibold text-amber-900">Tu saldo disponible</span>
          <div className="flex items-center gap-3">
            <span className="text-sm font-extrabold text-amber-800 flex items-center gap-1">
              <Coins className="w-4 h-4 text-amber-500" />
              {userCoins}
            </span>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCoinStore();
              }}
              className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[11px] font-extrabold shadow-sm hover:brightness-105"
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
                className={`p-3.5 rounded-2xl bg-gradient-to-br ${gift.accent} border text-left transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 shadow-sm ${
                  gift.id === 'diamond' ? 'col-span-2 flex items-center justify-between gap-3' : ''
                }`}
              >
                <div className={gift.id === 'diamond' ? 'flex items-center gap-3' : ''}>
                  <span className="text-3xl block drop-shadow-sm">{gift.icon}</span>
                  <div>
                    <p className="text-sm font-extrabold text-slate-900 mt-1 flex items-center gap-1">
                      {gift.name}
                      {gift.id === 'diamond' && <Sparkles className="w-3.5 h-3.5 text-indigo-500" />}
                    </p>
                    <p className="text-[11px] text-slate-600 leading-tight">{gift.tagline}</p>
                  </div>
                </div>

                <div
                  className={`mt-2.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold border ${
                    canAfford
                      ? 'bg-white border-amber-200 text-amber-800 shadow-sm'
                      : 'bg-rose-50 border-rose-200 text-rose-600'
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
