import { Gem, Sparkles } from 'lucide-react';

export default function GiftMessageCard({ message, isMine }) {
  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} my-2`}>
      <div className="relative max-w-[260px] w-full rounded-3xl p-[1.5px] bg-gradient-to-r from-brand-500 via-amber-400 to-cyan-400 animate-pulse-glow shadow-xl">
        <div className="rounded-[22px] bg-slate-950/95 p-3.5 gift-shimmer animate-shimmer text-center space-y-1.5">
          <div className="flex items-center justify-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-300">
            <Sparkles className="w-3 h-3" />
            {isMine ? 'Enviaste un Regalo VIP' : '¡Te enviaron un Regalo!'}
            <Sparkles className="w-3 h-3" />
          </div>

          <div className="text-5xl py-1 drop-shadow-[0_0_16px_rgba(251,191,36,0.5)] animate-bounce">
            {message.giftIcon}
          </div>

          <p className="text-sm font-extrabold text-white">{message.giftName}</p>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 border border-amber-400/30 text-[11px] font-bold text-amber-300">
            <span>{message.giftValue} monedas</span>
            <span className="text-slate-600">•</span>
            <span className="text-cyan-300 flex items-center gap-0.5">
              +{message.diamondsCredited || message.giftValue} <Gem className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
