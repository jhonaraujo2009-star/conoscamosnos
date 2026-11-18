import { Gift, Sparkles } from 'lucide-react';
import { formatGiftBadgeCount, getSortedReceivedGifts } from '../../utils/formatters';

export default function GiftShowcaseCard({
  user,
  title = 'Regalos recibidos',
  emptyText = 'Aún no ha recibido regalos virtuales.',
  headerAction = null,
}) {
  const sortedGifts = getSortedReceivedGifts(user);
  const totalCount = Number(user?.giftsReceivedCount || 0);

  if (sortedGifts.length === 0 && totalCount === 0) {
    return (
      <div className="p-4 rounded-[26px] bg-white/95 border border-zinc-200/75 shadow-[0_6px_24px_-10px_rgba(15,23,42,0.08)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-50 to-rose-50 border border-amber-200/80 text-amber-700 flex items-center justify-center shrink-0">
            <Gift className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-zinc-900">{title}</p>
            <p className="text-[11px] text-zinc-500 leading-snug line-clamp-2 mt-0.5">{emptyText}</p>
          </div>
        </div>
        {headerAction && <div className="shrink-0">{headerAction}</div>}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 rounded-[26px] bg-white/95 border border-zinc-200/75 shadow-[0_8px_28px_-10px_rgba(15,23,42,0.08)] space-y-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-amber-50 border border-amber-200/70 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-extrabold text-zinc-900 tracking-tight">
              {title}
            </p>
            <p className="text-[10px] font-bold text-zinc-400">
              {totalCount} {totalCount === 1 ? 'detalle recibido' : 'detalles recibidos'}
            </p>
          </div>
        </div>
        {headerAction}
      </div>

      {sortedGifts.length > 0 ? (
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5">
          {sortedGifts.map((gift) => (
            <div
              key={gift.id}
              title={`${gift.name}: ${gift.count} ${gift.count === 1 ? 'recibido' : 'recibidos'}`}
              className="relative flex flex-col items-center p-2 rounded-2xl bg-gradient-to-b from-zinc-50/70 to-white border border-zinc-100"
            >
              <div
                className={`relative w-12 h-12 rounded-2xl bg-gradient-to-br ${gift.accent} border flex items-center justify-center shadow-sm`}
              >
                <span className="text-2xl leading-none drop-shadow-sm">{gift.icon}</span>
                <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1.5 rounded-full bg-zinc-900 text-white text-[9.5px] font-black flex items-center justify-center shadow ring-2 ring-white">
                  {formatGiftBadgeCount(gift.count)}
                </span>
              </div>
              <span className="text-[10px] font-bold text-zinc-700 truncate w-full text-center mt-1.5">
                {gift.name}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-amber-50 border border-amber-200/80 text-xs font-extrabold text-amber-900">
          <span>🎁</span>
          <span>
            {totalCount} {totalCount === 1 ? 'regalo recibido' : 'regalos recibidos'}
          </span>
        </div>
      )}
    </div>
  );
}
