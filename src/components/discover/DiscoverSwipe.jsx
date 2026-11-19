import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgeCheck,
  Briefcase,
  Camera,
  ChevronDown,
  Crown,
  Flame,
  Gem,
  Gift,
  Globe,
  GraduationCap,
  Heart,
  Info,
  Lock,
  MapPin,
  MessageCircle,
  Quote,
  RefreshCw,
  RotateCcw,
  Ruler,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  User,
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
import { sendLike, subscribeGivenLikesCount } from '../../services/discoveryService';
import { fetchDiscoverProfiles } from '../../services/userService';
import {
  calculateAffinityScore,
  formatInterestWithIcon,
  formatSwipeActivity,
  formatUserDistanceLabel,
  getDisplayAge,
  getOrderedPhotos,
  getPrimaryPhoto,
  getSharedInterests,
  getSpendableDiamonds,
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

function unpersistPassedId(uid, targetId) {
  if (!uid || !targetId) return;
  try {
    const raw = localStorage.getItem(getPassedKey(uid));
    if (!raw) return;
    const map = JSON.parse(raw);
    if (map && map[targetId]) {
      delete map[targetId];
      localStorage.setItem(getPassedKey(uid), JSON.stringify(map));
    }
  } catch {
    // Ignorar
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
  const [showTasteBanner, setShowTasteBanner] = useState(false);
  const [givenLikesTotal, setGivenLikesTotal] = useState(0);
  const [bioExpanded, setBioExpanded] = useState(false);

  const [cards, setCards] = useState([]);
  const [history, setHistory] = useState([]);
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

  const resetCardDomStyle = useCallback((withTransition = false) => {
    const el = activeCardRef.current;
    if (el) {
      el.style.transition = withTransition
        ? 'transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.24s ease-out'
        : 'none';
      el.style.transform = 'translate3d(0px, 0px, 0px) rotate(0deg)';
      el.style.opacity = '1';
    }
    if (nextCardRef.current) {
      nextCardRef.current.style.transition = withTransition
        ? 'transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.24s ease-out'
        : 'none';
      nextCardRef.current.style.transform = 'translate3d(0px, 10px, 0px) scale(0.955)';
      nextCardRef.current.style.opacity = '0.72';
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
      setHistory([]);
      setPhotoIdx(0);
      setBioExpanded(false);
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
      onError,
    ]
  );

  useEffect(() => {
    loadCandidates(false);
  }, [loadCandidates]);

  useEffect(() => {
    if (!currentUser?.uid) return undefined;
    return subscribeGivenLikesCount(currentUser.uid, setGivenLikesTotal);
  }, [currentUser?.uid]);

  useEffect(() => {
    return () => {
      if (dragRef.current.rafId) {
        cancelAnimationFrame(dragRef.current.rafId);
      }
    };
  }, []);

  // VIRTUALIZACIÓN DEL MAZO: Solo máximo 2 tarjetas en el DOM (activa + siguiente)
  const visibleDeck = cards.slice(0, 2);
  const topCard = visibleDeck[0] || null;
  const nextCard = visibleDeck[1] || null;

  useEffect(() => {
    setBioExpanded(false);
  }, [topCard?.uid, topCard?.id]);

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
    return [getPrimaryPhoto(topCard, 1080, { seed: currentUser?.uid })];
  }, [topCard, currentUser?.uid]);

  // Precarga silenciosa de todas las fotos de la tarjeta actual y siguiente para cambio instantáneo sin parpadeos
  useEffect(() => {
    topCardPhotos.forEach((url) => {
      const img = new Image();
      img.src = optimizeCloudinaryUrl(url, 1080);
    });
    if (nextCard) {
      const nextImg = new Image();
      nextImg.src = getPrimaryPhoto(nextCard, 1080, { seed: currentUser?.uid });
    }
  }, [topCardPhotos, nextCard, currentUser?.uid]);

  const dismissTutorial = () => {
    try {
      localStorage.setItem(TUTORIAL_STORAGE_KEY, '1');
    } catch {
      // Ignorar si localStorage está restringido
    }
    setShowTutorial(false);
  };

  const flyOutAndAdvance = useCallback((direction, targetCard, onAfterAdvance) => {
    setBioExpanded(false);
    const el = activeCardRef.current;

    if (el) {
      if (direction === 'up') {
        el.style.transition =
          'transform 0.26s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.26s ease-out';
        el.style.transform = `translate3d(0px, -${window.innerHeight + 220}px, 0px) scale(1.04)`;
        el.style.opacity = '0.92';
        if (superLikeStampRef.current) superLikeStampRef.current.style.opacity = '1';
        if (likeStampRef.current) likeStampRef.current.style.opacity = '0';
        if (nopeStampRef.current) nopeStampRef.current.style.opacity = '0';
      } else {
        const targetX =
          direction === 'right' ? window.innerWidth + 180 : -(window.innerWidth + 180);
        const targetRot = direction === 'right' ? 18 : -18;
        el.style.transition = 'transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1)';
        el.style.transform = `translate3d(${targetX}px, 16px, 0px) rotate(${targetRot}deg)`;
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
        'transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.24s ease-out';
      nextCardRef.current.style.transform = 'translate3d(0px, 0px, 0px) scale(1)';
      nextCardRef.current.style.opacity = '1';
    }

    setTimeout(() => {
      if (activeCardRef.current) {
        activeCardRef.current.style.transition = 'none';
        activeCardRef.current.style.transform = 'translate3d(0px, 0px, 0px) rotate(0deg)';
        activeCardRef.current.style.opacity = '1';
      }
      if (nextCardRef.current) {
        nextCardRef.current.style.transition = 'none';
        nextCardRef.current.style.transform = 'translate3d(0px, 10px, 0px) scale(0.955)';
        nextCardRef.current.style.opacity = '0.72';
      }
      if (likeStampRef.current) likeStampRef.current.style.opacity = '0';
      if (nopeStampRef.current) nopeStampRef.current.style.opacity = '0';
      if (superLikeStampRef.current) superLikeStampRef.current.style.opacity = '0';

      setHistory((prev) => [targetCard, ...prev]);
      setCards((prev) => prev.slice(1));
      setPhotoIdx(0);
      busyRef.current = false;
      onAfterAdvance?.();
    }, 240);
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
        onError?.(err.message || 'No se pudo enviar Like.');
      }
    });
  }, [topCard, topCardPhotos, photoIdx, flyOutAndAdvance, onError]);

  const triggerSuperLike = useCallback(() => {
    if (!topCard || busyRef.current) return;
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
          onSuccess?.(`⭐ ¡Enviaste un Super Like a ${target.name}!`);
        }
      } catch (err) {
        onError?.(err.message || 'No se pudo enviar el Super Like.');
      }
    });
  }, [topCard, topCardPhotos, photoIdx, flyOutAndAdvance, onSuccess, onError]);

  const handleRewind = useCallback(() => {
    if (history.length === 0 || busyRef.current) return;
    triggerHaptic(10);
    setBioExpanded(false);
    const [lastCard, ...rest] = history;
    unpersistPassedId(currentUserRef.current?.uid, lastCard.uid || lastCard.id);
    setHistory(rest);
    setCards((prev) => [lastCard, ...prev]);
    setPhotoIdx(0);
    resetCardDomStyle(false);
  }, [history, resetCardDomStyle]);

  // Navegación por teclado en desktop cuando la pestaña Descubrir está activa
  useEffect(() => {
    if (!isActive || showTutorial || giftPickerOpen || matchPopup) return;
    const onKeyDown = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') {
        if (bioExpanded) {
          e.preventDefault();
          setBioExpanded(false);
        } else if (showFiltersModal) {
          e.preventDefault();
          setShowFiltersModal(false);
        }
        return;
      }
      if (showFiltersModal || bioExpanded) return;
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
    bioExpanded,
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
      const progress = isUpSwipe
        ? Math.min(1, Math.max(0, (-dy - 10) / 110))
        : Math.min(1, Math.max(0, (Math.abs(dx) - 10) / 110));
      const scale = 0.955 + 0.045 * progress;
      const translateY = 10 * (1 - progress);
      const opacity = 0.72 + 0.28 * progress;
      nextCardRef.current.style.transition = 'none';
      nextCardRef.current.style.transform = `translate3d(0px, ${translateY}px, 0px) scale(${scale})`;
      nextCardRef.current.style.opacity = String(opacity);
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
    if (busyRef.current || showTutorial || bioExpanded || showFiltersModal) return;
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

    resetCardDomStyle(true);

    // Cambio de foto izquierda / derecha al tocar los lados estilo Historias
    if (
      Math.abs(dx) < 8 &&
      Math.abs(dy) < 8 &&
      topCardPhotos.length > 1 &&
      activeCardRef.current &&
      !bioExpanded &&
      !showFiltersModal
    ) {
      const rect = activeCardRef.current.getBoundingClientRect();
      const tapX = e.clientX - rect.left;
      const tapY = e.clientY - rect.top;
      if (tapY < rect.height * 0.68) {
        if (tapX < rect.width * 0.42) {
          setPhotoIdx((i) => (i - 1 + topCardPhotos.length) % topCardPhotos.length);
        } else if (tapX > rect.width * 0.58) {
          setPhotoIdx((i) => (i + 1) % topCardPhotos.length);
        }
      }
    }
  };

  const likesRemaining = Math.max(0, 20 - givenLikesTotal);
  const progressPercent = Math.min(100, Math.round((givenLikesTotal / 20) * 100));
  const passportCountry = useMemo(
    () => (passportCountryCode ? COUNTRIES.find((c) => c.code === passportCountryCode) : null),
    [passportCountryCode]
  );

  const sharedInterests = topCard ? getSharedInterests(currentUser, topCard) : [];
  const sharedSet = new Set(sharedInterests);
  const cardInterests =
    topCard && Array.isArray(topCard.interests) ? topCard.interests.slice(0, 3) : [];
  const allInterests = topCard && Array.isArray(topCard.interests) ? topCard.interests : [];
  const activity = topCard ? formatSwipeActivity(topCard) : { label: '', activeNow: false };
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
  const filledPrompts =
    topCard && Array.isArray(topCard.prompts)
      ? topCard.prompts.filter((p) => typeof p === 'string' && p.trim().length > 0)
      : [];
  const drawerDetails = topCard
    ? [
        topCard.lookingFor ? { icon: Flame, label: topCard.lookingFor } : null,
        topCard.job ? { icon: Briefcase, label: topCard.job } : null,
        topCard.education ? { icon: GraduationCap, label: topCard.education } : null,
        topCard.height ? { icon: Ruler, label: topCard.height } : null,
        topCard.lifestyle ? { icon: Sparkles, label: topCard.lifestyle } : null,
      ].filter(Boolean)
    : [];

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
      {/* CABECERA EDITORIAL ADAPTATIVA + TIRA VIVA DE INTENCIONES */}
      <header className="shrink-0 pt-2.5 pb-1.5 pt-safe z-30 space-y-2">
        {!showTasteBanner ? (
          <div className="px-3.5 flex items-center justify-between gap-2">
            {/* Izquierda: Logo marca + Descubrir + Subtítulo contextual */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-[11px] bg-gradient-to-tr from-[#FF2E54] via-rose-500 to-amber-400 shadow-[0_6px_18px_rgba(255,46,84,0.45)] flex items-center justify-center shrink-0">
                <Flame className="w-4 h-4 text-white fill-white" />
              </div>
              <div className="min-w-0">
                <h1 className="font-display text-[19px] font-black tracking-tight text-white leading-none truncate">
                  Descubrir
                </h1>
                <p className="text-[10.5px] font-semibold text-white/65 leading-tight mt-0.5 truncate flex items-center gap-1">
                  {passportCountry ? (
                    <>
                      <span>✈️</span>
                      <span className="truncate">
                        {passportCountry.flag} {passportCountry.name}
                      </span>
                    </>
                  ) : (
                    <>
                      <span>{mood.emoji}</span>
                      <span className="truncate">{mood.label}</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Derecha: PRO · Boost · Filtros */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onOpenPro || onOpenDiamondStore}
                className={`h-8 px-2.5 rounded-full border text-[11px] font-extrabold flex items-center gap-1 backdrop-blur-md hover:brightness-110 active:scale-95 transition ${
                  proActive
                    ? 'bg-gradient-to-r from-[#FF2E54] to-amber-500 border-amber-200/60 text-white shadow-[0_4px_14px_rgba(245,158,11,0.35)]'
                    : 'bg-gradient-to-r from-[#2D141F]/90 to-[#2B1F10]/90 border-amber-300/40 text-amber-200'
                }`}
                title="Conoscamosnos PRO"
              >
                <Crown className="w-3.5 h-3.5 text-amber-300" />
                <span>PRO</span>
              </button>

              <button
                type="button"
                onClick={onOpenBoost}
                className="h-8 px-2.5 rounded-full bg-purple-500/20 border border-purple-300/35 text-purple-200 text-[11px] font-extrabold flex items-center gap-1 backdrop-blur-md hover:bg-purple-500/30 active:scale-95 transition"
                title="Activar Boost VIP"
              >
                <Zap className="w-3.5 h-3.5 fill-purple-300 text-purple-300" />
                <span>Boost</span>
              </button>

              <button
                type="button"
                onClick={() => setShowFiltersModal((v) => !v)}
                className={`relative w-8 h-8 rounded-full flex items-center justify-center border backdrop-blur-md active:scale-95 transition shrink-0 ${
                  showFiltersModal || hasCustomFilters
                    ? 'bg-white text-zinc-950 border-white shadow-lg'
                    : 'bg-white/10 text-white border-white/15 hover:bg-white/20'
                }`}
                aria-label="Filtros de búsqueda"
                title="Filtros de búsqueda"
              >
                <SlidersHorizontal className="w-4 h-4 stroke-[2.2]" />
                {hasCustomFilters && !showFiltersModal && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#FF2E54] ring-2 ring-[#1A0710] animate-pulse" />
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Banner amigable de progreso de gustos reales */
          <div className="px-3.5">
            <div
              onClick={() => setShowTasteBanner(false)}
              className="bg-white/95 backdrop-blur-xl text-zinc-900 rounded-2xl px-3.5 py-2.5 shadow-xl flex items-center gap-3 cursor-pointer"
            >
              <div className="w-9 h-9 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <Heart className="w-5 h-5 text-[#FF2E54] fill-[#FF2E54]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-extrabold text-zinc-900 leading-snug">
                  {likesRemaining > 0
                    ? `Conociendo tus gustos — Da ${likesRemaining} Likes más`
                    : '✨ ¡Algoritmo calibrado con tus gustos!'}
                </p>
                <div className="w-full h-1.5 rounded-full bg-zinc-100 mt-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${mood.progressGrad} transition-all duration-500`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tira horizontal sutil de intenciones + chip de Tus Gustos */}
        {!showTasteBanner && !showFiltersModal && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar px-3.5 pb-0.5">
            {['Todos', ...LOOKING_FOR_OPTIONS].map((opt) => {
              const optMood = getIntentionMood(opt);
              const selected = intention === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setIntention(opt)}
                  className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1 transition-all duration-300 ${
                    selected
                      ? optMood.pillActive
                      : 'bg-white/[0.08] border-white/[0.12] text-white/80 hover:bg-white/[0.15] hover:text-white'
                  }`}
                >
                  <span>{optMood.emoji}</span>
                  <span>{opt === 'Todos' ? 'Todos' : optMood.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setShowTasteBanner(true)}
              className="shrink-0 px-3 py-1 rounded-full text-[11px] font-bold border bg-white/[0.08] border-white/[0.12] text-rose-200 hover:bg-white/[0.15] flex items-center gap-1 transition"
              title="Ver afinidad y calibración de gustos"
            >
              <span>💗</span>
              <span>{progressPercent > 0 ? `${progressPercent}%` : 'Tus gustos'}</span>
            </button>
          </div>
        )}
      </header>

      {/* PANEL DESPLEGABLE DE FILTROS CON SCRIM DIFUMINADO */}
      {showFiltersModal && (
        <>
          <div
            onClick={() => setShowFiltersModal(false)}
            className="fixed inset-0 z-30 bg-black/55 backdrop-blur-sm"
          />
          <div className="absolute inset-x-3 top-14 mt-safe z-40 max-h-[78dvh] overflow-y-auto no-scrollbar p-4 rounded-[28px] bg-[#140811]/95 backdrop-blur-2xl border border-white/15 space-y-3.5 shadow-[0_24px_60px_rgba(0,0,0,0.8)] animate-sheet-up">
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

          {/* Intención / Vibra */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
              Qué buscan
            </p>
            <div className="flex flex-wrap gap-1.5">
              {['Todos', ...LOOKING_FOR_OPTIONS].map((opt) => {
                const optMood = getIntentionMood(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setIntention(opt)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition flex items-center gap-1 ${
                      intention === opt
                        ? optMood.pillActive
                        : 'bg-white/10 text-zinc-300 border-white/10 hover:text-white'
                    }`}
                  >
                    <span>{optMood.emoji}</span>
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

      {/* CONTENEDOR DEL MAZO VIRTUALIZADO A PANTALLA COMPLETA (Máximo 2 nodos en el DOM) */}
      <div className="flex-1 min-h-0 relative px-2.5 pt-0.5 pb-2.5 flex flex-col">
        {loading ? (
          <div className="flex-1 rounded-[30px] bg-black/35 border border-white/10 shadow-[0_24px_60px_-14px_rgba(0,0,0,0.9)] flex flex-col items-center justify-center gap-4 p-6 text-center">
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
              <p className="text-xs text-rose-200/75 mt-1">
                Preparando tarjetas en {mood.emoji} {mood.label}
              </p>
            </div>
          </div>
        ) : !topCard ? (
          <div className="flex-1 rounded-[30px] bg-black/40 border border-white/10 shadow-[0_24px_60px_-14px_rgba(0,0,0,0.9)] flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
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
            {/* TARJETA 2 (Siguiente perfil debajo - profundidad fluida a 60fps) */}
            {nextCard && (
              <div
                key={`next-${nextCard.uid || nextCard.id}`}
                ref={nextCardRef}
                style={{
                  transform: 'translate3d(0px, 10px, 0px) scale(0.955)',
                  opacity: 0.72,
                }}
                className="gpu-card absolute inset-0 rounded-[30px] overflow-hidden bg-zinc-900 border border-white/10 shadow-[0_18px_45px_-12px_rgba(0,0,0,0.75)] pointer-events-none"
              >
                <img
                  src={getPrimaryPhoto(nextCard, 1080, { seed: currentUser?.uid })}
                  alt={nextCard.name}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#080407] via-[#080407]/45 to-transparent" />
              </div>
            )}

            {/* TARJETA 1 (Activa Superior - Full Bleed Inmersiva 60fps) */}
            <div
              key={`top-${topCard.uid || topCard.id}`}
              ref={activeCardRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className={`gpu-card touch-none absolute inset-0 rounded-[30px] overflow-hidden bg-zinc-950 select-none cursor-grab active:cursor-grabbing ${
                topCardIsPro
                  ? 'ring-[1.5px] ring-amber-300/50 shadow-[0_24px_60px_-14px_rgba(0,0,0,0.9),0_0_32px_-8px_rgba(245,197,86,0.34)]'
                  : 'ring-1 ring-white/15 shadow-[0_24px_60px_-14px_rgba(0,0,0,0.9)]'
              }`}
            >
              {/* Foto principal ocupando toda la altura vertical */}
              <img
                key={`${topCard.uid || topCard.id}-photo-${photoIdx}`}
                src={optimizeCloudinaryUrl(topCardPhotos[photoIdx], 1080)}
                alt={`${topCard.name} foto ${photoIdx + 1}`}
                className={`w-full h-full object-cover pointer-events-none animate-photo-reveal transition duration-300 ${
                  currentSwipePhotoIsExclusive && !currentSwipePhotoUnlocked
                    ? 'blur-2xl scale-110 brightness-75'
                    : ''
                }`}
                draggable={false}
              />

              {/* Viñetas sedosas cinematográficas (rostros brillantes + contraste editorial abajo) */}
              <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 via-black/20 to-transparent pointer-events-none" />
              <div className="absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-[#080407] via-[#080407]/75 to-transparent pointer-events-none" />

              {/* Overlay para Foto Exclusiva VIP */}
              {currentSwipePhotoIsExclusive && !currentSwipePhotoUnlocked && (
                <div className="absolute inset-x-6 top-24 z-30 flex flex-col items-center text-center pointer-events-auto">
                  <div className="w-full max-w-[270px] rounded-3xl bg-zinc-950/85 border border-rose-300/35 p-4 space-y-2.5 shadow-2xl">
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
                style={{ opacity: 0 }}
                className="absolute top-16 left-5 z-30 px-4 py-1.5 rounded-2xl border-[3.5px] border-emerald-400 bg-emerald-950/45 backdrop-blur-sm text-emerald-300 font-display font-black text-2xl sm:text-3xl tracking-wider -rotate-12 shadow-[0_0_26px_rgba(52,211,153,0.65)] drop-shadow-[0_0_10px_rgba(52,211,153,0.9)] pointer-events-none"
              >
                ME GUSTA
              </div>

              <div
                ref={nopeStampRef}
                style={{ opacity: 0 }}
                className="absolute top-16 right-5 z-30 px-4 py-1.5 rounded-2xl border-[3.5px] border-[#FF2E54] bg-rose-950/45 backdrop-blur-sm text-[#FF4D6D] font-display font-black text-2xl sm:text-3xl tracking-wider rotate-12 shadow-[0_0_26px_rgba(255,46,84,0.65)] drop-shadow-[0_0_10px_rgba(255,46,84,0.9)] pointer-events-none"
              >
                PASAR
              </div>

              <div
                ref={superLikeStampRef}
                style={{ opacity: 0 }}
                className="absolute bottom-52 left-1/2 -translate-x-1/2 -rotate-6 z-30 px-5 py-2 rounded-2xl border-[3.5px] border-sky-400 bg-gradient-to-r from-sky-950/70 via-blue-950/70 to-amber-950/60 backdrop-blur-sm font-display font-black text-2xl sm:text-3xl tracking-wider shadow-[0_0_30px_rgba(56,189,248,0.75),0_0_16px_rgba(251,191,36,0.45)] inline-flex items-center gap-2 whitespace-nowrap pointer-events-none"
              >
                <Star className="w-6 h-6 text-amber-300 fill-amber-300 shrink-0" />
                <span className="bg-gradient-to-r from-sky-300 via-cyan-200 to-amber-300 bg-clip-text text-transparent">
                  SUPER LIKE
                </span>
              </div>

              {/* Barra superior estilo "Historias" + badges discretos + Corona PRO a la derecha */}
              <div className="absolute top-3 inset-x-3.5 z-20 space-y-2.5 pointer-events-none">
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
                        className="h-[3.5px] flex-1 rounded-full bg-white/30 overflow-hidden"
                        aria-label={`Ver foto ${idx + 1}`}
                      >
                        <div
                          className={`h-full rounded-full transition-all duration-200 ${
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

                    <span className="px-2.5 py-1 rounded-full bg-black/45 backdrop-blur-md border border-white/15 text-white text-[10.5px] font-bold inline-flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      {affinity}% afinidad
                    </span>

                    {topCardPhotos.length > 1 && (
                      <span className="px-2 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/15 text-white/85 text-[10px] font-bold inline-flex items-center gap-1">
                        <Camera className="w-3 h-3" /> {photoIdx + 1}/{topCardPhotos.length}
                      </span>
                    )}
                  </div>

                  {topCardIsPro && <ProCrownBadge variant="swipe" />}
                </div>
              </div>

              {/* CONTENIDO EDITORIAL INFERIOR DE LA TARJETA + UTILIDADES */}
              <div className="absolute bottom-[84px] inset-x-4 z-20 space-y-2 pointer-events-auto">
                {/* Fila contextual: presencia + lo que busca */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold shadow-sm ${
                      activity.activeNow
                        ? 'bg-white/95 text-zinc-950'
                        : 'bg-black/45 backdrop-blur-md border border-white/15 text-white/90'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        activity.activeNow ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'
                      }`}
                    />
                    {activity.label}
                  </span>

                  {topCard.lookingFor && (
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-white/15 backdrop-blur-md border border-white/20 text-white">
                      {topCard.lookingFor}
                    </span>
                  )}
                </div>

                {/* Identidad grande + utilidades discretas a la derecha (Regalo + Biografía) */}
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-[30px] sm:text-[32px] font-black text-white tracking-tight truncate leading-none drop-shadow">
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

                    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-white/85">
                      {!distanceInfo.isHidden && <span>{topCard.country?.flag || '🌎'}</span>}
                      <MapPin className="w-3.5 h-3.5 text-[#FF2E54] shrink-0" />
                      <span className="truncate">{distanceInfo.text}</span>
                      {topCard.job && (
                        <>
                          <span className="text-white/40">·</span>
                          <span className="truncate text-white/90 font-bold">{topCard.job}</span>
                        </>
                      )}
                    </p>
                  </div>

                  {/* Pila vertical derecha: Regalo Virtual + Biografía Completa */}
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setGiftPickerOpen(true);
                      }}
                      className="w-10 h-10 rounded-full bg-black/45 hover:bg-amber-500/25 backdrop-blur-md border border-amber-300/40 text-amber-300 flex items-center justify-center shadow-lg active:scale-90 transition"
                      aria-label="Enviar regalo virtual"
                      title="Enviar regalo virtual"
                    >
                      <Gift className="w-[18px] h-[18px]" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setBioExpanded((v) => !v);
                      }}
                      className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/25 text-white flex items-center justify-center shadow-lg active:scale-90 transition"
                      aria-label="Ver biografía completa"
                      title="Ver biografía completa"
                    >
                      {bioExpanded ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <Info className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Slot inteligente: Foto 2+ muestra frase personal; Foto 1 muestra chips translúcidos de intereses */}
                {photoIdx > 0 && (filledPrompts[0] || topCard.bio) ? (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setBioExpanded(true);
                    }}
                    className="bg-black/45 backdrop-blur-md border border-white/15 rounded-2xl px-3 py-2 cursor-pointer hover:bg-black/55 transition space-y-0.5"
                  >
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-rose-300 flex items-center gap-1">
                      <Quote className="w-3 h-3" /> Sobre {topCard.name}
                    </p>
                    <p className="text-xs text-white/95 font-medium leading-snug line-clamp-2">
                      “{filledPrompts[0] || topCard.bio}”
                    </p>
                  </div>
                ) : (
                  cardInterests.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {cardInterests.map((tag) => {
                        const isCommon = sharedSet.has(tag);
                        return (
                          <span
                            key={tag}
                            className={`rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-md border shadow-[0_4px_14px_rgba(0,0,0,0.22)] ${
                              isCommon
                                ? 'bg-emerald-400/20 border-emerald-300/50 text-white'
                                : 'bg-white/15 border-white/25 text-white/95'
                            }`}
                          >
                            {formatInterestWithIcon(tag)}
                          </span>
                        );
                      })}
                      {sharedInterests.length > 0 && (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-300/40 text-emerald-200 text-[10.5px] font-extrabold">
                          ✨ {sharedInterests.length} en común
                        </span>
                      )}
                    </div>
                  )
                )}
              </div>

              {/* DOCK ESCULTURAL DE 5 ACCIONES ARMONIOSAS DENTRO DE LA TARJETA */}
              <div className="absolute bottom-3.5 inset-x-3 z-20 flex items-center justify-center gap-3 sm:gap-4 pointer-events-auto">
                {/* 1. Deshacer (40px, vidrio ámbar) */}
                <button
                  type="button"
                  onClick={handleRewind}
                  disabled={history.length === 0}
                  className="w-10 h-10 rounded-full bg-zinc-950/75 backdrop-blur-xl border border-amber-300/35 text-amber-300 flex items-center justify-center shadow-[0_8px_20px_rgba(0,0,0,0.45)] hover:scale-105 hover:bg-amber-400/15 active:scale-90 disabled:opacity-35 disabled:pointer-events-none transition-all duration-150"
                  title="Deshacer último perfil"
                  aria-label="Deshacer"
                >
                  <RotateCcw className="w-[18px] h-[18px] stroke-[2.3]" />
                </button>

                {/* 2. Pasar / X (58px, terciopelo oscuro con brillo carmesí) */}
                <button
                  type="button"
                  onClick={triggerPass}
                  className="w-[58px] h-[58px] rounded-full bg-[#160B11]/85 backdrop-blur-xl border-[1.5px] border-rose-400/45 text-[#FF4D6D] flex items-center justify-center shadow-[0_12px_28px_rgba(0,0,0,0.55),0_0_20px_rgba(255,46,84,0.2)] hover:scale-105 hover:border-[#FF2E54] active:scale-90 transition-all duration-150"
                  title="Pasar"
                  aria-label="Pasar"
                >
                  <X className="w-7 h-7 stroke-[2.8]" />
                </button>

                {/* 3. Super Like / Estrella (48px, gema zafiro) */}
                <button
                  type="button"
                  onClick={triggerSuperLike}
                  className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-500 border border-sky-200/50 text-white flex items-center justify-center shadow-[0_10px_24px_rgba(56,189,248,0.45)] hover:scale-105 hover:brightness-110 active:scale-90 transition-all duration-150"
                  title="Enviar Super Like"
                  aria-label="Super Like"
                >
                  <Star className="w-5 h-5 fill-white text-white" />
                </button>

                {/* 4. Me Gusta / Corazón (58px, gradiente adaptativo de marca Conoscamosnos) */}
                <button
                  type="button"
                  onClick={triggerLike}
                  className={`w-[58px] h-[58px] rounded-full bg-gradient-to-br ${mood.heartButton} border-[1.5px] border-white/30 text-white flex items-center justify-center hover:scale-105 hover:brightness-105 active:scale-90 transition-all duration-200`}
                  title="Me gusta"
                  aria-label="Me gusta"
                >
                  <Heart className="w-7 h-7 fill-white text-white" />
                </button>

                {/* 5. Chat Directo (40px, vidrio zafiro) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartChat?.(topCard);
                  }}
                  className="w-10 h-10 rounded-full bg-zinc-950/75 backdrop-blur-xl border border-sky-300/35 text-sky-300 flex items-center justify-center shadow-[0_8px_20px_rgba(0,0,0,0.45)] hover:scale-105 hover:bg-sky-400/15 active:scale-90 transition-all duration-150"
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

              {/* HOJA DESPLEGABLE IN-CARD PARA BIOGRAFÍA COMPLETA SIN SALIR DE LA VISTA */}
              {bioExpanded && (
                <>
                  <div
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setBioExpanded(false);
                    }}
                    className="absolute inset-0 z-[25] bg-black/45 backdrop-blur-[2px]"
                  />
                  <div
                    onPointerDown={(e) => e.stopPropagation()}
                    className="absolute inset-x-0 bottom-0 max-h-[80%] z-30 rounded-t-[28px] bg-[#120911]/92 backdrop-blur-xl border-t border-white/20 flex flex-col overflow-hidden animate-sheet-up shadow-[0_-16px_40px_rgba(0,0,0,0.65)] touch-pan-y"
                  >
                    <div className="px-4 pt-2.5 pb-3 border-b border-white/10 shrink-0">
                      <div className="w-10 h-1 rounded-full bg-white/25 mx-auto mb-2.5" />
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <h3 className="font-display text-lg font-black text-white truncate">
                            {topCard.name}
                            {visibleAge !== null ? `, ${visibleAge}` : ''}
                          </h3>
                          {verified && (
                            <BadgeCheck className="w-4 h-4 text-sky-400 fill-sky-400 stroke-white shrink-0" />
                          )}
                          {topCardIsPro && <ProCrownBadge variant="compact" />}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBioExpanded(false);
                          }}
                          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center shrink-0 transition"
                          aria-label="Cerrar biografía"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3.5 text-left">
                      <div className="space-y-1">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-rose-300">
                          Biografía
                        </p>
                        <p className="text-xs sm:text-sm text-white/95 leading-relaxed font-medium">
                          {topCard.bio?.trim()
                            ? topCard.bio
                            : `${topCard.name} prefiere sorprenderte conversando en privado.`}
                        </p>
                      </div>

                      {filledPrompts.length > 0 && (
                        <div className="space-y-2">
                          {filledPrompts.map((promptText, idx) => (
                            <div
                              key={idx}
                              className="p-3 rounded-2xl bg-white/10 border border-white/15 space-y-1"
                            >
                              <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1">
                                <Quote className="w-3 h-3" /> Frase #{idx + 1}
                              </p>
                              <p className="text-xs text-white font-semibold leading-relaxed">
                                “{promptText}”
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
                          Sobre {topCard.name}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-bold text-amber-200 inline-flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-300" />
                            {affinity}% afinidad
                          </span>
                          <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-bold text-white/90">
                            {activity.label}
                          </span>
                          {drawerDetails.map((item, idx) => {
                            const Icon = item.icon;
                            return (
                              <span
                                key={idx}
                                className="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-semibold text-white/90 inline-flex items-center gap-1"
                              >
                                <Icon className="w-3 h-3 text-[#FF2E54]" />
                                {item.label}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {allInterests.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
                              Intereses
                            </p>
                            {sharedInterests.length > 0 && (
                              <span className="text-[10.5px] font-extrabold text-emerald-400">
                                ✨ {sharedInterests.length} en común
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {allInterests.map((tag) => {
                              const isCommon = sharedSet.has(tag);
                              return (
                                <span
                                  key={tag}
                                  className={`rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-md border ${
                                    isCommon
                                      ? 'bg-emerald-400/20 border-emerald-300/50 text-white'
                                      : 'bg-white/15 border-white/25 text-white/95'
                                  }`}
                                >
                                  {formatInterestWithIcon(tag)}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Acciones rápidas al pie del panel de biografía */}
                    <div className="p-3 border-t border-white/10 bg-black/35 grid grid-cols-3 gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setBioExpanded(false);
                          onStartChat?.(topCard);
                        }}
                        className="py-2.5 px-2 rounded-2xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 text-xs font-extrabold flex items-center justify-center gap-1.5 transition"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Chatear
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setBioExpanded(false);
                          setGiftPickerOpen(true);
                        }}
                        className="py-2.5 px-2 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 text-xs font-extrabold flex items-center justify-center gap-1.5 transition"
                      >
                        <Gift className="w-3.5 h-3.5" />
                        Regalar
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setBioExpanded(false);
                          onSelectProfile?.(topCard);
                        }}
                        className="py-2.5 px-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition"
                      >
                        <User className="w-3.5 h-3.5" />
                        Perfil
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Overlay de Tutorial Inicial */}
              {showTutorial && (
                <div className="absolute inset-0 z-40 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
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

              <div>
                <p
                  className={`text-[11px] font-extrabold uppercase tracking-widest ${
                    isSuperMatch ? 'text-sky-300' : 'text-rose-300'
                  }`}
                >
                  {isSuperMatch ? '⭐ ¡Conexión Destacada!' : '¡Conexión mutua!'}
                </p>
                <h3 className="font-serif-display text-3xl font-bold text-white mt-0.5">
                  {isSuperMatch ? '¡Es un Super Match!' : '¡Es un Match!'}
                </h3>
                <p className="text-xs text-rose-100/80 mt-1">
                  A ti y a <strong className="text-white">{target.name}</strong> se gustaron mutuamente.
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
