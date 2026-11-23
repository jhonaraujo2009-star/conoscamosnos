import { BadgeCheck, Check, Crown, Gem, Loader2, Trash2, X } from 'lucide-react';
import { formatChatListTime, getMatchActivityMs, getPaidRequest } from '../../utils/chatHelpers';
import { getPrimaryPhoto, isProfileVerified, isUserActuallyOnline } from '../../utils/formatters';

export default function PaidRequestPreviewModal({
  requestItem,
  currentUserId,
  busyAction = '',
  onClose,
  onAccept,
  onReject,
  onViewProfile,
}) {
  if (!requestItem?.match || !requestItem?.peerUser) return null;
  const { match, peerUser } = requestItem;
  const paidReq = getPaidRequest(match);
  if (!paidReq) return null;

  const verified = isProfileVerified(peerUser);
  const online = isUserActuallyOnline(peerUser);
  const timeLabel = formatChatListTime(getMatchActivityMs(match));
  const isBusy = Boolean(busyAction);

  return (
    <div
      onClick={() => !isBusy && onClose?.()}
      className="fixed inset-0 z-[65] bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl animate-sheet-up"
      >
        {/* Encabezado VIP */}
        <div className="relative px-5 py-5 bg-gradient-to-br from-[#190913] via-[#2B0E21] to-[#110812] text-white">
          <button
            type="button"
            disabled={isBusy}
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onViewProfile?.(peerUser)}
            className="flex items-center gap-3.5 pr-8 text-left group"
          >
            <div className="relative shrink-0">
              <div className="p-[2.5px] rounded-full bg-gradient-to-tr from-amber-400 via-yellow-200 to-sky-400 shadow-lg">
                <img
                  src={getPrimaryPhoto(peerUser, 200, { seed: currentUserId })}
                  alt={peerUser.name}
                  className="w-16 h-16 rounded-full object-cover bg-zinc-900 group-hover:scale-105 transition"
                />
              </div>
              {online && (
                <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-[#190913]" />
              )}
            </div>

            <div className="min-w-0">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-200 text-[10px] font-black uppercase tracking-wider">
                <Crown className="w-2.5 h-2.5" /> Solicitud VIP · 💎 {paidReq.diamonds}
              </span>
              <h3 className="font-display text-lg font-black text-white truncate mt-1 flex items-center gap-1">
                <span className="truncate">{peerUser.name}</span>
                {verified && (
                  <BadgeCheck className="w-4 h-4 text-sky-400 fill-sky-400 stroke-white shrink-0" />
                )}
              </h3>
              <p className="text-[11px] text-rose-100/80">
                Ver perfil completo · {timeLabel || 'Reciente'}
              </p>
            </div>
          </button>
        </div>

        {/* Vista previa del mensaje + Acciones */}
        <div className="p-5 pb-safe bg-[#FBF7F4] space-y-4">
          <div className="p-4 rounded-3xl bg-white border border-amber-200/75 shadow-card space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-amber-700 inline-flex items-center gap-1">
                <Gem className="w-3.5 h-3.5 text-sky-500" />
                +{paidReq.diamonds} 💎 acreditados en tu bóveda
              </span>
              {timeLabel && (
                <span className="text-[10.5px] font-semibold text-zinc-400">{timeLabel}</span>
              )}
            </div>
            <p className="text-sm font-semibold text-zinc-900 leading-relaxed break-words">
              “{paidReq.message || 'Te envió un mensaje prioritario VIP.'}”
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onAccept?.(requestItem)}
              className="w-full py-3.5 px-5 rounded-full bg-gradient-to-r from-[#FF2E54] via-rose-500 to-amber-500 text-white text-xs sm:text-sm font-black shadow-lg hover:brightness-105 active:scale-[0.98] disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {busyAction === 'accept' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4 stroke-[2.6]" />
              )}
              Aceptar y Responder
            </button>

            <button
              type="button"
              disabled={isBusy}
              onClick={() => onReject?.(requestItem)}
              className="w-full py-3 px-5 rounded-full bg-white hover:bg-rose-50 border border-zinc-200 hover:border-rose-200 text-zinc-700 hover:text-[#FF2E54] text-xs font-extrabold active:scale-[0.98] disabled:opacity-50 transition flex items-center justify-center gap-1.5"
            >
              {busyAction === 'reject' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Rechazar / Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
