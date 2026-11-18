import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Camera,
  Crown,
  Flame,
  Gem,
  Gift,
  Heart,
  Lock,
  MessageCircle,
  Play,
  Sparkles,
  Tv,
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
import { getUserById, subscribePopularUsers } from '../../services/userService';
import {
  formatUserDistanceLabel,
  getDisplayAge,
  getPrimaryPhoto,
  getSpendableDiamonds,
  isBoostActive,
  isProActive,
  isProfileVerified,
  isUserActuallyOnline,
} from '../../utils/formatters';
import RewardedAdModal from '../monetization/RewardedAdModal';
import UnlockChoiceModal from '../monetization/UnlockChoiceModal';

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

  const [subTab, setSubTab] = useState('likes'); // 'likes' | 'top_picks'
  const [topPicks, setTopPicks] = useState([]);
  const [likerProfiles, setLikerProfiles] = useState([]);

  // Sheet de decisión: Ver Anuncio Gratis vs Diamantes 💎 vs PRO
  const [choiceModal, setChoiceModal] = useState(null); // { mode: 'reveal_like' | 'unlock_chat', user }
  const [activeAd, setActiveAd] = useState(null); // { purpose: 'reveal_like' | 'unlock_chat', user }
  const [busyDiamondAction, setBusyDiamondAction] = useState(false);

  const blockedKey = (currentUser?.blockedUsers || []).join(',');

  // Mapa rápido de metadata del Like (para saber a qué foto específica le dieron ❤️)
  const likeBySender = useMemo(() => {
    const map = {};
    receivedLikes.forEach((l) => {
      if (l?.fromUserId) {
        map[l.fromUserId] = l;
      }
    });
    return map;
  }, [receivedLikes]);

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
    if (policy.isFreeMode || proActive) {
      likerProfiles.forEach((u) => {
        const id = u.uid || u.id;
        if (id) set.add(id);
      });
    }
    return set;
  }, [userUnlocks?.revealedLikeIds, matchedPeerSet, policy.isFreeMode, proActive, likerProfiles]);

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
  const userDiamonds = getSpendableDiamonds(currentUser);
  const unlockAllCost = Math.min(
    policy.unlockAllLikesDiamonds,
    lockedLikers.length * policy.unlockLikeDiamonds
  );

  const handleCardTap = (user) => {
    const uid = user.uid || user.id;
    if (policy.isFreeMode || proActive || revealedSet.has(uid)) {
      onSelectProfile?.(user);
    } else {
      setChoiceModal({ mode: 'reveal_like', user });
    }
  };

  const handleChatFromLike = (e, user) => {
    e.stopPropagation();
    const uid = user.uid || user.id;

    // En Modo Libre, miembro PRO, chat ya desbloqueado o creador con regalo: abrir directo sin modal extra
    if (policy.isFreeMode || proActive || chatUnlockedSet.has(uid) || user.requireGiftToChat) {
      onStartChat?.(user);
      return;
    }

    setChoiceModal({ mode: 'unlock_chat', user });
  };

  const handleUnlockSingleWithDiamonds = async (mode, user) => {
    if (!currentUser?.uid || !user || busyDiamondAction || !policy.enableDiamondCharges) return;
    const targetUid = user.uid || user.id;
    const cost =
      mode === 'unlock_chat'
        ? policy.unlockChatDiamonds
        : policy.unlockLikeDiamonds;

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
        await unlockChatWithDiamonds({ uid: currentUser.uid, targetUid, costDiamonds: cost });
        setChoiceModal(null);
        setActiveAd(null);
        onSuccess?.(`✨ Chat desbloqueado con ${user.name} al instante.`);
        onStartChat?.(user, { skipLikeChatGate: true });
      } else {
        await unlockLikeWithDiamonds({ uid: currentUser.uid, targetUid, costDiamonds: cost });
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
    if (!currentUser?.uid || lockedLikers.length === 0 || busyDiamondAction || !policy.enableDiamondCharges) return;
    const cost = unlockAllCost;
    if (userDiamonds < cost) {
      setChoiceModal(null);
      onError?.(`Necesitas ${cost} 💎 para revelar todos los Likes de una vez.`);
      onOpenDiamondStore?.();
      return;
    }
    setBusyDiamondAction(true);
    try {
      const targetUids = lockedLikers.map((u) => u.uid || u.id);
      await unlockAllLikesWithDiamonds({ uid: currentUser.uid, targetUids, costDiamonds: cost });
      setChoiceModal(null);
      onSuccess?.(`✨ ¡Revelaste todos tus ${targetUids.length} Likes al instante!`);
    } catch (err) {
      onError?.(err.message || 'No se pudieron revelar tus Likes.');
    } finally {
      setBusyDiamondAction(false);
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
    <div className="min-h-full bg-gradient-to-b from-[#FBF7F9] via-[#FAF7F9] to-[#F4F1F5] text-zinc-900 flex flex-col justify-between">
      {/* Cabecera y Barra de sub-pestañas de 2 columnas */}
      <div className="bg-transparent pt-safe">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl font-black tracking-tight text-zinc-900">Likes</h1>
            {proActive && (
              <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#FF2E54] to-amber-500 text-white text-[10px] font-black inline-flex items-center gap-1 shadow-xs">
                <Crown className="w-3 h-3" /> PRO
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {!proActive && onOpenPro && (
              <button
                type="button"
                onClick={onOpenPro}
                className="px-3 py-1.5 rounded-full bg-gradient-to-r from-[#FF2E54] to-amber-500 text-white shadow-sm text-xs font-extrabold inline-flex items-center gap-1 hover:brightness-105 transition"
              >
                <Crown className="w-3.5 h-3.5" />
                <span>PRO</span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenDiamondStore}
              className="px-3 py-1.5 rounded-full bg-white border border-sky-200/80 shadow-sm text-xs font-extrabold text-sky-800 inline-flex items-center gap-1.5 hover:bg-sky-50 transition tabular-nums"
            >
              <Gem className="w-3.5 h-3.5 text-sky-500" />
              <span>{userDiamonds} 💎</span>
            </button>
          </div>
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
            {/* Banner dinámico según Conoscamosnos PRO o política global configurada por el Super Admin */}
            {proActive ? (
              <div className="rounded-3xl p-3.5 bg-gradient-to-r from-rose-50 via-white to-amber-50 border border-rose-200/80 text-zinc-800 shadow-sm flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-rose-800 inline-flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-[#FF2E54] shrink-0" />
                  Conoscamosnos PRO activo: mira quién dio Like a tus fotos y chatea sin límites
                </span>
              </div>
            ) : policy.isFreeMode ? (
              <div className="rounded-3xl p-3.5 bg-gradient-to-r from-emerald-50 via-white to-rose-50 border border-emerald-200/80 text-zinc-800 shadow-sm flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-emerald-800 inline-flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                  Modo Libre activo: mira quién te dio Like y chatea gratis
                </span>
              </div>
            ) : lockedLikers.length > 0 ? (
              <div className="rounded-3xl p-4 bg-gradient-to-br from-[#190913] via-[#270B1C] to-[#120A14] border border-amber-300/25 text-white shadow-md space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/35 text-amber-200 text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> {lockedLikers.length} por descubrir
                  </span>
                  {policy.enableRewardedAds && (
                    <span className="text-[10px] font-bold text-emerald-300 inline-flex items-center gap-1">
                      <Tv className="w-3 h-3" /> Gratis con anuncio ({policy.adDurationSeconds}s)
                    </span>
                  )}
                </div>
                <p className="text-xs text-rose-100/85 leading-relaxed">
                  {policy.enableDiamondCharges && policy.enableRewardedAds ? (
                    <>
                      Toca cualquier perfil difuminado que te dio ❤️ para ver quién es y qué foto tuya le gustó por{' '}
                      <strong>{policy.unlockLikeDiamonds} 💎</strong>,{' '}
                      <strong>gratis con 1 anuncio</strong> o con <strong>Conoscamosnos PRO</strong>.
                    </>
                  ) : policy.enableRewardedAds ? (
                    <>
                      Toca cualquier perfil difuminado para descubrir quién te dio ❤️{' '}
                      <strong>100% gratis viendo 1 anuncio</strong>.
                    </>
                  ) : (
                    <>
                      Toca cualquier perfil difuminado que te dio ❤️ para revelarlo al instante por{' '}
                      <strong>{policy.unlockLikeDiamonds} 💎</strong> o con <strong>Conoscamosnos PRO</strong>.
                    </>
                  )}
                </p>
                {onOpenPro && (
                  <button
                    type="button"
                    onClick={onOpenPro}
                    className="w-full py-2 px-3 rounded-full bg-gradient-to-r from-[#FF2E54] to-amber-500 text-white text-[11px] font-black flex items-center justify-center gap-1.5 shadow hover:brightness-105 transition"
                  >
                    <Crown className="w-3.5 h-3.5" />
                    Activar Conoscamosnos PRO · Ver todos y chatear ilimitado
                  </button>
                )}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              {likerProfiles.map((user) => {
                const uid = user.uid || user.id;
                const isRevealed = revealedSet.has(uid);
                const isChatReady = chatUnlockedSet.has(uid);
                const verified = isProfileVerified(user);
                const userIsPro = isProActive(user);
                const visibleAge = getDisplayAge(user);
                const likeDoc = likeBySender[uid] || null;
                const likedPhotoIdx = Number(likeDoc?.likedPhotoIndex ?? 0);
                const likedPhotoUrl = likeDoc?.likedPhotoUrl || '';

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
                          isRevealed ? 'group-hover:scale-105' : 'blur-xl scale-110 brightness-90'
                        }`}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />

                      {!isRevealed ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-between p-3 text-center text-white">
                          <span className="px-2.5 py-1 rounded-full bg-black/55 border border-white/15 text-[10px] font-extrabold backdrop-blur-sm inline-flex items-center gap-1">
                            <Camera className="w-3 h-3 text-rose-400" />
                            Le gustó tu foto #{likedPhotoIdx + 1}
                          </span>

                          <div className="space-y-1.5">
                            <div className="w-11 h-11 mx-auto rounded-2xl bg-gradient-to-br from-sky-400 via-indigo-400 to-[#FF2E54] text-white flex items-center justify-center shadow-lg">
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
                          {/* Insignia de qué foto específica le gustó */}
                          <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between gap-1">
                            <span className="px-2 py-0.5 rounded-full bg-black/65 border border-white/15 text-white text-[9.5px] font-extrabold inline-flex items-center gap-1 backdrop-blur-xs">
                              <Heart className="w-2.5 h-2.5 fill-[#FF2E54] text-[#FF2E54]" />
                              Tu foto #{likedPhotoIdx + 1}
                            </span>

                            {likedPhotoUrl ? (
                              <img
                                src={likedPhotoUrl}
                                alt="Foto tuya que le gustó"
                                title={`Le gustó tu foto #${likedPhotoIdx + 1}`}
                                className="w-7 h-7 rounded-lg object-cover border-2 border-white shadow-md shrink-0"
                              />
                            ) : user.requireGiftToChat ? (
                              <span className="px-2 py-0.5 rounded-full bg-amber-400/95 text-zinc-950 text-[9.5px] font-black inline-flex items-center gap-0.5 shadow">
                                <Crown className="w-2.5 h-2.5" /> Regalo
                              </span>
                            ) : null}
                          </div>

                          <div className="absolute bottom-2.5 inset-x-3 text-white">
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
                            <button
                              type="button"
                              onClick={(e) => handleChatFromLike(e, user)}
                              className={`mt-1.5 w-full py-1.5 rounded-full text-xs font-extrabold flex items-center justify-center gap-1 shadow transition ${
                                isChatReady
                                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                  : user.requireGiftToChat && !proActive
                                  ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-zinc-950'
                                  : 'bg-gradient-to-r from-[#FF2E54] to-rose-500 text-white'
                              }`}
                            >
                              {user.requireGiftToChat && !isChatReady && !proActive ? (
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
              {proActive || policy.isFreeMode
                ? 'Cuando alguien le dé Like a tu foto lo verás aquí totalmente desbloqueado al instante.'
                : policy.enableRewardedAds && policy.enableDiamondCharges
                ? 'Cuando alguien te dé Like podrás descubrir quién es y qué foto tuya le gustó gratis viendo 1 anuncio, con Diamantes (💎) o con Conoscamosnos PRO.'
                : policy.enableRewardedAds
                ? 'Cuando alguien te dé Like podrás descubrir quién es gratis viendo 1 anuncio.'
                : 'Cuando alguien te dé Like podrás descubrir quién es al instante con tus Diamantes (💎) o siendo PRO.'}
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
      <div className="p-4 pt-2 bg-transparent space-y-2">
        {subTab === 'likes' && !policy.isFreeMode && !proActive && lockedLikers.length >= 2 && (policy.enableRewardedAds || policy.enableDiamondCharges) ? (
          <div className={`grid gap-2.5 ${policy.enableRewardedAds && policy.enableDiamondCharges ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {policy.enableRewardedAds && (
              <button
                type="button"
                onClick={() => setChoiceModal({ mode: 'reveal_like', user: lockedLikers[0] })}
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
        lockedLikesCount={lockedLikers.length}
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
