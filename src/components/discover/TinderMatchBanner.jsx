import { useState } from 'react';
import { BadgeCheck, Flame, Heart, MessageCircle, Sparkles, Star, X } from 'lucide-react';
import { sendTextMessage } from '../../services/chatService';
import {
  buildMatchId,
  getPrimaryPhoto,
  getSharedInterests,
  isProfileVerified,
} from '../../utils/formatters';

/**
 * Franja estilo Tinder PRO ("¡HAN HECHO MATCH! · EMPAREJADOS") para superponer en tarjetas
 * cuando ambas personas se han dado corazón mutuamente.
 */
export function TinderMatchRibbon({
  isSuperMatch = false,
  variant = 'card', // 'card' | 'wide' | 'hero'
  className = '',
}) {
  const gradientClass = isSuperMatch
    ? 'from-sky-500 via-blue-600 to-amber-400 border-sky-200/60 shadow-[0_6px_22px_rgba(14,165,233,0.55)]'
    : 'from-[#FF1744] via-[#FF2E63] to-amber-500 border-white/40 shadow-[0_6px_22px_rgba(255,46,84,0.58)]';

  if (variant === 'wide') {
    return (
      <div
        className={`relative overflow-hidden rounded-xl bg-gradient-to-r ${gradientClass} border px-3 py-1.5 text-white flex items-center justify-center gap-1.5 ${className}`}
      >
        <div className="pointer-events-none absolute inset-0 pro-crown-sheen" />
        <span className="relative inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/20">
          {isSuperMatch ? (
            <Star className="w-2.5 h-2.5 fill-amber-200 text-amber-200" />
          ) : (
            <Heart className="w-2.5 h-2.5 fill-white text-white" />
          )}
        </span>
        <span className="relative font-display text-[10.5px] font-black italic uppercase tracking-[0.14em] drop-shadow-sm">
          {isSuperMatch ? '¡Super Match! · Emparejados' : '¡Han hecho Match! · Emparejados'}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-r ${gradientClass} border-y px-2.5 py-1 text-white flex items-center justify-center gap-1 ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 pro-crown-sheen" />
      <Flame className="relative w-3 h-3 fill-amber-200 text-amber-200 shrink-0" />
      <span className="relative font-display text-[9.5px] sm:text-[10px] font-black italic uppercase tracking-[0.12em] truncate drop-shadow-sm">
        {isSuperMatch ? '¡Super Match! · Emparejados' : '¡Han hecho Match!'}
      </span>
      <Heart className="relative w-2.5 h-2.5 fill-white text-white shrink-0" />
    </div>
  );
}

/**
 * Celebración de Match a pantalla completa estilo Tinder PRO con franja luminosa
 * "¡HAN HECHO MATCH! · EMPAREJADOS", doble retrato y rompehielos en 1 toque.
 */
export function TinderMatchOverlay({
  matchEvent, // { targetUser, matchId, isSuperLike }
  currentUser,
  onClose,
  onOpenChat,
  onStartChat,
  onError,
}) {
  const [sendingIcebreaker, setSendingIcebreaker] = useState(false);

  if (!matchEvent?.targetUser || !currentUser?.uid) return null;

  const target = matchEvent.targetUser;
  const targetUid = target.uid || target.id;
  const matchId = matchEvent.matchId || buildMatchId(currentUser.uid, targetUid);
  const isSuperMatch = Boolean(matchEvent.isSuperLike);
  const verified = isProfileVerified(target);
  const commonTags = getSharedInterests(currentUser, target);

  const icebreakers = [
    commonTags[0]
      ? `✨ ¡Hola ${target.name}! Vi que también te gusta ${commonTags[0]}`
      : `💘 ¡Hola ${target.name}! Qué gusto hacer Match contigo`,
    target.lookingFor === 'Estoy libre hoy'
      ? '🌙 ¿Qué planes te provocan para hoy?'
      : '☕ ¿Conversamos un rato para conocernos mejor?',
    '👋 ¡Hola! ¿Cómo va tu día?',
  ];

  const handleGoToChat = () => {
    onClose?.();
    if (onOpenChat && matchId) {
      onOpenChat({
        match: {
          id: matchId,
          participants: [currentUser.uid, targetUid].sort(),
        },
        peerUser: target,
      });
    } else {
      onStartChat?.(target, { skipLikeChatGate: true });
    }
  };

  const handleSendQuickIcebreaker = async (text) => {
    if (sendingIcebreaker) return;
    setSendingIcebreaker(true);
    try {
      await sendTextMessage({
        matchId,
        senderId: currentUser.uid,
        senderName: currentUser.name || 'Alguien',
        recipientId: targetUid,
        text,
      });
      handleGoToChat();
    } catch (err) {
      onError?.(err.message || 'No se pudo enviar el mensaje.');
    } finally {
      setSendingIcebreaker(false);
    }
  };

  return (
    <div
      onClick={() => !sendingIcebreaker && onClose?.()}
      className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: isSuperMatch
            ? 'radial-gradient(ellipse 90% 55% at 50% 0%, rgba(56,189,248,0.32), transparent 70%), linear-gradient(170deg, #091326 0%, #152244 48%, #0E091A 100%)'
            : 'radial-gradient(ellipse 90% 55% at 50% 0%, rgba(255,46,84,0.34), transparent 70%), linear-gradient(170deg, #1B0711 0%, #310B1F 48%, #12050B 100%)',
        }}
        className={`relative w-full max-w-sm rounded-[34px] border overflow-hidden p-6 text-center space-y-5 shadow-[0_28px_80px_-16px_rgba(255,46,84,0.45)] animate-profile-reveal ${
          isSuperMatch ? 'border-sky-300/45' : 'border-rose-300/35'
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white flex items-center justify-center transition"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Doble Retrato con Sello Central */}
        <div className="pt-2 flex items-center justify-center">
          <div className="relative flex items-center -space-x-4">
            <div className="p-[2.5px] rounded-full bg-gradient-to-tr from-[#FF2E54] via-rose-400 to-amber-300 shadow-xl -rotate-6">
              <img
                src={getPrimaryPhoto(currentUser, 240)}
                alt={currentUser.name}
                className="w-24 h-24 rounded-full object-cover border-2 border-[#1B0711]"
              />
            </div>

            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center z-10 border-2 border-[#1B0711] shadow-[0_0_24px_rgba(255,46,84,0.75)] ${
                isSuperMatch
                  ? 'bg-gradient-to-br from-sky-400 via-blue-500 to-amber-400'
                  : 'bg-gradient-to-br from-[#FF1744] via-[#FF2E63] to-amber-400'
              }`}
            >
              {isSuperMatch ? (
                <Star className="w-6 h-6 text-white fill-white" />
              ) : (
                <Heart className="w-6 h-6 text-white fill-white" />
              )}
            </div>

            <div className="p-[2.5px] rounded-full bg-gradient-to-tr from-amber-300 via-rose-400 to-[#FF2E54] shadow-xl rotate-6">
              <img
                src={getPrimaryPhoto(target, 240, { seed: currentUser.uid })}
                alt={target.name}
                className="w-24 h-24 rounded-full object-cover border-2 border-[#1B0711]"
              />
            </div>
          </div>
        </div>

        {/* FRANJA ESTILO TINDER PRO */}
        <div className="-mx-6">
          <div
            className={`relative overflow-hidden py-2.5 px-4 bg-gradient-to-r ${
              isSuperMatch
                ? 'from-sky-500 via-blue-600 to-amber-400'
                : 'from-[#FF1744] via-[#FF2E63] to-amber-500'
            } border-y border-white/35 shadow-[0_10px_30px_rgba(255,46,84,0.5)]`}
          >
            <div className="pointer-events-none absolute inset-0 pro-crown-sheen" />
            <div className="relative flex items-center justify-center gap-2 text-white">
              <Flame className="w-4 h-4 fill-amber-200 text-amber-200 shrink-0" />
              <span className="font-display text-sm sm:text-base font-black italic uppercase tracking-[0.16em] drop-shadow">
                {isSuperMatch ? '¡Super Match! · Emparejados' : '¡Han hecho Match! · Emparejados'}
              </span>
              <Sparkles className="w-4 h-4 text-amber-200 shrink-0" />
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <h3 className="font-editorial italic text-3xl font-bold text-white leading-tight flex items-center justify-center gap-1.5">
            <span>Tú y {target.name?.split(' ')[0]}</span>
            {verified && (
              <BadgeCheck className="w-5 h-5 text-sky-400 fill-sky-400 stroke-white shrink-0" />
            )}
          </h3>
          <p className="text-xs text-rose-100/85">
            Se dieron corazón mutuamente. ¡Ya están emparejados para conversar!
          </p>
        </div>

        {/* Rompehielos */}
        <div className="space-y-1.5 text-left">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-amber-200/90 text-center">
            Rompe el hielo con 1 toque
          </p>
          {icebreakers.map((msg) => (
            <button
              key={msg}
              type="button"
              disabled={sendingIcebreaker}
              onClick={() => handleSendQuickIcebreaker(msg)}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-semibold text-left transition active:scale-[0.99] disabled:opacity-50"
            >
              {msg}
            </button>
          ))}
        </div>

        {/* Botones principales */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="py-3 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-extrabold transition"
          >
            Seguir viendo
          </button>
          <button
            type="button"
            onClick={handleGoToChat}
            className="py-3 rounded-full bg-gradient-to-r from-[#FF2E54] via-rose-500 to-amber-500 text-white text-xs font-black shadow-lg hover:brightness-110 transition flex items-center justify-center gap-1.5"
          >
            <MessageCircle className="w-4 h-4" />
            Ir al Chat
          </button>
        </div>
      </div>
    </div>
  );
}
