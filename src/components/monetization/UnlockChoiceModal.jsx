import {
  ArrowRight,
  BadgeCheck,
  Crown,
  Gem,
  Heart,
  Lock,
  MessageCircleHeart,
  Play,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { resolveAccessPolicy } from '../../config/constants';
import { useAuth } from '../../contexts/AuthContext';
import { openIsolatedAdViewer } from '../../services/monetagLoader';
import { getDisplayAge, getPrimaryPhoto, isProfileVerified } from '../../utils/formatters';

/**
 * Modal luminoso (Light Luxury Pearl & Rose-Gold) para elegir cómo desbloquear
 * según la política global configurada por el Super Admin (Anuncio / Diamantes 💎 / PRO).
 */
export default function UnlockChoiceModal({
  isOpen,
  mode = 'unlock_chat', // 'unlock_chat' | 'reveal_like'
  targetUser,
  alreadyLikedMe = false,
  userCoins = 0,
  coinCost,
  busyCoins = false,
  lockedLikesCount = 0,
  unlockAllCost,
  onClose,
  onWatchAd,
  onUnlockWithCoins,
  onUnlockAllLikes,
  onOpenPro,
}) {
  const { economyConfig } = useAuth();
  if (!isOpen || !targetUser) return null;

  const policy = resolveAccessPolicy(economyConfig);
  const verified = isProfileVerified(targetUser);
  const visibleAge = getDisplayAge(targetUser);
  const firstName = (targetUser.name || 'este perfil').split(' ')[0];
  const isRevealLike = mode === 'reveal_like';
  const duration = policy.adDurationSeconds;
  const resolvedDiamondCost =
    coinCost ?? (isRevealLike ? policy.unlockLikeCoins : policy.unlockLikeChatCoins);
  const resolvedAllCost = unlockAllCost ?? policy.unlockAllLikesCoins;
  const hasEnoughDiamonds = Number(userCoins) >= Number(resolvedDiamondCost);
  const showAdOption = policy.enableRewardedAds;
  const showDiamondOption = policy.enableCoinCharges;

  const handleChooseFreeAd = () => {
    const session = openIsolatedAdViewer({
      purpose: mode,
      targetName: firstName,
      duration,
      directLink: policy.monetagDirectLink,
    });
    onWatchAd?.(session);
  };

  return (
    <div
      className="fixed inset-0 z-[72] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#FAF7F9] text-zinc-900 border border-rose-200/70 rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-[0_24px_70px_-14px_rgba(15,23,42,0.28)] animate-sheet-up"
      >
        {/* Cabecera Clara Pearl & Champagne */}
        <div className="relative px-5 pt-5 pb-5 bg-gradient-to-br from-[#FFF4F6] via-white to-[#FFF9EE] border-b border-rose-100">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 hover:text-zinc-900 flex items-center justify-center transition"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="relative flex items-center gap-3.5 pr-9">
            <div className="relative shrink-0 p-[2.5px] rounded-[22px] bg-gradient-to-br from-[#FF2E54] via-rose-400 to-amber-400 shadow-md shadow-[#FF2E54]/15">
              <div className="w-16 h-16 rounded-[20px] overflow-hidden bg-zinc-100 relative">
                <img
                  src={getPrimaryPhoto(targetUser, 220)}
                  alt={isRevealLike ? 'Perfil interesado' : targetUser.name}
                  className={`w-full h-full object-cover ${
                    isRevealLike ? 'blur-md scale-110 brightness-95' : ''
                  }`}
                />
                {isRevealLike && (
                  <div className="absolute inset-0 bg-white/25 flex items-center justify-center">
                    <Lock className="w-5 h-5 text-[#FF2E54] drop-shadow" />
                  </div>
                )}
              </div>
              {!isRevealLike && (
                <span className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-gradient-to-br from-[#FF2E54] to-amber-400 text-white border-2 border-white flex items-center justify-center shadow">
                  <MessageCircleHeart className="w-3 h-3" />
                </span>
              )}
            </div>

            <div className="min-w-0">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200/80 text-[#E11D48] text-[9.5px] font-black uppercase tracking-[0.12em]">
                {isRevealLike ? (
                  <>
                    <Heart className="w-2.5 h-2.5 fill-[#FF2E54] text-[#FF2E54]" />
                    Like Secreto
                  </>
                ) : (
                  <>
                    <Sparkles className="w-2.5 h-2.5 text-[#FF2E54]" />
                    Acceso Directo 1-a-1
                  </>
                )}
              </span>

              <h3 className="font-serif-display text-xl font-bold text-zinc-900 leading-tight mt-1 truncate flex items-center gap-1.5">
                <span className="truncate">
                  {isRevealLike
                    ? 'Descubre quién te dio Like'
                    : `Escribirle a ${firstName}${visibleAge ? `, ${visibleAge}` : ''}`}
                </span>
                {!isRevealLike && verified && (
                  <BadgeCheck className="w-4 h-4 text-sky-500 fill-sky-500 stroke-white shrink-0" />
                )}
              </h3>

              <p className="text-[11px] font-medium text-zinc-500 leading-snug mt-0.5 truncate">
                {isRevealLike
                  ? showAdOption && showDiamondOption
                    ? 'Elige desbloquear gratis con 1 anuncio o al instante con 💎'
                    : showAdOption
                    ? `Desbloquea gratis viendo 1 anuncio (${duration}s)`
                    : 'Desbloquea este perfil al instante con tus Diamantes'
                  : alreadyLikedMe
                  ? 'Ya te dio Like · Abre su chat privado sin esperar'
                  : `${targetUser.country?.flag || '🌎'} ${targetUser.city || targetUser.country?.name || 'Comunidad VIP'} · Aún sin Match mutuo`}
              </p>
            </div>
          </div>
        </div>

        {/* Opciones Claras de Alto Contraste */}
        <div className="p-5 space-y-3 bg-[#FAF7F9]">
          {showAdOption && (
            <div className="px-3.5 py-2.5 rounded-2xl bg-white border border-zinc-200/80 flex items-start gap-2.5 text-[11px] text-zinc-600 leading-relaxed shadow-card">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Al tocar <strong className="text-zinc-900">Ver 1 anuncio gratis</strong> se abrirá la página del patrocinador ({duration}s). Cuando veas{' '}
                <strong className="text-emerald-700">✅ ¡Listo!</strong> en la pestaña de la app, ya puedes cerrar el anuncio y entrar.
              </span>
            </div>
          )}

          {/* Opción 1: Gratis con 1 Anuncio */}
          {showAdOption && (
            <button
              type="button"
              onClick={handleChooseFreeAd}
              className="group w-full p-4 rounded-[24px] bg-white border-2 border-emerald-300 hover:border-emerald-500 text-left transition active:scale-[0.99] shadow-card"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-display text-sm font-black text-zinc-900">
                        {isRevealLike ? 'Revelar perfil gratis' : 'Ver 1 anuncio y chatear'}
                      </p>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9.5px] font-black uppercase">
                        $0 · {duration}s
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Abre el anuncio {duration}s en nueva pestaña sin gastar Diamantes
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-emerald-600 shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          )}

          {/* Opción 2: Con Diamantes 💎 al Instante */}
          {showDiamondOption && (
            <button
              type="button"
              disabled={busyCoins}
              onClick={onUnlockWithCoins}
              className="group w-full p-4 rounded-[24px] bg-white border border-sky-200 hover:border-sky-400 text-left transition active:scale-[0.99] disabled:opacity-50 shadow-card"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-400 via-indigo-400 to-[#FF2E54] text-white flex items-center justify-center shrink-0 shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform">
                    <Gem className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-display text-sm font-black text-zinc-900">
                      {busyCoins
                        ? 'Desbloqueando al instante...'
                        : showAdOption
                        ? 'Pase directo con Diamantes (Sin anuncios)'
                        : 'Desbloquear al instante'}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      {hasEnoughDiamonds
                        ? `Tu saldo: ${userCoins} 💎 · Entrada inmediata`
                        : `Tienes ${userCoins} 💎 · Toca para recargar ${resolvedDiamondCost} 💎`}
                    </p>
                  </div>
                </div>

                <span className="px-3 py-1.5 rounded-full bg-sky-50 border border-sky-200 text-sky-800 text-xs font-black shrink-0 tabular-nums">
                  {resolvedDiamondCost} 💎
                </span>
              </div>
            </button>
          )}

          {showDiamondOption && isRevealLike && lockedLikesCount >= 2 && onUnlockAllLikes && (
            <button
              type="button"
              disabled={busyCoins}
              onClick={onUnlockAllLikes}
              className="w-full py-3.5 px-4 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 text-white text-xs font-black hover:brightness-105 transition flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
            >
              <Gem className="w-3.5 h-3.5" />
              Revelar TODOS los {lockedLikesCount} Likes por {resolvedAllCost} 💎
            </button>
          )}

          {/* Opción 3: Suscripción Conoscamosnos PRO */}
          {onOpenPro && (
            <button
              type="button"
              onClick={() => {
                onClose?.();
                onOpenPro?.();
              }}
              className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-[#FF2E54] via-rose-500 to-amber-500 text-white text-left shadow-md hover:brightness-105 active:scale-[0.99] transition flex items-center justify-between gap-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Crown className="w-4 h-4 text-amber-200" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black truncate">
                    Hazte Conoscamosnos PRO · Todo Ilimitado
                  </p>
                  <p className="text-[10.5px] text-white/90 truncate">
                    Envía mensajes a cualquiera + mira quién dio Like a tus fotos sin anuncios
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
