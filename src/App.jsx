import { useCallback, useEffect, useMemo, useState } from 'react';
import { Flame } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { subscribeUserMatches } from './services/chatService';
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
import CoinStoreModal from './components/monetization/CoinStoreModal';
import EarningsWithdrawModal from './components/monetization/EarningsWithdrawModal';
import BoostModal from './components/home/BoostModal';
import AdminPanelModal from './components/admin/AdminPanelModal';

function MainApp() {
  const { firebaseUser, userProfile, loading } = useAuth();

  // 5 Pestañas: 'swipe' | 'explore' | 'likes' | 'chat' | 'profile'
  const [activeTab, setActiveTab] = useState('swipe');
  const [matches, setMatches] = useState([]);
  const [receivedLikes, setReceivedLikes] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [activeChat, setActiveChat] = useState(null);

  const [coinStoreOpen, setCoinStoreOpen] = useState(false);
  const [withdrawalsOpen, setWithdrawalsOpen] = useState(false);
  const [boostOpen, setBoostOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

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

  // Aislar completamente el estado cuando cambia el usuario autenticado
  useEffect(() => {
    setActiveChat(null);
    setSelectedProfile(null);
    setCoinStoreOpen(false);
    setWithdrawalsOpen(false);
    setBoostOpen(false);
    setAdminOpen(false);
    setActiveTab('swipe');
  }, [firebaseUser?.uid]);

  useEffect(() => {
    if (!userProfile?.uid || !userProfile?.onboardingCompleted) {
      setMatches([]);
      setReceivedLikes([]);
      return;
    }
    const unsubMatches = subscribeUserMatches(
      userProfile.uid,
      setMatches,
      (err) => console.error('Error suscribiendo matches:', err)
    );
    const unsubLikes = subscribeReceivedLikes(userProfile.uid, setReceivedLikes);
    return () => {
      unsubMatches();
      unsubLikes();
    };
  }, [userProfile?.uid, userProfile?.onboardingCompleted]);

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
      >
        {activeTab === 'swipe' && (
          <DiscoverSwipe
            currentUser={userProfile}
            onSelectProfile={setSelectedProfile}
            onStartChat={handleStartDirectChat}
            onOpenChat={(chatSession) => {
              setActiveChat(chatSession);
              setActiveTab('chat');
            }}
            onOpenBoost={() => setBoostOpen(true)}
            onSuccess={handleSuccess}
            onError={handleError}
          />
        )}

        {activeTab === 'explore' && (
          <HomeFeed
            currentUser={userProfile}
            onSelectProfile={setSelectedProfile}
            onStartChat={handleStartDirectChat}
            onSuccess={handleSuccess}
            onError={handleError}
          />
        )}

        {activeTab === 'likes' && (
          <LikesScreen
            currentUser={userProfile}
            receivedLikes={receivedLikes}
            onSelectProfile={setSelectedProfile}
            onStartChat={handleStartDirectChat}
            onOpenCoinStore={() => setCoinStoreOpen(true)}
          />
        )}

        {activeTab === 'chat' && (
          <ChatList
            matches={matches}
            currentUser={userProfile}
            onSelectMatch={setActiveChat}
            onStartChat={handleStartDirectChat}
            onSelectProfile={setSelectedProfile}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileScreen
            userProfile={userProfile}
            onPreviewOwnProfile={() => setSelectedProfile(userProfile)}
            onOpenCoinStore={() => setCoinStoreOpen(true)}
            onOpenWithdrawals={() => setWithdrawalsOpen(true)}
            onOpenBoost={() => setBoostOpen(true)}
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
        isOpen={coinStoreOpen}
        onClose={() => setCoinStoreOpen(false)}
        userProfile={userProfile}
        onSuccess={handleSuccess}
        onError={handleError}
      />

      <EarningsWithdrawModal
        isOpen={withdrawalsOpen}
        onClose={() => setWithdrawalsOpen(false)}
        userProfile={userProfile}
        onSuccess={handleSuccess}
        onError={handleError}
      />

      <BoostModal
        isOpen={boostOpen}
        onClose={() => setBoostOpen(false)}
        userProfile={userProfile}
        onOpenCoinStore={() => setCoinStoreOpen(true)}
        onSuccess={handleSuccess}
        onError={handleError}
      />

      <AdminPanelModal
        isOpen={adminOpen}
        onClose={() => setAdminOpen(false)}
        userProfile={userProfile}
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
