import { Coins, Gem, Gift, Sparkles } from 'lucide-react';
import { ECONOMY_CONFIG, VIRTUAL_GIFTS } from '../../config/constants';
import { useAuth } from '../../contexts/AuthContext';
import { calculateGiftEconomics, formatUSD } from '../../utils/formatters';
import LuxuryModalHeader from '../layout/LuxuryModalHeader';

export default function GiftPickerModal({
  isOpen,
  onClose,
  recipientName,
  userCoins = 0,
  sendingGiftId = null,
  onSelectGift,
  onOpenCoinStore,
}) {
  const { economyConfig } = useAuth();
  if (!isOpen) return null;
  const liveEconomy = economyConfig || ECONOMY_CONFIG;

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md max-h-[92dvh] bg-[#FAF7F9] rounded-t-[32px] sm:rounded-[32px] flex flex-col overflow-hidden shadow-2xl animate-sheet-up">
        <LuxuryModalHeader
          icon={Gift}
          eyebrow="Regalos VIP"
          title={`Enviar regalo a ${recipientName || 'este perfil'}`}
          subtitle="Tu regalo acredita Diamantes reales retirables en USD"
          onClose={onClose}
        />

        <div className="p-5 overflow-y-auto no-scrollbar">

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
            <strong>{liveEconomy.diamondsPerCoin} 💎</strong> (${liveEconomy.diamondToNetUSDRate.toFixed(3)} USD netos retirables en USD para quien recibe).
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {VIRTUAL_GIFTS.map((gift) => {
            const canAfford = userCoins >= gift.price;
            const busy = sendingGiftId === gift.id;
            const eco = calculateGiftEconomics(gift.price, liveEconomy);
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
    </div>
  );
}
