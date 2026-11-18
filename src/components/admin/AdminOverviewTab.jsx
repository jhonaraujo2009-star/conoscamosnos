import {
  Activity,
  BadgeCheck,
  CheckCircle2,
  Crown,
  DollarSign,
  Flag,
  Gem,
  Globe,
  ShieldCheck,
  Sparkles,
  Tv,
  Users,
  Wallet,
} from 'lucide-react';
import { formatUSD } from '../../utils/formatters';
import { AdminSectionCard } from './AdminPrimitives';

const RANGE_OPTIONS = [
  { id: 'day', label: 'Hoy' },
  { id: 'week', label: '7 días' },
  { id: 'month', label: 'Este mes' },
  { id: 'all', label: 'Histórico' },
];

const RANK_BADGES = [
  'bg-gradient-to-br from-amber-300 to-amber-500 text-zinc-950',
  'bg-gradient-to-br from-zinc-200 to-zinc-400 text-zinc-950',
  'bg-gradient-to-br from-rose-300 to-rose-500 text-white',
];

export default function AdminOverviewTab({
  metrics,
  dateFilter,
  onDateFilterChange,
  onNavigateTab,
}) {
  const maxDailyCount = Math.max(1, ...metrics.dailyBuckets.map((b) => b.count));
  const funnelTotal = Math.max(1, metrics.adUsersCount + metrics.payingUsersCount);
  const adSharePct = Math.round((metrics.adUsersCount / funnelTotal) * 100);
  const paidSharePct = Math.round((metrics.payingUsersCount / funnelTotal) * 100);
  const totalPendingOps =
    metrics.openReportsCount +
    metrics.pendingVerificationsCount +
    metrics.pendingRechargesCount +
    metrics.pendingWithdrawalsCount;

  return (
    <div className="space-y-6">
      {/* Cabecera ejecutiva + selector temporal */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300/90 flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5" />
            Resumen Ejecutivo
          </p>
          <h2 className="font-display text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
            Pulso en Tiempo Real
          </h2>
        </div>

        <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/10">
          {RANGE_OPTIONS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onDateFilterChange(f.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition ${
                dateFilter === f.id
                  ? 'bg-gradient-to-r from-[#FF2E54] via-rose-500 to-amber-500 text-white shadow-md shadow-[#FF2E54]/20'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bento KPI Grid (4 tarjetas editoriales) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Crecimiento */}
        <AdminSectionCard accent="crimson" className="p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-rose-300/90">
              Crecimiento
            </span>
            <div className="w-9 h-9 rounded-2xl bg-[#FF2E54]/15 border border-[#FF2E54]/30 text-rose-300 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>

          <div>
            <p className="font-display text-3xl font-black text-white tabular-nums tracking-tight">
              {metrics.newUsersCount}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              Comunidad total:{' '}
              <strong className="text-white tabular-nums">{metrics.totalUsers}</strong> perfiles
            </p>
          </div>

          {/* Sparkline 7 días */}
          <div className="flex items-end gap-1.5 h-12 pt-1 border-t border-white/[0.07]">
            {metrics.dailyBuckets.map((b, idx) => {
              const barHeight = b.count > 0 ? Math.max(10, Math.round((b.count / maxDailyCount) * 28)) : 4;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1" title={`${b.label}: ${b.count}`}>
                  <div
                    className={`w-full rounded-t-md transition-all ${
                      b.count > 0
                        ? 'bg-gradient-to-t from-[#FF2E54] to-amber-400'
                        : 'bg-white/10'
                    }`}
                    style={{ height: `${barHeight}px` }}
                  />
                  <span className="text-[9px] font-bold text-zinc-500 uppercase">
                    {b.label.slice(0, 2)}
                  </span>
                </div>
              );
            })}
          </div>
        </AdminSectionCard>

        {/* 2. Ingresos & Caja */}
        <AdminSectionCard accent="emerald" className="p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-emerald-300/95">
              Ingresos Globales
            </span>
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>

          <div>
            <p className="font-display text-3xl font-black text-white tabular-nums tracking-tight">
              {formatUSD(metrics.totalRevenueUSD)}
            </p>
            <p className="text-xs text-emerald-300 mt-1 font-bold">
              Caja neta: <span className="tabular-nums">{formatUSD(metrics.netBalanceUSD)}</span>
            </p>
          </div>

          <div className="pt-2.5 border-t border-white/[0.07] grid grid-cols-2 gap-2 text-[10.5px]">
            <div className="px-2.5 py-1.5 rounded-xl bg-white/[0.04]">
              <span className="text-zinc-400 block">Recargas</span>
              <strong className="text-white tabular-nums">
                {formatUSD(metrics.gatewayCompletedUSD + metrics.manualApprovedUSD)}
              </strong>
            </div>
            <div className="px-2.5 py-1.5 rounded-xl bg-white/[0.04]">
              <span className="text-zinc-400 block">Ads est.</span>
              <strong className="text-amber-300 tabular-nums">
                {formatUSD(metrics.adEstRevenueUSD)}
              </strong>
            </div>
          </div>
        </AdminSectionCard>

        {/* 3. Presencia Activa */}
        <AdminSectionCard accent="sky" className="p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-sky-300/95">
              Presencia en Vivo
            </span>
            <div className="w-9 h-9 rounded-2xl bg-sky-500/15 border border-sky-400/30 text-sky-300 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>

          <div>
            <p className="font-display text-3xl font-black text-white tabular-nums flex items-center gap-2.5">
              {metrics.activeNowCount}
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
              </span>
            </p>
            <p className="text-xs text-zinc-400 mt-1">Conectados en los últimos 5 min</p>
          </div>

          <div className="pt-2.5 border-t border-white/[0.07] flex items-center justify-between text-xs">
            <span className="text-zinc-400">Activos últimas 24h</span>
            <strong className="px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-200 font-extrabold tabular-nums">
              {metrics.active24hCount}
            </strong>
          </div>
        </AdminSectionCard>

        {/* 4. Bandeja Operativa */}
        <AdminSectionCard accent="amber" className="p-5 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-amber-300">
              Centro Operativo
            </span>
            <div className="w-9 h-9 rounded-2xl bg-amber-400/15 border border-amber-300/30 text-amber-300 flex items-center justify-center">
              {totalPendingOps === 0 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
            </div>
          </div>

          <div className="space-y-1.5 text-xs">
            <button
              type="button"
              onClick={() => onNavigateTab('reports')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.06] transition"
            >
              <span className="text-zinc-300 flex items-center gap-2">
                <Flag className="w-3.5 h-3.5 text-rose-400" />
                Reportes abiertos
              </span>
              <strong className="text-rose-300 tabular-nums">{metrics.openReportsCount}</strong>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('verification')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.06] transition"
            >
              <span className="text-zinc-300 flex items-center gap-2">
                <BadgeCheck className="w-3.5 h-3.5 text-sky-400" />
                Solicitudes Check
              </span>
              <strong className="text-sky-300 tabular-nums">
                {metrics.pendingVerificationsCount}
              </strong>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('treasury')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.06] transition"
            >
              <span className="text-zinc-300 flex items-center gap-2">
                <Wallet className="w-3.5 h-3.5 text-amber-300" />
                Pagos / Retiros
              </span>
              <strong className="text-amber-300 tabular-nums">
                {metrics.pendingRechargesCount + metrics.pendingWithdrawalsCount}
              </strong>
            </button>
          </div>
        </AdminSectionCard>
      </div>

      {/* Demografía por País + Embudo de Monetización */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <AdminSectionCard className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-black text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-sky-400" />
                Presencia Geográfica
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Distribución en tiempo real por país
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-white/[0.06] border border-white/10 text-[11px] font-extrabold text-zinc-200 tabular-nums">
              {metrics.countries.length} {metrics.countries.length === 1 ? 'país' : 'países'}
            </span>
          </div>

          {metrics.countries.length === 0 ? (
            <p className="text-xs text-zinc-500 py-10 text-center">Sin perfiles registrados aún.</p>
          ) : (
            <div className="space-y-3">
              {metrics.countries.slice(0, 7).map((c, idx) => {
                const pct =
                  metrics.totalUsers > 0
                    ? Math.round((c.count / metrics.totalUsers) * 100)
                    : 0;
                const rankBadge = RANK_BADGES[idx] || 'bg-white/10 text-zinc-300';
                return (
                  <div key={c.code} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-zinc-200 flex items-center gap-2 min-w-0">
                        <span
                          className={`w-5 h-5 rounded-lg text-[10px] font-black flex items-center justify-center shrink-0 ${rankBadge}`}
                        >
                          {idx + 1}
                        </span>
                        <span className="text-base leading-none">{c.flag}</span>
                        <span className="truncate">{c.name}</span>
                      </span>
                      <span className="font-extrabold text-white tabular-nums shrink-0">
                        {c.count} <span className="text-zinc-400 font-semibold">({pct}%)</span>
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#FF2E54] via-rose-400 to-amber-400 transition-all duration-500"
                        style={{ width: `${Math.max(4, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </AdminSectionCard>

        <AdminSectionCard className="p-5 sm:p-6 space-y-5 flex flex-col justify-between">
          <div>
            <h3 className="font-display text-base font-black text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Embudo de Monetización
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Usuarios gratuitos vía anuncios frente a compradores de monedas
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/15 via-emerald-500/[0.06] to-transparent border border-emerald-400/25 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-extrabold text-emerald-300 uppercase tracking-wider">
                  Vía Anuncios
                </span>
                <Tv className="w-4 h-4 text-emerald-300" />
              </div>
              <p className="font-display text-3xl font-black text-white tabular-nums">
                {metrics.adUsersCount}
              </p>
              <p className="text-[11px] text-zinc-300 leading-snug">
                <strong className="text-emerald-300">{metrics.adConversionPct}%</strong> del total ·{' '}
                {metrics.adImpressionsTotal} impresiones
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-400/15 via-rose-500/[0.06] to-transparent border border-amber-300/25 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-extrabold text-amber-300 uppercase tracking-wider">
                  Compradores
                </span>
                <Gem className="w-4 h-4 text-amber-300" />
              </div>
              <p className="font-display text-3xl font-black text-white tabular-nums">
                {metrics.payingUsersCount}
              </p>
              <p className="text-[11px] text-zinc-300 leading-snug">
                <strong className="text-amber-300">{metrics.paidConversionPct}%</strong> del total ·{' '}
                {formatUSD(metrics.gatewayCompletedUSD + metrics.manualApprovedUSD)}
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-white/[0.07]">
            <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400">
              <span>Balance de monetizadores activos</span>
              <span className="tabular-nums text-zinc-200">
                {adSharePct}% Ads / {paidSharePct}% Compras
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-white/[0.07] overflow-hidden flex">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all duration-500"
                style={{ width: `${adSharePct}%` }}
              />
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-[#FF2E54] transition-all duration-500"
                style={{ width: `${paidSharePct}%` }}
              />
            </div>
          </div>
        </AdminSectionCard>
      </div>
    </div>
  );
}
