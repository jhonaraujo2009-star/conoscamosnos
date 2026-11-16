import { Gem, Sparkles } from 'lucide-react';

export default function GiftMessageCard({ message, isMine }) {
  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} my-2`}>
      <div className="relative max-w-[260px] w-full rounded-3xl p-[2px] bg-gradient-to-r from-brand-500 via-amber-400 to-sky-400 animate-pulse-glow shadow-md">
        <div className="rounded-[22px] bg-white p-4 gift-shimmer animate-shimmer text-center space-y-1.5">
          <div className="flex items-center justify-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-brand-600">
            <Sparkles className="w-3 h-3 text-amber-500" />
            {isMine ? 'Enviaste un Regalo VIP' : '¡Recibiste un Regalo VIP!'}
            <Sparkles className="w-3 h-3 text-amber-500" />
          </div>

          <div className="text-5xl py-1 drop-shadow-sm animate-bounce">
            {message.giftIcon}
          </div>

          <p className="font-display text-sm font-extrabold text-slate-900">{message.giftName}</p>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 border border-amber-200 text-[11px] font-extrabold text-amber-800 shadow-sm">
            <span>{message.giftValue} monedas</span>
            <span className="text-slate-300">•</span>
            <span className="text-sky-600 flex items-center gap-0.5">
              +{message.diamondsCredited || message.giftValue} <Gem className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
