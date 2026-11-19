import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  CheckCheck,
  Flame,
  Lock,
  MessageCirclePlus,
  Search,
  ShieldCheck,
  X,
  Zap,
} from 'lucide-react';
import { getUserById, subscribePopularUsers } from '../../services/userService';
import {
  formatRelativeLastSeen,
  getPrimaryPhoto,
  isMatchUnread,
  isProfileVerified,
  isUserActuallyOnline,
} from '../../utils/formatters';

function BlueHeartDice3D() {
  return (
    <svg
      className="w-32 h-32 drop-shadow-[0_18px_28px_rgba(59,130,246,0.22)]"
      viewBox="0 0 140 140"
      fill="none"
    >
      <defs>
        <linearGradient id="diceBody" x1="20" y1="20" x2="120" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#93C5FD" stopOpacity="0.92" />
          <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.88" />
          <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="diceTop" x1="30" y1="20" x2="110" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#DBEAFE" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#60A5FA" stopOpacity="0.85" />
        </linearGradient>
        <radialGradient id="innerHeart" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#FDA4AF" />
          <stop offset="55%" stopColor="#FF2E54" />
          <stop offset="100%" stopColor="#9F1239" />
        </radialGradient>
      </defs>

      <rect
        x="26"
        y="26"
        width="88"
        height="88"
        rx="24"
        transform="rotate(-8 70 70)"
        fill="url(#diceBody)"
        stroke="#BFDBFE"
        strokeWidth="2"
      />
      <rect
        x="32"
        y="30"
        width="76"
        height="34"
        rx="16"
        transform="rotate(-8 70 47)"
        fill="url(#diceTop)"
        fillOpacity="0.55"
      />
      <circle cx="44" cy="46" r="4" fill="white" fillOpacity="0.65" />
      <circle cx="96" cy="40" r="4" fill="white" fillOpacity="0.65" />
      <circle cx="48" cy="96" r="4" fill="white" fillOpacity="0.65" />
      <circle cx="98" cy="90" r="4" fill="white" fillOpacity="0.65" />
      <path
        d="M70 90C70 90 44 73 44 55C44 45.5 51.5 39 60 39C65 39 68.5 42 70 45.5C71.5 42 75 39 80 39C88.5 39 96 45.5 96 55C96 73 70 90 70 90Z"
        fill="url(#innerHeart)"
      />
      <ellipse cx="58" cy="50" rx="5" ry="3" transform="rotate(-20 58 50)" fill="white" fillOpacity="0.6" />
    </svg>
  );
}

export default function ChatList({
  matches = [],
  currentUser,
  optimisticReadMap = {},
  onSelectMatch,
  onStartChat,
  onSelectProfile,
  onOpenSafetyCenter,
  onGoToSwipe,
}) {
  const [peerMap, setPeerMap] = useState({});
  const [communityUsers, setCommunityUsers] = useState([]);
  const [activePanel, setActivePanel] = useState(null); // null | 'safety' | 'quick'
  const [searchQuery, setSearchQuery] = useState('');

  const blockedKey = (currentUser?.blockedUsers || []).join(',');

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

  const peerIdsKey = useMemo(() => {
    const ids = matches
      .map((m) => (m.participants || []).find((p) => p !== currentUser.uid))
      .filter(Boolean);
    return Array.from(new Set(ids)).sort().join(',');
  }, [matches, currentUser.uid]);

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
    <div className="min-h-full bg-gradient-to-b from-[#FBF7F9] via-[#FAF7F9] to-[#F4F1F5] text-zinc-900 flex flex-col p-4 space-y-3.5">
      {/* Cabecera superior con funciones claras */}
      <header className="flex items-center justify-between pt-safe">
        <div>
          <h1 className="font-display text-3xl font-black tracking-tight text-zinc-900">Chat</h1>
          <p className="text-[11px] font-semibold text-zinc-500 flex items-center gap-1 mt-0.5">
            <Lock className="w-3 h-3 text-emerald-600" />
            Conversaciones privadas 1-a-1
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActivePanel((p) => (p === 'safety' ? null : 'safety'))}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition shadow-sm ${
              activePanel === 'safety'
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-zinc-700 hover:bg-zinc-100'
            }`}
            title="Centro de Seguridad y Privacidad"
          >
            <ShieldCheck className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setActivePanel((p) => (p === 'quick' ? null : 'quick'))}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition shadow-sm ${
              activePanel === 'quick'
                ? 'bg-zinc-900 text-white'
                : 'bg-white text-zinc-700 hover:bg-zinc-100'
            }`}
            title="Nuevo chat rápido"
          >
            <MessageCirclePlus className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Panel de Privacidad y Seguridad */}
      {activePanel === 'safety' && (
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-emerald-200/80 space-y-2 animate-sheet-up">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-700 text-xs font-extrabold">
              <ShieldCheck className="w-4 h-4" />
              Privacidad Protegida
            </div>
            <button
              type="button"
              onClick={() => setActivePanel(null)}
              className="text-xs font-bold text-zinc-400 hover:text-zinc-700"
            >
              Cerrar
            </button>
          </div>
          <p className="text-xs text-zinc-600 leading-relaxed">
            Cada perfil es independiente. Tus chats privados están protegidos por reglas estrictas: únicamente tú y la persona con quien hablas pueden leer o enviar mensajes en esa sala.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="text-[11px] font-bold text-zinc-500">
              Bloqueados por ti: {(currentUser?.blockedUsers || []).length}
            </span>
            {onOpenSafetyCenter && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onOpenSafetyCenter('blocked')}
                  className="px-3 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-[11px] font-extrabold transition"
                >
                  Ver bloqueados
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
        </div>
      )}

      {/* Selector rápido de personas activas */}
      {activePanel === 'quick' && (
        <div className="bg-white rounded-3xl p-4 shadow-sm space-y-2.5 animate-sheet-up">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-zinc-900">
              Iniciar conversación privada
            </span>
            <button
              type="button"
              onClick={() => setActivePanel(null)}
              className="text-xs font-bold text-zinc-400 hover:text-zinc-700"
            >
              Cerrar
            </button>
          </div>
          {communityUsers.length === 0 ? (
            <p className="text-xs text-zinc-500 py-2">No hay otros perfiles activos disponibles.</p>
          ) : (
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
              {communityUsers.map((u) => {
                const online = isUserActuallyOnline(u);
                return (
                  <button
                    key={u.uid || u.id}
                    type="button"
                    onClick={() => onStartChat?.(u)}
                    className="flex flex-col items-center shrink-0 w-16 group"
                  >
                    <div className="relative">
                      <img
                        src={getPrimaryPhoto(u, 150)}
                        alt={u.name}
                        className="w-14 h-14 rounded-2xl object-cover border border-zinc-200 group-hover:scale-105 transition"
                      />
                      {online && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white" />
                      )}
                    </div>
                    <span className="text-[11px] font-bold text-zinc-800 truncate w-full text-center mt-1">
                      {u.name?.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Barra de búsqueda tipo píldora blanca */}
      <div className="bg-white rounded-full px-4 py-2.5 shadow-sm flex items-center gap-2.5">
        <Search className="w-4 h-4 text-zinc-400 shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Buscar ${visibleMatches.length} ${visibleMatches.length === 1 ? 'chat' : 'matches'}`}
          className="w-full bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 font-medium focus:outline-none"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-zinc-400 hover:text-zinc-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Contenedor principal blanco redondeado */}
      {visibleMatches.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 flex-1 flex flex-col items-center justify-center text-center shadow-sm">
          <BlueHeartDice3D />

          <h2 className="font-serif-display text-2xl font-bold text-zinc-900 mt-4">
            {searchQuery ? 'Sin resultados' : 'Comienza a deslizar'}
          </h2>

          <p className="text-xs sm:text-sm text-zinc-500 mt-2 max-w-[270px] leading-relaxed">
            {searchQuery
              ? 'No encontramos conversaciones con ese nombre o mensaje.'
              : 'Al hacer match o iniciar un chat directo con alguien, tus mensajes privados aparecerán aquí.'}
          </p>

          {!searchQuery && (
            <div className="flex flex-col sm:flex-row gap-2 mt-6 w-full max-w-[260px]">
              {onGoToSwipe && (
                <button
                  type="button"
                  onClick={onGoToSwipe}
                  className="w-full py-3 rounded-full bg-zinc-900 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow active:scale-95 transition-transform"
                >
                  <Flame className="w-4 h-4 text-[#FF2E54] fill-[#FF2E54]" />
                  Ir a Descubrir
                </button>
              )}
              {communityUsers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActivePanel('quick')}
                  className="w-full py-3 rounded-full bg-zinc-100 text-zinc-800 text-xs font-extrabold hover:bg-zinc-200 transition"
                >
                  Chat rápido
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-4 flex-1 flex flex-col space-y-4 shadow-sm overflow-y-auto no-scrollbar">
          {/* Fila horizontal de conexiones / nuevos matches arriba */}
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 mb-2.5 px-1">
              Conexiones recientes
            </p>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
              {visibleMatches.map((match) => {
                const peerId = (match.participants || []).find((p) => p !== currentUser.uid);
                const cached = match.participantProfiles?.[peerId];
                const livePeer = peerMap[peerId] || {
                  uid: peerId,
                  id: peerId,
                  name: cached?.name || 'Usuario',
                  photos: cached?.photo ? [cached.photo] : [],
                  country: cached?.country || null,
                };
                const online = isUserActuallyOnline(livePeer);

                return (
                  <button
                    key={`new-${match.id}`}
                    type="button"
                    onClick={() => onSelectMatch({ match, peerUser: livePeer })}
                    className="flex flex-col items-center shrink-0 w-16 group"
                  >
                    <div className="relative">
                      <img
                        src={getPrimaryPhoto(livePeer, 180, { seed: currentUser?.uid })}
                        alt={livePeer.name}
                        className="w-14 h-16 rounded-2xl object-cover bg-zinc-100 border border-zinc-200 group-hover:scale-105 transition"
                      />
                      {online && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white" />
                      )}
                    </div>
                    <span className="text-[11px] font-bold text-zinc-800 truncate w-full text-center mt-1">
                      {livePeer.name?.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lista limpia de chats debajo */}
          <div className="space-y-1 pt-2 border-t border-zinc-100">
            <p className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 mb-2 px-1">
              Mensajes
            </p>

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
              const unread = isMatchUnread(match, currentUser.uid, optimisticReadMap[match.id]);
              const sentByMe = match.lastSenderId === currentUser.uid;
              const verified = isProfileVerified(livePeer);

              return (
                <div
                  key={match.id}
                  onClick={() => onSelectMatch({ match, peerUser: livePeer })}
                  className={`w-full p-2.5 rounded-2xl flex items-center gap-3 text-left transition cursor-pointer ${
                    unread ? 'bg-rose-50/70' : 'hover:bg-zinc-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectProfile?.(livePeer);
                    }}
                    className="relative shrink-0"
                  >
                    <img
                      src={getPrimaryPhoto(livePeer, 160, { seed: currentUser?.uid })}
                      alt={livePeer.name}
                      className="w-14 h-14 rounded-full object-cover bg-zinc-100 border border-zinc-200/70"
                    />
                    {online && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0 border-b border-zinc-100 pb-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-extrabold text-zinc-900 truncate flex items-center gap-1">
                        <span className="truncate">{livePeer.name}</span>
                        {verified && (
                          <BadgeCheck className="w-4 h-4 text-sky-500 fill-sky-500 stroke-white shrink-0" />
                        )}
                        {match.isVipDirect && (
                          <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-black inline-flex items-center gap-0.5 shrink-0">
                            <Zap className="w-2.5 h-2.5 fill-amber-500" /> VIP
                          </span>
                        )}
                      </p>
                      <span
                        className={`text-[11px] shrink-0 font-semibold ${
                          unread ? 'text-[#FF2E54] font-bold' : online ? 'text-emerald-600' : 'text-zinc-400'
                        }`}
                      >
                        {online
                          ? 'En línea'
                          : formatRelativeLastSeen(match.lastMessageAt, false, {
                              hideOnlineStatus: livePeer.hideOnlineStatus,
                            })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p
                        className={`text-xs truncate flex items-center gap-1 ${
                          unread ? 'font-extrabold text-zinc-900' : 'text-zinc-500'
                        }`}
                      >
                        {sentByMe && <CheckCheck className="w-3.5 h-3.5 text-zinc-400 shrink-0" />}
                        <span className="truncate">
                          {sentByMe
                            ? `Tú: ${match.lastMessage || ''}`
                            : match.lastMessage || 'Envía el primer mensaje'}
                        </span>
                      </p>
                      {unread && <span className="w-2.5 h-2.5 rounded-full bg-[#FF2E54] shrink-0" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
