import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Flame } from 'lucide-react';
import { getIntentionMood, MIN_AGE } from './config/constants';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { subscribeReceivedGiftTransactions, subscribeUserMatches } from './services/chatService';
import { openOrCreateDirectChat, subscribeReceivedLikes } from './services/discoveryService';
import { isMatchUnread } from './utils/formatters';
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
import ProfileScreen from './components/profile/ProfileScreen';
import SafetyCenterModal from './components/profile/SafetyCenterModal';
import CoinStoreModal from './components/monetization/CoinStoreModal';
import EarningsWithdrawModal from './components/monetization/EarningsWithdrawModal';
import GiftNotificationsModal from './components/monetization/GiftNotificationsModal';
import BoostModal from './components/home/BoostModal';
import AdminPanelModal from './components/admin/AdminPanelModal';

function getGiftMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  const parsed = new Date(ts).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

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
  const [giftsSeenAt, setGiftsSeenAt] = useState(0);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [activeChat, setActiveChat] = useState(null);

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
    setReceivedGifts([]);
    seenGiftIdsRef.current = new Set();
    giftsLoadedRef.current = false;
    try {
      const savedSeen = firebaseUser?.uid
        ? Number(localStorage.getItem(`conoscamosnos_gifts_seen_${firebaseUser.uid}`) || 0)
        : 0;
      setGiftsSeenAt(Number.isNaN(savedSeen) ? 0 : savedSeen);
    } catch {
      setGiftsSeenAt(0);
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
      unsubGifts();
    };
  }, [userProfile?.uid, userProfile?.onboardingCompleted, handleSuccess]);

  const unreadGiftsCount = useMemo(() => {
    if (!userProfile?.uid) return 0;
    return receivedGifts.filter((g) => {
      if (g.receiverId !== userProfile.uid) return false;
      const ms = getGiftMillis(g.createdAt);
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

  const unreadChatsCount = useMemo(() => {
    if (!userProfile?.uid) return 0;
    const blockedSet = new Set(userProfile.blockedUsers || []);
    return matches.filter((m) => {
      const peerId = (m.participants || []).find((p) => p !== userProfile.uid);
      if (!peerId || blockedSet.has(peerId)) return false;
      return isMatchUnread(m, userProfile.uid);
    }).length;
  }, [matches, userProfile?.uid, userProfile?.blockedUsers]);

  const handleStartDirectChat = useCallback(
    async (targetUser) => {
      if (!userProfile?.uid || !targetUser) return;
      const targetUid = targetUser.uid || targetUser.id;
      if (!targetUid || targetUid === userProfile.uid) return;

      try {
        const res = await openOrCreateDirectChat({
          currentUser: userProfile,
          targetUser,
        });
        setSelectedProfile(null);
        setActiveChat({
          match: res.matchData,
          peerUser: targetUser,
        });
        setActiveTab('chat');
      } catch (err) {
        handleError(err.message || 'No se pudo abrir la conversación privada.');
      }
    },
    [userProfile, handleError]
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
        onChangeTab={setActiveTab}
        unreadBadgeCount={unreadChatsCount}
        likesBadgeCount={receivedLikes.length}
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
              setActiveChat(chatSession);
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
            onSelectProfile={setSelectedProfile}
            onStartChat={handleStartDirectChat}
            onOpenCoinStore={() => setCoinStoreOpen(true)}
            onGoToSwipe={() => setActiveTab('swipe')}
            onOpenBoost={() => setBoostOpen(true)}
          />
        )}

        {activeTab === 'chat' && (
          <ChatList
            key={`chatlist-${userProfile.uid}`}
            matches={matches}
            currentUser={userProfile}
            onSelectMatch={setActiveChat}
            onStartChat={handleStartDirectChat}
            onSelectProfile={setSelectedProfile}
            onOpenSafetyCenter={(tab = 'blocked') => {
              setSafetyInitialTab(tab);
              setSafetyCenterOpen(true);
            }}
            onGoToSwipe={() => setActiveTab('swipe')}
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
          setActiveChat(chatSession);
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
          onOpenProfile={(peer) => setSelectedProfile(peer)}
          onOpenCoinStore={() => setCoinStoreOpen(true)}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      )}

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
