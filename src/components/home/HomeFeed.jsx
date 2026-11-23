import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  ChevronRight,
  Crown,
  Flame,
  Heart,
  MessageCircle,
  Sparkles,
  User,
  Users,
  Zap,
} from 'lucide-react';
import { sendLike } from '../../services/discoveryService';
import { subscribePopularUsers } from '../../services/userService';
import {
  isIncomingPendingPaidRequest,
  isOutgoingPendingPaidRequest,
  isRejectedPaidRequest,
} from '../../utils/chatHelpers';
import {
  formatUserDistanceLabel,
  getDailyLikeQuota,
  getDisplayAge,
  getPrimaryPhoto,
  isBoostActive,
  isProActive,
  isProfileVerified,
  isUserActuallyOnline,
  triggerHaptic,
} from '../../utils/formatters';
import { TinderMatchOverlay, TinderMatchRibbon } from '../discover/TinderMatchBanner';
import ProCrownBadge from '../monetization/ProCrownBadge';

/* Ilustraciones 3D brillantes en SVG de alta precisión */
function LollipopHeart3D() {
  return (
    <svg className="w-24 h-24 drop-shadow-[0_12px_16px_rgba(244,63,94,0.28)]" viewBox="0 0 120 120" fill="none">
      <defs>
        <radialGradient id="lollipopGrad" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FF758F" />
          <stop offset="45%" stopColor="#FF1E42" />
          <stop offset="100%" stopColor="#9E0020" />
        </radialGradient>
        <linearGradient id="stickGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#CBD5E1" />
        </linearGradient>
      </defs>
      <rect x="56" y="68" width="8" height="44" rx="4" transform="rotate(-18 60 90)" fill="url(#stickGrad)" />
      <path
        d="M60 86C60 86 20 62 20 37C20 23.5 31 14 44 14C52 14 57.5 18.5 60 23.5C62.5 18.5 68 14 76 14C89 14 100 23.5 100 37C100 62 60 86 60 86Z"
        fill="url(#lollipopGrad)"
      />
      <ellipse cx="40" cy="30" rx="10" ry="6" transform="rotate(-25 40 30)" fill="white" fillOpacity="0.55" />
      <circle cx="33" cy="40" r="2.5" fill="white" fillOpacity="0.4" />
    </svg>
  );
}

function TulipFlower3D() {
  return (
    <svg className="w-24 h-24 drop-shadow-[0_12px_16px_rgba(239,68,68,0.26)]" viewBox="0 0 120 120" fill="none">
      <defs>
        <linearGradient id="stemGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4ADE80" />
          <stop offset="100%" stopColor="#15803D" />
        </linearGradient>
        <radialGradient id="petalCenter" cx="40%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FF8FA3" />
          <stop offset="50%" stopColor="#F43F5E" />
          <stop offset="100%" stopColor="#9F1239" />
        </radialGradient>
        <radialGradient id="petalSide" cx="30%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#FB7185" />
          <stop offset="60%" stopColor="#E11D48" />
          <stop offset="100%" stopColor="#881337" />
        </radialGradient>
      </defs>
      <rect x="56" y="60" width="8" height="48" rx="4" fill="url(#stemGrad)" />
      <path d="M60 98C60 98 88 90 92 66C76 68 64 80 60 98Z" fill="url(#stemGrad)" />
      <path d="M60 102C60 102 32 92 28 70C44 72 56 84 60 102Z" fill="url(#stemGrad)" />
      <path d="M60 14C45 26 42 52 60 68C78 52 75 26 60 14Z" fill="url(#petalCenter)" />
      <path d="M36 22C30 42 38 64 60 68C50 50 48 34 36 22Z" fill="url(#petalSide)" />
      <path d="M84 22C90 42 82 64 60 68C70 50 72 34 84 22Z" fill="url(#petalSide)" />
      <ellipse cx="55" cy="34" rx="4" ry="10" transform="rotate(-10 55 34)" fill="white" fillOpacity="0.45" />
    </svg>
  );
}

function DiamondRing3D() {
  return (
    <svg className="w-24 h-24 drop-shadow-[0_12px_16px_rgba(236,72,153,0.28)]" viewBox="0 0 120 120" fill="none">
      <defs>
        <linearGradient id="ringBand" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
        <linearGradient id="pinkGem" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FBCFE8" />
          <stop offset="45%" stopColor="#EC4899" />
          <stop offset="100%" stopColor="#9D174D" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="72" r="30" stroke="url(#ringBand)" strokeWidth="11" />
      <circle cx="60" cy="72" r="30" stroke="white" strokeOpacity="0.35" strokeWidth="3" />
      <polygon points="44,24 76,24 88,38 60,62 32,38" fill="url(#pinkGem)" />
      <polygon points="44,24 76,24 68,38 52,38" fill="#FCE7F3" fillOpacity="0.7" />
      <polygon points="52,38 68,38 60,62" fill="#F472B6" fillOpacity="0.65" />
    </svg>
  );
}

function BlueMoonStar3D() {
  return (
    <svg className="w-24 h-24 drop-shadow-[0_12px_16px_rgba(59,130,246,0.3)]" viewBox="0 0 120 120" fill="none">
      <defs>
        <radialGradient id="moonGrad" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#93C5FD" />
          <stop offset="50%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </radialGradient>
        <radialGradient id="starGrad" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="60%" stopColor="#FACC15" />
          <stop offset="100%" stopColor="#CA8A04" />
        </radialGradient>
      </defs>
      <path
        d="M72 20C50 22 32 40 32 63C32 87 52 104 76 102C86 101 94 96 100 90C82 92 66 78 66 58C66 41 76 27 90 22C84 20 78 19.5 72 20Z"
        fill="url(#moonGrad)"
      />
      <ellipse cx="46" cy="48" rx="5" ry="12" transform="rotate(20 46 48)" fill="white" fillOpacity="0.4" />
      <path
        d="M84 34L88.5 43L98.5 44.5L91 51.5L93 61.5L84 56.5L75 61.5L77 51.5L69.5 44.5L79.5 43L84 34Z"
        fill="url(#starGrad)"
      />
    </svg>
  );
}

const TOP_PICKS_CATEGORY = {
  id: 'top_picks',
  title: 'Top Picks',
  swipeValue: 'Todos',
  isTopPicks: true,
};

const EXPLORE_CARDS = [
  {
    id: 'nada_serio',
    title: 'Nada serio',
    swipeValue: 'Nada serio',
    matchValues: ['Nada serio'],
    cardGlow: 'bg-gradient-to-b from-white via-white to-fuchsia-50/60 hover:border-fuchsia-200',
    Illustration: LollipopHeart3D,
  },
  {
    id: 'pareja_estable',
    title: 'Pareja estable',
    swipeValue: 'Pareja estable',
    matchValues: ['Pareja estable', 'Citas'],
    cardGlow: 'bg-gradient-to-b from-white via-white to-rose-50/70 hover:border-rose-200',
    Illustration: TulipFlower3D,
  },
  {
    id: 'compromiso_serio',
    title: 'Compromiso serio',
    swipeValue: 'Compromiso serio',
    matchValues: ['Compromiso serio'],
    cardGlow: 'bg-gradient-to-b from-white via-white to-pink-50/70 hover:border-pink-200',
    Illustration: DiamondRing3D,
  },
  {
    id: 'libre_hoy',
    title: 'Estoy libre hoy',
    swipeValue: 'Estoy libre hoy',
    matchValues: ['Estoy libre hoy'],
    cardGlow: 'bg-gradient-to-b from-white via-white to-indigo-50/70 hover:border-indigo-200',
    Illustration: BlueMoonStar3D,
  },
];

const EXTRA_CATEGORIES = [
  { id: 'hacer_amigos', title: 'Hacer Amigos', emoji: '🤝', swipeValue: 'Hacer Amigos', matchValues: ['Hacer Amigos'] },
  { id: 'idiomas', title: 'Chatear / Idiomas', emoji: '🗣️', swipeValue: 'Chatear / Idiomas', matchValues: ['Chatear / Idiomas'] },
  { id: 'todos', title: 'Ver todos', emoji: '✨', swipeValue: 'Todos', matchValues: null },
];

export default function HomeFeed({
  currentUser,
  matches = [],
  onSelectProfile,
  onStartChat,
  onOpenChat,
  onOpenPro,
  onSwipeCategory,
  onSuccess,
  onError,
}) {
  const [users, setUsers] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [likedIds, setLikedIds] = useState({});
  const [localMatchedIds, setLocalMatchedIds] = useState({});
  const [busyLikeUid, setBusyLikeUid] = useState(null);
  const [matchBannerEvent, setMatchBannerEvent] = useState(null);

  const myUid = currentUser?.uid || '';
  const blockedKey = (currentUser?.blockedUsers || []).join(',');
  const dailyLikeQuota = useMemo(() => getDailyLikeQuota(currentUser), [currentUser]);

  useEffect(() => {
    if (!myUid) return undefined;
    const unsub = subscribePopularUsers(
      {
        scope: 'global',
        countryCode: currentUser?.country?.code,
        currentUserId: myUid,
        blockedUsers: currentUser?.blockedUsers || [],
      },
      setUsers,
      () => {}
    );
    return () => unsub();
  }, [myUid, currentUser?.country?.code, blockedKey]);

  const matchedPeerSet = useMemo(() => {
    const set = new Set();
    if (!myUid) return set;
    matches.forEach((m) => {
      if (isRejectedPaidRequest(m)) return;
      if (isIncomingPendingPaidRequest(m, myUid) || isOutgoingPendingPaidRequest(m, myUid)) return;
      const peerId = (m.participants || []).find((p) => p !== myUid);
      if (peerId) set.add(peerId);
    });
    Object.keys(localMatchedIds).forEach((uid) => {
      if (localMatchedIds[uid]) set.add(uid);
    });
    return set;
  }, [matches, myUid, localMatchedIds]);

  const topPicks = useMemo(() => users.slice(0, 16), [users]);

  const categoryMatchesUser = (category, user) => {
    if (category?.isTopPicks) return true;
    if (!category?.matchValues) return true;
    const userGoal = (user.lookingFor || '').trim();
    return category.matchValues.includes(userGoal);
  };

  // Contadores reales dinámicos por categoría
  const countsByCategoryId = useMemo(() => {
    const map = {};
    [...EXPLORE_CARDS, ...EXTRA_CATEGORIES].forEach((cat) => {
      map[cat.id] = users.filter((u) => categoryMatchesUser(cat, u)).length;
    });
    return map;
  }, [users]);

  const categoryUsers = useMemo(() => {
    if (!selectedCategory) return [];
    if (selectedCategory.isTopPicks) return topPicks;
    return users.filter((u) => categoryMatchesUser(selectedCategory, u));
  }, [users, topPicks, selectedCategory]);

  const handleQuickLike = async (e, targetUser) => {
    e.stopPropagation();
    const uid = targetUser?.uid || targetUser?.id;
    if (!uid || busyLikeUid) return;

    if (matchedPeerSet.has(uid)) {
      onStartChat?.(targetUser, { skipLikeChatGate: true });
      return;
    }
    if (likedIds[uid]) return;

    if (dailyLikeQuota.remaining <= 0) {
      triggerHaptic([20, 40, 20]);
      onError?.(
        dailyLikeQuota.isPro
          ? '❤️ Alcanzaste tus 100 corazones diarios PRO. Se renuevan mañana.'
          : '❤️ Alcanzaste tu límite de 25 corazones al día. Activa Conoscamosnos PRO para tener 100 corazones diarios.'
      );
      if (!dailyLikeQuota.isPro) {
        onOpenPro?.();
      }
      return;
    }

    setBusyLikeUid(uid);
    triggerHaptic(14);
    try {
      const res = await sendLike({ currentUser, targetUser });
      setLikedIds((prev) => ({ ...prev, [uid]: true }));
      if (res.matched) {
        triggerHaptic([18, 40, 24]);
        setLocalMatchedIds((prev) => ({ ...prev, [uid]: true }));
        setMatchBannerEvent({
          targetUser,
          matchId: res.matchId,
          isSuperLike: Boolean(res.isSuperLike),
        });
      } else {
        const rem = res.likeQuota?.remaining ?? Math.max(0, dailyLikeQuota.remaining - 1);
        onSuccess?.(`❤️ Corazón enviado a ${targetUser.name} (${rem}/${dailyLikeQuota.limit} disponibles hoy)`);
      }
    } catch (err) {
      onError?.(err.message || 'No se pudo enviar el corazón.');
      if (err.code === 'DAILY_LIKE_LIMIT_REACHED' && !dailyLikeQuota.isPro) {
        onOpenPro?.();
      }
    } finally {
      setBusyLikeUid(null);
    }
  };

  const renderProfileGridCard = (u) => {
    const uid = u.uid || u.id;
    const verified = isProfileVerified(u);
    const boosted = isBoostActive(u);
    const userIsPro = isProActive(u);
    const online = isUserActuallyOnline(u);
    const isMatched = matchedPeerSet.has(uid);
    const liked = Boolean(likedIds[uid]) || isMatched;
    const visibleAge = getDisplayAge(u);
    const distInfo = formatUserDistanceLabel(u, currentUser);

    return (
      <div
        key={uid}
        onClick={() => onSelectProfile(u)}
        className={`bg-white rounded-[26px] overflow-hidden flex flex-col cursor-pointer border transition-all active:scale-[0.99] ${
          isMatched
            ? 'border-rose-300 shadow-[0_12px_28px_-10px_rgba(255,46,84,0.28)] ring-1 ring-rose-300/60'
            : 'border-[#EFE4E0] shadow-card hover:shadow-md'
        }`}
      >
        <div className="aspect-[3/4] relative bg-zinc-200 overflow-hidden">
          <img
            src={getPrimaryPhoto(u, 500, { seed: myUid })}
            alt={u.name}
            loading="lazy"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

          {/* Badges superiores */}
          <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between gap-1.5">
            {boosted ? (
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-zinc-950 text-[9.5px] font-black inline-flex items-center gap-0.5 shadow">
                <Zap className="w-2.5 h-2.5 fill-zinc-950" /> TOP
              </span>
            ) : online ? (
              <span className="px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-sm border border-white/15 text-white text-[9.5px] font-bold inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                En línea
              </span>
            ) : (
              <span />
            )}
            {userIsPro && <ProCrownBadge variant="compact" />}
          </div>

          {/* Franja estilo Tinder PRO cuando han hecho Match */}
          {isMatched && (
            <div className="absolute inset-x-0 top-10 z-10">
              <TinderMatchRibbon variant="card" />
            </div>
          )}

          <div className="absolute bottom-2.5 inset-x-3 text-white">
            <p className="text-sm font-black truncate flex items-center gap-1">
              <span className="truncate">
                {u.name}
                {visibleAge !== null ? `, ${visibleAge}` : ''}
              </span>
              {verified && (
                <BadgeCheck className="w-4 h-4 text-sky-400 fill-sky-400 stroke-white shrink-0" />
              )}
            </p>
            <p className="text-[11px] text-white/85 truncate">
              {!distInfo.isHidden ? `${u.country?.flag || '🌎'} ` : '🔒 '}
              {distInfo.text}
            </p>
          </div>
        </div>

        <div className="p-2 grid grid-cols-2 gap-1.5 bg-white">
          <button
            type="button"
            disabled={busyLikeUid === uid}
            onClick={(e) => handleQuickLike(e, u)}
            className={`py-2 rounded-full text-[11px] font-black flex items-center justify-center gap-1 transition active:scale-95 ${
              isMatched
                ? 'bg-gradient-to-r from-[#FF1744] to-amber-500 text-white shadow-sm'
                : liked
                ? 'bg-rose-50 border border-rose-200 text-[#FF2E54]'
                : 'bg-[#FAF2F0] hover:bg-rose-50 text-[#1D1317] hover:text-[#FF2E54]'
            }`}
          >
            <Heart
              className={`w-3.5 h-3.5 ${
                isMatched ? 'fill-white text-white' : liked ? 'fill-[#FF2E54] text-[#FF2E54]' : ''
              }`}
            />
            {isMatched ? 'Match' : liked ? 'Enviado' : 'Corazón'}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStartChat?.(u);
            }}
            className="py-2 rounded-full bg-[#160F13] hover:bg-[#271B22] text-white text-[11px] font-black flex items-center justify-center gap-1 transition active:scale-95"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Chat
          </button>
        </div>
      </div>
    );
  };

  if (selectedCategory) {
    return (
      <div className="min-h-full bg-gradient-to-b from-[#FBF7F9] via-[#FAF7F9] to-[#F4F1F5] text-zinc-900 p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 pt-safe">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className="w-10 h-10 rounded-full bg-white shadow-sm border border-[#EFE4E0] flex items-center justify-center text-zinc-800 shrink-0 active:scale-95 transition-transform"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="font-display text-xl font-black text-zinc-900 truncate">
                  {selectedCategory.title}
                </h2>
                {selectedCategory.isTopPicks && (
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                )}
              </div>
              <p className="text-xs font-semibold text-zinc-500">
                {categoryUsers.length}{' '}
                {selectedCategory.isTopPicks
                  ? 'perfiles destacados para ti hoy'
                  : categoryUsers.length === 1
                  ? 'persona buscando lo mismo'
                  : 'personas buscando lo mismo'}
              </p>
            </div>
          </div>

          {onSwipeCategory && (
            <button
              type="button"
              onClick={() => onSwipeCategory(selectedCategory.swipeValue || 'Todos')}
              className="shrink-0 px-3.5 py-2 rounded-full bg-gradient-to-r from-[#FF2E54] to-rose-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform"
            >
              <Flame className="w-3.5 h-3.5 fill-white" />
              Ir a Descubrir
            </button>
          )}
        </div>

        {categoryUsers.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center shadow-sm space-y-3 mt-4 border border-[#EFE4E0]">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-zinc-100 text-zinc-500 flex items-center justify-center">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <p className="text-base font-extrabold text-zinc-900">
                Hasta acá por los momentos
              </p>
              <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto leading-relaxed">
                Aún no hay otras personas disponibles en <strong>“{selectedCategory.title}”</strong>. ¡Prueba otra sección o vuelve más tarde!
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className="px-5 py-2.5 rounded-full bg-zinc-900 text-white text-xs font-extrabold active:scale-95 transition-transform"
            >
              Volver a Explorar
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 pb-4">
            {categoryUsers.map((u) => renderProfileGridCard(u))}
          </div>
        )}

        <TinderMatchOverlay
          matchEvent={matchBannerEvent}
          currentUser={currentUser}
          onClose={() => setMatchBannerEvent(null)}
          onOpenChat={onOpenChat}
          onStartChat={onStartChat}
          onError={onError}
        />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-[#FBF7F9] via-[#FAF7F9] to-[#F4F1F5] text-zinc-900 flex flex-col">
      {/* Cabecera limpia editorial con cuota diaria de corazones */}
      <header className="px-4 pt-4 pb-2 pt-safe flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-black tracking-tight text-zinc-900">
            Explorar
          </h1>
          <p className="text-xs sm:text-sm font-medium text-zinc-500 mt-0.5 leading-snug">
            Top Picks del día y personas con tu misma intención
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!dailyLikeQuota.isPro && onOpenPro) {
              onOpenPro();
            } else {
              onSuccess?.(
                `❤️ Tienes ${dailyLikeQuota.remaining}/${dailyLikeQuota.limit} corazones disponibles hoy.`
              );
            }
          }}
          className="mt-1 px-2.5 py-1.5 rounded-full bg-white border border-rose-200/80 text-[#E62E5C] text-[11px] font-extrabold shadow-sm shrink-0 inline-flex items-center gap-1 tabular-nums active:scale-95 transition"
          title={`Corazones diarios: ${dailyLikeQuota.remaining}/${dailyLikeQuota.limit}`}
        >
          <Heart className="w-3.5 h-3.5 fill-[#FF2E54] text-[#FF2E54]" />
          <span>
            {dailyLikeQuota.remaining}/{dailyLikeQuota.limit}
          </span>
        </button>
      </header>

      {/* ==================== 1. TOP PICKS DE PRIMERO (SELECCIÓN DESTACADA) ==================== */}
      <section className="px-4 pt-2 pb-1 space-y-2.5">
        <div className="rounded-[28px] p-4 bg-gradient-to-br from-[#FFF8F1] via-white to-[#FFF0F5] border border-amber-200/80 shadow-[0_14px_34px_-14px_rgba(255,46,84,0.14)] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#FF2E54] via-rose-500 to-amber-400 text-white flex items-center justify-center shadow-sm shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="font-display text-sm sm:text-base font-black text-[#1D1317] truncate">
                    Top Picks
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100/90 border border-amber-300/70 text-amber-900 text-[9.5px] font-black uppercase tracking-wider shrink-0">
                    Destacados
                  </span>
                </div>
                <p className="text-[11px] font-medium text-[#75646B] truncate">
                  Los perfiles más populares y activos para ti hoy
                </p>
              </div>
            </div>

            {topPicks.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedCategory(TOP_PICKS_CATEGORY)}
                className="px-3 py-1.5 rounded-full bg-[#160F13] hover:bg-[#271B22] text-white text-[11px] font-extrabold inline-flex items-center gap-1 shrink-0 shadow-sm active:scale-95 transition"
              >
                <span>Ver todos</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {topPicks.length === 0 ? (
            <div className="py-6 text-center text-xs font-semibold text-zinc-500">
              Cargando los perfiles Top Picks más destacados...
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
              {topPicks.slice(0, 10).map((u) => {
                const uid = u.uid || u.id;
                const boosted = isBoostActive(u);
                const verified = isProfileVerified(u);
                const userIsPro = isProActive(u);
                const online = isUserActuallyOnline(u);
                const visibleAge = getDisplayAge(u);
                const distInfo = formatUserDistanceLabel(u, currentUser);
                const isMatched = matchedPeerSet.has(uid);
                const liked = Boolean(likedIds[uid]) || isMatched;

                return (
                  <div
                    key={`top-pick-${uid}`}
                    onClick={() => onSelectProfile(u)}
                    className={`w-[162px] sm:w-[174px] shrink-0 rounded-[24px] overflow-hidden bg-white border flex flex-col cursor-pointer transition-all active:scale-[0.98] ${
                      isMatched
                        ? 'border-rose-300 shadow-[0_12px_26px_-10px_rgba(255,46,84,0.32)] ring-1 ring-rose-300/60'
                        : 'border-[#EFE2DE] shadow-sm hover:shadow-md'
                    }`}
                  >
                    <div className="aspect-[3/3.8] relative bg-zinc-200 overflow-hidden">
                      <img
                        src={getPrimaryPhoto(u, 450, { seed: myUid })}
                        alt={u.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

                      <div className="absolute top-2 inset-x-2 flex items-center justify-between gap-1">
                        {boosted ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-400 text-zinc-950 text-[9px] font-black inline-flex items-center gap-0.5 shadow">
                            <Zap className="w-2.5 h-2.5 fill-zinc-950" /> TOP
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-sm border border-white/20 text-amber-200 text-[9px] font-black inline-flex items-center gap-1">
                            <Crown className="w-2.5 h-2.5 text-amber-300" /> PICK
                          </span>
                        )}

                        {userIsPro ? (
                          <ProCrownBadge variant="compact" />
                        ) : online ? (
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-white shadow" />
                        ) : null}
                      </div>

                      {isMatched && (
                        <div className="absolute inset-x-0 top-9 z-10">
                          <TinderMatchRibbon variant="card" />
                        </div>
                      )}

                      <div className="absolute bottom-2 inset-x-2.5 text-white">
                        <p className="text-[13px] font-black truncate flex items-center gap-1">
                          <span className="truncate">
                            {u.name}
                            {visibleAge !== null ? `, ${visibleAge}` : ''}
                          </span>
                          {verified && (
                            <BadgeCheck className="w-3.5 h-3.5 text-sky-400 fill-sky-400 stroke-white shrink-0" />
                          )}
                        </p>
                        <p className="text-[10.5px] text-white/80 truncate">
                          {!distInfo.isHidden ? `${u.country?.flag || '🌎'} ` : '🔒 '}
                          {distInfo.shortText || distInfo.text}
                        </p>
                      </div>
                    </div>

                    <div className="p-2 grid grid-cols-2 gap-1.5 bg-white">
                      <button
                        type="button"
                        disabled={busyLikeUid === uid}
                        onClick={(e) => handleQuickLike(e, u)}
                        className={`py-1.5 rounded-full text-[10.5px] font-black flex items-center justify-center gap-1 transition active:scale-95 ${
                          isMatched
                            ? 'bg-gradient-to-r from-[#FF1744] to-amber-500 text-white shadow-sm'
                            : liked
                            ? 'bg-rose-50 border border-rose-200 text-[#FF2E54]'
                            : 'bg-[#FAF2F0] hover:bg-rose-50 text-[#1D1317] hover:text-[#FF2E54]'
                        }`}
                      >
                        <Heart
                          className={`w-3 h-3 ${
                            isMatched
                              ? 'fill-white text-white'
                              : liked
                              ? 'fill-[#FF2E54] text-[#FF2E54]'
                              : ''
                          }`}
                        />
                        {isMatched ? 'Match' : liked ? 'Listo' : 'Like'}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartChat?.(u);
                        }}
                        className="py-1.5 rounded-full bg-[#160F13] hover:bg-[#271B22] text-white text-[10.5px] font-black flex items-center justify-center gap-1 transition active:scale-95"
                      >
                        <MessageCircle className="w-3 h-3" />
                        Chat
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ==================== 2. INTENCIONES DE RELACIÓN (GRID 2 COLUMNAS) ==================== */}
      <div className="grid grid-cols-2 gap-3 p-4">
        {EXPLORE_CARDS.map((card) => {
          const Illustration = card.Illustration;
          const realCount = countsByCategoryId[card.id] || 0;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => setSelectedCategory(card)}
              className={`rounded-2xl p-4 border border-white/80 shadow-sm hover:shadow-md flex flex-col justify-between aspect-[3/4] text-left active:scale-[0.98] transition-all ${
                card.cardGlow || 'bg-white'
              }`}
            >
              <div className="w-full flex justify-end">
                {currentUser?.lookingFor === card.title && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-50 text-[#FF2E54] text-[10px] font-extrabold">
                    Tu objetivo
                  </span>
                )}
              </div>

              <div className="flex items-center justify-center my-auto">
                <Illustration />
              </div>

              <div className="w-full flex items-end justify-between gap-2 pt-2">
                <span className="text-sm font-extrabold text-zinc-900 leading-tight">
                  {card.title}
                </span>
                <span className="text-xs font-bold text-zinc-500 flex items-center gap-0.5 shrink-0">
                  <User className="w-3 h-3 fill-zinc-400 text-zinc-400" />
                  {realCount}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Categorías adicionales dinámicas (Amistad, Idiomas, Ver todos) */}
      <div className="px-4 pb-6 space-y-2">
        <p className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 px-1 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-zinc-400" /> Más comunidades
        </p>
        <div className="grid grid-cols-3 gap-2">
          {EXTRA_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className="bg-white rounded-2xl p-3 shadow-sm text-left hover:bg-zinc-50 active:scale-[0.98] transition"
            >
              <span className="text-lg block">{cat.emoji}</span>
              <p className="text-xs font-extrabold text-zinc-900 mt-1 truncate">{cat.title}</p>
              <p className="text-[11px] font-bold text-zinc-400 mt-0.5">
                {countsByCategoryId[cat.id] || 0} perfiles
              </p>
            </button>
          ))}
        </div>
      </div>

      <TinderMatchOverlay
        matchEvent={matchBannerEvent}
        currentUser={currentUser}
        onClose={() => setMatchBannerEvent(null)}
        onOpenChat={onOpenChat}
        onStartChat={onStartChat}
        onError={onError}
      />
    </div>
  );
}
