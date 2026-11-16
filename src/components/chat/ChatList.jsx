import { useEffect, useMemo, useState } from 'react';
import {
  CheckCheck,
  Lock,
  MessageCircle,
  MessageCircleHeart,
  Search,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { getUserById, subscribePopularUsers } from '../../services/userService';
import {
  formatRelativeLastSeen,
  getPrimaryPhoto,
  isMatchUnread,
  isUserActuallyOnline,
} from '../../utils/formatters';

export default function ChatList({
  matches = [],
  currentUser,
  onSelectMatch,
  onStartChat,
  onSelectProfile,
}) {
  const [peerMap, setPeerMap] = useState({});
  const [communityUsers, setCommunityUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const blockedKey = (currentUser?.blockedUsers || []).join(',');

  // Cargar perfiles disponibles de la comunidad para poder iniciar chat directo desde esta pestaña
  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = subscribePopularUsers(
      {
        scope: 'global',
        countryCode: currentUser?.country?.code,
        currentUserId: currentUser.uid,
        blockedUsers: currentUser?.blockedUsers || [],
      },
      (list) => setCommunityUsers(list.slice(0, 20)),
      () => {}
    );
    return () => unsub();
  }, [currentUser?.uid, currentUser?.country?.code, blockedKey]);

  useEffect(() => {
    let cancelled = false;
    const peerIds = matches
      .map((m) => (m.participants || []).find((p) => p !== currentUser.uid))
      .filter(Boolean);

    const uniqueIds = Array.from(new Set(peerIds));
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
  }, [matches, currentUser.uid]);

  const blockedSet = new Set(currentUser?.blockedUsers || []);
  const visibleMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return matches.filter((m) => {
      if (!Array.isArray(m.participants) || m.participants.length !== 2) return false;
      if (!m.participants.includes(currentUser.uid)) return false;
      const peerId = m.participants.find((p) => p !== currentUser.uid);
      if (!peerId || blockedSet.has(peerId)) return false;
      if (!q) return true;
      const peerName = (
        peerMap[peerId]?.name ||
        m.participantProfiles?.[peerId]?.name ||
        ''
      ).toLowerCase();
      const lastMsg = (m.lastMessage || '').toLowerCase();
      return peerName.includes(q) || lastMsg.includes(q);
    });
  }, [matches, currentUser.uid, blockedKey, searchQuery, peerMap]);

  return (
    <div className="p-4 space-y-4">
      {/* Privacy Guarantee Header */}
      <div className="bg-white rounded-3xl p-4 border border-rose-100/90 shadow-card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-lg font-extrabold text-slate-900">
              Mensajes Privados
            </h1>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              <Lock className="w-3 h-3 text-emerald-600" />
              Chats independientes 1-a-1 • Solo tú y tu contacto pueden leerlos
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-rose-50 text-brand-600 text-xs font-extrabold border border-rose-100">
            {visibleMatches.length} {visibleMatches.length === 1 ? 'chat' : 'chats'}
          </span>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar en tus conversaciones..."
            className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 font-medium focus:outline-none focus:bg-white focus:border-brand-400 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 p-0.5 rounded-full text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Horizontal Quick-Chat Strip: Personas disponibles para chatear */}
      {communityUsers.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-brand-500" />
              Iniciar chat rápido con alguien
            </p>
            <span className="text-[11px] font-semibold text-brand-600">Toca para chatear</span>
          </div>

          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {communityUsers.map((user) => {
              const online = isUserActuallyOnline(user);
              return (
                <button
                  key={user.uid || user.id}
                  type="button"
                  onClick={() => onStartChat?.(user)}
                  className="flex flex-col items-center w-16 shrink-0 group"
                >
                  <div className="relative p-0.5 rounded-2xl bg-gradient-to-tr from-brand-500 via-rose-400 to-amber-300 shadow-sm group-hover:scale-105 transition">
                    <img
                      src={getPrimaryPhoto(user, 200)}
                      alt={user.name}
                      className="w-14 h-14 rounded-[14px] object-cover bg-white border-2 border-white"
                    />
                    {online && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                    )}
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 truncate w-full text-center mt-1">
                    {user.name?.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Conversations List */}
      {visibleMatches.length === 0 ? (
        <div className="p-8 rounded-3xl bg-white border border-slate-200/80 shadow-card flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-3xl bg-rose-50 border border-rose-100 flex items-center justify-center text-brand-500 mb-3">
            <MessageCircleHeart className="w-8 h-8" />
          </div>
          <h3 className="font-display text-base font-extrabold text-slate-900">
            {searchQuery ? 'No se encontraron chats' : 'Aún no tienes conversaciones activas'}
          </h3>
          <p className="text-xs text-slate-500 mt-1.5 max-w-xs leading-relaxed">
            Toca a cualquier persona arriba en <strong>Iniciar chat rápido</strong> o pulsa el botón{' '}
            <strong>Chatear</strong> en cualquier perfil para conversar en privado.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibleMatches.map((match) => {
            const peerId = (match.participants || []).find((p) => p !== currentUser.uid);
            const cached = match.participantProfiles?.[peerId];
            const livePeer = peerMap[peerId] || {
              uid: peerId,
              id: peerId,
              name: cached?.name || 'Usuario',
              photos: cached?.photo ? [cached.photo] : [],
              country: cached?.country || null,
              isOnline: false,
            };

            const online = isUserActuallyOnline(livePeer);
            const unread = isMatchUnread(match, currentUser.uid);
            const sentByMe = match.lastSenderId === currentUser.uid;

            return (
              <div
                key={match.id}
                onClick={() => onSelectMatch({ match, peerUser: livePeer })}
                className={`w-full p-3.5 rounded-3xl border flex items-center gap-3.5 text-left transition cursor-pointer ${
                  unread
                    ? 'bg-gradient-to-r from-rose-50/90 to-white border-rose-200 shadow-card'
                    : 'bg-white border-slate-200/80 hover:border-brand-300 shadow-card'
                }`}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectProfile?.(livePeer);
                  }}
                  className="relative shrink-0 group"
                  title="Ver perfil"
                >
                  <img
                    src={getPrimaryPhoto(livePeer, 200)}
                    alt={livePeer.name}
                    className="w-14 h-14 rounded-2xl object-cover bg-slate-100 border border-slate-200/70 group-hover:scale-105 transition"
                  />
                  {online && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-extrabold text-slate-900 truncate flex items-center gap-1.5">
                      <span>{livePeer.country?.flag || ''}</span>
                      <span className="truncate">{livePeer.name}</span>
                      {match.isVipDirect && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-extrabold inline-flex items-center gap-0.5 shrink-0">
                          <Zap className="w-2.5 h-2.5 fill-amber-500 text-amber-500" /> VIP
                        </span>
                      )}
                    </p>
                    <span
                      className={`text-[10px] shrink-0 font-bold ${
                        unread ? 'text-brand-600' : online ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    >
                      {online ? 'En línea' : formatRelativeLastSeen(match.lastMessageAt, false)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-1">
                    <p
                      className={`text-xs truncate flex items-center gap-1 ${
                        unread ? 'font-extrabold text-slate-900' : 'font-medium text-slate-500'
                      }`}
                    >
                      {sentByMe && <CheckCheck className="w-3.5 h-3.5 text-brand-500 shrink-0" />}
                      <span className="truncate">
                        {sentByMe ? `Tú: ${match.lastMessage || ''}` : match.lastMessage || 'Empieza a conversar...'}
                      </span>
                    </p>

                    {unread ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-brand-500 shrink-0 shadow-sm" />
                    ) : (
                      <MessageCircle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
