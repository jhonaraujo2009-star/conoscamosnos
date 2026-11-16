import { useEffect, useState } from 'react';
import { Crown, Flame, Gift, Globe, MapPin, Zap } from 'lucide-react';
import { subscribePopularUsers, subscribeVipUsers } from '../../services/userService';
import { getPrimaryPhoto, isBoostActive, isUserActuallyOnline } from '../../utils/formatters';

export default function HomeFeed({
  currentUser,
  onSelectProfile,
  onOpenBoost,
}) {
  const [scope, setScope] = useState('global'); // 'local' | 'global'
  const [vipUsers, setVipUsers] = useState([]);
  const [popularUsers, setPopularUsers] = useState([]);
  const [indexWarning, setIndexWarning] = useState(false);

  useEffect(() => {
    if (!currentUser?.uid) return;
    setIndexWarning(false);

    const unsubVip = subscribeVipUsers(
      {
        scope,
        countryCode: currentUser?.country?.code,
        currentUserId: currentUser.uid,
        blockedUsers: currentUser?.blockedUsers || [],
      },
      setVipUsers,
      () => setIndexWarning(true)
    );

    const unsubPopular = subscribePopularUsers(
      {
        scope,
        countryCode: currentUser?.country?.code,
        currentUserId: currentUser.uid,
        blockedUsers: currentUser?.blockedUsers || [],
      },
      setPopularUsers,
      () => setIndexWarning(true)
    );

    return () => {
      unsubVip();
      unsubPopular();
    };
  }, [scope, currentUser?.uid, currentUser?.country?.code, currentUser?.blockedUsers]);

  const userBoosted = isBoostActive(currentUser);

  return (
    <div className="p-3.5 space-y-5">
      {/* Quick Filter: Mi País vs Todo el Mundo */}
      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-slate-900 border border-slate-800">
        <button
          type="button"
          onClick={() => setScope('local')}
          className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
            scope === 'local'
              ? 'bg-gradient-to-r from-brand-500 to-pink-500 text-white shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>{currentUser?.country?.flag || '📍'}</span>
          Mi País ({currentUser?.country?.name})
        </button>
        <button
          type="button"
          onClick={() => setScope('global')}
          className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
            scope === 'global'
              ? 'bg-gradient-to-r from-brand-500 to-pink-500 text-white shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          Todo el Mundo
        </button>
      </div>

      {indexWarning && (
        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-amber-200 text-xs">
          Despliega los índices de <code className="px-1 bg-slate-950 rounded">firestore.indexes.json</code> en Firebase para habilitar las consultas ordenadas por país y popularidad.
        </div>
      )}

      {/* Carousel: Destacados VIP */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-sm font-extrabold text-white flex items-center gap-1.5">
            <span className="text-base">👑</span> Destacados VIP
          </h2>
          <button
            type="button"
            onClick={onOpenBoost}
            className="px-2.5 py-1 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-300 text-[11px] font-bold flex items-center gap-1 hover:bg-amber-400/25"
          >
            <Zap className="w-3 h-3 fill-amber-400" />
            {userBoosted ? 'Extender VIP' : 'Aparecer aquí'}
          </button>
        </div>

        {vipUsers.length === 0 ? (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-brand-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-amber-200">
                ¡Sé el primero en Destacados VIP {scope === 'local' ? `en ${currentUser?.country?.name}` : 'del mundo'}!
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Activa tu Boost VIP y recibe más likes y regalos.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenBoost}
              className="px-3 py-2 rounded-xl bg-amber-400 text-slate-950 text-xs font-extrabold shrink-0"
            >
              Activar Boost
            </button>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {vipUsers.map((user) => {
              const online = isUserActuallyOnline(user);
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => onSelectProfile(user)}
                  className="relative w-28 shrink-0 rounded-2xl overflow-hidden bg-slate-900 border-2 border-amber-400/70 shadow-lg shadow-amber-500/10 text-left group"
                >
                  <div className="aspect-[3/4] relative">
                    <img
                      src={getPrimaryPhoto(user, 360)}
                      alt={user.name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/30" />

                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black flex items-center gap-0.5">
                      <Crown className="w-2.5 h-2.5" /> VIP
                    </span>

                    {online && (
                      <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-950" />
                    )}

                    <div className="absolute bottom-1.5 inset-x-2">
                      <p className="text-xs font-extrabold text-white truncate">
                        {user.country?.flag} {user.name}
                      </p>
                      <p className="text-[10px] text-slate-300 truncate">
                        {user.city || user.country?.name}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Grid: Más Populares */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-sm font-extrabold text-white flex items-center gap-1.5">
            <span className="text-base">🔥</span> Más Populares
          </h2>
          <span className="text-[11px] text-slate-400">
            Ordenado por Likes y Regalos
          </span>
        </div>

        {popularUsers.length === 0 ? (
          <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 text-center">
            <p className="text-xs text-slate-400">
              Aún no hay otros perfiles visibles en esta región. ¡Prueba cambiando a{' '}
              <strong>Todo el Mundo</strong>!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {popularUsers.map((user, idx) => {
              const online = isUserActuallyOnline(user);
              const boosted = isBoostActive(user);
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => onSelectProfile(user)}
                  className="relative rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 hover:border-brand-500/50 text-left group transition shadow-lg"
                >
                  <div className="aspect-[3/4] relative">
                    <img
                      src={getPrimaryPhoto(user, 500)}
                      alt={user.name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-black/25" />

                    {/* Top Ranking / Boost Badge */}
                    <div className="absolute top-2 inset-x-2 flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-full bg-slate-950/80 backdrop-blur-md text-[10px] font-extrabold text-amber-300 border border-white/10">
                        #{idx + 1}
                      </span>
                      <div className="flex items-center gap-1">
                        {boosted && (
                          <span className="p-1 rounded-full bg-amber-400 text-slate-950">
                            <Zap className="w-3 h-3 fill-slate-950" />
                          </span>
                        )}
                        {online && (
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-950" />
                        )}
                      </div>
                    </div>

                    {/* Bottom Profile Summary */}
                    <div className="absolute bottom-2 inset-x-2.5 space-y-1">
                      <p className="text-sm font-extrabold text-white truncate">
                        {user.name}, {user.age}
                      </p>
                      <p className="text-[11px] text-slate-300 truncate flex items-center gap-1">
                        <span>{user.country?.flag}</span>
                        <MapPin className="w-3 h-3 text-brand-400 shrink-0" />
                        <span className="truncate">{user.city || user.country?.name}</span>
                      </p>
                      <div className="flex items-center gap-2.5 pt-0.5 text-[11px] font-bold">
                        <span className="flex items-center gap-1 text-rose-300">
                          <Flame className="w-3 h-3" /> {user.likesCount || 0}
                        </span>
                        <span className="flex items-center gap-1 text-amber-300">
                          <Gift className="w-3 h-3" /> {user.giftsReceivedCount || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
