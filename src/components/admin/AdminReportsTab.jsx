import { useMemo, useState } from 'react';
import { Ban, CheckCircle2, Flag, Search, ShieldAlert, Unlock } from 'lucide-react';
import { formatGiftDate, getPrimaryPhoto } from '../../utils/formatters';
import { AdminEmptyState, AdminSectionCard } from './AdminPrimitives';

const STATUS_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'open', label: 'Abiertos' },
  { id: 'closed', label: 'Resueltos' },
];

export default function AdminReportsTab({
  reports,
  userById,
  currentAdminUid,
  busyId,
  onToggleBan,
  onUpdateStatus,
}) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filteredReports = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((rep) => {
      const isOpen = !rep.status || rep.status === 'open';
      if (statusFilter === 'open' && !isOpen) return false;
      if (statusFilter === 'closed' && isOpen) return false;
      if (!q) return true;
      return (
        (rep.reportedUserName || '').toLowerCase().includes(q) ||
        (rep.reporterName || '').toLowerCase().includes(q) ||
        (rep.reason || '').toLowerCase().includes(q) ||
        (rep.details || '').toLowerCase().includes(q)
      );
    });
  }, [reports, statusFilter, search]);

  const openCount = reports.filter((r) => !r.status || r.status === 'open').length;

  return (
    <div className="space-y-4">
      <AdminSectionCard accent="crimson" className="p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-black text-[#2C241E] flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-[#FF2E54]" />
              Moderación y Seguridad
            </h2>
            <p className="text-xs text-[#857566] mt-0.5">
              Suspender bloquea la cuenta al instante y la retira de Swipe y Explorar.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-[#FF2E54] text-xs font-extrabold tabular-nums">
            {openCount} abiertos · {reports.length} total
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-[#F3E2DF]">
          <div className="inline-flex p-1 rounded-xl bg-[#F5EDE0] border border-[#E6DAC5] text-xs">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg font-extrabold transition ${
                  statusFilter === f.id
                    ? 'bg-gradient-to-r from-[#FF2E54] to-rose-500 text-white shadow-sm'
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
              placeholder="Buscar denunciado, motivo o autor..."
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#FBF7EE] border border-[#E5D9C3] text-xs text-[#2C241E] placeholder:text-[#9A8B7A] focus:outline-none focus:bg-[#FFFDF9] focus:border-[#FF2E54]"
            />
          </div>
        </div>
      </AdminSectionCard>

      {filteredReports.length === 0 ? (
        <AdminEmptyState
          icon={Flag}
          title="Sin reportes en este filtro"
          description="Cuando la comunidad reporte una cuenta aparecerá aquí con sus evidencias y controles."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredReports.map((rep) => {
            const target = userById[rep.reportedUserId];
            const isBanned = Boolean(target?.isBanned || target?.accountStatus === 'banned');
            const isSelf = rep.reportedUserId === currentAdminUid;
            const isOpen = !rep.status || rep.status === 'open';
            const busy = busyId === rep.id || busyId === rep.reportedUserId;
            const avatar =
              rep.reportedUserPhoto ||
              getPrimaryPhoto(target || { name: rep.reportedUserName || '?' }, 160);

            return (
              <AdminSectionCard
                key={rep.id}
                accent={isOpen && !isBanned ? 'crimson' : 'none'}
                className="p-4 sm:p-5 flex flex-col justify-between space-y-3.5"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={avatar}
                        alt={rep.reportedUserName || 'Perfil'}
                        className="w-12 h-12 rounded-2xl object-cover bg-[#F4ECDD] border border-[#E5D9C3] shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-black text-[#2C241E] truncate">
                            {rep.reportedUserName || target?.name || rep.reportedUserId}
                          </p>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase border ${
                              isBanned
                                ? 'bg-rose-50 border-rose-200 text-rose-700'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            }`}
                          >
                            {isBanned ? 'Suspendido' : 'Activo'}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#857566] truncate mt-0.5">
                          Reportado por <strong className="text-[#3B2E24]">{rep.reporterName || 'Usuario'}</strong> ·{' '}
                          {formatGiftDate(rep.createdAt)}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase shrink-0 border ${
                        isOpen
                          ? 'bg-amber-50 border-amber-200 text-amber-800'
                          : 'bg-[#F4ECDD] border-[#E2D5BE] text-[#5C4E41]'
                      }`}
                    >
                      {rep.status === 'resolved'
                        ? 'Resuelto'
                        : rep.status === 'dismissed'
                        ? 'Descartado'
                        : 'Abierto'}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-[#FDF1EE] border border-[#EED3CC] space-y-1">
                    <p className="text-xs font-extrabold text-rose-700 flex items-center gap-1.5">
                      <Flag className="w-3.5 h-3.5 shrink-0" />
                      {rep.reason}
                    </p>
                    {rep.details && (
                      <p className="text-[11px] text-[#4B3E33] leading-relaxed pl-5">
                        “{rep.details}”
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[#EFE6D6]">
                  {isOpen && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onUpdateStatus(rep, 'dismissed')}
                      className="px-3.5 py-2 rounded-xl bg-[#F4ECDD] hover:bg-[#EAE0CE] border border-[#E2D5BE] text-[#4B3E33] text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 transition"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#7D6C5D]" />
                      Descartar
                    </button>
                  )}

                  {rep.reportedUserId && !isSelf && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        onToggleBan(
                          rep.reportedUserId,
                          rep.reportedUserName || target?.name,
                          isBanned,
                          rep.reason,
                          rep.id
                        )
                      }
                      className={`px-4 py-2 rounded-xl text-xs font-black inline-flex items-center gap-1.5 disabled:opacity-50 transition ${
                        isBanned
                          ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-gradient-to-r from-[#FF2E54] to-rose-500 text-white shadow-sm hover:brightness-110'
                      }`}
                    >
                      {isBanned ? (
                        <>
                          <Unlock className="w-3.5 h-3.5" /> Reactivar cuenta
                        </>
                      ) : (
                        <>
                          <Ban className="w-3.5 h-3.5" /> Suspender cuenta
                        </>
                      )}
                    </button>
                  )}
                </div>
              </AdminSectionCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
