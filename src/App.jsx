import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Coins, Flame, LogOut, Play, ShieldAlert, Sparkles, Tv, X } from 'lucide-react';
import { AD_REWARD_CONFIG, getIntentionMood, MIN_AGE } from './config/constants';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import {
  recordAdRewardUnlock,
  subscribeUserUnlocks,
  unlockChatWithCoins,
} from './services/adRewardService';
import { triggerMonetagZoneTag } from './services/monetagLoader';
import { logoutUser } from './services/authService';
import {
  sendVirtualGift,
  subscribeReceivedGiftTransactions,
  subscribeUserMatches,
} from './services/chatService';
import {
  checkConnectionStatus,
  openOrCreateDirectChat,
  subscribeReceivedLikes,
} from './services/discoveryService';
import { getUserById } from './services/userService';
import {
  buildMatchId,
  isGiftChatUnlocked,
  isMatchUnread,
  toMillis,
} from './utils/formatters';
import AuthScreen from './components/auth/AuthScreen';
import OnboardingWizard from './components/auth/OnboardingWizard';
import MobileShell from './components/layout/MobileShell';
import NotificationBanner from './components/layout/NotificationBanner';
import HomeFeed from './components/home/HomeFeed';
import DiscoverSwipe from './components/discover/DiscoverSwipe';
import LikesScreen from './components/discover/LikesScreen';
import PublicProfileModal from './components/discover/PublicProfileModal';
import ChatList from './components/chat/ChatList';
import ChatRoom from './components/chat/ChatRoom';
import GiftAnimationOverlay from './components/chat/GiftAnimationOverlay';
import GiftGateChatModal from './components/chat/GiftGateChatModal';
import ProfileScreen from './components/profile/ProfileScreen';
import SafetyCenterModal from './components/profile/SafetyCenterModal';
import CoinStoreModal from './components/monetization/CoinStoreModal';
import EarningsWithdrawModal from './components/monetization/EarningsWithdrawModal';
import GiftNotificationsModal from './components/monetization/GiftNotificationsModal';
import RewardedAdModal from './components/monetization/RewardedAdModal';
import BoostModal from './components/home/BoostModal';
import AdminDashboardPage from './components/admin/AdminDashboardPage';
import AdminPanelModal from './components/admin/AdminPanelModal';

function FullScreenLoader() {
  return (
    <div className="h-[100dvh] w-screen bg-black flex flex-col items-center justify-center gap-3 overflow-hidden">
      <div className="w-14 h-14 rounded-full bg-[#FF2E54] flex items-center justify-center animate-pulse">
        <Flame className="w-8 h-8 text-white fill-white" />
      </div>
    </div>
  );
}

function SuspendedAccountScreen({ userProfile }) {
  return (
    <div className="h-[100dvh] w-screen bg-[#0D0912] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-[32px] bg-[#171222] border border-rose-500/30 p-7 text-center space-y-4 shadow-2xl">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/20 border border-rose-400/40 text-[#FF2E54] flex items-center justify-center">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div>
          <h2 className="font-display text-xl font-black text-white">Cuenta Suspendida</h2>
          <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
            Tu acceso a Conoscamosnos fue restringido por el equipo de moderación.
          </p>
        </div>
        {userProfile?.banReason && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-200 font-semibold">
            Motivo: {userProfile.banReason}
          </div>
        )}
        <button
          type="button"
          onClick={() => logoutUser(userProfile?.uid)}
          className="w-full py-3 rounded-full bg-white text-zinc-950 text-xs font-black flex items-center justify-center gap-2 hover:bg-zinc-200 transition"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

function UserAppView({ onSuccess, onError }) {
  const navigate = useNavigate();
  const { firebaseUser, userProfile, isBanned } = useAuth();

  // 5 Pestañas: 'swipe' | 'explore' | 'likes' | 'chat' | 'profile'
  const [activeTab, setActiveTab] = useState('swipe');
  const [swipeScope, setSwipeScope] = useState('global');
  const [swipeIntention, setSwipeIntention] = useState('Todos');
  const [swipeGenderPref, setSwipeGenderPref] = useState(null);
  const [swipeAgeRange, setSwipeAgeRange] = useState({ min: MIN_AGE, max: 60 });
  const [swipeMoodKey, setSwipeMoodKey] = useState('Todos');
  const [matches, setMatches] = useState([]);
  const [receivedLikes, setReceivedLikes] = useState([]);
  const [receivedGifts, setReceivedGifts] = useState([]);
  const [userUnlocks, setUserUnlocks] = useState({
    revealedLikeIds: [],
    chatUnlockedUserIds: [],
    totalAdsWatched: 0,
  });
  const [likesSeenAt, setLikesSeenAt] = useState(0);
  const [giftsSeenAt, setGiftsSeenAt] = useState(0);
  const [optimisticReadMap, setOptimisticReadMap] = useState({});
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [activeChat, setActiveChat] = useState(null);
  const [giftGateTarget, setGiftGateTarget] = useState(null);
  const [sendingGateGiftId, setSendingGateGiftId] = useState(null);
  const [gateGiftAnim, setGateGiftAnim] = useState(null);
  const [likeChatGateTarget, setLikeChatGateTarget] = useState(null);
  const [likeChatAdTarget, setLikeChatAdTarget] = useState(null);
  const [busyLikeChatCoins, setBusyLikeChatCoins] = useState(false);

  const [coinStoreOpen, setCoinStoreOpen] = useState(false);
  const [withdrawalsOpen, setWithdrawalsOpen] = useState(false);
  const [giftNotificationsOpen, setGiftNotificationsOpen] = useState(false);
  const [boostOpen, setBoostOpen] = useState(false);
  const [safetyCenterOpen, setSafetyCenterOpen] = useState(false);
  const [safetyInitialTab, setSafetyInitialTab] = useState('blocked');
  const [adminOpen, setAdminOpen] = useState(false);

  const seenGiftIdsRef = useRef(new Set());
  const giftsLoadedRef = useRef(false);

  const handleSuccess = onSuccess;
  const handleError = onError;

  const activeMood = useMemo(() => getIntentionMood(swipeMoodKey), [swipeMoodKey]);

  // Actualizar dinámicamente la barra de estado del dispositivo según el tema romántico activo
  useEffect(() => {
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) return;
    metaTheme.setAttribute(
      'content',
      activeTab === 'swipe' && firebaseUser ? activeMood.themeColor : '#F4F4F6'
    );
  }, [activeTab, firebaseUser, activeMood.themeColor]);

  // Aislar completamente el estado cuando cambia el usuario autenticado
  useEffect(() => {
    setActiveChat(null);
    setSelectedProfile(null);
    setCoinStoreOpen(false);
    setWithdrawalsOpen(false);
    setGiftNotificationsOpen(false);
    setBoostOpen(false);
    setSafetyCenterOpen(false);
    setSafetyInitialTab('blocked');
    setAdminOpen(false);
    setGiftGateTarget(null);
    setSendingGateGiftId(null);
    setGateGiftAnim(null);
    setLikeChatGateTarget(null);
    setLikeChatAdTarget(null);
    setBusyLikeChatCoins(false);
    setReceivedGifts([]);
    setOptimisticReadMap({});
    setUserUnlocks({ revealedLikeIds: [], chatUnlockedUserIds: [], totalAdsWatched: 0 });
    seenGiftIdsRef.current = new Set();
    giftsLoadedRef.current = false;
    try {
      const savedGiftsSeen = firebaseUser?.uid
        ? Number(localStorage.getItem(`conoscamosnos_gifts_seen_${firebaseUser.uid}`) || 0)
        : 0;
      setGiftsSeenAt(Number.isNaN(savedGiftsSeen) ? 0 : savedGiftsSeen);

      const savedLikesSeen = firebaseUser?.uid
        ? Number(localStorage.getItem(`conoscamosnos_likes_seen_${firebaseUser.uid}`) || 0)
        : 0;
      setLikesSeenAt(Number.isNaN(savedLikesSeen) ? 0 : savedLikesSeen);
    } catch {
      setGiftsSeenAt(0);
      setLikesSeenAt(0);
    }
    setSwipeScope('global');
    setSwipeIntention('Todos');
    setSwipeGenderPref(null);
    setSwipeAgeRange({ min: MIN_AGE, max: 60 });
    setSwipeMoodKey('Todos');
    setActiveTab('swipe');
  }, [firebaseUser?.uid]);

  useEffect(() => {
    if (!userProfile?.uid || !userProfile?.onboardingCompleted) {
      setMatches([]);
      setReceivedLikes([]);
      setReceivedGifts([]);
      setUserUnlocks({ revealedLikeIds: [], chatUnlockedUserIds: [], totalAdsWatched: 0 });
      seenGiftIdsRef.current = new Set();
      giftsLoadedRef.current = false;
      return;
    }
    const unsubMatches = subscribeUserMatches(
      userProfile.uid,
      setMatches,
      (err) => console.error('Error suscribiendo matches:', err)
    );
    const unsubLikes = subscribeReceivedLikes(userProfile.uid, setReceivedLikes);
    const unsubUnlocks = subscribeUserUnlocks(userProfile.uid, setUserUnlocks);
    const unsubGifts = subscribeReceivedGiftTransactions(
      userProfile.uid,
      (list) => {
        if (!giftsLoadedRef.current) {
          seenGiftIdsRef.current = new Set(list.map((g) => g.id));
          giftsLoadedRef.current = true;
        } else {
          const freshGift = list.find(
            (g) => g.receiverId === userProfile.uid && !seenGiftIdsRef.current.has(g.id)
          );
          list.forEach((g) => seenGiftIdsRef.current.add(g.id));
          if (freshGift) {
            handleSuccess(
              `${freshGift.giftIcon || '🎁'} ¡${freshGift.senderName || 'Alguien'} te regaló ${
                freshGift.giftName || 'un regalo'
              } (+${freshGift.diamondsCredited || 0} 💎)!`
            );
          }
        }
        setReceivedGifts(list);
      },
      (err) => console.error('Error suscribiendo regalos recibidos:', err)
    );
    return () => {
      unsubMatches();
      unsubLikes();
      unsubUnlocks();
      unsubGifts();
    };
  }, [userProfile?.uid, userProfile?.onboardingCompleted, handleSuccess]);

  const markLikesAsSeen = useCallback(() => {
    const now = Date.now();
    setLikesSeenAt(now);
    if (userProfile?.uid) {
      try {
        localStorage.setItem(`conoscamosnos_likes_seen_${userProfile.uid}`, String(now));
      } catch {
        // ignore storage restrictions
      }
    }
  }, [userProfile?.uid]);

  const handleChangeTab = useCallback(
    (nextTab) => {
      setActiveTab(nextTab);
      // Al abrir la pestaña Likes, desaparece inmediatamente la burbuja de Likes.
      // La burbuja de Chat NO desaparece al abrir la pestaña: solo descuenta al abrir cada conversación.
      if (nextTab === 'likes') {
        markLikesAsSeen();
      }
    },
    [markLikesAsSeen]
  );

  // Si llegan likes nuevos mientras el usuario ya está viendo la pestaña Likes, mantenerlos marcados como vistos
  useEffect(() => {
    if (activeTab === 'likes' && receivedLikes.length > 0) {
      markLikesAsSeen();
    }
  }, [activeTab, receivedLikes.length, markLikesAsSeen]);

  const unreadLikesCount = useMemo(() => {
    if (!userProfile?.uid || activeTab === 'likes') return 0;
    const blockedSet = new Set(userProfile.blockedUsers || []);
    return receivedLikes.filter((like) => {
      if (!like?.fromUserId || blockedSet.has(like.fromUserId)) return false;
      const ms = toMillis(like.createdAt);
      if (!likesSeenAt) return true;
      return ms === 0 || ms > likesSeenAt;
    }).length;
  }, [receivedLikes, userProfile?.uid, userProfile?.blockedUsers, likesSeenAt, activeTab]);

  const unreadGiftsCount = useMemo(() => {
    if (!userProfile?.uid) return 0;
    return receivedGifts.filter((g) => {
      if (g.receiverId !== userProfile.uid) return false;
      const ms = toMillis(g.createdAt);
      if (!giftsSeenAt) return true;
      return ms === 0 || ms > giftsSeenAt;
    }).length;
  }, [receivedGifts, userProfile?.uid, giftsSeenAt]);

  const handleOpenGiftNotifications = useCallback(() => {
    const now = Date.now();
    setGiftsSeenAt(now);
    if (userProfile?.uid) {
      try {
        localStorage.setItem(`conoscamosnos_gifts_seen_${userProfile.uid}`, String(now));
      } catch {
        // ignore storage restrictions
      }
    }
    setGiftNotificationsOpen(true);
  }, [userProfile?.uid]);

  const handleMarkMatchReadOptimistic = useCallback((matchId) => {
    if (!matchId) return;
    setOptimisticReadMap((prev) => ({ ...prev, [matchId]: Date.now() }));
  }, []);

  const handleOpenChatSession = useCallback(
    (chatSession) => {
      if (chatSession?.match?.id) {
        handleMarkMatchReadOptimistic(chatSession.match.id);
      }
      setActiveChat(chatSession);
    },
    [handleMarkMatchReadOptimistic]
  );

  const unreadChatsCount = useMemo(() => {
    if (!userProfile?.uid) return 0;
    const blockedSet = new Set(userProfile.blockedUsers || []);
    return matches.filter((m) => {
      const peerId = (m.participants || []).find((p) => p !== userProfile.uid);
      if (!peerId || blockedSet.has(peerId)) return false;
      return isMatchUnread(m, userProfile.uid, optimisticReadMap[m.id]);
    }).length;
  }, [matches, userProfile?.uid, userProfile?.blockedUsers, optimisticReadMap]);

  const handleStartDirectChat = useCallback(
    async (targetUser, options = {}) => {
      if (!userProfile?.uid || !targetUser) return;
      const targetUid = targetUser.uid || targetUser.id;
      if (!targetUid || targetUid === userProfile.uid) return;

      try {
        const freshTarget = (await getUserById(targetUid).catch(() => null)) || targetUser;

        if (Array.isArray(userProfile.blockedUsers) && userProfile.blockedUsers.includes(targetUid)) {
          throw new Error('Desbloquea a este usuario primero para enviarle mensajes.');
        }
        if (Array.isArray(freshTarget.blockedUsers) && freshTarget.blockedUsers.includes(userProfile.uid)) {
          throw new Error('Este perfil no está disponible para recibir mensajes.');
        }

        const matchId = buildMatchId(userProfile.uid, targetUid);
        let existingMatch = matches.find((m) => m.id === matchId) || null;
        if (!existingMatch && freshTarget.requireGiftToChat) {
          const conn = await checkConnectionStatus(userProfile.uid, targetUid).catch(() => null);
          existingMatch = conn?.matchData || null;
        }

        // Si el perfil exige regalo para iniciar chats nuevos y este usuario aún no ha desbloqueado con regalo
        if (!isGiftChatUnlocked(existingMatch, userProfile.uid, freshTarget)) {
          setSelectedProfile(null);
          setGiftGateTarget(freshTarget);
          return;
        }

        // Si es una persona que le dio Like (y no tienen chat todavía), exigir 10 monedas o 1 anuncio antes de chatear
        const isIncomingLiker = receivedLikes.some((like) => like.fromUserId === targetUid);
        const isLikeChatUnlocked =
          Boolean(options.skipLikeChatGate) ||
          Boolean(existingMatch) ||
          (userUnlocks?.chatUnlockedUserIds || []).includes(targetUid);

        if (isIncomingLiker && !isLikeChatUnlocked) {
          setSelectedProfile(null);
          setLikeChatGateTarget(freshTarget);
          return;
        }

        const res = await openOrCreateDirectChat({
          currentUser: userProfile,
          targetUser: freshTarget,
        });
        setSelectedProfile(null);
        handleOpenChatSession({
          match: res.matchData,
          peerUser: freshTarget,
        });
        setActiveTab('chat');
      } catch (err) {
        handleError(err.message || 'No se pudo abrir la conversación privada.');
      }
    },
    [userProfile, matches, receivedLikes, userUnlocks, handleOpenChatSession, handleError]
  );

  const handleUnlockLikeChatWithCoins = useCallback(
    async (target) => {
      if (!userProfile?.uid || !target || busyLikeChatCoins) return;
      const targetUid = target.uid || target.id;
      const cost = AD_REWARD_CONFIG.unlockLikeChatCoins;
      if (Number(userProfile.coins || 0) < cost) {
        setLikeChatGateTarget(null);
        setLikeChatAdTarget(null);
        handleError(`Necesitas ${cost} monedas. Recarga en la tienda o mira 1 anuncio gratis.`);
        setCoinStoreOpen(true);
        return;
      }

      setBusyLikeChatCoins(true);
      try {
        await unlockChatWithCoins({
          uid: userProfile.uid,
          targetUid,
          costCoins: cost,
        });
        setLikeChatGateTarget(null);
        setLikeChatAdTarget(null);
        handleSuccess(`✨ Chat desbloqueado con ${target.name || 'esta persona'} al instante.`);
        await handleStartDirectChat(target, { skipLikeChatGate: true });
      } catch (err) {
        handleError(err.message || 'No se pudo desbloquear el chat.');
      } finally {
        setBusyLikeChatCoins(false);
      }
    },
    [userProfile, busyLikeChatCoins, handleError, handleSuccess, handleStartDirectChat]
  );

  const handleLikeChatAdCompleted = useCallback(async () => {
    if (!userProfile?.uid || !likeChatAdTarget) return;
    const target = likeChatAdTarget;
    const targetUid = target.uid || target.id;
    try {
      await recordAdRewardUnlock({
        uid: userProfile.uid,
        purpose: 'unlock_chat',
        targetUid,
      });
      setLikeChatAdTarget(null);
      handleSuccess(`🎉 ¡Anuncio completado! Chat abierto gratis con ${target.name || 'esta persona'}.`);
      await handleStartDirectChat(target, { skipLikeChatGate: true });
    } catch (err) {
      handleError(err.message || 'No se pudo registrar el desbloqueo del chat.');
    }
  }, [userProfile?.uid, likeChatAdTarget, handleSuccess, handleStartDirectChat, handleError]);

  const handleSendGiftToUnlockChat = useCallback(
    async (gift) => {
      if (!userProfile?.uid || !giftGateTarget || sendingGateGiftId) return;
      setSendingGateGiftId(gift.id);
      try {
        const target = giftGateTarget;
        const res = await sendVirtualGift({
          sender: userProfile,
          receiver: target,
          gift,
        });
        setGiftGateTarget(null);
        setGateGiftAnim({
          giftIcon: gift.icon,
          giftName: gift.name,
          giftValue: gift.price,
          diamondsCredited: gift.price,
          isReceiver: false,
        });
        handleSuccess(`${gift.icon} ¡Enviaste ${gift.name}! Chat privado desbloqueado con ${target.name}.`);
        const targetUid = target.uid || target.id;
        handleOpenChatSession({
          match: {
            id: res.matchId,
            participants: [userProfile.uid, targetUid].sort(),
            giftUnlockedBy: { [userProfile.uid]: true },
          },
          peerUser: target,
        });
        setActiveTab('chat');
      } catch (err) {
        handleError(err.message || 'No se pudo enviar el regalo.');
      } finally {
        setSendingGateGiftId(null);
      }
    },
    [userProfile, giftGateTarget, sendingGateGiftId, handleSuccess, handleOpenChatSession, handleError]
  );

  if (isBanned) {
    return <SuspendedAccountScreen userProfile={userProfile} />;
  }

  if (!userProfile?.onboardingCompleted) {
    return (
      <div className="h-[100dvh] w-screen overflow-y-auto bg-[#F4F4F6]">
        <OnboardingWizard
          userProfile={userProfile}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      </div>
    );
  }

  return (
    <>
      <MobileShell
        activeTab={activeTab}
        onChangeTab={handleChangeTab}
        unreadBadgeCount={unreadChatsCount}
        likesBadgeCount={unreadLikesCount}
        themeMood={activeMood}
      >
        <div className={activeTab === 'swipe' ? 'flex-1 h-full min-h-0 flex flex-col' : 'hidden'}>
          <DiscoverSwipe
            key={userProfile.uid}
            currentUser={userProfile}
            isActive={activeTab === 'swipe'}
            scope={swipeScope}
            onScopeChange={setSwipeScope}
            intention={swipeIntention}
            onIntentionChange={setSwipeIntention}
            genderPreference={swipeGenderPref ?? (userProfile?.interestedIn || 'Todos')}
            onGenderPreferenceChange={setSwipeGenderPref}
            ageRange={swipeAgeRange}
            onAgeRangeChange={setSwipeAgeRange}
            onMoodChange={setSwipeMoodKey}
            onSelectProfile={setSelectedProfile}
            onStartChat={handleStartDirectChat}
            onOpenChat={(chatSession) => {
              handleOpenChatSession(chatSession);
              setActiveTab('chat');
            }}
            onOpenBoost={() => setBoostOpen(true)}
            onOpenCoinStore={() => setCoinStoreOpen(true)}
            onSuccess={handleSuccess}
            onError={handleError}
          />
        </div>

        {activeTab === 'explore' && (
          <HomeFeed
            key={`explore-${userProfile.uid}`}
            currentUser={userProfile}
            onSelectProfile={setSelectedProfile}
            onStartChat={handleStartDirectChat}
            onSwipeCategory={(categoryIntention) => {
              setSwipeIntention(categoryIntention || 'Todos');
              setActiveTab('swipe');
            }}
            onSuccess={handleSuccess}
            onError={handleError}
          />
        )}

        {activeTab === 'likes' && (
          <LikesScreen
            key={`likes-${userProfile.uid}`}
            currentUser={userProfile}
            receivedLikes={receivedLikes}
            matches={matches}
            userUnlocks={userUnlocks}
            onSelectProfile={setSelectedProfile}
            onStartChat={handleStartDirectChat}
            onOpenCoinStore={() => setCoinStoreOpen(true)}
            onGoToSwipe={() => handleChangeTab('swipe')}
            onOpenBoost={() => setBoostOpen(true)}
            onSuccess={handleSuccess}
            onError={handleError}
          />
        )}

        {activeTab === 'chat' && (
          <ChatList
            key={`chatlist-${userProfile.uid}`}
            matches={matches}
            currentUser={userProfile}
            optimisticReadMap={optimisticReadMap}
            onSelectMatch={handleOpenChatSession}
            onStartChat={handleStartDirectChat}
            onSelectProfile={setSelectedProfile}
            onOpenSafetyCenter={(tab = 'blocked') => {
              setSafetyInitialTab(tab);
              setSafetyCenterOpen(true);
            }}
            onGoToSwipe={() => handleChangeTab('swipe')}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileScreen
            key={`profile-${userProfile.uid}`}
            userProfile={userProfile}
            currentAuthUid={firebaseUser.uid}
            receivedLikes={receivedLikes}
            receivedGifts={receivedGifts}
            unreadGiftsCount={unreadGiftsCount}
            onPreviewOwnProfile={() => setSelectedProfile(userProfile)}
            onOpenCoinStore={() => setCoinStoreOpen(true)}
            onOpenWithdrawals={() => setWithdrawalsOpen(true)}
            onOpenBoost={() => setBoostOpen(true)}
            onOpenSafetyCenter={(tab = 'blocked') => {
              setSafetyInitialTab(tab);
              setSafetyCenterOpen(true);
            }}
            onOpenGiftNotifications={handleOpenGiftNotifications}
            onOpenAdmin={() => navigate('/admin-dashboard')}
            onSuccess={handleSuccess}
            onError={handleError}
          />
        )}
      </MobileShell>

      <PublicProfileModal
        targetUser={selectedProfile}
        currentUser={userProfile}
        onClose={() => setSelectedProfile(null)}
        onStartChat={handleStartDirectChat}
        onOpenChat={(chatSession) => {
          setSelectedProfile(null);
          handleOpenChatSession(chatSession);
          setActiveTab('chat');
        }}
        onOpenCoinStore={() => setCoinStoreOpen(true)}
        onSuccess={handleSuccess}
        onError={handleError}
      />

      {activeChat && (
        <ChatRoom
          match={activeChat.match}
          peerUser={activeChat.peerUser}
          currentUser={userProfile}
          onBack={() => setActiveChat(null)}
          onMarkRead={handleMarkMatchReadOptimistic}
          onOpenProfile={(peer) => setSelectedProfile(peer)}
          onOpenCoinStore={() => setCoinStoreOpen(true)}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      )}

      <GiftGateChatModal
        isOpen={Boolean(giftGateTarget)}
        targetUser={giftGateTarget}
        userCoins={userProfile?.coins || 0}
        sendingGiftId={sendingGateGiftId}
        onClose={() => setGiftGateTarget(null)}
        onSelectGift={handleSendGiftToUnlockChat}
        onOpenCoinStore={() => setCoinStoreOpen(true)}
      />

      {likeChatGateTarget && (
        <div className="fixed inset-0 z-[72] bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-[#120911] text-white border border-amber-300/20 rounded-t-[32px] sm:rounded-[32px] p-5 space-y-4 shadow-[0_24px_80px_rgba(0,0,0,0.65)] animate-sheet-up">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-300 via-[#FF2E54] to-fuchsia-600 text-white flex items-center justify-center shadow-lg shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                    Desbloquear mensaje
                  </span>
                  <h3 className="font-display text-base font-black text-white leading-tight">
                    Enviar mensaje a {likeChatGateTarget.name}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLikeChatGateTarget(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 flex items-center justify-center shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Ya descubriste quién te dio Me Gusta. Elige ver 1 anuncio gratuito para escribirle sin costo o desbloquea el chat al instante con {AD_REWARD_CONFIG.unlockLikeChatCoins} monedas.
            </p>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  const target = likeChatGateTarget;
                  if (AD_REWARD_CONFIG.provider === 'monetag') {
                    triggerMonetagZoneTag();
                  }
                  setLikeChatGateTarget(null);
                  setLikeChatAdTarget(target);
                }}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 text-zinc-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/20 hover:brightness-105 active:scale-[0.99] transition flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Play className="w-4 h-4 fill-zinc-950" />
                  Ver 1 anuncio y enviar mensaje gratis
                </span>
                <span className="px-2 py-0.5 rounded-full bg-zinc-950/15 text-[10px] font-black uppercase">
                  Gratis
                </span>
              </button>

              <button
                type="button"
                disabled={busyLikeChatCoins}
                onClick={() => handleUnlockLikeChatWithCoins(likeChatGateTarget)}
                className="w-full py-3.5 px-4 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-extrabold text-xs sm:text-sm transition flex items-center justify-between disabled:opacity-60"
              >
                <span className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-400" />
                  {busyLikeChatCoins
                    ? 'Desbloqueando...'
                    : `Desbloquear chat con ${AD_REWARD_CONFIG.unlockLikeChatCoins} monedas`}
                </span>
                <span className="text-[11px] font-bold text-amber-300">
                  Tienes {userProfile?.coins || 0}
                </span>
              </button>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-[10px] text-zinc-400 font-semibold pt-1">
              <Tv className="w-3.5 h-3.5 text-amber-300" />
              Sin suscripciones obligatorias · Tú eliges anuncio gratis o monedas
            </div>
          </div>
        </div>
      )}

      <RewardedAdModal
        isOpen={Boolean(likeChatAdTarget)}
        purpose="unlock_chat"
        targetName={likeChatAdTarget?.name || 'esta persona'}
        coinCost={AD_REWARD_CONFIG.unlockLikeChatCoins}
        onClose={() => setLikeChatAdTarget(null)}
        onRewardEarned={handleLikeChatAdCompleted}
        onUseCoinsInstead={() => {
          if (likeChatAdTarget) {
            handleUnlockLikeChatWithCoins(likeChatAdTarget);
          }
        }}
      />

      <GiftAnimationOverlay
        giftEvent={gateGiftAnim}
        onComplete={() => setGateGiftAnim(null)}
      />

      <CoinStoreModal
        key={`coins-${userProfile.uid}`}
        isOpen={coinStoreOpen}
        onClose={() => setCoinStoreOpen(false)}
        userProfile={userProfile}
        onSuccess={handleSuccess}
        onError={handleError}
      />

      <EarningsWithdrawModal
        key={`withdraw-${userProfile.uid}`}
        isOpen={withdrawalsOpen}
        onClose={() => setWithdrawalsOpen(false)}
        userProfile={userProfile}
        onSuccess={handleSuccess}
        onError={handleError}
      />

      <GiftNotificationsModal
        key={`gifts-${userProfile.uid}`}
        isOpen={giftNotificationsOpen}
        onClose={() => setGiftNotificationsOpen(false)}
        userProfile={userProfile}
        receivedGifts={receivedGifts}
        onSelectProfile={(profile) => {
          setGiftNotificationsOpen(false);
          setSelectedProfile(profile);
        }}
        onStartChat={(profile) => {
          setGiftNotificationsOpen(false);
          handleStartDirectChat(profile);
        }}
        onOpenWithdrawals={() => {
          setGiftNotificationsOpen(false);
          setWithdrawalsOpen(true);
        }}
      />

      <BoostModal
        key={`boost-${userProfile.uid}`}
        isOpen={boostOpen}
        onClose={() => setBoostOpen(false)}
        userProfile={userProfile}
        onOpenCoinStore={() => setCoinStoreOpen(true)}
        onSuccess={handleSuccess}
        onError={handleError}
      />

      <AdminPanelModal
        key={`admin-${userProfile.uid}`}
        isOpen={adminOpen}
        onClose={() => setAdminOpen(false)}
        userProfile={userProfile}
        onSuccess={handleSuccess}
        onError={handleError}
      />

      <SafetyCenterModal
        key={`safety-${userProfile.uid}`}
        isOpen={safetyCenterOpen}
        onClose={() => setSafetyCenterOpen(false)}
        userProfile={userProfile}
        initialTab={safetyInitialTab}
        onSelectProfile={(profile) => {
          setSafetyCenterOpen(false);
          setSelectedProfile(profile);
        }}
        onSuccess={handleSuccess}
        onError={handleError}
      />
    </>
  );
}

/**
 * Enrutador principal protegido por roles (Firebase Auth + Firestore users/{uid}.role):
 * - Si role === 'SUPER_ADMIN' (o 'admin') al iniciar sesión -> redirige automáticamente a /admin-dashboard.
 * - /admin-dashboard -> accesible únicamente por SUPER_ADMIN; botón Navbar "Entrar a Conoscamosnos (Modo Usuario)" lleva a /app.
 * - /app -> vista normal de swipes, explorar, likes, chat y perfil.
 */
function AppRoutes() {
  const { firebaseUser, userProfile, loading, isSuperAdmin } = useAuth();
  const [toast, setToast] = useState(null);

  const showToast = useCallback((type, message) => {
    setToast({ type, message, id: Date.now() });
  }, []);

  const handleSuccess = useCallback((msg) => showToast('success', msg), [showToast]);
  const handleError = useCallback((msg) => showToast('error', msg), [showToast]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  if (loading || (firebaseUser && !userProfile)) {
    return <FullScreenLoader />;
  }

  const defaultAuthHome = isSuperAdmin ? '/admin-dashboard' : '/app';

  return (
    <>
      <NotificationBanner toast={toast} onDismiss={() => setToast(null)} />
      <Routes>
        <Route
          path="/login"
          element={firebaseUser ? <Navigate to={defaultAuthHome} replace /> : <AuthScreen />}
        />

        <Route
          path="/admin-dashboard"
          element={
            !firebaseUser ? (
              <Navigate to="/login" replace />
            ) : !isSuperAdmin ? (
              <Navigate to="/app" replace />
            ) : (
              <AdminDashboardPage onSuccess={handleSuccess} onError={handleError} />
            )
          }
        />

        <Route
          path="/app"
          element={
            !firebaseUser ? (
              <Navigate to="/login" replace />
            ) : (
              <UserAppView onSuccess={handleSuccess} onError={handleError} />
            )
          }
        />

        <Route
          path="/"
          element={<Navigate to={firebaseUser ? defaultAuthHome : '/login'} replace />}
        />
        <Route
          path="*"
          element={<Navigate to={firebaseUser ? defaultAuthHome : '/login'} replace />}
        />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
