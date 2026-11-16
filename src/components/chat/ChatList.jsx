import { useEffect, useMemo, useState } from 'react';
import { CheckCheck, Search, Shield, X, Zap } from 'lucide-react';
import { getUserById, subscribePopularUsers } from '../../services/userService';
import {
  formatRelativeLastSeen,
  getPrimaryPhoto,
  isMatchUnread,
  isUserActuallyOnline,
} from '../../utils/formatters';

/* Ilustración 3D de un dado azul translúcido con un corazón en el centro */
function BlueHeartDice3D() {
  return (
    <svg
      className="w-36 h-36 drop-shadow-[0_18px_28px_rgba(59,130,246,0.25)]"
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

      {/* Cubo 3D redondeado isométrico */}
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

      {/* Puntos de dado translúcidos en las esquinas */}
      <circle cx="44" cy="46" r="4" fill="white" fillOpacity="0.65" />
      <circle cx="96" cy="40" r="4" fill="white" fillOpacity="0.65" />
      <circle cx="48" cy="96" r="4" fill="white" fillOpacity="0.65" />
      <circle cx="98" cy="90" r="4" fill="white" fillOpacity="0.65" />

      {/* Corazón central dentro del dado */}
      <path
        d="M70 90C70 90 44 73 44 55C44 45.5 51.5 39 60 39C65 39 68.5 42 70 45.5C71.5 42 75 39 80 39C88.5 39 96 45.5 96 55C96 73 70 90 70 90Z"
        fill="url(#innerHeart)"
      />
      <ellipse cx="58" cy="50" rx="5" ry="3" transform="rotate(-20 58 50)" fill="white" fillOpacity="0.6" />
    </svg>
  );
}

function DualFacesIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="10" r="6" />
      <path d="M7 11.5c.6.8 1.3 1.2 2 1.2s1.4-.4 2-1.2" strokeLinecap="round" />
      <circle cx="7.5" cy="8.5" r="0.6" fill="currentColor" />
      <circle cx="10.5" cy="8.5" r="0.6" fill="currentColor" />
      <path d="M15.5 5.5a5.5 5.5 0 0 1 0 10.5" strokeLinecap="round" />
    </svg>
  );
}

export default function ChatList({
  matches = [],
  currentUser,
  onSelectMatch,
  onStartChat,
  onSelectProfile,
}) {
  const [peerMap, setPeerMap] = useState({});
  const [communityUsers, setCommunityUsers] = useState([]);
  const [showQuickConnect, setShowQuickConnect] = useState(false);
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
    <div className="min-h-full bg-[#F4F4F6] text-zinc-900 flex flex-col p-4 space-y-3.5">
      {/* Cabecera superior: Título "Chat" a la izquierda; escudo y doble carita a la derecha */}
      <header className="flex items-center justify-between pt-safe">
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">Chat</h1>

        <div className="flex items-center gap-3 text-zinc-600">
          <button
            type="button"
            onClick={() => setShowQuickConnect((v) => !v)}
            className="p-1.5 rounded-full hover:bg-zinc-200/70 transition"
            title="Seguridad y Privacidad 1-a-1"
          >
            <Shield className="w-6 h-6 stroke-[2]" />
          </button>
          <button
            type="button"
            onClick={() => setShowQuickConnect((v) => !v)}
            className="p-1.5 rounded-full hover:bg-zinc-200/70 transition"
            title="Conectar con personas activas"
          >
            <DualFacesIcon />
          </button>
        </div>
      </header>

      {/* Barra de búsqueda tipo píldora blanca */}
      <div className="bg-white rounded-full px-4 py-2.5 shadow-sm flex items-center gap-2.5">
        <Search className="w-4 h-4 text-zinc-400 shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Buscar ${visibleMatches.length} matches`}
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

      {/* Selector rápido de personas activas (cuando toca el ícono superior de doble carita) */}
      {showQuickConnect && communityUsers.length > 0 && (
        <div className="bg-white rounded-2xl p-3 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-zinc-800">
              Personas activas para chatear en privado
            </span>
            <button
              type="button"
              onClick={() => setShowQuickConnect(false)}
              className="text-xs font-bold text-zinc-400"
            >
              Cerrar
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {communityUsers.map((u) => (
              <button
                key={u.uid || u.id}
                type="button"
                onClick={() => onStartChat?.(u)}
                className="flex flex-col items-center shrink-0 w-14"
              >
                <img
                  src={getPrimaryPhoto(u, 150)}
                  alt={u.name}
                  className="w-12 h-12 rounded-full object-cover border border-zinc-200"
                />
                <span className="text-[10px] font-bold text-zinc-700 truncate w-full text-center mt-1">
                  {u.name?.split(' ')[0]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Contenedor principal blanco redondeado */}
      {visibleMatches.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 flex-1 flex flex-col items-center justify-center text-center shadow-sm">
          <BlueHeartDice3D />

          <h2 className="font-serif-display text-2xl font-bold text-zinc-900 mt-4">
            Comienza a deslizar
          </h2>

          <p className="text-xs sm:text-sm text-zinc-500 mt-2 max-w-[260px] leading-relaxed">
            Al hacer match con otras personas, aparecerán aquí para que puedas enviarles un mensaje
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-4 flex-1 flex flex-col space-y-4 shadow-sm overflow-y-auto no-scrollbar">
          {/* Fila horizontal de nuevos matches arriba */}
          <div>
            <p className="text-xs font-extrabold text-zinc-900 mb-2.5 px-1">Nuevos Matches</p>
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
                    className="flex flex-col items-center shrink-0 w-16"
                  >
                    <div className="relative">
                      <img
                        src={getPrimaryPhoto(livePeer, 180)}
                        alt={livePeer.name}
                        className="w-14 h-16 rounded-2xl object-cover bg-zinc-100 border border-zinc-200"
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
          <div className="space-y-1 pt-1 border-t border-zinc-100">
            <p className="text-xs font-extrabold text-zinc-900 mb-2 px-1">Mensajes</p>

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
                  className="w-full p-2.5 rounded-2xl hover:bg-zinc-50 flex items-center gap-3 text-left transition cursor-pointer"
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
                      src={getPrimaryPhoto(livePeer, 160)}
                      alt={livePeer.name}
                      className="w-14 h-14 rounded-full object-cover bg-zinc-100"
                    />
                    {online && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0 border-b border-zinc-100 pb-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-extrabold text-zinc-900 truncate flex items-center gap-1.5">
                        <span className="truncate">{livePeer.name}</span>
                        {match.isVipDirect && (
                          <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-black inline-flex items-center gap-0.5">
                            <Zap className="w-2.5 h-2.5 fill-amber-500" /> VIP
                          </span>
                        )}
                      </p>
                      <span className="text-[11px] text-zinc-400 font-medium shrink-0">
                        {online ? 'Activo' : formatRelativeLastSeen(match.lastMessageAt, false)}
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
