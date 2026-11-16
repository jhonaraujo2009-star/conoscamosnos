import { useEffect } from 'react';
import { Gem, Sparkles } from 'lucide-react';

export default function GiftAnimationOverlay({ giftEvent, onComplete }) {
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
      className="fixed inset-0 z-[80] bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-6 overflow-hidden cursor-pointer"
    >
      {/* Floating gift particles */}
      {floatingEmojis.map((p) => (
        <span
          key={p.id}
          style={{ left: p.left, animationDelay: p.delay }}
          className="absolute bottom-12 text-4xl animate-float-up pointer-events-none select-none"
        >
          {giftEvent.giftIcon}
        </span>
      ))}

      <div className="relative z-10 text-center max-w-xs w-full p-6 rounded-[32px] bg-white border-2 border-amber-300 shadow-[0_20px_60px_rgba(245,158,11,0.3)]">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-extrabold mb-3">
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          {giftEvent.isReceiver ? '¡REGALO RECIBIDO!' : '¡REGALO ENVIADO!'}
        </div>

        <div className="text-7xl my-3 animate-bounce drop-shadow-md">
          {giftEvent.giftIcon}
        </div>

        <h3 className="font-display text-xl font-extrabold text-slate-900">{giftEvent.giftName}</h3>
        <p className="text-xs text-slate-600 mt-1">
          {giftEvent.isReceiver
            ? `${giftEvent.senderName || 'Alguien especial'} te envió este regalo`
            : `Enviado con éxito (${giftEvent.giftValue} monedas)`}
        </p>

        {giftEvent.isReceiver && (
          <div className="mt-4 py-2 px-4 rounded-2xl bg-sky-50 border border-sky-200 inline-flex items-center gap-1.5 text-sm font-extrabold text-sky-800">
            <Gem className="w-4 h-4 text-sky-500" />
            +{giftEvent.diamondsCredited || giftEvent.giftValue} Diamantes acreditados
          </div>
        )}

        <p className="text-[11px] font-semibold text-slate-400 mt-4">Toca para continuar</p>
      </div>
    </div>
  );
}
