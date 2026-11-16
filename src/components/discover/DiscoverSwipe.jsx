import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  Globe,
  Heart,
  Info,
  MapPin,
  MessageCircle,
  MessageCircleHeart,
  RefreshCw,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { LOOKING_FOR_OPTIONS, VIP_DM_COST } from '../../config/constants';
import { sendLike, startVipDirectMessage } from '../../services/discoveryService';
import { fetchDiscoverProfiles } from '../../services/userService';
import {
  getPrimaryPhoto,
  getSharedInterests,
  isBoostActive,
  isUserActuallyOnline,
  optimizeCloudinaryUrl,
} from '../../utils/formatters';

export default function DiscoverSwipe({
  currentUser,
  onSelectProfile,
  onStartChat,
  onOpenChat,
  onOpenCoinStore,
  onSuccess,
  onError,
}) {
  const [scope, setScope] = useState('global'); // 'local' | 'global'
  const [intention, setIntention] = useState('Todos');
  const [cards, setCards] = useState([]);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState(false);
  const [matchPopup, setMatchPopup] = useState(null);

  // Drag gesture state
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  const blockedKey = (currentUser?.blockedUsers || []).join(',');

  const loadCandidates = useCallback(async () => {
    const user = currentUserRef.current;
    if (!user?.uid) return;
    setLoading(true);
    try {
      const list = await fetchDiscoverProfiles({
        currentUser: user,
        scope,
        lookingForFilter: intention,
      });
      setCards(list);
      setPhotoIdx(0);
    } catch (err) {
      onError?.(err.message || 'Error al cargar perfiles.');
    } finally {
      setLoading(false);
    }
  }, [
    currentUser?.uid,
    currentUser?.country?.code,
    currentUser?.interestedIn,
    blockedKey,
    scope,
    intention,
    onError,
  ]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  const topCard = cards[0] || null;
  const nextCard = cards[1] || null;

  const topCardPhotos =
    topCard && Array.isArray(topCard.photos) && topCard.photos.length > 0
      ? topCard.photos
      : topCard
      ? [getPrimaryPhoto(topCard)]
      : [];

  const advanceCard = () => {
    setCards((prev) => prev.slice(1));
    setPhotoIdx(0);
    setDragX(0);
  };

  const handlePass = () => {
    if (!topCard || busyAction) return;
    advanceCard();
  };

  const handleLike = async () => {
    if (!topCard || busyAction) return;
    const target = topCard;
    setBusyAction(true);
    try {
      const res = await sendLike({ currentUser, targetUser: target });
      advanceCard();
      if (res.matched) {
        setMatchPopup({ targetUser: target, matchId: res.matchId });
      } else {
        onSuccess?.(`❤️ Like enviado a ${target.name}`);
      }
    } catch (err) {
      onError?.(err.message || 'No se pudo enviar Like.');
    } finally {
      setBusyAction(false);
    }
  };

  const handleDirectChat = async () => {
    if (!topCard || busyAction) return;
    onStartChat?.(topCard);
  };

  const handleVipDm = async () => {
    if (!topCard || busyAction) return;
    if ((currentUser?.coins || 0) < VIP_DM_COST) {
      onError?.(`Necesitas ${VIP_DM_COST} monedas para un Mensaje VIP Destacado.`);
      onOpenCoinStore();
      return;
    }

    const target = topCard;
    setBusyAction(true);
    try {
      const res = await startVipDirectMessage({ currentUser, targetUser: target });
      onOpenChat({ match: res.matchData, peerUser: target });
    } catch (err) {
      onError?.(err.message || 'No se pudo iniciar Mensaje Directo VIP.');
    } finally {
      setBusyAction(false);
    }
  };

  const handlePointerDown = (e) => {
    if (busyAction) return;
    startXRef.current = e.clientX;
    setIsDragging(true);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    setDragX(e.clientX - startXRef.current);
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragX > 95) {
      handleLike();
    } else if (dragX < -95) {
      handlePass();
    } else {
      setDragX(0);
    }
  };

  const sharedInterests = topCard ? getSharedInterests(currentUser, topCard) : [];

  return (
    <div className="p-4 space-y-3.5">
      {/* Scope & Intention Filters */}
      <div className="bg-white rounded-3xl p-3 border border-rose-100/90 shadow-card space-y-2.5">
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-slate-100/90 border border-slate-200/70">
          <button
            type="button"
            onClick={() => setScope('global')}
            className={`py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
              scope === 'global'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-brand-500" />
            Internacional
          </button>
          <button
            type="button"
            onClick={() => setScope('local')}
            className={`py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
              scope === 'local'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>{currentUser?.country?.flag || '📍'}</span>
            Local ({currentUser?.country?.code})
          </button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {['Todos', ...LOOKING_FOR_OPTIONS].map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setIntention(opt)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition ${
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

      {/* Swipe Card Area */}
      {loading ? (
        <div className="h-[460px] rounded-[32px] bg-white border border-rose-100 shadow-card flex flex-col items-center justify-center gap-3 text-slate-500">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-brand-500 flex items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
          <p className="text-xs font-bold text-slate-700">Buscando personas increíbles...</p>
        </div>
      ) : !topCard ? (
        <div className="h-[460px] rounded-[32px] bg-white border border-rose-100 shadow-card flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-rose-50 to-amber-50 border border-rose-100 text-brand-500 flex items-center justify-center mb-3 shadow-sm">
            <Sparkles className="w-8 h-8" />
          </div>
          <h3 className="font-display text-lg font-extrabold text-slate-900">
            ¡Viste todos los perfiles de este filtro!
          </h3>
          <p className="text-xs text-slate-500 mt-1.5 max-w-xs leading-relaxed">
            Prueba cambiando entre <strong>Local</strong> e <strong>Internacional</strong>, o recarga la lista para seguir conectando.
          </p>
          <button
            type="button"
            onClick={loadCandidates}
            className="mt-5 px-5 py-3 rounded-2xl bg-gradient-to-r from-brand-500 to-rose-500 text-white text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-brand-500/20 hover:brightness-105 transition"
          >
            <RefreshCw className="w-4 h-4" /> Recargar perfiles
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative h-[460px]">
            {/* Background Next Card for 3D Depth */}
            {nextCard && (
              <div className="absolute inset-x-3 top-3 bottom-0 rounded-[32px] overflow-hidden bg-white border border-slate-200/80 shadow-sm scale-[0.96] translate-y-2 opacity-60 pointer-events-none">
                <img
                  src={getPrimaryPhoto(nextCard)}
                  alt={nextCard.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Foreground Active Swipe Card */}
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={{
                transform: `translateX(${dragX}px) rotate(${dragX * 0.04}deg)`,
                transition: isDragging ? 'none' : 'transform 0.25s ease-out',
              }}
              className="relative h-full rounded-[32px] overflow-hidden bg-white border border-rose-100/90 shadow-luxury select-none touch-pan-y cursor-grab active:cursor-grabbing"
            >
              <img
                src={optimizeCloudinaryUrl(topCardPhotos[photoIdx] || getPrimaryPhoto(topCard), 900)}
                alt={topCard.name}
                className="w-full h-full object-cover pointer-events-none"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-black/25 pointer-events-none" />

              {/* Multi-photo indicators */}
              {topCardPhotos.length > 1 && (
                <div className="absolute top-3 inset-x-4 flex gap-1.5 z-10">
                  {topCardPhotos.map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-1 flex-1 rounded-full transition ${
                        idx === photoIdx ? 'bg-white shadow' : 'bg-white/35'
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Photo Prev/Next Buttons */}
              {topCardPhotos.length > 1 && (
                <>
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPhotoIdx((i) => (i - 1 + topCardPhotos.length) % topCardPhotos.length);
                    }}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/80 backdrop-blur-md text-slate-800 shadow hover:bg-white z-10"
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
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/80 backdrop-blur-md text-slate-800 shadow hover:bg-white z-10"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}

              {/* Swipe Feedback Stamps */}
              {dragX > 35 && (
                <div className="absolute top-10 left-6 px-4 py-1.5 rounded-2xl border-4 border-emerald-400 text-emerald-600 font-black text-xl -rotate-12 bg-white/95 shadow-lg">
                  ME GUSTA ❤️
                </div>
              )}
              {dragX < -35 && (
                <div className="absolute top-10 right-6 px-4 py-1.5 rounded-2xl border-4 border-rose-500 text-rose-600 font-black text-xl rotate-12 bg-white/95 shadow-lg">
                  PASAR
                </div>
              )}

              {/* Top Badges */}
              <div className="absolute top-6 inset-x-4 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {isBoostActive(topCard) && (
                    <span className="px-2.5 py-1 rounded-full bg-amber-400 text-slate-950 text-[11px] font-extrabold flex items-center gap-1 shadow">
                      <Zap className="w-3 h-3 fill-slate-950" /> VIP
                    </span>
                  )}
                  <span className="px-3 py-1 rounded-full bg-white/90 backdrop-blur-md text-slate-900 text-[11px] font-extrabold shadow-sm">
                    {topCard.lookingFor}
                  </span>
                </div>

                {isUserActuallyOnline(topCard) && (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/90 text-white text-[11px] font-extrabold flex items-center gap-1.5 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> En línea
                  </span>
                )}
              </div>

              {/* Bottom Info */}
              <div
                onClick={() => Math.abs(dragX) < 10 && onSelectProfile(topCard)}
                className="absolute bottom-0 inset-x-0 p-5 cursor-pointer"
              >
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <h3 className="font-display text-2xl font-extrabold text-white leading-tight">
                      {topCard.name}, {topCard.age}
                    </h3>
                    <p className="text-xs text-white/90 flex items-center gap-1.5 mt-1 font-medium">
                      <span>{topCard.country?.flag}</span>
                      <MapPin className="w-3.5 h-3.5 text-rose-300" />
                      <span>
                        {topCard.city ? `${topCard.city}, ` : ''}
                        {topCard.country?.name}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectProfile(topCard);
                    }}
                    className="p-2.5 rounded-2xl bg-white/20 backdrop-blur-md text-white hover:bg-white/30 border border-white/25 transition"
                    title="Ver perfil completo"
                  >
                    <Info className="w-5 h-5" />
                  </button>
                </div>

                {topCard.bio && (
                  <p className="text-xs text-white/85 line-clamp-2 mt-2 leading-relaxed">
                    {topCard.bio}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-1.5 mt-3 text-[11px] font-bold">
                  <span className="px-2.5 py-1 rounded-full bg-rose-500/30 border border-rose-300/40 text-rose-100 flex items-center gap-1">
                    <Flame className="w-3 h-3 fill-rose-300" /> {topCard.likesCount || 0}
                  </span>
                  {sharedInterests.length > 0 && (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/30 border border-emerald-300/40 text-emerald-100">
                      ✨ {sharedInterests.length} en común
                    </span>
                  )}
                  {Array.isArray(topCard.interests) &&
                    topCard.interests.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white"
                      >
                        {tag}
                      </span>
                    ))}
                </div>
              </div>
            </div>
          </div>

          {/* Tactile Action Bar */}
          <div className="flex items-center justify-center gap-3 pt-1">
            <button
              type="button"
              disabled={busyAction}
              onClick={handlePass}
              className="w-14 h-14 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-rose-500 hover:border-rose-200 flex items-center justify-center shadow-card hover:scale-105 active:scale-95 transition"
              title="Pasar"
            >
              <X className="w-6 h-6" />
            </button>

            <button
              type="button"
              disabled={busyAction}
              onClick={handleDirectChat}
              className="h-12 px-5 rounded-full bg-white border-2 border-brand-500 text-brand-600 text-xs font-extrabold flex items-center gap-1.5 shadow-card hover:bg-brand-50 hover:scale-105 active:scale-95 transition"
              title="Abrir chat privado directo gratis"
            >
              <MessageCircle className="w-4 h-4 fill-brand-100" />
              Chatear
            </button>

            <button
              type="button"
              disabled={busyAction}
              onClick={handleVipDm}
              className="h-12 px-4 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-extrabold flex items-center gap-1 shadow-md shadow-amber-500/20 hover:scale-105 active:scale-95 transition"
              title={`Super Mensaje VIP (${VIP_DM_COST} monedas)`}
            >
              <Zap className="w-3.5 h-3.5 fill-white" />
              VIP
            </button>

            <button
              type="button"
              disabled={busyAction}
              onClick={handleLike}
              className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-500 via-rose-500 to-pink-500 text-white flex items-center justify-center shadow-lg shadow-brand-500/30 hover:scale-105 active:scale-95 transition"
              title="Dar Me Gusta"
            >
              <Heart className="w-6 h-6 fill-white" />
            </button>
          </div>
        </div>
      )}

      {/* Match Celebration Popup */}
      {matchPopup && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-5">
          <div className="w-full max-w-sm rounded-[32px] bg-white border border-rose-100 p-6 text-center shadow-luxury space-y-4">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-br from-brand-500 via-rose-500 to-amber-400 flex items-center justify-center shadow-lg shadow-brand-500/30">
              <MessageCircleHeart className="w-8 h-8 text-white" />
            </div>
            <h3 className="font-display text-2xl font-black bg-gradient-to-r from-brand-600 to-amber-500 bg-clip-text text-transparent">
              ¡Es un Match!
            </h3>
            <p className="text-xs text-slate-600">
              A ti y a <strong>{matchPopup.targetUser.name}</strong> se gustaron mutuamente.
            </p>
            <img
              src={getPrimaryPhoto(matchPopup.targetUser)}
              alt={matchPopup.targetUser.name}
              className="w-28 h-28 mx-auto rounded-3xl object-cover border-4 border-rose-100 shadow-md"
            />
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setMatchPopup(null)}
                className="py-3 rounded-2xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition"
              >
                Seguir explorando
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
    </div>
  );
}
