import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Compass,
  Crown,
  Flame,
  Gift,
  Globe,
  Heart,
  Info,
  MapPin,
  MessageCircle,
  MessageCircleHeart,
  RefreshCw,
  RotateCcw,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { LOOKING_FOR_OPTIONS } from '../../config/constants';
import { sendVirtualGift } from '../../services/chatService';
import { sendLike } from '../../services/discoveryService';
import { fetchDiscoverProfiles, subscribePopularUsers } from '../../services/userService';
import {
  calculateAffinityScore,
  formatInterestWithIcon,
  getPrimaryPhoto,
  getSharedInterests,
  isBoostActive,
  isUserActuallyOnline,
  optimizeCloudinaryUrl,
} from '../../utils/formatters';
import GiftPickerModal from '../chat/GiftPickerModal';
import GiftAnimationOverlay from '../chat/GiftAnimationOverlay';

export default function DiscoverSwipe({
  currentUser,
  onSelectProfile,
  onStartChat,
  onOpenChat,
  onOpenCoinStore,
  onOpenBoost,
  onSwitchToGrid,
  onGoToProfile,
  onSuccess,
  onError,
}) {
  const [scope, setScope] = useState('global'); // 'local' | 'global'
  const [intention, setIntention] = useState('Todos');
  const [cards, setCards] = useState([]);
  const [history, setHistory] = useState([]);
  const [totalLoadedCount, setTotalLoadedCount] = useState(0);
  const [storyUsers, setStoryUsers] = useState([]);

  const [photoIdx, setPhotoIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState(false);
  const [flyDirection, setFlyDirection] = useState(null); // 'left' | 'right' | null
  const [heartBurst, setHeartBurst] = useState(false);
  const [matchPopup, setMatchPopup] = useState(null);

  // Gift modal state right on the main deck
  const [giftPickerOpen, setGiftPickerOpen] = useState(false);
  const [sendingGiftId, setSendingGiftId] = useState(null);
  const [giftAnim, setGiftAnim] = useState(null);

  // Drag gesture state
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const lastTapRef = useRef(0);
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  const blockedKey = (currentUser?.blockedUsers || []).join(',');

  // Barra superior de historias / usuarios activos en tiempo real
  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = subscribePopularUsers(
      {
        scope: 'global',
        countryCode: currentUser?.country?.code,
        currentUserId: currentUser.uid,
        blockedUsers: currentUser?.blockedUsers || [],
      },
      (list) => setStoryUsers(list.slice(0, 15)),
      () => {}
    );
    return () => unsub();
  }, [currentUser?.uid, currentUser?.country?.code, blockedKey]);

  const loadCandidates = useCallback(
    async (forceIncludeAll = false) => {
      const user = currentUserRef.current;
      if (!user?.uid) return;
      setLoading(true);
      setHistory([]);
      setPhotoIdx(0);
      setDragX(0);
      setFlyDirection(null);

      try {
        let list = await fetchDiscoverProfiles({
          currentUser: user,
          scope,
          lookingForFilter: intention,
          includeAlreadyLiked: forceIncludeAll,
        });

        // Si ya le había dado like a todos los perfiles existentes en una sesión previa,
        // cargar dinámicamente los perfiles subidos para que pueda recorrer sus fotos hasta finalizar.
        if (list.length === 0 && !forceIncludeAll) {
          list = await fetchDiscoverProfiles({
            currentUser: user,
            scope,
            lookingForFilter: intention,
            includeAlreadyLiked: true,
          });
        }

        setCards(list);
        setTotalLoadedCount(list.length);
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

  const topCard = cards[0] || null;
  const secondCard = cards[1] || null;
  const thirdCard = cards[2] || null;

  const topCardPhotos =
    topCard && Array.isArray(topCard.photos) && topCard.photos.length > 0 && topCard.photos[0]
      ? topCard.photos
      : topCard
      ? [getPrimaryPhoto(topCard)]
      : [];

  const animateAndAdvance = (direction, currentCard) => {
    setFlyDirection(direction);
    setTimeout(() => {
      setHistory((prev) => [currentCard, ...prev]);
      setCards((prev) => prev.slice(1));
      setPhotoIdx(0);
      setDragX(0);
      setFlyDirection(null);
      setBusyAction(false);
    }, 260);
  };

  const handlePass = () => {
    if (!topCard || busyAction) return;
    setBusyAction(true);
    animateAndAdvance('left', topCard);
  };

  const handleRewind = () => {
    if (history.length === 0 || busyAction) return;
    const [lastCard, ...rest] = history;
    setHistory(rest);
    setCards((prev) => [lastCard, ...prev]);
    setPhotoIdx(0);
    setDragX(0);
  };

  const handleLike = async (withBurst = false) => {
    if (!topCard || busyAction) return;
    const target = topCard;
    setBusyAction(true);

    if (withBurst) {
      setHeartBurst(true);
      setTimeout(() => setHeartBurst(false), 750);
    }

    try {
      const res = await sendLike({ currentUser, targetUser: target });
      animateAndAdvance('right', target);
      if (res.matched && !res.alreadyLiked) {
        setMatchPopup({ targetUser: target, matchId: res.matchId });
      } else {
        onSuccess?.(`❤️ Me gusta enviado a ${target.name}`);
      }
    } catch (err) {
      setBusyAction(false);
      onError?.(err.message || 'No se pudo enviar Me gusta.');
    }
  };

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
      onSuccess?.(`${gift.icon} ¡Enviaste ${gift.name} a ${topCard.name}!`);
    } catch (err) {
      onError?.(err.message || 'Error al enviar regalo.');
    } finally {
      setSendingGiftId(null);
    }
  };

  const handlePointerDown = (e) => {
    if (busyAction) return;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    setIsDragging(true);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - startXRef.current;
    setDragX(deltaX);
  };

  const handlePointerUp = (e) => {
    if (!isDragging) return;
    setIsDragging(false);

    if (dragX > 95) {
      handleLike(false);
      return;
    }
    if (dragX < -95) {
      handlePass();
      return;
    }

    // Si apenas se movió, evaluar toque en foto (izquierda/derecha o doble tap para Like)
    const movedX = Math.abs(e.clientX - startXRef.current);
    const movedY = Math.abs(e.clientY - startYRef.current);
    setDragX(0);

    if (movedX < 8 && movedY < 8 && e.currentTarget) {
      const now = Date.now();
      if (now - lastTapRef.current < 280) {
        // Doble toque -> Like con corazón gigante
        lastTapRef.current = 0;
        handleLike(true);
        return;
      }
      lastTapRef.current = now;

      if (topCardPhotos.length > 1) {
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        // Solo cambiar foto si toca en los 2/3 superiores de la tarjeta
        if (clickY < rect.height * 0.68) {
          if (clickX < rect.width * 0.38) {
            setPhotoIdx((i) => (i - 1 + topCardPhotos.length) % topCardPhotos.length);
          } else if (clickX > rect.width * 0.62) {
            setPhotoIdx((i) => (i + 1) % topCardPhotos.length);
          }
        }
      }
    }
  };

  const sharedInterests = topCard ? getSharedInterests(currentUser, topCard) : [];
  const affinityScore = topCard ? calculateAffinityScore(currentUser, topCard) : 90;
  const currentCardNumber = Math.min(totalLoadedCount, history.length + 1);

  const getCardTransform = () => {
    if (flyDirection === 'right') return 'translateX(440px) rotate(18deg)';
    if (flyDirection === 'left') return 'translateX(-440px) rotate(-18deg)';
    return `translateX(${dragX}px) rotate(${dragX * 0.045}deg)`;
  };

  return (
    <div className="p-3.5 sm:p-4 space-y-3">
      {/* Top Interactive Stories & VIP Bar */}
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-0.5">
        {/* Tu propio botón de Boost / Historia */}
        <button
          type="button"
          onClick={onOpenBoost}
          className="flex flex-col items-center shrink-0 group"
        >
          <div className="relative p-0.5 rounded-full bg-gradient-to-tr from-amber-400 via-brand-500 to-rose-400 shadow-sm group-hover:scale-105 transition">
            <img
              src={getPrimaryPhoto(currentUser, 140)}
              alt={currentUser?.name}
              className="w-12 h-12 rounded-full object-cover border-2 border-white"
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center ring-2 ring-white shadow">
              <Zap className="w-3 h-3 fill-slate-950" />
            </span>
          </div>
          <span className="text-[10px] font-extrabold text-amber-700 mt-1">Destacar</span>
        </button>

        {storyUsers.map((user) => {
          const online = isUserActuallyOnline(user);
          const vip = isBoostActive(user);
          return (
            <button
              key={user.uid || user.id}
              type="button"
              onClick={() => onSelectProfile(user)}
              className="flex flex-col items-center shrink-0 w-14 group"
            >
              <div
                className={`relative p-0.5 rounded-full shadow-sm group-hover:scale-105 transition ${
                  vip
                    ? 'bg-gradient-to-tr from-amber-400 via-rose-500 to-amber-300'
                    : online
                    ? 'bg-gradient-to-tr from-brand-500 to-rose-400'
                    : 'bg-slate-200'
                }`}
              >
                <img
                  src={getPrimaryPhoto(user, 140)}
                  alt={user.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-white bg-white"
                />
                {online && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white" />
                )}
              </div>
              <span className="text-[10px] font-bold text-slate-700 truncate w-full text-center mt-1">
                {user.name?.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Compact Control & Filter Bar */}
      <div className="bg-white/90 backdrop-blur-md rounded-2xl p-2 border border-rose-100/90 shadow-sm space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex p-0.5 rounded-xl bg-slate-100 border border-slate-200/70">
            <button
              type="button"
              onClick={() => setScope('global')}
              className={`px-3 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1 transition ${
                scope === 'global'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-brand-500" />
              Global
            </button>
            <button
              type="button"
              onClick={() => setScope('local')}
              className={`px-3 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1 transition ${
                scope === 'local'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{currentUser?.country?.flag || '📍'}</span>
              {currentUser?.country?.code}
            </button>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {['Todos', ...LOOKING_FOR_OPTIONS].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setIntention(opt)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap border transition ${
                  intention === opt
                    ? 'bg-gradient-to-r from-brand-500 to-rose-500 text-white border-transparent shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200/80 hover:border-brand-300'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN INTERACTIVE PHOTO DECK */}
      {loading ? (
        <div className="h-[490px] rounded-[34px] bg-white border border-rose-100 shadow-luxury flex flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="relative flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-rose-100/70 animate-ping absolute" />
            <img
              src={getPrimaryPhoto(currentUser, 160)}
              alt={currentUser?.name}
              className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg relative z-10"
            />
          </div>
          <div>
            <p className="font-display text-base font-extrabold text-slate-900">
              Buscando personas cerca y en el mundo...
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Preparando galería interactiva de perfiles
            </p>
          </div>
        </div>
      ) : !topCard ? (
        /* FINALE CARD: "Hasta acá por los momentos" */
        <div className="h-[490px] rounded-[34px] bg-white border border-rose-100 shadow-luxury flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-rose-100/50 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-64 h-64 rounded-full bg-amber-100/60 blur-3xl pointer-events-none" />

          {/* Radar Pulse Avatar */}
          <div className="relative flex items-center justify-center my-4">
            <div className="w-32 h-32 rounded-full border-2 border-rose-200/70 animate-ping absolute" />
            <div className="w-24 h-24 rounded-full border border-amber-300/60 absolute" />
            <img
              src={getPrimaryPhoto(currentUser, 200)}
              alt={currentUser?.name}
              className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-luxury relative z-10"
            />
            <span className="absolute -bottom-1 -right-1 z-20 px-2 py-0.5 rounded-full bg-gradient-to-r from-brand-500 to-amber-500 text-white text-[10px] font-extrabold shadow">
              ✨ Al día
            </span>
          </div>

          <h3 className="font-display text-2xl font-extrabold text-slate-900 mt-2">
            ¡Hasta acá por los momentos!
          </h3>

          <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-xs leading-relaxed font-medium">
            {totalLoadedCount > 0
              ? `Ya recorriste las fotos de los ${totalLoadedCount} perfiles disponibles en esta vista. ¡Puedes volver a verlos o iniciar un chat directo!`
              : 'Por el momento no hay más personas que hayan subido fotos con este filtro.'}
          </p>

          <div className="w-full max-w-xs space-y-2.5 mt-6 relative z-10">
            <button
              type="button"
              onClick={() => loadCandidates(true)}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-brand-500 via-rose-500 to-amber-500 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-brand-500/25 hover:brightness-105 active:scale-95 transition"
            >
              <RefreshCw className="w-4 h-4" />
              Volver a ver los perfiles
            </button>

            <div className="grid grid-cols-2 gap-2">
              {history.length > 0 ? (
                <button
                  type="button"
                  onClick={handleRewind}
                  className="py-2.5 px-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold flex items-center justify-center gap-1.5 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                  Anterior
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onGoToProfile}
                  className="py-2.5 px-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold flex items-center justify-center gap-1.5 transition"
                >
                  <Camera className="w-3.5 h-3.5 text-brand-500" />
                  Mis Fotos
                </button>
              )}

              <button
                type="button"
                onClick={onSwitchToGrid}
                className="py-2.5 px-3 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-200/80 text-brand-600 text-xs font-extrabold flex items-center justify-center gap-1.5 transition"
              >
                <Compass className="w-3.5 h-3.5" />
                Ver Mosaico
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3.5">
          {/* 3D Stacked Card Container */}
          <div className="relative h-[495px]">
            {/* Third Card in Stack */}
            {thirdCard && (
              <div className="absolute inset-x-6 top-5 bottom-0 rounded-[34px] overflow-hidden bg-white border border-slate-200/70 shadow-sm scale-[0.92] translate-y-4 opacity-40 pointer-events-none" />
            )}

            {/* Second Card in Stack */}
            {secondCard && (
              <div className="absolute inset-x-3 top-2.5 bottom-0 rounded-[34px] overflow-hidden bg-white border border-rose-100 shadow-md scale-[0.96] translate-y-2 opacity-75 pointer-events-none">
                <img
                  src={getPrimaryPhoto(secondCard, 600)}
                  alt={secondCard.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-slate-900/20" />
              </div>
            )}

            {/* Active Foreground Card */}
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={() => {
                setIsDragging(false);
                setDragX(0);
              }}
              style={{
                transform: getCardTransform(),
                opacity: flyDirection ? 0.15 : 1,
                transition: isDragging
                  ? 'none'
                  : 'transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.25s ease',
              }}
              className="relative h-full rounded-[34px] overflow-hidden bg-slate-900 border-2 border-white shadow-luxury select-none touch-pan-y cursor-grab active:cursor-grabbing"
            >
              {/* Main Photo */}
              <img
                src={optimizeCloudinaryUrl(topCardPhotos[photoIdx] || getPrimaryPhoto(topCard), 1000)}
                alt={topCard.name}
                className="w-full h-full object-cover pointer-events-none transition-all duration-300"
              />

              {/* Multi-layered Editorial Gradients */}
              <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 via-black/20 to-transparent pointer-events-none" />
              <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-slate-950/95 via-slate-950/60 to-transparent pointer-events-none" />

              {/* Double-Tap Giant Heart Burst */}
              {heartBurst && (
                <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
                  <div className="w-28 h-28 rounded-full bg-gradient-to-br from-brand-500 to-rose-500 flex items-center justify-center shadow-2xl animate-bounce">
                    <Heart className="w-16 h-16 text-white fill-white" />
                  </div>
                </div>
              )}

              {/* Story-Style Segmented Photo Bars */}
              <div className="absolute top-3 inset-x-4 flex gap-1.5 z-20">
                {topCardPhotos.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPhotoIdx(idx);
                    }}
                    className="h-1.5 flex-1 rounded-full overflow-hidden bg-white/30 backdrop-blur-sm"
                  >
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        idx === photoIdx ? 'w-full bg-white shadow' : idx < photoIdx ? 'w-full bg-white/75' : 'w-0'
                      }`}
                    />
                  </button>
                ))}
              </div>

              {/* Top Status Badges */}
              <div className="absolute top-7 inset-x-4 flex items-center justify-between z-20">
                <div className="flex items-center gap-1.5">
                  {isBoostActive(topCard) && (
                    <span className="px-2.5 py-1 rounded-full bg-amber-400 text-slate-950 text-[11px] font-black flex items-center gap-1 shadow">
                      <Crown className="w-3 h-3 fill-slate-950" /> VIP
                    </span>
                  )}
                  <span className="px-3 py-1 rounded-full bg-white/90 backdrop-blur-md text-slate-900 text-[11px] font-extrabold shadow-sm">
                    {topCard.lookingFor || 'Conectar'}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-brand-500/90 to-amber-500/90 backdrop-blur-md text-white text-[11px] font-extrabold shadow-sm flex items-center gap-1">
                    <Flame className="w-3 h-3 fill-white" /> {affinityScore}% Afinidad
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {topCardPhotos.length > 1 && (
                    <span className="px-2 py-1 rounded-full bg-black/50 backdrop-blur-md text-white text-[10px] font-bold flex items-center gap-1">
                      <Camera className="w-3 h-3" /> {photoIdx + 1}/{topCardPhotos.length}
                    </span>
                  )}
                  {isUserActuallyOnline(topCard) && (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/90 text-white text-[11px] font-extrabold flex items-center gap-1 shadow-sm">
                      <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> Online
                    </span>
                  )}
                </div>
              </div>

              {/* Left / Right Photo Navigation Chevrons */}
              {topCardPhotos.length > 1 && (
                <>
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPhotoIdx((i) => (i - 1 + topCardPhotos.length) % topCardPhotos.length);
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 backdrop-blur-md text-slate-900 shadow-md hover:bg-white z-20 transition"
                    title="Foto anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPhotoIdx((i) => (i + 1) % topCardPhotos.length);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 backdrop-blur-md text-slate-900 shadow-md hover:bg-white z-20 transition"
                    title="Siguiente foto"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}

              {/* Swipe Feedback Stamps */}
              {(dragX > 35 || flyDirection === 'right') && (
                <div className="absolute top-16 left-6 z-30 px-5 py-2 rounded-2xl border-4 border-emerald-400 text-emerald-600 font-black text-2xl -rotate-12 bg-white/95 shadow-2xl">
                  ME GUSTA ❤️
                </div>
              )}
              {(dragX < -35 || flyDirection === 'left') && (
                <div className="absolute top-16 right-6 z-30 px-5 py-2 rounded-2xl border-4 border-rose-500 text-rose-600 font-black text-2xl rotate-12 bg-white/95 shadow-2xl">
                  PASAR ✕
                </div>
              )}

              {/* Bottom Profile Info Overlay */}
              <div
                onClick={() => Math.abs(dragX) < 10 && onSelectProfile(topCard)}
                className="absolute bottom-0 inset-x-0 p-5 z-20 cursor-pointer"
              >
                <div className="flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white leading-tight truncate">
                        {topCard.name}, {topCard.age}
                      </h2>
                      <span className="px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-bold text-white shrink-0">
                        {currentCardNumber}/{totalLoadedCount}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-white/90 flex items-center gap-1.5 mt-1 font-medium">
                      <span>{topCard.country?.flag}</span>
                      <MapPin className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                      <span className="truncate">
                        {topCard.city ? `${topCard.city}, ` : ''}
                        {topCard.country?.name}
                      </span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectProfile(topCard);
                    }}
                    className="p-2.5 rounded-2xl bg-white/20 backdrop-blur-md text-white hover:bg-white/30 border border-white/30 transition shrink-0"
                    title="Ver perfil completo"
                  >
                    <Info className="w-5 h-5" />
                  </button>
                </div>

                {topCard.bio && (
                  <p className="text-xs text-white/90 line-clamp-2 mt-2.5 bg-white/10 backdrop-blur-md rounded-2xl px-3.5 py-2 border border-white/15 leading-relaxed">
                    “{topCard.bio}”
                  </p>
                )}

                {/* Interests & Shared Badges */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2.5 text-[11px] font-bold">
                  {sharedInterests.length > 0 && (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-400 text-slate-950 font-extrabold shadow-sm">
                      ✨ {sharedInterests.length} en común
                    </span>
                  )}
                  {Array.isArray(topCard.interests) &&
                    topCard.interests.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-md text-white border border-white/15"
                      >
                        {formatInterestWithIcon(tag)}
                      </span>
                    ))}
                </div>
              </div>
            </div>
          </div>

          {/* 5-Button Superior Interactive Action Dock */}
          <div className="flex items-center justify-center gap-2.5 sm:gap-3.5 pt-0.5">
            {/* 1. Rewind / Undo */}
            <button
              type="button"
              disabled={history.length === 0 || busyAction}
              onClick={handleRewind}
              className="w-11 h-11 rounded-full bg-white border border-slate-200 text-amber-500 hover:bg-amber-50 hover:border-amber-300 disabled:opacity-35 flex items-center justify-center shadow-card hover:scale-105 active:scale-95 transition"
              title="Volver al perfil anterior"
            >
              <RotateCcw className="w-4 h-4 stroke-[2.5]" />
            </button>

            {/* 2. Pass / Nope */}
            <button
              type="button"
              disabled={busyAction}
              onClick={handlePass}
              className="w-14 h-14 rounded-full bg-white border-2 border-rose-100 text-slate-500 hover:text-rose-600 hover:border-rose-300 flex items-center justify-center shadow-card hover:scale-110 active:scale-95 transition"
              title="Pasar al siguiente perfil"
            >
              <X className="w-7 h-7 stroke-[2.5]" />
            </button>

            {/* 3. Direct Private Chat (Free & Instant!) */}
            <button
              type="button"
              disabled={busyAction}
              onClick={() => onStartChat?.(topCard)}
              className="h-12 px-4 rounded-full bg-white border-2 border-brand-500 text-brand-600 text-xs font-extrabold flex items-center gap-1.5 shadow-card hover:bg-brand-50 hover:scale-105 active:scale-95 transition"
              title="Chatear en privado con esta persona"
            >
              <MessageCircle className="w-4 h-4 fill-brand-100" />
              <span>Chatear</span>
            </button>

            {/* 4. Like / Heart */}
            <button
              type="button"
              disabled={busyAction}
              onClick={() => handleLike(true)}
              className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-500 via-rose-500 to-pink-500 text-white flex items-center justify-center shadow-lg shadow-brand-500/35 hover:scale-110 active:scale-95 transition"
              title="Dar Me Gusta (o doble toque en la foto)"
            >
              <Heart className="w-7 h-7 fill-white" />
            </button>

            {/* 5. Send Virtual Gift */}
            <button
              type="button"
              disabled={busyAction}
              onClick={() => setGiftPickerOpen(true)}
              className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-md shadow-amber-500/25 hover:scale-105 active:scale-95 transition"
              title="Enviar un regalo virtual"
            >
              <Gift className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Match Celebration Popup */}
      {matchPopup && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-5">
          <div className="w-full max-w-sm rounded-[32px] bg-white border border-rose-100 p-6 text-center shadow-luxury space-y-4">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-br from-brand-500 via-rose-500 to-amber-400 flex items-center justify-center shadow-lg shadow-brand-500/30 animate-bounce">
              <MessageCircleHeart className="w-8 h-8 text-white" />
            </div>
            <h3 className="font-display text-2xl font-black bg-gradient-to-r from-brand-600 to-amber-500 bg-clip-text text-transparent">
              ¡Es un Match!
            </h3>
            <p className="text-xs text-slate-600">
              A ti y a <strong>{matchPopup.targetUser.name}</strong> se gustaron mutuamente.
            </p>
            <div className="flex items-center justify-center gap-3 py-1">
              <img
                src={getPrimaryPhoto(currentUser, 200)}
                alt={currentUser.name}
                className="w-20 h-20 rounded-3xl object-cover border-4 border-rose-100 shadow-md -rotate-6"
              />
              <div className="w-9 h-9 rounded-full bg-rose-50 text-brand-500 flex items-center justify-center font-black shadow-sm">
                ❤️
              </div>
              <img
                src={getPrimaryPhoto(matchPopup.targetUser, 200)}
                alt={matchPopup.targetUser.name}
                className="w-20 h-20 rounded-3xl object-cover border-4 border-amber-100 shadow-md rotate-6"
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setMatchPopup(null)}
                className="py-3 rounded-2xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition"
              >
                Seguir pasando
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
                className="py-3 rounded-2xl bg-gradient-to-r from-brand-500 to-rose-500 text-white text-xs font-extrabold shadow-md shadow-brand-500/20"
              >
                Chatear Ahora 💬
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
          onOpenCoinStore();
        }}
      />

      <GiftAnimationOverlay giftEvent={giftAnim} onComplete={() => setGiftAnim(null)} />
    </div>
  );
}
