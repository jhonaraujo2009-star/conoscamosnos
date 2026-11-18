import { useEffect } from 'react';
import { Gem, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { calculateWithdrawalBreakdown, formatUSD } from '../../utils/formatters';

export default function GiftAnimationOverlay({ giftEvent, onComplete }) {
  const { economyConfig } = useAuth();
  useEffect(() => {
    if (!giftEvent) return;
    const timer = setTimeout(() => {
      onComplete?.();
    }, 3400);
    return () => clearTimeout(timer);
  }, [giftEvent, onComplete]);

  if (!giftEvent) return null;

  const floatingEmojis = Array.from({ length: 14 }, (_, i) => ({
    id: i,
    left: `${6 + ((i * 7) % 88)}%`,
    delay: `${(i % 5) * 0.18}s`,
  }));

  return (
    <div
      onClick={onComplete}
      className="fixed inset-0 z-[80] bg-black/55 backdrop-blur-md flex items-center justify-center p-6 overflow-hidden cursor-pointer"
    >
      {floatingEmojis.map((p) => (
        <span
          key={p.id}
          style={{ left: p.left, animationDelay: p.delay }}
          className="absolute bottom-12 text-4xl animate-float-up pointer-events-none select-none"
        >
          {giftEvent.giftIcon}
        </span>
      ))}

      <div className="relative z-10 text-center max-w-xs w-full p-6 rounded-[32px] bg-white border-2 border-amber-300 shadow-2xl animate-sheet-up">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-extrabold mb-3">
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          {giftEvent.isReceiver ? '¡REGALO RECIBIDO!' : '¡REGALO ENVIADO!'}
        </div>

        <div className="text-7xl my-3 animate-bounce drop-shadow-md">
          {giftEvent.giftIcon}
        </div>

        <h3 className="font-display text-xl font-extrabold text-zinc-900">{giftEvent.giftName}</h3>
        <p className="text-xs text-zinc-600 mt-1">
          {giftEvent.isReceiver
            ? `${giftEvent.senderName || 'Alguien especial'} te envió este regalo`
            : `Enviado con éxito (${giftEvent.giftValue} monedas)`}
        </p>

        {giftEvent.isReceiver && (() => {
          const diamonds = giftEvent.diamondsCredited || giftEvent.giftValue || 0;
          const { netPayoutUSD } = calculateWithdrawalBreakdown(diamonds, economyConfig);
          return (
            <div className="mt-4 space-y-1">
              <div className="py-2 px-4 rounded-2xl bg-sky-50 border border-sky-200 inline-flex items-center gap-1.5 text-sm font-extrabold text-sky-800">
                <Gem className="w-4 h-4 text-sky-500" />
                +{diamonds} Diamantes acreditados
              </div>
              <p className="text-[11px] font-bold text-emerald-700">
                Equivale a {formatUSD(netPayoutUSD)} USD retirables en billetera
              </p>
            </div>
          );
        })()}

        <p className="text-[11px] font-semibold text-zinc-400 mt-4">Toca para continuar</p>
      </div>
    </div>
  );
}
