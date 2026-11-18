import { useEffect, useState } from 'react';
import {
  BadgeCheck,
  Ban,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Crown,
  Flag,
  Flame,
  Gift,
  GraduationCap,
  Heart,
  Lock,
  MapPin,
  MessageCircle,
  Quote,
  Ruler,
  Sparkles,
  Unlock,
  X,
  Zap,
} from 'lucide-react';
import { REPORT_REASONS, resolveAccessPolicy } from '../../config/constants';
import { useAuth } from '../../contexts/AuthContext';
import { sendVirtualGift } from '../../services/chatService';
import { checkConnectionStatus, sendLike } from '../../services/discoveryService';
import {
  blockUser,
  reportUser,
  subscribeUserById,
  unblockUser,
} from '../../services/userService';
import {
  formatInterestWithIcon,
  formatRelativeLastSeen,
  formatUserDistanceLabel,
  getDisplayAge,
  getOrderedPhotos,
  getPrimaryPhoto,
  getSharedInterests,
  isBoostActive,
  isGiftChatUnlocked,
  isProfileVerified,
  isUserActuallyOnline,
  optimizeCloudinaryUrl,
} from '../../utils/formatters';
import GiftAnimationOverlay from '../chat/GiftAnimationOverlay';
import GiftShowcaseCard from '../monetization/GiftShowcaseCard';
import GiftPickerModal from '../chat/GiftPickerModal';

export default function PublicProfileModal({
  targetUser,
  currentUser,
  userUnlocks = null,
  onClose,
  onStartChat,
  onOpenCoinStore,
  onSuccess,
  onError,
}) {
  const { economyConfig } = useAuth();
  const policy = resolveAccessPolicy(economyConfig);
  const [liveTarget, setLiveTarget] = useState(targetUser);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [status, setStatus] = useState({ iLiked: false, isMatched: false, matchId: null, matchData: null });
  const [busyAction, setBusyAction] = useState('');
  const [giftPickerOpen, setGiftPickerOpen] = useState(false);
  const [sendingGiftId, setSendingGiftId] = useState(null);
  const [giftAnim, setGiftAnim] = useState(null);
  const [showSafetyMenu, setShowSafetyMenu] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState('');

  const targetId = targetUser?.uid || targetUser?.id;

  useEffect(() => {
    if (!targetUser || !targetId) {
      setLiveTarget(null);
      return;
    }
    setLiveTarget(targetUser);
    setPhotoIdx(0);
    setShowSafetyMenu(false);

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

  if (!targetUser || !liveTarget) return null;

  const isSelf = currentUser?.uid === targetId;
  const isBlocked = (currentUser?.blockedUsers || []).includes(targetId);
  const needsGiftForChat = Boolean(
    !isSelf &&
      liveTarget.requireGiftToChat &&
      !isGiftChatUnlocked(status.matchData, currentUser?.uid, liveTarget)
  );
  const isChatFreeOrUnlocked = Boolean(
    !needsGiftForChat &&
      (policy.isFreeMode ||
        status.isMatched ||
        (userUnlocks?.chatUnlockedUserIds || []).includes(targetId))
  );

  const orderedPhotos = getOrderedPhotos(liveTarget, currentUser?.uid, {
    respectSmart: true,
  });
  const photos =
    orderedPhotos.length > 0 ? orderedPhotos : [getPrimaryPhoto(liveTarget, 800, { seed: currentUser?.uid })];

  const online = isUserActuallyOnline(liveTarget);
  const boosted = isBoostActive(liveTarget);
  const verified = isProfileVerified(liveTarget);
  const visibleAge = getDisplayAge(liveTarget);
  const distanceInfo = formatUserDistanceLabel(liveTarget, currentUser);
  const sharedInterests = getSharedInterests(currentUser, liveTarget);
  const sharedSet = new Set(sharedInterests);
  const userPrompts = Array.isArray(liveTarget.prompts)
    ? liveTarget.prompts.filter((p) => typeof p === 'string' && p.trim().length > 0)
    : [];
  const profileDetails = [
    liveTarget.job ? { icon: Briefcase, label: liveTarget.job } : null,
    liveTarget.education ? { icon: GraduationCap, label: liveTarget.education } : null,
    liveTarget.height ? { icon: Ruler, label: liveTarget.height } : null,
    liveTarget.lifestyle ? { icon: Sparkles, label: liveTarget.lifestyle } : null,
  ].filter(Boolean);

  const handleLike = async () => {
    if (status.iLiked || isSelf) return;
    setBusyAction('like');
    try {
      const res = await sendLike({
        currentUser,
        targetUser: liveTarget,
        likedPhotoUrl: photos[photoIdx] || photos[0] || '',
      });
      setStatus((prev) => ({
        ...prev,
        iLiked: true,
        isMatched: res.matched,
        matchId: res.matchId,
      }));
      if (res.matched) {
        onSuccess?.(`🎉 ¡Es un Match con ${liveTarget.name}! Ya pueden chatear.`);
      } else {
        onSuccess?.(`❤️ Le diste Like a ${liveTarget.name}.`);
      }
    } catch (err) {
      onError?.(err.message || 'No se pudo enviar el Like.');
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
      onSuccess?.(`${gift.icon} ¡Regalo ${gift.name} enviado a ${liveTarget.name}!`);
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
        onSuccess?.(`Desbloqueaste a ${liveTarget.name}.`);
      } else {
        await blockUser(currentUser.uid, targetId);
        onSuccess?.(`Bloqueaste a ${liveTarget.name}.`);
        onClose();
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
      onSuccess?.('Reporte guardado en tu historial y usuario bloqueado.');
      onClose();
    } catch (err) {
      onError?.(err.message || 'No se pudo enviar el reporte.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md max-h-[94dvh] bg-white rounded-t-[32px] sm:rounded-[32px] flex flex-col overflow-hidden shadow-2xl animate-sheet-up">
        {/* Photo Carousel */}
        <div className="relative h-80 sm:h-96 bg-zinc-200 shrink-0">
          <img
            key={`modal-photo-${photoIdx}`}
            src={optimizeCloudinaryUrl(photos[photoIdx] || getPrimaryPhoto(liveTarget), 1080)}
            alt={liveTarget.name}
            className="w-full h-full object-cover animate-photo-reveal"
          />

          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/55 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

          {/* Story Indicators */}
          {photos.length > 1 && (
            <div className="absolute top-3 inset-x-4 flex gap-1.5">
              {photos.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPhotoIdx(idx)}
                  className={`h-1 flex-1 rounded-full transition ${
                    idx === photoIdx ? 'bg-white shadow' : 'bg-white/35'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Top Controls */}
          <div className="absolute top-6 inset-x-3.5 flex items-center justify-between">
            {!isSelf ? (
              <button
                type="button"
                onClick={() => setShowSafetyMenu((s) => !s)}
                className="p-2 rounded-full bg-white/90 text-zinc-800 hover:bg-white shadow-sm transition"
                title="Reportar o bloquear"
              >
                <Flag className="w-4 h-4" />
              </button>
            ) : (
              <span className="px-3 py-1 rounded-full bg-white/95 text-xs font-extrabold text-zinc-900 shadow-sm">
                Vista previa (como te ven)
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-white/90 text-zinc-900 hover:bg-white shadow-sm transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setPhotoIdx((i) => (i - 1 + photos.length) % photos.length)}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/85 text-zinc-900 shadow hover:bg-white"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setPhotoIdx((i) => (i + 1) % photos.length)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/85 text-zinc-900 shadow hover:bg-white"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Name & Online Overlay */}
          <div className="absolute bottom-3.5 inset-x-4 flex items-end justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-2xl font-extrabold text-white">
                  {liveTarget.name}
                  {visibleAge !== null ? `, ${visibleAge}` : ''}
                </h2>
                {verified && (
                  <BadgeCheck className="w-5 h-5 text-sky-400 fill-sky-400 stroke-white shrink-0" />
                )}
                {boosted && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-400 text-zinc-950 text-[10px] font-black flex items-center gap-0.5 shadow">
                    <Zap className="w-3 h-3 fill-zinc-950" /> VIP
                  </span>
                )}
                {!isSelf && liveTarget.requireGiftToChat && (
                  <span className="px-2 py-0.5 rounded-full bg-zinc-950/85 border border-amber-300/50 text-amber-200 text-[10px] font-extrabold flex items-center gap-0.5 shadow">
                    <Crown className="w-3 h-3 text-amber-300" /> Chat con regalo
                  </span>
                )}
              </div>
              <p className="text-xs text-white/90 flex items-center gap-1.5 mt-0.5 font-medium">
                {!distanceInfo.isHidden && <span>{liveTarget.country?.flag || '🌎'}</span>}
                <MapPin className="w-3.5 h-3.5 text-[#FF2E54]" />
                <span>{distanceInfo.text}</span>
              </p>
            </div>

            <span
              className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold flex items-center gap-1.5 shadow-sm ${
                online ? 'bg-emerald-500 text-white' : 'bg-white/95 text-zinc-700'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${online ? 'bg-white animate-pulse' : 'bg-zinc-400'}`}
              />
              {online
                ? 'En línea'
                : formatRelativeLastSeen(liveTarget.lastSeen, false, {
                    hideOnlineStatus: liveTarget.hideOnlineStatus,
                  })}
            </span>
          </div>
        </div>

        {/* Scrollable Profile Details */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3.5 bg-[#FAF7F9]">
          {showSafetyMenu && !isSelf && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-2.5">
              <p className="text-xs font-extrabold text-rose-800">Seguridad y Moderación</p>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-rose-200 text-xs text-zinc-800 font-medium"
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
                className="w-full px-3 py-2 rounded-xl bg-white border border-rose-200 text-xs text-zinc-800 placeholder:text-zinc-400 font-medium focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleBlockToggle}
                  className="py-2 rounded-xl bg-white border border-zinc-200 text-zinc-700 text-xs font-bold flex items-center justify-center gap-1 hover:bg-zinc-100"
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
                  className="py-2 rounded-xl bg-[#FF2E54] text-white text-xs font-bold flex items-center justify-center gap-1"
                >
                  <Flag className="w-3.5 h-3.5" /> Reportar
                </button>
              </div>
            </div>
          )}

          {photos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {photos.map((url, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPhotoIdx(idx)}
                  className={`w-14 h-14 rounded-2xl overflow-hidden border-2 shrink-0 transition ${
                    photoIdx === idx ? 'border-zinc-900 scale-105 shadow-sm' : 'border-white opacity-70'
                  }`}
                >
                  <img src={optimizeCloudinaryUrl(url, 200)} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Popularity Counters + Intention */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-white shadow-card text-center">
              <p className="text-base font-extrabold text-[#FF2E54] flex items-center justify-center gap-1">
                <Flame className="w-4 h-4 fill-[#FF2E54]" /> {liveTarget.likesCount || 0}
              </p>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide mt-0.5">Me gusta</p>
            </div>
            <div className="p-3 rounded-2xl bg-white shadow-card text-center">
              <p className="text-base font-extrabold text-amber-600 flex items-center justify-center gap-1">
                <Gift className="w-4 h-4" /> {liveTarget.giftsReceivedCount || 0}
              </p>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide mt-0.5">Regalos</p>
            </div>
            <div className="p-3 rounded-2xl bg-white shadow-card text-center flex flex-col justify-center">
              <p className="text-xs font-extrabold text-zinc-900 truncate">
                {liveTarget.lookingFor || 'Conectar'}
              </p>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide mt-0.5">Busca</p>
            </div>
          </div>

          <GiftShowcaseCard
            user={liveTarget}
            title="Regalos recibidos"
            emptyText="Aún no ha recibido regalos virtuales. ¡Envíale uno abajo!"
          />

          {liveTarget.bio && (
            <div className="p-4 rounded-2xl bg-white shadow-card">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400 mb-1">
                Sobre {liveTarget.name}
              </p>
              <p className="text-sm text-zinc-800 leading-relaxed font-medium">{liveTarget.bio}</p>
            </div>
          )}

          {profileDetails.length > 0 && (
            <div className="p-4 rounded-2xl bg-white shadow-card">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400 mb-2">
                Información
              </p>
              <div className="flex flex-wrap gap-1.5">
                {profileDetails.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <span
                      key={idx}
                      className="px-3 py-1.5 rounded-full bg-zinc-100 text-xs font-bold text-zinc-800 inline-flex items-center gap-1.5"
                    >
                      <Icon className="w-3.5 h-3.5 text-[#FF2E54]" />
                      {item.label}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {userPrompts.length > 0 && (
            <div className="space-y-2">
              {userPrompts.map((promptText, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-white shadow-card space-y-1"
                >
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#FF2E54] flex items-center gap-1">
                    <Quote className="w-3 h-3" /> Frase {idx + 1}
                  </p>
                  <p className="text-sm font-bold text-zinc-900 leading-relaxed">
                    “{promptText}”
                  </p>
                </div>
              ))}
            </div>
          )}

          {Array.isArray(liveTarget.interests) && liveTarget.interests.length > 0 && (
            <div className="p-4 rounded-2xl bg-white shadow-card">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400">
                  Intereses
                </p>
                {!isSelf && sharedInterests.length > 0 && (
                  <span className="text-[11px] font-extrabold text-emerald-600 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> {sharedInterests.length} en común
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {liveTarget.interests.map((interest) => {
                  const isCommon = !isSelf && sharedSet.has(interest);
                  return (
                    <span
                      key={interest}
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        isCommon
                          ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                          : 'bg-zinc-100 text-zinc-800'
                      }`}
                    >
                      {isCommon ? `✨ ${interest}` : formatInterestWithIcon(interest)}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons Footer */}
        {!isSelf && (
          <div className="p-3.5 pb-safe border-t border-zinc-200/80 bg-white space-y-2">
            <button
              type="button"
              disabled={busyAction === 'chat'}
              onClick={handleOpenPrivateChat}
              className={`w-full py-3.5 rounded-full text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-md active:scale-[0.99] transition ${
                needsGiftForChat
                  ? 'bg-gradient-to-r from-[#190913] via-[#2B0C1F] to-[#190913] border border-amber-300/40 text-amber-200 hover:brightness-110'
                  : 'bg-zinc-900 text-white hover:bg-zinc-800'
              }`}
            >
              {needsGiftForChat ? (
                <Gift className="w-4 h-4 text-amber-300" />
              ) : (
                <MessageCircle className="w-4 h-4" />
              )}
              {busyAction === 'chat'
                ? 'Abriendo chat privado...'
                : needsGiftForChat
                ? `Enviar Regalo y Chatear con ${liveTarget.name}`
                : isChatFreeOrUnlocked
                ? `Enviar Mensaje a ${liveTarget.name}`
                : `Enviar Mensaje Privado a ${liveTarget.name}`}
              {!isChatFreeOrUnlocked && <Lock className="w-3.5 h-3.5 opacity-70" />}
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busyAction === 'like' || status.iLiked}
                onClick={handleLike}
                className={`py-2.5 rounded-full text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                  status.iLiked
                    ? 'bg-rose-50 text-[#FF2E54]'
                    : 'bg-gradient-to-r from-[#FF2E54] to-[#FF5E7E] text-white shadow-sm'
                }`}
              >
                <Heart className={`w-4 h-4 ${status.iLiked ? 'fill-[#FF2E54]' : 'fill-white'}`} />
                {status.iLiked ? 'Ya te gusta' : 'Dar Like'}
              </button>

              <button
                type="button"
                onClick={() => setGiftPickerOpen(true)}
                className="py-2.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-extrabold flex items-center justify-center gap-1.5 hover:bg-amber-100 transition"
              >
                <Gift className="w-4 h-4 text-amber-500" />
                Enviar Regalo
              </button>
            </div>
          </div>
        )}
      </div>

      <GiftPickerModal
        isOpen={giftPickerOpen}
        onClose={() => setGiftPickerOpen(false)}
        recipientName={liveTarget.name}
        userDiamonds={currentUser?.diamonds || 0}
        sendingGiftId={sendingGiftId}
        onSelectGift={handleSendGift}
        onOpenCoinStore={() => {
          onClose();
          onOpenCoinStore();
        }}
      />

      <GiftAnimationOverlay giftEvent={giftAnim} onComplete={() => setGiftAnim(null)} />
    </div>
  );
}
