import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Flame,
  Globe,
  Heart,
  Info,
  MapPin,
  MessageCircleHeart,
  RefreshCw,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { LOOKING_FOR_OPTIONS, VIP_DM_COST } from '../../config/constants';
import { sendLike, startVipDirectMessage } from '../../services/discoveryService';
import { fetchDiscoverProfiles } from '../../services/userService';
import { getPrimaryPhoto, isBoostActive, isUserActuallyOnline } from '../../utils/formatters';

export default function DiscoverSwipe({
  currentUser,
  onSelectProfile,
  onOpenChat,
  onOpenCoinStore,
  onSuccess,
  onError,
}) {
  const [scope, setScope] = useState('global'); // 'local' | 'global'
  const [intention, setIntention] = useState('Todos');
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState(false);
  const [matchPopup, setMatchPopup] = useState(null);

  // Drag gesture state
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);

  const loadCandidates = useCallback(async () => {
    if (!currentUser?.uid) return;
    setLoading(true);
    try {
      const list = await fetchDiscoverProfiles({
        currentUser,
        scope,
        lookingForFilter: intention,
      });
      setCards(list);
    } catch (err) {
      onError?.(err.message || 'Error al cargar perfiles.');
    } finally {
      setLoading(false);
    }
  }, [currentUser, scope, intention, onError]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  const topCard = cards[0] || null;

  const advanceCard = () => {
    setCards((prev) => prev.slice(1));
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

  const handleVipDm = async () => {
    if (!topCard || busyAction) return;
    if ((currentUser?.coins || 0) < VIP_DM_COST) {
      onError?.(`Necesitas ${VIP_DM_COST} monedas para enviar un Mensaje Directo VIP.`);
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

  return (
    <div className="p-3.5 space-y-3">
      {/* Scope & Intention Filters */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-slate-900 border border-slate-800">
          <button
            type="button"
            onClick={() => setScope('local')}
            className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              scope === 'local'
                ? 'bg-brand-500 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>{currentUser?.country?.flag || '📍'}</span>
            Local ({currentUser?.country?.code})
          </button>
          <button
            type="button"
            onClick={() => setScope('global')}
            className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              scope === 'global'
                ? 'bg-brand-500 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            Internacional
          </button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {['Todos', ...LOOKING_FOR_OPTIONS].map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setIntention(opt)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition ${
                intention === opt
                  ? 'bg-white text-slate-950 border-white'
                  : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Swipe Card Area */}
      {loading ? (
        <div className="h-[440px] rounded-3xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center gap-2 text-slate-400">
          <RefreshCw className="w-7 h-7 animate-spin text-brand-400" />
          <p className="text-xs font-semibold">Buscando personas increíbles...</p>
        </div>
      ) : !topCard ? (
        <div className="h-[440px] rounded-3xl bg-slate-900/70 border border-slate-800 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-brand-500/15 text-brand-400 flex items-center justify-center mb-3">
            <Sparkles className="w-7 h-7" />
          </div>
          <h3 className="text-base font-extrabold text-white">No hay más perfiles por ahora</h3>
          <p className="text-xs text-slate-400 mt-1.5 max-w-xs">
            Prueba cambiando entre <strong>Local</strong> e <strong>Internacional</strong> o ajustando la intención.
          </p>
          <button
            type="button"
            onClick={loadCandidates}
            className="mt-4 px-4 py-2.5 rounded-2xl bg-brand-500 text-white text-xs font-bold flex items-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" /> Volver a buscar
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              transform: `translateX(${dragX}px) rotate(${dragX * 0.04}deg)`,
              transition: isDragging ? 'none' : 'transform 0.25s ease-out',
            }}
            className="relative h-[440px] rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl select-none touch-pan-y cursor-grab active:cursor-grabbing"
          >
            <img
              src={getPrimaryPhoto(topCard)}
              alt={topCard.name}
              className="w-full h-full object-cover pointer-events-none"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-black/30 pointer-events-none" />

            {/* Swipe Labels */}
            {dragX > 35 && (
              <div className="absolute top-6 left-6 px-4 py-1.5 rounded-xl border-4 border-emerald-400 text-emerald-300 font-black text-xl -rotate-12 bg-slate-950/50">
                LIKE
              </div>
            )}
            {dragX < -35 && (
              <div className="absolute top-6 right-6 px-4 py-1.5 rounded-xl border-4 border-rose-500 text-rose-400 font-black text-xl rotate-12 bg-slate-950/50">
                PASAR
              </div>
            )}

            {/* Top Badges */}
            <div className="absolute top-3.5 inset-x-3.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {isBoostActive(topCard) && (
                  <span className="px-2.5 py-1 rounded-full bg-amber-400 text-slate-950 text-[11px] font-extrabold flex items-center gap-1 shadow">
                    <Zap className="w-3 h-3 fill-slate-950" /> VIP
                  </span>
                )}
                <span className="px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-md text-white text-[11px] font-bold">
                  {topCard.lookingFor}
                </span>
              </div>

              {isUserActuallyOnline(topCard) && (
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/25 border border-emerald-400/50 text-emerald-200 text-[11px] font-bold flex items-center gap-1 backdrop-blur-md">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> En línea
                </span>
              )}
            </div>

            {/* Bottom Info */}
            <div
              onClick={() => Math.abs(dragX) < 10 && onSelectProfile(topCard)}
              className="absolute bottom-0 inset-x-0 p-4 cursor-pointer"
            >
              <div className="flex items-end justify-between gap-2">
                <div>
                  <h3 className="text-2xl font-extrabold text-white leading-tight">
                    {topCard.name}, {topCard.age}
                  </h3>
                  <p className="text-xs text-slate-200 flex items-center gap-1 mt-0.5">
                    <span>{topCard.country?.flag}</span>
                    <MapPin className="w-3.5 h-3.5 text-brand-400" />
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
                  className="p-2.5 rounded-full bg-white/15 backdrop-blur-md text-white hover:bg-white/25"
                >
                  <Info className="w-5 h-5" />
                </button>
              </div>

              {topCard.bio && (
                <p className="text-xs text-slate-300 line-clamp-2 mt-2">{topCard.bio}</p>
              )}

              <div className="flex items-center gap-3 mt-2.5 text-[11px] text-slate-300 font-semibold">
                <span className="flex items-center gap-1 text-rose-300">
                  <Flame className="w-3.5 h-3.5" /> {topCard.likesCount || 0}
                </span>
                {Array.isArray(topCard.interests) &&
                  topCard.interests.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-full bg-white/10 text-slate-200"
                    >
                      {tag}
                    </span>
                  ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              disabled={busyAction}
              onClick={handlePass}
              className="w-14 h-14 rounded-full bg-slate-900 border border-slate-700 text-rose-400 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition"
              title="Pasar"
            >
              <X className="w-7 h-7" />
            </button>

            <button
              type="button"
              disabled={busyAction}
              onClick={handleVipDm}
              className="h-12 px-4 rounded-full bg-indigo-600 border border-indigo-400/50 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-lg hover:scale-105 active:scale-95 transition"
              title={`Mensaje Directo VIP (${VIP_DM_COST} monedas)`}
            >
              <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
              DM VIP ({VIP_DM_COST})
            </button>

            <button
              type="button"
              disabled={busyAction}
              onClick={handleLike}
              className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-500 to-pink-500 text-white flex items-center justify-center shadow-xl shadow-brand-500/30 hover:scale-105 active:scale-95 transition"
              title="Dar Like"
            >
              <Heart className="w-7 h-7 fill-white" />
            </button>
          </div>
        </div>
      )}

      {/* Match Celebration Popup */}
      {matchPopup && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-5">
          <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-brand-500/50 p-6 text-center shadow-2xl space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-r from-brand-500 to-amber-400 flex items-center justify-center shadow-lg">
              <MessageCircleHeart className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-black bg-gradient-to-r from-rose-300 to-amber-300 bg-clip-text text-transparent">
              ¡Es un Match!
            </h3>
            <p className="text-xs text-slate-300">
              A ti y a <strong>{matchPopup.targetUser.name}</strong> se gustaron mutuamente.
            </p>
            <img
              src={getPrimaryPhoto(matchPopup.targetUser)}
              alt={matchPopup.targetUser.name}
              className="w-28 h-28 mx-auto rounded-3xl object-cover border-2 border-brand-400"
            />
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMatchPopup(null)}
                className="py-3 rounded-2xl bg-slate-800 text-slate-200 text-xs font-bold"
              >
                Seguir viendo
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = matchPopup.targetUser;
                  const matchId = matchPopup.matchId;
                  setMatchPopup(null);
                  onOpenChat({
                    match: { id: matchId, participants: [currentUser.uid, target.uid || target.id] },
                    peerUser: target,
                  });
                }}
                className="py-3 rounded-2xl bg-gradient-to-r from-brand-500 to-pink-500 text-white text-xs font-extrabold"
              >
                Ir al Chat 💬
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
