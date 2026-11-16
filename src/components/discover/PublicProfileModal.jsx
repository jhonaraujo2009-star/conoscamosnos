import { useEffect, useState } from 'react';
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Flag,
  Flame,
  Gift,
  Heart,
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
import { blockUser, reportUser } from '../../services/userService';
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
  onOpenChat,
  onOpenCoinStore,
  onSuccess,
  onError,
}) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const [status, setStatus] = useState({ iLiked: false, isMatched: false, matchId: null });
  const [likesCount, setLikesCount] = useState(0);
  const [giftsCount, setGiftsCount] = useState(0);
  const [busyAction, setBusyAction] = useState('');
  const [giftPickerOpen, setGiftPickerOpen] = useState(false);
  const [sendingGiftId, setSendingGiftId] = useState(null);
  const [giftAnim, setGiftAnim] = useState(null);
  const [showSafetyMenu, setShowSafetyMenu] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);

  useEffect(() => {
    if (!targetUser) return;
    setPhotoIdx(0);
    setLikesCount(targetUser.likesCount || 0);
    setGiftsCount(targetUser.giftsReceivedCount || 0);
    setShowSafetyMenu(false);

    if (currentUser?.uid && targetUser.uid !== currentUser.uid) {
      checkConnectionStatus(currentUser.uid, targetUser.uid || targetUser.id)
        .then(setStatus)
        .catch(() => {});
    }
  }, [targetUser, currentUser?.uid]);

  if (!targetUser) return null;

  const photos =
    Array.isArray(targetUser.photos) && targetUser.photos.length > 0
      ? targetUser.photos
      : [getPrimaryPhoto(targetUser)];

  const online = isUserActuallyOnline(targetUser);
  const boosted = isBoostActive(targetUser);
  const sharedInterests = getSharedInterests(currentUser, targetUser);
  const sharedSet = new Set(sharedInterests);

  const handleLike = async () => {
    if (status.iLiked) return;
    setBusyAction('like');
    try {
      const res = await sendLike({ currentUser, targetUser });
      setStatus({ iLiked: true, isMatched: res.matched, matchId: res.matchId });
      if (!res.alreadyLiked) {
        setLikesCount((c) => c + 1);
      }
      if (res.matched) {
        onSuccess?.(`🎉 ¡Es un Match con ${targetUser.name}! Ya pueden chatear.`);
      } else {
        onSuccess?.(`🔥 Le diste Like a ${targetUser.name}.`);
      }
    } catch (err) {
      onError?.(err.message || 'No se pudo enviar el Like.');
    } finally {
      setBusyAction('');
    }
  };

  const handleVipDm = async () => {
    if (!status.isMatched && (currentUser?.coins || 0) < VIP_DM_COST) {
      onError?.(`Necesitas ${VIP_DM_COST} monedas para Mensaje Directo VIP.`);
      onOpenCoinStore();
      return;
    }

    setBusyAction('dm');
    try {
      const res = await startVipDirectMessage({ currentUser, targetUser });
      onClose();
      onOpenChat({ match: res.matchData, peerUser: targetUser });
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
        receiver: targetUser,
        gift,
      });
      setGiftsCount((c) => c + 1);
      setGiftPickerOpen(false);
      setGiftAnim({
        giftIcon: gift.icon,
        giftName: gift.name,
        giftValue: gift.price,
        diamondsCredited: gift.price,
        isReceiver: false,
      });
      onSuccess?.(`${gift.icon} ¡Regalo ${gift.name} enviado a ${targetUser.name}!`);
    } catch (err) {
      onError?.(err.message || 'Error al enviar regalo.');
    } finally {
      setSendingGiftId(null);
    }
  };

  const handleBlock = async () => {
    try {
      await blockUser(currentUser.uid, targetUser.uid || targetUser.id);
      onSuccess?.(`Bloqueaste a ${targetUser.name}.`);
      onClose();
    } catch (err) {
      onError?.(err.message || 'No se pudo bloquear.');
    }
  };

  const handleReport = async () => {
    try {
      await reportUser({
        reporterId: currentUser.uid,
        reportedUserId: targetUser.uid || targetUser.id,
        reason: reportReason,
      });
      await blockUser(currentUser.uid, targetUser.uid || targetUser.id);
      onSuccess?.('Reporte enviado y usuario bloqueado.');
      onClose();
    } catch (err) {
      onError?.(err.message || 'No se pudo enviar el reporte.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md max-h-[94vh] bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl">
        {/* Photo Carousel */}
        <div className="relative h-80 sm:h-96 bg-slate-950 shrink-0">
          <img
            src={optimizeCloudinaryUrl(photos[photoIdx], 1080)}
            alt={targetUser.name}
            className="w-full h-full object-cover"
          />

          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent pointer-events-none" />

          {/* Story Indicators */}
          {photos.length > 1 && (
            <div className="absolute top-3 inset-x-4 flex gap-1.5">
              {photos.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1 flex-1 rounded-full transition ${
                    idx === photoIdx ? 'bg-white' : 'bg-white/30'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Top Controls */}
          <div className="absolute top-6 inset-x-3.5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowSafetyMenu((s) => !s)}
              className="p-2 rounded-full bg-black/50 text-slate-200 hover:bg-black/75"
              title="Reportar o bloquear"
            >
              <Flag className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-black/50 text-white hover:bg-black/75"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setPhotoIdx((i) => (i - 1 + photos.length) % photos.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 text-white"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setPhotoIdx((i) => (i + 1) % photos.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 text-white"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Name & Online Overlay */}
          <div className="absolute bottom-3 inset-x-4 flex items-end justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-extrabold text-white">
                  {targetUser.name}, {targetUser.age}
                </h2>
                {boosted && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-extrabold flex items-center gap-0.5">
                    <Zap className="w-3 h-3 fill-slate-950" /> VIP
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-200 flex items-center gap-1.5 mt-0.5">
                <span>{targetUser.country?.flag}</span>
                <MapPin className="w-3.5 h-3.5 text-brand-400" />
                <span>
                  {targetUser.city ? `${targetUser.city}, ` : ''}
                  {targetUser.country?.name}
                </span>
              </p>
            </div>

            <span
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 backdrop-blur-md ${
                online
                  ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/50'
                  : 'bg-slate-900/80 text-slate-300 border border-slate-700'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${online ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}
              />
              {online ? 'En línea' : formatRelativeLastSeen(targetUser.lastSeen, false)}
            </span>
          </div>
        </div>

        {/* Scrollable Profile Details */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {showSafetyMenu && (
            <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/40 space-y-2.5">
              <p className="text-xs font-bold text-rose-200">Seguridad y Moderación</p>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
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
                  className="py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold flex items-center justify-center gap-1"
                >
                  <Ban className="w-3.5 h-3.5" /> Solo Bloquear
                </button>
                <button
                  type="button"
                  onClick={handleReport}
                  className="py-2 rounded-xl bg-rose-600 text-white text-xs font-bold flex items-center justify-center gap-1"
                >
                  <Flag className="w-3.5 h-3.5" /> Reportar y Bloquear
                </button>
              </div>
            </div>
          )}

          {/* Popularity Counters + Intention */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-center">
              <p className="text-base font-extrabold text-rose-400 flex items-center justify-center gap-1">
                <Flame className="w-4 h-4" /> {likesCount}
              </p>
              <p className="text-[10px] text-slate-400 font-semibold">Me gusta</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-center">
              <p className="text-base font-extrabold text-amber-300 flex items-center justify-center gap-1">
                <Gift className="w-4 h-4" /> {giftsCount}
              </p>
              <p className="text-[10px] text-slate-400 font-semibold">Regalos</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-center flex flex-col justify-center">
              <p className="text-xs font-bold text-brand-300 truncate">{targetUser.lookingFor}</p>
              <p className="text-[10px] text-slate-400 font-semibold">Intención</p>
            </div>
          </div>

          {/* Bio */}
          {targetUser.bio && (
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Sobre {targetUser.name}
              </p>
              <p className="text-sm text-slate-200 leading-relaxed">{targetUser.bio}</p>
            </div>
          )}

          {/* Shared & All Interests */}
          {Array.isArray(targetUser.interests) && targetUser.interests.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Intereses y Hobbies
                </p>
                {sharedInterests.length > 0 && (
                  <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> {sharedInterests.length} en común
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {targetUser.interests.map((interest) => {
                  const isCommon = sharedSet.has(interest);
                  return (
                    <span
                      key={interest}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                        isCommon
                          ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                          : 'bg-slate-950 border-slate-800 text-slate-300'
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
        <div className="p-3.5 pb-safe border-t border-slate-800 bg-slate-950/95 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busyAction === 'like' || status.iLiked}
              onClick={handleLike}
              className={`py-3 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                status.iLiked
                  ? 'bg-rose-500/20 border border-rose-500/40 text-rose-200'
                  : 'bg-gradient-to-r from-brand-500 to-pink-500 text-white shadow-lg shadow-brand-500/20 hover:brightness-110'
              }`}
            >
              <Heart className={`w-4 h-4 ${status.iLiked ? 'fill-rose-400' : ''}`} />
              {status.iLiked ? 'Ya te gusta' : busyAction === 'like' ? 'Enviando...' : 'Dar Like'}
            </button>

            <button
              type="button"
              onClick={() => setGiftPickerOpen(true)}
              className="py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1.5 hover:brightness-110 transition"
            >
              <Gift className="w-4 h-4" />
              Enviar Regalo
            </button>
          </div>

          <button
            type="button"
            disabled={busyAction === 'dm'}
            onClick={handleVipDm}
            className="w-full py-3 rounded-2xl bg-indigo-600/90 hover:bg-indigo-500 text-white text-xs font-extrabold flex items-center justify-center gap-2 transition"
          >
            {status.isMatched ? (
              <>
                <MessageCircle className="w-4 h-4" />
                Abrir Chat Directo (Match)
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                {busyAction === 'dm'
                  ? 'Abriendo chat...'
                  : `Mensaje Directo VIP (${VIP_DM_COST} monedas)`}
              </>
            )}
          </button>
        </div>
      </div>

      <GiftPickerModal
        isOpen={giftPickerOpen}
        onClose={() => setGiftPickerOpen(false)}
        recipientName={targetUser.name}
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
