import { useEffect, useState } from 'react';
import { MessageCircleHeart, Zap } from 'lucide-react';
import { getUserById } from '../../services/userService';
import { formatRelativeLastSeen, getPrimaryPhoto, isUserActuallyOnline } from '../../utils/formatters';

export default function ChatList({ matches = [], currentUser, onSelectMatch }) {
  const [peerMap, setPeerMap] = useState({});

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
  const visibleMatches = matches.filter((m) => {
    const peerId = (m.participants || []).find((p) => p !== currentUser.uid);
    return peerId && !blockedSet.has(peerId);
  });

  if (visibleMatches.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center text-center min-h-[60vh]">
        <div className="w-16 h-16 rounded-3xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400 mb-3">
          <MessageCircleHeart className="w-8 h-8" />
        </div>
        <h3 className="text-base font-extrabold text-white">Tus chats aparecerán aquí</h3>
        <p className="text-xs text-slate-400 mt-1.5 max-w-xs leading-relaxed">
          Da Likes en <strong>Descubrir</strong> para hacer Match gratis o envía un{' '}
          <strong>Mensaje Directo VIP</strong> desde cualquier perfil.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2.5">
      <div className="flex items-center justify-between px-1 mb-1">
        <h2 className="text-base font-extrabold text-white">Mensajes en Tiempo Real</h2>
        <span className="text-xs text-slate-400">{visibleMatches.length} chats</span>
      </div>

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

        return (
          <button
            key={match.id}
            type="button"
            onClick={() => onSelectMatch({ match, peerUser: livePeer })}
            className="w-full p-3 rounded-2xl bg-slate-900/90 border border-slate-800/80 hover:border-brand-500/40 flex items-center gap-3 text-left transition"
          >
            <div className="relative shrink-0">
              <img
                src={getPrimaryPhoto(livePeer)}
                alt={livePeer.name}
                className="w-14 h-14 rounded-2xl object-cover bg-slate-800"
              />
              {online && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-slate-900" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                  <span>{livePeer.country?.flag || ''}</span>
                  <span className="truncate">{livePeer.name}</span>
                  {match.isVipDirect && (
                    <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[9px] font-extrabold inline-flex items-center gap-0.5 shrink-0">
                      <Zap className="w-2.5 h-2.5 fill-amber-400" /> VIP
                    </span>
                  )}
                </p>
                <span className="text-[10px] text-slate-500 shrink-0">
                  {online ? 'En línea' : formatRelativeLastSeen(match.lastMessageAt, false)}
                </span>
              </div>

              <p className="text-xs text-slate-400 truncate mt-1">
                {match.lastMessage || 'Empieza a conversar...'}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
