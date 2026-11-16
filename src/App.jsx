import { useCallback, useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { subscribeUserMatches } from './services/chatService';
import AuthScreen from './components/auth/AuthScreen';
import OnboardingWizard from './components/auth/OnboardingWizard';
import MobileShell from './components/layout/MobileShell';
import NotificationBanner from './components/layout/NotificationBanner';
import HomeFeed from './components/home/HomeFeed';
import DiscoverSwipe from './components/discover/DiscoverSwipe';
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

  const [activeTab, setActiveTab] = useState('home');
  const [matches, setMatches] = useState([]);
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
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!userProfile?.uid || !userProfile?.onboardingCompleted) {
      setMatches([]);
      return;
    }
    const unsub = subscribeUserMatches(
      userProfile.uid,
      setMatches,
      (err) => console.error('Error suscribiendo matches:', err)
    );
    return () => unsub();
  }, [userProfile?.uid, userProfile?.onboardingCompleted]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-amber-400 flex items-center justify-center animate-pulse shadow-xl">
          <Heart className="w-7 h-7 text-white fill-white" />
        </div>
        <p className="text-xs font-semibold text-slate-400">Conectando con Conoscamosnos...</p>
      </div>
    );
  }

  if (!firebaseUser) {
    return <AuthScreen />;
  }

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
        <p className="text-sm text-slate-300">Preparando tu perfil en Firestore...</p>
      </div>
    );
  }

  if (!userProfile.onboardingCompleted) {
    return (
      <>
        <NotificationBanner toast={toast} onDismiss={() => setToast(null)} />
        <OnboardingWizard
          userProfile={userProfile}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      </>
    );
  }

  return (
    <>
      <NotificationBanner toast={toast} onDismiss={() => setToast(null)} />

      <MobileShell
        userProfile={userProfile}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onOpenCoinStore={() => setCoinStoreOpen(true)}
        onOpenWithdrawals={() => setWithdrawalsOpen(true)}
        onOpenBoost={() => setBoostOpen(true)}
        onOpenAdmin={() => setAdminOpen(true)}
        unreadBadgeCount={matches.length}
      >
        {activeTab === 'home' && (
          <HomeFeed
            currentUser={userProfile}
            onSelectProfile={setSelectedProfile}
            onOpenBoost={() => setBoostOpen(true)}
          />
        )}

        {activeTab === 'discover' && (
          <DiscoverSwipe
            currentUser={userProfile}
            onSelectProfile={setSelectedProfile}
            onOpenChat={(chatSession) => {
              setActiveChat(chatSession);
              setActiveTab('chat');
            }}
            onOpenCoinStore={() => setCoinStoreOpen(true)}
            onSuccess={handleSuccess}
            onError={handleError}
          />
        )}

        {activeTab === 'chat' && (
          <ChatList
            matches={matches}
            currentUser={userProfile}
            onSelectMatch={setActiveChat}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileScreen
            userProfile={userProfile}
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
        onOpenChat={(chatSession) => {
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
