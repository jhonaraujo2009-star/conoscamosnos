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
      <div className="p-4 rounded-2xl bg-white shadow-card flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center shrink-0">
            <Gift className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-zinc-900">{title}</p>
            <p className="text-[11px] text-zinc-500 truncate">{emptyText}</p>
          </div>
        </div>
        {headerAction}
      </div>
    );
  }

  return (
    <div className="p-4 rounded-2xl bg-white shadow-card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-500">
            {title} ({totalCount})
          </p>
        </div>
        {headerAction}
      </div>

      {sortedGifts.length > 0 ? (
        <div className="flex flex-wrap gap-2.5">
          {sortedGifts.map((gift) => (
            <div
              key={gift.id}
              title={`${gift.name}: ${gift.count} ${gift.count === 1 ? 'recibido' : 'recibidos'}`}
              className="relative flex flex-col items-center w-[66px]"
            >
              <div
                className={`relative w-14 h-14 rounded-2xl bg-gradient-to-br ${gift.accent} border flex items-center justify-center shadow-sm`}
              >
                <span className="text-2xl leading-none drop-shadow-sm">{gift.icon}</span>
                <span className="absolute -top-2 -right-2 min-w-[22px] h-5 px-1.5 rounded-full bg-zinc-900 text-white text-[10px] font-black flex items-center justify-center shadow ring-2 ring-white">
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
