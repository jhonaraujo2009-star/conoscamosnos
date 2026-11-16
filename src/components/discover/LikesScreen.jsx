import { useEffect, useState } from 'react';
import { BadgeCheck, Heart, Lock, MessageCircle, Zap } from 'lucide-react';
import { getUserById, subscribePopularUsers } from '../../services/userService';
import {
  getPrimaryPhoto,
  isBoostActive,
  isProfileVerified,
  isUserActuallyOnline,
} from '../../utils/formatters';

function HeartArrow3D() {
  return (
    <svg
      className="w-36 h-36 drop-shadow-[0_16px_24px_rgba(244,63,94,0.28)]"
      viewBox="0 0 140 140"
      fill="none"
    >
      <defs>
        <radialGradient id="heart3dGrad" cx="35%" cy="28%" r="72%">
          <stop offset="0%" stopColor="#FF8FA3" />
          <stop offset="45%" stopColor="#FF1E42" />
          <stop offset="100%" stopColor="#9E0020" />
        </radialGradient>
        <linearGradient id="arrowShaft" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
      </defs>

      <path d="M100 22L116 20L114 36L100 38Z" fill="#FB7185" />
      <line
        x1="82"
        y1="54"
        x2="115"
        y2="21"
        stroke="url(#arrowShaft)"
        strokeWidth="6"
        strokeLinecap="round"
      />

      <path
        d="M70 112C70 112 22 82 22 50C22 33 35.5 21 51 21C60.5 21 67 26.5 70 32.5C73 26.5 79.5 21 89 21C104.5 21 118 33 118 50C118 82 70 112 70 112Z"
        fill="url(#heart3dGrad)"
      />
      <ellipse
        cx="46"
        cy="42"
        rx="12"
        ry="7"
        transform="rotate(-25 46 42)"
        fill="white"
        fillOpacity="0.55"
      />

      <line
        x1="24"
        y1="112"
        x2="58"
        y2="78"
        stroke="url(#arrowShaft)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <polygon points="16,120 22,100 36,114" fill="url(#arrowShaft)" />
    </svg>
  );
}

export default function LikesScreen({
  currentUser,
  receivedLikes = [],
  onSelectProfile,
  onStartChat,
  onOpenCoinStore,
}) {
  const [subTab, setSubTab] = useState('likes'); // 'likes' | 'top_picks'
  const [topPicks, setTopPicks] = useState([]);
  const [likerProfiles, setLikerProfiles] = useState([]);
  const [revealedLikes, setRevealedLikes] = useState(false);

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
      (list) => setTopPicks(list.slice(0, 16)),
      () => {}
    );
    return () => unsub();
  }, [currentUser?.uid, currentUser?.country?.code, blockedKey]);

  useEffect(() => {
    let cancelled = false;
    const fromIds = Array.from(new Set(receivedLikes.map((l) => l.fromUserId).filter(Boolean)));
    if (fromIds.length === 0) {
      setLikerProfiles([]);
      return;
    }
    Promise.all(fromIds.map((uid) => getUserById(uid).catch(() => null))).then((res) => {
      if (cancelled) return;
      setLikerProfiles(res.filter(Boolean));
    });
    return () => {
      cancelled = true;
    };
  }, [receivedLikes]);

  const likesCount = likerProfiles.length;

  return (
    <div className="min-h-full bg-[#F4F4F6] text-zinc-900 flex flex-col justify-between">
      {/* Cabecera y Barra de sub-pestañas de 2 columnas */}
      <div className="bg-[#F4F4F6] pt-safe">
        <div className="px-4 pt-4 pb-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">Likes</h1>
        </div>

        <div className="grid grid-cols-2 border-b border-zinc-200">
          <button
            type="button"
            onClick={() => setSubTab('likes')}
            className={`py-3 text-sm font-extrabold text-center relative transition-colors ${
              subTab === 'likes' ? 'text-zinc-900' : 'text-zinc-400'
            }`}
          >
            {likesCount} {likesCount === 1 ? 'Like' : 'Likes'}
            {subTab === 'likes' && (
              <span className="absolute bottom-0 inset-x-8 h-[3px] rounded-full bg-[#FF2E54]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setSubTab('top_picks')}
            className={`py-3 text-sm font-extrabold text-center relative flex items-center justify-center gap-1.5 transition-colors ${
              subTab === 'top_picks' ? 'text-zinc-900' : 'text-zinc-400'
            }`}
          >
            <span>Top Picks</span>
            <span className="w-2 h-2 rounded-full bg-[#FF2E54]" />
            {subTab === 'top_picks' && (
              <span className="absolute bottom-0 inset-x-8 h-[3px] rounded-full bg-[#FF2E54]" />
            )}
          </button>
        </div>
      </div>

      {/* Contenido Principal */}
      {subTab === 'likes' ? (
        likerProfiles.length > 0 ? (
          <div className="flex-1 p-4 space-y-3">
            <p className="text-xs font-semibold text-zinc-500 text-center">
              {revealedLikes
                ? 'Personas a las que les gustaste. ¡Toca cualquiera para chatear!'
                : `Tienes ${likesCount} ${likesCount === 1 ? 'persona interesada' : 'personas interesadas'} en ti`}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {likerProfiles.map((user) => {
                const verified = isProfileVerified(user);
                return (
                  <div
                    key={user.uid || user.id}
                    onClick={() => revealedLikes && onSelectProfile(user)}
                    className="bg-white rounded-2xl overflow-hidden shadow-sm cursor-pointer relative"
                  >
                    <div className="aspect-[3/4] relative bg-zinc-200 overflow-hidden">
                      <img
                        src={getPrimaryPhoto(user, 450)}
                        alt={revealedLikes ? user.name : 'Persona interesada'}
                        className={`w-full h-full object-cover transition duration-300 ${
                          revealedLikes ? '' : 'blur-lg scale-110'
                        }`}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      {!revealedLikes ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-3 text-center">
                          <div className="w-10 h-10 rounded-full bg-amber-400/90 text-zinc-950 flex items-center justify-center shadow mb-1.5">
                            <Lock className="w-5 h-5" />
                          </div>
                          <span className="text-xs font-extrabold">Le gustas a alguien</span>
                        </div>
                      ) : (
                        <div className="absolute bottom-2.5 inset-x-3 text-white">
                          <p className="text-sm font-extrabold truncate flex items-center gap-1">
                            <span className="truncate">
                              {user.name}, {user.age}
                            </span>
                            {verified && (
                              <BadgeCheck className="w-4 h-4 text-sky-400 fill-sky-400 stroke-white shrink-0" />
                            )}
                          </p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onStartChat?.(user);
                            }}
                            className="mt-1.5 w-full py-1.5 rounded-full bg-[#FF2E54] text-white text-xs font-bold flex items-center justify-center gap-1"
                          >
                            <MessageCircle className="w-3.5 h-3.5" /> Chatear
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
            <HeartArrow3D />
            <p className="text-sm font-medium text-zinc-600 mt-4 max-w-[250px] leading-relaxed">
              Mira a quién le gustas en Conoscamosnos con VIP Gold
            </p>
          </div>
        )
      ) : (
        <div className="flex-1 p-4">
          {topPicks.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
              <Heart className="w-12 h-12 text-zinc-300 mb-2" />
              <p className="text-sm font-bold text-zinc-700">Hasta acá por los momentos</p>
              <p className="text-xs text-zinc-500 mt-1">Pronto aparecerán más Top Picks aquí.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {topPicks.map((user) => {
                const online = isUserActuallyOnline(user);
                const boosted = isBoostActive(user);
                const verified = isProfileVerified(user);
                return (
                  <div
                    key={user.uid || user.id}
                    onClick={() => onSelectProfile(user)}
                    className="bg-white rounded-2xl overflow-hidden shadow-sm cursor-pointer"
                  >
                    <div className="aspect-[3/4] relative bg-zinc-200">
                      <img
                        src={getPrimaryPhoto(user, 450)}
                        alt={user.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                      {boosted && (
                        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-amber-400 text-black text-[10px] font-black flex items-center gap-0.5">
                          <Zap className="w-2.5 h-2.5 fill-black" /> TOP
                        </span>
                      )}
                      {online && (
                        <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                      )}
                      <div className="absolute bottom-2.5 inset-x-3 text-white">
                        <p className="text-sm font-extrabold truncate flex items-center gap-1">
                          <span className="truncate">
                            {user.name}, {user.age}
                          </span>
                          {verified && (
                            <BadgeCheck className="w-4 h-4 text-sky-400 fill-sky-400 stroke-white shrink-0" />
                          )}
                        </p>
                        <p className="text-[11px] text-white/80 truncate">
                          {user.country?.flag} {user.city || user.country?.name}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Botón negro de ancho completo tipo píldora en la parte inferior */}
      <div className="p-4 pt-2 bg-[#F4F4F6]">
        <button
          type="button"
          onClick={() => {
            if (likerProfiles.length > 0 && !revealedLikes) {
              setRevealedLikes(true);
            } else {
              onOpenCoinStore?.();
            }
          }}
          className="w-full bg-zinc-900 text-white rounded-full py-4 text-sm font-bold shadow-md active:scale-[0.99] transition-transform"
        >
          {likerProfiles.length > 0 && !revealedLikes
            ? `Ver ${likesCount} ${likesCount === 1 ? 'Like' : 'Likes'} ahora`
            : 'Ver Likes ahora'}
        </button>
      </div>
    </div>
  );
}
