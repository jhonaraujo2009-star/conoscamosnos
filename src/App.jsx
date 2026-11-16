import { useCallback, useEffect, useMemo, useState } from 'react';
import { Heart, Sparkles } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { subscribeUserMatches } from './services/chatService';
import { openOrCreateDirectChat } from './services/discoveryService';
import { isMatchUnread } from './utils/formatters';
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

  // Aislar completamente el estado de navegación y modales cuando cambia el usuario autenticado
  useEffect(() => {
    setActiveChat(null);
    setSelectedProfile(null);
    setCoinStoreOpen(false);
    setWithdrawalsOpen(false);
    setBoostOpen(false);
    setAdminOpen(false);
    setActiveTab('home');
  }, [firebaseUser?.uid]);

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
      <div className="min-h-screen bg-luxury-mesh flex flex-col items-center justify-center gap-4 p-6">
        <div className="relative">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-brand-500 via-rose-500 to-amber-400 flex items-center justify-center shadow-luxury animate-pulse">
            <Heart className="w-8 h-8 text-white fill-white" />
          </div>
          <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-white shadow flex items-center justify-center text-amber-500">
            <Sparkles className="w-3.5 h-3.5" />
          </span>
        </div>
        <div className="text-center">
          <p className="text-base font-extrabold text-slate-900 tracking-tight">Conoscamosnos</p>
          <p className="text-xs font-medium text-slate-500 mt-0.5">Cargando tu espacio personal...</p>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return <AuthScreen />;
  }

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-luxury-mesh flex items-center justify-center p-6 text-center">
        <div className="bg-white/90 backdrop-blur-xl border border-rose-100 rounded-3xl p-6 shadow-soft max-w-xs w-full space-y-2">
          <div className="w-10 h-10 mx-auto rounded-2xl bg-brand-50 text-brand-500 flex items-center justify-center animate-spin">
            <Sparkles className="w-5 h-5" />
          </div>
          <p className="text-sm font-bold text-slate-800">Preparando tu perfil independiente...</p>
          <p className="text-xs text-slate-500">Sincronizando datos de forma segura</p>
        </div>
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
        unreadBadgeCount={unreadChatsCount}
      >
        {activeTab === 'home' && (
          <HomeFeed
            currentUser={userProfile}
            onSelectProfile={setSelectedProfile}
            onStartChat={handleStartDirectChat}
            onOpenBoost={() => setBoostOpen(true)}
            onSuccess={handleSuccess}
            onError={handleError}
          />
        )}

        {activeTab === 'discover' && (
          <DiscoverSwipe
            currentUser={userProfile}
            onSelectProfile={setSelectedProfile}
            onStartChat={handleStartDirectChat}
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
