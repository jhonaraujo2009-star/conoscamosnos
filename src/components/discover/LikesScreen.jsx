import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgeCheck,
  Camera,
  Crown,
  Flame,
  Gem,
  Heart,
  Lock,
  MapPin,
  MessageCircle,
  Play,
  Sparkles,
  Star,
  Tv,
  User,
  Zap,
} from 'lucide-react';
import { resolveAccessPolicy } from '../../config/constants';
import { useAuth } from '../../contexts/AuthContext';
import {
  recordAdRewardUnlock,
  unlockAllLikesWithDiamonds,
  unlockChatWithDiamonds,
  unlockLikeWithDiamonds,
} from '../../services/adRewardService';
import { sendLike } from '../../services/discoveryService';
import { getUserById, subscribePopularUsers } from '../../services/userService';
import {
  formatUserDistanceLabel,
  getDisplayAge,
  getPrimaryPhoto,
  getSpendableDiamonds,
  getSuperLikeQuota,
  isBoostActive,
  isProActive,
  isProfileVerified,
  toMillis,
  triggerHaptic,
} from '../../utils/formatters';
import RewardedAdModal from '../monetization/RewardedAdModal';
import UnlockChoiceModal from '../monetization/UnlockChoiceModal';
import ProCrownBadge from '../monetization/ProCrownBadge';

function HeartArrow3D() {
  return (
    <svg
      className="w-32 h-32 drop-shadow-[0_16px_24px_rgba(244,63,94,0.28)]"
      viewBox="0 0 140 140"
      fill="none"
    >
      <defs>
        <radialGradient id="heart3dGrad" cx="35%" cy="28%" r="72%">
          <stop offset="0%" stopColor="#FF8FA3" />
          <stop offset="45%" stopColor="#FF1E42" />
          <stop offset="100%" stopColor="#9E0020" />
        </radialGradient>
        <linearGradient id="arrowShaft" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
      </defs>

      <path d="M100 22L116 20L114 36L100 38Z" fill="#FB7185" />
      <line
        x1="82"
        y1="54"
        x2="115"
        y2="21"
        stroke="url(#arrowShaft)"
        strokeWidth="6"
        strokeLinecap="round"
      />

      <path
        d="M70 112C70 112 22 82 22 50C22 33 35.5 21 51 21C60.5 21 67 26.5 70 32.5C73 26.5 79.5 21 89 21C104.5 21 118 33 118 50C118 82 70 112 70 112Z"
        fill="url(#heart3dGrad)"
      />
      <ellipse
        cx="46"
        cy="42"
        rx="12"
        ry="7"
        transform="rotate(-25 46 42)"
        fill="white"
        fillOpacity="0.55"
      />

      <line
        x1="24"
        y1="112"
        x2="58"
        y2="78"
        stroke="url(#arrowShaft)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <polygon points="16,120 22,100 36,114" fill="url(#arrowShaft)" />
    </svg>
  );
}

function LikesSkeletonGrid() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-32 rounded-[26px] bg-zinc-200/80" />
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="aspect-[3/4] rounded-3xl bg-zinc-200/80" />
        ))}
      </div>
    </div>
  );
}

export default function LikesScreen({
  currentUser,
  receivedLikes = [],
  matches = [],
  userUnlocks = { revealedLikeIds: [], chatUnlockedUserIds: [] },
  onSelectProfile,
  onStartChat,
  onOpenChat,
  onOpenDiamondStore,
  onOpenPro,
  onGoToSwipe,
  onOpenBoost,
  onSuccess,
  onError,
}) {
  const { economyConfig } = useAuth();
  const policy = useMemo(() => resolveAccessPolicy(economyConfig), [economyConfig]);
  const proActive = isProActive(currentUser);
  const superLikeQuota = useMemo(() => getSuperLikeQuota(currentUser), [currentUser]);
  const myUid = currentUser?.uid || '';

  const [subTab, setSubTab] = useState('likes'); // 'likes' | 'top_picks'
  const [topPicks, setTopPicks] = useState([]);
  const [likerProfiles, setLikerProfiles] = useState([]);
  const [loadingLikers, setLoadingLikers] = useState(false);
  const [matchingUid, setMatchingUid] = useState(null);

  // Sheet de decisión: Ver Anuncio Gratis vs Diamantes vs PRO (exclusivo para Likes normales)
  const [choiceModal, setChoiceModal] = useState(null); // { mode: 'reveal_like' | 'unlock_chat', user }
  const [activeAd, setActiveAd] = useState(null); // { purpose: 'reveal_like' | 'unlock_chat', user, session }
  const [busyDiamondAction, setBusyDiamondAction] = useState(false);

  // Caché local de perfiles para evitar parpadeos en vivo y limpiar al cambiar usuario
  const profileCacheRef = useRef(new Map());
  useEffect(() => {
    profileCacheRef.current = new Map();
    setLikerProfiles([]);
  }, [myUid]);

  const blockedKey = (currentUser?.blockedUsers || []).join(',');

  // Aislamiento estricto con ===: solo Likes destinados explícitamente a myUid
  const scopedLikes = useMemo(() => {
    if (!myUid) return [];
    const blockedSet = new Set(currentUser?.blockedUsers || []);
    return receivedLikes.filter(
      (like) =>
        like?.toUserId === myUid &&
        typeof like?.fromUserId === 'string' &&
        like.fromUserId.length > 0 &&
        like.fromUserId !== myUid &&
        !blockedSet.has(like.fromUserId)
    );
  }, [receivedLikes, myUid, blockedKey]);

  const likeBySender = useMemo(() => {
    const map = {};
    scopedLikes.forEach((like) => {
      map[like.fromUserId] = like;
    });
    return map;
  }, [scopedLikes]);

  // Usuarios con quienes ya existe chat o match activo (nunca cobrar doble)
  const matchedPeerSet = useMemo(() => {
    const set = new Set();
    if (!myUid) return set;
    matches.forEach((m) => {
      const peerId = (m.participants || []).find((p) => p !== myUid);
      if (peerId) set.add(peerId);
    });
    return set;
  }, [matches, myUid]);

  useEffect(() => {
    if (!myUid) return undefined;
    const unsub = subscribePopularUsers(
      {
        scope: 'global',
        countryCode: currentUser?.country?.code,
        currentUserId: myUid,
        blockedUsers: currentUser?.blockedUsers || [],
      },
      (list) => setTopPicks(list.slice(0, 16)),
      () => {}
    );
    return () => unsub();
  }, [myUid, currentUser?.country?.code, blockedKey]);

  const likerIdsKey = useMemo(() => {
    return Array.from(new Set(scopedLikes.map((l) => l.fromUserId)))
      .sort()
      .join(',');
  }, [scopedLikes]);

  useEffect(() => {
    let cancelled = false;
    const fromIds = likerIdsKey ? likerIdsKey.split(',').filter(Boolean) : [];
    if (fromIds.length === 0 || !myUid) {
      setLikerProfiles([]);
      setLoadingLikers(false);
      return;
    }

    const cache = profileCacheRef.current;
    const cachedValid = fromIds
      .map((uid) => cache.get(uid))
      .filter(
        (u) => Boolean(u) && !(Array.isArray(u.blockedUsers) && u.blockedUsers.includes(myUid))
      );

    if (cachedValid.length > 0) {
      setLikerProfiles(cachedValid);
    } else {
      setLoadingLikers(true);
    }

    const missingIds = fromIds.filter((uid) => !cache.has(uid));
    const toFetch = missingIds.length > 0 ? missingIds : fromIds;

    Promise.all(
      toFetch.map((uid) =>
        getUserById(uid)
          .then((profile) => ({ uid, profile }))
          .catch(() => ({ uid, profile: null }))
      )
    ).then((entries) => {
      if (cancelled) return;
      entries.forEach(({ uid, profile }) => {
        if (profile) {
          cache.set(uid, profile);
        }
      });

      const resolved = fromIds
        .map((uid) => cache.get(uid))
        .filter(
          (u) =>
            Boolean(u) &&
            u.uid !== myUid &&
            !(Array.isArray(u.blockedUsers) && u.blockedUsers.includes(myUid))
        );

      setLikerProfiles(resolved);
      setLoadingLikers(false);
    });

    return () => {
      cancelled = true;
    };
  }, [likerIdsKey, myUid]);

  // Separar estrictamente Super Likes (SIEMPRE arriba y SIEMPRE visibles gratis) vs Likes normales
  const { superLikeItems, normalLikeItems } = useMemo(() => {
    const superItems = [];
    const normalItems = [];

    likerProfiles.forEach((user) => {
      const uid = user.uid || user.id;
      const likeDoc = likeBySender[uid] || null;
      if (!likeDoc || likeDoc.toUserId !== myUid) return;

      const entry = { user, uid, likeDoc };
      if (likeDoc.isSuperLike === true) {
        superItems.push(entry);
      } else {
        normalItems.push(entry);
      }
    });

    const getSuperSortMs = (doc) => Math.max(toMillis(doc?.superLikedAt), toMillis(doc?.createdAt));
    const getNormalSortMs = (doc) => toMillis(doc?.createdAt);

    superItems.sort((a, b) => getSuperSortMs(b.likeDoc) - getSuperSortMs(a.likeDoc));
    normalItems.sort((a, b) => getNormalSortMs(b.likeDoc) - getNormalSortMs(a.likeDoc));

    return { superLikeItems: superItems, normalLikeItems: normalItems };
  }, [likerProfiles, likeBySender, myUid]);

  // Likes normales desbloqueados (PRO, Modo Libre, Match existente o desbloqueo individual)
  const revealedNormalSet = useMemo(() => {
    const set = new Set(userUnlocks?.revealedLikeIds || []);
    matchedPeerSet.forEach((uid) => set.add(uid));
    if (policy.isFreeMode || proActive) {
      normalLikeItems.forEach(({ uid }) => {
        if (uid) set.add(uid);
      });
    }
    return set;
  }, [userUnlocks?.revealedLikeIds, matchedPeerSet, policy.isFreeMode, proActive, normalLikeItems]);

  const chatUnlockedSet = useMemo(() => {
    const set = new Set(userUnlocks?.chatUnlockedUserIds || []);
    matchedPeerSet.forEach((uid) => set.add(uid));
    if (policy.isFreeMode || proActive) {
      likerProfiles.forEach((u) => {
        const id = u.uid || u.id;
        if (id) set.add(id);
      });
    }
    return set;
  }, [userUnlocks?.chatUnlockedUserIds, matchedPeerSet, policy.isFreeMode, proActive, likerProfiles]);

  const totalLikesCount = superLikeItems.length + normalLikeItems.length;
  const lockedNormalItems = useMemo(
    () => normalLikeItems.filter(({ uid }) => !revealedNormalSet.has(uid)),
    [normalLikeItems, revealedNormalSet]
  );

  const userDiamonds = getSpendableDiamonds(currentUser);
  const unlockAllCost = Math.min(
    policy.unlockAllLikesDiamonds,
    lockedNormalItems.length * policy.unlockLikeDiamonds
  );

  const handleOpenSuperLikerProfile = (user) => {
    // Super Likes son SIEMPRE visibles sin requerir Conoscamosnos PRO
    onSelectProfile?.(user);
  };

  const handleNormalCardTap = (user) => {
    const uid = user.uid || user.id;
    if (policy.isFreeMode || proActive || revealedNormalSet.has(uid)) {
      onSelectProfile?.(user);
    } else {
      setChoiceModal({ mode: 'reveal_like', user });
    }
  };

  const handleMatchBack = async (e, user, { isSuper = false } = {}) => {
    e?.stopPropagation?.();
    const uid = user?.uid || user?.id;
    if (!uid || !myUid || matchingUid) return;

    if (matchedPeerSet.has(uid)) {
      onStartChat?.(user);
      return;
    }

    setMatchingUid(uid);
    triggerHaptic([14, 30, 18]);
    try {
      const res = await sendLike({
        currentUser,
        targetUser: user,
        isSuperLike: false,
      });

      if (res.matched) {
        onSuccess?.(
          isSuper
            ? `⭐💘 ¡Es un Super Match con ${user.name}! Ya pueden chatear.`
            : `💘 ¡Es un Match con ${user.name}! Ya pueden chatear.`
        );
        if (onOpenChat && res.matchId) {
          onOpenChat({
            match: {
              id: res.matchId,
              participants: [myUid, uid].sort(),
            },
            peerUser: user,
          });
        } else {
          onStartChat?.(user, { skipLikeChatGate: true });
        }
      } else {
        onSuccess?.(`❤️ ¡Match procesado con ${user.name}!`);
      }
    } catch (err) {
      onError?.(err.message || 'No se pudo completar el Match.');
    } finally {
      setMatchingUid(null);
    }
  };

  const handleChatFromLike = (e, user) => {
    e.stopPropagation();
    const uid = user.uid || user.id;
    if (policy.isFreeMode || proActive || chatUnlockedSet.has(uid) || user.requireGiftToChat) {
      onStartChat?.(user);
      return;
    }
    setChoiceModal({ mode: 'unlock_chat', user });
  };

  const handleUnlockSingleWithDiamonds = async (mode, user) => {
    if (!myUid || !user || busyDiamondAction || !policy.enableDiamondCharges) return;
    const targetUid = user.uid || user.id;
    const cost =
      mode === 'unlock_chat' ? policy.unlockChatDiamonds : policy.unlockLikeDiamonds;

    if (userDiamonds < cost) {
      setChoiceModal(null);
      setActiveAd(null);
      onError?.(
        policy.enableRewardedAds
          ? `Necesitas ${cost} 💎. Recarga Diamantes o mira 1 anuncio gratis.`
          : `Necesitas ${cost} 💎. Recarga Diamantes en la tienda para desbloquear.`
      );
      onOpenDiamondStore?.();
      return;
    }

    setBusyDiamondAction(true);
    try {
      if (mode === 'unlock_chat') {
        await unlockChatWithDiamonds({ uid: myUid, targetUid, costDiamonds: cost });
        setChoiceModal(null);
        setActiveAd(null);
        onSuccess?.(`✨ Chat desbloqueado con ${user.name} al instante.`);
        onStartChat?.(user, { skipLikeChatGate: true });
      } else {
        await unlockLikeWithDiamonds({ uid: myUid, targetUid, costDiamonds: cost });
        setChoiceModal(null);
        setActiveAd(null);
        onSuccess?.(`💘 ¡Descubriste que le gustas a ${user.name}!`);
      }
    } catch (err) {
      onError?.(err.message || 'No se pudo completar el desbloqueo.');
    } finally {
      setBusyDiamondAction(false);
    }
  };

  const handleUnlockAllLikesWithDiamonds = async () => {
    if (!myUid || lockedNormalItems.length === 0 || busyDiamondAction || !policy.enableDiamondCharges) {
      return;
    }
    const cost = unlockAllCost;
    if (userDiamonds < cost) {
      setChoiceModal(null);
      onError?.(`Necesitas ${cost} 💎 para revelar todos tus Likes normales de una vez.`);
      onOpenDiamondStore?.();
      return;
    }
    setBusyDiamondAction(true);
    try {
      const targetUids = lockedNormalItems.map(({ uid }) => uid);
      await unlockAllLikesWithDiamonds({ uid: myUid, targetUids, costDiamonds: cost });
      setChoiceModal(null);
      onSuccess?.(`✨ ¡Revelaste tus ${targetUids.length} Likes al instante!`);
    } catch (err) {
      onError?.(err.message || 'No se pudieron revelar tus Likes.');
    } finally {
      setBusyDiamondAction(false);
    }
  };

  const handleAdCompleted = async () => {
    if (!activeAd || !myUid) return;
    const { purpose, user } = activeAd;
    const targetUid = user.uid || user.id;
    try {
      await recordAdRewardUnlock({
        uid: myUid,
        purpose,
        targetUid,
        estimatedRevenueUSD: policy.estimatedRevenuePerAdUSD,
      });
      setActiveAd(null);
      if (purpose === 'unlock_chat') {
        onSuccess?.(`🎉 ¡Anuncio completado! Chat abierto gratis con ${user.name}.`);
        onStartChat?.(user, { skipLikeChatGate: true });
      } else {
        onSuccess?.(`💘 ¡Revelaste a ${user.name} gratis viendo el anuncio!`);
      }
    } catch (err) {
      onError?.(err.message || 'No se pudo aplicar la recompensa del anuncio.');
      setActiveAd(null);
    }
  };

  return (
    <div className="min-h-full bg-gradient-to-b from-[#FAF6F8] via-[#FAF7F9] to-[#F2EEF4] text-zinc-900 flex flex-col justify-between">
      {/* Cabecera Moderna + Cuota Semanal de Super Likes + Switcher */}
      <div className="bg-white/75 backdrop-blur-md border-b border-zinc-200/70 pt-safe sticky top-0 z-20">
        <div className="px-4 pt-3.5 pb-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="font-display text-3xl font-black tracking-tight text-zinc-900">
              Likes
            </h1>
            {proActive && <ProCrownBadge variant="compact" />}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (!proActive && onOpenPro) {
                  onOpenPro();
                } else {
                  onSuccess?.(
                    `⭐ Tienes ${superLikeQuota.remaining}/${superLikeQuota.limit} Super Likes disponibles esta semana.`
                  );
                }
              }}
              className={`px-2.5 py-1.5 rounded-full border text-[11px] font-extrabold inline-flex items-center gap-1 shadow-xs transition active:scale-95 tabular-nums ${
                superLikeQuota.remaining > 0
                  ? 'bg-gradient-to-r from-sky-50 to-amber-50 border-sky-200/90 text-sky-900'
                  : 'bg-zinc-100 border-zinc-200 text-zinc-600'
              }`}
              title={`Super Likes semanales: ${superLikeQuota.remaining}/${superLikeQuota.limit}`}
            >
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500 shrink-0" />
              <span>
                {superLikeQuota.remaining}/{superLikeQuota.limit} sem.
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenDiamondStore}
              className="px-2.5 py-1.5 rounded-full bg-white border border-sky-200/80 shadow-xs text-[11px] font-extrabold text-sky-800 inline-flex items-center gap-1 hover:bg-sky-50 transition tabular-nums"
            >
              <Gem className="w-3.5 h-3.5 text-sky-500" />
              <span>{userDiamonds} 💎</span>
            </button>
          </div>
        </div>

        {/* Selector segmentado estilo moderno */}
        <div className="px-4 pb-3">
          <div className="p-1 rounded-2xl bg-zinc-200/75 grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setSubTab('likes')}
              className={`py-2 px-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                subTab === 'likes'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <span>Te dieron Like</span>
              {superLikeItems.length > 0 ? (
                <span className="px-1.5 py-0.5 rounded-full bg-gradient-to-r from-sky-500 via-blue-500 to-amber-400 text-white text-[10px] font-black inline-flex items-center gap-0.5 shadow-xs">
                  <Star className="w-2.5 h-2.5 fill-amber-200 text-amber-200" />
                  {totalLikesCount}
                </span>
              ) : totalLikesCount > 0 ? (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-100 text-[#FF2E54] text-[10px] font-black">
                  {totalLikesCount}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => setSubTab('top_picks')}
              className={`py-2 px-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                subTab === 'top_picks'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Top Picks</span>
            </button>
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      {subTab === 'likes' ? (
        loadingLikers && totalLikesCount === 0 ? (
          <div className="flex-1 p-4">
            <LikesSkeletonGrid />
          </div>
        ) : totalLikesCount > 0 ? (
          <div className="flex-1 p-4 space-y-5">
            {/* ==================== SECCIÓN #1 PRIORITARIA: SUPER LIKES (SIEMPRE VISIBLES GRATIS) ==================== */}
            {superLikeItems.length > 0 && (
              <section className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 px-0.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-sky-400 via-blue-500 to-amber-400 text-white flex items-center justify-center shadow-sm shrink-0">
                      <Star className="w-3.5 h-3.5 fill-white text-white" />
                    </span>
                    <h2 className="font-display text-sm font-black uppercase tracking-wider text-zinc-900 truncate">
                      Super Likes ({superLikeItems.length})
                    </h2>
                  </div>

                  <span className="px-2.5 py-0.5 rounded-full bg-sky-100 border border-sky-200 text-sky-800 text-[10px] font-black uppercase tracking-wide shrink-0">
                    Visibles gratis
                  </span>
                </div>

                <div className="space-y-3">
                  {superLikeItems.map(({ user, uid, likeDoc }) => {
                    const verified = isProfileVerified(user);
                    const userIsPro = isProActive(user);
                    const visibleAge = getDisplayAge(user);
                    const distInfo = formatUserDistanceLabel(user, currentUser);
                    const alreadyMatched = matchedPeerSet.has(uid);
                    const likedPhotoIdx = Number(likeDoc?.likedPhotoIndex ?? 0);
                    const likedPhotoUrl = likeDoc?.likedPhotoUrl || '';
                    const isBusyMatch = matchingUid === uid;

                    return (
                      <div
                        key={`super-${uid}`}
                        onClick={() => handleOpenSuperLikerProfile(user)}
                        className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#0A1428] via-[#131F3F] to-[#1D122C] border border-sky-400/45 p-3 text-white shadow-[0_14px_32px_-8px_rgba(14,165,233,0.3)] cursor-pointer active:scale-[0.99] transition-transform"
                      >
                        {/* Halo sutil superior */}
                        <div className="pointer-events-none absolute -top-12 -right-12 w-36 h-36 rounded-full bg-sky-400/15 blur-2xl" />

                        <div className="relative flex items-stretch gap-3">
                          {/* Retrato nítido 100% visible */}
                          <div className="relative w-[92px] h-[118px] rounded-2xl overflow-hidden bg-zinc-800 shrink-0 ring-2 ring-amber-300/65 shadow-lg">
                            <img
                              src={getPrimaryPhoto(user, 360, { seed: myUid })}
                              alt={user.name}
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-gradient-to-br from-sky-400 to-amber-400 text-white flex items-center justify-center shadow">
                              <Star className="w-3.5 h-3.5 fill-white text-white" />
                            </span>
                            {likedPhotoUrl && (
                              <img
                                src={likedPhotoUrl}
                                alt={`Tu foto #${likedPhotoIdx + 1}`}
                                title={`Le encantó tu foto #${likedPhotoIdx + 1}`}
                                className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-lg object-cover border-2 border-white shadow-md"
                              />
                            )}
                          </div>

                          {/* Información + Acciones */}
                          <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/20 border border-sky-300/35 text-sky-200 text-[9.5px] font-black uppercase tracking-wider">
                                  <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                                  Te envió un Super Like
                                </span>
                                {userIsPro && <ProCrownBadge variant="compact" />}
                              </div>

                              <div className="flex items-center gap-1.5 min-w-0 pt-0.5">
                                <h3 className="font-display text-lg font-black text-white truncate leading-tight">
                                  {user.name}
                                  {visibleAge !== null ? `, ${visibleAge}` : ''}
                                </h3>
                                {verified && (
                                  <BadgeCheck className="w-4 h-4 text-sky-400 fill-sky-400 stroke-white shrink-0" />
                                )}
                              </div>

                              <p className="text-[11px] font-semibold text-sky-100/80 truncate flex items-center gap-1">
                                {!distInfo.isHidden && <span>{user.country?.flag || '🌎'}</span>}
                                <MapPin className="w-3 h-3 text-amber-300 shrink-0" />
                                <span className="truncate">{distInfo.text}</span>
                              </p>
                            </div>

                            {/* Botones de acción instantánea */}
                            <div className="grid grid-cols-2 gap-2 pt-2">
                              <button
                                type="button"
                                disabled={isBusyMatch}
                                onClick={(e) => handleMatchBack(e, user, { isSuper: true })}
                                className={`py-2 px-2.5 rounded-full text-[11px] font-black flex items-center justify-center gap-1 shadow-md active:scale-95 transition disabled:opacity-60 ${
                                  alreadyMatched
                                    ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                    : 'bg-gradient-to-r from-[#FF2E54] via-rose-500 to-amber-400 text-white hover:brightness-110'
                                }`}
                              >
                                {alreadyMatched ? (
                                  <>
                                    <MessageCircle className="w-3.5 h-3.5" />
                                    Ir al Chat
                                  </>
                                ) : (
                                  <>
                                    <Heart className="w-3.5 h-3.5 fill-white" />
                                    {isBusyMatch ? 'Conectando...' : 'Hacer Match'}
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenSuperLikerProfile(user);
                                }}
                                className="py-2 px-2.5 rounded-full bg-white/12 hover:bg-white/20 border border-white/20 text-white text-[11px] font-extrabold flex items-center justify-center gap-1 active:scale-95 transition"
                              >
                                <User className="w-3.5 h-3.5" />
                                Ver perfil
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ==================== SECCIÓN #2: LIKES NORMALES (REQUIERE PRO / ANUNCIO / 💎 PARA VER) ==================== */}
            {normalLikeItems.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2 px-0.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#FF2E54] to-rose-500 text-white flex items-center justify-center shadow-sm shrink-0">
                      <Heart className="w-3.5 h-3.5 fill-white text-white" />
                    </span>
                    <h2 className="font-display text-sm font-black uppercase tracking-wider text-zinc-900 truncate">
                      Likes ({normalLikeItems.length})
                    </h2>
                  </div>

                  {proActive || policy.isFreeMode ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-800 text-[10px] font-black uppercase tracking-wide shrink-0">
                      Desbloqueados
                    </span>
                  ) : lockedNormalItems.length > 0 ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-100 border border-rose-200 text-rose-700 text-[10px] font-black uppercase tracking-wide shrink-0">
                      {lockedNormalItems.length} ocultos
                    </span>
                  ) : null}
                </div>

                {/* Banner PRO compacto si aún hay Likes normales ocultos */}
                {!proActive && !policy.isFreeMode && lockedNormalItems.length > 0 && (
                  <div className="rounded-3xl p-4 bg-gradient-to-br from-[#190913] via-[#270B1C] to-[#120A14] border border-amber-300/25 text-white shadow-md space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/35 text-amber-200 text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1">
                        <Crown className="w-3 h-3" /> Conoscamosnos PRO
                      </span>
                      {policy.enableRewardedAds && (
                        <span className="text-[10px] font-bold text-emerald-300 inline-flex items-center gap-1">
                          <Tv className="w-3 h-3" /> O anuncio ({policy.adDurationSeconds}s)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-rose-100/85 leading-relaxed">
                      Mira quién te dio ❤️ normal sin censura y obtén{' '}
                      <strong className="text-amber-200">20 Super Likes semanales</strong> (2 en cuentas gratis).
                    </p>
                    {onOpenPro && (
                      <button
                        type="button"
                        onClick={onOpenPro}
                        className="w-full py-2.5 px-3 rounded-full bg-gradient-to-r from-[#FF2E54] to-amber-500 text-white text-[11px] font-black flex items-center justify-center gap-1.5 shadow hover:brightness-105 transition"
                      >
                        <Crown className="w-3.5 h-3.5" />
                        Activar PRO · Ver todos y 20 Super Likes/sem.
                      </button>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {normalLikeItems.map(({ user, uid, likeDoc }) => {
                    const isRevealed = revealedNormalSet.has(uid);
                    const alreadyMatched = matchedPeerSet.has(uid);
                    const isChatReady = chatUnlockedSet.has(uid);
                    const verified = isProfileVerified(user);
                    const userIsPro = isProActive(user);
                    const visibleAge = getDisplayAge(user);
                    const likedPhotoIdx = Number(likeDoc?.likedPhotoIndex ?? 0);
                    const likedPhotoUrl = likeDoc?.likedPhotoUrl || '';
                    const isBusyMatch = matchingUid === uid;

                    return (
                      <div
                        key={`like-${uid}`}
                        onClick={() => handleNormalCardTap(user)}
                        className="bg-white rounded-3xl overflow-hidden shadow-card cursor-pointer relative group border border-zinc-200/70"
                      >
                        <div className="aspect-[3/4] relative bg-zinc-200 overflow-hidden">
                          <img
                            src={getPrimaryPhoto(user, 450, { seed: myUid })}
                            alt={isRevealed ? user.name : 'Persona interesada'}
                            className={`w-full h-full object-cover transition duration-500 ${
                              isRevealed ? 'group-hover:scale-105' : 'blur-xl scale-110 brightness-90'
                            }`}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/15 to-transparent" />

                          {!isRevealed ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-between p-3 text-center text-white">
                              <span className="px-2.5 py-1 rounded-full bg-black/55 border border-white/15 text-[10px] font-extrabold backdrop-blur-sm inline-flex items-center gap-1">
                                <Camera className="w-3 h-3 text-rose-400" />
                                Tu foto #{likedPhotoIdx + 1}
                              </span>

                              <div className="space-y-1.5">
                                <div className="w-11 h-11 mx-auto rounded-2xl bg-gradient-to-br from-rose-500 via-[#FF2E54] to-amber-500 text-white flex items-center justify-center shadow-lg">
                                  <Lock className="w-5 h-5 stroke-[2.4]" />
                                </div>
                                <p className="text-xs font-black tracking-tight drop-shadow">
                                  Toca para revelar
                                </p>
                              </div>

                              <div className="w-full py-1.5 px-2 rounded-full bg-white/95 text-zinc-900 text-[10px] font-black flex items-center justify-center gap-1 shadow">
                                <Play className="w-3 h-3 fill-[#FF2E54] text-[#FF2E54]" />
                                {policy.enableRewardedAds && policy.enableDiamondCharges
                                  ? `Anuncio o ${policy.unlockLikeDiamonds} 💎`
                                  : policy.enableRewardedAds
                                  ? `Ver anuncio (${policy.adDurationSeconds}s)`
                                  : `Revelar ${policy.unlockLikeDiamonds} 💎`}
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between gap-1">
                                <span className="px-2 py-0.5 rounded-full bg-black/65 border border-white/15 text-white text-[9.5px] font-extrabold inline-flex items-center gap-1 backdrop-blur-sm">
                                  <Heart className="w-2.5 h-2.5 fill-[#FF2E54] text-[#FF2E54]" />
                                  Foto #{likedPhotoIdx + 1}
                                </span>

                                {likedPhotoUrl ? (
                                  <img
                                    src={likedPhotoUrl}
                                    alt={`Tu foto #${likedPhotoIdx + 1}`}
                                    title={`Le gustó tu foto #${likedPhotoIdx + 1}`}
                                    className="w-7 h-7 rounded-lg object-cover border-2 border-white shadow-md shrink-0"
                                  />
                                ) : user.requireGiftToChat ? (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-400/95 text-zinc-950 text-[9.5px] font-black inline-flex items-center gap-0.5 shadow">
                                    <Crown className="w-2.5 h-2.5" /> Regalo
                                  </span>
                                ) : null}
                              </div>

                              <div className="absolute bottom-2.5 inset-x-2.5 text-white">
                                <p className="text-sm font-extrabold truncate flex items-center gap-1">
                                  <span className="truncate">
                                    {user.name}
                                    {visibleAge !== null ? `, ${visibleAge}` : ''}
                                  </span>
                                  {verified && (
                                    <BadgeCheck className="w-4 h-4 text-sky-400 fill-sky-400 stroke-white shrink-0" />
                                  )}
                                  {userIsPro && (
                                    <Crown className="w-3.5 h-3.5 text-amber-300 fill-amber-300 shrink-0" />
                                  )}
                                </p>
                                <div className="mt-1.5 flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={isBusyMatch}
                                    onClick={(e) =>
                                      alreadyMatched
                                        ? handleChatFromLike(e, user)
                                        : handleMatchBack(e, user, { isSuper: false })
                                    }
                                    className={`flex-1 py-1.5 px-2 rounded-full text-[11px] font-extrabold flex items-center justify-center gap-1 shadow transition ${
                                      alreadyMatched || isChatReady
                                        ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                        : 'bg-gradient-to-r from-[#FF2E54] to-rose-500 text-white hover:brightness-105'
                                    }`}
                                  >
                                    {alreadyMatched ? (
                                      <>
                                        <MessageCircle className="w-3.5 h-3.5" /> Ir al Chat
                                      </>
                                    ) : (
                                      <>
                                        <Heart className="w-3.5 h-3.5 fill-white" />
                                        {isBusyMatch ? '...' : 'Hacer Match'}
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center px-8 text-center py-10">
            <HeartArrow3D />
            <h2 className="font-display text-lg font-black text-zinc-900 mt-3">
              Aún no tienes Likes pendientes
            </h2>
            <p className="text-xs font-medium text-zinc-500 mt-1.5 max-w-[270px] leading-relaxed">
              Los <strong className="text-sky-600">Super Likes</strong> que recibas aparecerán primero y{' '}
              <strong>siempre visibles gratis</strong> sin necesidad de PRO. Los Likes normales se revelan con{' '}
              {proActive || policy.isFreeMode ? 'tu membresía activa.' : 'PRO, 💎 o anuncios.'}
            </p>
          </div>
        )
      ) : (
        <div className="flex-1 p-4">
          {topPicks.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
              <Heart className="w-12 h-12 text-zinc-300 mb-2" />
              <p className="text-sm font-bold text-zinc-700">Hasta acá por los momentos</p>
              <p className="text-xs text-zinc-500 mt-1">Pronto aparecerán más Top Picks aquí.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {topPicks.map((user) => {
                const boosted = isBoostActive(user);
                const verified = isProfileVerified(user);
                const visibleAge = getDisplayAge(user);
                const distInfo = formatUserDistanceLabel(user, currentUser);
                const userIsPro = isProActive(user);
                return (
                  <div
                    key={user.uid || user.id}
                    onClick={() => onSelectProfile(user)}
                    className="bg-white rounded-3xl overflow-hidden shadow-card cursor-pointer border border-zinc-200/70"
                  >
                    <div className="aspect-[3/4] relative bg-zinc-200">
                      <img
                        src={getPrimaryPhoto(user, 450, { seed: myUid })}
                        alt={user.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                      {boosted && (
                        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-amber-400 text-black text-[10px] font-black flex items-center gap-0.5 shadow">
                          <Zap className="w-2.5 h-2.5 fill-black" /> TOP
                        </span>
                      )}
                      {userIsPro && (
                        <span className="absolute top-2.5 right-2.5">
                          <ProCrownBadge variant="compact" />
                        </span>
                      )}
                      <div className="absolute bottom-2.5 inset-x-3 text-white">
                        <p className="text-sm font-extrabold truncate flex items-center gap-1">
                          <span className="truncate">
                            {user.name}
                            {visibleAge !== null ? `, ${visibleAge}` : ''}
                          </span>
                          {verified && (
                            <BadgeCheck className="w-4 h-4 text-sky-400 fill-sky-400 stroke-white shrink-0" />
                          )}
                        </p>
                        <p className="text-[11px] text-white/80 truncate">
                          {!distInfo.isHidden ? `${user.country?.flag || '🌎'} ` : '🔒 '}
                          {distInfo.text}
                        </p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onStartChat?.(user);
                          }}
                          className="mt-1.5 w-full py-1.5 rounded-full bg-white/95 text-zinc-900 text-[11px] font-extrabold flex items-center justify-center gap-1 shadow hover:bg-white transition"
                        >
                          <MessageCircle className="w-3 h-3" /> Chatear
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Barra de acción inferior */}
      <div className="p-4 pt-2 bg-transparent space-y-2">
        {subTab === 'likes' &&
        !policy.isFreeMode &&
        !proActive &&
        lockedNormalItems.length >= 2 &&
        (policy.enableRewardedAds || policy.enableDiamondCharges) ? (
          <div
            className={`grid gap-2.5 ${
              policy.enableRewardedAds && policy.enableDiamondCharges ? 'grid-cols-2' : 'grid-cols-1'
            }`}
          >
            {policy.enableRewardedAds && (
              <button
                type="button"
                onClick={() =>
                  setChoiceModal({ mode: 'reveal_like', user: lockedNormalItems[0].user })
                }
                className="bg-zinc-900 text-white rounded-full py-3.5 px-3 text-xs font-extrabold shadow-md flex items-center justify-center gap-1.5 active:scale-[0.99] transition-transform"
              >
                <Play className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                Ver 1 con Anuncio
              </button>
            )}
            {policy.enableDiamondCharges && (
              <button
                type="button"
                disabled={busyDiamondAction}
                onClick={handleUnlockAllLikesWithDiamonds}
                className="bg-gradient-to-r from-sky-500 to-indigo-500 text-white rounded-full py-3.5 px-3 text-xs font-extrabold shadow-md flex items-center justify-center gap-1.5 active:scale-[0.99] transition-transform disabled:opacity-50"
              >
                <Gem className="w-3.5 h-3.5" />
                Ver Todos ({unlockAllCost} 💎)
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onGoToSwipe?.()}
              className="bg-zinc-900 text-white rounded-full py-3.5 text-xs sm:text-sm font-extrabold shadow-md flex items-center justify-center gap-1.5 active:scale-[0.99] transition-transform"
            >
              <Flame className="w-4 h-4 text-[#FF2E54] fill-[#FF2E54]" />
              Ir a Descubrir
            </button>
            <button
              type="button"
              onClick={() => onOpenBoost?.()}
              className="bg-white border border-purple-200 text-purple-700 rounded-full py-3.5 text-xs sm:text-sm font-extrabold shadow-sm flex items-center justify-center gap-1.5 active:scale-[0.99] transition-transform"
            >
              <Zap className="w-4 h-4 fill-purple-600 text-purple-600" />
              Activar Boost
            </button>
          </div>
        )}
      </div>

      {/* Modal de Elección Luxury según política global del Admin */}
      <UnlockChoiceModal
        isOpen={Boolean(choiceModal)}
        mode={choiceModal?.mode || 'reveal_like'}
        targetUser={choiceModal?.user}
        alreadyLikedMe
        userDiamonds={userDiamonds}
        diamondCost={
          choiceModal?.mode === 'unlock_chat'
            ? policy.unlockChatDiamonds
            : policy.unlockLikeDiamonds
        }
        busyDiamonds={busyDiamondAction}
        lockedLikesCount={lockedNormalItems.length}
        unlockAllCost={unlockAllCost}
        onClose={() => setChoiceModal(null)}
        onWatchAd={(adSession) => {
          const target = choiceModal;
          setChoiceModal(null);
          setActiveAd({ purpose: target.mode, user: target.user, session: adSession || null });
        }}
        onUnlockWithDiamonds={() =>
          handleUnlockSingleWithDiamonds(choiceModal.mode, choiceModal.user)
        }
        onUnlockAllLikes={handleUnlockAllLikesWithDiamonds}
        onOpenPro={onOpenPro}
      />

      {/* Reproductor de Anuncio Recompensado */}
      <RewardedAdModal
        isOpen={Boolean(activeAd)}
        purpose={activeAd?.purpose || 'reveal_like'}
        targetName={activeAd?.user?.name || 'esta persona'}
        targetUser={activeAd?.user}
        adSession={activeAd?.session || null}
        diamondCost={
          activeAd?.purpose === 'unlock_chat'
            ? policy.unlockChatDiamonds
            : policy.unlockLikeDiamonds
        }
        onClose={() => setActiveAd(null)}
        onRewardEarned={handleAdCompleted}
        onUseDiamondsInstead={() => {
          if (!activeAd) return;
          handleUnlockSingleWithDiamonds(activeAd.purpose, activeAd.user);
        }}
      />
    </div>
  );
}
