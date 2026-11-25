import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgeCheck,
  Camera,
  Crown,
  Eye,
  EyeOff,
  Flame,
  Gem,
  Heart,
  Loader2,
  Lock,
  MapPin,
  MessageCircle,
  Play,
  Sparkles,
  Star,
  Trash2,
  Tv,
  User,
  UserX,
  X,
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
import { setMatchHiddenForUser, unmatchUser } from '../../services/chatService';
import { sendLike } from '../../services/discoveryService';
import { getUserById } from '../../services/userService';
import {
  isIncomingPendingPaidRequest,
  isMatchHiddenForUser,
  isOutgoingPendingPaidRequest,
  isRejectedPaidRequest,
} from '../../utils/chatHelpers';
import {
  formatUserDistanceLabel,
  getDailyLikeQuota,
  getDisplayAge,
  getPrimaryPhoto,
  getSpendableDiamonds,
  getSuperLikeQuota,
  isBoostActive,
  isProActive,
  isProfileVerified,
  isUserActuallyOnline,
  toMillis,
  triggerHaptic,
} from '../../utils/formatters';
import RewardedAdModal from '../monetization/RewardedAdModal';
import UnlockChoiceModal from '../monetization/UnlockChoiceModal';
import ProCrownBadge from '../monetization/ProCrownBadge';
import { TinderMatchOverlay, TinderMatchRibbon } from './TinderMatchBanner';

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
  const dailyLikeQuota = useMemo(() => getDailyLikeQuota(currentUser), [currentUser]);
  const myUid = currentUser?.uid || '';

  const [subTab, setSubTab] = useState('likes'); // 'likes' | 'matches'
  const [likerProfiles, setLikerProfiles] = useState([]);
  const [matchPeerProfiles, setMatchPeerProfiles] = useState({});
  const [loadingLikers, setLoadingLikers] = useState(false);
  const [matchingUid, setMatchingUid] = useState(null);
  const [matchBannerEvent, setMatchBannerEvent] = useState(null);

  // Sheet de decisión: Ver Anuncio Gratis vs Diamantes vs PRO (exclusivo para Likes normales)
  const [choiceModal, setChoiceModal] = useState(null); // { mode: 'reveal_like' | 'unlock_chat', user }
  const [activeAd, setActiveAd] = useState(null); // { purpose: 'reveal_like' | 'unlock_chat', user, session }
  const [busyDiamondAction, setBusyDiamondAction] = useState(false);

  // Gestión de Mis Matches: ocultar/mostrar localmente y eliminar Match mutuo
  const [showHiddenMatches, setShowHiddenMatches] = useState(false);
  const [unmatchTarget, setUnmatchTarget] = useState(null); // { match, peerId, user }
  const [busyUnmatch, setBusyUnmatch] = useState(false);
  const [togglingHideId, setTogglingHideId] = useState(null);

  // Caché local de perfiles para evitar parpadeos en vivo y limpiar al cambiar usuario
  const profileCacheRef = useRef(new Map());
  useEffect(() => {
    profileCacheRef.current = new Map();
    setLikerProfiles([]);
    setMatchPeerProfiles({});
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

  // Emparejamientos activos (excluyendo solicitudes pagadas pendientes o rechazadas sin match)
  const activeMatchesList = useMemo(() => {
    if (!myUid) return [];
    const blockedSet = new Set(currentUser?.blockedUsers || []);
    return matches.filter((m) => {
      if (!Array.isArray(m.participants) || m.participants.length !== 2) return false;
      if (!m.participants.includes(myUid)) return false;
      if (isRejectedPaidRequest(m)) return false;
      if (isIncomingPendingPaidRequest(m, myUid) || isOutgoingPendingPaidRequest(m, myUid)) {
        return false;
      }
      const peerId = m.participants.find((p) => p !== myUid);
      return Boolean(peerId && !blockedSet.has(peerId));
    });
  }, [matches, myUid, blockedKey]);

  // Usuarios con quienes ya existe emparejamiento activo
  const matchedPeerSet = useMemo(() => {
    const set = new Set();
    activeMatchesList.forEach((m) => {
      const peerId = (m.participants || []).find((p) => p !== myUid);
      if (peerId) set.add(peerId);
    });
    return set;
  }, [activeMatchesList, myUid]);

  const matchPeerIdsKey = useMemo(() => {
    const ids = activeMatchesList
      .map((m) => (m.participants || []).find((p) => p !== myUid))
      .filter(Boolean);
    return Array.from(new Set(ids)).sort().join(',');
  }, [activeMatchesList, myUid]);

  useEffect(() => {
    let cancelled = false;
    const peerIds = matchPeerIdsKey ? matchPeerIdsKey.split(',').filter(Boolean) : [];
    if (peerIds.length === 0 || !myUid) {
      setMatchPeerProfiles({});
      return undefined;
    }
    const cache = profileCacheRef.current;
    const missing = peerIds.filter((uid) => !cache.has(uid));

    const buildResolvedMap = () => {
      const next = {};
      peerIds.forEach((uid) => {
        const cached = cache.get(uid);
        if (cached && !(Array.isArray(cached.blockedUsers) && cached.blockedUsers.includes(myUid))) {
          next[uid] = cached;
        }
      });
      setMatchPeerProfiles(next);
    };

    buildResolvedMap();

    if (missing.length > 0) {
      Promise.all(
        missing.map((uid) =>
          getUserById(uid)
            .then((profile) => ({ uid, profile }))
            .catch(() => ({ uid, profile: null }))
        )
      ).then((entries) => {
        if (cancelled) return;
        entries.forEach(({ uid, profile }) => {
          if (profile) cache.set(uid, profile);
        });
        buildResolvedMap();
      });
    }

    return () => {
      cancelled = true;
    };
  }, [matchPeerIdsKey, myUid]);

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

  // Lista enriquecida de "Mis Matches / Emparejamientos"
  const matchedItems = useMemo(() => {
    return activeMatchesList.map((match) => {
      const peerId = (match.participants || []).find((p) => p !== myUid);
      const cachedSnap = match.participantProfiles?.[peerId];
      const livePeer =
        matchPeerProfiles[peerId] ||
        profileCacheRef.current.get(peerId) || {
          uid: peerId,
          id: peerId,
          name: cachedSnap?.name || 'Usuario',
          photos: cachedSnap?.photo ? [cachedSnap.photo] : [],
          country: cachedSnap?.country || null,
        };
      const incomingLikeDoc = likeBySender[peerId] || null;
      return {
        match,
        peerId,
        user: livePeer,
        isSuperMatch: Boolean(incomingLikeDoc?.isSuperLike),
        isHidden: isMatchHiddenForUser(match, myUid),
      };
    });
  }, [activeMatchesList, myUid, matchPeerProfiles, likeBySender]);

  const visibleMatches = useMemo(() => matchedItems.filter((item) => !item.isHidden), [matchedItems]);
  const hiddenMatches = useMemo(() => matchedItems.filter((item) => item.isHidden), [matchedItems]);
  const displayedMatches = showHiddenMatches ? hiddenMatches : visibleMatches;

  const handleToggleHideMatch = async (e, matchItem) => {
    e?.stopPropagation?.();
    if (!matchItem?.match?.id || !myUid || togglingHideId) return;
    const nextHidden = !matchItem.isHidden;
    setTogglingHideId(matchItem.match.id);
    try {
      await setMatchHiddenForUser(matchItem.match.id, myUid, nextHidden);
      triggerHaptic('light');
      onSuccess?.(
        nextHidden
          ? `Match con ${matchItem.user?.name || 'usuario'} ocultado de tu vista principal.`
          : `Match con ${matchItem.user?.name || 'usuario'} visible nuevamente.`
      );
    } catch (err) {
      onError?.(err?.message || 'No se pudo actualizar la visibilidad del Match.');
    } finally {
      setTogglingHideId(null);
    }
  };

  const handleConfirmUnmatch = async () => {
    if (!unmatchTarget?.peerId || busyUnmatch) return;
    setBusyUnmatch(true);
    try {
      await unmatchUser(unmatchTarget.peerId);
      triggerHaptic('medium');
      onSuccess?.(
        `Se eliminó el Match con ${unmatchTarget.user?.name || 'esta persona'} para ambos.`
      );
      setUnmatchTarget(null);
    } catch (err) {
      onError?.(err?.message || 'No se pudo eliminar el Match.');
    } finally {
      setBusyUnmatch(false);
    }
  };

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
      onStartChat?.(user, { skipLikeChatGate: true });
      return;
    }

    if (dailyLikeQuota.remaining <= 0) {
      triggerHaptic([20, 40, 20]);
      onError?.(
        dailyLikeQuota.isPro
          ? '❤️ Alcanzaste tus 100 corazones diarios PRO. Se renuevan mañana.'
          : '❤️ Alcanzaste tu límite de 25 corazones al día. Activa Conoscamosnos PRO para disfrutar 100 corazones diarios.'
      );
      if (!dailyLikeQuota.isPro) {
        onOpenPro?.();
      }
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
        triggerHaptic([18, 40, 24]);
        setMatchBannerEvent({
          targetUser: user,
          matchId: res.matchId,
          isSuperLike: isSuper,
        });
      } else {
        onSuccess?.(`❤️ ¡Corazón enviado a ${user.name}!`);
      }
    } catch (err) {
      onError?.(err.message || 'No se pudo completar el Match.');
      if (err.code === 'DAILY_LIKE_LIMIT_REACHED' && !dailyLikeQuota.isPro) {
        onOpenPro?.();
      }
    } finally {
      setMatchingUid(null);
    }
  };

  const handleChatFromLike = (e, user) => {
    e.stopPropagation();
    const uid = user.uid || user.id;
    if (
      policy.isFreeMode ||
      proActive ||
      chatUnlockedSet.has(uid) ||
      user.requireGiftToChat ||
      user.allowPaidMessages
    ) {
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
      {/* Cabecera Moderna + Cuota Diaria de Corazones + Super Likes + Switcher */}
      <div className="bg-white/80 backdrop-blur-md border-b border-zinc-200/70 pt-safe sticky top-0 z-20">
        <div className="px-4 pt-3.5 pb-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="font-display text-3xl font-black tracking-tight text-zinc-900">
              Likes
            </h1>
            {proActive && <ProCrownBadge variant="compact" />}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Cuota diaria de corazones (25 gratis / 100 PRO) */}
            <button
              type="button"
              onClick={() => {
                if (!proActive && onOpenPro) {
                  onOpenPro();
                } else {
                  onSuccess?.(
                    `❤️ Tienes ${dailyLikeQuota.remaining}/${dailyLikeQuota.limit} corazones disponibles hoy.`
                  );
                }
              }}
              className={`px-2.5 py-1.5 rounded-full border text-[11px] font-extrabold inline-flex items-center gap-1 shadow-sm transition active:scale-95 tabular-nums ${
                dailyLikeQuota.remaining > 0
                  ? 'bg-gradient-to-r from-rose-50 to-amber-50 border-rose-200/90 text-[#E62E5C]'
                  : 'bg-zinc-100 border-zinc-200 text-zinc-600'
              }`}
              title={`Corazones diarios: ${dailyLikeQuota.remaining}/${dailyLikeQuota.limit}`}
            >
              <Heart className="w-3.5 h-3.5 fill-[#FF2E54] text-[#FF2E54] shrink-0" />
              <span>
                {dailyLikeQuota.remaining}/{dailyLikeQuota.limit}
              </span>
            </button>

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
              className={`px-2.5 py-1.5 rounded-full border text-[11px] font-extrabold inline-flex items-center gap-1 shadow-sm transition active:scale-95 tabular-nums ${
                superLikeQuota.remaining > 0
                  ? 'bg-gradient-to-r from-sky-50 to-amber-50 border-sky-200/90 text-sky-900'
                  : 'bg-zinc-100 border-zinc-200 text-zinc-600'
              }`}
              title={`Super Likes semanales: ${superLikeQuota.remaining}/${superLikeQuota.limit}`}
            >
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500 shrink-0" />
              <span>
                {superLikeQuota.remaining}/{superLikeQuota.limit}
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenDiamondStore}
              className="px-2.5 py-1.5 rounded-full bg-white border border-sky-200/80 shadow-sm text-[11px] font-extrabold text-sky-800 inline-flex items-center gap-1 hover:bg-sky-50 transition tabular-nums"
            >
              <Gem className="w-3.5 h-3.5 text-sky-500" />
              <span>{userDiamonds} 💎</span>
            </button>
          </div>
        </div>

        {/* Selector segmentado: Te dieron Like vs Mis Matches (Emparejamientos) */}
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
                <span className="px-1.5 py-0.5 rounded-full bg-gradient-to-r from-sky-500 via-blue-500 to-amber-400 text-white text-[10px] font-black inline-flex items-center gap-0.5 shadow-sm">
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
              onClick={() => setSubTab('matches')}
              className={`py-2 px-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                subTab === 'matches'
                  ? 'bg-gradient-to-r from-[#1D0A14] via-[#2F0D20] to-[#1D0A14] text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <Flame
                className={`w-3.5 h-3.5 ${
                  subTab === 'matches' ? 'text-amber-300 fill-amber-300' : 'text-[#FF2E54]'
                }`}
              />
              <span>Mis Matches</span>
              {visibleMatches.length > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-black tabular-nums ${
                    subTab === 'matches'
                      ? 'bg-gradient-to-r from-[#FF2E54] to-amber-500 text-white'
                      : 'bg-rose-100 text-[#FF2E54]'
                  }`}
                >
                  {visibleMatches.length}
                </span>
              )}
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
                        className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#0A1428] via-[#131F3F] to-[#1D122C] border border-sky-400/45 p-3 text-white shadow-[0_14px_32px_-8px_rgba(14,165,233,0.3)] cursor-pointer active:scale-[0.99] transition-transform space-y-2.5"
                      >
                        <div className="pointer-events-none absolute -top-12 -right-12 w-36 h-36 rounded-full bg-sky-400/15 blur-2xl" />

                        {alreadyMatched && (
                          <TinderMatchRibbon isSuperMatch variant="wide" />
                        )}

                        <div className="relative flex items-stretch gap-3">
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

                            <div className="grid grid-cols-2 gap-2 pt-2">
                              <button
                                type="button"
                                disabled={isBusyMatch}
                                onClick={(e) => handleMatchBack(e, user, { isSuper: true })}
                                className={`py-2 px-2.5 rounded-full text-[11px] font-black flex items-center justify-center gap-1 shadow-md active:scale-95 transition disabled:opacity-60 ${
                                  alreadyMatched
                                    ? 'bg-gradient-to-r from-[#FF1744] via-[#FF2E63] to-amber-500 text-white'
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
                                className="py-2 px-2.5 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 text-white text-[11px] font-extrabold flex items-center justify-center gap-1 active:scale-95 transition"
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

            {/* ==================== SECCIÓN #2: LIKES NORMALES ==================== */}
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
                      Mira quién te dio ❤️ sin censura y disfruta{' '}
                      <strong className="text-amber-200">100 corazones al día</strong> (25 en cuentas gratis) +{' '}
                      <strong className="text-amber-200">20 Super Likes semanales</strong>.
                    </p>
                    {onOpenPro && (
                      <button
                        type="button"
                        onClick={onOpenPro}
                        className="w-full py-2.5 px-3 rounded-full bg-gradient-to-r from-[#FF2E54] to-amber-500 text-white text-[11px] font-black flex items-center justify-center gap-1.5 shadow hover:brightness-105 transition"
                      >
                        <Crown className="w-3.5 h-3.5" />
                        Activar PRO · 100 ❤️/día + Ver todos tus Likes
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
                        className={`bg-white rounded-3xl overflow-hidden cursor-pointer relative group border transition-all ${
                          alreadyMatched
                            ? 'border-rose-300 shadow-[0_12px_28px_-10px_rgba(255,46,84,0.3)] ring-1 ring-rose-300/60'
                            : 'border-zinc-200/70 shadow-card'
                        }`}
                      >
                        <div className="aspect-[3/4] relative bg-zinc-200 overflow-hidden">
                          <img
                            src={getPrimaryPhoto(user, 450, { seed: myUid })}
                            alt={isRevealed ? user.name : 'Persona interesada'}
                            className={`w-full h-full object-cover transition duration-500 ${
                              isRevealed ? 'group-hover:scale-105' : 'blur-xl scale-110 brightness-90'
                            }`}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-transparent" />

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

                              {/* Franja estilo Tinder PRO cuando han hecho Match */}
                              {alreadyMatched && (
                                <div className="absolute inset-x-0 top-11 z-10">
                                  <TinderMatchRibbon variant="card" />
                                </div>
                              )}

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
                                      alreadyMatched
                                        ? 'bg-gradient-to-r from-[#FF1744] via-[#FF2E63] to-amber-500 text-white hover:brightness-110'
                                        : isChatReady
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
        /* ==================== PESTAÑA #2: MIS MATCHES / EMPAREJAMIENTOS ==================== */
        <div className="flex-1 p-4 space-y-4">
          {/* Banner superior luxury de Emparejamientos */}
          <div className="relative overflow-hidden rounded-[28px] p-4 bg-gradient-to-br from-[#1B0711] via-[#2F0B1E] to-[#13060E] border border-rose-400/35 text-white shadow-[0_14px_34px_-12px_rgba(255,46,84,0.35)]">
            <div className="pointer-events-none absolute -top-10 -right-10 w-36 h-36 rounded-full bg-rose-500/20 blur-2xl" />
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#FF1744] via-[#FF2E63] to-amber-500 text-white flex items-center justify-center shadow-lg shrink-0">
                  <Flame className="w-5 h-5 fill-white" />
                </div>
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-300">
                    <Sparkles className="w-3 h-3" /> Emparejamientos Mutuos
                  </span>
                  <h2 className="font-display text-base sm:text-lg font-black text-white truncate">
                    {showHiddenMatches
                      ? `Matches ocultos (${hiddenMatches.length})`
                      : `Mis Matches (${visibleMatches.length})`}
                  </h2>
                  <p className="text-[11px] text-rose-100/80 truncate">
                    {showHiddenMatches
                      ? 'Ocultos solo para ti · Puedes mostrarlos cuando quieras'
                      : 'Se dieron corazón mutuamente · Chatea, oculta o elimina'}
                  </p>
                </div>
              </div>

              {(hiddenMatches.length > 0 || showHiddenMatches) && (
                <button
                  type="button"
                  onClick={() => setShowHiddenMatches((prev) => !prev)}
                  className="shrink-0 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 text-[11px] font-bold text-white flex items-center gap-1.5 transition"
                >
                  {showHiddenMatches ? (
                    <>
                      <Eye className="w-3.5 h-3.5 text-amber-300" />
                      Activos ({visibleMatches.length})
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-rose-200" />
                      Ocultos ({hiddenMatches.length})
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {displayedMatches.length === 0 ? (
            <div className="bg-white rounded-[30px] border border-[#EFE4E0] p-8 flex flex-col items-center justify-center py-12 text-center shadow-card space-y-3">
              <div className="w-16 h-16 rounded-[24px] bg-gradient-to-br from-rose-50 via-amber-50 to-pink-50 border border-rose-200/80 text-[#FF2E54] flex items-center justify-center shadow-inner">
                {showHiddenMatches ? (
                  <Eye className="w-8 h-8 text-zinc-400" />
                ) : (
                  <Heart className="w-8 h-8 fill-[#FF2E54]/20" />
                )}
              </div>
              <div className="space-y-1 max-w-[260px]">
                <p className="font-display text-base font-black text-zinc-900">
                  {showHiddenMatches
                    ? 'No tienes Matches ocultos'
                    : 'Aún no tienes emparejamientos'}
                </p>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  {showHiddenMatches
                    ? 'Cuando ocultes un Match desde su tarjeta, aparecerá aquí guardado de forma privada.'
                    : 'Cuando tú y otra persona se den corazón mutuamente, aparecerán aquí con su insignia oficial de Match.'}
                </p>
              </div>
              {showHiddenMatches ? (
                <button
                  type="button"
                  onClick={() => setShowHiddenMatches(false)}
                  className="px-5 py-2.5 rounded-full bg-zinc-900 text-white text-xs font-black shadow-md active:scale-95 transition"
                >
                  Ver Matches activos ({visibleMatches.length})
                </button>
              ) : totalLikesCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setSubTab('likes')}
                  className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#FF2E54] to-amber-500 text-white text-xs font-black shadow-md active:scale-95 transition"
                >
                  Ver quién te dio Like ({totalLikesCount})
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onGoToSwipe?.()}
                  className="px-5 py-2.5 rounded-full bg-zinc-900 text-white text-xs font-black shadow-md active:scale-95 transition"
                >
                  Ir a Descubrir
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {displayedMatches.map((matchItem) => {
                const { match, peerId, user, isSuperMatch, isHidden } = matchItem;
                const boosted = isBoostActive(user);
                const verified = isProfileVerified(user);
                const visibleAge = getDisplayAge(user);
                const distInfo = formatUserDistanceLabel(user, currentUser);
                const userIsPro = isProActive(user);
                const online = isUserActuallyOnline(user);
                const busyHide = togglingHideId === match.id;

                return (
                  <div
                    key={match.id || peerId}
                    onClick={() => onSelectProfile?.(user)}
                    className="bg-white rounded-[26px] overflow-hidden cursor-pointer border border-rose-300/80 shadow-[0_12px_28px_-12px_rgba(255,46,84,0.28)] ring-1 ring-rose-200/60 group active:scale-[0.99] transition-all"
                  >
                    <div className="aspect-[3/4] relative bg-zinc-200 overflow-hidden">
                      <img
                        src={getPrimaryPhoto(user, 450, { seed: myUid })}
                        alt={user.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

                      {/* Badges superiores */}
                      <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between gap-1">
                        {boosted ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-400 text-black text-[9.5px] font-black flex items-center gap-0.5 shadow">
                            <Zap className="w-2.5 h-2.5 fill-black" /> VIP
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

                      {/* FRANJA ESTILO TINDER PRO */}
                      <div className="absolute inset-x-0 top-10 z-10">
                        <TinderMatchRibbon isSuperMatch={isSuperMatch} variant="card" />
                      </div>

                      <div className="absolute bottom-2.5 inset-x-2.5 text-white">
                        <p className="text-sm font-black truncate flex items-center gap-1">
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
                          {distInfo.shortText || distInfo.text}
                        </p>
                        <div className="mt-2 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onOpenChat && match?.id) {
                                onOpenChat({ match, peerUser: user });
                              } else {
                                onStartChat?.(user, { skipLikeChatGate: true });
                              }
                            }}
                            className="flex-1 py-2 px-2 rounded-full bg-gradient-to-r from-[#FF1744] via-[#FF2E63] to-amber-500 text-white text-[11px] font-black flex items-center justify-center gap-1 shadow-md hover:brightness-110 active:scale-95 transition min-w-0"
                          >
                            <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">Chatear</span>
                          </button>

                          <button
                            type="button"
                            disabled={busyHide}
                            title={isHidden ? 'Mostrar Match' : 'Ocultar Match'}
                            aria-label={isHidden ? 'Mostrar Match' : 'Ocultar Match'}
                            onClick={(e) => handleToggleHideMatch(e, matchItem)}
                            className="w-8 h-8 rounded-full bg-white/15 backdrop-blur-sm border border-white/25 text-white hover:bg-white/25 flex items-center justify-center shrink-0 transition active:scale-95 disabled:opacity-50"
                          >
                            {busyHide ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : isHidden ? (
                              <Eye className="w-3.5 h-3.5" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            title="Eliminar Match para ambos"
                            aria-label="Eliminar Match"
                            onClick={(e) => {
                              e.stopPropagation();
                              setUnmatchTarget({ match, peerId, user });
                            }}
                            className="w-8 h-8 rounded-full bg-rose-500/80 border border-rose-300/40 text-white hover:bg-rose-600 flex items-center justify-center shrink-0 transition active:scale-95"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        </div>
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

      {/* Modal de confirmación para eliminar Match mutuo */}
      {unmatchTarget && (
        <div
          onClick={() => !busyUnmatch && setUnmatchTarget(null)}
          className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-t-[30px] sm:rounded-[30px] p-6 pb-safe shadow-2xl space-y-4 animate-sheet-up"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 text-[#FF2E54] flex items-center justify-center shrink-0">
                  <UserX className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-base font-black text-zinc-900">
                    ¿Eliminar Match?
                  </h3>
                  <p className="text-xs text-zinc-500 truncate">
                    Con <strong className="text-zinc-800">{unmatchTarget.user?.name || 'usuario'}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={busyUnmatch}
                onClick={() => setUnmatchTarget(null)}
                className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-500 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed">
              Esta acción eliminará el Match <strong>para los dos</strong>. Desaparecerá tanto de tu lista como del perfil de{' '}
              <strong>{String(unmatchTarget.user?.name || 'esta persona').split(' ')[0]}</strong> y se cerrará el chat anterior.
            </p>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                disabled={busyUnmatch}
                onClick={() => setUnmatchTarget(null)}
                className="py-3 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-extrabold transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busyUnmatch}
                onClick={handleConfirmUnmatch}
                className="py-3 rounded-full bg-[#FF2E54] hover:brightness-105 text-white text-xs font-black shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 transition"
              >
                {busyUnmatch ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Eliminar Match
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Celebración estilo Tinder PRO al hacer Match mutuo */}
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
