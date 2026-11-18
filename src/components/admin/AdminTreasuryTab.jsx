import { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock,
  Coins,
  ExternalLink,
  Search,
  ShieldCheck,
  Wallet,
  Webhook,
  XCircle,
  ZoomIn,
} from 'lucide-react';
import { formatGiftDate, formatUSD, getPrimaryPhoto, toMillis } from '../../utils/formatters';
import { AdminCopyButton, AdminEmptyState, AdminSectionCard } from './AdminPrimitives';

const RECHARGE_REJECT_REASONS = [
  'Referencia no localizada',
  'Comprobante ilegible',
  'Monto incompleto',
];

const WITHDRAWAL_REJECT_REASONS = [
  'Cuenta de cobro inválida',
  'Datos incompletos del titular',
  'Revisión de seguridad pendiente',
];

export default function AdminTreasuryTab({
  metrics,
  paymentRequests,
  paymentTxs,
  withdrawals,
  userById,
  copiedKey,
  busyId,
  payoutRefs,
  onPayoutRefChange,
  onCopy,
  onPreviewImg,
  onApproveRecharge,
  onRejectRecharge,
  onPayWithdrawal,
  onRejectWithdrawal,
}) {
  const [subTab, setSubTab] = useState('recharges'); // 'recharges' | 'withdrawals' | 'webhooks'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'done' | 'rejected'
  const [search, setSearch] = useState('');
  const [rejectDraft, setRejectDraft] = useState(null); // { kind: 'recharge' | 'withdrawal', id, reason }

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...paymentRequests]
      .filter((r) => {
        if (statusFilter === 'pending' && r.status !== 'pending') return false;
        if (statusFilter === 'done' && r.status !== 'approved') return false;
        if (statusFilter === 'rejected' && r.status !== 'rejected') return false;
        if (!q) return true;
        return (
          (r.userName || '').toLowerCase().includes(q) ||
          (r.userEmail || '').toLowerCase().includes(q) ||
          (r.methodName || '').toLowerCase().includes(q) ||
          (r.referenceNumber || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const ap = a.status === 'pending' ? 0 : 1;
        const bp = b.status === 'pending' ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return toMillis(b.createdAt) - toMillis(a.createdAt);
      });
  }, [paymentRequests, statusFilter, search]);

  const filteredWithdrawals = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...withdrawals]
      .filter((w) => {
        if (statusFilter === 'pending' && w.status !== 'pending') return false;
        if (statusFilter === 'done' && w.status !== 'paid') return false;
        if (statusFilter === 'rejected' && w.status !== 'rejected') return false;
        if (!q) return true;
        return (
          (w.userName || '').toLowerCase().includes(q) ||
          (w.userEmail || '').toLowerCase().includes(q) ||
          (w.payoutMethodName || '').toLowerCase().includes(q) ||
          (w.payoutDetails || '').toLowerCase().includes(q) ||
          (w.payoutReference || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const ap = a.status === 'pending' ? 0 : 1;
        const bp = b.status === 'pending' ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return toMillis(b.createdAt) - toMillis(a.createdAt);
      });
  }, [withdrawals, statusFilter, search]);

  const filteredTxs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return paymentTxs.filter((tx) => {
      if (!q) return true;
      return (
        (tx.userName || '').toLowerCase().includes(q) ||
        (tx.userId || '').toLowerCase().includes(q) ||
        (tx.provider || '').toLowerCase().includes(q) ||
        (tx.externalPaymentId || '').toLowerCase().includes(q)
      );
    });
  }, [paymentTxs, search]);

  return (
    <div className="space-y-5">
      {/* KPI Ejecutivo de Tesorería */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <AdminSectionCard accent="emerald" className="p-4 sm:p-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-emerald-300">
              Ingresos Totales
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-400/25 text-emerald-300 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <p className="font-display text-2xl sm:text-3xl font-black text-white tabular-nums">
            {formatUSD(metrics.totalRevenueUSD)}
          </p>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10.5px] text-zinc-400 pt-2 border-t border-white/[0.07]">
            <span>
              API: <strong className="text-zinc-200">{formatUSD(metrics.gatewayCompletedUSD)}</strong>
            </span>
            <span>
              Manual: <strong className="text-zinc-200">{formatUSD(metrics.manualApprovedUSD)}</strong>
            </span>
            <span>
              Ads: <strong className="text-amber-300">{formatUSD(metrics.adEstRevenueUSD)}</strong>
            </span>
          </div>
        </AdminSectionCard>

        <AdminSectionCard accent="amber" className="p-4 sm:p-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-amber-300">
              Pendiente en Cola
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-400/15 border border-amber-300/25 text-amber-300 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => {
                setSubTab('recharges');
                setStatusFilter('pending');
              }}
              className="w-full px-2.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] flex items-center justify-between text-xs transition"
            >
              <span className="text-zinc-300 font-semibold">Recargas</span>
              <span className="font-extrabold text-amber-300 tabular-nums">
                {metrics.pendingRechargesCount} ({formatUSD(metrics.pendingRechargesUSD)})
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSubTab('withdrawals');
                setStatusFilter('pending');
              }}
              className="w-full px-2.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] flex items-center justify-between text-xs transition"
            >
              <span className="text-zinc-300 font-semibold">Retiros</span>
              <span className="font-extrabold text-sky-300 tabular-nums">
                {metrics.pendingWithdrawalsCount} ({formatUSD(metrics.pendingWithdrawalsUSD)})
              </span>
            </button>
          </div>
        </AdminSectionCard>

        <AdminSectionCard accent="sky" className="p-4 sm:p-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-sky-300">
              Pagado a Creadores
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-400/25 text-sky-300 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <p className="font-display text-2xl sm:text-3xl font-black text-white tabular-nums">
            {formatUSD(metrics.totalPaidOutUSD)}
          </p>
          <p className="text-[11px] text-zinc-400 pt-2 border-t border-white/[0.07]">
            <strong className="text-sky-200 tabular-nums">{metrics.paidWithdrawalsCount}</strong>{' '}
            liquidaciones confirmadas
          </p>
        </AdminSectionCard>

        <AdminSectionCard accent="crimson" className="p-4 sm:p-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-rose-300">
              Balance Neto Caja
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#FF2E54]/15 border border-[#FF2E54]/25 text-rose-300 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <p className="font-display text-2xl sm:text-3xl font-black text-white tabular-nums">
            {formatUSD(metrics.netBalanceUSD)}
          </p>
          <p className="text-[11px] text-zinc-400 pt-2 border-t border-white/[0.07]">
            Margen neto después de retiros
          </p>
        </AdminSectionCard>
      </div>

      {/* Sub-navegación + Búsqueda + Filtros */}
      <AdminSectionCard className="p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap p-1 rounded-2xl bg-white/[0.04] border border-white/10 text-xs gap-1">
            {[
              {
                id: 'recharges',
                label: 'Recargas Manuales',
                count: metrics.pendingRechargesCount,
                icon: Coins,
                badgeAccent: 'bg-amber-400 text-zinc-950',
              },
              {
                id: 'withdrawals',
                label: 'Retiros Creadores',
                count: metrics.pendingWithdrawalsCount,
                icon: Wallet,
                badgeAccent: 'bg-sky-400 text-zinc-950',
              },
              {
                id: 'webhooks',
                label: 'Pagos Automáticos',
                count: paymentTxs.length,
                icon: Webhook,
                badgeAccent: 'bg-emerald-500/20 text-emerald-300',
              },
            ].map((t) => {
              const TabIcon = t.icon;
              const active = subTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setSubTab(t.id);
                    setStatusFilter('all');
                    setRejectDraft(null);
                  }}
                  className={`px-3.5 py-2 rounded-xl font-extrabold inline-flex items-center gap-1.5 transition ${
                    active
                      ? 'bg-white text-zinc-950 shadow-sm'
                      : 'text-zinc-300 hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                  {t.count > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-black tabular-nums ${
                        active && t.id !== 'webhooks' ? 'bg-[#FF2E54] text-white' : t.badgeAccent
                      }`}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar usuario, referencia o TxID..."
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-white/[0.05] border border-white/10 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-300"
            />
          </div>
        </div>

        {subTab !== 'webhooks' && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/[0.08] text-xs">
            {[
              { id: 'all', label: 'Todos' },
              {
                id: 'pending',
                label:
                  subTab === 'recharges'
                    ? `Pendientes (${metrics.pendingRechargesCount})`
                    : `Por pagar (${metrics.pendingWithdrawalsCount})`,
              },
              { id: 'done', label: subTab === 'recharges' ? 'Aprobados' : 'Pagados' },
              { id: 'rejected', label: 'Rechazados' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1 rounded-full text-[11px] font-extrabold transition ${
                  statusFilter === f.id
                    ? 'bg-gradient-to-r from-[#FF2E54] to-amber-500 text-white shadow-sm'
                    : 'bg-white/[0.05] text-zinc-400 hover:bg-white/[0.1] hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </AdminSectionCard>

      {/* SUB-TAB 1: RECARGAS MANUALES */}
      {subTab === 'recharges' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRequests.length === 0 ? (
            <div className="col-span-full">
              <AdminEmptyState
                icon={Coins}
                title="Sin solicitudes en este filtro"
                description="Cambia el filtro de estado o búsqueda para revisar otros comprobantes."
              />
            </div>
          ) : (
            filteredRequests.map((req) => {
              const userObj = userById[req.userId];
              const avatar =
                req.userPhoto || getPrimaryPhoto(userObj || { name: req.userName || '?' }, 120);
              const isPending = req.status === 'pending';
              const isApproved = req.status === 'approved';
              const copyKey = `req_${req.id}`;
              const isRejectingThis =
                rejectDraft?.kind === 'recharge' && rejectDraft?.id === req.id;

              return (
                <AdminSectionCard
                  key={req.id}
                  accent={isPending ? 'amber' : isApproved ? 'emerald' : 'none'}
                  className="p-4 sm:p-5 space-y-3.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={avatar}
                        alt={req.userName}
                        className="w-11 h-11 rounded-2xl object-cover bg-zinc-800 border border-white/10 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-black text-white truncate">
                            {req.countryFlag} {req.userName}
                          </p>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase border ${
                              isPending
                                ? 'bg-amber-400/20 border-amber-300/40 text-amber-200'
                                : isApproved
                                ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                                : 'bg-rose-500/20 border-rose-400/40 text-rose-300'
                            }`}
                          >
                            {isPending ? 'Pendiente' : isApproved ? 'Aprobada' : 'Rechazada'}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                          {req.methodName} · {formatGiftDate(req.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-display text-base font-black text-emerald-400 tabular-nums">
                        {formatUSD(req.amountUSD)}
                      </p>
                      <p className="text-xs font-extrabold text-amber-300">+{req.coinsToCredit} 🪙</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-2xl bg-black/40 border border-white/[0.08]">
                    <div className="min-w-0">
                      <span className="text-[9.5px] font-bold uppercase tracking-wider text-zinc-500 block">
                        Referencia / Hash
                      </span>
                      <span className="text-xs font-mono font-bold text-zinc-100 break-all">
                        {req.referenceNumber}
                      </span>
                    </div>
                    <AdminCopyButton
                      copyKey={copyKey}
                      copiedKey={copiedKey}
                      onCopy={() => onCopy(copyKey, req.referenceNumber, 'Referencia')}
                    />
                  </div>

                  {req.proofUrl && (
                    <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/50 group">
                      <img
                        src={req.proofUrl}
                        alt="Comprobante"
                        onClick={() => onPreviewImg(req.proofUrl)}
                        className="w-full h-36 object-contain cursor-pointer group-hover:scale-[1.02] transition"
                      />
                      <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onPreviewImg(req.proofUrl)}
                          className="px-2.5 py-1 rounded-full bg-black/80 hover:bg-black text-white text-[10px] font-bold inline-flex items-center gap-1"
                        >
                          <ZoomIn className="w-3 h-3" /> Ampliar
                        </button>
                        <a
                          href={req.proofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-full bg-black/80 hover:bg-black text-white text-[10px] font-bold inline-flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  )}

                  {isPending ? (
                    isRejectingThis ? (
                      <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-400/25 space-y-2.5">
                        <p className="text-[11px] font-extrabold text-rose-200">
                          Motivo del rechazo (lo verá el usuario):
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {RECHARGE_REJECT_REASONS.map((reasonOpt) => (
                            <button
                              key={reasonOpt}
                              type="button"
                              onClick={() =>
                                setRejectDraft((d) => ({ ...d, reason: reasonOpt }))
                              }
                              className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold border transition ${
                                rejectDraft.reason === reasonOpt
                                  ? 'bg-rose-500 text-white border-rose-400'
                                  : 'bg-black/30 text-zinc-300 border-white/10 hover:text-white'
                              }`}
                            >
                              {reasonOpt}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={rejectDraft.reason}
                          onChange={(e) =>
                            setRejectDraft((d) => ({ ...d, reason: e.target.value }))
                          }
                          placeholder="Escribe el motivo..."
                          className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white focus:outline-none focus:border-rose-400"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setRejectDraft(null)}
                            className="py-2 rounded-xl bg-white/[0.08] text-zinc-200 text-xs font-bold hover:bg-white/[0.15]"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={busyId === req.id}
                            onClick={async () => {
                              await onRejectRecharge(req, rejectDraft.reason);
                              setRejectDraft(null);
                            }}
                            className="py-2 rounded-xl bg-[#FF2E54] text-white text-xs font-black hover:brightness-110 disabled:opacity-50"
                          >
                            Confirmar rechazo
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2.5 pt-1">
                        <button
                          type="button"
                          disabled={busyId === req.id}
                          onClick={() =>
                            setRejectDraft({
                              kind: 'recharge',
                              id: req.id,
                              reason: RECHARGE_REJECT_REASONS[0],
                            })
                          }
                          className="py-2.5 rounded-xl bg-rose-500/15 border border-rose-400/30 text-rose-200 text-xs font-extrabold flex items-center justify-center gap-1.5 hover:bg-rose-500/25 disabled:opacity-50 transition"
                        >
                          <XCircle className="w-4 h-4" /> Rechazar
                        </button>
                        <button
                          type="button"
                          disabled={busyId === req.id}
                          onClick={() => onApproveRecharge(req)}
                          className="py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 text-zinc-950 text-xs font-black flex items-center justify-center gap-1.5 hover:brightness-110 disabled:opacity-50 shadow-md transition"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {busyId === req.id ? 'Procesando...' : `Aprobar +${req.coinsToCredit} 🪙`}
                        </button>
                      </div>
                    )
                  ) : (
                    req.rejectionReason && (
                      <p className="text-[11px] text-rose-200 bg-rose-500/10 border border-rose-400/20 rounded-xl px-3 py-2">
                        Motivo: {req.rejectionReason}
                      </p>
                    )
                  )}
                </AdminSectionCard>
              );
            })
          )}
        </div>
      )}

      {/* SUB-TAB 2: RETIROS A CREADORES */}
      {subTab === 'withdrawals' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredWithdrawals.length === 0 ? (
            <div className="col-span-full">
              <AdminEmptyState
                icon={Wallet}
                title="Sin solicitudes de retiro en este filtro"
                description="Los retiros de Diamantes solicitados por creadores aparecerán aquí."
              />
            </div>
          ) : (
            filteredWithdrawals.map((w) => {
              const userObj = userById[w.userId];
              const avatar =
                w.userPhoto || getPrimaryPhoto(userObj || { name: w.userName || '?' }, 120);
              const isPending = w.status === 'pending';
              const isPaid = w.status === 'paid';
              const copyAcctKey = `acct_${w.id}`;
              const copyRefKey = `wref_${w.id}`;
              const isRejectingThis =
                rejectDraft?.kind === 'withdrawal' && rejectDraft?.id === w.id;

              return (
                <AdminSectionCard
                  key={w.id}
                  accent={isPending ? 'sky' : isPaid ? 'emerald' : 'none'}
                  className="p-4 sm:p-5 space-y-3.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={avatar}
                        alt={w.userName}
                        className="w-11 h-11 rounded-2xl object-cover bg-zinc-800 border border-white/10 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-black text-white truncate">
                            {w.countryFlag} {w.userName}
                          </p>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase border ${
                              isPending
                                ? 'bg-sky-500/20 border-sky-400/40 text-sky-300'
                                : isPaid
                                ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                                : 'bg-rose-500/20 border-rose-400/40 text-rose-300'
                            }`}
                          >
                            {isPending ? 'Por pagar' : isPaid ? 'Pagado' : 'Reembolsado'}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                          {w.userEmail || 'Creador'} · {formatGiftDate(w.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-display text-base font-black text-emerald-400 tabular-nums">
                        {formatUSD(w.netPayoutUSD)}
                      </p>
                      <p className="text-[11px] font-bold text-sky-300">{w.amountDiamonds} 💎</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-400/25 flex items-center justify-between gap-2.5">
                    <div className="min-w-0">
                      <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-sky-300 block">
                        {w.payoutMethodName}
                      </span>
                      <span className="text-xs font-mono font-bold text-white break-all">
                        {w.payoutDetails}
                      </span>
                    </div>
                    <AdminCopyButton
                      copyKey={copyAcctKey}
                      copiedKey={copiedKey}
                      onCopy={() => onCopy(copyAcctKey, w.payoutDetails, 'Cuenta de cobro')}
                    />
                  </div>

                  {isPending ? (
                    isRejectingThis ? (
                      <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-400/25 space-y-2.5">
                        <p className="text-[11px] font-extrabold text-rose-200">
                          Motivo para devolver los {w.amountDiamonds} 💎 al usuario:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {WITHDRAWAL_REJECT_REASONS.map((reasonOpt) => (
                            <button
                              key={reasonOpt}
                              type="button"
                              onClick={() =>
                                setRejectDraft((d) => ({ ...d, reason: reasonOpt }))
                              }
                              className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold border transition ${
                                rejectDraft.reason === reasonOpt
                                  ? 'bg-rose-500 text-white border-rose-400'
                                  : 'bg-black/30 text-zinc-300 border-white/10 hover:text-white'
                              }`}
                            >
                              {reasonOpt}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={rejectDraft.reason}
                          onChange={(e) =>
                            setRejectDraft((d) => ({ ...d, reason: e.target.value }))
                          }
                          placeholder="Motivo del reembolso..."
                          className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white focus:outline-none focus:border-rose-400"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setRejectDraft(null)}
                            className="py-2 rounded-xl bg-white/[0.08] text-zinc-200 text-xs font-bold hover:bg-white/[0.15]"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={busyId === w.id}
                            onClick={async () => {
                              await onRejectWithdrawal(w, rejectDraft.reason);
                              setRejectDraft(null);
                            }}
                            className="py-2 rounded-xl bg-[#FF2E54] text-white text-xs font-black hover:brightness-110 disabled:opacity-50"
                          >
                            Confirmar devolución
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <input
                          type="text"
                          placeholder="Pega el TxID / Referencia de la transferencia enviada"
                          value={payoutRefs[w.id] || ''}
                          onChange={(e) => onPayoutRefChange(w.id, e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.05] border border-white/15 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-sky-400"
                        />
                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            disabled={busyId === w.id}
                            onClick={() =>
                              setRejectDraft({
                                kind: 'withdrawal',
                                id: w.id,
                                reason: WITHDRAWAL_REJECT_REASONS[0],
                              })
                            }
                            className="py-2.5 rounded-xl bg-rose-500/15 border border-rose-400/30 text-rose-200 text-xs font-extrabold hover:bg-rose-500/25 disabled:opacity-50 transition"
                          >
                            Devolver 💎
                          </button>
                          <button
                            type="button"
                            disabled={busyId === w.id}
                            onClick={() => onPayWithdrawal(w)}
                            className="py-2.5 rounded-xl bg-gradient-to-r from-sky-400 to-emerald-400 text-zinc-950 text-xs font-black hover:brightness-110 disabled:opacity-50 shadow-md transition"
                          >
                            {busyId === w.id ? 'Confirmando...' : `Confirmar ${formatUSD(w.netPayoutUSD)}`}
                          </button>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 pt-1 text-[11px] flex-wrap">
                        <span className="text-zinc-400">
                          Bruto {formatUSD(w.grossUSD)} · Fee {formatUSD(w.platformFeeUSD)}
                        </span>
                        {w.payoutReference && (
                          <AdminCopyButton
                            copyKey={copyRefKey}
                            copiedKey={copiedKey}
                            label={`Ref: ${w.payoutReference}`}
                            onCopy={() => onCopy(copyRefKey, w.payoutReference, 'Referencia de pago')}
                          />
                        )}
                      </div>
                      {w.rejectionReason && (
                        <p className="text-[11px] text-rose-200 bg-rose-500/10 border border-rose-400/20 rounded-xl px-3 py-2">
                          Motivo: {w.rejectionReason}
                        </p>
                      )}
                    </div>
                  )}
                </AdminSectionCard>
              );
            })
          )}
        </div>
      )}

      {/* SUB-TAB 3: PAGOS AUTOMÁTICOS NOWPAYMENTS (IPN VERIFICADOS) */}
      {subTab === 'webhooks' && (
        <div className="space-y-3">
          <AdminSectionCard accent="emerald" className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-extrabold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Acreditaciones Automáticas NowPayments (HMAC-SHA512)
            </p>
            <span className="text-xs font-black text-emerald-300 tabular-nums">
              Total API: {formatUSD(metrics.gatewayCompletedUSD)}
            </span>
          </AdminSectionCard>

          {filteredTxs.length === 0 ? (
            <AdminEmptyState
              icon={Webhook}
              title="Sin acreditaciones automáticas aún"
              description="Cuando un usuario pague en NowPayments y el IPN firme el callback aparecerá aquí al instante."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredTxs.map((tx) => {
                const copyTxKey = `tx_${tx.id}`;
                return (
                  <AdminSectionCard key={tx.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/30 text-[10px] font-black uppercase text-sky-300">
                            {tx.provider || 'nowpayments'}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/25 text-[10px] font-extrabold text-emerald-300">
                            <ShieldCheck className="w-3 h-3" />
                            {tx.verifiedSignature ? 'HMAC-SHA512 OK' : tx.source || 'admin'}
                          </span>
                        </div>
                        <p className="text-sm font-black text-white truncate mt-1.5">
                          {tx.userName || tx.userId}
                        </p>
                        <p className="text-[11px] text-zinc-400">
                          {formatGiftDate(tx.createdAt)}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-display text-base font-black text-emerald-400 tabular-nums">
                          {formatUSD(tx.amountUSD)}
                        </p>
                        <p className="text-xs font-extrabold text-amber-300 tabular-nums">
                          +{tx.coinsCredited || tx.diamondsCredited || 0}{' '}
                          {tx.creditField === 'diamonds' ? '💎' : '🪙'}
                        </p>
                      </div>
                    </div>

                    {tx.externalPaymentId && (
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.07]">
                        <span className="text-[10.5px] font-mono text-zinc-400 truncate">
                          ID: #{tx.externalPaymentId}
                        </span>
                        <AdminCopyButton
                          copyKey={copyTxKey}
                          copiedKey={copiedKey}
                          onCopy={() => onCopy(copyTxKey, tx.externalPaymentId, 'ID de pago')}
                        />
                      </div>
                    )}
                  </AdminSectionCard>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
