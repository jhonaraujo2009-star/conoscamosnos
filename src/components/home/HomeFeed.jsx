import { useEffect, useState } from 'react';
import { ArrowLeft, Heart, MessageCircle, User } from 'lucide-react';
import { sendLike } from '../../services/discoveryService';
import { subscribePopularUsers } from '../../services/userService';
import { getPrimaryPhoto, isUserActuallyOnline } from '../../utils/formatters';

/* Ilustraciones 3D brillantes en SVG de alta precisión */
function LollipopHeart3D() {
  return (
    <svg className="w-24 h-24 drop-shadow-[0_12px_16px_rgba(244,63,94,0.28)]" viewBox="0 0 120 120" fill="none">
      <defs>
        <radialGradient id="lollipopGrad" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FF758F" />
          <stop offset="45%" stopColor="#FF1E42" />
          <stop offset="100%" stopColor="#9E0020" />
        </radialGradient>
        <linearGradient id="stickGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#CBD5E1" />
        </linearGradient>
      </defs>
      {/* Palito */}
      <rect x="56" y="68" width="8" height="44" rx="4" transform="rotate(-18 60 90)" fill="url(#stickGrad)" />
      {/* Corazón 3D */}
      <path
        d="M60 86C60 86 20 62 20 37C20 23.5 31 14 44 14C52 14 57.5 18.5 60 23.5C62.5 18.5 68 14 76 14C89 14 100 23.5 100 37C100 62 60 86 60 86Z"
        fill="url(#lollipopGrad)"
      />
      {/* Brillo especular 3D */}
      <ellipse cx="40" cy="30" rx="10" ry="6" transform="rotate(-25 40 30)" fill="white" fillOpacity="0.55" />
      <circle cx="33" cy="40" r="2.5" fill="white" fillOpacity="0.4" />
    </svg>
  );
}

function TulipFlower3D() {
  return (
    <svg className="w-24 h-24 drop-shadow-[0_12px_16px_rgba(239,68,68,0.26)]" viewBox="0 0 120 120" fill="none">
      <defs>
        <linearGradient id="stemGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4ADE80" />
          <stop offset="100%" stopColor="#15803D" />
        </linearGradient>
        <radialGradient id="petalCenter" cx="40%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FF8FA3" />
          <stop offset="50%" stopColor="#F43F5E" />
          <stop offset="100%" stopColor="#9F1239" />
        </radialGradient>
        <radialGradient id="petalSide" cx="30%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#FB7185" />
          <stop offset="60%" stopColor="#E11D48" />
          <stop offset="100%" stopColor="#881337" />
        </radialGradient>
      </defs>
      {/* Tallo y Hojas */}
      <rect x="56" y="60" width="8" height="48" rx="4" fill="url(#stemGrad)" />
      <path d="M60 98C60 98 88 90 92 66C76 68 64 80 60 98Z" fill="url(#stemGrad)" />
      <path d="M60 102C60 102 32 92 28 70C44 72 56 84 60 102Z" fill="url(#stemGrad)" />
      {/* Pétalos */}
      <path d="M60 14C45 26 42 52 60 68C78 52 75 26 60 14Z" fill="url(#petalCenter)" />
      <path d="M36 22C30 42 38 64 60 68C50 50 48 34 36 22Z" fill="url(#petalSide)" />
      <path d="M84 22C90 42 82 64 60 68C70 50 72 34 84 22Z" fill="url(#petalSide)" />
      <ellipse cx="55" cy="34" rx="4" ry="10" transform="rotate(-10 55 34)" fill="white" fillOpacity="0.45" />
    </svg>
  );
}

function DiamondRing3D() {
  return (
    <svg className="w-24 h-24 drop-shadow-[0_12px_16px_rgba(236,72,153,0.28)]" viewBox="0 0 120 120" fill="none">
      <defs>
        <linearGradient id="ringBand" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
        <linearGradient id="pinkGem" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FBCFE8" />
          <stop offset="45%" stopColor="#EC4899" />
          <stop offset="100%" stopColor="#9D174D" />
        </linearGradient>
      </defs>
      {/* Aro dorado/plata 3D */}
      <circle cx="60" cy="72" r="30" stroke="url(#ringBand)" strokeWidth="11" />
      <circle cx="60" cy="72" r="30" stroke="white" strokeOpacity="0.35" strokeWidth="3" />
      {/* Diamante Rosa */}
      <polygon points="44,24 76,24 88,38 60,62 32,38" fill="url(#pinkGem)" />
      <polygon points="44,24 76,24 68,38 52,38" fill="#FCE7F3" fillOpacity="0.7" />
      <polygon points="52,38 68,38 60,62" fill="#F472B6" fillOpacity="0.65" />
    </svg>
  );
}

function BlueMoonStar3D() {
  return (
    <svg className="w-24 h-24 drop-shadow-[0_12px_16px_rgba(59,130,246,0.3)]" viewBox="0 0 120 120" fill="none">
      <defs>
        <radialGradient id="moonGrad" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#93C5FD" />
          <stop offset="50%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </radialGradient>
        <radialGradient id="starGrad" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="60%" stopColor="#FACC15" />
          <stop offset="100%" stopColor="#CA8A04" />
        </radialGradient>
      </defs>
      {/* Luna Creciente Azul 3D */}
      <path
        d="M72 20C50 22 32 40 32 63C32 87 52 104 76 102C86 101 94 96 100 90C82 92 66 78 66 58C66 41 76 27 90 22C84 20 78 19.5 72 20Z"
        fill="url(#moonGrad)"
      />
      <ellipse cx="46" cy="48" rx="5" ry="12" transform="rotate(20 46 48)" fill="white" fillOpacity="0.4" />
      {/* Estrella 3D */}
      <path
        d="M84 34L88.5 43L98.5 44.5L91 51.5L93 61.5L84 56.5L75 61.5L77 51.5L69.5 44.5L79.5 43L84 34Z"
        fill="url(#starGrad)"
      />
    </svg>
  );
}

const EXPLORE_CARDS = [
  {
    id: 'nada_serio',
    title: 'Nada serio',
    baseCount: 37,
    filterMatch: 'Chatear / Idiomas',
    Illustration: LollipopHeart3D,
  },
  {
    id: 'pareja_estable',
    title: 'Pareja estable',
    baseCount: 176,
    filterMatch: 'Citas',
    Illustration: TulipFlower3D,
  },
  {
    id: 'compromiso_serio',
    title: 'Compromiso serio',
    baseCount: 101,
    filterMatch: 'Citas',
    Illustration: DiamondRing3D,
  },
  {
    id: 'libre_hoy',
    title: 'Estoy libre hoy',
    baseCount: 57,
    filterMatch: 'Hacer Amigos',
    Illustration: BlueMoonStar3D,
  },
];

export default function HomeFeed({
  currentUser,
  onSelectProfile,
  onStartChat,
  onSuccess,
  onError,
}) {
  const [users, setUsers] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [likedIds, setLikedIds] = useState({});

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
      setUsers,
      () => {}
    );
    return () => unsub();
  }, [currentUser?.uid, currentUser?.country?.code, blockedKey]);

  const handleQuickLike = async (e, targetUser) => {
    e.stopPropagation();
    const uid = targetUser.uid || targetUser.id;
    if (!uid || likedIds[uid]) return;
    try {
      const res = await sendLike({ currentUser, targetUser });
      setLikedIds((prev) => ({ ...prev, [uid]: true }));
      if (res.matched) {
        onSuccess?.(`🎉 ¡Es un Match con ${targetUser.name}!`);
      } else {
        onSuccess?.(`❤️ Like enviado a ${targetUser.name}`);
      }
    } catch (err) {
      onError?.(err.message || 'No se pudo enviar Like.');
    }
  };

  if (selectedCategory) {
    return (
      <div className="min-h-full bg-[#F4F4F6] text-zinc-900 p-4 space-y-4">
        <div className="flex items-center gap-3 pt-safe">
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-zinc-800"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-extrabold text-zinc-900">{selectedCategory.title}</h2>
            <p className="text-xs text-zinc-500">Perfiles disponibles para conectar</p>
          </div>
        </div>

        {users.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <p className="text-sm font-bold text-zinc-800">Hasta acá por los momentos</p>
            <p className="text-xs text-zinc-500 mt-1">
              No hay más perfiles cargados en esta categoría ahora mismo.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {users.map((u) => {
              const uid = u.uid || u.id;
              const online = isUserActuallyOnline(u);
              const liked = Boolean(likedIds[uid]);
              return (
                <div
                  key={uid}
                  onClick={() => onSelectProfile(u)}
                  className="bg-white rounded-2xl overflow-hidden shadow-sm flex flex-col cursor-pointer"
                >
                  <div className="aspect-[3/4] relative bg-zinc-200">
                    <img
                      src={getPrimaryPhoto(u, 500)}
                      alt={u.name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    {online && (
                      <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                    )}
                    <div className="absolute bottom-2.5 inset-x-3 text-white">
                      <p className="text-sm font-extrabold truncate">
                        {u.name}, {u.age}
                      </p>
                      <p className="text-[11px] text-white/80 truncate">
                        {u.country?.flag} {u.city || u.country?.name}
                      </p>
                    </div>
                  </div>
                  <div className="p-2 grid grid-cols-2 gap-1.5 bg-white">
                    <button
                      type="button"
                      onClick={(e) => handleQuickLike(e, u)}
                      className={`py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 ${
                        liked ? 'bg-rose-50 text-[#FF2E54]' : 'bg-zinc-100 text-zinc-800'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-[#FF2E54] text-[#FF2E54]' : ''}`} />
                      Like
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartChat?.(u);
                      }}
                      className="py-1.5 rounded-xl bg-zinc-900 text-white text-xs font-bold flex items-center justify-center gap-1"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      Chat
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#F4F4F6] text-zinc-900 flex flex-col">
      {/* Cabecera limpia sobre fondo #F4F4F6 */}
      <header className="px-4 pt-4 pb-1 pt-safe">
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">Explorar</h1>
        <p className="text-sm font-medium text-zinc-500 mt-1 leading-snug">
          Encuentra personas que buscan lo mismo en una relación
        </p>
      </header>

      {/* Grid de 2 columnas con tarjetas blancas verticales */}
      <div className="grid grid-cols-2 gap-3 p-4">
        {EXPLORE_CARDS.map((card) => {
          const Illustration = card.Illustration;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => setSelectedCategory(card)}
              className="bg-white rounded-2xl p-4 shadow-sm flex flex-col justify-between aspect-[3/4] text-left active:scale-[0.98] transition-transform"
            >
              <div className="w-full" />

              {/* Ilustración estilo 3D grande y brillante en el centro */}
              <div className="flex items-center justify-center my-auto">
                <Illustration />
              </div>

              {/* Base: título en negrita a la izquierda y contador numérico a la derecha */}
              <div className="w-full flex items-end justify-between gap-2 pt-2">
                <span className="text-sm font-extrabold text-zinc-900 leading-tight">
                  {card.title}
                </span>
                <span className="text-xs font-bold text-zinc-400 flex items-center gap-0.5 shrink-0">
                  <User className="w-3 h-3 fill-zinc-400 text-zinc-400" />
                  {card.baseCount}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
