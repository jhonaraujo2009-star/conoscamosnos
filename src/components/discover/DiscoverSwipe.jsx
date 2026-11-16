import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  BadgeCheck,
  Camera,
  Flame,
  Gift,
  Globe,
  Heart,
  MapPin,
  MessageCircle,
  MessageCircleHeart,
  Quote,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { LOOKING_FOR_OPTIONS } from '../../config/constants';
import { sendVirtualGift } from '../../services/chatService';
import { sendLike, subscribeGivenLikesCount } from '../../services/discoveryService';
import { fetchDiscoverProfiles } from '../../services/userService';
import {
  calculateAffinityScore,
  formatInterestWithIcon,
  formatSwipeActivity,
  getPrimaryPhoto,
  getSharedInterests,
  isBoostActive,
  isProfileVerified,
  optimizeCloudinaryUrl,
} from '../../utils/formatters';
import GiftAnimationOverlay from '../chat/GiftAnimationOverlay';
import GiftPickerModal from '../chat/GiftPickerModal';

const TUTORIAL_STORAGE_KEY = 'conoscamosnos_swipe_tutorial_seen_v2';

export default function DiscoverSwipe({
  currentUser,
  onSelectProfile,
  onStartChat,
  onOpenChat,
  onOpenBoost,
  onOpenCoinStore,
  onSuccess,
  onError,
}) {
  const [scope, setScope] = useState('global');
  const [intention, setIntention] = useState('Todos');
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showTasteBanner, setShowTasteBanner] = useState(false);
  const [givenLikesTotal, setGivenLikesTotal] = useState(0);

  const [cards, setCards] = useState([]);
  const [history, setHistory] = useState([]);
  const [totalDeckCount, setTotalDeckCount] = useState(0);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [matchPopup, setMatchPopup] = useState(null);

  // Regalos desde la tarjeta
  const [giftPickerOpen, setGiftPickerOpen] = useState(false);
  const [sendingGiftId, setSendingGiftId] = useState(null);
  const [giftAnim, setGiftAnim] = useState(null);

  // Tutorial condicional la primera vez
  const [showTutorial, setShowTutorial] = useState(() => {
    try {
      return !localStorage.getItem(TUTORIAL_STORAGE_KEY);
    } catch {
      return true;
    }
  });

  // Referencias DOM directas para 60fps sin re-renders de React durante el gesto
  const activeCardRef = useRef(null);
  const likeStampRef = useRef(null);
  const nopeStampRef = useRef(null);
  const busyRef = useRef(false);
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

  // Contador real de Likes enviados desde Firestore
  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = subscribeGivenLikesCount(currentUser.uid, setGivenLikesTotal);
    return () => unsub();
  }, [currentUser?.uid]);

  const resetCardDomStyle = useCallback((withTransition = false) => {
    const el = activeCardRef.current;
    if (!el) return;
    el.style.transition = withTransition
      ? 'transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1)'
      : 'none';
    el.style.transform = 'translate3d(0px, 0px, 0px) rotate(0deg)';
    if (likeStampRef.current) likeStampRef.current.style.opacity = '0';
    if (nopeStampRef.current) nopeStampRef.current.style.opacity = '0';
  }, []);

  const loadCandidates = useCallback(
    async (forceIncludeAll = false) => {
      const user = currentUserRef.current;
      if (!user?.uid) return;
      setLoading(true);
      setHistory([]);
      setPhotoIdx(0);
      busyRef.current = false;

      try {
        let list = await fetchDiscoverProfiles({
          currentUser: user,
          scope,
          lookingForFilter: intention,
          includeAlreadyLiked: forceIncludeAll,
        });

        if (list.length === 0 && !forceIncludeAll && intention === 'Todos') {
          list = await fetchDiscoverProfiles({
            currentUser: user,
            scope,
            lookingForFilter: intention,
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
    [currentUser?.uid, currentUser?.country?.code, blockedKey, scope, intention, onError]
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

  // VIRTUALIZACIÓN DEL MAZO: Solo máximo 2 tarjetas en el DOM (activa + siguiente)
  const visibleDeck = cards.slice(0, 2);
  const topCard = visibleDeck[0] || null;
  const nextCard = visibleDeck[1] || null;

  const topCardPhotos = useMemo(() => {
    if (!topCard) return [];
    if (Array.isArray(topCard.photos) && topCard.photos.filter(Boolean).length > 0) {
      return topCard.photos.filter(Boolean);
    }
    return [getPrimaryPhoto(topCard, 1000)];
  }, [topCard]);

  // Precarga silenciosa de todas las fotos de la tarjeta actual y siguiente para cambio instantáneo sin parpadeos
  useEffect(() => {
    topCardPhotos.forEach((url) => {
      const img = new Image();
      img.src = optimizeCloudinaryUrl(url, 1000);
    });
    if (nextCard) {
      const nextImg = new Image();
      nextImg.src = getPrimaryPhoto(nextCard, 900);
    }
  }, [topCardPhotos, nextCard]);

  const dismissTutorial = () => {
    try {
      localStorage.setItem(TUTORIAL_STORAGE_KEY, '1');
    } catch {
      // Ignorar si localStorage está restringido
    }
    setShowTutorial(false);
  };

  const flyOutAndAdvance = useCallback((direction, targetCard, onAfterAdvance) => {
    const el = activeCardRef.current;
    if (el) {
      const targetX = direction === 'right' ? window.innerWidth + 180 : -(window.innerWidth + 180);
      const targetRot = direction === 'right' ? 18 : -18;
      el.style.transition = 'transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1)';
      el.style.transform = `translate3d(${targetX}px, 16px, 0px) rotate(${targetRot}deg)`;
      if (direction === 'right' && likeStampRef.current) {
        likeStampRef.current.style.opacity = '1';
      }
      if (direction === 'left' && nopeStampRef.current) {
        nopeStampRef.current.style.opacity = '1';
      }
    }

    setTimeout(() => {
      if (activeCardRef.current) {
        activeCardRef.current.style.transition = 'none';
        activeCardRef.current.style.transform = 'translate3d(0px, 0px, 0px) rotate(0deg)';
      }
      if (likeStampRef.current) likeStampRef.current.style.opacity = '0';
      if (nopeStampRef.current) nopeStampRef.current.style.opacity = '0';

      setHistory((prev) => [targetCard, ...prev]);
      setCards((prev) => prev.slice(1));
      setPhotoIdx(0);
      busyRef.current = false;
      onAfterAdvance?.();
    }, 230);
  }, []);

  const triggerPass = useCallback(() => {
    if (!topCard || busyRef.current) return;
    busyRef.current = true;
    flyOutAndAdvance('left', topCard);
  }, [topCard, flyOutAndAdvance]);

  const triggerLike = useCallback(() => {
    if (!topCard || busyRef.current) return;
    busyRef.current = true;
    const target = topCard;

    flyOutAndAdvance('right', target, async () => {
      try {
        const res = await sendLike({ currentUser: currentUserRef.current, targetUser: target });
        if (res.matched && !res.alreadyLiked) {
          setMatchPopup({ targetUser: target, matchId: res.matchId });
        }
      } catch (err) {
        onError?.(err.message || 'No se pudo enviar Like.');
      }
    });
  }, [topCard, flyOutAndAdvance, onError]);

  const handleRewind = useCallback(() => {
    if (history.length === 0 || busyRef.current) return;
    const [lastCard, ...rest] = history;
    setHistory(rest);
    setCards((prev) => [lastCard, ...prev]);
    setPhotoIdx(0);
    resetCardDomStyle(false);
  }, [history, resetCardDomStyle]);

  const handleSendGift = async (gift) => {
    if (!topCard) return;
    setSendingGiftId(gift.id);
    try {
      await sendVirtualGift({
        sender: currentUser,
        receiver: topCard,
        gift,
      });
      setGiftPickerOpen(false);
      setGiftAnim({
        giftIcon: gift.icon,
        giftName: gift.name,
        giftValue: gift.price,
        diamondsCredited: gift.price,
        isReceiver: false,
      });
      onSuccess?.(`${gift.icon} ¡Regalo ${gift.name} enviado a ${topCard.name}!`);
    } catch (err) {
      onError?.(err.message || 'Error al enviar regalo.');
    } finally {
      setSendingGiftId(null);
    }
  };

  // GESTOS DE ARRASTRE A 60FPS SIN RE-RENDERS DE REACT
  const applyFrameTransform = () => {
    dragRef.current.rafId = null;
    const el = activeCardRef.current;
    if (!el || !dragRef.current.active) return;

    const { x, y } = dragRef.current;
    const rot = x * 0.045;
    el.style.transform = `translate3d(${x}px, ${y * 0.22}px, 0px) rotate(${rot}deg)`;

    if (likeStampRef.current) {
      const likeOpacity = x > 20 ? Math.min(1, (x - 20) / 85) : 0;
      likeStampRef.current.style.opacity = String(likeOpacity);
    }
    if (nopeStampRef.current) {
      const nopeOpacity = x < -20 ? Math.min(1, (-x - 20) / 85) : 0;
      nopeStampRef.current.style.opacity = String(nopeOpacity);
    }
  };

  const handlePointerDown = (e) => {
    if (busyRef.current || showTutorial) return;
    if (e.target.closest('button')) return;

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
    if (dragRef.current.rafId) {
      cancelAnimationFrame(dragRef.current.rafId);
      dragRef.current.rafId = null;
    }

    const dx = dragRef.current.x;
    const dy = dragRef.current.y;

    if (dx > 90) {
      triggerLike();
      return;
    }
    if (dx < -90) {
      triggerPass();
      return;
    }

    resetCardDomStyle(true);

    // Cambio de foto izquierda / derecha al tocar los bordes
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8 && topCardPhotos.length > 1 && activeCardRef.current) {
      const rect = activeCardRef.current.getBoundingClientRect();
      const tapX = e.clientX - rect.left;
      const tapY = e.clientY - rect.top;
      if (tapY < rect.height * 0.72) {
        if (tapX < rect.width * 0.45) {
          setPhotoIdx((i) => (i - 1 + topCardPhotos.length) % topCardPhotos.length);
        } else if (tapX > rect.width * 0.55) {
          setPhotoIdx((i) => (i + 1) % topCardPhotos.length);
        }
      }
    }
  };

  const likesRemaining = Math.max(0, 20 - givenLikesTotal);
  const progressPercent = Math.min(100, Math.round((givenLikesTotal / 20) * 100));

  const sharedInterests = topCard ? getSharedInterests(currentUser, topCard) : [];
  const sharedSet = new Set(sharedInterests);
  const realInterests = topCard && Array.isArray(topCard.interests) ? topCard.interests.slice(0, 4) : [];
  const activity = topCard ? formatSwipeActivity(topCard) : { label: '', activeNow: false };
  const verified = topCard ? isProfileVerified(topCard) : false;
  const boosted = topCard ? isBoostActive(topCard) : false;
  const affinity = topCard ? calculateAffinityScore(currentUser, topCard) : 90;
  const activePrompt =
    topCard && Array.isArray(topCard.prompts)
      ? topCard.prompts.find((p) => typeof p === 'string' && p.trim().length > 0)
      : '';

  return (
    <div className="flex-1 h-full w-full bg-black text-white flex flex-col overflow-hidden select-none relative">
      {/* CABECERA PREMIUM */}
      <header className="shrink-0 px-4 pt-2.5 pb-2 pt-safe z-20">
        {!showTasteBanner ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowFiltersModal((v) => !v)}
                className={`w-9 h-9 rounded-full flex items-center justify-center border transition ${
                  showFiltersModal || intention !== 'Todos' || scope !== 'global'
                    ? 'bg-white text-black border-white'
                    : 'bg-zinc-900/90 text-zinc-300 border-zinc-800 hover:text-white'
                }`}
                title="Filtros de búsqueda"
              >
                <SlidersHorizontal className="w-4 h-4 stroke-[2.2]" />
              </button>

              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#FF2E54] to-amber-400 flex items-center justify-center shadow-sm">
                  <Flame className="w-3.5 h-3.5 text-white fill-white" />
                </div>
                <h1 className="text-lg font-extrabold tracking-tight text-white">Para ti</h1>
              </div>

              {(scope === 'local' || intention !== 'Todos') && (
                <span className="px-2.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-700 text-[10px] font-bold text-zinc-200 truncate max-w-[120px]">
                  {scope === 'local' ? `${currentUser?.country?.flag} ` : ''}
                  {intention !== 'Todos' ? intention : currentUser?.country?.code}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowTasteBanner(true)}
                className="w-9 h-9 rounded-full bg-zinc-900/90 border border-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center transition"
                title="Afinidad y gustos"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="5" width="11" height="15" rx="2.5" />
                  <path d="M17 7h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-9" />
                </svg>
              </button>

              <button
                type="button"
                onClick={onOpenBoost}
                className="h-9 px-3 rounded-full bg-gradient-to-r from-purple-600/30 to-fuchsia-600/30 border border-purple-500/50 text-purple-300 text-xs font-extrabold flex items-center gap-1 hover:brightness-110 transition"
                title="Activar Boost VIP"
              >
                <Zap className="w-3.5 h-3.5 fill-[#A855F7] text-[#A855F7]" />
                <span>Boost</span>
              </button>
            </div>
          </div>
        ) : (
          /* Opción B: Banner flotante blanco redondeado con progreso real de Firestore */
          <div
            onClick={() => setShowTasteBanner(false)}
            className="bg-white text-zinc-900 rounded-2xl px-3.5 py-2.5 shadow-lg flex items-center gap-3 cursor-pointer"
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
                  className="h-full rounded-full bg-gradient-to-r from-[#FF2E54] to-amber-400 transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Panel de Filtros Dinámicos */}
      {showFiltersModal && (
        <div className="mx-3 mb-2 p-3.5 rounded-3xl bg-[#141417] border border-zinc-800 z-30 space-y-3 shadow-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-zinc-200 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Personaliza a quién ves
            </span>
            <button
              type="button"
              onClick={() => setShowFiltersModal(false)}
              className="px-2.5 py-1 rounded-full bg-white text-black text-[11px] font-extrabold"
            >
              Listo
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setScope('global')}
              className={`py-2 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                scope === 'global'
                  ? 'bg-white text-black'
                  : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
              }`}
            >
              <Globe className="w-3.5 h-3.5" /> Todo el Mundo
            </button>
            <button
              type="button"
              onClick={() => setScope('local')}
              className={`py-2 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                scope === 'local'
                  ? 'bg-white text-black'
                  : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
              }`}
            >
              <span>{currentUser?.country?.flag || '📍'}</span> Mi País ({currentUser?.country?.code})
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {['Todos', ...LOOKING_FOR_OPTIONS].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setIntention(opt)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition ${
                  intention === opt
                    ? 'bg-[#FF2E54] text-white shadow'
                    : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* CONTENEDOR DEL MAZO VIRTUALIZADO (Máximo 2 tarjetas en el DOM a 60fps) */}
      <div className="flex-1 min-h-0 relative px-2 pb-2 flex flex-col">
        {loading ? (
          <div className="flex-1 rounded-[32px] bg-[#111114] border border-zinc-800/80 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="relative flex items-center justify-center">
              <div className="w-24 h-24 rounded-full border border-[#FF2E54]/40 animate-ping absolute" />
              <img
                src={getPrimaryPhoto(currentUser, 200)}
                alt={currentUser?.name}
                className="w-20 h-20 rounded-full object-cover border-2 border-[#FF2E54] relative z-10"
              />
            </div>
            <div>
              <p className="text-sm font-extrabold text-white">Encontrando perfiles reales...</p>
              <p className="text-xs text-zinc-400 mt-1">Verificando fotos y conexiones cercanas</p>
            </div>
          </div>
        ) : !topCard ? (
          /* Estado de fin del mazo: "Hasta acá por los momentos" */
          <div className="flex-1 rounded-[32px] bg-gradient-to-b from-[#16161A] to-[#0B0B0D] border border-zinc-800/80 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
            <div className="relative flex items-center justify-center mb-5">
              <div className="w-32 h-32 rounded-full border border-[#FF2E54]/25 animate-ping absolute" />
              <div className="w-24 h-24 rounded-full border border-[#FF2E54]/40 absolute" />
              <img
                src={getPrimaryPhoto(currentUser, 240)}
                alt={currentUser?.name}
                className="w-20 h-20 rounded-full object-cover border-2 border-[#FF2E54] relative z-10"
              />
            </div>

            <span className="px-3 py-1 rounded-full bg-zinc-800/90 border border-zinc-700 text-[11px] font-bold text-zinc-300 mb-2">
              {totalDeckCount > 0
                ? `${totalDeckCount} perfiles revisados`
                : 'Sin coincidencias en este filtro'}
            </span>

            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              Hasta acá por los momentos
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-2 max-w-xs leading-relaxed">
              {intention !== 'Todos'
                ? `Ya viste todas las personas disponibles en "${intention}". Prueba cambiar el filtro o volver a verlos.`
                : 'Ya recorriste todas las fotos de los perfiles disponibles en este momento.'}
            </p>

            <div className="w-full max-w-xs space-y-2.5 mt-6">
              <button
                type="button"
                onClick={() => loadCandidates(true)}
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#FF2E54] to-[#FF6B6B] text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-[#FF2E54]/25 active:scale-95 transition-transform"
              >
                <RefreshCw className="w-4 h-4" />
                Volver a ver perfiles
              </button>

              {intention !== 'Todos' && (
                <button
                  type="button"
                  onClick={() => setIntention('Todos')}
                  className="w-full py-3 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs font-bold active:scale-95 transition-transform"
                >
                  Mostrar todas las intenciones
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 relative overflow-hidden rounded-[32px]">
            {/* TARJETA 2 (Siguiente perfil debajo - Virtualización estricta de 2 nodos) */}
            {nextCard && (
              <div
                key={`next-${nextCard.uid || nextCard.id}`}
                className="absolute inset-0 rounded-[32px] overflow-hidden bg-zinc-900 border border-white/10 pointer-events-none"
              >
                <img
                  src={getPrimaryPhoto(nextCard, 900)}
                  alt={nextCard.name}
                  className="w-full h-full object-cover opacity-85 scale-[0.98]"
                  draggable={false}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
              </div>
            )}

            {/* TARJETA 1 (Activa Superior - Acelerada por GPU a 60fps y touch-action: none) */}
            <div
              key={`top-${topCard.uid || topCard.id}`}
              ref={activeCardRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="gpu-card touch-none absolute inset-0 rounded-[32px] overflow-hidden bg-zinc-950 ring-1 ring-white/15 select-none cursor-grab active:cursor-grabbing"
            >
              {/* Foto con transición suave GPU al cambiar entre las fotos del usuario */}
              <img
                key={`${topCard.uid || topCard.id}-photo-${photoIdx}`}
                src={optimizeCloudinaryUrl(topCardPhotos[photoIdx], 1080)}
                alt={`${topCard.name} foto ${photoIdx + 1}`}
                className="w-full h-full object-cover pointer-events-none animate-photo-reveal"
                draggable={false}
              />

              {/* Viñeta cinematográfica superior e inferior (sin blur dinámico para mantener 60fps) */}
              <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/75 via-black/30 to-transparent pointer-events-none" />
              <div className="absolute inset-x-0 bottom-0 h-[56%] bg-gradient-to-t from-black via-black/65 to-transparent pointer-events-none" />

              {/* Sellos visuales de Swipe manipulados por ref */}
              <div
                ref={likeStampRef}
                style={{ opacity: 0 }}
                className="absolute top-20 left-6 z-20 px-5 py-1.5 rounded-2xl border-4 border-emerald-400 bg-black/50 text-emerald-400 font-black text-3xl tracking-wider -rotate-12 pointer-events-none"
              >
                LIKE
              </div>
              <div
                ref={nopeStampRef}
                style={{ opacity: 0 }}
                className="absolute top-20 right-6 z-20 px-5 py-1.5 rounded-2xl border-4 border-[#FF2E54] bg-black/50 text-[#FF2E54] font-black text-3xl tracking-wider rotate-12 pointer-events-none"
              >
                PASAR
              </div>

              {/* Barra superior: Segmentos de fotos + Chips de confianza/foto + Botón Rewind */}
              <div className="absolute top-3.5 inset-x-4 z-20 space-y-3">
                {/* Barras horizontales segmentadas */}
                <div className="flex gap-1.5">
                  {topCardPhotos.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPhotoIdx(idx);
                      }}
                      className="h-1 flex-1 rounded-full bg-white/30 overflow-hidden"
                      aria-label={`Ver foto ${idx + 1}`}
                    >
                      <div
                        className={`h-full rounded-full transition-all duration-200 ${
                          idx === photoIdx
                            ? 'w-full bg-white'
                            : idx < photoIdx
                            ? 'w-full bg-white/75'
                            : 'w-0'
                        }`}
                      />
                    </button>
                  ))}
                </div>

                {/* Fila superior de estado y controles */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {boosted && (
                      <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 text-zinc-950 text-[11px] font-black flex items-center gap-1 shadow">
                        <Zap className="w-3 h-3 fill-zinc-950" /> VIP
                      </span>
                    )}

                    <span className="px-2.5 py-1 rounded-full bg-black/60 border border-white/15 text-white text-[11px] font-bold flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      {affinity}% afinidad
                    </span>

                    {topCardPhotos.length > 1 && (
                      <span className="px-2 py-1 rounded-full bg-black/60 border border-white/15 text-zinc-200 text-[10px] font-bold flex items-center gap-1">
                        <Camera className="w-3 h-3" /> {photoIdx + 1}/{topCardPhotos.length}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleRewind}
                    disabled={history.length === 0}
                    className="w-9 h-9 rounded-full bg-black/65 border border-white/15 text-white flex items-center justify-center disabled:opacity-35 active:scale-90 transition-transform"
                    title="Volver al perfil anterior"
                  >
                    <RotateCcw className="w-4 h-4 stroke-[2.2]" />
                  </button>
                </div>
              </div>

              {/* Contenido del Perfil en la base de la foto */}
              <div className="absolute bottom-[92px] inset-x-4 z-20 space-y-2.5 pointer-events-auto">
                {/* Fila de Badge de Presencia Real + Intención */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1.5 bg-white text-zinc-950 rounded-full px-3 py-1 text-[11px] font-extrabold shadow-sm">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        activity.activeNow ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'
                      }`}
                    />
                    {activity.label}
                  </span>

                  {topCard.lookingFor && (
                    <span className="inline-flex items-center gap-1 bg-zinc-900/90 border border-white/15 text-white rounded-full px-3 py-1 text-[11px] font-bold">
                      {topCard.lookingFor}
                    </span>
                  )}
                </div>

                {/* Nombre grande + Edad + Sello Verificado + Botón Ver Perfil (↑) */}
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-3xl font-black text-white tracking-tight truncate leading-none">
                        {topCard.name}
                      </h2>
                      <span className="text-2xl font-semibold text-white/90 shrink-0 leading-none">
                        {topCard.age || 24}
                      </span>
                      {verified && (
                        <BadgeCheck
                          className="w-6 h-6 text-sky-400 fill-sky-400 stroke-white shrink-0"
                          title="Perfil verificado"
                        />
                      )}
                    </div>

                    <p className="text-xs font-medium text-zinc-300 flex items-center gap-1.5 mt-1.5">
                      <span>{topCard.country?.flag || '🌎'}</span>
                      <MapPin className="w-3.5 h-3.5 text-[#FF2E54] shrink-0" />
                      <span className="truncate">
                        {topCard.city ? `${topCard.city}, ` : ''}
                        {topCard.country?.name || 'Global'}
                      </span>
                      {topCard.job && (
                        <>
                          <span className="text-zinc-600">•</span>
                          <span className="truncate text-zinc-200 font-semibold">{topCard.job}</span>
                        </>
                      )}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectProfile(topCard)}
                    className="w-10 h-10 rounded-full bg-zinc-900/90 border border-white/20 text-white flex items-center justify-center shrink-0 hover:bg-zinc-800 active:scale-90 transition-transform shadow-lg"
                    title="Abrir perfil completo"
                  >
                    <ArrowUp className="w-5 h-5 stroke-[2.5]" />
                  </button>
                </div>

                {/* En la Foto 2+: Mostrar frase personal o bio para conectar mejor; en Foto 1: Intereses reales */}
                {photoIdx > 0 && (activePrompt || topCard.bio) ? (
                  <div className="p-3 rounded-2xl bg-zinc-900/90 border border-white/15 space-y-1">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-rose-300 flex items-center gap-1">
                      <Quote className="w-3 h-3" /> Sobre {topCard.name}
                    </p>
                    <p className="text-xs text-white/95 font-medium leading-relaxed line-clamp-2">
                      “{activePrompt || topCard.bio}”
                    </p>
                  </div>
                ) : (
                  realInterests.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold text-zinc-300 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          Intereses
                        </p>
                        {sharedInterests.length > 0 && (
                          <span className="text-[11px] font-extrabold text-emerald-400">
                            ✨ {sharedInterests.length} en común contigo
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {realInterests.map((tag) => {
                          const isCommon = sharedSet.has(tag);
                          return (
                            <span
                              key={tag}
                              className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                                isCommon
                                  ? 'bg-emerald-500/25 border-emerald-400/60 text-emerald-200'
                                  : 'bg-zinc-900/85 border-white/15 text-white'
                              }`}
                            >
                              {formatInterestWithIcon(tag)}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* DOCK DE ACCIONES PREMIUM FLOTANTES EN LA BASE */}
              <div className="absolute bottom-4 inset-x-4 z-20 flex items-center justify-center gap-4 pointer-events-auto">
                {/* Botón Chat Privado Directo */}
                <button
                  type="button"
                  onClick={() => onStartChat?.(topCard)}
                  className="w-12 h-12 rounded-full bg-zinc-900/95 border border-white/20 text-sky-400 flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                  title="Enviar mensaje privado directo"
                  aria-label="Chatear"
                >
                  <MessageCircle className="w-5 h-5 stroke-[2.4]" />
                </button>

                {/* Botón X (Pasar) */}
                <button
                  type="button"
                  onClick={triggerPass}
                  className="w-16 h-16 rounded-full bg-[#1C1C21] border-2 border-white/15 text-white flex items-center justify-center shadow-xl active:scale-90 transition-transform"
                  aria-label="Pasar"
                >
                  <X className="w-8 h-8 stroke-[3]" />
                </button>

                {/* Botón Corazón (Me Gusta) con degradado carmesí-coral */}
                <button
                  type="button"
                  onClick={triggerLike}
                  className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FF2E54] to-[#FF5E7E] border-2 border-white/25 text-white flex items-center justify-center shadow-[0_8px_24px_rgba(255,46,84,0.45)] active:scale-90 transition-transform"
                  aria-label="Me gusta"
                >
                  <Heart className="w-8 h-8 fill-white text-white" />
                </button>

                {/* Botón Regalo Virtual */}
                <button
                  type="button"
                  onClick={() => setGiftPickerOpen(true)}
                  className="w-12 h-12 rounded-full bg-zinc-900/95 border border-amber-400/40 text-amber-400 flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                  title="Enviar regalo virtual"
                  aria-label="Regalo"
                >
                  <Gift className="w-5 h-5 stroke-[2.3]" />
                </button>
              </div>

              {/* Overlay de Tutorial Inicial (condicional la primera vez) */}
              {showTutorial && (
                <div className="absolute inset-0 z-30 bg-black/85 flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#FF2E54] to-amber-400 flex items-center justify-center text-3xl mb-4 shadow-xl">
                    👋
                  </div>
                  <h3 className="text-2xl font-black text-white">¡Vamos a empezar!</h3>
                  <p className="text-xs sm:text-sm text-zinc-300 mt-1.5 max-w-xs leading-relaxed">
                    Desliza a la derecha para dar <strong>Me Gusta</strong>, toca los bordes de la foto para ver más imágenes o chatea directo en privado.
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

      {/* Match Celebration Popup */}
      {matchPopup && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-5">
          <div className="w-full max-w-sm rounded-3xl bg-[#16161A] border border-zinc-800 p-6 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-r from-[#FF2E54] to-amber-400 flex items-center justify-center shadow-lg">
              <MessageCircleHeart className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-black text-white">¡Es un Match!</h3>
            <p className="text-xs text-zinc-400">
              A ti y a <strong className="text-white">{matchPopup.targetUser.name}</strong> se gustaron mutuamente.
            </p>
            <img
              src={getPrimaryPhoto(matchPopup.targetUser, 300)}
              alt={matchPopup.targetUser.name}
              className="w-28 h-28 mx-auto rounded-full object-cover border-2 border-[#FF2E54]"
            />
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setMatchPopup(null)}
                className="py-3 rounded-full bg-zinc-800 text-white text-xs font-bold"
              >
                Seguir deslizando
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = matchPopup.targetUser;
                  const matchId = matchPopup.matchId;
                  setMatchPopup(null);
                  onOpenChat({
                    match: {
                      id: matchId,
                      participants: [currentUser.uid, target.uid || target.id].sort(),
                    },
                    peerUser: target,
                  });
                }}
                className="py-3 rounded-full bg-[#FF2E54] text-white text-xs font-extrabold"
              >
                Enviar mensaje
              </button>
            </div>
          </div>
        </div>
      )}

      <GiftPickerModal
        isOpen={giftPickerOpen}
        onClose={() => setGiftPickerOpen(false)}
        recipientName={topCard?.name}
        userCoins={currentUser?.coins || 0}
        sendingGiftId={sendingGiftId}
        onSelectGift={handleSendGift}
        onOpenCoinStore={() => {
          setGiftPickerOpen(false);
          onOpenCoinStore?.();
        }}
      />

      <GiftAnimationOverlay giftEvent={giftAnim} onComplete={() => setGiftAnim(null)} />
    </div>
  );
}
