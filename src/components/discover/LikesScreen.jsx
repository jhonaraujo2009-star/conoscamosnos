import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Coins,
  Crown,
  Flame,
  Gift,
  Heart,
  Lock,
  MessageCircle,
  Play,
  Sparkles,
  Tv,
  X,
  Zap,
} from 'lucide-react';
import { AD_REWARD_CONFIG } from '../../config/constants';
import {
  recordAdRewardUnlock,
  unlockAllLikesWithCoins,
  unlockChatWithCoins,
  unlockLikeWithCoins,
} from '../../services/adRewardService';
import { triggerMonetagZoneTag } from '../../services/monetagLoader';
import { getUserById, subscribePopularUsers } from '../../services/userService';
import {
  formatUserDistanceLabel,
  getDisplayAge,
  getPrimaryPhoto,
  isBoostActive,
  isProfileVerified,
  isUserActuallyOnline,
} from '../../utils/formatters';
import RewardedAdModal from '../monetization/RewardedAdModal';

function HeartArrow3D() {
  return (
    <svg
      className="w-36 h-36 drop-shadow-[0_16px_24px_rgba(244,63,94,0.28)]"
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

export default function LikesScreen({
  currentUser,
  receivedLikes = [],
  matches = [],
  userUnlocks = { revealedLikeIds: [], chatUnlockedUserIds: [] },
  onSelectProfile,
  onStartChat,
  onOpenCoinStore,
  onGoToSwipe,
  onOpenBoost,
  onSuccess,
  onError,
}) {
  const [subTab, setSubTab] = useState('likes'); // 'likes' | 'top_picks'
  const [topPicks, setTopPicks] = useState([]);
  const [likerProfiles, setLikerProfiles] = useState([]);

  // Sheet de decisión: Ver Anuncio Gratis vs Monedas
  const [choiceModal, setChoiceModal] = useState(null); // { mode: 'reveal_like' | 'unlock_chat', user }
  const [activeAd, setActiveAd] = useState(null); // { purpose: 'reveal_like' | 'unlock_chat', user }
  const [busyCoinAction, setBusyCoinAction] = useState(false);

  const blockedKey = (currentUser?.blockedUsers || []).join(',');

  // Conjunto de usuarios con quienes ya existe chat o match activo (nunca cobrar doble)
  const matchedPeerSet = useMemo(() => {
    const set = new Set();
    if (!currentUser?.uid) return set;
    matches.forEach((m) => {
      const peerId = (m.participants || []).find((p) => p !== currentUser.uid);
      if (peerId) set.add(peerId);
    });
    return set;
  }, [matches, currentUser?.uid]);

  const revealedSet = useMemo(() => {
    const set = new Set(userUnlocks?.revealedLikeIds || []);
    matchedPeerSet.forEach((uid) => set.add(uid));
    return set;
  }, [userUnlocks?.revealedLikeIds, matchedPeerSet]);

  const chatUnlockedSet = useMemo(() => {
    const set = new Set(userUnlocks?.chatUnlockedUserIds || []);
    matchedPeerSet.forEach((uid) => set.add(uid));
    return set;
  }, [userUnlocks?.chatUnlockedUserIds, matchedPeerSet]);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = subscribePopularUsers(
      {
        scope: 'global',
        countryCode: currentUser?.country?.code,
        currentUserId: currentUser.uid,
        blockedUsers: currentUser?.blockedUsers || [],
      },
      (list) => setTopPicks(list.slice(0, 16)),
      () => {}
    );
    return () => unsub();
  }, [currentUser?.uid, currentUser?.country?.code, blockedKey]);

  const likerIdsKey = useMemo(() => {
    const blockedSet = new Set(currentUser?.blockedUsers || []);
    return Array.from(
      new Set(receivedLikes.map((l) => l.fromUserId).filter((id) => Boolean(id) && !blockedSet.has(id)))
    )
      .sort()
      .join(',');
  }, [receivedLikes, blockedKey]);

  useEffect(() => {
    let cancelled = false;
    const fromIds = likerIdsKey ? likerIdsKey.split(',').filter(Boolean) : [];
    if (fromIds.length === 0) {
      setLikerProfiles([]);
      return;
    }
    Promise.all(fromIds.map((uid) => getUserById(uid).catch(() => null))).then((res) => {
      if (cancelled) return;
      setLikerProfiles(
        res.filter(
          (u) =>
            Boolean(u) &&
            !(Array.isArray(u.blockedUsers) && u.blockedUsers.includes(currentUser?.uid))
        )
      );
    });
    return () => {
      cancelled = true;
    };
  }, [likerIdsKey, currentUser?.uid]);

  const likesCount = likerProfiles.length;
  const lockedLikers = likerProfiles.filter((u) => !revealedSet.has(u.uid || u.id));
  const userCoins = Number(currentUser?.coins || 0);
  const unlockAllCost = Math.min(
    AD_REWARD_CONFIG.unlockAllLikesCoins,
    lockedLikers.length * AD_REWARD_CONFIG.unlockLikeCoins
  );

  const handleCardTap = (user) => {
    const uid = user.uid || user.id;
    if (revealedSet.has(uid)) {
      onSelectProfile?.(user);
    } else {
      setChoiceModal({ mode: 'reveal_like', user });
    }
  };

  const handleChatFromLike = (e, user) => {
    e.stopPropagation();
    const uid = user.uid || user.id;

    // Si ya existe chat o ya se desbloqueó el chat de este perfil, o si exige regalo del creador, abrir directo
    if (chatUnlockedSet.has(uid) || user.requireGiftToChat) {
      onStartChat?.(user);
      return;
    }

    setChoiceModal({ mode: 'unlock_chat', user });
  };

  const handleUnlockSingleWithCoins = async (mode, user) => {
    if (!currentUser?.uid || !user || busyCoinAction) return;
    const targetUid = user.uid || user.id;
    const cost =
      mode === 'unlock_chat'
        ? AD_REWARD_CONFIG.unlockLikeChatCoins
        : AD_REWARD_CONFIG.unlockLikeCoins;

    if (userCoins < cost) {
      setChoiceModal(null);
      setActiveAd(null);
      onError?.(`Necesitas ${cost} monedas. Recarga en la tienda o mira 1 anuncio gratis.`);
      onOpenCoinStore?.();
      return;
    }

    setBusyCoinAction(true);
    try {
      if (mode === 'unlock_chat') {
        await unlockChatWithCoins({ uid: currentUser.uid, targetUid, costCoins: cost });
        setChoiceModal(null);
        setActiveAd(null);
        onSuccess?.(`✨ Chat desbloqueado con ${user.name} al instante.`);
        onStartChat?.(user, { skipLikeChatGate: true });
      } else {
        await unlockLikeWithCoins({ uid: currentUser.uid, targetUid, costCoins: cost });
        setChoiceModal(null);
        setActiveAd(null);
        onSuccess?.(`💘 ¡Descubriste que le gustas a ${user.name}!`);
      }
    } catch (err) {
      onError?.(err.message || 'No se pudo completar el desbloqueo.');
    } finally {
      setBusyCoinAction(false);
    }
  };

  const handleUnlockAllLikesWithCoins = async () => {
    if (!currentUser?.uid || lockedLikers.length === 0 || busyCoinAction) return;
    const cost = unlockAllCost;
    if (userCoins < cost) {
      setChoiceModal(null);
      onError?.(`Necesitas ${cost} monedas para revelar todos los Likes de una vez.`);
      onOpenCoinStore?.();
      return;
    }
    setBusyCoinAction(true);
    try {
      const targetUids = lockedLikers.map((u) => u.uid || u.id);
      await unlockAllLikesWithCoins({ uid: currentUser.uid, targetUids, costCoins: cost });
      setChoiceModal(null);
      onSuccess?.(`✨ ¡Revelaste todos tus ${targetUids.length} Likes al instante!`);
    } catch (err) {
      onError?.(err.message || 'No se pudieron revelar tus Likes.');
    } finally {
      setBusyCoinAction(false);
    }
  };

  const handleAdCompleted = async () => {
    if (!activeAd || !currentUser?.uid) return;
    const { purpose, user } = activeAd;
    const targetUid = user.uid || user.id;
    try {
      await recordAdRewardUnlock({
        uid: currentUser.uid,
        purpose,
        targetUid,
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
    <div className="min-h-full bg-[#F4F4F6] text-zinc-900 flex flex-col justify-between">
      {/* Cabecera y Barra de sub-pestañas de 2 columnas */}
      <div className="bg-[#F4F4F6] pt-safe">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">Likes</h1>
          <button
            type="button"
            onClick={onOpenCoinStore}
            className="px-3 py-1.5 rounded-full bg-white border border-amber-200/80 shadow-sm text-xs font-extrabold text-amber-800 inline-flex items-center gap-1.5 hover:bg-amber-50 transition"
          >
            <Coins className="w-3.5 h-3.5 text-amber-500" />
            <span>{userCoins}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 border-b border-zinc-200">
          <button
            type="button"
            onClick={() => setSubTab('likes')}
            className={`py-3 text-sm font-extrabold text-center relative transition-colors ${
              subTab === 'likes' ? 'text-zinc-900' : 'text-zinc-400'
            }`}
          >
            {likesCount} {likesCount === 1 ? 'Like' : 'Likes'}
            {subTab === 'likes' && (
              <span className="absolute bottom-0 inset-x-8 h-[3px] rounded-full bg-[#FF2E54]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setSubTab('top_picks')}
            className={`py-3 text-sm font-extrabold text-center relative flex items-center justify-center gap-1.5 transition-colors ${
              subTab === 'top_picks' ? 'text-zinc-900' : 'text-zinc-400'
            }`}
          >
            <span>Top Picks</span>
            <span className="w-2 h-2 rounded-full bg-[#FF2E54]" />
            {subTab === 'top_picks' && (
              <span className="absolute bottom-0 inset-x-8 h-[3px] rounded-full bg-[#FF2E54]" />
            )}
          </button>
        </div>
      </div>

      {/* Contenido Principal */}
      {subTab === 'likes' ? (
        likerProfiles.length > 0 ? (
          <div className="flex-1 p-4 space-y-3.5">
            {/* Banner elegante explicando doble vía: Anuncio Gratis o Monedas */}
            {lockedLikers.length > 0 && (
              <div className="rounded-3xl p-4 bg-gradient-to-br from-[#190913] via-[#270B1C] to-[#120A14] border border-amber-300/25 text-white shadow-md space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/35 text-amber-200 text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> {lockedLikers.length} por descubrir
                  </span>
                  <span className="text-[10px] font-bold text-emerald-300 inline-flex items-center gap-1">
                    <Tv className="w-3 h-3" /> Gratis con anuncio
                  </span>
                </div>
                <p className="text-xs text-rose-100/85 leading-relaxed">
                  Toca cualquier perfil difuminado que te dio ❤️ en Swipe para desbloquearlo por <strong>{AD_REWARD_CONFIG.unlockLikeCoins} monedas</strong> o <strong>gratis viendo 1 anuncio</strong>.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {likerProfiles.map((user) => {
                const uid = user.uid || user.id;
                const isRevealed = revealedSet.has(uid);
                const isChatReady = chatUnlockedSet.has(uid);
                const verified = isProfileVerified(user);
                const visibleAge = getDisplayAge(user);

                return (
                  <div
                    key={uid}
                    onClick={() => handleCardTap(user)}
                    className="bg-white rounded-3xl overflow-hidden shadow-card cursor-pointer relative group"
                  >
                    <div className="aspect-[3/4] relative bg-zinc-200 overflow-hidden">
                      <img
                        src={getPrimaryPhoto(user, 450, { seed: currentUser?.uid })}
                        alt={isRevealed ? user.name : 'Persona interesada'}
                        className={`w-full h-full object-cover transition duration-500 ${
                          isRevealed ? 'group-hover:scale-105' : 'blur-xl scale-115 brightness-90'
                        }`}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />

                      {!isRevealed ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-between p-3 text-center text-white">
                          <span className="px-2.5 py-1 rounded-full bg-black/55 border border-white/15 text-[10px] font-extrabold backdrop-blur-sm">
                            ❤️ Le gustaste
                          </span>

                          <div className="space-y-1.5">
                            <div className="w-11 h-11 mx-auto rounded-2xl bg-gradient-to-br from-amber-300 via-amber-400 to-[#FF2E54] text-zinc-950 flex items-center justify-center shadow-lg">
                              <Lock className="w-5 h-5 stroke-[2.4]" />
                            </div>
                            <p className="text-xs font-black tracking-tight drop-shadow">
                              Toca para revelar
                            </p>
                          </div>

                          <div className="w-full py-1.5 px-2 rounded-full bg-white/95 text-zinc-900 text-[10px] font-black flex items-center justify-center gap-1 shadow">
                            <Play className="w-3 h-3 fill-[#FF2E54] text-[#FF2E54]" />
                            Anuncio o {AD_REWARD_CONFIG.unlockLikeCoins} 🪙
                          </div>
                        </div>
                      ) : (
                        <>
                          {user.requireGiftToChat && (
                            <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-amber-400/95 text-zinc-950 text-[9.5px] font-black inline-flex items-center gap-0.5 shadow">
                              <Crown className="w-2.5 h-2.5" /> Con regalo
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
                            <button
                              type="button"
                              onClick={(e) => handleChatFromLike(e, user)}
                              className={`mt-1.5 w-full py-1.5 rounded-full text-xs font-extrabold flex items-center justify-center gap-1 shadow transition ${
                                isChatReady
                                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                  : user.requireGiftToChat
                                  ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-zinc-950'
                                  : 'bg-gradient-to-r from-[#FF2E54] to-rose-500 text-white'
                              }`}
                            >
                              {user.requireGiftToChat && !isChatReady ? (
                                <>
                                  <Gift className="w-3.5 h-3.5" /> Regalar y Chatear
                                </>
                              ) : isChatReady ? (
                                <>
                                  <MessageCircle className="w-3.5 h-3.5" /> Ir al Chat
                                </>
                              ) : (
                                <>
                                  <MessageCircle className="w-3.5 h-3.5" /> Enviar Mensaje
                                </>
                              )}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
            <HeartArrow3D />
            <p className="text-sm font-bold text-zinc-800 mt-4">Aún no tienes Likes pendientes</p>
            <p className="text-xs font-medium text-zinc-500 mt-1 max-w-[260px] leading-relaxed">
              Cuando alguien te dé Like podrás descubrir quién es gratis viendo 1 anuncio o al instante con tus monedas.
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
                const online = isUserActuallyOnline(user);
                const boosted = isBoostActive(user);
                const verified = isProfileVerified(user);
                const visibleAge = getDisplayAge(user);
                const distInfo = formatUserDistanceLabel(user, currentUser);
                return (
                  <div
                    key={user.uid || user.id}
                    onClick={() => onSelectProfile(user)}
                    className="bg-white rounded-3xl overflow-hidden shadow-card cursor-pointer"
                  >
                    <div className="aspect-[3/4] relative bg-zinc-200">
                      <img
                        src={getPrimaryPhoto(user, 450, { seed: currentUser?.uid })}
                        alt={user.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                      {boosted && (
                        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-amber-400 text-black text-[10px] font-black flex items-center gap-0.5">
                          <Zap className="w-2.5 h-2.5 fill-black" /> TOP
                        </span>
                      )}
                      {online && (
                        <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
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
      <div className="p-4 pt-2 bg-[#F4F4F6] space-y-2">
        {subTab === 'likes' && lockedLikers.length >= 2 ? (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setChoiceModal({ mode: 'reveal_like', user: lockedLikers[0] })}
              className="bg-zinc-900 text-white rounded-full py-3.5 px-3 text-xs font-extrabold shadow-md flex items-center justify-center gap-1.5 active:scale-[0.99] transition-transform"
            >
              <Play className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              Ver 1 con Anuncio
            </button>
            <button
              type="button"
              disabled={busyCoinAction}
              onClick={handleUnlockAllLikesWithCoins}
              className="bg-gradient-to-r from-[#FF2E54] to-amber-500 text-white rounded-full py-3.5 px-3 text-xs font-extrabold shadow-md flex items-center justify-center gap-1.5 active:scale-[0.99] transition-transform disabled:opacity-50"
            >
              <Coins className="w-3.5 h-3.5" />
              Ver Todos ({unlockAllCost} 🪙)
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onGoToSwipe?.()}
              className="bg-zinc-900 text-white rounded-full py-3.5 text-xs sm:text-sm font-extrabold shadow-md flex items-center justify-center gap-1.5 active:scale-[0.99] transition-transform"
            >
              <Flame className="w-4 h-4 text-[#FF2E54] fill-[#FF2E54]" />
              Ir a Swipe
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

      {/* Modal de Elección Luxury: Gratis con Anuncio vs Monedas al Instante */}
      {choiceModal && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-white rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl animate-sheet-up">
            <div className="px-5 py-5 bg-gradient-to-br from-[#190913] via-[#2A0B1E] to-[#120911] text-white relative">
              <button
                type="button"
                onClick={() => setChoiceModal(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3.5 pr-8">
                <div className="w-14 h-14 rounded-2xl overflow-hidden ring-2 ring-amber-300/50 bg-zinc-800 shrink-0">
                  <img
                    src={getPrimaryPhoto(choiceModal.user, 200)}
                    alt=""
                    className={`w-full h-full object-cover ${
                      choiceModal.mode === 'reveal_like' ? 'blur-md scale-115' : ''
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/30 text-amber-200 text-[9.5px] font-black uppercase tracking-wider">
                    <Sparkles className="w-2.5 h-2.5" />
                    {choiceModal.mode === 'unlock_chat' ? 'Chat desde Likes' : 'Descubre quién te dio Like'}
                  </span>
                  <h3 className="font-display text-base font-black text-white mt-1 leading-tight">
                    {choiceModal.mode === 'unlock_chat'
                      ? `Enviar mensaje a ${choiceModal.user.name}`
                      : 'Elige cómo revelar este perfil'}
                  </h3>
                  <p className="text-[11px] text-rose-100/80 mt-0.5">
                    Elige la opción gratuita con anuncio o desbloquea sin esperas con tus monedas.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-3 bg-[#F4F4F6]">
              {/* Opción 1: Anuncio Publicitario Gratis (Monetag zona 311878 solo para quien no paga 10 monedas) */}
              <button
                type="button"
                onClick={() => {
                  const target = choiceModal;
                  if (AD_REWARD_CONFIG.provider === 'monetag') {
                    triggerMonetagZoneTag();
                  }
                  setChoiceModal(null);
                  setActiveAd({ purpose: target.mode, user: target.user });
                }}
                className="w-full p-4 rounded-3xl bg-white border-2 border-emerald-200 hover:border-emerald-400 shadow-card text-left flex items-center justify-between gap-3 transition active:scale-[0.99]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Play className="w-5 h-5 fill-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-extrabold text-zinc-900">
                        {choiceModal.mode === 'unlock_chat'
                          ? 'Enviar mensaje gratis'
                          : 'Desbloquear foto y perfil gratis'}
                      </p>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[9.5px] font-black uppercase">
                        $0
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      {choiceModal.mode === 'unlock_chat'
                        ? `¿No tienes ${AD_REWARD_CONFIG.unlockLikeChatCoins} monedas? Mira 1 anuncio (${AD_REWARD_CONFIG.adDurationSeconds}s) para abrir el chat.`
                        : `¿No tienes ${AD_REWARD_CONFIG.unlockLikeCoins} monedas? Mira 1 anuncio (${AD_REWARD_CONFIG.adDurationSeconds}s) y descubre quién te dio ❤️.`}
                    </p>
                  </div>
                </div>
                <Tv className="w-4 h-4 text-emerald-600 shrink-0" />
              </button>

              {/* Opción 2: Pagar con Monedas al Instante */}
              <button
                type="button"
                disabled={busyCoinAction}
                onClick={() => handleUnlockSingleWithCoins(choiceModal.mode, choiceModal.user)}
                className="w-full p-4 rounded-3xl bg-white border border-amber-200/90 hover:border-amber-400 shadow-card text-left flex items-center justify-between gap-3 transition active:scale-[0.99] disabled:opacity-50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-[#FF2E54] text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-zinc-900">
                      Desbloquear al instante (Sin anuncios)
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Usa{' '}
                      <strong>
                        {choiceModal.mode === 'unlock_chat'
                          ? AD_REWARD_CONFIG.unlockLikeChatCoins
                          : AD_REWARD_CONFIG.unlockLikeCoins}{' '}
                        monedas
                      </strong>{' '}
                      · Tu saldo: {userCoins} 🪙
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-black shrink-0">
                  {choiceModal.mode === 'unlock_chat'
                    ? AD_REWARD_CONFIG.unlockLikeChatCoins
                    : AD_REWARD_CONFIG.unlockLikeCoins}{' '}
                  🪙
                </span>
              </button>

              {choiceModal.mode === 'reveal_like' && lockedLikers.length >= 2 && (
                <button
                  type="button"
                  disabled={busyCoinAction}
                  onClick={handleUnlockAllLikesWithCoins}
                  className="w-full py-3 rounded-full bg-zinc-900 text-white text-xs font-extrabold hover:bg-zinc-800 transition flex items-center justify-center gap-1.5"
                >
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                  Revelar TODOS los {lockedLikers.length} Likes por {unlockAllCost} monedas
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reproductor de Anuncio Recompensado */}
      <RewardedAdModal
        isOpen={Boolean(activeAd)}
        purpose={activeAd?.purpose || 'reveal_like'}
        targetName={activeAd?.user?.name || 'esta persona'}
        coinCost={
          activeAd?.purpose === 'unlock_chat'
            ? AD_REWARD_CONFIG.unlockLikeChatCoins
            : AD_REWARD_CONFIG.unlockLikeCoins
        }
        onClose={() => setActiveAd(null)}
        onRewardEarned={handleAdCompleted}
        onUseCoinsInstead={() => {
          if (!activeAd) return;
          handleUnlockSingleWithCoins(activeAd.purpose, activeAd.user);
        }}
      />
    </div>
  );
}
