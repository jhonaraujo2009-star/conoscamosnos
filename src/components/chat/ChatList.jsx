import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgeCheck,
  CheckCheck,
  Crown,
  Flame,
  Gem,
  Loader2,
  MessageCircleHeart,
  MoreVertical,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { getUserById } from '../../services/userService';
import {
  formatChatListTime,
  getMatchActivityMs,
  getPaidRequest,
  getUnreadCountForUser,
  isConversationHiddenForUser,
  isIncomingPendingPaidRequest,
  isOutgoingPendingPaidRequest,
  isRejectedPaidRequest,
} from '../../utils/chatHelpers';
import {
  getPrimaryPhoto,
  isMatchUnread,
  isProfileVerified,
  isUserActuallyOnline,
  triggerHaptic,
} from '../../utils/formatters';
import PaidRequestPreviewModal from './PaidRequestPreviewModal';

const SWIPE_ACTION_WIDTH = 86;

function SwipeableConversationRow({
  match,
  peerUser,
  currentUserId,
  unreadCount,
  isSwipedOpen,
  onSwipeOpenChange,
  onOpenChat,
  onOpenProfile,
  onRequestDelete,
}) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef(null);
  const lockedHorizontalRef = useRef(false);
  const didSwipeRef = useRef(false);

  useEffect(() => {
    if (!dragging) {
      setDragX(isSwipedOpen ? -SWIPE_ACTION_WIDTH : 0);
    }
  }, [isSwipedOpen, dragging]);

  const online = isUserActuallyOnline(peerUser);
  const verified = isProfileVerified(peerUser);
  const sentByMe = match.lastSenderId === currentUserId;
  const outgoingPending = isOutgoingPendingPaidRequest(match, currentUserId);
  const paidReq = getPaidRequest(match);
  const timeLabel = formatChatListTime(getMatchActivityMs(match));
  const unread = unreadCount > 0;

  const handleTouchStart = (e) => {
    const touch = e.touches?.[0];
    if (!touch) return;
    startRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      base: isSwipedOpen ? -SWIPE_ACTION_WIDTH : 0,
    };
    lockedHorizontalRef.current = false;
    didSwipeRef.current = false;
  };

  const handleTouchMove = (e) => {
    const start = startRef.current;
    const touch = e.touches?.[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;

    if (!lockedHorizontalRef.current) {
      if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) {
        startRef.current = null;
        return;
      }
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.15) {
        lockedHorizontalRef.current = true;
        setDragging(true);
      } else {
        return;
      }
    }

    const next = Math.max(-SWIPE_ACTION_WIDTH - 14, Math.min(0, start.base + dx));
    setDragX(next);
    if (Math.abs(dx) > 12) {
      didSwipeRef.current = true;
    }
  };

  const handleTouchEnd = () => {
    if (!lockedHorizontalRef.current) {
      startRef.current = null;
      return;
    }
    const shouldOpen = dragX <= -SWIPE_ACTION_WIDTH * 0.45;
    setDragging(false);
    setDragX(shouldOpen ? -SWIPE_ACTION_WIDTH : 0);
    onSwipeOpenChange(shouldOpen ? match.id : null);
    if (shouldOpen) triggerHaptic(10);
    startRef.current = null;
    lockedHorizontalRef.current = false;
  };

  const handleRowClick = () => {
    if (didSwipeRef.current) {
      didSwipeRef.current = false;
      return;
    }
    if (isSwipedOpen) {
      onSwipeOpenChange(null);
      return;
    }
    onOpenChat();
  };

  return (
    <div className="relative overflow-hidden rounded-[22px]">
      {/* Fondo de acción swipe-to-delete */}
      <div className="absolute inset-y-0 right-0 w-[96px] bg-gradient-to-l from-rose-600 to-[#FF2E54] flex items-center justify-end pr-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSwipeOpenChange(null);
            onRequestDelete();
          }}
          className="w-[78px] h-full flex flex-col items-center justify-center gap-1 text-white active:scale-95 transition"
          aria-label={`Eliminar conversación con ${peerUser.name}`}
        >
          <Trash2 className="w-4 h-4" />
          <span className="text-[10px] font-black tracking-wide">Eliminar</span>
        </button>
      </div>

      {/* Fila deslizable GPU 60fps */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleRowClick}
        style={{
          transform: `translate3d(${dragX}px, 0, 0)`,
          transition: dragging ? 'none' : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
          willChange: 'transform',
        }}
        className={`relative z-10 w-full px-3.5 py-3 flex items-center gap-3.5 text-left cursor-pointer border transition-colors ${
          unread
            ? 'bg-gradient-to-r from-[#FFF5F7] via-white to-white border-rose-200/75 shadow-[0_6px_22px_-12px_rgba(255,46,84,0.28)]'
            : 'bg-white border-[#F1E7E4] hover:bg-[#FCF9F8] shadow-[0_2px_10px_-6px_rgba(24,12,18,0.08)]'
        }`}
      >
        {/* Avatar circular con punto verde en línea */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenProfile();
          }}
          className="relative shrink-0 group"
          aria-label={`Ver perfil de ${peerUser.name}`}
        >
          <div
            className={`p-[2px] rounded-full ${
              match.isVipDirect
                ? 'bg-gradient-to-tr from-amber-400 via-yellow-200 to-[#FF2E54]'
                : unread
                ? 'bg-gradient-to-tr from-[#FF2E54] to-amber-400'
                : 'bg-transparent'
            }`}
          >
            <img
              src={getPrimaryPhoto(peerUser, 160, { seed: currentUserId })}
              alt={peerUser.name}
              className="w-14 h-14 rounded-full object-cover bg-zinc-100 ring-2 ring-white group-hover:scale-105 transition"
            />
          </div>
          {online && (
            <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white shadow-sm" />
          )}
        </button>

        {/* Contenido principal */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-display text-[15px] font-black text-[#1A1115] truncate flex items-center gap-1">
              <span className="truncate">{peerUser.name}</span>
              {verified && (
                <BadgeCheck className="w-4 h-4 text-sky-500 fill-sky-500 stroke-white shrink-0" />
              )}
              {match.isVipDirect && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-100 border border-amber-200/80 text-amber-800 text-[9px] font-black inline-flex items-center gap-0.5 shrink-0">
                  <Crown className="w-2.5 h-2.5" /> VIP
                </span>
              )}
            </p>

            <span
              className={`text-[11px] shrink-0 tabular-nums ${
                unread
                  ? 'text-[#FF2E54] font-extrabold'
                  : 'text-[#96838A] font-semibold'
              }`}
            >
              {timeLabel || (online ? 'Ahora' : '')}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <p
              className={`text-[12.5px] truncate flex items-center gap-1 ${
                unread ? 'font-bold text-[#1D1317]' : 'font-medium text-[#75646B]'
              }`}
            >
              {sentByMe && !outgoingPending && (
                <CheckCheck className="w-3.5 h-3.5 text-sky-500 shrink-0" />
              )}
              {outgoingPending ? (
                <span className="truncate text-amber-700 font-semibold">
                  💎 Solicitud VIP enviada ({paidReq?.diamonds || 0} 💎) · En espera
                </span>
              ) : (
                <span className="truncate">
                  {sentByMe
                    ? `Tú: ${match.lastMessage || ''}`
                    : match.lastMessage || 'Envía el primer mensaje'}
                </span>
              )}
            </p>

            <div className="flex items-center gap-1.5 shrink-0">
              {unread && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-gradient-to-r from-[#FF2E54] to-rose-500 text-white text-[10px] font-black inline-flex items-center justify-center shadow-[0_3px_10px_rgba(255,46,84,0.45)] tabular-nums">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRequestDelete();
                }}
                className="w-7 h-7 rounded-full text-[#A49097] hover:text-[#1D1317] hover:bg-[#F5ECE9] flex items-center justify-center transition"
                aria-label={`Opciones de conversación con ${peerUser.name}`}
                title="Eliminar conversación"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatList({
  matches = [],
  currentUser,
  optimisticReadMap = {},
  onSelectMatch,
  onSelectProfile,
  onOpenSafetyCenter,
  onGoToSwipe,
  onAcceptPaidRequest,
  onRejectPaidRequest,
  onDeleteConversation,
}) {
  const [peerMap, setPeerMap] = useState({});
  const [showSafetyPanel, setShowSafetyPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [swipedMatchId, setSwipedMatchId] = useState(null);
  const [previewRequest, setPreviewRequest] = useState(null);
  const [busyRequestAction, setBusyRequestAction] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null); // { match, peerUser }
  const [deletingChat, setDeletingChat] = useState(false);

  const currentUid = currentUser?.uid || '';
  const blockedKey = (currentUser?.blockedUsers || []).join(',');

  const peerIdsKey = useMemo(() => {
    const ids = matches
      .map((m) => (m.participants || []).find((p) => p !== currentUid))
      .filter(Boolean);
    return Array.from(new Set(ids)).sort().join(',');
  }, [matches, currentUid]);

  useEffect(() => {
    let cancelled = false;
    const uniqueIds = peerIdsKey ? peerIdsKey.split(',').filter(Boolean) : [];
    if (uniqueIds.length === 0) {
      setPeerMap({});
      return;
    }
    Promise.all(
      uniqueIds.map(async (uid) => {
        try {
          const u = await getUserById(uid);
          return [uid, u];
        } catch {
          return [uid, null];
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      const next = {};
      entries.forEach(([uid, u]) => {
        if (u) next[uid] = u;
      });
      setPeerMap(next);
    });

    return () => {
      cancelled = true;
    };
  }, [peerIdsKey]);

  const resolvePeer = (match) => {
    const peerId = (match.participants || []).find((p) => p !== currentUid);
    const cached = match.participantProfiles?.[peerId];
    return (
      peerMap[peerId] || {
        uid: peerId,
        id: peerId,
        name: cached?.name || 'Usuario',
        photos: cached?.photo ? [cached.photo] : [],
        country: cached?.country || null,
        isOnline: false,
      }
    );
  };

  const { incomingPaidRequests, activeConversations, totalUnreadCount } = useMemo(() => {
    const blockedSet = new Set(currentUser?.blockedUsers || []);
    const q = searchQuery.trim().toLowerCase();

    const paidReqs = [];
    const active = [];
    let unreadTotal = 0;

    matches.forEach((m) => {
      if (!Array.isArray(m.participants) || m.participants.length !== 2) return;
      if (!m.participants.includes(currentUid)) return;
      const peerId = m.participants.find((p) => p !== currentUid);
      if (!peerId || blockedSet.has(peerId)) return;
      if (isRejectedPaidRequest(m)) return;
      if (isConversationHiddenForUser(m, currentUid)) return;

      const peer = resolvePeer(m);

      if (isIncomingPendingPaidRequest(m, currentUid)) {
        paidReqs.push({ match: m, peerUser: peer });
        unreadTotal += 1;
        return;
      }

      const legacyUnread = isMatchUnread(m, currentUid, optimisticReadMap[m.id]);
      const count = legacyUnread ? getUnreadCountForUser(m, currentUid, true) : 0;
      unreadTotal += count;

      if (q) {
        const nameMatch = (peer.name || '').toLowerCase().includes(q);
        const msgMatch = (m.lastMessage || '').toLowerCase().includes(q);
        if (!nameMatch && !msgMatch) return;
      }

      active.push({ match: m, peerUser: peer, unreadCount: count });
    });

    return {
      incomingPaidRequests: paidReqs,
      activeConversations: active,
      totalUnreadCount: unreadTotal,
    };
  }, [matches, currentUid, blockedKey, searchQuery, peerMap, optimisticReadMap]);

  const handleAcceptRequest = async (item) => {
    if (!item?.match?.id || busyRequestAction) return;
    setBusyRequestAction('accept');
    try {
      await onAcceptPaidRequest?.(item.match, item.peerUser);
      setPreviewRequest(null);
    } finally {
      setBusyRequestAction('');
    }
  };

  const handleRejectRequest = async (item) => {
    if (!item?.match?.id || busyRequestAction) return;
    setBusyRequestAction('reject');
    try {
      await onRejectPaidRequest?.(item.match, item.peerUser);
      setPreviewRequest(null);
    } finally {
      setBusyRequestAction('');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget?.match?.id || deletingChat) return;
    setDeletingChat(true);
    try {
      await onDeleteConversation?.(deleteTarget.match, deleteTarget.peerUser);
      setDeleteTarget(null);
    } finally {
      setDeletingChat(false);
    }
  };

  const hasAnyContent = incomingPaidRequests.length > 0 || activeConversations.length > 0;

  return (
    <div className="min-h-full bg-[#FBF7F4] text-[#1D1317] flex flex-col">
      {/* Cabecera nativa moderna y minimalista */}
      <header className="sticky top-0 z-20 bg-[#FBF7F4]/95 backdrop-blur-xl border-b border-[#EFE4E0] pt-safe px-4 pt-3.5 pb-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <h1 className="font-display text-[28px] leading-none font-black tracking-[-0.025em] text-[#1D1317]">
              Mensajes
            </h1>
            {totalUnreadCount > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-rose-100 border border-rose-200/80 text-[#E62E5C] text-[11px] font-black tabular-nums">
                {totalUnreadCount > 99 ? '99+' : totalUnreadCount} sin leer
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowSafetyPanel((v) => !v)}
            className={`w-9 h-9 rounded-full flex items-center justify-center border transition shrink-0 ${
              showSafetyPanel
                ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                : 'bg-white border-[#EAE0DC] text-[#5D4C52] hover:text-[#1D1317]'
            }`}
            title="Privacidad y Seguridad"
            aria-label="Privacidad y Seguridad"
          >
            <ShieldCheck className="w-4 h-4" />
          </button>
        </div>

        {/* Buscador rápido solo para conversaciones activas */}
        <div className="bg-white rounded-full px-3.5 py-2.5 border border-[#EDE2DE] shadow-[0_2px_10px_-6px_rgba(24,12,18,0.08)] flex items-center gap-2.5 focus-within:border-[#FF2E54]/50 transition">
          <Search className="w-4 h-4 text-[#A49097] shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar en tus conversaciones..."
            className="w-full bg-transparent text-[13.5px] text-[#1D1317] placeholder:text-[#A49097] font-medium focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-[#A49097] hover:text-[#1D1317] transition"
              aria-label="Limpiar búsqueda"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Panel discreto de privacidad */}
        {showSafetyPanel && (
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-emerald-200/80 space-y-2 animate-sheet-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-700 text-xs font-extrabold">
                <ShieldCheck className="w-4 h-4" />
                Chats Privados 1-a-1
              </div>
              <button
                type="button"
                onClick={() => setShowSafetyPanel(false)}
                className="text-xs font-bold text-zinc-400 hover:text-zinc-700"
              >
                Cerrar
              </button>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Tus conversaciones son privadas. Puedes deslizar cualquier chat a la izquierda para eliminarlo o gestionar bloqueos desde tu Centro de Seguridad.
            </p>
            {onOpenSafetyCenter && (
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onOpenSafetyCenter('blocked')}
                  className="px-3 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-[11px] font-extrabold transition"
                >
                  Bloqueados ({(currentUser?.blockedUsers || []).length})
                </button>
                <button
                  type="button"
                  onClick={() => onOpenSafetyCenter('reports')}
                  className="px-3 py-1.5 rounded-full bg-rose-50 hover:bg-rose-100 text-[#FF2E54] text-[11px] font-extrabold transition"
                >
                  Mis reportes
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Contenido Principal */}
      <div className="flex-1 px-4 py-4 space-y-5">
        {/* MÓDULO SUPERIOR: Solicitudes VIP / Mensajes con Diamantes */}
        {incomingPaidRequests.length > 0 && (
          <section className="space-y-2.5">
            <div className="flex items-center justify-between gap-2 px-0.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-400 via-amber-500 to-[#FF2E54] text-white flex items-center justify-center shadow-sm shrink-0">
                  <Crown className="w-3.5 h-3.5" />
                </span>
                <h2 className="font-display text-xs font-black uppercase tracking-[0.1em] text-[#1D1317] truncate">
                  Solicitudes VIP · Mensajes con Diamantes
                </h2>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300/80 text-amber-900 text-[10px] font-black tabular-nums shrink-0">
                {incomingPaidRequests.length}
              </span>
            </div>

            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
              {incomingPaidRequests.map(({ match, peerUser }) => {
                const paidReq = getPaidRequest(match);
                const verified = isProfileVerified(peerUser);
                const online = isUserActuallyOnline(peerUser);
                return (
                  <button
                    key={`vip-req-${match.id}`}
                    type="button"
                    onClick={() => setPreviewRequest({ match, peerUser })}
                    className="w-[152px] shrink-0 rounded-[24px] p-3 bg-gradient-to-br from-[#1B0B15] via-[#271020] to-[#130914] border border-amber-300/45 text-left text-white shadow-[0_12px_28px_-12px_rgba(217,119,6,0.45)] active:scale-[0.98] transition group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="relative shrink-0">
                        <div className="p-[2px] rounded-full bg-gradient-to-tr from-amber-400 via-yellow-200 to-sky-400 shadow">
                          <img
                            src={getPrimaryPhoto(peerUser, 160, { seed: currentUid })}
                            alt={peerUser.name}
                            className="w-11 h-11 rounded-full object-cover bg-zinc-900 group-hover:scale-105 transition"
                          />
                        </div>
                        {online && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-[#1B0B15]" />
                        )}
                      </div>

                      <span className="px-2 py-1 rounded-full bg-amber-400/20 border border-amber-300/45 text-amber-200 text-[10.5px] font-black inline-flex items-center gap-0.5 tabular-nums shrink-0">
                        <Gem className="w-3 h-3 text-sky-300" />
                        {paidReq?.diamonds || 0}
                      </span>
                    </div>

                    <p className="font-display text-xs font-black text-white truncate mt-2.5 flex items-center gap-1">
                      <span className="truncate">{peerUser.name?.split(' ')[0]}</span>
                      {verified && (
                        <BadgeCheck className="w-3.5 h-3.5 text-sky-400 fill-sky-400 stroke-white shrink-0" />
                      )}
                    </p>
                    <p className="text-[11px] text-rose-100/75 truncate mt-0.5">
                      {paidReq?.message || 'Mensaje prioritario'}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* LISTA PRINCIPAL DE CONVERSACIONES ACTIVAS */}
        {!hasAnyContent && !searchQuery ? (
          <div className="my-auto py-12 px-6 rounded-[30px] bg-white border border-[#F0E4E0] shadow-card flex flex-col items-center justify-center text-center space-y-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-[26px] bg-gradient-to-br from-[#FFF0F4] via-[#FFF6EC] to-[#F3EEFF] border border-rose-200/70 flex items-center justify-center shadow-inner">
                <MessageCircleHeart className="w-10 h-10 text-[#FF2E54]" />
              </div>
              <span className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-[#FF2E54] text-white flex items-center justify-center shadow-md">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
            </div>

            <div className="space-y-1.5 max-w-[260px]">
              <h2 className="font-display text-xl font-black text-[#1D1317]">
                Tu bandeja está lista
              </h2>
              <p className="text-xs text-[#75646B] leading-relaxed">
                Cuando hagas Match o recibas un mensaje prioritario con diamantes, tus conversaciones aparecerán aquí.
              </p>
            </div>

            {onGoToSwipe && (
              <button
                type="button"
                onClick={onGoToSwipe}
                className="px-6 py-3 rounded-full bg-gradient-to-r from-[#FF2E54] to-[#FF5E7E] text-white text-xs font-black inline-flex items-center gap-2 shadow-[0_12px_26px_-8px_rgba(255,46,84,0.5)] hover:brightness-105 active:scale-95 transition"
              >
                <Flame className="w-4 h-4 fill-white" />
                Descubrir personas
              </button>
            )}
          </div>
        ) : activeConversations.length === 0 ? (
          <div className="py-10 px-6 rounded-[26px] bg-white border border-[#F0E4E0] text-center space-y-2 shadow-card">
            <p className="font-display text-base font-black text-[#1D1317]">
              {searchQuery ? 'Sin resultados' : 'Sin conversaciones activas aún'}
            </p>
            <p className="text-xs text-[#75646B]">
              {searchQuery
                ? 'No encontramos chats que coincidan con tu búsqueda.'
                : 'Acepta una Solicitud VIP arriba o haz Match en Descubrir para conversar.'}
            </p>
          </div>
        ) : (
          <section className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <p className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-[#96838A]">
                Conversaciones ({activeConversations.length})
              </p>
              <span className="text-[10px] font-semibold text-[#B09EA5]">
                Desliza ← para eliminar
              </span>
            </div>

            <div className="space-y-2">
              {activeConversations.map(({ match, peerUser, unreadCount }) => (
                <SwipeableConversationRow
                  key={match.id}
                  match={match}
                  peerUser={peerUser}
                  currentUserId={currentUid}
                  unreadCount={unreadCount}
                  isSwipedOpen={swipedMatchId === match.id}
                  onSwipeOpenChange={setSwipedMatchId}
                  onOpenChat={() => onSelectMatch?.({ match, peerUser })}
                  onOpenProfile={() => onSelectProfile?.(peerUser)}
                  onRequestDelete={() => setDeleteTarget({ match, peerUser })}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Modal de vista previa de Solicitud VIP */}
      <PaidRequestPreviewModal
        requestItem={previewRequest}
        currentUserId={currentUid}
        busyAction={busyRequestAction}
        onClose={() => setPreviewRequest(null)}
        onAccept={handleAcceptRequest}
        onReject={handleRejectRequest}
        onViewProfile={(peer) => {
          setPreviewRequest(null);
          onSelectProfile?.(peer);
        }}
      />

      {/* Modal de confirmación para eliminar conversación */}
      {deleteTarget && (
        <div
          onClick={() => !deletingChat && setDeleteTarget(null)}
          className="fixed inset-0 z-[65] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-t-[30px] sm:rounded-[30px] p-6 pb-safe shadow-2xl animate-sheet-up space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 text-[#FF2E54] flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-base font-black text-zinc-900">
                  ¿Eliminar conversación?
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5 truncate">
                  Con <strong className="text-zinc-800">{deleteTarget.peerUser?.name}</strong>
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed">
              Esta conversación desaparecerá de tu lista de mensajes. Si la otra persona vuelve a escribirte más adelante, recibirás el nuevo mensaje normalmente.
            </p>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                disabled={deletingChat}
                onClick={() => setDeleteTarget(null)}
                className="py-3 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-extrabold transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingChat}
                onClick={handleConfirmDelete}
                className="py-3 rounded-full bg-[#FF2E54] hover:brightness-105 text-white text-xs font-black shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 transition"
              >
                {deletingChat ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
