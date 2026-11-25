import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgeCheck,
  Camera,
  Crown,
  Flame,
  Gem,
  Gift,
  Globe,
  Heart,
  Lock,
  MapPin,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  X,
  Zap,
} from 'lucide-react';
import {
  COUNTRIES,
  EXCLUSIVE_PHOTO_DEFAULT_COST,
  getIntentionMood,
  INTERESTED_IN_OPTIONS,
  LOOKING_FOR_OPTIONS,
  MIN_AGE,
  resolveAccessPolicy,
} from '../../config/constants';
import { useAuth } from '../../contexts/AuthContext';
import { unlockExclusivePhotoWithDiamonds } from '../../services/adRewardService';
import { sendTextMessage, sendVirtualGift } from '../../services/chatService';
import { sendLike } from '../../services/discoveryService';
import { fetchDiscoverProfiles } from '../../services/userService';
import { isBulkProfileHiddenFromDiscovery } from '../../utils/bulkProfileGenerator';
import {
  calculateAffinityScore,
  formatUserDistanceLabel,
  getDailyLikeQuota,
  getDisplayAge,
  getOrderedPhotos,
  getPrimaryPhoto,
  getSharedInterests,
  getSpendableDiamonds,
  getSuperLikeQuota,
  isBoostActive,
  isExclusivePhoto,
  isExclusivePhotoUnlocked,
  isProActive,
  isProfileVerified,
  optimizeCloudinaryUrl,
  triggerHaptic,
} from '../../utils/formatters';
import GiftAnimationOverlay from '../chat/GiftAnimationOverlay';
import GiftPickerModal from '../chat/GiftPickerModal';
import ProCrownBadge from '../monetization/ProCrownBadge';

const TUTORIAL_STORAGE_KEY = 'conoscamosnos_swipe_tutorial_seen_v2';
const PASS_TTL_MS = 24 * 60 * 60 * 1000;
const CARD_PHOTO_WIDTH = 800;
const NEXT_CARD_REST_Y = 44;
const NEXT_CARD_REST_SCALE = 0.92;
const NEXT_CARD_REST_OPACITY = 0.55;
const NEXT_CARD_REST_RADIUS = 24;

const AGE_PRESETS = [
  { label: '18+', min: MIN_AGE, max: 99 },
  { label: '18-26', min: 18, max: 26 },
  { label: '25-35', min: 25, max: 35 },
  { label: '30-45', min: 30, max: 45 },
  { label: '40+', min: 40, max: 99 },
];

function getPassedKey(uid) {
  return `conoscamosnos_passed_v1_${uid}`;
}

function readPassedIds(uid) {
  if (!uid) return [];
  try {
    const raw = localStorage.getItem(getPassedKey(uid));
    if (!raw) return [];
    const map = JSON.parse(raw);
    const now = Date.now();
    const cleaned = {};
    const valid = [];
    Object.entries(map || {}).forEach(([id, ts]) => {
      if (typeof ts === 'number' && now - ts < PASS_TTL_MS) {
        cleaned[id] = ts;
        valid.push(id);
      }
    });
    localStorage.setItem(getPassedKey(uid), JSON.stringify(cleaned));
    return valid;
  } catch {
    return [];
  }
}

function persistPassedId(uid, targetId) {
  if (!uid || !targetId) return;
  try {
    const raw = localStorage.getItem(getPassedKey(uid));
    const map = raw ? JSON.parse(raw) : {};
    map[targetId] = Date.now();
    localStorage.setItem(getPassedKey(uid), JSON.stringify(map));
  } catch {
    // Ignorar si localStorage no está disponible
  }
}

function clearPassedIds(uid) {
  if (!uid) return;
  try {
    localStorage.removeItem(getPassedKey(uid));
  } catch {
    // Ignorar
  }
}

export default function DiscoverSwipe({
  currentUser,
  userUnlocks = null,
  isActive = true,
  scope: controlledScope,
  onScopeChange,
  intention: controlledIntention,
  onIntentionChange,
  genderPreference: controlledGenderPref,
  onGenderPreferenceChange,
  ageRange: controlledAgeRange,
  onAgeRangeChange,
  onMoodChange,
  onSelectProfile,
  onStartChat,
  onOpenChat,
  onOpenBoost,
  onOpenDiamondStore,
  onOpenPro,
  onSuccess,
  onError,
}) {
  const { economyConfig } = useAuth();
  const accessPolicy = useMemo(() => resolveAccessPolicy(economyConfig), [economyConfig]);
  const showAdminBulkProfiles = economyConfig?.showAdminBulkProfiles !== false;
  const proActive = isProActive(currentUser);

  const [localScope, setLocalScope] = useState('global');
  const [localIntention, setLocalIntention] = useState('Todos');
  const [localGenderPref, setLocalGenderPref] = useState(currentUser?.interestedIn || 'Todos');
  const [localAgeRange, setLocalAgeRange] = useState({ min: MIN_AGE, max: 99 });
  const [passportCountryCode, setPassportCountryCode] = useState('');
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [onlyOnline, setOnlyOnline] = useState(false);

  const scope = controlledScope ?? localScope;
  const setScope = onScopeChange ?? setLocalScope;
  const intention = controlledIntention ?? localIntention;
  const setIntention = onIntentionChange ?? setLocalIntention;
  const genderPreference = controlledGenderPref ?? localGenderPref;
  const setGenderPreference = onGenderPreferenceChange ?? setLocalGenderPref;
  const ageRange = controlledAgeRange ?? localAgeRange;
  const setAgeRange = onAgeRangeChange ?? setLocalAgeRange;

  const [showFiltersModal, setShowFiltersModal] = useState(false);

  const [cards, setCards] = useState([]);
  const [totalDeckCount, setTotalDeckCount] = useState(0);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [matchPopup, setMatchPopup] = useState(null);
  const [sendingIcebreaker, setSendingIcebreaker] = useState(false);

  // Regalos desde la tarjeta / bio desplegada
  const [giftPickerOpen, setGiftPickerOpen] = useState(false);
  const [sendingGiftId, setSendingGiftId] = useState(null);
  const [giftAnim, setGiftAnim] = useState(null);
  const [unlockingPhoto, setUnlockingPhoto] = useState(false);

  // Tutorial condicional la primera vez
  const [showTutorial, setShowTutorial] = useState(() => {
    try {
      return !localStorage.getItem(TUTORIAL_STORAGE_KEY);
    } catch {
      return true;
    }
  });

  // Referencias DOM directas para animaciones a 60fps sin re-renders de React durante el gesto
  const activeCardRef = useRef(null);
  const nextCardRef = useRef(null);
  const likeStampRef = useRef(null);
  const nopeStampRef = useRef(null);
  const superLikeStampRef = useRef(null);
  const busyRef = useRef(false);
  const hapticCrossedRef = useRef(false);
  const preloadedImagesRef = useRef(new Map());
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  const dragRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    x: 0,
    y: 0,
    rafId: null,
  });

  const blockedKey = (currentUser?.blockedUsers || []).join(',');
  const superLikeQuota = useMemo(() => getSuperLikeQuota(currentUser), [currentUser]);
  const dailyLikeQuota = useMemo(() => getDailyLikeQuota(currentUser), [currentUser]);

  const resetCardDomStyle = useCallback((withTransition = false) => {
    const el = activeCardRef.current;
    if (el) {
      el.style.transition = withTransition
        ? 'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.32s ease-out'
        : 'none';
      el.style.transform = 'translate3d(0px, 0px, 0px) rotate(0deg)';
      el.style.opacity = '1';
    }
    if (nextCardRef.current) {
      nextCardRef.current.style.transition = withTransition
        ? 'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.32s ease-out, border-radius 0.32s cubic-bezier(0.22, 1, 0.36, 1)'
        : 'none';
      nextCardRef.current.style.transform = `translate3d(0px, ${NEXT_CARD_REST_Y}px, 0px) scale(${NEXT_CARD_REST_SCALE})`;
      nextCardRef.current.style.opacity = String(NEXT_CARD_REST_OPACITY);
      nextCardRef.current.style.borderRadius = `${NEXT_CARD_REST_RADIUS}px`;
    }
    if (likeStampRef.current) likeStampRef.current.style.opacity = '0';
    if (nopeStampRef.current) nopeStampRef.current.style.opacity = '0';
    if (superLikeStampRef.current) superLikeStampRef.current.style.opacity = '0';
  }, []);

  const loadCandidates = useCallback(
    async (forceIncludeAll = false) => {
      const user = currentUserRef.current;
      if (!user?.uid) return;
      setLoading(true);
      setPhotoIdx(0);
      busyRef.current = false;

      try {
        if (forceIncludeAll) {
          clearPassedIds(user.uid);
        }

        const passedIds = forceIncludeAll ? [] : readPassedIds(user.uid);

        let list = await fetchDiscoverProfiles({
          currentUser: user,
          scope,
          passportCountryCode,
          lookingForFilter: intention,
          genderPreference,
          minAge: ageRange?.min ?? MIN_AGE,
          maxAge: ageRange?.max ?? 99,
          onlyVerified,
          onlyOnline,
          passedIds,
          includeAlreadyLiked: forceIncludeAll,
          showAdminBulkProfiles,
        });

        if (
          list.length === 0 &&
          !forceIncludeAll &&
          intention === 'Todos' &&
          !passportCountryCode &&
          !onlyVerified &&
          !onlyOnline &&
          passedIds.length === 0
        ) {
          list = await fetchDiscoverProfiles({
            currentUser: user,
            scope,
            passportCountryCode: '',
            lookingForFilter: intention,
            genderPreference,
            minAge: ageRange?.min ?? MIN_AGE,
            maxAge: ageRange?.max ?? 99,
            onlyVerified: false,
            onlyOnline: false,
            passedIds: [],
            includeAlreadyLiked: true,
            showAdminBulkProfiles,
          });
        }

        setCards(list);
        setTotalDeckCount(list.length);
      } catch (err) {
        onError?.(err.message || 'Error al cargar perfiles.');
      } finally {
        setLoading(false);
      }
    },
    [
      currentUser?.uid,
      currentUser?.country?.code,
      blockedKey,
      scope,
      passportCountryCode,
      intention,
      genderPreference,
      ageRange?.min,
      ageRange?.max,
      onlyVerified,
      onlyOnline,
      showAdminBulkProfiles,
      onError,
    ]
  );

  useEffect(() => {
    loadCandidates(false);
  }, [loadCandidates]);

  useEffect(() => {
    return () => {
      if (dragRef.current.rafId) {
        cancelAnimationFrame(dragRef.current.rafId);
      }
    };
  }, []);

  // VIRTUALIZACIÓN DEL MAZO: Filtra en vivo perfiles ocultos desde Admin y mantiene máximo 2 tarjetas en el DOM
  const activeCards = useMemo(
    () => cards.filter((u) => !isBulkProfileHiddenFromDiscovery(u, showAdminBulkProfiles)),
    [cards, showAdminBulkProfiles]
  );
  const visibleDeck = activeCards.slice(0, 2);
  const topCard = visibleDeck[0] || null;
  const nextCard = visibleDeck[1] || null;

  // Tema romántico adaptativo según lo que busca la persona visible o el filtro activo
  const activeMoodKey =
    intention !== 'Todos'
      ? intention
      : topCard?.lookingFor || currentUser?.lookingFor || 'Todos';
  const mood = useMemo(() => getIntentionMood(activeMoodKey), [activeMoodKey]);

  useEffect(() => {
    onMoodChange?.(activeMoodKey);
  }, [activeMoodKey, onMoodChange]);

  const topCardPhotos = useMemo(() => {
    if (!topCard) return [];
    const ordered = getOrderedPhotos(topCard, currentUser?.uid);
    if (ordered.length > 0) return ordered;
    return [getPrimaryPhoto(topCard, CARD_PHOTO_WIDTH, { seed: currentUser?.uid })];
  }, [topCard, currentUser?.uid]);

  const topCardOptimizedPhotos = useMemo(
    () => topCardPhotos.map((url) => optimizeCloudinaryUrl(url, CARD_PHOTO_WIDTH)),
    [topCardPhotos]
  );

  // Motor de aceleración LRU con decode() persistente para cambio de fotos instantáneo (0ms)
  useEffect(() => {
    const cache = preloadedImagesRef.current;
    const warmUrl = (url) => {
      if (!url) return;
      if (cache.has(url)) {
        const existing = cache.get(url);
        cache.delete(url);
        cache.set(url, existing);
        return;
      }
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      if (typeof img.decode === 'function') {
        img.decode().catch(() => {});
      }
      cache.set(url, img);
      while (cache.size > 48) {
        const oldestKey = cache.keys().next().value;
        cache.delete(oldestKey);
      }
    };

    topCardOptimizedPhotos.forEach(warmUrl);

    if (nextCard) {
      const nextOrdered = getOrderedPhotos(nextCard, currentUser?.uid);
      const nextUrls =
        nextOrdered.length > 0
          ? nextOrdered.slice(0, 3).map((u) => optimizeCloudinaryUrl(u, CARD_PHOTO_WIDTH))
          : [getPrimaryPhoto(nextCard, CARD_PHOTO_WIDTH, { seed: currentUser?.uid })];
      nextUrls.forEach(warmUrl);
    }

    activeCards.slice(2, 5).forEach((upcoming) => {
      warmUrl(getPrimaryPhoto(upcoming, CARD_PHOTO_WIDTH, { seed: currentUser?.uid }));
    });
  }, [topCardOptimizedPhotos, nextCard, activeCards, currentUser?.uid]);

  const dismissTutorial = () => {
    try {
      localStorage.setItem(TUTORIAL_STORAGE_KEY, '1');
    } catch {
      // Ignorar si localStorage está restringido
    }
    setShowTutorial(false);
  };

  const flyOutAndAdvance = useCallback((direction, _targetCard, onAfterAdvance) => {
    const el = activeCardRef.current;

    if (el) {
      if (direction === 'up') {
        el.style.transition =
          'transform 0.34s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.34s ease-out';
        el.style.transform = `translate3d(0px, -${window.innerHeight + 220}px, 0px) scale(1.04)`;
        el.style.opacity = '0.9';
        if (superLikeStampRef.current) superLikeStampRef.current.style.opacity = '1';
        if (likeStampRef.current) likeStampRef.current.style.opacity = '0';
        if (nopeStampRef.current) nopeStampRef.current.style.opacity = '0';
      } else {
        const targetX =
          direction === 'right' ? window.innerWidth + 180 : -(window.innerWidth + 180);
        const targetRot = direction === 'right' ? 22 : -22;
        el.style.transition =
          'transform 0.34s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.34s ease-out';
        el.style.transform = `translate3d(${targetX}px, 24px, 0px) rotate(${targetRot}deg)`;
        el.style.opacity = '0.96';
        if (direction === 'right' && likeStampRef.current) {
          likeStampRef.current.style.opacity = '1';
        }
        if (direction === 'left' && nopeStampRef.current) {
          nopeStampRef.current.style.opacity = '1';
        }
        if (superLikeStampRef.current) superLikeStampRef.current.style.opacity = '0';
      }
    }

    if (nextCardRef.current) {
      nextCardRef.current.style.transition =
        'transform 0.34s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.34s ease-out, border-radius 0.34s cubic-bezier(0.16, 1, 0.3, 1)';
      nextCardRef.current.style.transform = 'translate3d(0px, 0px, 0px) scale(1)';
      nextCardRef.current.style.opacity = '1';
      nextCardRef.current.style.borderRadius = '0px';
    }

    setTimeout(() => {
      if (activeCardRef.current) {
        activeCardRef.current.style.transition = 'none';
        activeCardRef.current.style.transform = 'translate3d(0px, 0px, 0px) rotate(0deg)';
        activeCardRef.current.style.opacity = '1';
      }
      if (nextCardRef.current) {
        nextCardRef.current.style.transition = 'none';
        nextCardRef.current.style.transform = `translate3d(0px, ${NEXT_CARD_REST_Y}px, 0px) scale(${NEXT_CARD_REST_SCALE})`;
        nextCardRef.current.style.opacity = String(NEXT_CARD_REST_OPACITY);
        nextCardRef.current.style.borderRadius = `${NEXT_CARD_REST_RADIUS}px`;
      }
      if (likeStampRef.current) likeStampRef.current.style.opacity = '0';
      if (nopeStampRef.current) nopeStampRef.current.style.opacity = '0';
      if (superLikeStampRef.current) superLikeStampRef.current.style.opacity = '0';

      setCards((prev) => prev.slice(1));
      setPhotoIdx(0);
      busyRef.current = false;
      onAfterAdvance?.();
    }, 340);
  }, []);

  const triggerPass = useCallback(() => {
    if (!topCard || busyRef.current) return;
    busyRef.current = true;
    const target = topCard;
    triggerHaptic(10);
    persistPassedId(currentUserRef.current?.uid, target.uid || target.id);
    flyOutAndAdvance('left', target);
  }, [topCard, flyOutAndAdvance]);

  const triggerLike = useCallback(() => {
    if (!topCard || busyRef.current) return;

    if (dailyLikeQuota.remaining <= 0) {
      resetCardDomStyle(true);
      triggerHaptic([20, 40, 20]);
      onError?.(
        dailyLikeQuota.isPro
          ? '❤️ Alcanzaste tus 100 corazones diarios PRO. Se renuevan mañana.'
          : '❤️ Alcanzaste tu límite de 25 corazones al día. Hazte Conoscamosnos PRO para disfrutar 100 corazones diarios.'
      );
      if (!dailyLikeQuota.isPro) {
        (onOpenPro || onOpenDiamondStore)?.();
      }
      return;
    }

    busyRef.current = true;
    const target = topCard;
    const likedPhotoUrl = topCardPhotos[photoIdx] || topCardPhotos[0] || '';
    const likedPhotoIndex = photoIdx;
    triggerHaptic(14);

    flyOutAndAdvance('right', target, async () => {
      try {
        const res = await sendLike({
          currentUser: currentUserRef.current,
          targetUser: target,
          likedPhotoUrl,
          likedPhotoIndex,
          isSuperLike: false,
        });
        if (res.matched && !res.alreadyLiked) {
          triggerHaptic([18, 40, 24]);
          setMatchPopup({ targetUser: target, matchId: res.matchId, isSuperLike: false });
        }
      } catch (err) {
        const targetId = target.uid || target.id;
        setCards((prev) =>
          prev.some((c) => (c.uid || c.id) === targetId) ? prev : [target, ...prev]
        );
        onError?.(err.message || 'No se pudo enviar Like.');
        if (!dailyLikeQuota.isPro && err.code === 'DAILY_LIKE_LIMIT_REACHED') {
          (onOpenPro || onOpenDiamondStore)?.();
        }
      }
    });
  }, [
    topCard,
    topCardPhotos,
    photoIdx,
    dailyLikeQuota,
    resetCardDomStyle,
    flyOutAndAdvance,
    onOpenPro,
    onOpenDiamondStore,
    onError,
  ]);

  const triggerSuperLike = useCallback(() => {
    if (!topCard || busyRef.current) return;

    if (superLikeQuota.remaining <= 0) {
      resetCardDomStyle(true);
      triggerHaptic([20, 40, 20]);
      onError?.(
        superLikeQuota.isPro
          ? '⭐ Ya usaste tus 20 Super Likes semanales PRO. Se renuevan el próximo lunes.'
          : '⭐ Ya usaste tus 2 Super Likes semanales. Hazte Conoscamosnos PRO para tener 20 cada semana.'
      );
      if (!superLikeQuota.isPro) {
        (onOpenPro || onOpenDiamondStore)?.();
      }
      return;
    }

    busyRef.current = true;
    const target = topCard;
    const likedPhotoUrl = topCardPhotos[photoIdx] || topCardPhotos[0] || '';
    const likedPhotoIndex = photoIdx;
    triggerHaptic([14, 30, 18]);

    flyOutAndAdvance('up', target, async () => {
      try {
        const res = await sendLike({
          currentUser: currentUserRef.current,
          targetUser: target,
          likedPhotoUrl,
          likedPhotoIndex,
          isSuperLike: true,
        });
        if (res.matched && !res.alreadyLiked) {
          triggerHaptic([18, 40, 24]);
          setMatchPopup({ targetUser: target, matchId: res.matchId, isSuperLike: true });
        } else if (!res.alreadyLiked) {
          const rem = res.quota?.remaining ?? Math.max(0, superLikeQuota.remaining - 1);
          const lim = res.quota?.limit ?? superLikeQuota.limit;
          onSuccess?.(
            `⭐ ¡Super Like enviado a ${target.name}! Te quedan ${rem}/${lim} esta semana.`
          );
        }
      } catch (err) {
        const targetId = target.uid || target.id;
        setCards((prev) =>
          prev.some((c) => (c.uid || c.id) === targetId) ? prev : [target, ...prev]
        );
        onError?.(err.message || 'No se pudo enviar el Super Like.');
        if (!superLikeQuota.isPro && err.code === 'SUPER_LIKE_LIMIT_REACHED') {
          (onOpenPro || onOpenDiamondStore)?.();
        }
      }
    });
  }, [
    topCard,
    topCardPhotos,
    photoIdx,
    superLikeQuota,
    resetCardDomStyle,
    flyOutAndAdvance,
    onOpenPro,
    onOpenDiamondStore,
    onSuccess,
    onError,
  ]);

  // Navegación por teclado en desktop cuando la pestaña Descubrir está activa
  useEffect(() => {
    if (!isActive || showTutorial || giftPickerOpen || matchPopup) return;
    const onKeyDown = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') {
        if (showFiltersModal) {
          e.preventDefault();
          setShowFiltersModal(false);
        }
        return;
      }
      if (showFiltersModal) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        triggerLike();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        triggerPass();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        triggerSuperLike();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    isActive,
    showTutorial,
    showFiltersModal,
    giftPickerOpen,
    matchPopup,
    triggerLike,
    triggerPass,
    triggerSuperLike,
  ]);

  const handleSendGift = async (gift) => {
    if (!topCard) return;
    setSendingGiftId(gift.id);
    try {
      const res = await sendVirtualGift({
        sender: currentUser,
        receiver: topCard,
        gift,
        economyConfig,
      });
      setGiftPickerOpen(false);
      setGiftAnim({
        giftIcon: gift.icon,
        giftName: gift.name,
        giftValue: gift.price,
        diamondsCredited: res.diamondsCredited ?? gift.price,
        isReceiver: false,
      });
      onSuccess?.(`${gift.icon} ¡Regalo ${gift.name} enviado a ${topCard.name}!`);
    } catch (err) {
      onError?.(err.message || 'Error al enviar regalo.');
    } finally {
      setSendingGiftId(null);
    }
  };

  // GESTOS DE ARRASTRE EN 3 DIRECCIONES A 60FPS SIN RE-RENDERS DE REACT
  const applyFrameTransform = () => {
    dragRef.current.rafId = null;
    const el = activeCardRef.current;
    if (!el || !dragRef.current.active) return;

    const { x: dx, y: dy } = dragRef.current;
    const isUpSwipe = dy < -25 && Math.abs(dy) > Math.abs(dx) * 1.15;

    if (isUpSwipe) {
      const rot = dx * 0.02;
      el.style.transform = `translate3d(${dx * 0.45}px, ${dy}px, 0px) rotate(${rot}deg)`;
      const superOpacity = Math.min(1, (-dy - 25) / 85);
      if (superLikeStampRef.current) superLikeStampRef.current.style.opacity = String(superOpacity);
      if (likeStampRef.current) likeStampRef.current.style.opacity = '0';
      if (nopeStampRef.current) nopeStampRef.current.style.opacity = '0';
    } else {
      const rot = dx * 0.042;
      el.style.transform = `translate3d(${dx}px, ${dy * 0.24}px, 0px) rotate(${rot}deg)`;
      if (likeStampRef.current) {
        likeStampRef.current.style.opacity = String(
          dx > 20 ? Math.min(1, (dx - 20) / 85) : 0
        );
      }
      if (nopeStampRef.current) {
        nopeStampRef.current.style.opacity = String(
          dx < -20 ? Math.min(1, (-dx - 20) / 85) : 0
        );
      }
      if (superLikeStampRef.current) superLikeStampRef.current.style.opacity = '0';
    }

    if (nextCardRef.current) {
      const raw = isUpSwipe
        ? Math.min(1, Math.max(0, (-dy - 10) / 140))
        : Math.min(1, Math.max(0, (Math.abs(dx) - 10) / 140));
      const eased = 1 - Math.pow(1 - raw, 2);
      const scale = NEXT_CARD_REST_SCALE + (1 - NEXT_CARD_REST_SCALE) * eased;
      const translateY = NEXT_CARD_REST_Y * (1 - eased);
      const opacity = NEXT_CARD_REST_OPACITY + (1 - NEXT_CARD_REST_OPACITY) * eased;
      const radius = NEXT_CARD_REST_RADIUS * (1 - eased);
      nextCardRef.current.style.transition = 'none';
      nextCardRef.current.style.transform = `translate3d(0px, ${translateY}px, 0px) scale(${scale})`;
      nextCardRef.current.style.opacity = String(opacity);
      nextCardRef.current.style.borderRadius = `${radius}px`;
    }

    const crossed = isUpSwipe ? dy < -95 : Math.abs(dx) > 90;
    const withinReset = isUpSwipe ? dy > -75 : Math.abs(dx) < 70;
    if (crossed && !hapticCrossedRef.current) {
      hapticCrossedRef.current = true;
      triggerHaptic(8);
    } else if (withinReset && hapticCrossedRef.current) {
      hapticCrossedRef.current = false;
    }
  };

  const handlePointerDown = (e) => {
    if (busyRef.current || showTutorial || showFiltersModal) return;
    if (e.target.closest('button')) return;

    hapticCrossedRef.current = false;
    const el = activeCardRef.current;
    if (el) {
      el.style.transition = 'none';
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Ignorar
      }
    }

    dragRef.current.active = true;
    dragRef.current.pointerId = e.pointerId;
    dragRef.current.startX = e.clientX;
    dragRef.current.startY = e.clientY;
    dragRef.current.x = 0;
    dragRef.current.y = 0;
  };

  const handlePointerMove = (e) => {
    if (!dragRef.current.active) return;
    dragRef.current.x = e.clientX - dragRef.current.startX;
    dragRef.current.y = e.clientY - dragRef.current.startY;

    if (!dragRef.current.rafId) {
      dragRef.current.rafId = requestAnimationFrame(applyFrameTransform);
    }
  };

  const handlePointerUp = (e) => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    hapticCrossedRef.current = false;
    if (dragRef.current.rafId) {
      cancelAnimationFrame(dragRef.current.rafId);
      dragRef.current.rafId = null;
    }

    const dx = dragRef.current.x;
    const dy = dragRef.current.y;

    if (dy < -95 && Math.abs(dy) > Math.abs(dx) * 1.15) {
      triggerSuperLike();
      return;
    }
    if (dx > 90) {
      triggerLike();
      return;
    }
    if (dx < -90) {
      triggerPass();
      return;
    }

    if (Math.abs(dx) >= 4 || Math.abs(dy) >= 4) {
      resetCardDomStyle(true);
    } else {
      resetCardDomStyle(false);
    }

    // Cambio de foto izquierda / derecha instantáneo al tocar los lados estilo Historias
    if (
      Math.abs(dx) < 12 &&
      Math.abs(dy) < 12 &&
      topCardPhotos.length > 1 &&
      activeCardRef.current &&
      !showFiltersModal
    ) {
      const rect = activeCardRef.current.getBoundingClientRect();
      const tapX = e.clientX - rect.left;
      const tapY = e.clientY - rect.top;
      if (tapY < rect.height * 0.72) {
        if (tapX < rect.width * 0.42) {
          setPhotoIdx((i) => (i - 1 + topCardPhotos.length) % topCardPhotos.length);
        } else if (tapX > rect.width * 0.58) {
          setPhotoIdx((i) => (i + 1) % topCardPhotos.length);
        }
      }
    }
  };

  const passportCountry = useMemo(
    () => (passportCountryCode ? COUNTRIES.find((c) => c.code === passportCountryCode) : null),
    [passportCountryCode]
  );

  const verified = topCard ? isProfileVerified(topCard) : false;
  const boosted = topCard ? isBoostActive(topCard) : false;
  const topCardIsPro = topCard ? isProActive(topCard) : false;
  const exclusiveCostDiamonds =
    accessPolicy.unlockExclusivePhotoDiamonds || EXCLUSIVE_PHOTO_DEFAULT_COST;
  const currentSwipePhotoUrl = topCardPhotos[photoIdx] || topCardPhotos[0] || '';
  const currentSwipePhotoIsExclusive = topCard
    ? isExclusivePhoto(topCard, currentSwipePhotoUrl, photoIdx)
    : false;
  const currentSwipePhotoUnlocked = topCard
    ? isExclusivePhotoUnlocked({
        targetUser: topCard,
        photoUrl: currentSwipePhotoUrl,
        photoIndex: photoIdx,
        viewerUser: currentUser,
        userUnlocks,
        isFreeMode: accessPolicy.isFreeMode,
      })
    : true;

  const handleUnlockSwipeExclusivePhoto = async (e) => {
    e?.stopPropagation?.();
    if (!topCard || !currentSwipePhotoUrl || unlockingPhoto) return;
    if (getSpendableDiamonds(currentUser) < exclusiveCostDiamonds) {
      onError?.(
        `Necesitas ${exclusiveCostDiamonds} 💎 para desbloquear esta Foto Exclusiva VIP (o hazte Conoscamosnos PRO).`
      );
      onOpenDiamondStore?.();
      return;
    }
    setUnlockingPhoto(true);
    try {
      await unlockExclusivePhotoWithDiamonds({
        sender: currentUser,
        targetUser: topCard,
        photoUrl: currentSwipePhotoUrl,
        costDiamonds: exclusiveCostDiamonds,
      });
      setGiftAnim({
        giftIcon: '📸',
        giftName: 'Foto Exclusiva VIP',
        giftValue: exclusiveCostDiamonds,
        diamondsCredited: exclusiveCostDiamonds,
        isReceiver: false,
      });
      onSuccess?.(
        `🔓 ¡Foto Exclusiva VIP de ${topCard.name} desbloqueada! (+${exclusiveCostDiamonds} 💎 para ${topCard.name}).`
      );
    } catch (err) {
      onError?.(err.message || 'No se pudo desbloquear la Foto Exclusiva VIP.');
    } finally {
      setUnlockingPhoto(false);
    }
  };

  const affinity = topCard ? calculateAffinityScore(currentUser, topCard) : null;
  const visibleAge = topCard ? getDisplayAge(topCard) : null;
  const distanceInfo = topCard
    ? formatUserDistanceLabel(topCard, currentUser)
    : { text: '', isHidden: false };

  const nextVisibleAge = nextCard ? getDisplayAge(nextCard) : null;
  const nextVerified = nextCard ? isProfileVerified(nextCard) : false;
  const nextDistanceInfo = nextCard
    ? formatUserDistanceLabel(nextCard, currentUser)
    : { text: '', isHidden: false };

  const hasCustomFilters =
    scope !== 'global' ||
    intention !== 'Todos' ||
    Boolean(passportCountryCode) ||
    onlyVerified ||
    onlyOnline ||
    genderPreference !== (currentUser?.interestedIn || 'Todos') ||
    ageRange?.min > MIN_AGE ||
    ageRange?.max < 99;

  return (
    <div
      style={{ background: mood.backdropStyle }}
      className="flex-1 h-full w-full text-white flex flex-col overflow-hidden select-none relative transition-all duration-700"
    >
      {/* CABECERA FLOTANTE FULL-SCREEN: Descubrir + Pasaporte (opcional) + PRO · Boost · Filtros */}
      <header
        style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0px))' }}
        className="absolute top-0 inset-x-0 px-3.5 pb-2 z-30 flex items-center justify-between gap-2 bg-transparent pointer-events-none"
      >
        {/* Izquierda: Emblema de marca + Descubrir + Pasaporte si aplica */}
        <div className="flex items-center gap-2 min-w-0 pointer-events-auto">
          <div className="w-7 h-7 rounded-[10px] bg-gradient-to-tr from-[#FF2E54] via-rose-500 to-amber-400 shadow-[0_6px_16px_rgba(255,46,84,0.45)] flex items-center justify-center shrink-0">
            <Flame className="w-3.5 h-3.5 text-white fill-white" />
          </div>
          <h1 className="font-display text-[19px] font-black tracking-tight text-white leading-none truncate drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)]">
            Descubrir
          </h1>
          {passportCountry && (
            <span className="shrink-0 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-[10.5px] font-bold text-white inline-flex items-center gap-1 shadow">
              <span>✈️</span>
              <span>{passportCountry.flag}</span>
              <span className="hidden xs:inline truncate max-w-[90px]">{passportCountry.name}</span>
            </span>
          )}
        </div>

        {/* Derecha: PRO · Boost · Filtros */}
        <div className="flex items-center gap-1.5 shrink-0 pointer-events-auto">
          <button
            type="button"
            onClick={onOpenPro || onOpenDiamondStore}
            className={`h-8 px-2.5 rounded-full border text-[11px] font-extrabold flex items-center gap-1 hover:brightness-110 active:scale-95 transition shadow ${
              proActive
                ? 'bg-gradient-to-r from-[#FF2E54] to-amber-500 border-amber-200/60 text-white shadow-[0_4px_14px_rgba(245,158,11,0.35)]'
                : 'bg-black/50 backdrop-blur-md border-amber-300/45 text-amber-200'
            }`}
            title="Conoscamosnos PRO"
          >
            <Crown className="w-3.5 h-3.5 text-amber-300" />
            <span>PRO</span>
          </button>

          <button
            type="button"
            onClick={onOpenBoost}
            className="h-8 px-2.5 rounded-full bg-black/45 backdrop-blur-md border border-purple-300/40 text-purple-200 text-[11px] font-extrabold flex items-center gap-1 hover:bg-purple-500/35 active:scale-95 transition shadow"
            title="Activar Boost VIP"
          >
            <Zap className="w-3.5 h-3.5 fill-purple-300 text-purple-300" />
            <span>Boost</span>
          </button>

          <button
            type="button"
            onClick={() => setShowFiltersModal((v) => !v)}
            className={`relative w-8 h-8 rounded-full flex items-center justify-center border active:scale-95 transition shrink-0 shadow ${
              showFiltersModal || hasCustomFilters
                ? 'bg-white text-zinc-950 border-white shadow-lg'
                : 'bg-black/45 backdrop-blur-md text-white border-white/25 hover:bg-black/65'
            }`}
            aria-label="Filtros de búsqueda"
            title="Filtros de búsqueda"
          >
            <SlidersHorizontal className="w-4 h-4 stroke-[2.2]" />
            {hasCustomFilters && !showFiltersModal && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#FF2E54] ring-2 ring-[#12050B] animate-pulse" />
            )}
          </button>
        </div>
      </header>

      {/* PANEL DESPLEGABLE DE FILTROS CON SCRIM DIFUMINADO */}
      {showFiltersModal && (
        <>
          <div
            onClick={() => setShowFiltersModal(false)}
            className="fixed inset-0 z-[35] bg-black/55 backdrop-blur-sm"
          />
          <div
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 56px)' }}
            className="absolute inset-x-3 z-40 max-h-[78dvh] overflow-y-auto no-scrollbar p-4 rounded-[28px] bg-[#140811]/95 backdrop-blur-2xl border border-white/15 space-y-3.5 shadow-[0_24px_60px_rgba(0,0,0,0.8)] animate-sheet-up"
          >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-zinc-100 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Personaliza tu descubrimiento
            </span>
            <div className="flex items-center gap-1.5">
              {hasCustomFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setScope('global');
                    setPassportCountryCode('');
                    setOnlyVerified(false);
                    setOnlyOnline(false);
                    setIntention('Todos');
                    setGenderPreference(currentUser?.interestedIn || 'Todos');
                    setAgeRange({ min: MIN_AGE, max: 99 });
                  }}
                  className="px-2.5 py-1 rounded-full bg-white/10 text-zinc-200 text-[11px] font-bold hover:bg-white/20"
                >
                  Restablecer
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowFiltersModal(false)}
                className="px-3.5 py-1 rounded-full bg-white text-black text-[11px] font-extrabold"
              >
                Listo
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setPassportCountryCode('');
                setScope('global');
              }}
              className={`py-2 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                scope === 'global' && !passportCountryCode
                  ? 'bg-white text-black'
                  : 'bg-white/10 text-zinc-300 border border-white/10'
              }`}
            >
              <Globe className="w-3.5 h-3.5" /> Todo el Mundo
            </button>
            <button
              type="button"
              onClick={() => {
                setPassportCountryCode('');
                setScope('local');
              }}
              className={`py-2 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                scope === 'local' && !passportCountryCode
                  ? 'bg-white text-black'
                  : 'bg-white/10 text-zinc-300 border border-white/10'
              }`}
            >
              <span>{currentUser?.country?.flag || '📍'}</span> Mi País ({currentUser?.country?.code})
            </button>
          </div>

          {/* Modo Pasaporte Global + Filtros Exclusivos Conoscamosnos PRO */}
          <div className="p-3 rounded-2xl bg-gradient-to-r from-[#FF2E54]/15 via-black/40 to-amber-500/15 border border-amber-300/30 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1">
                <Crown className="w-3 h-3" /> Modo Pasaporte y Filtros PRO
              </span>
              {!proActive && (
                <button
                  type="button"
                  onClick={() => {
                    setShowFiltersModal(false);
                    (onOpenPro || onOpenDiamondStore)?.();
                  }}
                  className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#FF2E54] to-amber-500 text-white text-[9.5px] font-black"
                >
                  Obtener PRO
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              <select
                value={passportCountryCode}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val && !proActive && !accessPolicy.isFreeMode) {
                    onError?.(
                      '👑 Activa Conoscamosnos PRO para viajar a cualquier país con Modo Pasaporte.'
                    );
                    setShowFiltersModal(false);
                    (onOpenPro || onOpenDiamondStore)?.();
                    return;
                  }
                  setPassportCountryCode(val);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-black/55 border border-white/15 text-[11px] font-bold text-white focus:outline-none"
              >
                <option value="">✈️ Pasaporte: Cualquier país</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  if (!proActive && !accessPolicy.isFreeMode) {
                    onError?.(
                      '👑 Filtro exclusivo Conoscamosnos PRO: Ver solo perfiles con Check Azul.'
                    );
                    setShowFiltersModal(false);
                    (onOpenPro || onOpenDiamondStore)?.();
                    return;
                  }
                  setOnlyVerified((v) => !v);
                }}
                className={`py-1.5 px-2.5 rounded-xl text-[11px] font-bold border flex items-center justify-center gap-1 transition ${
                  onlyVerified
                    ? 'bg-sky-500 text-white border-sky-400'
                    : 'bg-black/40 text-zinc-300 border-white/10 hover:text-white'
                }`}
              >
                <BadgeCheck className="w-3.5 h-3.5 text-sky-400" />
                Solo Check Azul
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!proActive && !accessPolicy.isFreeMode) {
                    onError?.(
                      '👑 Filtro exclusivo Conoscamosnos PRO: Ver solo personas En Línea ahora.'
                    );
                    setShowFiltersModal(false);
                    (onOpenPro || onOpenDiamondStore)?.();
                    return;
                  }
                  setOnlyOnline((v) => !v);
                }}
                className={`py-1.5 px-2.5 rounded-xl text-[11px] font-bold border flex items-center justify-center gap-1 transition ${
                  onlyOnline
                    ? 'bg-emerald-500 text-white border-emerald-400'
                    : 'bg-black/40 text-zinc-300 border-white/10 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Solo En Línea
              </button>
            </div>
          </div>

          {/* Preferencia de género */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
              Me interesa ver
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {INTERESTED_IN_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setGenderPreference(opt)}
                  className={`py-1.5 rounded-xl text-[11px] font-bold transition ${
                    genderPreference === opt
                      ? 'bg-[#FF2E54] text-white shadow'
                      : 'bg-white/10 text-zinc-300 border border-white/10 hover:text-white'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Rango de edad */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
                Edad
              </p>
              <span className="text-[11px] font-extrabold text-rose-300">
                {ageRange.min} – {ageRange.max >= 99 ? '60+' : ageRange.max} años
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {AGE_PRESETS.map((preset) => {
                const selected = ageRange.min === preset.min && ageRange.max === preset.max;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setAgeRange({ min: preset.min, max: preset.max })}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold transition ${
                      selected
                        ? 'bg-white text-black'
                        : 'bg-white/10 text-zinc-300 border border-white/10 hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ¿Qué buscas? (solo texto limpio sin iconos) */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
              ¿Qué buscas?
            </p>
            <div className="flex flex-wrap gap-1.5">
              {['Todos', ...LOOKING_FOR_OPTIONS].map((opt) => {
                const optMood = getIntentionMood(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setIntention(opt)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition ${
                      intention === opt
                        ? optMood.pillActive
                        : 'bg-white/10 text-zinc-300 border-white/10 hover:text-white'
                    }`}
                  >
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Accesos rápidos PRO y Boost VIP */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10">
            <button
              type="button"
              onClick={() => {
                setShowFiltersModal(false);
                (onOpenPro || onOpenDiamondStore)?.();
              }}
              className="py-2.5 px-3 rounded-2xl bg-gradient-to-r from-[#FF2E54]/25 to-amber-500/25 border border-amber-300/40 text-amber-200 text-xs font-extrabold flex items-center justify-center gap-1.5 hover:brightness-110 transition"
            >
              <Crown className="w-3.5 h-3.5 text-amber-300" />
              <span>{proActive ? 'Miembro PRO' : 'Conoscamosnos PRO'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowFiltersModal(false);
                onOpenBoost?.();
              }}
              className="py-2.5 px-3 rounded-2xl bg-gradient-to-r from-purple-600/30 to-fuchsia-600/30 border border-purple-400/40 text-purple-200 text-xs font-extrabold flex items-center justify-center gap-1.5 hover:brightness-110 transition"
            >
              <Zap className="w-3.5 h-3.5 fill-[#C084FC] text-[#C084FC]" />
              <span>Activar Boost VIP</span>
            </button>
          </div>
        </div>
        </>
      )}

      {/* CONTENEDOR DEL MAZO FULL-SCREEN EDGE-TO-EDGE ESTILO TINDER (Máximo 2 tarjetas en el DOM) */}
      <div className="relative z-10 flex-1 h-full min-h-0 p-0 flex flex-col overflow-hidden bg-zinc-950">
        {loading ? (
          <div className="flex-1 bg-[#12050B] flex flex-col items-center justify-center gap-4 p-6 pt-16 text-center">
            <div className="relative flex items-center justify-center">
              <div className="w-24 h-24 rounded-full border border-rose-400/40 animate-ping absolute" />
              <img
                src={getPrimaryPhoto(currentUser, 200)}
                alt={currentUser?.name}
                className="w-20 h-20 rounded-full object-cover border-2 border-[#FF2E54] relative z-10"
              />
            </div>
            <div>
              <p className="text-sm font-extrabold text-white">Encontrando perfiles cerca de ti...</p>
              <p className="text-xs text-rose-200/75 mt-1">Preparando perfiles para ti</p>
            </div>
          </div>
        ) : !topCard ? (
          <div className="flex-1 bg-[#12050B] flex flex-col items-center justify-center p-6 pt-16 text-center relative overflow-hidden">
            <div className="relative flex items-center justify-center mb-5">
              <div className="w-32 h-32 rounded-full border border-rose-400/25 animate-ping absolute" />
              <div className="w-24 h-24 rounded-full border border-rose-400/40 absolute" />
              <img
                src={getPrimaryPhoto(currentUser, 240)}
                alt={currentUser?.name}
                className="w-20 h-20 rounded-full object-cover border-2 border-[#FF2E54] relative z-10"
              />
            </div>

            <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-bold text-rose-200 mb-2">
              {totalDeckCount > 0
                ? `${totalDeckCount} perfiles explorados`
                : 'Sin coincidencias en este filtro'}
            </span>

            <h2 className="font-display text-2xl font-black text-white tracking-tight">
              Hasta acá por los momentos
            </h2>
            <p className="text-xs sm:text-sm text-zinc-300 mt-2 max-w-xs leading-relaxed">
              {intention !== 'Todos'
                ? `Ya viste todas las personas disponibles en "${intention}". Prueba ampliar los filtros o volver a verlos.`
                : 'Ya recorriste todos los perfiles disponibles por ahora según tus preferencias.'}
            </p>

            <div className="w-full max-w-xs space-y-2.5 mt-6">
              <button
                type="button"
                onClick={() => loadCandidates(true)}
                className={`w-full py-3.5 rounded-full bg-gradient-to-r ${mood.heartButton} text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 active:scale-95 transition-transform`}
              >
                <RefreshCw className="w-4 h-4" />
                Volver a ver perfiles
              </button>

              {(intention !== 'Todos' || hasCustomFilters) && (
                <button
                  type="button"
                  onClick={() => {
                    setScope('global');
                    setPassportCountryCode('');
                    setOnlyVerified(false);
                    setOnlyOnline(false);
                    setIntention('Todos');
                    setGenderPreference('Todos');
                    setAgeRange({ min: MIN_AGE, max: 99 });
                  }}
                  className="w-full py-3 rounded-full bg-white/10 border border-white/15 text-zinc-100 text-xs font-bold active:scale-95 transition-transform"
                >
                  Ampliar todos los filtros
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 relative">
            {/* TARJETA 2 (Siguiente perfil emergiendo desde abajo estilo stack de Tinder) */}
            {nextCard && (
              <div
                key={`next-${nextCard.uid || nextCard.id}`}
                ref={nextCardRef}
                style={{
                  transform: `translate3d(0px, ${NEXT_CARD_REST_Y}px, 0px) scale(${NEXT_CARD_REST_SCALE})`,
                  opacity: NEXT_CARD_REST_OPACITY,
                  borderRadius: `${NEXT_CARD_REST_RADIUS}px`,
                }}
                className="gpu-card absolute inset-0 z-[1] overflow-hidden bg-zinc-950 pointer-events-none"
              >
                <img
                  src={getPrimaryPhoto(nextCard, CARD_PHOTO_WIDTH, { seed: currentUser?.uid })}
                  alt={nextCard.name}
                  loading="eager"
                  decoding="async"
                  className="w-full h-full object-cover"
                  draggable={false}
                />
                <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/75 via-black/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-[#080407] via-[#080407]/70 to-transparent" />
                <div className="absolute bottom-[92px] inset-x-4">
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-[32px] sm:text-[34px] font-black text-white tracking-tight truncate leading-none drop-shadow">
                      {nextCard.name}
                    </h2>
                    {nextVisibleAge !== null && (
                      <span className="font-display text-[26px] font-normal text-white/90 shrink-0 leading-none">
                        {nextVisibleAge}
                      </span>
                    )}
                    {nextVerified && (
                      <BadgeCheck className="w-6 h-6 text-sky-400 fill-sky-400 stroke-white shrink-0 drop-shadow" />
                    )}
                  </div>
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-white/90">
                    {!nextDistanceInfo.isHidden && <span>{nextCard.country?.flag || '🌎'}</span>}
                    <MapPin className="w-3.5 h-3.5 text-[#FF2E54] shrink-0" />
                    <span className="truncate">{nextDistanceInfo.text}</span>
                    {nextCard.job && (
                      <>
                        <span className="text-white/40">·</span>
                        <span className="truncate text-white font-bold">{nextCard.job}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* TARJETA 1 (Activa Superior - Full-screen hasta top:0 estilo Tinder, cambio de fotos fluido) */}
            <div
              key={`top-${topCard.uid || topCard.id}`}
              ref={activeCardRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="gpu-card touch-none absolute inset-0 z-[2] overflow-hidden bg-zinc-950 select-none cursor-grab active:cursor-grabbing"
            >
              {/* Capas de fotos pre-montadas con transición suave */}
              {topCardPhotos.map((rawUrl, idx) => {
                const isCurrent = idx === photoIdx;
                const isNextPhoto = idx === (photoIdx + 1) % topCardPhotos.length;
                const photoIsExclusive = isExclusivePhoto(topCard, rawUrl, idx);
                const photoUnlocked = isExclusivePhotoUnlocked({
                  targetUser: topCard,
                  photoUrl: rawUrl,
                  photoIndex: idx,
                  viewerUser: currentUser,
                  userUnlocks,
                  isFreeMode: accessPolicy.isFreeMode,
                });
                const optimizedSrc =
                  topCardOptimizedPhotos[idx] || optimizeCloudinaryUrl(rawUrl, CARD_PHOTO_WIDTH);
                return (
                  <img
                    key={`${topCard.uid || topCard.id}-layer-${idx}`}
                    src={optimizedSrc}
                    alt={`${topCard.name} foto ${idx + 1}`}
                    loading="eager"
                    decoding="async"
                    fetchPriority={isCurrent || isNextPhoto ? 'high' : 'low'}
                    className={`gpu-card absolute inset-0 w-full h-full object-cover pointer-events-none select-none transition-[opacity,transform] duration-200 ease-out ${
                      photoIsExclusive && !photoUnlocked
                        ? `${isCurrent ? 'opacity-100 z-[1]' : 'opacity-0 z-0'} blur-2xl scale-110 brightness-75`
                        : isCurrent
                        ? 'opacity-100 scale-100 z-[1]'
                        : 'opacity-0 scale-[1.03] z-0'
                    }`}
                    draggable={false}
                  />
                );
              })}

              {/* Viñetas sedosas superior (bajo iconos flotantes) e inferior */}
              <div className="absolute inset-x-0 top-0 h-40 z-[2] bg-gradient-to-b from-black/75 via-black/30 to-transparent pointer-events-none" />
              <div className="absolute inset-x-0 bottom-0 h-[46%] z-[2] bg-gradient-to-t from-[#080407] via-[#080407]/70 to-transparent pointer-events-none" />

              {/* Overlay para Foto Exclusiva VIP */}
              {currentSwipePhotoIsExclusive && !currentSwipePhotoUnlocked && (
                <div
                  style={{ top: 'calc(env(safe-area-inset-top, 0px) + 110px)' }}
                  className="absolute inset-x-6 z-30 flex flex-col items-center text-center pointer-events-auto"
                >
                  <div className="w-full max-w-[270px] rounded-3xl bg-zinc-950/90 border border-rose-300/35 p-4 space-y-2.5 shadow-2xl">
                    <div className="w-10 h-10 mx-auto rounded-2xl bg-gradient-to-br from-[#FF2E54] to-amber-500 flex items-center justify-center shadow">
                      <Lock className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-white">
                        Foto Exclusiva VIP de {topCard.name}
                      </p>
                      <p className="text-[10.5px] text-zinc-300 mt-0.5 leading-snug">
                        Desbloquéala por {exclusiveCostDiamonds} 💎 (van directo a {topCard.name}) o gratis con PRO.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={unlockingPhoto}
                      onClick={handleUnlockSwipeExclusivePhoto}
                      className="w-full py-2 px-3 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 text-white text-xs font-black shadow flex items-center justify-center gap-1.5"
                    >
                      <Gem className="w-3.5 h-3.5" />
                      {unlockingPhoto
                        ? 'Desbloqueando...'
                        : `Desbloquear por ${exclusiveCostDiamonds} 💎`}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        (onOpenPro || onOpenDiamondStore)?.();
                      }}
                      className="w-full py-2 px-3 rounded-full bg-gradient-to-r from-[#FF2E54] to-amber-500 text-white text-[11px] font-black shadow flex items-center justify-center gap-1"
                    >
                      <Crown className="w-3.5 h-3.5" />
                      Ver gratis con PRO
                    </button>
                  </div>
                </div>
              )}

              {/* Sellos Neón Diagonales manipulados por ref a 60fps */}
              <div
                ref={likeStampRef}
                style={{ opacity: 0, top: 'calc(env(safe-area-inset-top, 0px) + 96px)' }}
                className="absolute left-5 z-30 px-4 py-1.5 rounded-2xl border-[3.5px] border-emerald-400 bg-emerald-950/70 text-emerald-300 font-display font-black text-2xl sm:text-3xl tracking-wider -rotate-12 shadow-[0_0_26px_rgba(52,211,153,0.65)] drop-shadow-[0_0_10px_rgba(52,211,153,0.9)] pointer-events-none"
              >
                ME GUSTA
              </div>

              <div
                ref={nopeStampRef}
                style={{ opacity: 0, top: 'calc(env(safe-area-inset-top, 0px) + 96px)' }}
                className="absolute right-5 z-30 px-4 py-1.5 rounded-2xl border-[3.5px] border-[#FF2E54] bg-rose-950/70 text-[#FF4D6D] font-display font-black text-2xl sm:text-3xl tracking-wider rotate-12 shadow-[0_0_26px_rgba(255,46,84,0.65)] drop-shadow-[0_0_10px_rgba(255,46,84,0.9)] pointer-events-none"
              >
                PASAR
              </div>

              <div
                ref={superLikeStampRef}
                style={{ opacity: 0 }}
                className="absolute bottom-52 left-1/2 -translate-x-1/2 -rotate-6 z-30 px-5 py-2 rounded-2xl border-[3.5px] border-sky-400 bg-gradient-to-r from-sky-950/85 via-blue-950/85 to-amber-950/80 font-display font-black text-2xl sm:text-3xl tracking-wider shadow-[0_0_30px_rgba(56,189,248,0.75),0_0_16px_rgba(251,191,36,0.45)] inline-flex items-center gap-2 whitespace-nowrap pointer-events-none"
              >
                <Star className="w-6 h-6 text-amber-300 fill-amber-300 shrink-0" />
                <span className="bg-gradient-to-r from-sky-300 via-cyan-200 to-amber-300 bg-clip-text text-transparent">
                  SUPER LIKE
                </span>
              </div>

              {/* Barra superior estilo "Historias" + badges ligeros debajo del header flotante */}
              <div
                style={{ top: 'calc(env(safe-area-inset-top, 0px) + 54px)' }}
                className="absolute inset-x-3.5 z-20 space-y-2 pointer-events-none"
              >
                {topCardPhotos.length > 1 && (
                  <div className="flex gap-1.5 pointer-events-auto">
                    {topCardPhotos.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPhotoIdx(idx);
                        }}
                        className="h-[3px] flex-1 rounded-full bg-white/30 overflow-hidden"
                        aria-label={`Ver foto ${idx + 1}`}
                      >
                        <div
                          className={`h-full rounded-full ${
                            idx === photoIdx
                              ? 'w-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.65)]'
                              : idx < photoIdx
                              ? 'w-full bg-white/75'
                              : 'w-0'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {boosted && (
                      <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 text-zinc-950 text-[10.5px] font-black inline-flex items-center gap-1 shadow">
                        <Zap className="w-3 h-3 fill-zinc-950" /> VIP
                      </span>
                    )}

                    <span className="px-2.5 py-1 rounded-full bg-black/50 border border-white/20 text-white text-[10.5px] font-bold inline-flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      {affinity}% afinidad
                    </span>

                    {topCardPhotos.length > 1 && (
                      <span className="px-2 py-1 rounded-full bg-black/50 border border-white/20 text-white/90 text-[10px] font-bold inline-flex items-center gap-1">
                        <Camera className="w-3 h-3" /> {photoIdx + 1}/{topCardPhotos.length}
                      </span>
                    )}
                  </div>

                  {topCardIsPro && <ProCrownBadge variant="swipe" />}
                </div>
              </div>

              {/* CONTENIDO INFERIOR DE LA TARJETA */}
              <div className="absolute bottom-[92px] inset-x-4 z-20 pointer-events-auto">
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-[32px] sm:text-[34px] font-black text-white tracking-tight truncate leading-none drop-shadow">
                        {topCard.name}
                      </h2>
                      {visibleAge !== null && (
                        <span className="font-display text-[26px] font-normal text-white/90 shrink-0 leading-none">
                          {visibleAge}
                        </span>
                      )}
                      {verified && (
                        <BadgeCheck
                          className="w-6 h-6 text-sky-400 fill-sky-400 stroke-white shrink-0 drop-shadow"
                          title="Perfil verificado"
                        />
                      )}
                    </div>

                    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-white/90">
                      {!distanceInfo.isHidden && <span>{topCard.country?.flag || '🌎'}</span>}
                      <MapPin className="w-3.5 h-3.5 text-[#FF2E54] shrink-0" />
                      <span className="truncate">{distanceInfo.text}</span>
                      {topCard.job && (
                        <>
                          <span className="text-white/40">·</span>
                          <span className="truncate text-white font-bold">{topCard.job}</span>
                        </>
                      )}
                    </p>
                  </div>

                  {/* Regalo Virtual discreto a la derecha */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setGiftPickerOpen(true);
                    }}
                    className="w-10 h-10 rounded-full bg-black/50 hover:bg-amber-500/30 border border-amber-300/45 text-amber-300 flex items-center justify-center shadow-lg active:scale-90 transition shrink-0"
                    aria-label="Enviar regalo virtual"
                    title="Enviar regalo virtual"
                  >
                    <Gift className="w-[18px] h-[18px]" />
                  </button>
                </div>
              </div>

              {/* DOCK ESCULTURAL DE 4 ACCIONES ARMONIOSAS SOBRE LA FOTO */}
              <div className="absolute bottom-4 inset-x-3 z-20 flex items-center justify-center gap-4 sm:gap-5 pointer-events-auto">
                {/* 1. Pasar / X (58px) */}
                <button
                  type="button"
                  onClick={triggerPass}
                  className="w-[58px] h-[58px] rounded-full bg-[#160B11]/90 border-[1.5px] border-rose-400/50 text-[#FF4D6D] flex items-center justify-center shadow-[0_12px_28px_rgba(0,0,0,0.6),0_0_20px_rgba(255,46,84,0.24)] hover:scale-105 hover:border-[#FF2E54] active:scale-90 transition-all duration-150"
                  title="Pasar"
                  aria-label="Pasar"
                >
                  <X className="w-7 h-7 stroke-[2.8]" />
                </button>

                {/* 2. Super Like / Estrella (48px + contador semanal visible) */}
                <button
                  type="button"
                  onClick={triggerSuperLike}
                  className={`relative w-12 h-12 rounded-full bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-500 border border-sky-200/50 text-white flex items-center justify-center shadow-[0_10px_24px_rgba(56,189,248,0.45)] hover:scale-105 hover:brightness-110 active:scale-90 transition-all duration-150 ${
                    superLikeQuota.remaining <= 0 ? 'opacity-80' : ''
                  }`}
                  title={`Enviar Super Like (${superLikeQuota.remaining}/${superLikeQuota.limit} esta semana)`}
                  aria-label="Super Like"
                >
                  <Star className="w-5 h-5 fill-white text-white" />
                  <span
                    className={`absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full text-[10px] font-black flex items-center justify-center border shadow ${
                      superLikeQuota.remaining > 0
                        ? 'bg-gradient-to-r from-amber-300 to-yellow-400 text-zinc-950 border-white/80'
                        : 'bg-zinc-900 text-amber-300 border-amber-400/50'
                    }`}
                  >
                    {superLikeQuota.remaining}
                  </span>
                </button>

                {/* 3. Me Gusta / Corazón (58px) */}
                <button
                  type="button"
                  onClick={triggerLike}
                  className={`w-[58px] h-[58px] rounded-full bg-gradient-to-br ${mood.heartButton} border-[1.5px] border-white/30 text-white flex items-center justify-center hover:scale-105 hover:brightness-105 active:scale-90 transition-all duration-200`}
                  title="Me gusta"
                  aria-label="Me gusta"
                >
                  <Heart className="w-7 h-7 fill-white text-white" />
                </button>

                {/* 4. Chat Directo (44px) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartChat?.(topCard);
                  }}
                  className="w-11 h-11 rounded-full bg-zinc-950/85 border border-sky-300/40 text-sky-300 flex items-center justify-center shadow-[0_8px_20px_rgba(0,0,0,0.5)] hover:scale-105 hover:bg-sky-400/20 active:scale-90 transition-all duration-150"
                  title={
                    accessPolicy.isFreeMode
                      ? 'Enviar mensaje privado gratis (Modo Libre activo)'
                      : accessPolicy.enableDiamondCharges && accessPolicy.enableRewardedAds
                      ? `Enviar mensaje (Gratis con Match · Directo: ${accessPolicy.unlockChatDiamonds} 💎 o 1 anuncio)`
                      : accessPolicy.enableRewardedAds
                      ? 'Enviar mensaje (Gratis con Match · Directo: 1 anuncio)'
                      : `Enviar mensaje (Gratis con Match · Directo: ${accessPolicy.unlockChatDiamonds} 💎)`
                  }
                  aria-label="Chatear"
                >
                  <MessageCircle className="w-[18px] h-[18px] stroke-[2.3]" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Overlay de Tutorial Inicial (por encima del header flotante z-30) */}
        {showTutorial && (
          <div className="absolute inset-0 z-40 bg-black/90 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#FF2E54] to-amber-400 flex items-center justify-center text-3xl mb-4 shadow-xl">
              👋
            </div>
            <h3 className="font-display text-2xl font-black text-white">
              Descubre personas reales
            </h3>
            <p className="text-xs sm:text-sm text-zinc-300 mt-2 max-w-xs leading-relaxed">
              Desliza a la derecha para dar <strong className="text-emerald-300">Me Gusta</strong>, a la izquierda para <strong className="text-rose-300">Pasar</strong>, hacia arriba para <strong className="text-sky-300">Super Like</strong> o toca los lados para ver más fotos.
            </p>
            <button
              type="button"
              onClick={dismissTutorial}
              className="mt-6 w-full max-w-[240px] py-3.5 rounded-full bg-white text-black text-sm font-extrabold active:scale-95 transition-transform shadow-lg"
            >
              Comenzar a explorar
            </button>
            <button
              type="button"
              onClick={dismissTutorial}
              className="mt-3 py-2 px-4 text-xs font-bold text-zinc-400 hover:text-white"
            >
              Saltar
            </button>
          </div>
        )}
      </div>

      {/* Match Celebration Popup con avatares dobles + rompehielos con 1 toque */}
      {matchPopup && (() => {
        const target = matchPopup.targetUser;
        const matchId = matchPopup.matchId;
        const isSuperMatch = Boolean(matchPopup.isSuperLike);
        const commonTags = getSharedInterests(currentUser, target);
        const icebreakers = [
          commonTags[0]
            ? `✨ ¡Hola ${target.name}! Vi que también te gusta ${commonTags[0]}`
            : `💘 ¡Hola ${target.name}! Qué gusto hacer match contigo`,
          target.lookingFor === 'Estoy libre hoy'
            ? '🌙 ¿Qué planes te provocan para hoy?'
            : '☕ ¿Conversamos un rato para conocernos mejor?',
          '👋 ¡Hola! ¿Cómo va tu día?',
        ];

        const openMatchConversation = () => {
          setMatchPopup(null);
          onOpenChat({
            match: {
              id: matchId,
              participants: [currentUser.uid, target.uid || target.id].sort(),
            },
            peerUser: target,
          });
        };

        const sendQuickIcebreaker = async (text) => {
          if (sendingIcebreaker) return;
          setSendingIcebreaker(true);
          try {
            await sendTextMessage({
              matchId,
              senderId: currentUser.uid,
              text,
            });
            openMatchConversation();
          } catch (err) {
            onError?.(err.message || 'No se pudo enviar el mensaje.');
          } finally {
            setSendingIcebreaker(false);
          }
        };

        return (
          <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-5">
            <div
              style={{ background: mood.backdropStyle }}
              className={`w-full max-w-sm rounded-[32px] border p-6 text-center space-y-4 shadow-2xl ${
                isSuperMatch ? 'border-sky-300/45' : 'border-white/15'
              }`}
            >
              <div className="flex items-center justify-center">
                <div className="flex items-center -space-x-4">
                  <img
                    src={getPrimaryPhoto(currentUser, 240)}
                    alt={currentUser?.name}
                    className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-lg"
                  />
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center z-10 border-2 border-[#1A0710] shadow-lg ${
                      isSuperMatch
                        ? 'bg-gradient-to-br from-sky-400 to-amber-400'
                        : 'bg-gradient-to-br from-[#FF2E54] to-amber-400'
                    }`}
                  >
                    {isSuperMatch ? (
                      <Star className="w-5 h-5 text-white fill-white" />
                    ) : (
                      <Heart className="w-5 h-5 text-white fill-white" />
                    )}
                  </div>
                  <img
                    src={getPrimaryPhoto(target, 240)}
                    alt={target.name}
                    className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-lg"
                  />
                </div>
              </div>

              <div className="-mx-6">
                <div
                  className={`relative overflow-hidden py-2.5 px-4 bg-gradient-to-r ${
                    isSuperMatch
                      ? 'from-sky-500 via-blue-600 to-amber-400'
                      : 'from-[#FF1744] via-[#FF2E63] to-amber-500'
                  } border-y border-white/35 shadow-[0_10px_30px_rgba(255,46,84,0.5)]`}
                >
                  <div className="pointer-events-none absolute inset-0 pro-crown-sheen" />
                  <div className="relative flex items-center justify-center gap-2 text-white">
                    <Flame className="w-4 h-4 fill-amber-200 text-amber-200 shrink-0" />
                    <span className="font-display text-sm sm:text-base font-black italic uppercase tracking-[0.15em] drop-shadow">
                      {isSuperMatch ? '¡Super Match! · Emparejados' : '¡Han hecho Match! · Emparejados'}
                    </span>
                    <Sparkles className="w-4 h-4 text-amber-200 shrink-0" />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-serif-display text-2xl sm:text-3xl font-bold text-white mt-0.5">
                  Tú y {target.name}
                </h3>
                <p className="text-xs text-rose-100/80 mt-1">
                  Se dieron corazón mutuamente. ¡Ya están emparejados!
                </p>
              </div>

              {target.requireGiftToChat ? (
                <div className="p-3.5 rounded-2xl bg-black/40 border border-amber-300/35 text-center space-y-2">
                  <p className="text-xs font-extrabold text-amber-200 flex items-center justify-center gap-1.5">
                    <Gift className="w-4 h-4 text-amber-300" />
                    Chat exclusivo con regalo
                  </p>
                  <p className="text-[11px] text-rose-100/80 leading-relaxed">
                    {target.name} recibe chats nuevos con cualquier regalo virtual. Envíale un detalle para abrir la conversación.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 text-left pt-1">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-rose-200/75 text-center">
                    Rompe el hielo con 1 toque
                  </p>
                  {icebreakers.map((msg) => (
                    <button
                      key={msg}
                      type="button"
                      disabled={sendingIcebreaker}
                      onClick={() => sendQuickIcebreaker(msg)}
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-black/35 hover:bg-black/55 border border-white/15 text-white text-xs font-semibold text-left transition active:scale-[0.99] disabled:opacity-50"
                    >
                      {msg}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setMatchPopup(null)}
                  className="py-3 rounded-full bg-black/40 border border-white/15 text-white text-xs font-bold"
                >
                  Seguir explorando
                </button>
                <button
                  type="button"
                  onClick={openMatchConversation}
                  className="py-3 rounded-full bg-white text-black text-xs font-extrabold shadow-lg"
                >
                  {target.requireGiftToChat ? 'Enviar regalo' : 'Ir al chat'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Selector de Regalos desde Tarjeta */}
      <GiftPickerModal
        isOpen={giftPickerOpen}
        onClose={() => setGiftPickerOpen(false)}
        recipientName={topCard?.name}
        userDiamonds={getSpendableDiamonds(currentUser)}
        sendingGiftId={sendingGiftId}
        onSelectGift={handleSendGift}
        onOpenDiamondStore={() => {
          setGiftPickerOpen(false);
          onOpenDiamondStore();
        }}
      />

      <GiftAnimationOverlay giftEvent={giftAnim} onComplete={() => setGiftAnim(null)} />
    </div>
  );
}
