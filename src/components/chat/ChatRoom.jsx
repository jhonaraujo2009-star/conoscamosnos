import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Gift, ImagePlus, Loader2, Send } from 'lucide-react';
import {
  sendImageMessage,
  sendTextMessage,
  sendVirtualGift,
  subscribeChatMessages,
} from '../../services/chatService';
import { getUserCloudinaryFolder, uploadImageToCloudinary } from '../../services/cloudinaryService';
import {
  formatRelativeLastSeen,
  getPrimaryPhoto,
  isUserActuallyOnline,
  optimizeCloudinaryUrl,
} from '../../utils/formatters';
import GiftMessageCard from './GiftMessageCard';
import GiftPickerModal from './GiftPickerModal';
import GiftAnimationOverlay from './GiftAnimationOverlay';

export default function ChatRoom({
  match,
  peerUser,
  currentUser,
  onBack,
  onOpenProfile,
  onOpenCoinStore,
  onSuccess,
  onError,
}) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [giftPickerOpen, setGiftPickerOpen] = useState(false);
  const [sendingGiftId, setSendingGiftId] = useState(null);
  const [activeGiftAnim, setActiveGiftAnim] = useState(null);

  const bottomRef = useRef(null);
  const imageInputRef = useRef(null);
  const initializedRef = useRef(false);
  const seenIdsRef = useRef(new Set());

  useEffect(() => {
    if (!match?.id) return;
    initializedRef.current = false;
    seenIdsRef.current = new Set();

    const unsub = subscribeChatMessages(match.id, (list) => {
      if (!initializedRef.current) {
        list.forEach((m) => seenIdsRef.current.add(m.id));
        initializedRef.current = true;
      } else {
        for (const msg of list) {
          if (!seenIdsRef.current.has(msg.id)) {
            seenIdsRef.current.add(msg.id);
            if (msg.type === 'gift' && msg.senderId !== currentUser.uid) {
              setActiveGiftAnim({
                giftIcon: msg.giftIcon,
                giftName: msg.giftName,
                giftValue: msg.giftValue,
                diamondsCredited: msg.diamondsCredited,
                senderName: msg.senderName || peerUser?.name,
                isReceiver: true,
              });
            }
          }
        }
      }
      setMessages(list);
    });

    return () => unsub();
  }, [match?.id, currentUser.uid, peerUser?.name]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

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
      await sendVirtualGift({
        matchId: match.id,
        sender: currentUser,
        receiver: peerUser,
        gift,
      });
      setGiftPickerOpen(false);
      setActiveGiftAnim({
        giftIcon: gift.icon,
        giftName: gift.name,
        giftValue: gift.price,
        diamondsCredited: gift.price,
        isReceiver: false,
      });
      onSuccess?.(`${gift.icon} Enviaste ${gift.name} a ${peerUser.name}`);
    } catch (err) {
      onError?.(err.message || 'No se pudo enviar el regalo.');
    } finally {
      setSendingGiftId(null);
    }
  };

  const online = isUserActuallyOnline(peerUser);

  return (
    <div className="fixed inset-0 z-40 bg-slate-950 flex justify-center">
      <div className="w-full max-w-md h-full flex flex-col bg-[#090d16] sm:border-x sm:border-slate-800">
        {/* Chat Header */}
        <div className="px-3.5 py-3 pt-safe border-b border-slate-800 bg-slate-950/90 backdrop-blur-xl flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-900 text-slate-300 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => onOpenProfile?.(peerUser)}
            className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
          >
            <div className="relative shrink-0">
              <img
                src={getPrimaryPhoto(peerUser)}
                alt={peerUser?.name}
                className="w-10 h-10 rounded-full object-cover bg-slate-800"
              />
              {online && (
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-950" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">
                {peerUser?.country?.flag} {peerUser?.name}
              </p>
              <p className={`text-[11px] truncate ${online ? 'text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                {formatRelativeLastSeen(peerUser?.lastSeen, peerUser?.isOnline)}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setGiftPickerOpen(true)}
            className="px-3 py-2 rounded-xl bg-gradient-to-r from-brand-500 to-amber-500 text-white text-xs font-extrabold flex items-center gap-1 shadow shadow-brand-500/25 hover:brightness-110"
          >
            <Gift className="w-4 h-4" />
            Regalo
          </button>
        </div>

        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-2">
          {messages.map((msg) => {
            const isMine = msg.senderId === currentUser.uid;

            if (msg.type === 'system') {
              return (
                <div key={msg.id} className="text-center my-2">
                  <span className="inline-block px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-amber-300">
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
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl overflow-hidden border p-1 ${
                      isMine
                        ? 'bg-brand-600/30 border-brand-500/50'
                        : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    <img
                      src={optimizeCloudinaryUrl(msg.imageUrl, 900)}
                      alt="Imagen compartida"
                      loading="lazy"
                      className="rounded-xl max-h-64 object-cover"
                    />
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
                    isMine
                      ? 'bg-gradient-to-r from-brand-500 to-pink-500 text-white rounded-br-sm'
                      : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-bl-sm'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input Toolbar */}
        <form
          onSubmit={handleSendText}
          className="p-2.5 pb-safe border-t border-slate-800 bg-slate-950/95 flex items-center gap-2"
        >
          <button
            type="button"
            disabled={uploadingImage}
            onClick={() => imageInputRef.current?.click()}
            className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-50"
            title="Enviar imagen"
          >
            {uploadingImage ? (
              <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
            ) : (
              <ImagePlus className="w-5 h-5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setGiftPickerOpen(true)}
            className="p-2.5 rounded-2xl bg-amber-500/15 border border-amber-400/40 text-amber-300 hover:bg-amber-500/25"
            title="Enviar Regalo"
          >
            <Gift className="w-5 h-5" />
          </button>

          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribe un mensaje..."
            className="flex-1 px-3.5 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-sm focus:outline-none focus:border-brand-500"
          />

          <button
            type="submit"
            disabled={!text.trim() || sending}
            className="p-2.5 rounded-2xl bg-brand-500 text-white hover:bg-brand-400 disabled:opacity-40 transition"
          >
            <Send className="w-5 h-5" />
          </button>

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={handleUploadImage}
            className="hidden"
          />
        </form>
      </div>

      <GiftPickerModal
        isOpen={giftPickerOpen}
        onClose={() => setGiftPickerOpen(false)}
        recipientName={peerUser?.name}
        userCoins={currentUser?.coins || 0}
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
