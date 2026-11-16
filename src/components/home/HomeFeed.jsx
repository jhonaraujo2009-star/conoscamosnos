import { useEffect, useMemo, useState } from 'react';
import {
  Crown,
  Flame,
  Gift,
  Globe,
  Heart,
  MapPin,
  MessageCircle,
  Search,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { LOOKING_FOR_OPTIONS } from '../../config/constants';
import { sendLike } from '../../services/discoveryService';
import { subscribePopularUsers, subscribeVipUsers } from '../../services/userService';
import {
  getPrimaryPhoto,
  getSharedInterests,
  isBoostActive,
  isUserActuallyOnline,
} from '../../utils/formatters';

export default function HomeFeed({
  currentUser,
  onSelectProfile,
  onStartChat,
  onOpenBoost,
  onSuccess,
  onError,
}) {
  const [scope, setScope] = useState('global'); // 'local' | 'global'
  const [intentionFilter, setIntentionFilter] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [vipUsers, setVipUsers] = useState([]);
  const [popularUsers, setPopularUsers] = useState([]);
  const [likedLocalIds, setLikedLocalIds] = useState({});
  const [busyLikeId, setBusyLikeId] = useState(null);
  const [indexWarning, setIndexWarning] = useState(false);

  const blockedKey = (currentUser?.blockedUsers || []).join(',');

  useEffect(() => {
    if (!currentUser?.uid) return;
    setIndexWarning(false);
    const blockedList = currentUser?.blockedUsers || [];

    const unsubVip = subscribeVipUsers(
      {
        scope,
        countryCode: currentUser?.country?.code,
        currentUserId: currentUser.uid,
        blockedUsers: blockedList,
      },
      setVipUsers,
      () => setIndexWarning(true)
    );

    const unsubPopular = subscribePopularUsers(
      {
        scope,
        countryCode: currentUser?.country?.code,
        currentUserId: currentUser.uid,
        blockedUsers: blockedList,
      },
      setPopularUsers,
      () => setIndexWarning(true)
    );

    return () => {
      unsubVip();
      unsubPopular();
    };
  }, [scope, currentUser?.uid, currentUser?.country?.code, blockedKey]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return popularUsers.filter((user) => {
      if (intentionFilter !== 'Todos' && user.lookingFor !== intentionFilter) {
        return false;
      }
      if (!q) return true;
      const inName = (user.name || '').toLowerCase().includes(q);
      const inCity = (user.city || '').toLowerCase().includes(q);
      const inCountry = (user.country?.name || '').toLowerCase().includes(q);
      const inInterests = (user.interests || []).some((i) => i.toLowerCase().includes(q));
      return inName || inCity || inCountry || inInterests;
    });
  }, [popularUsers, intentionFilter, searchQuery]);

  const handleQuickLike = async (e, targetUser) => {
    e.stopPropagation();
    const targetId = targetUser.uid || targetUser.id;
    if (!targetId || busyLikeId === targetId || likedLocalIds[targetId]) return;

    setBusyLikeId(targetId);
    try {
      const res = await sendLike({ currentUser, targetUser });
      setLikedLocalIds((prev) => ({ ...prev, [targetId]: true }));
      if (res.matched) {
        onSuccess?.(`🎉 ¡Hiciste Match con ${targetUser.name}! Ya pueden chatear.`);
      } else {
        onSuccess?.(`❤️ Le enviaste un Like a ${targetUser.name}`);
      }
    } catch (err) {
      onError?.(err.message || 'No se pudo enviar el Like.');
    } finally {
      setBusyLikeId(null);
    }
  };

  const userBoosted = isBoostActive(currentUser);

  return (
    <div className="p-4 space-y-5">
      {/* Editorial Hero & Region Toggle */}
      <div className="bg-white rounded-3xl p-4 border border-rose-100/90 shadow-card space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-brand-600 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Comunidad Activa
            </p>
            <h1 className="font-display text-lg font-extrabold text-slate-900 mt-0.5">
              Hola, {currentUser?.name?.split(' ')[0]} 👋
            </h1>
          </div>

          <div className="inline-flex p-1 rounded-2xl bg-slate-100/90 border border-slate-200/70">
            <button
              type="button"
              onClick={() => setScope('global')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                scope === 'global'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-brand-500" />
              Global
            </button>
            <button
              type="button"
              onClick={() => setScope('local')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                scope === 'local'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{currentUser?.country?.flag || '📍'}</span>
              {currentUser?.country?.name}
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, ciudad, país o interés..."
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

        {/* Intention Chips */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
          {['Todos', ...LOOKING_FOR_OPTIONS].map((opt) => {
            const active = intentionFilter === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setIntentionFilter(opt)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition ${
                  active
                    ? 'bg-gradient-to-r from-brand-500 to-rose-500 text-white border-transparent shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200/80 hover:border-brand-300'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {indexWarning && (
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
          Mostrando perfiles en modo compatible. Despliega <code className="px-1 bg-white rounded border">firestore.indexes.json</code> para consultas avanzadas.
        </div>
      )}

      {/* Carousel: Destacados VIP */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
              <Crown className="w-3.5 h-3.5 fill-amber-500" />
            </div>
            <h2 className="font-display text-sm font-extrabold text-slate-900">
              Destacados VIP
            </h2>
          </div>
          <button
            type="button"
            onClick={onOpenBoost}
            className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300/80 text-amber-800 text-[11px] font-extrabold flex items-center gap-1 hover:brightness-95 shadow-sm transition"
          >
            <Zap className="w-3 h-3 fill-amber-500 text-amber-500" />
            {userBoosted ? 'Extender VIP' : 'Destacar mi perfil'}
          </button>
        </div>

        {vipUsers.length === 0 ? (
          <div className="p-4 rounded-3xl bg-gradient-to-r from-amber-50/90 via-white to-rose-50/90 border border-amber-200/80 shadow-card flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-slate-900">
                ✨ Aparece primero en {scope === 'local' ? currentUser?.country?.name : 'Todo el Mundo'}
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Multiplica tus visitas y recibe mensajes directos al instante.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenBoost}
              className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-extrabold shrink-0 shadow-sm hover:brightness-105 transition"
            >
              Activar VIP
            </button>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {vipUsers.map((user) => {
              const online = isUserActuallyOnline(user);
              return (
                <div
                  key={user.id}
                  onClick={() => onSelectProfile(user)}
                  className="relative w-32 shrink-0 rounded-3xl p-[2px] bg-gradient-to-b from-amber-400 via-rose-400 to-amber-500 shadow-md cursor-pointer group"
                >
                  <div className="rounded-[22px] overflow-hidden bg-white relative aspect-[3/4]">
                    <img
                      src={getPrimaryPhoto(user, 360)}
                      alt={user.name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/15" />

                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black flex items-center gap-0.5 shadow">
                      <Crown className="w-2.5 h-2.5" /> VIP
                    </span>

                    {online && (
                      <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-white" />
                    )}

                    <div className="absolute bottom-2 inset-x-2">
                      <p className="text-xs font-extrabold text-white truncate">
                        {user.country?.flag} {user.name}, {user.age}
                      </p>
                      <p className="text-[10px] text-white/80 truncate">
                        {user.city || user.country?.name}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Grid: Perfiles de la Comunidad */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-display text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-brand-500 fill-brand-500" />
            Personas para Conectar ({filteredUsers.length})
          </h2>
          <span className="text-[11px] font-semibold text-slate-500">
            Toca para ver o chatear
          </span>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="p-8 rounded-3xl bg-white border border-slate-200/80 shadow-card text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-50 text-brand-500 flex items-center justify-center">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-slate-800">
                No encontramos perfiles con ese filtro
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Prueba cambiando a <strong>Global</strong> o seleccionando <strong>Todos</strong>.
              </p>
            </div>
            {(scope !== 'global' || intentionFilter !== 'Todos' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setScope('global');
                  setIntentionFilter('Todos');
                  setSearchQuery('');
                }}
                className="px-4 py-2 rounded-xl bg-brand-50 text-brand-600 text-xs font-bold hover:bg-brand-100 transition"
              >
                Ver todos los perfiles
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3.5">
            {filteredUsers.map((user) => {
              const uid = user.uid || user.id;
              const online = isUserActuallyOnline(user);
              const boosted = isBoostActive(user);
              const sharedCount = getSharedInterests(currentUser, user).length;
              const isLiked = Boolean(likedLocalIds[uid]);

              return (
                <div
                  key={uid}
                  onClick={() => onSelectProfile(user)}
                  className="rounded-3xl overflow-hidden bg-white border border-slate-200/80 hover:border-brand-300 shadow-card hover:shadow-luxury transition-all duration-300 flex flex-col cursor-pointer group"
                >
                  {/* Photo Area */}
                  <div className="aspect-[4/5] relative overflow-hidden bg-slate-100">
                    <img
                      src={getPrimaryPhoto(user, 500)}
                      alt={user.name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/10 to-transparent" />

                    {/* Top Status Badges */}
                    <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between gap-1">
                      <span className="px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-md text-[10px] font-bold text-slate-800 shadow-sm truncate">
                        {user.lookingFor || 'Conectar'}
                      </span>

                      <div className="flex items-center gap-1 shrink-0">
                        {boosted && (
                          <span className="p-1 rounded-full bg-amber-400 text-slate-950 shadow">
                            <Zap className="w-3 h-3 fill-slate-950" />
                          </span>
                        )}
                        {online && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/90 text-white text-[9px] font-extrabold flex items-center gap-1 shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            Online
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Photo Bottom Overlay Info */}
                    <div className="absolute bottom-2.5 inset-x-3 text-white">
                      <p className="font-display text-sm font-extrabold truncate leading-tight">
                        {user.name}, {user.age}
                      </p>
                      <p className="text-[11px] text-white/90 truncate flex items-center gap-1 mt-0.5">
                        <span>{user.country?.flag}</span>
                        <MapPin className="w-3 h-3 text-rose-300 shrink-0" />
                        <span className="truncate">{user.city || user.country?.name}</span>
                      </p>
                    </div>
                  </div>

                  {/* Card Footer: Metadata + Quick Actions (Like & Direct Chat) */}
                  <div className="p-2.5 bg-white flex flex-col justify-between gap-2">
                    <div className="flex items-center justify-between text-[11px] font-bold px-0.5">
                      <div className="flex items-center gap-2 text-slate-600">
                        <span className="flex items-center gap-0.5 text-rose-500">
                          <Flame className="w-3.5 h-3.5 fill-rose-500" />
                          {(user.likesCount || 0) + (isLiked ? 1 : 0)}
                        </span>
                        <span className="flex items-center gap-0.5 text-amber-600">
                          <Gift className="w-3.5 h-3.5" />
                          {user.giftsReceivedCount || 0}
                        </span>
                      </div>

                      {sharedCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold border border-emerald-200/60">
                          ✨ {sharedCount} en común
                        </span>
                      )}
                    </div>

                    {/* Direct Interaction Buttons */}
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        disabled={isLiked || busyLikeId === uid}
                        onClick={(e) => handleQuickLike(e, user)}
                        className={`py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1 border transition ${
                          isLiked
                            ? 'bg-rose-50 border-rose-200 text-rose-600'
                            : 'bg-slate-50 border-slate-200/80 text-slate-700 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200'
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-rose-500 text-rose-500' : 'text-rose-500'}`} />
                        <span>{isLiked ? 'Te gusta' : 'Like'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartChat?.(user);
                        }}
                        className="py-2 rounded-xl bg-gradient-to-r from-brand-500 to-rose-500 text-white text-xs font-extrabold flex items-center justify-center gap-1 shadow-sm hover:brightness-105 active:scale-95 transition"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Chatear</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
