import { useMemo, useState } from 'react';
import { BadgeCheck, Camera, Search, UserCheck } from 'lucide-react';
import { getPrimaryPhoto, isProfileVerified, toMillis } from '../../utils/formatters';
import { AdminEmptyState, AdminSectionCard } from './AdminPrimitives';

export default function AdminVerificationTab({
  users,
  pendingVerificationsCount,
  busyId,
  onToggleBlueCheck,
}) {
  const [filter, setFilter] = useState('all'); // 'all' | 'pending' | 'verified'
  const [search, setSearch] = useState('');

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users
      .filter((u) => {
        const verified = isProfileVerified(u);
        if (filter === 'pending' && (verified || u.verificationStatus !== 'pending')) return false;
        if (filter === 'verified' && !verified) return false;
        if (!q) return true;
        return (
          (u.name || '').toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q) ||
          (u.city || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const aPending = a.verificationStatus === 'pending' && !isProfileVerified(a) ? 1 : 0;
        const bPending = b.verificationStatus === 'pending' && !isProfileVerified(b) ? 1 : 0;
        if (bPending !== aPending) return bPending - aPending;
        return toMillis(b.createdAt) - toMillis(a.createdAt);
      });
  }, [users, filter, search]);

  return (
    <div className="space-y-4">
      <AdminSectionCard accent="sky" className="p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-black text-[#2C241E] flex items-center gap-2">
              <BadgeCheck className="w-5 h-5 text-sky-500 fill-sky-500 stroke-white" />
              Identidad Verificada (Check Azul)
            </h2>
            <p className="text-xs text-[#857566] mt-0.5">
              Revisa fotos reales y biografía antes de conceder o revocar la insignia azul.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-xs font-extrabold tabular-nums">
            {filteredUsers.length} perfiles
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-sky-200/60">
          <div className="inline-flex p-1 rounded-xl bg-[#F5EDE0] border border-[#E6DAC5] text-xs">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'pending', label: `Solicitudes (${pendingVerificationsCount})` },
              { id: 'verified', label: 'Verificados' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg font-extrabold transition ${
                  filter === f.id
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-[#5C4E41] hover:text-[#2C241E]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-[#9A8B7A] absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nombre, correo o ciudad..."
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#FBF7EE] border border-[#E5D9C3] text-xs text-[#2C241E] placeholder:text-[#9A8B7A] focus:outline-none focus:bg-[#FFFDF9] focus:border-sky-400"
            />
          </div>
        </div>
      </AdminSectionCard>

      {filteredUsers.length === 0 ? (
        <AdminEmptyState
          icon={UserCheck}
          title="Sin perfiles en este filtro"
          description="Cambia el filtro o busca otro nombre, correo o ciudad."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredUsers.map((u) => {
            const verified = isProfileVerified(u);
            const isPending = u.verificationStatus === 'pending' && !verified;
            const busy = busyId === u.uid;
            const photosCount = Array.isArray(u.photos) ? u.photos.filter(Boolean).length : 0;

            return (
              <AdminSectionCard
                key={u.uid}
                accent={isPending ? 'amber' : verified ? 'sky' : 'none'}
                className="p-4 sm:p-5 flex flex-col justify-between space-y-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={getPrimaryPhoto(u, 180)}
                      alt={u.name}
                      className="w-14 h-14 rounded-2xl object-cover bg-[#F4ECDD] border border-[#E5D9C3] shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-black text-[#2C241E] flex items-center gap-1.5">
                        <span className="truncate">
                          {u.name}
                          {u.age ? `, ${u.age}` : ''}
                        </span>
                        {verified && (
                          <BadgeCheck className="w-4 h-4 text-sky-500 fill-sky-500 stroke-white shrink-0" />
                        )}
                      </p>
                      <p className="text-[11px] text-[#857566] truncate">{u.email}</p>
                      <p className="text-[11px] text-[#5C4E41] mt-0.5 truncate">
                        {u.country?.flag || '🌎'} {u.city || u.country?.name || 'Global'} ·{' '}
                        <span className="inline-flex items-center gap-1 text-[#857566]">
                          <Camera className="w-3 h-3" /> {photosCount} fotos
                        </span>
                      </p>
                    </div>
                  </div>

                  {verified ? (
                    <span className="px-2.5 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-[10px] font-black uppercase shrink-0">
                      Verificado
                    </span>
                  ) : isPending ? (
                    <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-black uppercase shrink-0">
                      Pendiente
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-[#F4ECDD] border border-[#E2D5BE] text-[#5C4E41] text-[10px] font-bold uppercase shrink-0">
                      Estándar
                    </span>
                  )}
                </div>

                {u.bio && (
                  <p className="text-[11px] text-[#5C4E41] bg-[#FAF4E8] border border-[#E6DAC5] rounded-xl px-3 py-2 line-clamp-2">
                    “{u.bio}”
                  </p>
                )}

                <div className="flex justify-end pt-2 border-t border-[#EFE6D6]">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onToggleBlueCheck(u)}
                    className={`px-4 py-2 rounded-xl text-xs font-black inline-flex items-center gap-1.5 disabled:opacity-50 transition ${
                      verified
                        ? 'bg-[#F4ECDD] hover:bg-rose-50 border border-[#E2D5BE] text-[#4B3E33] hover:text-rose-700 hover:border-rose-200'
                        : 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white hover:brightness-105 shadow-sm'
                    }`}
                  >
                    <BadgeCheck className="w-4 h-4" />
                    {busy ? 'Actualizando...' : verified ? 'Revocar Check' : 'Otorgar Check Azul'}
                  </button>
                </div>
              </AdminSectionCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
