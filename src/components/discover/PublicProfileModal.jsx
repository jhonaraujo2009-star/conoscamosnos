import { useEffect, useState } from 'react';
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Flag,
  Flame,
  Gift,
  Heart,
  Lock,
  MapPin,
  MessageCircle,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { REPORT_REASONS, VIP_DM_COST } from '../../config/constants';
import { sendVirtualGift } from '../../services/chatService';
import {
  checkConnectionStatus,
  sendLike,
  startVipDirectMessage,
} from '../../services/discoveryService';
import { blockUser, reportUser, subscribeUserById } from '../../services/userService';
import {
  formatRelativeLastSeen,
  getPrimaryPhoto,
  getSharedInterests,
  isBoostActive,
  isUserActuallyOnline,
  optimizeCloudinaryUrl,
} from '../../utils/formatters';
import GiftPickerModal from '../chat/GiftPickerModal';
import GiftAnimationOverlay from '../chat/GiftAnimationOverlay';

export default function PublicProfileModal({
  targetUser,
  currentUser,
  onClose,
  onStartChat,
  onOpenChat,
  onOpenCoinStore,
  onSuccess,
  onError,
}) {
  const [liveTarget, setLiveTarget] = useState(targetUser);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [status, setStatus] = useState({ iLiked: false, isMatched: false, matchId: null });
  const [busyAction, setBusyAction] = useState('');
  const [giftPickerOpen, setGiftPickerOpen] = useState(false);
  const [sendingGiftId, setSendingGiftId] = useState(null);
  const [giftAnim, setGiftAnim] = useState(null);
  const [showSafetyMenu, setShowSafetyMenu] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);

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

  const photos =
    Array.isArray(liveTarget.photos) && liveTarget.photos.length > 0
      ? liveTarget.photos
      : [getPrimaryPhoto(liveTarget)];

  const online = isUserActuallyOnline(liveTarget);
  const boosted = isBoostActive(liveTarget);
  const sharedInterests = getSharedInterests(currentUser, liveTarget);
  const sharedSet = new Set(sharedInterests);

  const handleLike = async () => {
    if (status.iLiked || isSelf) return;
    setBusyAction('like');
    try {
      const res = await sendLike({ currentUser, targetUser: liveTarget });
      setStatus({ iLiked: true, isMatched: res.matched, matchId: res.matchId });
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

  const handleVipDm = async () => {
    if (isSelf) return;
    if (!status.isMatched && (currentUser?.coins || 0) < VIP_DM_COST) {
      onError?.(`Necesitas ${VIP_DM_COST} monedas para un Mensaje Directo VIP.`);
      onOpenCoinStore();
      return;
    }

    setBusyAction('dm');
    try {
      const res = await startVipDirectMessage({ currentUser, targetUser: liveTarget });
      onClose();
      onOpenChat({ match: res.matchData, peerUser: liveTarget });
    } catch (err) {
      onError?.(err.message || 'No se pudo iniciar el Mensaje Directo VIP.');
    } finally {
      setBusyAction('');
    }
  };

  const handleSendGift = async (gift) => {
    setSendingGiftId(gift.id);
    try {
      await sendVirtualGift({
        sender: currentUser,
        receiver: liveTarget,
        gift,
      });
      setGiftPickerOpen(false);
      setGiftAnim({
        giftIcon: gift.icon,
        giftName: gift.name,
        giftValue: gift.price,
        diamondsCredited: gift.price,
        isReceiver: false,
      });
      onSuccess?.(`${gift.icon} ¡Regalo ${gift.name} enviado a ${liveTarget.name}!`);
    } catch (err) {
      onError?.(err.message || 'Error al enviar regalo.');
    } finally {
      setSendingGiftId(null);
    }
  };

  const handleBlock = async () => {
    try {
      await blockUser(currentUser.uid, targetId);
      onSuccess?.(`Bloqueaste a ${liveTarget.name}.`);
      onClose();
    } catch (err) {
      onError?.(err.message || 'No se pudo bloquear.');
    }
  };

  const handleReport = async () => {
    try {
      await reportUser({
        reporterId: currentUser.uid,
        reportedUserId: targetId,
        reason: reportReason,
      });
      await blockUser(currentUser.uid, targetId);
      onSuccess?.('Reporte enviado y usuario bloqueado.');
      onClose();
    } catch (err) {
      onError?.(err.message || 'No se pudo enviar el reporte.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md max-h-[94vh] bg-white border border-rose-100 rounded-t-[32px] sm:rounded-[32px] flex flex-col overflow-hidden shadow-luxury">
        {/* Photo Carousel */}
        <div className="relative h-80 sm:h-96 bg-slate-100 shrink-0">
          <img
            src={optimizeCloudinaryUrl(photos[photoIdx] || getPrimaryPhoto(liveTarget), 1080)}
            alt={liveTarget.name}
            className="w-full h-full object-cover"
          />

          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent pointer-events-none" />

          {/* Story Indicators */}
          {photos.length > 1 && (
            <div className="absolute top-3 inset-x-4 flex gap-1.5">
              {photos.map((_, idx) => (
                <div
                  key={idx}
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
                className="p-2 rounded-full bg-white/85 backdrop-blur-md text-slate-700 hover:bg-white shadow-sm transition"
                title="Reportar o bloquear"
              >
                <Flag className="w-4 h-4" />
              </button>
            ) : (
              <span className="px-3 py-1 rounded-full bg-white/90 backdrop-blur-md text-xs font-extrabold text-brand-600 shadow-sm">
                Vista previa de tu perfil
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-white/85 backdrop-blur-md text-slate-800 hover:bg-white shadow-sm transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setPhotoIdx((i) => (i - 1 + photos.length) % photos.length)}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/80 backdrop-blur-md text-slate-800 shadow hover:bg-white"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setPhotoIdx((i) => (i + 1) % photos.length)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/80 backdrop-blur-md text-slate-800 shadow hover:bg-white"
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
                  {liveTarget.age ? `, ${liveTarget.age}` : ''}
                </h2>
                {boosted && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-extrabold flex items-center gap-0.5 shadow">
                    <Zap className="w-3 h-3 fill-slate-950" /> VIP
                  </span>
                )}
              </div>
              <p className="text-xs text-white/90 flex items-center gap-1.5 mt-0.5 font-medium">
                <span>{liveTarget.country?.flag}</span>
                <MapPin className="w-3.5 h-3.5 text-rose-300" />
                <span>
                  {liveTarget.city ? `${liveTarget.city}, ` : ''}
                  {liveTarget.country?.name || 'Global'}
                </span>
              </p>
            </div>

            <span
              className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold flex items-center gap-1.5 backdrop-blur-md shadow-sm ${
                online
                  ? 'bg-emerald-500/90 text-white'
                  : 'bg-white/90 text-slate-700'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${online ? 'bg-white animate-pulse' : 'bg-slate-400'}`}
              />
              {online ? 'En línea' : formatRelativeLastSeen(liveTarget.lastSeen, false)}
            </span>
          </div>
        </div>

        {/* Scrollable Profile Details */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FAF7F5]">
          {showSafetyMenu && !isSelf && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-2.5">
              <p className="text-xs font-extrabold text-rose-800">Seguridad y Moderación</p>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-rose-200 text-xs text-slate-800 font-medium"
              >
                {REPORT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleBlock}
                  className="py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1 hover:bg-slate-100"
                >
                  <Ban className="w-3.5 h-3.5" /> Solo Bloquear
                </button>
                <button
                  type="button"
                  onClick={handleReport}
                  className="py-2 rounded-xl bg-rose-600 text-white text-xs font-bold flex items-center justify-center gap-1 hover:bg-rose-700"
                >
                  <Flag className="w-3.5 h-3.5" /> Reportar y Bloquear
                </button>
              </div>
            </div>
          )}

          {/* Photo Thumbnail Strip if multiple photos */}
          {photos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {photos.map((url, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPhotoIdx(idx)}
                  className={`w-14 h-14 rounded-2xl overflow-hidden border-2 shrink-0 transition ${
                    photoIdx === idx ? 'border-brand-500 scale-105 shadow-sm' : 'border-white opacity-70'
                  }`}
                >
                  <img src={optimizeCloudinaryUrl(url, 200)} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Popularity Counters + Intention */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-white border border-rose-100/80 shadow-card text-center">
              <p className="text-base font-extrabold text-rose-500 flex items-center justify-center gap-1">
                <Flame className="w-4 h-4 fill-rose-500" /> {liveTarget.likesCount || 0}
              </p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mt-0.5">Me gusta</p>
            </div>
            <div className="p-3 rounded-2xl bg-white border border-amber-100/80 shadow-card text-center">
              <p className="text-base font-extrabold text-amber-600 flex items-center justify-center gap-1">
                <Gift className="w-4 h-4" /> {liveTarget.giftsReceivedCount || 0}
              </p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mt-0.5">Regalos</p>
            </div>
            <div className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-card text-center flex flex-col justify-center">
              <p className="text-xs font-extrabold text-brand-600 truncate">
                {liveTarget.lookingFor || 'Conectar'}
              </p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mt-0.5">Intención</p>
            </div>
          </div>

          {/* Bio */}
          {liveTarget.bio && (
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-card">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                Sobre {liveTarget.name}
              </p>
              <p className="text-sm text-slate-700 leading-relaxed font-medium">{liveTarget.bio}</p>
            </div>
          )}

          {/* Shared & All Interests */}
          {Array.isArray(liveTarget.interests) && liveTarget.interests.length > 0 && (
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-card">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  Intereses y Hobbies
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
                      className={`px-3 py-1 rounded-full text-xs font-bold border ${
                        isCommon
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-slate-50 border-slate-200/80 text-slate-700'
                      }`}
                    >
                      {isCommon ? `✨ ${interest}` : interest}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons Footer */}
        {!isSelf && (
          <div className="p-3.5 pb-safe border-t border-rose-100 bg-white space-y-2">
            {/* Primary Action: Free Private 1-to-1 Chat */}
            <button
              type="button"
              disabled={busyAction === 'chat'}
              onClick={handleOpenPrivateChat}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-brand-500 via-rose-500 to-pink-500 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-brand-500/25 hover:brightness-105 active:scale-[0.99] transition"
            >
              <MessageCircle className="w-4 h-4 fill-white/20" />
              {busyAction === 'chat'
                ? 'Abriendo chat privado...'
                : `Chatear en Privado con ${liveTarget.name}`}
              <Lock className="w-3.5 h-3.5 opacity-80" />
            </button>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={busyAction === 'like' || status.iLiked}
                onClick={handleLike}
                className={`py-2.5 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-1.5 border transition ${
                  status.iLiked
                    ? 'bg-rose-50 border-rose-200 text-rose-600'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200'
                }`}
              >
                <Heart className={`w-4 h-4 ${status.iLiked ? 'fill-rose-500 text-rose-500' : 'text-rose-500'}`} />
                {status.iLiked ? 'Te gusta' : 'Like'}
              </button>

              <button
                type="button"
                onClick={() => setGiftPickerOpen(true)}
                className="py-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-extrabold flex items-center justify-center gap-1.5 hover:bg-amber-100 transition"
              >
                <Gift className="w-4 h-4 text-amber-500" />
                Regalo
              </button>

              <button
                type="button"
                disabled={busyAction === 'dm'}
                onClick={handleVipDm}
                className="py-2.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-extrabold flex items-center justify-center gap-1 hover:bg-indigo-100 transition"
                title={`Toque VIP Destacado (${VIP_DM_COST} monedas)`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                VIP ({VIP_DM_COST})
              </button>
            </div>
          </div>
        )}
      </div>

      <GiftPickerModal
        isOpen={giftPickerOpen}
        onClose={() => setGiftPickerOpen(false)}
        recipientName={liveTarget.name}
        userCoins={currentUser?.coins || 0}
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
