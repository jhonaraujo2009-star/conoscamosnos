import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Heart,
  MessageCircleHeart,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { LOOKING_FOR_OPTIONS } from '../../config/constants';
import { sendLike } from '../../services/discoveryService';
import { fetchDiscoverProfiles } from '../../services/userService';
import { getPrimaryPhoto, optimizeCloudinaryUrl } from '../../utils/formatters';

const TUTORIAL_STORAGE_KEY = 'conoscamosnos_swipe_tutorial_seen_v1';
const DEFAULT_INTEREST_PILLS = ['Amor propio', 'Estilo de vida activo', 'Desarrollo personal'];

export default function DiscoverSwipe({
  currentUser,
  onSelectProfile,
  onOpenChat,
  onOpenBoost,
  onSuccess,
  onError,
}) {
  const [scope, setScope] = useState('global');
  const [intention, setIntention] = useState('Todos');
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showTasteBanner, setShowTasteBanner] = useState(false);
  const [likesCountdown, setLikesCountdown] = useState(20);

  const [cards, setCards] = useState([]);
  const [history, setHistory] = useState([]);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [matchPopup, setMatchPopup] = useState(null);

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

        if (list.length === 0 && !forceIncludeAll) {
          list = await fetchDiscoverProfiles({
            currentUser: user,
            scope,
            lookingForFilter: intention,
            includeAlreadyLiked: true,
          });
        }

        setCards(list);
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

  const topCardPhotos =
    topCard && Array.isArray(topCard.photos) && topCard.photos.length > 0 && topCard.photos[0]
      ? topCard.photos
      : topCard
      ? [getPrimaryPhoto(topCard)]
      : [];

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

    setLikesCountdown((c) => Math.max(0, c - 1));

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
    // Si el toque fue en un botón interactivo interno, no iniciar drag
    if (e.target.closest('button')) return;

    const el = activeCardRef.current;
    if (el) {
      el.style.transition = 'none';
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Ignorar si falla captura de puntero
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

    // Si fue un toque limpio (sin arrastrar), cambiar foto izquierda / derecha
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8 && topCardPhotos.length > 1 && activeCardRef.current) {
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

  const cardInterests =
    topCard && Array.isArray(topCard.interests) && topCard.interests.length > 0
      ? topCard.interests.slice(0, 4)
      : DEFAULT_INTEREST_PILLS;

  return (
    <div className="flex-1 h-full w-full bg-black text-white flex flex-col overflow-hidden select-none relative">
      {/* CABECERA SUPERIOR: Opción A (Por defecto) o Opción B (Banner flotante de progreso) */}
      <header className="shrink-0 px-4 pt-2.5 pb-2 pt-safe z-20">
        {!showTasteBanner ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowFiltersModal((v) => !v)}
                className="p-1.5 text-zinc-300 hover:text-white transition"
                title="Filtros"
              >
                <SlidersHorizontal className="w-6 h-6 stroke-[2.2]" />
              </button>
              <h1 className="text-xl font-extrabold tracking-tight text-white">Para ti</h1>
            </div>

            <div className="flex items-center gap-3">
              {/* Icono de modo doble / progreso */}
              <button
                type="button"
                onClick={() => setShowTasteBanner(true)}
                className="p-1.5 text-zinc-300 hover:text-white transition"
                title="Modo Conociendo tus gustos"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="5" width="11" height="15" rx="2.5" />
                  <path d="M17 7h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-9" />
                </svg>
              </button>

              {/* Icono de rayo morado (Boost) */}
              <button
                type="button"
                onClick={onOpenBoost}
                className="p-1.5 text-[#A855F7] hover:brightness-110 transition"
                title="Boost"
              >
                <Zap className="w-6 h-6 fill-[#A855F7] text-[#A855F7]" />
              </button>
            </div>
          </div>
        ) : (
          /* Opción B: Banner flotante blanco redondeado de progreso */
          <div
            onClick={() => setShowTasteBanner(false)}
            className="bg-white text-zinc-900 rounded-2xl px-3.5 py-2.5 shadow-md flex items-center gap-3 cursor-pointer"
          >
            <div className="w-9 h-9 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
              <Heart className="w-5 h-5 text-[#FF2E54] fill-[#FF2E54]" />
            </div>
            <p className="text-xs sm:text-sm font-bold text-zinc-900 leading-snug flex-1">
              Conociendo tus gustos - Da {Math.max(1, likesCountdown)} Likes más para comenzar
            </p>
          </div>
        )}
      </header>

      {/* Panel compacto de filtros (cuando toca el ícono de sliders) */}
      {showFiltersModal && (
        <div className="mx-3 mb-2 p-3 rounded-2xl bg-[#18181B] border border-zinc-800 z-30 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-300">Preferencias de búsqueda</span>
            <button
              type="button"
              onClick={() => setShowFiltersModal(false)}
              className="text-xs font-bold text-[#FF2E54]"
            >
              Listo
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setScope('global')}
              className={`py-1.5 rounded-xl text-xs font-bold ${
                scope === 'global' ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-400'
              }`}
            >
              🌎 Todo el Mundo
            </button>
            <button
              type="button"
              onClick={() => setScope('local')}
              className={`py-1.5 rounded-xl text-xs font-bold ${
                scope === 'local' ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-400'
              }`}
            >
              {currentUser?.country?.flag || '📍'} Mi País ({currentUser?.country?.code})
            </button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {['Todos', ...LOOKING_FOR_OPTIONS].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setIntention(opt)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                  intention === opt ? 'bg-[#FF2E54] text-white' : 'bg-zinc-900 text-zinc-400'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* CONTENEDOR DEL MAZO VIRTUALIZADO (Máximo 2 tarjetas en el DOM) */}
      <div className="flex-1 min-h-0 relative px-1.5 pb-2 flex flex-col">
        {loading ? (
          <div className="flex-1 rounded-[28px] bg-[#111111] flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full border-2 border-[#FF2E54] border-t-transparent animate-spin" />
            <p className="text-xs font-semibold text-zinc-400">Cargando perfiles...</p>
          </div>
        ) : !topCard ? (
          /* Estado de fin del mazo: "Hasta acá por los momentos" */
          <div className="flex-1 rounded-[28px] bg-[#111111] border border-zinc-800/80 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#FF2E54] mb-4">
              <img
                src={getPrimaryPhoto(currentUser, 200)}
                alt={currentUser?.name}
                className="w-full h-full object-cover"
              />
            </div>
            <h2 className="text-xl font-extrabold text-white">Hasta acá por los momentos</h2>
            <p className="text-xs text-zinc-400 mt-1.5 max-w-xs leading-relaxed">
              Ya recorriste todas las fotos de los perfiles disponibles en este momento.
            </p>
            <button
              type="button"
              onClick={() => loadCandidates(true)}
              className="mt-5 px-6 py-3.5 rounded-full bg-white text-black text-xs font-extrabold flex items-center gap-2 active:scale-95 transition-transform"
            >
              <RefreshCw className="w-4 h-4" />
              Volver a ver perfiles
            </button>
          </div>
        ) : (
          <div className="flex-1 relative overflow-hidden rounded-[28px]">
            {/* TARJETA 2 (Siguiente perfil debajo - Virtualización estricta de 2 nodos) */}
            {nextCard && (
              <div
                key={`next-${nextCard.uid || nextCard.id}`}
                className="absolute inset-0 rounded-[28px] overflow-hidden bg-zinc-900 pointer-events-none"
              >
                <img
                  src={getPrimaryPhoto(nextCard, 800)}
                  alt={nextCard.name}
                  className="w-full h-full object-cover opacity-80"
                  draggable={false}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
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
              className="gpu-card touch-none absolute inset-0 rounded-[28px] overflow-hidden bg-zinc-900 select-none cursor-grab active:cursor-grabbing"
            >
              <img
                src={optimizeCloudinaryUrl(topCardPhotos[photoIdx] || getPrimaryPhoto(topCard), 900)}
                alt={topCard.name}
                className="w-full h-full object-cover pointer-events-none"
                draggable={false}
              />

              {/* Degradado oscuro suave en la parte inferior */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent pointer-events-none" />

              {/* Sellos visuales manipulados por ref sin re-render */}
              <div
                ref={likeStampRef}
                style={{ opacity: 0 }}
                className="absolute top-14 left-6 z-20 px-4 py-1 rounded-lg border-4 border-emerald-400 text-emerald-400 font-black text-2xl -rotate-12 pointer-events-none"
              >
                LIKE
              </div>
              <div
                ref={nopeStampRef}
                style={{ opacity: 0 }}
                className="absolute top-14 right-6 z-20 px-4 py-1 rounded-lg border-4 border-[#FF2E54] text-[#FF2E54] font-black text-2xl rotate-12 pointer-events-none"
              >
                NOPE
              </div>

              {/* Borde superior interno: Barras horizontales segmentadas + botón circular de retroceder */}
              <div className="absolute top-3 inset-x-3.5 z-20 space-y-2.5">
                <div className="flex gap-1.5">
                  {topCardPhotos.map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-1 flex-1 rounded-full ${
                        idx === photoIdx ? 'bg-white' : 'bg-white/35'
                      }`}
                    />
                  ))}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleRewind}
                    disabled={history.length === 0}
                    className="w-9 h-9 rounded-full bg-zinc-900/80 text-white flex items-center justify-center disabled:opacity-40 active:scale-90 transition-transform"
                    title="Retroceder"
                  >
                    <RotateCcw className="w-4 h-4 stroke-[2.2]" />
                  </button>
                </div>
              </div>

              {/* Información superpuesta abajo a la izquierda (sobre los botones flotantes) */}
              <div className="absolute bottom-24 inset-x-4 z-20 space-y-2.5 pointer-events-auto">
                {/* Badge blanco tipo píldora con punto verde */}
                <div>
                  <span className="inline-flex items-center gap-1.5 bg-white text-zinc-900 rounded-full px-3 py-1 text-xs font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Activx recientemente
                  </span>
                </div>

                {/* Nombre en blanco bold grande + edad al lado y botón circular gris oscuro con flecha ↑ */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <h2 className="text-3xl font-extrabold text-white tracking-tight truncate">
                      {topCard.name}
                    </h2>
                    <span className="text-2xl font-semibold text-white/95 shrink-0">
                      {topCard.age || 24}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectProfile(topCard)}
                    className="w-9 h-9 rounded-full bg-zinc-800 text-white flex items-center justify-center shrink-0 active:scale-90 transition-transform"
                    title="Ver detalle del perfil"
                  >
                    <ArrowUp className="w-5 h-5 stroke-[2.5]" />
                  </button>
                </div>

                {/* Subtítulo con ícono: "Intereses" + etiquetas tipo píldora en gris oscuro translúcido */}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
                    Intereses
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {cardInterests.map((tag) => (
                      <span
                        key={tag}
                        className="bg-zinc-900/80 text-white rounded-full px-3 py-1 text-xs font-medium border border-zinc-700/60"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Botones de Acción Flotantes inferiores (X y Corazón) */}
              <div className="absolute bottom-4 inset-x-0 z-20 flex items-center justify-center gap-7 pointer-events-auto">
                <button
                  type="button"
                  onClick={triggerPass}
                  className="w-16 h-16 rounded-full bg-[#222222] text-white flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                  aria-label="Pasar"
                >
                  <X className="w-8 h-8 stroke-[3]" />
                </button>

                <button
                  type="button"
                  onClick={triggerLike}
                  className="w-16 h-16 rounded-full bg-[#222222] text-[#FF2E54] flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                  aria-label="Me gusta"
                >
                  <Heart className="w-8 h-8 fill-[#FF2E54] text-[#FF2E54]" />
                </button>
              </div>

              {/* Overlay de Tutorial Inicial (condicional la primera vez) */}
              {showTutorial && (
                <div className="absolute inset-0 z-30 bg-black/80 flex flex-col items-center justify-center p-6 text-center">
                  <div className="text-5xl mb-3">👋</div>
                  <h3 className="text-2xl font-extrabold text-white">¡Vamos a empezar!</h3>
                  <p className="text-sm text-zinc-300 mt-1.5 max-w-xs">
                    Aquí está todo lo que necesitas saber.
                  </p>
                  <button
                    type="button"
                    onClick={dismissTutorial}
                    className="mt-6 w-full max-w-[240px] py-3.5 rounded-full bg-zinc-950 border border-zinc-700 text-white text-sm font-bold active:scale-95 transition-transform"
                  >
                    Comenzar tutorial
                  </button>
                  <button
                    type="button"
                    onClick={dismissTutorial}
                    className="mt-3 py-2 px-4 text-xs font-bold text-zinc-300 hover:text-white"
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
          <div className="w-full max-w-sm rounded-3xl bg-[#18181B] border border-zinc-800 p-6 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#FF2E54] flex items-center justify-center">
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
    </div>
  );
}
