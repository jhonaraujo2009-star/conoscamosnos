import { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Gem,
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
      {/* KPI Ejecutivo de Tesorería (Pastel Claro) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <AdminSectionCard accent="emerald" className="p-4 sm:p-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-emerald-700">
              Ingresos Totales
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <p className="font-display text-2xl sm:text-3xl font-black text-zinc-900 tabular-nums">
            {formatUSD(metrics.totalRevenueUSD)}
          </p>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10.5px] text-zinc-500 pt-2 border-t border-emerald-100">
            <span>
              API: <strong className="text-zinc-800">{formatUSD(metrics.gatewayCompletedUSD)}</strong>
            </span>
            <span>
              Manual: <strong className="text-zinc-800">{formatUSD(metrics.manualApprovedUSD)}</strong>
            </span>
            <span>
              Ads: <strong className="text-amber-700">{formatUSD(metrics.adEstRevenueUSD)}</strong>
            </span>
          </div>
        </AdminSectionCard>

        <AdminSectionCard accent="amber" className="p-4 sm:p-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-amber-700">
              Pendiente en Cola
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center">
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
              className="w-full px-2.5 py-2 rounded-xl bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200/80 flex items-center justify-between text-xs transition"
            >
              <span className="text-zinc-700 font-semibold">Recargas 💎</span>
              <span className="font-extrabold text-amber-800 tabular-nums">
                {metrics.pendingRechargesCount} ({formatUSD(metrics.pendingRechargesUSD)})
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSubTab('withdrawals');
                setStatusFilter('pending');
              }}
              className="w-full px-2.5 py-2 rounded-xl bg-sky-50/80 hover:bg-sky-100/70 border border-sky-200/80 flex items-center justify-between text-xs transition"
            >
              <span className="text-zinc-700 font-semibold">Retiros</span>
              <span className="font-extrabold text-sky-800 tabular-nums">
                {metrics.pendingWithdrawalsCount} ({formatUSD(metrics.pendingWithdrawalsUSD)})
              </span>
            </button>
          </div>
        </AdminSectionCard>

        <AdminSectionCard accent="sky" className="p-4 sm:p-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-sky-700">
              Pagado a Creadores
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-100 border border-sky-200 text-sky-700 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <p className="font-display text-2xl sm:text-3xl font-black text-zinc-900 tabular-nums">
            {formatUSD(metrics.totalPaidOutUSD)}
          </p>
          <p className="text-[11px] text-zinc-500 pt-2 border-t border-sky-100">
            <strong className="text-sky-700 tabular-nums">{metrics.paidWithdrawalsCount}</strong>{' '}
            liquidaciones confirmadas
          </p>
        </AdminSectionCard>

        <AdminSectionCard accent="crimson" className="p-4 sm:p-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-rose-700">
              Balance Neto Caja
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <p className="font-display text-2xl sm:text-3xl font-black text-zinc-900 tabular-nums">
            {formatUSD(metrics.netBalanceUSD)}
          </p>
          <p className="text-[11px] text-zinc-500 pt-2 border-t border-rose-100">
            Margen neto después de retiros
          </p>
        </AdminSectionCard>
      </div>

      {/* Sub-navegación + Búsqueda + Filtros */}
      <AdminSectionCard className="p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap p-1 rounded-2xl bg-zinc-100 border border-zinc-200 text-xs gap-1">
            {[
              {
                id: 'recharges',
                label: 'Recargas Manuales',
                count: metrics.pendingRechargesCount,
                icon: Gem,
                badgeAccent: 'bg-amber-200 text-amber-900',
              },
              {
                id: 'withdrawals',
                label: 'Retiros Creadores',
                count: metrics.pendingWithdrawalsCount,
                icon: Wallet,
                badgeAccent: 'bg-sky-200 text-sky-900',
              },
              {
                id: 'webhooks',
                label: 'Pagos Automáticos',
                count: paymentTxs.length,
                icon: Webhook,
                badgeAccent: 'bg-emerald-100 text-emerald-800',
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
                      ? 'bg-gradient-to-r from-[#FF2E54] to-rose-500 text-white shadow-sm'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-white'
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                  {t.count > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-black tabular-nums ${
                        active ? 'bg-white/25 text-white' : t.badgeAccent
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
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-rose-400 focus:bg-white"
            />
          </div>
        </div>

        {subTab !== 'webhooks' && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-zinc-100 text-xs">
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
                className={`px-3 py-1 rounded-full text-[11px] font-extrabold transition border ${
                  statusFilter === f.id
                    ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                    : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100 hover:text-zinc-900'
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
                icon={Gem}
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
              const isProReq = req.creditTarget === 'pro';
              const creditUnits = req.diamondsToCredit || req.coinsToCredit || 0;
              const creditBadgeText = isProReq
                ? `👑 PRO (${req.proDurationDays || 7} días)`
                : `+${creditUnits} 💎`;

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
                        className="w-11 h-11 rounded-2xl object-cover bg-zinc-100 border border-zinc-200 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-black text-zinc-900 truncate">
                            {req.countryFlag} {req.userName}
                          </p>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase border ${
                              isPending
                                ? 'bg-amber-100 border-amber-300 text-amber-800'
                                : isApproved
                                ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                                : 'bg-rose-100 border-rose-300 text-rose-800'
                            }`}
                          >
                            {isPending ? 'Pendiente' : isApproved ? 'Aprobada' : 'Rechazada'}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                          {req.methodName} · {formatGiftDate(req.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-display text-base font-black text-emerald-700 tabular-nums">
                        {formatUSD(req.amountUSD)}
                      </p>
                      <p className="text-xs font-extrabold text-sky-700">
                        {creditBadgeText}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-2xl bg-zinc-50 border border-zinc-200">
                    <div className="min-w-0">
                      <span className="text-[9.5px] font-bold uppercase tracking-wider text-zinc-500 block">
                        Referencia / Hash
                      </span>
                      <span className="text-xs font-mono font-bold text-zinc-900 break-all">
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
                    <div className="relative rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-100 group">
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
                          className="px-2.5 py-1 rounded-full bg-white/95 hover:bg-white text-zinc-900 border border-zinc-200 shadow-sm text-[10px] font-bold inline-flex items-center gap-1"
                        >
                          <ZoomIn className="w-3 h-3" /> Ampliar
                        </button>
                        <a
                          href={req.proofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-full bg-white/95 hover:bg-white text-zinc-900 border border-zinc-200 shadow-sm text-[10px] font-bold inline-flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  )}

                  {isPending ? (
                    isRejectingThis ? (
                      <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 space-y-2.5">
                        <p className="text-[11px] font-extrabold text-rose-800">
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
                                  ? 'bg-rose-500 text-white border-rose-500'
                                  : 'bg-white text-zinc-700 border-zinc-200 hover:border-rose-300'
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
                          className="w-full px-3 py-2 rounded-xl bg-white border border-rose-200 text-xs text-zinc-900 focus:outline-none focus:border-rose-400"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setRejectDraft(null)}
                            className="py-2 rounded-xl bg-white border border-zinc-200 text-zinc-700 text-xs font-bold hover:bg-zinc-50"
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
                          className="py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-extrabold flex items-center justify-center gap-1.5 hover:bg-rose-100 disabled:opacity-50 transition"
                        >
                          <XCircle className="w-4 h-4" /> Rechazar
                        </button>
                        <button
                          type="button"
                          disabled={busyId === req.id}
                          onClick={() => onApproveRecharge(req)}
                          className="py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-black flex items-center justify-center gap-1.5 hover:brightness-105 disabled:opacity-50 shadow-sm transition"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {busyId === req.id ? 'Procesando...' : `Aprobar ${creditBadgeText}`}
                        </button>
                      </div>
                    )
                  ) : (
                    req.rejectionReason && (
                      <p className="text-[11px] text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
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
                        className="w-11 h-11 rounded-2xl object-cover bg-zinc-100 border border-zinc-200 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-black text-zinc-900 truncate">
                            {w.countryFlag} {w.userName}
                          </p>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase border ${
                              isPending
                                ? 'bg-sky-100 border-sky-300 text-sky-800'
                                : isPaid
                                ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                                : 'bg-rose-100 border-rose-300 text-rose-800'
                            }`}
                          >
                            {isPending ? 'Por pagar' : isPaid ? 'Pagado' : 'Reembolsado'}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                          {w.userEmail || 'Creador'} · {formatGiftDate(w.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-display text-base font-black text-emerald-700 tabular-nums">
                        {formatUSD(w.netPayoutUSD)}
                      </p>
                      <p className="text-[11px] font-bold text-sky-700">{w.amountDiamonds} 💎</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-between gap-2.5">
                    <div className="min-w-0">
                      <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-sky-700 block">
                        {w.payoutMethodName}
                      </span>
                      <span className="text-xs font-mono font-bold text-zinc-900 break-all">
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
                      <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 space-y-2.5">
                        <p className="text-[11px] font-extrabold text-rose-800">
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
                                  ? 'bg-rose-500 text-white border-rose-500'
                                  : 'bg-white text-zinc-700 border-zinc-200 hover:border-rose-300'
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
                          className="w-full px-3 py-2 rounded-xl bg-white border border-rose-200 text-xs text-zinc-900 focus:outline-none focus:border-rose-400"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setRejectDraft(null)}
                            className="py-2 rounded-xl bg-white border border-zinc-200 text-zinc-700 text-xs font-bold hover:bg-zinc-50"
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
                          className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-sky-400 focus:bg-white"
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
                            className="py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-extrabold hover:bg-rose-100 disabled:opacity-50 transition"
                          >
                            Devolver 💎
                          </button>
                          <button
                            type="button"
                            disabled={busyId === w.id}
                            onClick={() => onPayWithdrawal(w)}
                            className="py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 text-white text-xs font-black hover:brightness-105 disabled:opacity-50 shadow-sm transition"
                          >
                            {busyId === w.id ? 'Confirmando...' : `Confirmar ${formatUSD(w.netPayoutUSD)}`}
                          </button>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 pt-1 text-[11px] flex-wrap">
                        <span className="text-zinc-500">
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
                        <p className="text-[11px] text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
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
            <p className="text-xs font-extrabold text-zinc-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Acreditaciones Automáticas NowPayments (HMAC-SHA512)
            </p>
            <span className="text-xs font-black text-emerald-700 tabular-nums">
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
                const units = tx.diamondsCredited ?? tx.coinsCredited ?? 0;
                const isProTx = tx.creditField === 'pro';
                return (
                  <AdminSectionCard key={tx.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-full bg-sky-100 border border-sky-200 text-[10px] font-black uppercase text-sky-800">
                            {tx.provider || 'nowpayments'}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-200 text-[10px] font-extrabold text-emerald-800">
                            <ShieldCheck className="w-3 h-3" />
                            {tx.verifiedSignature ? 'HMAC-SHA512 OK' : tx.source || 'admin'}
                          </span>
                        </div>
                        <p className="text-sm font-black text-zinc-900 truncate mt-1.5">
                          {tx.userName || tx.userId}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          {formatGiftDate(tx.createdAt)}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-display text-base font-black text-emerald-700 tabular-nums">
                          {formatUSD(tx.amountUSD)}
                        </p>
                        <p className="text-xs font-extrabold text-sky-700 tabular-nums">
                          {isProTx ? `👑 PRO (+${tx.proDurationDays || 7}d)` : `+${units} 💎`}
                        </p>
                      </div>
                    </div>

                    {tx.externalPaymentId && (
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-100">
                        <span className="text-[10.5px] font-mono text-zinc-500 truncate">
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
