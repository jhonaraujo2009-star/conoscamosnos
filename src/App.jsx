import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Flame, LogOut, ShieldAlert } from 'lucide-react';
import { getIntentionMood, MIN_AGE, resolveAccessPolicy } from './config/constants';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import {
  recordAdRewardUnlock,
  subscribeUserUnlocks,
  unlockChatWithDiamonds,
} from './services/adRewardService';
import { logoutUser } from './services/authService';
import {
  acceptPaidMessageRequest,
  deleteConversationForUser,
  rejectPaidMessageRequest,
  sendPaidDirectMessage,
  sendVirtualGift,
  subscribeReceivedGiftTransactions,
  subscribeUserMatches,
} from './services/chatService';
import {
  enablePushNotifications,
  showLocalServiceWorkerNotification,
} from './services/pushNotificationService';
import {
  checkConnectionStatus,
  openOrCreateDirectChat,
  subscribeReceivedLikes,
} from './services/discoveryService';
import { getUserById } from './services/userService';
import {
  isConversationHiddenForUser,
  isIncomingPendingPaidRequest,
  isRejectedPaidRequest,
} from './utils/chatHelpers';
import {
  buildMatchId,
  getSpendableDiamonds,
  isGiftChatUnlocked,
  isMatchUnread,
  isProActive,
  toMillis,
  triggerHaptic,
} from './utils/formatters';
import AuthScreen from './components/auth/AuthScreen';
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
import PaidMessageModal from './components/chat/PaidMessageModal';
import ProfileScreen from './components/profile/ProfileScreen';
import GiftNotificationsModal from './components/monetization/GiftNotificationsModal';
import RewardedAdModal from './components/monetization/RewardedAdModal';
import UnlockChoiceModal from './components/monetization/UnlockChoiceModal';
import DiamondStoreModal from './components/monetization/DiamondStoreModal';
import BoostModal from './components/home/BoostModal';

const AdminDashboardPage = lazy(() => import('./components/admin/AdminDashboardPage'));
const OnboardingWizard = lazy(() => import('./components/auth/OnboardingWizard'));
const EarningsWithdrawModal = lazy(() => import('./components/monetization/EarningsWithdrawModal'));
const SafetyCenterModal = lazy(() => import('./components/profile/SafetyCenterModal'));

function FullScreenLoader({ theme = 'dark' }) {
  const isCream = theme === 'cream';
  return (
    <div
      className={`h-[100dvh] w-screen flex flex-col items-center justify-center gap-3 overflow-hidden ${
        isCream ? 'bg-[#FAF4E8]' : 'bg-black'
      }`}
    >
      <div className="w-14 h-14 rounded-full bg-[#FF2E54] flex items-center justify-center animate-pulse shadow-md shadow-rose-300/30">
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
  const location = useLocation();
  const { firebaseUser, userProfile, economyConfig, isBanned } = useAuth();
  const accessPolicy = useMemo(() => resolveAccessPolicy(economyConfig), [economyConfig]);

  // 5 Pestañas: 'swipe' | 'explore' | 'likes' | 'chat' | 'profile'
  const [activeTab, setActiveTab] = useState('swipe');
  const [swipeScope, setSwipeScope] = useState('global');
  const [swipeIntention, setSwipeIntention] = useState('Todos');
  const [swipeGenderPref, setSwipeGenderPref] = useState(null);
  const [swipeAgeRange, setSwipeAgeRange] = useState({ min: MIN_AGE, max: 99 });
  const [swipeMoodKey, setSwipeMoodKey] = useState('Todos');
  const [matches, setMatches] = useState([]);
  const [receivedLikes, setReceivedLikes] = useState([]);
  const [receivedGifts, setReceivedGifts] = useState([]);
  const [userUnlocks, setUserUnlocks] = useState({
    revealedLikeIds: [],
    chatUnlockedUserIds: [],
    unlockedPhotoKeys: [],
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
  const [paidMessageTarget, setPaidMessageTarget] = useState(null);
  const [sendingPaidMessage, setSendingPaidMessage] = useState(false);
  const [likeChatGateTarget, setLikeChatGateTarget] = useState(null);
  const [likeChatAdTarget, setLikeChatAdTarget] = useState(null);
  const [likeChatAdSession, setLikeChatAdSession] = useState(null);
  const [busyLikeChatDiamonds, setBusyLikeChatDiamonds] = useState(false);

  const [diamondStoreOpen, setDiamondStoreOpen] = useState(false);
  const [diamondStoreSection, setDiamondStoreSection] = useState('buy');
  const [withdrawalsOpen, setWithdrawalsOpen] = useState(false);
  const [giftNotificationsOpen, setGiftNotificationsOpen] = useState(false);
  const [boostOpen, setBoostOpen] = useState(false);
  const [safetyCenterOpen, setSafetyCenterOpen] = useState(false);
  const [safetyInitialTab, setSafetyInitialTab] = useState('blocked');

  const seenGiftIdsRef = useRef(new Set());
  const giftsLoadedRef = useRef(false);
  const seenLikeIdsRef = useRef(new Set());
  const likesLoadedRef = useRef(false);
  const blockedUsersRef = useRef([]);
  blockedUsersRef.current = userProfile?.blockedUsers || [];
  const tabHistoryRef = useRef([]);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const lastBackExitPromptRef = useRef(0);
  const bypassPopRef = useRef(false);
  const closeTopOverlayRef = useRef(() => false);

  const handleSuccess = onSuccess;
  const handleError = onError;

  // Mostrar notificación clara cuando NowPayments devuelve al usuario tras completar/cancelar una factura
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const paymentStatus = params.get('payment');
    if (!paymentStatus) return;

    if (paymentStatus === 'success') {
      handleSuccess('⚡ ¡Pago enviado! En cuanto NowPayments confirme en blockchain verás tus Diamantes (💎) o membresía PRO acreditados al instante.');
    } else if (paymentStatus === 'cancel') {
      handleError('Pago cancelado. Puedes intentarlo cuando gustes desde la Tienda VIP.');
    }
    navigate('/app', { replace: true });
  }, [location.search, navigate, handleSuccess, handleError]);

  const activeMood = useMemo(() => getIntentionMood(swipeMoodKey), [swipeMoodKey]);

  // Actualizar dinámicamente la barra de estado del dispositivo según el tema romántico activo
  useEffect(() => {
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) return;
    metaTheme.setAttribute(
      'content',
      activeTab === 'swipe' && firebaseUser ? activeMood.themeColor : '#FAF7F9'
    );
  }, [activeTab, firebaseUser, activeMood.themeColor]);

  // Aislar completamente el estado cuando cambia el usuario autenticado
  useEffect(() => {
    setActiveChat(null);
    setSelectedProfile(null);
    setDiamondStoreOpen(false);
    setWithdrawalsOpen(false);
    setGiftNotificationsOpen(false);
    setBoostOpen(false);
    setSafetyCenterOpen(false);
    setSafetyInitialTab('blocked');
    setGiftGateTarget(null);
    setSendingGateGiftId(null);
    setGateGiftAnim(null);
    setPaidMessageTarget(null);
    setSendingPaidMessage(false);
    setLikeChatGateTarget(null);
    setLikeChatAdTarget(null);
    setLikeChatAdSession(null);
    setBusyLikeChatDiamonds(false);
    setReceivedGifts([]);
    setOptimisticReadMap({});
    setUserUnlocks({
      revealedLikeIds: [],
      chatUnlockedUserIds: [],
      unlockedPhotoKeys: [],
      totalAdsWatched: 0,
    });
    seenGiftIdsRef.current = new Set();
    giftsLoadedRef.current = false;
    seenLikeIdsRef.current = new Set();
    likesLoadedRef.current = false;
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
    setSwipeAgeRange({ min: MIN_AGE, max: 99 });
    setSwipeMoodKey('Todos');
    tabHistoryRef.current = [];
    lastBackExitPromptRef.current = 0;
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
      seenLikeIdsRef.current = new Set();
      likesLoadedRef.current = false;
      return;
    }
    const currentUid = userProfile.uid;
    const unsubMatches = subscribeUserMatches(
      currentUid,
      setMatches,
      (err) => console.error('Error suscribiendo matches:', err)
    );
    const unsubLikes = subscribeReceivedLikes(currentUid, (list) => {
      const blockedSet = new Set(blockedUsersRef.current || []);
      const strictList = (Array.isArray(list) ? list : []).filter(
        (like) =>
          like?.toUserId === currentUid &&
          typeof like.fromUserId === 'string' &&
          like.fromUserId.length > 0 &&
          like.fromUserId !== currentUid
      );

      if (!likesLoadedRef.current) {
        seenLikeIdsRef.current = new Set(strictList.map((l) => `${l.id}_${l.isSuperLike ? '1' : '0'}`));
        likesLoadedRef.current = true;
      } else {
        const freshSuper = strictList.find(
          (l) =>
            l.toUserId === currentUid &&
            l.isSuperLike === true &&
            !blockedSet.has(l.fromUserId) &&
            !seenLikeIdsRef.current.has(`${l.id}_1`)
        );
        strictList.forEach((l) =>
          seenLikeIdsRef.current.add(`${l.id}_${l.isSuperLike ? '1' : '0'}`)
        );
        if (freshSuper) {
          getUserById(freshSuper.fromUserId)
            .catch(() => null)
            .then((sender) => {
              const senderName = sender?.name || 'Alguien';
              const superTitle = `⭐ ¡${senderName} te envió un Super Like!`;
              triggerHaptic([16, 40, 22]);
              handleSuccess(`${superTitle} Míralo gratis en Likes.`);
              showLocalServiceWorkerNotification({
                title: superTitle,
                body: 'Entra gratis en Likes para descubrir quién te envió este Super Like.',
                tag: `superlike_${freshSuper.id}`,
              });
            });
        }
      }

      setReceivedLikes(strictList);
    });
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
            const giftTitle = `${freshGift.giftIcon || '🎁'} ¡${freshGift.senderName || 'Alguien'} te envió ${
              freshGift.giftName || 'un regalo'
            }!`;
            const giftBody = `Sumaste +${freshGift.diamondsCredited || 0} 💎 retirables en tu bóveda.`;
            handleSuccess(`${giftTitle} (+${freshGift.diamondsCredited || 0} 💎)`);
            showLocalServiceWorkerNotification({
              title: giftTitle,
              body: giftBody,
              tag: `gift_${freshGift.id}`,
            });
          }
        }
        setReceivedGifts(list);
      },
      (err) => console.error('Error suscribiendo regalos recibidos:', err)
    );

    if (
      userProfile.pushNotificationsEnabled &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      enablePushNotifications(userProfile.uid).catch(() => {});
    }

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
      if (!nextTab) return;
      setActiveTab((prev) => {
        if (prev !== nextTab) {
          const stack = tabHistoryRef.current;
          if (stack[stack.length - 1] !== prev) {
            stack.push(prev);
            if (stack.length > 15) stack.shift();
          }
        }
        return nextTab;
      });
      // Al abrir la pestaña Likes, desaparece inmediatamente la burbuja de Likes.
      // La burbuja de Chat NO desaparece al abrir la pestaña: solo descuenta al abrir cada conversación.
      if (nextTab === 'likes') {
        markLikesAsSeen();
      }
    },
    [markLikesAsSeen]
  );

  // Orden jerárquico de cierre de modales/chat al presionar el botón Atrás del dispositivo
  closeTopOverlayRef.current = () => {
    if (likeChatAdTarget) {
      setLikeChatAdTarget(null);
      setLikeChatAdSession(null);
      return true;
    }
    if (likeChatGateTarget) {
      setLikeChatGateTarget(null);
      return true;
    }
    if (paidMessageTarget) {
      setPaidMessageTarget(null);
      return true;
    }
    if (giftGateTarget) {
      setGiftGateTarget(null);
      setGateGiftAnim(null);
      return true;
    }
    if (diamondStoreOpen) {
      setDiamondStoreOpen(false);
      return true;
    }
    if (withdrawalsOpen) {
      setWithdrawalsOpen(false);
      return true;
    }
    if (giftNotificationsOpen) {
      setGiftNotificationsOpen(false);
      return true;
    }
    if (boostOpen) {
      setBoostOpen(false);
      return true;
    }
    if (safetyCenterOpen) {
      setSafetyCenterOpen(false);
      return true;
    }
    if (selectedProfile) {
      setSelectedProfile(null);
      return true;
    }
    if (activeChat) {
      setActiveChat(null);
      return true;
    }
    return false;
  };

  // Memoria de navegación y prevención de cierre accidental con botón Atrás (Android TWA / Web)
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const ensureSentinel = () => {
      try {
        const st = window.history.state || {};
        if (!st.__conoscamosnosGuard) {
          window.history.pushState(
            { ...st, __conoscamosnosGuard: true },
            '',
            window.location.href
          );
        }
      } catch {
        // noop
      }
    };

    ensureSentinel();

    const handlePopState = () => {
      if (bypassPopRef.current) return;

      // 1) Cerrar primero cualquier modal, perfil abierto o sala de chat activa
      if (closeTopOverlayRef.current()) {
        lastBackExitPromptRef.current = 0;
        ensureSentinel();
        return;
      }

      // 2) Volver a la pestaña visitada anteriormente
      if (tabHistoryRef.current.length > 0) {
        const prevTab = tabHistoryRef.current.pop();
        if (prevTab && prevTab !== activeTabRef.current) {
          setActiveTab(prevTab);
          if (prevTab === 'likes') {
            markLikesAsSeen();
          }
          lastBackExitPromptRef.current = 0;
          ensureSentinel();
          return;
        }
      }

      // 3) Si no estamos en Descubrir ('swipe'), volver primero a Descubrir
      if (activeTabRef.current !== 'swipe') {
        setActiveTab('swipe');
        lastBackExitPromptRef.current = 0;
        ensureSentinel();
        return;
      }

      // 4) En la pantalla principal ('swipe'), pedir doble confirmación en 2.5s antes de salir
      const now = Date.now();
      if (now - lastBackExitPromptRef.current > 2500) {
        lastBackExitPromptRef.current = now;
        handleSuccess?.('Presiona Atrás otra vez para salir de Conoscamosnos.');
        ensureSentinel();
        return;
      }

      bypassPopRef.current = true;
      window.setTimeout(() => {
        bypassPopRef.current = false;
      }, 600);
      window.history.back();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [markLikesAsSeen, handleSuccess]);

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
      if (like?.toUserId !== userProfile.uid || !like?.fromUserId || blockedSet.has(like.fromUserId)) {
        return false;
      }
      const ms = Math.max(toMillis(like.superLikedAt), toMillis(like.createdAt));
      if (!likesSeenAt) return true;
      return ms === 0 || ms > likesSeenAt;
    }).length;
  }, [receivedLikes, userProfile?.uid, userProfile?.blockedUsers, likesSeenAt, activeTab]);

  const unreadSuperLikesCount = useMemo(() => {
    if (!userProfile?.uid || activeTab === 'likes') return 0;
    const blockedSet = new Set(userProfile.blockedUsers || []);
    return receivedLikes.filter((like) => {
      if (
        like?.toUserId !== userProfile.uid ||
        like?.isSuperLike !== true ||
        !like?.fromUserId ||
        blockedSet.has(like.fromUserId)
      ) {
        return false;
      }
      const ms = Math.max(toMillis(like.superLikedAt), toMillis(like.createdAt));
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
      if (isRejectedPaidRequest(m)) return false;
      if (isConversationHiddenForUser(m, userProfile.uid)) return false;
      if (isIncomingPendingPaidRequest(m, userProfile.uid)) return true;
      return isMatchUnread(m, userProfile.uid, optimisticReadMap[m.id]);
    }).length;
  }, [matches, userProfile?.uid, userProfile?.blockedUsers, optimisticReadMap]);

  const selectedProfileIncomingLike = useMemo(() => {
    const targetUid = selectedProfile?.uid || selectedProfile?.id;
    if (!targetUid || !userProfile?.uid || targetUid === userProfile.uid) return null;
    return (
      receivedLikes.find(
        (like) => like?.fromUserId === targetUid && like?.toUserId === userProfile.uid
      ) || null
    );
  }, [selectedProfile, receivedLikes, userProfile?.uid]);

  const openDiamondStore = useCallback((section = 'buy') => {
    setDiamondStoreSection(
      section === 'pro' ? 'pro' : section === 'history' ? 'history' : 'buy'
    );
    setDiamondStoreOpen(true);
  }, []);

  const handleStartDirectChat = useCallback(
    async (targetUser, options = {}) => {
      if (!userProfile?.uid || !targetUser) return;
      const targetUid = targetUser.uid || targetUser.id;
      if (!targetUid || targetUid === userProfile.uid) return;
      const userIsPro = isProActive(userProfile);

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
        if (!existingMatch) {
          const conn = await checkConnectionStatus(userProfile.uid, targetUid).catch(() => null);
          existingMatch = conn?.matchData || null;
        }

        // Si existe una Solicitud VIP entrante de esta persona, aceptarla y abrir el chat
        if (existingMatch && isIncomingPendingPaidRequest(existingMatch, userProfile.uid)) {
          await acceptPaidMessageRequest(existingMatch.id, userProfile.uid);
          setSelectedProfile(null);
          handleOpenChatSession({
            match: { ...existingMatch, isPaidRequest: false, paidRequestStatus: 'accepted' },
            peerUser: freshTarget,
          });
          handleChangeTab('chat');
          return;
        }

        const hasActiveMatch = Boolean(
          existingMatch && !isRejectedPaidRequest(existingMatch)
        );

        const alreadyUnlockedChat = Boolean(
          userIsPro ||
            accessPolicy.isFreeMode ||
            (userUnlocks?.chatUnlockedUserIds || []).includes(targetUid)
        );

        // Si NO hay match todavía, aplicar Monetización VIP -> Regalo -> Anuncio/Diamantes o Match obligatorio
        if (!hasActiveMatch && !options.skipLikeChatGate) {
          if (freshTarget.allowPaidMessages === true) {
            setSelectedProfile(null);
            setPaidMessageTarget(freshTarget);
            return;
          }
          if (!userIsPro && freshTarget.requireGiftToChat) {
            setSelectedProfile(null);
            setGiftGateTarget(freshTarget);
            return;
          }
          if (!alreadyUnlockedChat) {
            if (accessPolicy.enableRewardedAds || accessPolicy.enableDiamondCharges) {
              setSelectedProfile(null);
              setLikeChatGateTarget(freshTarget);
              return;
            }
            handleError(
              `Debes hacer Match con ${freshTarget.name || 'esta persona'} primero para poder enviarle un mensaje.`
            );
            return;
          }
        }

        // Si el perfil exige regalo para iniciar chats nuevos y el usuario no es miembro PRO
        if (!userIsPro && !isGiftChatUnlocked(existingMatch, userProfile.uid, freshTarget)) {
          setSelectedProfile(null);
          setGiftGateTarget(freshTarget);
          return;
        }

        // Regla global dinámica desde Panel Super Admin (Libre / PRO / Solo Ads / Solo Diamantes / Híbrido)
        const isChatUnlocked =
          alreadyUnlockedChat ||
          Boolean(options.skipLikeChatGate) ||
          hasActiveMatch;

        if (!isChatUnlocked) {
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
        handleChangeTab('chat');
      } catch (err) {
        handleError(err.message || 'No se pudo abrir la conversación privada.');
      }
    },
    [userProfile, matches, userUnlocks, accessPolicy, handleOpenChatSession, handleChangeTab, handleError]
  );

  const handleSendPaidDirectMessage = useCallback(
    async (text) => {
      if (!userProfile?.uid || !paidMessageTarget || sendingPaidMessage) return;
      const target = paidMessageTarget;
      const targetUid = target.uid || target.id;
      setSendingPaidMessage(true);
      try {
        const res = await sendPaidDirectMessage({ receiverId: targetUid, text });
        setPaidMessageTarget(null);
        setGateGiftAnim({
          giftIcon: '💎',
          giftName: 'Mensaje Prioritario VIP',
          giftValue: res.price,
          diamondsCredited: res.diamondsCredited ?? res.price,
          isReceiver: false,
        });
        handleSuccess(
          `💎 ¡Mensaje prioritario enviado a ${target.name} por ${res.price} 💎! Llegó a su bandeja VIP.`
        );
      } catch (err) {
        handleError(err.message || 'No se pudo enviar el mensaje prioritario.');
      } finally {
        setSendingPaidMessage(false);
      }
    },
    [userProfile?.uid, paidMessageTarget, sendingPaidMessage, handleSuccess, handleError]
  );

  const handleAcceptPaidRequest = useCallback(
    async (match, peerUser) => {
      if (!userProfile?.uid || !match?.id) return;
      try {
        await acceptPaidMessageRequest(match.id, userProfile.uid);
        handleSuccess(`💬 Solicitud VIP de ${peerUser?.name || 'usuario'} aceptada.`);
        handleOpenChatSession({
          match: { ...match, isPaidRequest: false, paidRequestStatus: 'accepted' },
          peerUser,
        });
      } catch (err) {
        handleError(err.message || 'No se pudo aceptar la solicitud.');
      }
    },
    [userProfile?.uid, handleSuccess, handleError, handleOpenChatSession]
  );

  const handleRejectPaidRequest = useCallback(
    async (match, peerUser) => {
      if (!userProfile?.uid || !match?.id) return;
      try {
        await rejectPaidMessageRequest(match.id, userProfile.uid);
        handleSuccess(`Solicitud de ${peerUser?.name || 'usuario'} eliminada.`);
      } catch (err) {
        handleError(err.message || 'No se pudo rechazar la solicitud.');
      }
    },
    [userProfile?.uid, handleSuccess, handleError]
  );

  const handleDeleteConversation = useCallback(
    async (match, peerUser) => {
      if (!userProfile?.uid || !match?.id) return;
      try {
        await deleteConversationForUser(match.id, userProfile.uid);
        if (activeChat?.match?.id === match.id) {
          setActiveChat(null);
        }
        handleSuccess(`Conversación con ${peerUser?.name || 'usuario'} eliminada.`);
      } catch (err) {
        handleError(err.message || 'No se pudo eliminar la conversación.');
      }
    },
    [userProfile?.uid, activeChat?.match?.id, handleSuccess, handleError]
  );

  const handleUnlockLikeChatWithDiamonds = useCallback(
    async (target) => {
      if (!userProfile?.uid || !target || busyLikeChatDiamonds) return;
      if (!accessPolicy.enableDiamondCharges || isProActive(userProfile)) {
        await handleStartDirectChat(target, { skipLikeChatGate: true });
        return;
      }
      const targetUid = target.uid || target.id;
      const cost = accessPolicy.unlockChatDiamonds;
      if (getSpendableDiamonds(userProfile) < cost) {
        setLikeChatGateTarget(null);
        setLikeChatAdTarget(null);
        setLikeChatAdSession(null);
        handleError(
          accessPolicy.enableRewardedAds
            ? `Necesitas ${cost} 💎. Recarga Diamantes o mira 1 anuncio gratis.`
            : `Necesitas ${cost} 💎. Recarga Diamantes en la tienda para continuar.`
        );
        openDiamondStore('buy');
        return;
      }

      setBusyLikeChatDiamonds(true);
      try {
        await unlockChatWithDiamonds({
          uid: userProfile.uid,
          targetUid,
          costDiamonds: cost,
        });
        setLikeChatGateTarget(null);
        setLikeChatAdTarget(null);
        setLikeChatAdSession(null);
        handleSuccess(`✨ Chat desbloqueado con ${target.name || 'esta persona'} al instante.`);
        await handleStartDirectChat(target, { skipLikeChatGate: true });
      } catch (err) {
        handleError(err.message || 'No se pudo desbloquear el chat.');
      } finally {
        setBusyLikeChatDiamonds(false);
      }
    },
    [
      userProfile,
      busyLikeChatDiamonds,
      accessPolicy.enableDiamondCharges,
      accessPolicy.enableRewardedAds,
      accessPolicy.unlockChatDiamonds,
      openDiamondStore,
      handleError,
      handleSuccess,
      handleStartDirectChat,
    ]
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
        estimatedRevenueUSD: accessPolicy.estimatedRevenuePerAdUSD,
      });
      setLikeChatAdTarget(null);
      setLikeChatAdSession(null);
      handleSuccess(`🎉 ¡Anuncio completado! Chat abierto gratis con ${target.name || 'esta persona'}.`);
      await handleStartDirectChat(target, { skipLikeChatGate: true });
    } catch (err) {
      handleError(err.message || 'No se pudo registrar el desbloqueo del chat.');
    }
  }, [
    userProfile?.uid,
    likeChatAdTarget,
    accessPolicy.estimatedRevenuePerAdUSD,
    handleSuccess,
    handleStartDirectChat,
    handleError,
  ]);

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
          economyConfig,
        });
        setGiftGateTarget(null);
        setGateGiftAnim({
          giftIcon: gift.icon,
          giftName: gift.name,
          giftValue: gift.price,
          diamondsCredited: res.diamondsCredited ?? gift.price,
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
        handleChangeTab('chat');
      } catch (err) {
        handleError(err.message || 'No se pudo enviar el regalo.');
      } finally {
        setSendingGateGiftId(null);
      }
    },
    [
      userProfile,
      economyConfig,
      giftGateTarget,
      sendingGateGiftId,
      handleSuccess,
      handleOpenChatSession,
      handleError,
    ]
  );

  if (isBanned) {
    return <SuspendedAccountScreen userProfile={userProfile} />;
  }

  if (!userProfile?.onboardingCompleted) {
    return (
      <div className="h-[100dvh] w-screen overflow-y-auto bg-[#FAF7F9]">
        <Suspense fallback={<FullScreenLoader />}>
          <OnboardingWizard
            userProfile={userProfile}
            onSuccess={handleSuccess}
            onError={handleError}
          />
        </Suspense>
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
        superLikesBadgeCount={unreadSuperLikesCount}
        themeMood={activeMood}
      >
        <div className={activeTab === 'swipe' ? 'flex-1 h-full min-h-0 flex flex-col' : 'hidden'}>
          <DiscoverSwipe
            key={userProfile.uid}
            currentUser={userProfile}
            userUnlocks={userUnlocks}
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
              handleChangeTab('chat');
            }}
            onOpenBoost={() => setBoostOpen(true)}
            onOpenDiamondStore={() => openDiamondStore('buy')}
            onOpenPro={() => openDiamondStore('pro')}
            onSuccess={handleSuccess}
            onError={handleError}
          />
        </div>

        {activeTab === 'explore' && (
          <HomeFeed
            key={`explore-${userProfile.uid}`}
            currentUser={userProfile}
            matches={matches}
            onSelectProfile={setSelectedProfile}
            onStartChat={handleStartDirectChat}
            onOpenChat={(chatSession) => {
              handleOpenChatSession(chatSession);
              handleChangeTab('chat');
            }}
            onOpenPro={() => openDiamondStore('pro')}
            onSwipeCategory={(categoryIntention) => {
              setSwipeIntention(categoryIntention || 'Todos');
              handleChangeTab('swipe');
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
            onOpenChat={(chatSession) => {
              handleOpenChatSession(chatSession);
              handleChangeTab('chat');
            }}
            onOpenDiamondStore={() => openDiamondStore('buy')}
            onOpenPro={() => openDiamondStore('pro')}
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
            onSelectProfile={setSelectedProfile}
            onOpenSafetyCenter={(tab = 'blocked') => {
              setSafetyInitialTab(tab);
              setSafetyCenterOpen(true);
            }}
            onGoToSwipe={() => handleChangeTab('swipe')}
            onAcceptPaidRequest={handleAcceptPaidRequest}
            onRejectPaidRequest={handleRejectPaidRequest}
            onDeleteConversation={handleDeleteConversation}
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
            onOpenDiamondStore={(sec) => openDiamondStore(sec)}
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
        userUnlocks={userUnlocks}
        incomingLike={selectedProfileIncomingLike}
        onClose={() => setSelectedProfile(null)}
        onStartChat={handleStartDirectChat}
        onOpenDiamondStore={(sec) => openDiamondStore(sec)}
        onOpenPro={() => openDiamondStore('pro')}
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
          onOpenDiamondStore={() => openDiamondStore('buy')}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      )}

      <GiftGateChatModal
        isOpen={Boolean(giftGateTarget)}
        targetUser={giftGateTarget}
        userDiamonds={getSpendableDiamonds(userProfile)}
        sendingGiftId={sendingGateGiftId}
        onClose={() => setGiftGateTarget(null)}
        onSelectGift={handleSendGiftToUnlockChat}
        onOpenDiamondStore={() => openDiamondStore('buy')}
      />

      <PaidMessageModal
        isOpen={Boolean(paidMessageTarget)}
        targetUser={paidMessageTarget}
        userDiamonds={getSpendableDiamonds(userProfile)}
        sending={sendingPaidMessage}
        onClose={() => setPaidMessageTarget(null)}
        onSend={handleSendPaidDirectMessage}
        onOpenDiamondStore={() => openDiamondStore('buy')}
      />

      <UnlockChoiceModal
        isOpen={Boolean(likeChatGateTarget)}
        mode="unlock_chat"
        targetUser={likeChatGateTarget}
        alreadyLikedMe={
          likeChatGateTarget
            ? receivedLikes.some(
                (l) => l.fromUserId === (likeChatGateTarget.uid || likeChatGateTarget.id)
              )
            : false
        }
        userDiamonds={getSpendableDiamonds(userProfile)}
        diamondCost={accessPolicy.unlockChatDiamonds}
        busyDiamonds={busyLikeChatDiamonds}
        onClose={() => setLikeChatGateTarget(null)}
        onWatchAd={(adSession) => {
          const target = likeChatGateTarget;
          setLikeChatGateTarget(null);
          setLikeChatAdSession(adSession || null);
          setLikeChatAdTarget(target);
        }}
        onUnlockWithDiamonds={() => handleUnlockLikeChatWithDiamonds(likeChatGateTarget)}
        onOpenPro={() => openDiamondStore('pro')}
      />

      <RewardedAdModal
        isOpen={Boolean(likeChatAdTarget)}
        purpose="unlock_chat"
        targetName={likeChatAdTarget?.name || 'esta persona'}
        targetUser={likeChatAdTarget}
        adSession={likeChatAdSession}
        diamondCost={accessPolicy.unlockChatDiamonds}
        onClose={() => {
          setLikeChatAdTarget(null);
          setLikeChatAdSession(null);
        }}
        onRewardEarned={handleLikeChatAdCompleted}
        onUseDiamondsInstead={() => {
          if (likeChatAdTarget) {
            handleUnlockLikeChatWithDiamonds(likeChatAdTarget);
          }
        }}
      />

      <GiftAnimationOverlay
        giftEvent={gateGiftAnim}
        onComplete={() => setGateGiftAnim(null)}
      />

      {diamondStoreOpen && (
        <DiamondStoreModal
          key={`diamonds-${userProfile.uid}`}
          isOpen={diamondStoreOpen}
          initialSection={diamondStoreSection}
          onClose={() => setDiamondStoreOpen(false)}
          userProfile={userProfile}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      )}

      {withdrawalsOpen && (
        <Suspense fallback={null}>
          <EarningsWithdrawModal
            key={`withdraw-${userProfile.uid}`}
            isOpen={withdrawalsOpen}
            onClose={() => setWithdrawalsOpen(false)}
            userProfile={userProfile}
            onSuccess={handleSuccess}
            onError={handleError}
          />
        </Suspense>
      )}

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
        onOpenDiamondStore={() => openDiamondStore('buy')}
        onSuccess={handleSuccess}
        onError={handleError}
      />

      {safetyCenterOpen && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}
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
              <Suspense fallback={<FullScreenLoader theme="cream" />}>
                <AdminDashboardPage onSuccess={handleSuccess} onError={handleError} />
              </Suspense>
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

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || 'Error inesperado de interfaz.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-[100dvh] w-screen bg-[#FAF8FA] text-zinc-900 flex items-center justify-center p-6">
          <div className="w-full max-w-sm rounded-[32px] bg-white border border-zinc-200/80 p-7 text-center space-y-4 shadow-xl">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 border border-rose-200 text-[#FF2E54] flex items-center justify-center">
              <Flame className="w-7 h-7" />
            </div>
            <div>
              <h2 className="font-display text-lg font-black text-zinc-900">
                Reintentando vista
              </h2>
              <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
                Ocurrió un inconveniente temporal mostrando esta sección. Toca abajo para recuperarla al instante.
              </p>
            </div>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, errorMessage: '' })}
              className="w-full py-3 rounded-full bg-zinc-900 text-white text-xs font-extrabold hover:bg-zinc-800 transition"
            >
              Volver a la aplicación
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </AppErrorBoundary>
  );
}
