import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgeCheck,
  Ban,
  Briefcase,
  Check,
  ChevronLeft,
  ChevronRight,
  Crown,
  Flag,
  Flame,
  Gem,
  Gift,
  GraduationCap,
  Heart,
  Lock,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Quote,
  Ruler,
  ShieldAlert,
  Sparkles,
  Star,
  Unlock,
  X,
  Zap,
} from 'lucide-react';
import {
  EXCLUSIVE_PHOTO_DEFAULT_COST,
  REPORT_REASONS,
  resolveAccessPolicy,
} from '../../config/constants';
import { useAuth } from '../../contexts/AuthContext';
import { unlockExclusivePhotoWithDiamonds } from '../../services/adRewardService';
import { sendVirtualGift } from '../../services/chatService';
import { checkConnectionStatus, sendLike } from '../../services/discoveryService';
import {
  blockUser,
  reportUser,
  subscribeUserById,
  unblockUser,
} from '../../services/userService';
import {
  PAID_MESSAGE_DEFAULT_PRICE,
  clampPaidMessagePrice,
} from '../../utils/chatHelpers';
import {
  calculateAffinityScore,
  formatInterestWithIcon,
  formatSwipeActivity,
  formatUserDistanceLabel,
  getDailyLikeQuota,
  getDisplayAge,
  getOrderedPhotos,
  getPrimaryPhoto,
  getSharedInterests,
  getSpendableDiamonds,
  isBoostActive,
  isExclusivePhoto,
  isExclusivePhotoUnlocked,
  isGiftChatUnlocked,
  isProActive,
  isProfileVerified,
  optimizeCloudinaryUrl,
  triggerHaptic,
} from '../../utils/formatters';
import GiftAnimationOverlay from '../chat/GiftAnimationOverlay';
import GiftPickerModal from '../chat/GiftPickerModal';
import GiftShowcaseCard from '../monetization/GiftShowcaseCard';
import ProCrownBadge from '../monetization/ProCrownBadge';
import { TinderMatchRibbon } from './TinderMatchBanner';

export default function PublicProfileModal({
  targetUser,
  currentUser,
  userUnlocks = null,
  incomingLike = null,
  onClose,
  onStartChat,
  onOpenDiamondStore,
  onOpenPro,
  onSuccess,
  onError,
}) {
  const { economyConfig } = useAuth();
  const policy = resolveAccessPolicy(economyConfig);
  const [liveTarget, setLiveTarget] = useState(targetUser);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [status, setStatus] = useState({
    iLiked: false,
    isMatched: false,
    matchId: null,
    matchData: null,
  });
  const [busyAction, setBusyAction] = useState('');
  const [giftPickerOpen, setGiftPickerOpen] = useState(false);
  const [sendingGiftId, setSendingGiftId] = useState(null);
  const [giftAnim, setGiftAnim] = useState(null);
  const [showSafetyMenu, setShowSafetyMenu] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState('');
  const [isHeaderSolid, setIsHeaderSolid] = useState(false);

  const scrollContainerRef = useRef(null);
  const touchStartRef = useRef(null);

  const targetId = targetUser?.uid || targetUser?.id;

  useEffect(() => {
    if (!targetUser || !targetId) {
      setLiveTarget(null);
      return undefined;
    }
    setLiveTarget(targetUser);
    setPhotoIdx(0);
    setShowSafetyMenu(false);
    setIsHeaderSolid(false);
    setStatus({ iLiked: false, isMatched: false, matchId: null, matchData: null });
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }

    const unsub = subscribeUserById(targetId, (freshUser) => {
      setLiveTarget((prev) => ({ ...prev, ...freshUser }));
    });

    if (currentUser?.uid && targetId !== currentUser.uid) {
      checkConnectionStatus(currentUser.uid, targetId)
        .then(setStatus)
        .catch(() => {});
    }

    return () => unsub();
  }, [targetId, currentUser?.uid]);

  const orderedPhotos = useMemo(() => {
    if (!liveTarget) return [];
    const list = getOrderedPhotos(liveTarget, currentUser?.uid, {
      respectSmart: true,
    });
    return list.length > 0
      ? list
      : [getPrimaryPhoto(liveTarget, 800, { seed: currentUser?.uid })];
  }, [liveTarget, currentUser?.uid]);

  const safePhotoIdx =
    photoIdx >= 0 && photoIdx < orderedPhotos.length ? photoIdx : 0;
  const nextPhotoUrl =
    orderedPhotos.length > 1
      ? orderedPhotos[(safePhotoIdx + 1) % orderedPhotos.length]
      : '';

  useEffect(() => {
    if (!nextPhotoUrl) return;
    const preloadImg = new Image();
    preloadImg.src = optimizeCloudinaryUrl(nextPhotoUrl, 1080);
  }, [nextPhotoUrl]);

  useEffect(() => {
    if (!targetId) return undefined;
    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (showSafetyMenu) {
        setShowSafetyMenu(false);
        return;
      }
      if (!giftPickerOpen) {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [targetId, showSafetyMenu, giftPickerOpen, onClose]);

  if (!targetUser || !liveTarget) return null;

  const isSelf = currentUser?.uid === targetId;
  const viewerIsPro = isProActive(currentUser);
  const targetIsPro = isProActive(liveTarget);
  const isBlocked = (currentUser?.blockedUsers || []).includes(targetId);
  const allowsPaidDirect = Boolean(!isSelf && !status.isMatched && liveTarget.allowPaidMessages);
  const paidDirectPrice = clampPaidMessagePrice(
    liveTarget.messagePriceDiamonds,
    PAID_MESSAGE_DEFAULT_PRICE
  );
  const needsGiftForChat = Boolean(
    !isSelf &&
      !viewerIsPro &&
      !allowsPaidDirect &&
      liveTarget.requireGiftToChat &&
      !isGiftChatUnlocked(status.matchData, currentUser?.uid, liveTarget)
  );
  const hasChatUnlock = Boolean(
    policy.isFreeMode ||
      viewerIsPro ||
      (userUnlocks?.chatUnlockedUserIds || []).includes(targetId)
  );
  const canUnlockWithAdOrDiamonds = Boolean(
    !isSelf &&
      !status.isMatched &&
      !allowsPaidDirect &&
      !needsGiftForChat &&
      !hasChatUnlock &&
      (policy.enableRewardedAds || policy.enableDiamondCharges)
  );
  const isChatFreeOrUnlocked = Boolean(
    !allowsPaidDirect &&
      !needsGiftForChat &&
      (status.isMatched || hasChatUnlock)
  );

  const photos = orderedPhotos;
  const currentPhotoUrl = photos[safePhotoIdx] || photos[0] || '';
  const exclusiveCostDiamonds =
    policy.unlockExclusivePhotoDiamonds || EXCLUSIVE_PHOTO_DEFAULT_COST;
  const currentPhotoIsExclusive = isExclusivePhoto(
    liveTarget,
    currentPhotoUrl,
    safePhotoIdx
  );
  const currentPhotoUnlocked = isExclusivePhotoUnlocked({
    targetUser: liveTarget,
    photoUrl: currentPhotoUrl,
    photoIndex: safePhotoIdx,
    viewerUser: currentUser,
    userUnlocks,
    isFreeMode: policy.isFreeMode,
  });

  const boosted = isBoostActive(liveTarget);
  const verified = isProfileVerified(liveTarget);
  const visibleAge = getDisplayAge(liveTarget);
  const distanceInfo = formatUserDistanceLabel(liveTarget, currentUser);
  const activityInfo = formatSwipeActivity(liveTarget);
  const affinityScore = !isSelf
    ? calculateAffinityScore(currentUser, liveTarget)
    : null;
  const sharedInterests = getSharedInterests(currentUser, liveTarget);
  const sharedSet = new Set(sharedInterests);
  const sortedInterests = Array.isArray(liveTarget.interests)
    ? [
        ...liveTarget.interests.filter((item) => !isSelf && sharedSet.has(item)),
        ...liveTarget.interests.filter((item) => isSelf || !sharedSet.has(item)),
      ]
    : [];
  const userPrompts = Array.isArray(liveTarget.prompts)
    ? liveTarget.prompts.filter(
        (p) => typeof p === 'string' && p.trim().length > 0
      )
    : [];
  const profileDetails = [
    liveTarget.job ? { icon: Briefcase, label: liveTarget.job } : null,
    liveTarget.education
      ? { icon: GraduationCap, label: liveTarget.education }
      : null,
    liveTarget.height ? { icon: Ruler, label: liveTarget.height } : null,
    liveTarget.lifestyle
      ? { icon: Sparkles, label: liveTarget.lifestyle }
      : null,
  ].filter(Boolean);

  const likedPhotoNum = Number.isFinite(Number(incomingLike?.likedPhotoIndex))
    ? Number(incomingLike.likedPhotoIndex) + 1
    : 1;

  const stepPhoto = (delta) => {
    if (photos.length <= 1) return;
    triggerHaptic(8);
    setPhotoIdx((i) => (i + delta + photos.length) % photos.length);
  };

  const handleHeroTouchStart = (e) => {
    if (photos.length <= 1 || !e.touches?.[0]) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleHeroTouchEnd = (e) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || photos.length <= 1 || !e.changedTouches?.[0]) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      stepPhoto(dx < 0 ? 1 : -1);
    }
  };

  const handleSelectThumbnail = (idx) => {
    triggerHaptic(8);
    setPhotoIdx(idx);
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLike = async () => {
    if (status.iLiked || status.isMatched || isSelf) return;
    const dailyQuota = getDailyLikeQuota(currentUser);
    if (dailyQuota.remaining <= 0) {
      triggerHaptic([20, 40, 20]);
      onError?.(
        dailyQuota.isPro
          ? '❤️ Alcanzaste tus 100 corazones diarios PRO. Se renuevan mañana.'
          : '❤️ Alcanzaste tu límite de 25 corazones al día. Activa Conoscamosnos PRO para disfrutar 100 corazones diarios.'
      );
      if (!dailyQuota.isPro) {
        onClose?.();
        (onOpenPro || (() => onOpenDiamondStore?.('pro')))();
      }
      return;
    }
    setBusyAction('like');
    triggerHaptic([12, 24]);
    try {
      const res = await sendLike({
        currentUser,
        targetUser: liveTarget,
        likedPhotoUrl: photos[safePhotoIdx] || photos[0] || '',
        likedPhotoIndex: safePhotoIdx,
      });
      setStatus((prev) => ({
        ...prev,
        iLiked: true,
        isMatched: res.matched,
        matchId: res.matchId,
      }));
      if (res.matched) {
        onSuccess?.(`🎉 ¡Han hecho Match con ${liveTarget.name}! Ya están emparejados.`);
      } else {
        onSuccess?.(
          `❤️ Le diste Like a la foto #${safePhotoIdx + 1} de ${liveTarget.name}.`
        );
      }
    } catch (err) {
      onError?.(err.message || 'No se pudo enviar el Like.');
      if (err.code === 'DAILY_LIKE_LIMIT_REACHED' && !isProActive(currentUser)) {
        onClose?.();
        (onOpenPro || (() => onOpenDiamondStore?.('pro')))();
      }
    } finally {
      setBusyAction('');
    }
  };

  const handleOpenPrivateChat = async () => {
    if (isSelf) return;
    setBusyAction('chat');
    try {
      await onStartChat?.(liveTarget);
    } finally {
      setBusyAction('');
    }
  };

  const handleUnlockExclusivePhoto = async () => {
    if (isSelf || !currentPhotoUrl || busyAction === 'unlock_photo') return;
    const spendable = getSpendableDiamonds(currentUser);
    if (spendable < exclusiveCostDiamonds) {
      onError?.(
        `Necesitas ${exclusiveCostDiamonds} 💎 para desbloquear esta Foto Exclusiva VIP (o hazte Conoscamosnos PRO).`
      );
      onClose?.();
      onOpenDiamondStore?.('buy');
      return;
    }
    setBusyAction('unlock_photo');
    try {
      await unlockExclusivePhotoWithDiamonds({
        sender: currentUser,
        targetUser: liveTarget,
        photoUrl: currentPhotoUrl,
        costDiamonds: exclusiveCostDiamonds,
      });
      setGiftAnim({
        giftIcon: '📸',
        giftName: 'Foto Exclusiva VIP',
        giftValue: exclusiveCostDiamonds,
        diamondsCredited: exclusiveCostDiamonds,
        isReceiver: false,
      });
      onSuccess?.(
        `🔓 ¡Foto Exclusiva VIP de ${liveTarget.name} desbloqueada! (+${exclusiveCostDiamonds} 💎 acreditados a ${liveTarget.name}).`
      );
    } catch (err) {
      onError?.(
        err.message || 'No se pudo desbloquear la Foto Exclusiva VIP.'
      );
    } finally {
      setBusyAction('');
    }
  };

  const handleSendGift = async (gift) => {
    setSendingGiftId(gift.id);
    try {
      const res = await sendVirtualGift({
        sender: currentUser,
        receiver: liveTarget,
        gift,
        economyConfig,
      });
      setGiftPickerOpen(false);
      setGiftAnim({
        giftIcon: gift.icon,
        giftName: gift.name,
        giftValue: gift.price,
        diamondsCredited: res.diamondsCredited ?? gift.price,
        isReceiver: false,
      });
      onSuccess?.(
        `${gift.icon} ¡Regalo ${gift.name} enviado a ${liveTarget.name}!`
      );
    } catch (err) {
      onError?.(err.message || 'Error al enviar regalo.');
    } finally {
      setSendingGiftId(null);
    }
  };

  const handleBlockToggle = async () => {
    try {
      if (isBlocked) {
        await unblockUser(currentUser.uid, targetId);
        setShowSafetyMenu(false);
        onSuccess?.(`Desbloqueaste a ${liveTarget.name}.`);
      } else {
        await blockUser(currentUser.uid, targetId);
        setShowSafetyMenu(false);
        onSuccess?.(`Bloqueaste a ${liveTarget.name}.`);
        onClose?.();
      }
    } catch (err) {
      onError?.(err.message || 'No se pudo actualizar el bloqueo.');
    }
  };

  const handleReport = async () => {
    try {
      await reportUser({
        reporterId: currentUser.uid,
        reporterName: currentUser.name || '',
        reportedUserId: targetId,
        reportedUserName: liveTarget.name || '',
        reportedUserPhoto: photos[0] || getPrimaryPhoto(liveTarget, 240),
        reason: reportReason,
        details: reportDetails,
      });
      await blockUser(currentUser.uid, targetId);
      setReportDetails('');
      setShowSafetyMenu(false);
      onSuccess?.('Reporte guardado en tu historial y usuario bloqueado.');
      onClose?.();
    } catch (err) {
      onError?.(err.message || 'No se pudo enviar el reporte.');
    }
  };

  const primaryLeadPhoto = optimizeCloudinaryUrl(
    photos[0] || getPrimaryPhoto(liveTarget, 200),
    200
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 sm:backdrop-blur-md flex justify-center overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label={`Perfil de ${liveTarget.name || 'usuario'}`}
    >
      <div className="relative w-full sm:max-w-[440px] h-[100dvh] bg-[#FBF7F4] text-[#1D1317] flex flex-col overflow-hidden sm:border-x sm:border-white/10 shadow-2xl animate-profile-reveal">
        {/* Barra de navegación flotante que pasa de transparente sobre el retrato a porcelana al hacer scroll */}
        <header
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 18px)' }}
          className={`absolute top-0 inset-x-0 z-30 px-4 pb-3 transition-all duration-300 pointer-events-none ${
            isHeaderSolid
              ? 'bg-[#FBF7F4]/[0.92] backdrop-blur-xl border-b border-[#EFE3DF] shadow-sm'
              : 'bg-transparent'
          }`}
        >
          <div className="flex items-center justify-between gap-2.5">
            {isHeaderSolid ? (
              <div className="flex items-center gap-2.5 min-w-0 pointer-events-auto">
                <img
                  src={primaryLeadPhoto}
                  alt={liveTarget.name}
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-white shadow-sm shrink-0"
                />
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-display text-sm font-black text-[#1D1317] truncate">
                    {liveTarget.name}
                    {visibleAge !== null ? `, ${visibleAge}` : ''}
                  </span>
                  {verified && (
                    <BadgeCheck className="w-4 h-4 text-sky-500 fill-sky-500 stroke-white shrink-0" />
                  )}
                </div>
              </div>
            ) : isSelf ? (
              <span className="pointer-events-auto px-3.5 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-[11px] font-extrabold text-white shadow-sm">
                Vista previa · Así te ven
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setShowSafetyMenu(true)}
                className="pointer-events-auto w-10 h-10 rounded-full bg-black/35 hover:bg-black/55 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-sm active:scale-95 transition"
                aria-label="Opciones de seguridad"
                title="Reportar o bloquear"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
            )}

            <div className="flex items-center gap-2 shrink-0 pointer-events-auto">
              {isHeaderSolid && !isSelf && (
                <button
                  type="button"
                  onClick={() => setShowSafetyMenu(true)}
                  className="w-9 h-9 rounded-full bg-white hover:bg-[#FAF2F0] border border-[#EAE0DC] text-[#59474D] flex items-center justify-center shadow-sm active:scale-95 transition"
                  aria-label="Opciones de seguridad"
                  title="Reportar o bloquear"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition ${
                  isHeaderSolid
                    ? 'bg-white hover:bg-[#FAF2F0] border border-[#EAE0DC] text-[#1D1317] shadow-sm'
                    : 'bg-black/35 hover:bg-black/55 backdrop-blur-md border border-white/20 text-white shadow-sm'
                }`}
                aria-label="Cerrar perfil"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Contenedor único fluido desde top: 0 */}
        <div
          ref={scrollContainerRef}
          onScroll={(e) => setIsHeaderSolid(e.currentTarget.scrollTop > 220)}
          className="flex-1 overflow-y-auto no-scrollbar"
        >
          {/* A. Hero Editorial Edge-to-Edge desde el borde superior */}
          <section
            onTouchStart={handleHeroTouchStart}
            onTouchEnd={handleHeroTouchEnd}
            className="relative w-full h-[66dvh] min-h-[450px] max-h-[620px] bg-[#160E12] shrink-0 overflow-hidden group select-none"
          >
            <img
              key={`modal-photo-${safePhotoIdx}`}
              src={optimizeCloudinaryUrl(
                currentPhotoUrl || getPrimaryPhoto(liveTarget),
                1080
              )}
              alt={liveTarget.name}
              className={`w-full h-full object-cover object-center animate-photo-reveal transition duration-300 ${
                currentPhotoIsExclusive && !currentPhotoUnlocked
                  ? 'blur-2xl scale-110 brightness-75'
                  : ''
              }`}
            />

            {/* Viñeta cinematográfica superior e inferior */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 via-black/25 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-[#120A0E] via-[#120A0E]/65 to-transparent" />

            {/* Barras de progreso de historias al tope */}
            {photos.length > 1 && (
              <div
                style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
                className="pointer-events-none absolute inset-x-4 z-30 flex gap-1.5"
              >
                {photos.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerHaptic(8);
                      setPhotoIdx(idx);
                    }}
                    className={`pointer-events-auto h-[3px] flex-1 rounded-full transition-all ${
                      idx === safePhotoIdx
                        ? 'bg-white shadow-[0_1px_6px_rgba(255,255,255,0.65)]'
                        : 'bg-white/35 hover:bg-white/60'
                    }`}
                    aria-label={`Ver foto ${idx + 1} de ${photos.length}`}
                  />
                ))}
              </div>
            )}

            {/* Zonas táctiles izquierda/derecha para pasar fotos al toque */}
            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => stepPhoto(-1)}
                  className="absolute inset-y-0 left-0 w-[35%] z-10 cursor-pointer focus:outline-none"
                  aria-label="Foto anterior"
                />
                <button
                  type="button"
                  onClick={() => stepPhoto(1)}
                  className="absolute inset-y-0 right-0 w-[65%] z-10 cursor-pointer focus:outline-none"
                  aria-label="Siguiente foto"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    stepPhoto(-1);
                  }}
                  className="hidden sm:flex opacity-0 group-hover:opacity-100 absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/45 hover:bg-black/70 backdrop-blur-md border border-white/20 text-white items-center justify-center shadow transition"
                  aria-label="Foto anterior"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    stepPhoto(1);
                  }}
                  className="hidden sm:flex opacity-0 group-hover:opacity-100 absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/45 hover:bg-black/70 backdrop-blur-md border border-white/20 text-white items-center justify-center shadow transition"
                  aria-label="Siguiente foto"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            {/* Overlay de Foto Exclusiva VIP Bloqueada */}
            {currentPhotoIsExclusive && !currentPhotoUnlocked && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-0 z-20 pt-14 pb-24 px-5 flex flex-col items-center justify-center text-center bg-black/35 backdrop-blur-md"
              >
                <div className="w-full max-w-[276px] rounded-[28px] bg-zinc-950/90 border border-rose-300/35 p-4 space-y-2.5 shadow-2xl text-white">
                  <div className="w-11 h-11 mx-auto rounded-2xl bg-gradient-to-br from-[#FF2E54] to-amber-500 flex items-center justify-center shadow-lg">
                    <Lock className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-300/35 text-rose-200 text-[9.5px] font-black uppercase tracking-wider">
                      Álbum Exclusivo VIP
                    </span>
                    <h4 className="font-display text-sm font-black text-white mt-1.5">
                      Foto Exclusiva de {liveTarget.name}
                    </h4>
                    <p className="text-[11px] text-zinc-300 leading-snug mt-0.5">
                      Desbloquéala para siempre ({exclusiveCostDiamonds} 💎 van directo a{' '}
                      {liveTarget.name}) o mírala gratis siendo PRO.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={busyAction === 'unlock_photo'}
                    onClick={handleUnlockExclusivePhoto}
                    className="w-full py-2.5 px-3 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 text-white text-xs font-black shadow-md hover:brightness-105 disabled:opacity-50 transition flex items-center justify-center gap-1.5"
                  >
                    <Gem className="w-3.5 h-3.5" />
                    {busyAction === 'unlock_photo'
                      ? 'Desbloqueando...'
                      : `Desbloquear por ${exclusiveCostDiamonds} 💎`}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose?.();
                      (onOpenPro || (() => onOpenDiamondStore?.('pro')))();
                    }}
                    className="w-full py-2 px-3 rounded-full bg-gradient-to-r from-[#FF2E54] to-amber-500 text-white text-[11px] font-black shadow hover:brightness-105 transition flex items-center justify-center gap-1"
                  >
                    <Crown className="w-3.5 h-3.5" />
                    Ver gratis con Conoscamosnos PRO
                  </button>
                </div>
              </div>
            )}

            {/* Etiqueta de Foto Exclusiva VIP ya desbloqueada */}
            {currentPhotoIsExclusive && currentPhotoUnlocked && (
              <div
                style={{ top: 'calc(env(safe-area-inset-top, 0px) + 66px)' }}
                className="pointer-events-none absolute left-4 z-20"
              >
                <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-[#FF2E54] to-amber-500 text-white text-[10px] font-black inline-flex items-center gap-1 shadow">
                  <Unlock className="w-3 h-3" /> Foto Exclusiva VIP Desbloqueada
                </span>
              </div>
            )}

            {/* Indicador discreto de índice de foto */}
            {photos.length > 1 && (
              <div className="pointer-events-none absolute bottom-10 right-5 z-20 px-2.5 py-1 rounded-full bg-black/45 backdrop-blur-md border border-white/15 text-[10.5px] font-bold text-white/90 tabular-nums">
                {safePhotoIdx + 1} / {photos.length}
              </div>
            )}

            {/* Bloque de Identidad Editorial sobre el retrato */}
            <div className="pointer-events-none absolute bottom-10 inset-x-5 pr-16 z-20 space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/45 backdrop-blur-md border border-white/15 text-[10.5px] font-bold text-white/95">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      activityInfo.activeNow
                        ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.9)]'
                        : 'bg-zinc-300/80'
                    }`}
                  />
                  {activityInfo.label}
                </span>

                {affinityScore !== null && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/30 backdrop-blur-md border border-rose-200/30 text-[10.5px] font-extrabold text-rose-50">
                    <Sparkles className="w-3 h-3 text-rose-200" />
                    {affinityScore}% afín
                  </span>
                )}

                {boosted && (
                  <span className="inline-flex items-center gap-0.5 px-2 py-1 rounded-full bg-amber-400 text-zinc-950 text-[10px] font-black shadow">
                    <Zap className="w-3 h-3 fill-zinc-950" /> VIP
                  </span>
                )}
              </div>

              <div className="flex items-center flex-wrap gap-2">
                <h2 className="font-display text-[32px] leading-[1.06] font-black tracking-[-0.025em] text-white drop-shadow-sm">
                  {liveTarget.name}
                  {visibleAge !== null && (
                    <span className="font-semibold text-white/[0.88]">
                      , {visibleAge}
                    </span>
                  )}
                </h2>
                {verified && (
                  <BadgeCheck className="w-5 h-5 text-sky-400 fill-sky-400 stroke-white shrink-0" />
                )}
                {targetIsPro && <ProCrownBadge variant="compact" />}
              </div>

              <p className="text-xs text-white/90 flex items-center gap-1.5 font-semibold drop-shadow-sm">
                {!distanceInfo.isHidden && (
                  <span>{liveTarget.country?.flag || '🌎'}</span>
                )}
                <MapPin className="w-3.5 h-3.5 text-[#FF4D73] shrink-0" />
                <span className="truncate">{distanceInfo.text}</span>
              </p>
            </div>
          </section>

          {/* B. Hoja Editorial Curvada Superpuesta */}
          <div className="relative z-20 -mt-6 rounded-t-[28px] bg-[#FBF7F4] px-4 pt-5 pb-32 space-y-4">
            {/* 1. Banner contextual cuando viene de Likes o ya hicieron Match */}
            {!isSelf && (status.isMatched || incomingLike) && (
              status.isMatched ? (
                <div className="space-y-2">
                  <TinderMatchRibbon
                    isSuperMatch={Boolean(incomingLike?.isSuperLike)}
                    variant="wide"
                  />
                  <div className="p-3.5 rounded-[22px] bg-gradient-to-r from-[#FFF0F4] via-[#FFF6F2] to-amber-50 border border-rose-200/80 flex items-center gap-3 shadow-card">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#FF1744] via-[#FF2E63] to-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <Check className="w-5 h-5 stroke-[2.8]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-[#1D1317]">
                        💘 ¡Han hecho Match! · Emparejados
                      </p>
                      <p className="text-[11px] font-medium text-[#6B545B] leading-snug">
                        Se dieron corazón mutuamente. Ya pueden conversar sin límites.
                      </p>
                    </div>
                  </div>
                </div>
              ) : incomingLike?.isSuperLike ? (
                <div className="p-3.5 rounded-[22px] bg-gradient-to-r from-[#0C1830] via-[#13254A] to-[#1D1533] border border-sky-400/35 text-white flex items-center gap-3 shadow-[0_12px_28px_-10px_rgba(14,165,233,0.35)]">
                  {incomingLike.likedPhotoUrl ? (
                    <img
                      src={optimizeCloudinaryUrl(incomingLike.likedPhotoUrl, 160)}
                      alt={`Tu foto #${likedPhotoNum}`}
                      className="w-11 h-11 rounded-xl object-cover ring-2 ring-amber-300/75 shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-400 to-amber-400 text-white flex items-center justify-center shrink-0 shadow">
                      <Star className="w-5 h-5 fill-white" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-sky-100 flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300 shrink-0" />
                      Te envió un Super Like
                    </p>
                    <p className="text-[11px] font-medium text-sky-200/85 leading-snug mt-0.5">
                      Le encantó tu foto #{likedPhotoNum}. ¡Corresponde abajo para hacer Match!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-[22px] bg-gradient-to-r from-[#FFF1F4] via-[#FFF6F2] to-[#FFF8EC] border border-[#F6D5DE] flex items-center gap-3 shadow-card">
                  {incomingLike.likedPhotoUrl ? (
                    <img
                      src={optimizeCloudinaryUrl(incomingLike.likedPhotoUrl, 160)}
                      alt={`Tu foto #${likedPhotoNum}`}
                      className="w-11 h-11 rounded-xl object-cover ring-2 ring-white shadow-sm shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#FF2E54] to-rose-400 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <Heart className="w-5 h-5 fill-white" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-[#1D1317]">
                      Le gustó tu foto #{likedPhotoNum}
                    </p>
                    <p className="text-[11px] font-medium text-[#6B545B] leading-snug mt-0.5">
                      Corresponde con Match para iniciar conversación al instante.
                    </p>
                  </div>
                </div>
              )
            )}

            {/* 2. Galería rápida de miniaturas */}
            {photos.length > 1 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar py-0.5">
                {photos.map((url, idx) => {
                  const thumbLocked =
                    isExclusivePhoto(liveTarget, url, idx) &&
                    !isExclusivePhotoUnlocked({
                      targetUser: liveTarget,
                      photoUrl: url,
                      photoIndex: idx,
                      viewerUser: currentUser,
                      userUnlocks,
                      isFreeMode: policy.isFreeMode,
                    });
                  const isActiveThumb = safePhotoIdx === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectThumbnail(idx)}
                      className={`relative w-14 h-[68px] rounded-2xl overflow-hidden shrink-0 transition-all ${
                        isActiveThumb
                          ? 'ring-2 ring-[#1D1317] scale-[1.03] shadow-md'
                          : 'opacity-70 hover:opacity-100 ring-1 ring-[#EAE0DC]'
                      }`}
                      aria-label={`Seleccionar foto ${idx + 1}`}
                    >
                      <img
                        src={optimizeCloudinaryUrl(url, 200)}
                        alt=""
                        className={`w-full h-full object-cover ${
                          thumbLocked ? 'blur-md scale-110 brightness-75' : ''
                        }`}
                      />
                      {thumbLocked && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-white">
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* 3. Bento Resumen: Intención + Métricas */}
            <div className="rounded-[24px] bg-white border border-[#F0E4E0] shadow-card overflow-hidden">
              <div className="p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 text-[#E62E5C] flex items-center justify-center shrink-0">
                    <Flame className="w-4 h-4 fill-[#E62E5C]/20" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#8C777E]">
                      Busca
                    </p>
                    <p className="text-xs sm:text-[13px] font-black text-[#1D1317] truncate">
                      {liveTarget.lookingFor || 'Conectar'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 pl-3 border-l border-[#F0E4E0] tabular-nums">
                  <div className="text-center">
                    <p className="text-sm font-black text-[#E62E5C] flex items-center justify-center gap-1">
                      <Heart className="w-3.5 h-3.5 fill-[#E62E5C]" />
                      <span>{liveTarget.likesCount || 0}</span>
                    </p>
                    <p className="text-[9.5px] font-bold uppercase tracking-wider text-[#8C777E]">
                      Likes
                    </p>
                  </div>

                  <div className="w-px h-7 bg-[#F0E4E0]" />

                  <div className="text-center">
                    <p className="text-sm font-black text-amber-600 flex items-center justify-center gap-1">
                      <Gift className="w-3.5 h-3.5" />
                      <span>{liveTarget.giftsReceivedCount || 0}</span>
                    </p>
                    <p className="text-[9.5px] font-bold uppercase tracking-wider text-[#8C777E]">
                      Regalos
                    </p>
                  </div>
                </div>
              </div>

              {!isSelf && liveTarget.requireGiftToChat && (
                <div className="px-3.5 py-2.5 bg-gradient-to-r from-[#1A0A14] via-[#2B0E1F] to-[#1A0A14] border-t border-amber-300/20 flex items-center gap-2 text-[11px] font-semibold text-amber-100">
                  <Crown className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span className="leading-snug">
                    Este perfil solicita un regalo virtual inicial para abrir chat (gratis con PRO).
                  </span>
                </div>
              )}
            </div>

            {/* 4. Biografía Editorial */}
            {liveTarget.bio && (
              <div className="p-5 rounded-[24px] bg-white border border-[#F0E4E0] shadow-card space-y-2">
                <p className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-[#8C777E]">
                  Sobre {liveTarget.name}
                </p>
                <p className="text-[15px] text-[#261B1F] leading-[1.62] font-medium">
                  {liveTarget.bio}
                </p>
              </div>
            )}

            {/* 5. Lo Esencial */}
            {profileDetails.length > 0 && (
              <div className="p-5 rounded-[24px] bg-white border border-[#F0E4E0] shadow-card space-y-3">
                <p className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-[#8C777E]">
                  Lo esencial
                </p>
                <div className="flex flex-wrap gap-2">
                  {profileDetails.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <span
                        key={idx}
                        className="px-3.5 py-2 rounded-full bg-[#FAF2F0] border border-[#EFE0DC] text-xs font-bold text-[#2A1D21] inline-flex items-center gap-1.5"
                      >
                        <Icon className="w-3.5 h-3.5 text-[#E62E5C] shrink-0" />
                        <span>{item.label}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 6. Frases Personales Editoriales */}
            {userPrompts.length > 0 && (
              <div className="space-y-3">
                {userPrompts.map((promptText, idx) => (
                  <div
                    key={idx}
                    className="relative p-5 rounded-[24px] bg-gradient-to-br from-[#FFF9F6] via-white to-[#FFF2F5] border border-[#F2DFE4] shadow-card overflow-hidden space-y-1.5"
                  >
                    <Quote className="pointer-events-none absolute -right-1 -bottom-2 w-16 h-16 text-[#E62E5C]/[0.06]" />
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#D92D55] flex items-center gap-1">
                      <Quote className="w-3 h-3" />
                      {userPrompts.length > 1 ? `Frase personal ${idx + 1}` : 'Frase personal'}
                    </p>
                    <p className="relative font-editorial italic text-[23px] font-semibold text-[#1D1216] leading-[1.25]">
                      “{promptText}”
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* 7. Intereses (en común primero) */}
            {sortedInterests.length > 0 && (
              <div className="p-5 rounded-[24px] bg-white border border-[#F0E4E0] shadow-card space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-[#8C777E]">
                    Intereses
                  </p>
                  {!isSelf && sharedInterests.length > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/90 text-[11px] font-extrabold text-emerald-700 inline-flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> {sharedInterests.length} en común
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {sortedInterests.map((interest) => {
                    const isCommon = !isSelf && sharedSet.has(interest);
                    return (
                      <span
                        key={interest}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold border ${
                          isCommon
                            ? 'bg-emerald-50 border-emerald-200/90 text-emerald-800'
                            : 'bg-[#F7F1EF] border-[#ECE1DD] text-[#2B1F23]'
                        }`}
                      >
                        {isCommon ? `✨ ${interest}` : formatInterestWithIcon(interest)}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 8. Vitrina de Regalos */}
            <GiftShowcaseCard
              user={liveTarget}
              title="Regalos recibidos"
              emptyText="Sé la primera persona en sorprender con un detalle."
              headerAction={
                !isSelf ? (
                  <button
                    type="button"
                    onClick={() => setGiftPickerOpen(true)}
                    className="px-3 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-[11px] font-extrabold inline-flex items-center gap-1 transition"
                  >
                    <Gift className="w-3.5 h-3.5 text-amber-600" />
                    Enviar
                  </button>
                ) : null
              }
            />

            {/* 9. Acción discreta de Seguridad */}
            {!isSelf && (
              <div className="pt-1 pb-2 text-center">
                <button
                  type="button"
                  onClick={() => setShowSafetyMenu(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[11.5px] font-bold text-[#8C777E] hover:text-[#1D1317] hover:bg-white/70 transition"
                >
                  <Flag className="w-3.5 h-3.5" />
                  Reportar o bloquear a {liveTarget.name}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Dock Flotante Luxury Inferior */}
        {!isSelf && (
          <div
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)' }}
            className="pointer-events-none absolute bottom-0 inset-x-0 z-30 px-4 pt-8 bg-gradient-to-t from-[#FBF7F4] via-[#FBF7F4]/95 to-transparent"
          >
            <div className="pointer-events-auto flex items-center gap-2.5">
              {/* Like / Match */}
              <button
                type="button"
                disabled={busyAction === 'like' || status.iLiked || status.isMatched}
                onClick={handleLike}
                className={`h-[52px] px-4 rounded-full text-xs font-black inline-flex items-center justify-center gap-1.5 shrink-0 transition active:scale-95 ${
                  status.isMatched
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                    : status.iLiked
                    ? 'bg-rose-50 border border-rose-200 text-[#E62E5C]'
                    : incomingLike
                    ? 'bg-gradient-to-r from-[#FF2E54] via-rose-500 to-amber-500 text-white shadow-[0_12px_26px_-8px_rgba(255,46,84,0.6)] hover:brightness-105'
                    : 'bg-gradient-to-r from-[#FF2E54] to-[#FF5E7E] text-white shadow-[0_12px_24px_-8px_rgba(255,46,84,0.5)] hover:brightness-105'
                }`}
              >
                {status.isMatched ? (
                  <>
                    <Check className="w-4 h-4 stroke-[2.6]" />
                    <span>Match</span>
                  </>
                ) : status.iLiked ? (
                  <>
                    <Heart className="w-4 h-4 fill-[#E62E5C]" />
                    <span>Te gusta</span>
                  </>
                ) : (
                  <>
                    <Heart className="w-4 h-4 fill-white" />
                    <span>{incomingLike ? 'Match' : 'Like'}</span>
                  </>
                )}
              </button>

              {/* CTA Principal de Chat */}
              <button
                type="button"
                disabled={busyAction === 'chat'}
                onClick={handleOpenPrivateChat}
                className={`flex-1 min-w-0 h-[52px] px-4 rounded-full text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60 transition ${
                  allowsPaidDirect || needsGiftForChat
                    ? 'bg-gradient-to-r from-[#1A0A14] via-[#2F1022] to-[#1A0A14] border border-amber-300/45 text-amber-100 shadow-[0_14px_30px_-10px_rgba(26,10,20,0.6)] hover:brightness-110'
                    : 'bg-[#160F13] hover:bg-[#24181F] text-white shadow-[0_14px_30px_-10px_rgba(22,15,19,0.55)]'
                }`}
              >
                {allowsPaidDirect ? (
                  <Gem className="w-4 h-4 text-sky-300 shrink-0" />
                ) : needsGiftForChat ? (
                  <Gift className="w-4 h-4 text-amber-300 shrink-0" />
                ) : (
                  <MessageCircle className="w-4 h-4 shrink-0" />
                )}
                <span className="truncate">
                  {busyAction === 'chat'
                    ? 'Abriendo...'
                    : allowsPaidDirect
                    ? `Mensaje VIP · ${paidDirectPrice} 💎`
                    : needsGiftForChat
                    ? 'Regalo y chat'
                    : isChatFreeOrUnlocked
                    ? 'Enviar mensaje'
                    : canUnlockWithAdOrDiamonds
                    ? 'Chatear (Anuncio / 💎)'
                    : 'Solo PRO o Match'}
                </span>
                {!isChatFreeOrUnlocked && !allowsPaidDirect && (
                  <Lock className="w-3.5 h-3.5 opacity-75 shrink-0" />
                )}
              </button>

              {/* Regalo Rápido */}
              <button
                type="button"
                onClick={() => setGiftPickerOpen(true)}
                className="w-[52px] h-[52px] rounded-full shrink-0 bg-gradient-to-br from-[#FFF7E6] to-[#FDECC8] border border-amber-300/80 text-amber-800 shadow-[0_8px_20px_-8px_rgba(217,119,6,0.35)] hover:brightness-105 active:scale-95 transition flex items-center justify-center"
                aria-label="Enviar regalo"
                title="Enviar regalo virtual"
              >
                <Gift className="w-5 h-5 text-amber-600" />
              </button>
            </div>
          </div>
        )}

        {/* Bottom Sheet Overlay de Seguridad y Moderación */}
        {showSafetyMenu && !isSelf && (
          <div
            onClick={() => setShowSafetyMenu(false)}
            className="absolute inset-0 z-40 bg-black/45 backdrop-blur-sm flex items-end"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
              className="w-full rounded-t-[30px] bg-[#FFFDF9] border-t border-[#EFE0D7] p-5 shadow-2xl animate-sheet-up space-y-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-2xl bg-rose-50 border border-rose-200 text-[#E62E5C] flex items-center justify-center">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-[#1D1317]">
                      Seguridad y Moderación
                    </p>
                    <p className="text-[11px] font-medium text-[#7A656C]">
                      Tu reporte es confidencial
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSafetyMenu(false)}
                  className="w-8 h-8 rounded-full bg-[#FAF2EC] border border-[#EADBD0] text-[#5A4942] flex items-center justify-center"
                  aria-label="Cerrar opciones de seguridad"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#FBF6F1] border border-[#E8DAD0] text-xs text-[#1D1317] font-semibold focus:outline-none focus:border-[#E62E5C]"
              >
                {REPORT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              <input
                type="text"
                maxLength={160}
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Detalle opcional (solo visible en tus reportes y moderación)"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#FBF6F1] border border-[#E8DAD0] text-xs text-[#1D1317] placeholder:text-[#9E8B81] font-medium focus:outline-none focus:border-[#E62E5C]"
              />

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleBlockToggle}
                  className="py-3 rounded-full bg-white border border-[#E8DAD0] text-[#2A1D21] text-xs font-extrabold flex items-center justify-center gap-1.5 hover:bg-[#FAF2EC] transition"
                >
                  {isBlocked ? (
                    <>
                      <Unlock className="w-3.5 h-3.5 text-emerald-600" /> Desbloquear
                    </>
                  ) : (
                    <>
                      <Ban className="w-3.5 h-3.5" /> Bloquear
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleReport}
                  className="py-3 rounded-full bg-[#FF2E54] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm hover:brightness-105 transition"
                >
                  <Flag className="w-3.5 h-3.5" /> Reportar
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowSafetyMenu(false)}
                className="w-full py-2.5 rounded-full text-xs font-bold text-[#7A656C] hover:text-[#1D1317] transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      <GiftPickerModal
        isOpen={giftPickerOpen}
        onClose={() => setGiftPickerOpen(false)}
        recipientName={liveTarget.name}
        userDiamonds={getSpendableDiamonds(currentUser)}
        sendingGiftId={sendingGiftId}
        onSelectGift={handleSendGift}
        onOpenDiamondStore={() => {
          onClose();
          onOpenDiamondStore();
        }}
      />

      <GiftAnimationOverlay
        giftEvent={giftAnim}
        onComplete={() => setGiftAnim(null)}
      />
    </div>
  );
}
