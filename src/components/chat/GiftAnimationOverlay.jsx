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
      className="fixed inset-0 z-[80] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-6 overflow-hidden cursor-pointer"
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

      <div className="relative z-10 text-center max-w-xs w-full p-6 rounded-3xl bg-gradient-to-b from-slate-900/95 to-slate-950/95 border border-amber-400/60 shadow-[0_0_50px_rgba(245,158,11,0.35)]">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-extrabold mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          {giftEvent.isReceiver ? '¡REGALO RECIBIDO!' : '¡REGALO ENVIADO!'}
        </div>

        <div className="text-7xl my-3 animate-bounce drop-shadow-[0_0_24px_rgba(251,191,36,0.7)]">
          {giftEvent.giftIcon}
        </div>

        <h3 className="text-xl font-extrabold text-white">{giftEvent.giftName}</h3>
        <p className="text-xs text-slate-300 mt-1">
          {giftEvent.isReceiver
            ? `${giftEvent.senderName || 'Alguien especial'} te envió este regalo`
            : `Enviado con éxito (${giftEvent.giftValue} monedas)`}
        </p>

        {giftEvent.isReceiver && (
          <div className="mt-4 py-2 px-4 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 inline-flex items-center gap-1.5 text-sm font-extrabold text-cyan-200">
            <Gem className="w-4 h-4 text-cyan-400" />
            +{giftEvent.diamondsCredited || giftEvent.giftValue} Diamantes acreditados
          </div>
        )}

        <p className="text-[10px] text-slate-500 mt-4">Toca para continuar</p>
      </div>
    </div>
  );
}
