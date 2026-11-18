import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  Check,
  CheckCheck,
  Crown,
  Flag,
  Gift,
  ImagePlus,
  Loader2,
  Lock,
  MoreVertical,
  Send,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import { REPORT_REASONS } from '../../config/constants';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';
import {
  markChatAsRead,
  sendImageMessage,
  sendTextMessage,
  sendVirtualGift,
  subscribeChatMessages,
} from '../../services/chatService';
import { getUserCloudinaryFolder, uploadImageToCloudinary } from '../../services/cloudinaryService';
import { blockUser, reportUser, subscribeUserById } from '../../services/userService';
import {
  formatMessageTime,
  formatRelativeLastSeen,
  getDisplayAge,
  getPrimaryPhoto,
  getSpendableDiamonds,
  isGiftChatUnlocked,
  isProActive,
  isProfileVerified,
  isUserActuallyOnline,
  optimizeCloudinaryUrl,
  toMillis,
} from '../../utils/formatters';
import GiftAnimationOverlay from './GiftAnimationOverlay';
import GiftMessageCard from './GiftMessageCard';
import GiftPickerModal from './GiftPickerModal';

export default function ChatRoom({
  match,
  peerUser,
  currentUser,
  onBack,
  onMarkRead,
  onOpenProfile,
  onOpenCoinStore,
  onSuccess,
  onError,
}) {
  const { economyConfig } = useAuth();
  const [livePeer, setLivePeer] = useState(peerUser);
  const [liveMatch, setLiveMatch] = useState(match);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [giftPickerOpen, setGiftPickerOpen] = useState(false);
  const [sendingGiftId, setSendingGiftId] = useState(null);
  const [activeGiftAnim, setActiveGiftAnim] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [showSafetyBar, setShowSafetyBar] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[2]);

  const bottomRef = useRef(null);
  const imageInputRef = useRef(null);
  const initializedRef = useRef(false);
  const seenIdsRef = useRef(new Set());
  const livePeerRef = useRef(livePeer);
  livePeerRef.current = livePeer;
  const onMarkReadRef = useRef(onMarkRead);
  onMarkReadRef.current = onMarkRead;

  const peerId =
    peerUser?.uid ||
    peerUser?.id ||
    (match?.participants || []).find((p) => p !== currentUser?.uid);

  const isParticipant = Boolean(
    currentUser?.uid &&
      match?.id &&
      ((Array.isArray(match.participants) && match.participants.includes(currentUser.uid)) ||
        match.id.split('_').includes(currentUser.uid))
  );

  useEffect(() => {
    setLivePeer(peerUser);
    setShowSafetyBar(false);
    if (!peerId) return;
    const unsub = subscribeUserById(peerId, (fresh) => {
      setLivePeer((prev) => ({ ...prev, ...fresh }));
    });
    return () => unsub();
  }, [peerId]);

  useEffect(() => {
    setLiveMatch(match);
    if (!match?.id || !isParticipant || !db) return;
    const unsub = onSnapshot(
      doc(db, 'matches', match.id),
      (snap) => {
        if (snap.exists()) {
          setLiveMatch({ id: snap.id, ...snap.data() });
        }
      },
      () => {}
    );
    return () => unsub();
  }, [match?.id, isParticipant]);

  useEffect(() => {
    if (!match?.id || !isParticipant) return;
    initializedRef.current = false;
    seenIdsRef.current = new Set();

    onMarkReadRef.current?.(match.id);
    markChatAsRead(match.id, currentUser.uid);

    const unsub = subscribeChatMessages(match.id, (list) => {
      if (!initializedRef.current) {
        list.forEach((m) => seenIdsRef.current.add(m.id));
        initializedRef.current = true;
      } else {
        for (const msg of list) {
          if (!seenIdsRef.current.has(msg.id)) {
            seenIdsRef.current.add(msg.id);
            if (msg.senderId !== currentUser.uid) {
              onMarkReadRef.current?.(match.id);
              markChatAsRead(match.id, currentUser.uid);
            }
            if (msg.type === 'gift' && msg.senderId !== currentUser.uid) {
              setActiveGiftAnim({
                giftIcon: msg.giftIcon,
                giftName: msg.giftName,
                giftValue: msg.giftValue,
                diamondsCredited: msg.diamondsCredited,
                senderName: msg.senderName || livePeerRef.current?.name,
                isReceiver: true,
              });
            }
          }
        }
      }
      setMessages(list);
    });

    return () => unsub();
  }, [match?.id, isParticipant, currentUser.uid]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (!isParticipant) {
    return (
      <div className="fixed inset-0 z-40 h-[100dvh] w-screen bg-[#FAF7F9] flex items-center justify-center p-6">
        <div className="bg-white border border-zinc-200 rounded-3xl p-6 max-w-sm text-center shadow-luxury space-y-3">
          <ShieldAlert className="w-10 h-10 text-[#FF2E54] mx-auto" />
          <h3 className="font-display text-base font-extrabold text-zinc-900">
            Conversación Privada Protegida
          </h3>
          <p className="text-xs text-zinc-500">
            No tienes acceso a este chat porque pertenece a otros perfiles.
          </p>
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 rounded-full bg-zinc-900 text-white text-xs font-extrabold"
          >
            Volver a mis chats
          </button>
        </div>
      </div>
    );
  }

  const sendQuickText = async (messageText) => {
    const clean = messageText.trim();
    if (!clean || sending) return;
    setSending(true);
    try {
      await sendTextMessage({
        matchId: match.id,
        senderId: currentUser.uid,
        text: clean,
      });
    } catch (err) {
      onError?.(err.message || 'No se pudo enviar el mensaje.');
    } finally {
      setSending(false);
    }
  };

  const handleSendText = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    const draft = text;
    setText('');
    setSending(true);
    try {
      await sendTextMessage({
        matchId: match.id,
        senderId: currentUser.uid,
        text: draft,
      });
    } catch (err) {
      setText(draft);
      onError?.(err.message || 'No se pudo enviar el mensaje.');
    } finally {
      setSending(false);
    }
  };

  const handleUploadImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingImage(true);
    try {
      const { url } = await uploadImageToCloudinary(file, {
        folder: getUserCloudinaryFolder(currentUser, 'chat'),
        tags: ['chat', `user_${currentUser.uid}`],
      });
      await sendImageMessage({
        matchId: match.id,
        senderId: currentUser.uid,
        imageUrl: url,
      });
    } catch (err) {
      onError?.(err.message || 'Error al enviar imagen.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSendGift = async (gift) => {
    setSendingGiftId(gift.id);
    try {
      const res = await sendVirtualGift({
        matchId: match.id,
        sender: currentUser,
        receiver: livePeer,
        gift,
        economyConfig,
      });
      setGiftPickerOpen(false);
      setActiveGiftAnim({
        giftIcon: gift.icon,
        giftName: gift.name,
        giftValue: gift.price,
        diamondsCredited: res.diamondsCredited ?? gift.price,
        isReceiver: false,
      });
      onSuccess?.(`${gift.icon} Enviaste ${gift.name} a ${livePeer?.name}`);
    } catch (err) {
      onError?.(err.message || 'No se pudo enviar el regalo.');
    } finally {
      setSendingGiftId(null);
    }
  };

  const handleBlockAndClose = async () => {
    if (!peerId) return;
    try {
      await blockUser(currentUser.uid, peerId);
      onSuccess?.(`Bloqueaste a ${livePeer?.name}.`);
      onBack();
    } catch (err) {
      onError?.(err.message || 'No se pudo bloquear.');
    }
  };

  const handleReportAndClose = async () => {
    if (!peerId) return;
    try {
      await reportUser({
        reporterId: currentUser.uid,
        reporterName: currentUser.name || '',
        reportedUserId: peerId,
        reportedUserName: livePeer?.name || '',
        reportedUserPhoto: getPrimaryPhoto(livePeer, 240),
        reason: reportReason,
      });
      await blockUser(currentUser.uid, peerId);
      onSuccess?.('Reporte guardado en tu historial y usuario bloqueado.');
      onBack();
    } catch (err) {
      onError?.(err.message || 'No se pudo enviar el reporte.');
    }
  };

  const online = isUserActuallyOnline(livePeer);
  const verified = isProfileVerified(livePeer);
  const viewerIsPro = isProActive(currentUser);
  const peerIsPro = isProActive(livePeer);
  const visibleAge = getDisplayAge(livePeer);
  const peerLastReadMs = Math.max(
    toMillis(liveMatch?.lastReadBy?.[peerId]),
    Number(liveMatch?.lastReadByClientMs?.[peerId] || 0)
  );

  const isBlockedEitherWay = Boolean(
    (Array.isArray(currentUser?.blockedUsers) && currentUser.blockedUsers.includes(peerId)) ||
      (Array.isArray(livePeer?.blockedUsers) && livePeer.blockedUsers.includes(currentUser?.uid))
  );

  const hasAlreadySentGiftOrPeerReplied = messages.some(
    (m) =>
      m.senderId === peerId ||
      (m.senderId === currentUser.uid && m.type === 'gift')
  );
  const isGiftRequiredLock = Boolean(
    !viewerIsPro &&
      livePeer?.requireGiftToChat &&
      !isGiftChatUnlocked(liveMatch, currentUser.uid, livePeer) &&
      !hasAlreadySentGiftOrPeerReplied
  );

  const icebreakers = [
    `👋 ¡Hola ${livePeer?.name?.split(' ')[0] || ''}! Qué gusto conectar contigo.`,
    `🌎 ¡Hola! ¿Qué tal todo por ${livePeer?.city || livePeer?.country?.name || 'tu ciudad'}?`,
    `☕ ¡Hola! Vi tu perfil y me encantaría conversar.`,
  ];

  return (
    <div className="fixed inset-0 z-40 h-[100dvh] w-screen overflow-hidden bg-[#FAF7F9] flex justify-center">
      <div className="w-full max-w-md h-full flex flex-col bg-[#FAF7F9] sm:border-x sm:border-zinc-200/80">
        {/* Chat Header */}
        <header className="px-3.5 py-3 pt-safe border-b border-zinc-200/80 bg-white flex items-center gap-2.5 shadow-sm z-10">
          <button
            type="button"
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-zinc-100 text-zinc-700 hover:bg-zinc-200 flex items-center justify-center transition shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => onOpenProfile?.(livePeer)}
            className="flex items-center gap-2.5 flex-1 min-w-0 text-left group"
          >
            <div className="relative shrink-0">
              <img
                src={getPrimaryPhoto(livePeer, 160, { seed: currentUser?.uid })}
                alt={livePeer?.name}
                className="w-10 h-10 rounded-full object-cover bg-zinc-100 border border-zinc-200 group-hover:scale-105 transition"
              />
              {online && (
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-display text-sm font-extrabold text-zinc-900 truncate flex items-center gap-1">
                <span className="truncate">
                  {livePeer?.name}
                  {visibleAge !== null ? `, ${visibleAge}` : ''}
                </span>
                {verified && (
                  <BadgeCheck className="w-4 h-4 text-sky-500 fill-sky-500 stroke-white shrink-0" />
                )}
                {peerIsPro && (
                  <span className="px-1.5 py-0.5 rounded-full bg-gradient-to-r from-[#FF2E54] to-amber-500 text-white text-[9px] font-black inline-flex items-center gap-0.5 shrink-0">
                    <Crown className="w-2.5 h-2.5" /> PRO
                  </span>
                )}
              </p>
              <p
                className={`text-[11px] truncate ${
                  online ? 'text-emerald-600 font-bold' : 'text-zinc-500 font-medium'
                }`}
              >
                {formatRelativeLastSeen(livePeer?.lastSeen, livePeer?.isOnline, {
                  hideOnlineStatus: livePeer?.hideOnlineStatus,
                })}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setGiftPickerOpen(true)}
            className="px-3 py-2 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-extrabold flex items-center gap-1 hover:bg-amber-100 transition shrink-0"
          >
            <Gift className="w-3.5 h-3.5 text-amber-500" />
            Regalo
          </button>

          <button
            type="button"
            onClick={() => setShowSafetyBar((v) => !v)}
            className="w-9 h-9 rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 flex items-center justify-center transition shrink-0"
            title="Opciones de seguridad"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </header>

        {/* Menú rápido de seguridad / bloqueo en chat */}
        {showSafetyBar && (
          <div className="px-4 py-3 bg-white border-b border-zinc-200 space-y-2 animate-sheet-up">
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-semibold text-zinc-800 focus:outline-none"
            >
              {REPORT_REASONS.map((r) => (
                <option key={r} value={r}>
                  Motivo de reporte: {r}
                </option>
              ))}
            </select>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleBlockAndClose}
                className="flex-1 py-2 rounded-full bg-zinc-100 text-zinc-700 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-zinc-200"
              >
                <Ban className="w-3.5 h-3.5" /> Bloquear
              </button>
              <button
                type="button"
                onClick={handleReportAndClose}
                className="flex-1 py-2 rounded-full bg-rose-50 text-[#FF2E54] text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-rose-100"
              >
                <Flag className="w-3.5 h-3.5" /> Reportar y bloquear
              </button>
            </div>
          </div>
        )}

        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-2">
          {/* End-to-End Privacy Notice */}
          <div className="flex justify-center mb-3">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-zinc-200/80 text-[11px] font-semibold text-zinc-500 shadow-sm">
              <Lock className="w-3 h-3 text-emerald-600 shrink-0" />
              <span>
                Chat privado entre <strong>{currentUser.name?.split(' ')[0]}</strong> y{' '}
                <strong>{livePeer?.name?.split(' ')[0]}</strong>
              </span>
            </div>
          </div>

          {/* Empty state / Icebreakers */}
          {messages.length === 0 && !isBlockedEitherWay && !isGiftRequiredLock && (
            <div className="my-5 p-5 rounded-3xl bg-white border border-zinc-200/80 shadow-card text-center space-y-3">
              <img
                src={getPrimaryPhoto(livePeer, 200)}
                alt={livePeer?.name}
                className="w-16 h-16 rounded-full object-cover mx-auto border-2 border-rose-100 shadow-sm"
              />
              <div>
                <p className="text-sm font-extrabold text-zinc-900">
                  Rompe el hielo con {livePeer?.name}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Toca una frase rápida o escribe tu mensaje abajo:
                </p>
              </div>
              <div className="space-y-1.5 pt-1">
                {icebreakers.map((phrase, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => sendQuickText(phrase)}
                    className="w-full py-2.5 px-3.5 rounded-2xl bg-zinc-50 hover:bg-rose-50 border border-zinc-200/80 hover:border-rose-200 text-xs font-bold text-zinc-800 hover:text-[#FF2E54] text-left flex items-center justify-between gap-2 transition"
                  >
                    <span className="truncate">{phrase}</span>
                    <Sparkles className="w-3.5 h-3.5 text-[#FF2E54] shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => {
            const isMine = msg.senderId === currentUser.uid;
            const timeLabel = formatMessageTime(msg.createdAt, msg.clientCreatedAt);
            const msgMs = toMillis(msg.createdAt) || Number(msg.clientCreatedAt || 0);
            const isReadByPeer = peerLastReadMs > 0 && msgMs > 0 && peerLastReadMs >= msgMs;

            if (msg.type === 'system') {
              return (
                <div key={msg.id} className="text-center my-2">
                  <span className="inline-block px-3.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-800">
                    {msg.text}
                  </span>
                </div>
              );
            }

            if (msg.type === 'gift') {
              return <GiftMessageCard key={msg.id} message={msg} isMine={isMine} />;
            }

            if (msg.type === 'image') {
              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  {!isMine && (
                    <img
                      src={getPrimaryPhoto(livePeer, 80)}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover shrink-0 mb-1 border border-zinc-200"
                    />
                  )}
                  <div
                    onClick={() => setPreviewImage(msg.imageUrl)}
                    className={`max-w-[75%] rounded-3xl overflow-hidden border p-1.5 shadow-sm cursor-pointer ${
                      isMine
                        ? 'bg-gradient-to-br from-[#FF2E54] to-[#FF5E7E] border-rose-300'
                        : 'bg-white border-zinc-200'
                    }`}
                  >
                    <img
                      src={optimizeCloudinaryUrl(msg.imageUrl, 900)}
                      alt="Imagen compartida"
                      loading="lazy"
                      className="rounded-2xl max-h-64 object-cover"
                    />
                    <div
                      className={`flex items-center justify-end gap-1 px-2 pt-1 text-[10px] ${
                        isMine ? 'text-white/85' : 'text-zinc-400'
                      }`}
                    >
                      <span>{timeLabel}</span>
                      {isMine &&
                        (isReadByPeer ? (
                          <CheckCheck className="w-3.5 h-3.5 text-sky-200" title="Visto" />
                        ) : (
                          <Check className="w-3 h-3 opacity-75" title="Enviado" />
                        ))}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                {!isMine && (
                  <img
                    src={getPrimaryPhoto(livePeer, 80)}
                    alt=""
                    className="w-7 h-7 rounded-full object-cover shrink-0 mb-1 border border-zinc-200"
                  />
                )}
                <div
                  className={`max-w-[78%] px-4 py-2.5 rounded-3xl text-sm leading-relaxed break-words shadow-sm ${
                    isMine
                      ? 'bg-gradient-to-r from-[#FF2E54] to-[#FF5E7E] text-white rounded-br-md'
                      : 'bg-white border border-zinc-200/80 text-zinc-900 rounded-bl-md'
                  }`}
                >
                  <p className="font-medium">{msg.text}</p>
                  <div
                    className={`flex items-center justify-end gap-1 mt-0.5 text-[10px] ${
                      isMine ? 'text-white/80' : 'text-zinc-400'
                    }`}
                  >
                    <span>{timeLabel}</span>
                    {isMine &&
                      (isReadByPeer ? (
                        <CheckCheck className="w-3.5 h-3.5 text-sky-200" title="Visto" />
                      ) : (
                        <Check className="w-3 h-3 opacity-75" title="Enviado" />
                      ))}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input Toolbar (o bloqueo por seguridad / modo regalo obligatorio) */}
        {isBlockedEitherWay ? (
          <div className="p-4 pb-safe border-t border-zinc-200/80 bg-white text-center text-xs font-bold text-zinc-500">
            🔒 Esta conversación no admite nuevos mensajes porque existe un bloqueo activo.
          </div>
        ) : isGiftRequiredLock ? (
          <div className="p-3.5 pb-safe border-t border-amber-200/80 bg-gradient-to-r from-[#190913] to-[#280C1E] text-white flex items-center justify-between gap-3">
            <div className="min-w-0 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-amber-400/20 border border-amber-300/40 text-amber-300 flex items-center justify-center shrink-0">
                <Crown className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-white truncate">
                  Chat exclusivo con regalo
                </p>
                <p className="text-[11px] text-rose-100/80 truncate">
                  Envía cualquier regalo (desde 10 💎) para escribirle.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setGiftPickerOpen(true)}
              className="px-4 py-2.5 rounded-full bg-gradient-to-r from-amber-300 to-amber-500 text-zinc-950 text-xs font-black shrink-0 shadow hover:brightness-105 transition flex items-center gap-1.5"
            >
              <Gift className="w-3.5 h-3.5" />
              Regalar
            </button>
          </div>
        ) : (
        <form
          onSubmit={handleSendText}
          className="p-3 pb-safe border-t border-zinc-200/80 bg-white flex items-center gap-2"
        >
          <button
            type="button"
            disabled={uploadingImage}
            onClick={() => imageInputRef.current?.click()}
            className="w-10 h-10 rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 disabled:opacity-50 flex items-center justify-center transition shrink-0"
            title="Enviar foto"
          >
            {uploadingImage ? (
              <Loader2 className="w-5 h-5 animate-spin text-[#FF2E54]" />
            ) : (
              <ImagePlus className="w-5 h-5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setGiftPickerOpen(true)}
            className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 text-amber-600 hover:bg-amber-100 flex items-center justify-center transition shrink-0"
            title="Enviar Regalo"
          >
            <Gift className="w-5 h-5" />
          </button>

          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Mensaje para ${livePeer?.name?.split(' ')[0] || ''}...`}
            className="flex-1 px-4 py-2.5 rounded-full bg-zinc-100 border border-zinc-200/70 text-sm text-zinc-900 placeholder:text-zinc-400 font-medium focus:outline-none focus:bg-white focus:border-zinc-900 transition"
          />

          <button
            type="submit"
            disabled={!text.trim() || sending}
            className="w-10 h-10 rounded-full bg-gradient-to-r from-[#FF2E54] to-[#FF5E7E] text-white shadow-md hover:brightness-105 disabled:opacity-40 flex items-center justify-center transition shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={handleUploadImage}
            className="hidden"
          />
        </form>
        )}
      </div>

      {/* Lightbox para ver foto enviada en pantalla completa */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4"
        >
          <button
            type="button"
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 p-2.5 rounded-full bg-white/15 text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={optimizeCloudinaryUrl(previewImage, 1400)}
            alt="Vista ampliada"
            className="max-w-full max-h-[85dvh] rounded-2xl object-contain"
          />
        </div>
      )}

      <GiftPickerModal
        isOpen={giftPickerOpen}
        onClose={() => setGiftPickerOpen(false)}
        recipientName={livePeer?.name}
        userDiamonds={getSpendableDiamonds(currentUser)}
        sendingGiftId={sendingGiftId}
        onSelectGift={handleSendGift}
        onOpenCoinStore={onOpenCoinStore}
      />

      <GiftAnimationOverlay
        giftEvent={activeGiftAnim}
        onComplete={() => setActiveGiftAnim(null)}
      />
    </div>
  );
}
