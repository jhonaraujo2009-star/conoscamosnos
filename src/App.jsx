import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Flame } from 'lucide-react';
import { getIntentionMood, MIN_AGE } from './config/constants';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { subscribeUserUnlocks } from './services/adRewardService';
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
import BoostModal from './components/home/BoostModal';
import AdminPanelModal from './components/admin/AdminPanelModal';

function MainApp() {
  const { firebaseUser, userProfile, loading } = useAuth();

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

  const [coinStoreOpen, setCoinStoreOpen] = useState(false);
  const [withdrawalsOpen, setWithdrawalsOpen] = useState(false);
  const [giftNotificationsOpen, setGiftNotificationsOpen] = useState(false);
  const [boostOpen, setBoostOpen] = useState(false);
  const [safetyCenterOpen, setSafetyCenterOpen] = useState(false);
  const [safetyInitialTab, setSafetyInitialTab] = useState('blocked');
  const [adminOpen, setAdminOpen] = useState(false);

  const [toast, setToast] = useState(null);
  const seenGiftIdsRef = useRef(new Set());
  const giftsLoadedRef = useRef(false);

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
    async (targetUser) => {
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
    [userProfile, matches, handleOpenChatSession, handleError]
  );

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

  if (loading) {
    return (
      <div className="h-[100dvh] w-screen bg-black flex flex-col items-center justify-center gap-3 overflow-hidden">
        <div className="w-14 h-14 rounded-full bg-[#FF2E54] flex items-center justify-center animate-pulse">
          <Flame className="w-8 h-8 text-white fill-white" />
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return <AuthScreen />;
  }

  if (!userProfile) {
    return (
      <div className="h-[100dvh] w-screen bg-black flex items-center justify-center p-6 text-center overflow-hidden">
        <div className="w-10 h-10 rounded-full border-2 border-[#FF2E54] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!userProfile.onboardingCompleted) {
    return (
      <div className="h-[100dvh] w-screen overflow-y-auto bg-[#F4F4F6]">
        <NotificationBanner toast={toast} onDismiss={() => setToast(null)} />
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
      <NotificationBanner toast={toast} onDismiss={() => setToast(null)} />

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
            onOpenAdmin={() => setAdminOpen(true)}
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

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
