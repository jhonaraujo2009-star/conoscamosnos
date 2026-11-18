import {
  ArrowRight,
  BadgeCheck,
  Coins,
  Crown,
  Heart,
  Lock,
  MessageCircleHeart,
  Play,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { AD_REWARD_CONFIG } from '../../config/constants';
import { triggerMonetagZoneTag } from '../../services/monetagLoader';
import { getDisplayAge, getPrimaryPhoto, isProfileVerified } from '../../utils/formatters';

/**
 * Hoja modal unificada Obsidian Velvet & Champagne para elegir entre:
 * 1) Ver 1 anuncio gratuito (~8s)
 * 2) Desbloquear al instante con monedas
 */
export default function UnlockChoiceModal({
  isOpen,
  mode = 'unlock_chat', // 'unlock_chat' | 'reveal_like'
  targetUser,
  alreadyLikedMe = false,
  userCoins = 0,
  coinCost = AD_REWARD_CONFIG.unlockLikeChatCoins,
  busyCoins = false,
  lockedLikesCount = 0,
  unlockAllCost = 0,
  onClose,
  onWatchAd,
  onUnlockWithCoins,
  onUnlockAllLikes,
}) {
  if (!isOpen || !targetUser) return null;

  const verified = isProfileVerified(targetUser);
  const visibleAge = getDisplayAge(targetUser);
  const firstName = (targetUser.name || 'este perfil').split(' ')[0];
  const isRevealLike = mode === 'reveal_like';
  const duration = AD_REWARD_CONFIG.adDurationSeconds;
  const hasEnoughCoins = Number(userCoins) >= Number(coinCost);

  const handleChooseFreeAd = () => {
    if (AD_REWARD_CONFIG.provider === 'monetag') {
      triggerMonetagZoneTag();
    }
    onWatchAd?.();
  };

  return (
    <div
      className="fixed inset-0 z-[72] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#0E0913] text-white border border-amber-300/20 rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-[0_28px_90px_rgba(0,0,0,0.8)] animate-sheet-up"
      >
        {/* Cabecera Editorial con Retrato */}
        <div className="relative px-5 pt-5 pb-5 bg-gradient-to-br from-[#1D0A16] via-[#280D1F] to-[#110915] border-b border-white/10">
          <div className="pointer-events-none absolute -right-10 -top-10 w-36 h-36 rounded-full bg-amber-400/15 blur-3xl" />
          <div className="pointer-events-none absolute -left-8 -bottom-8 w-32 h-32 rounded-full bg-[#FF2E54]/20 blur-3xl" />

          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-zinc-200 hover:text-white flex items-center justify-center transition"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="relative flex items-center gap-3.5 pr-9">
            <div className="relative shrink-0 p-[2px] rounded-[22px] bg-gradient-to-br from-amber-300 via-[#FF2E54] to-rose-500 shadow-lg shadow-[#FF2E54]/25">
              <div className="w-16 h-16 rounded-[20px] overflow-hidden bg-zinc-900 relative">
                <img
                  src={getPrimaryPhoto(targetUser, 220)}
                  alt={isRevealLike ? 'Perfil interesado' : targetUser.name}
                  className={`w-full h-full object-cover ${
                    isRevealLike ? 'blur-md scale-110 brightness-90' : ''
                  }`}
                />
                {isRevealLike && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <Lock className="w-5 h-5 text-amber-300 drop-shadow" />
                  </div>
                )}
              </div>
              {!isRevealLike && (
                <span className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-gradient-to-br from-[#FF2E54] to-amber-400 text-white border-2 border-[#160A13] flex items-center justify-center shadow">
                  <MessageCircleHeart className="w-3 h-3" />
                </span>
              )}
            </div>

            <div className="min-w-0">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400/15 border border-amber-300/30 text-amber-200 text-[9.5px] font-black uppercase tracking-[0.14em]">
                {isRevealLike ? (
                  <>
                    <Heart className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                    Like Secreto
                  </>
                ) : (
                  <>
                    <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                    Acceso Directo 1-a-1
                  </>
                )}
              </span>

              <h3 className="font-serif-display text-xl font-bold text-white leading-tight mt-1 truncate flex items-center gap-1.5">
                <span className="truncate">
                  {isRevealLike
                    ? 'Descubre quién te dio Like'
                    : `Escribirle a ${firstName}${visibleAge ? `, ${visibleAge}` : ''}`}
                </span>
                {!isRevealLike && verified && (
                  <BadgeCheck className="w-4 h-4 text-sky-400 fill-sky-400 stroke-[#1A0B15] shrink-0" />
                )}
              </h3>

              <p className="text-[11px] text-rose-100/75 leading-snug mt-0.5 truncate">
                {isRevealLike
                  ? 'Elige desbloquear gratis con 1 anuncio o al instante'
                  : alreadyLikedMe
                  ? `Ya te dio Like · Abre su chat privado sin esperar`
                  : `${targetUser.country?.flag || '🌎'} ${targetUser.city || targetUser.country?.name || 'Comunidad VIP'} · Aún sin Match mutuo`}
              </p>
            </div>
          </div>
        </div>

        {/* Cuerpo de Opciones */}
        <div className="p-5 space-y-3 bg-[#0E0913]">
          {/* Aviso transparente sobre el funcionamiento del anuncio */}
          <div className="px-3.5 py-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-start gap-2.5 text-[11px] text-zinc-300 leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Al elegir <strong className="text-white">Ver 1 anuncio gratis</strong> correrá un contador de{' '}
              <strong className="text-emerald-300">{duration} segundos</strong>. Te avisaremos aquí y en el título de la pestaña en cuanto puedas cerrar el anuncio y entrar.
            </span>
          </div>

          {/* Opción 1: Gratis con 1 Anuncio */}
          <button
            type="button"
            onClick={handleChooseFreeAd}
            className="group w-full p-4 rounded-[24px] bg-gradient-to-br from-[#0F261E] via-[#122922] to-[#0D1A19] border border-emerald-400/35 hover:border-emerald-300/65 text-left transition active:scale-[0.99] shadow-lg shadow-emerald-950/40"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-300 via-emerald-400 to-teal-500 text-zinc-950 flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/25 group-hover:scale-105 transition-transform">
                  <Play className="w-5 h-5 fill-zinc-950 ml-0.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-display text-sm font-black text-white">
                      {isRevealLike ? 'Revelar perfil gratis' : 'Ver 1 anuncio y chatear'}
                    </p>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-300/35 text-emerald-200 text-[9.5px] font-black uppercase">
                      $0 · {duration}s
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-100/75 mt-0.5">
                    Abre el patrocinador {duration}s y desbloquea sin gastar monedas
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-emerald-300 shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>

          {/* Opción 2: Con Monedas al Instante */}
          <button
            type="button"
            disabled={busyCoins}
            onClick={onUnlockWithCoins}
            className="group w-full p-4 rounded-[24px] bg-gradient-to-br from-[#1C111C] via-[#18101C] to-[#1D1510] border border-amber-300/30 hover:border-amber-300/60 text-left transition active:scale-[0.99] disabled:opacity-50"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-300 via-amber-400 to-[#FF2E54] text-zinc-950 flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
                  <Coins className="w-5 h-5 stroke-[2.3]" />
                </div>
                <div className="min-w-0">
                  <p className="font-display text-sm font-black text-white">
                    {busyCoins
                      ? 'Desbloqueando al instante...'
                      : 'Pase directo (Sin anuncios)'}
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {hasEnoughCoins
                      ? `Tu saldo: ${userCoins} 🪙 · Entrada inmediata`
                      : `Tienes ${userCoins} 🪙 · Toca para recargar ${coinCost} 🪙`}
                  </p>
                </div>
              </div>

              <span className="px-3 py-1.5 rounded-full bg-amber-400/15 border border-amber-300/35 text-amber-200 text-xs font-black shrink-0 tabular-nums">
                {coinCost} 🪙
              </span>
            </div>
          </button>

          {/* Opción 3: Revelar todos los Likes si hay varios */}
          {isRevealLike && lockedLikesCount >= 2 && onUnlockAllLikes && (
            <button
              type="button"
              disabled={busyCoins}
              onClick={onUnlockAllLikes}
              className="w-full py-3 px-4 rounded-full bg-white text-zinc-950 text-xs font-black hover:bg-amber-50 transition flex items-center justify-center gap-1.5 shadow-lg disabled:opacity-50"
            >
              <Crown className="w-3.5 h-3.5 text-[#FF2E54]" />
              Revelar TODOS los {lockedLikesCount} Likes por {unlockAllCost} 🪙
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
