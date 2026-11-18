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
  'bg-amber-100 text-amber-800 border border-amber-200',
  'bg-zinc-100 text-zinc-700 border border-zinc-200',
  'bg-rose-100 text-rose-700 border border-rose-200',
];

export default function AdminOverviewTab({
  metrics,
  accessPolicy,
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

  const modeBadge =
    accessPolicy?.unlockMode === 'free'
      ? {
          title: 'Modo Libre (Todo Gratis para el público)',
          desc: 'Chats directos y Likes revelados gratis sin monedas ni anuncios para maximizar retención.',
          pill: 'Libre / Gratis',
          pillClass: 'bg-emerald-50 border-emerald-200 text-emerald-700',
        }
      : accessPolicy?.unlockMode === 'ads_only'
      ? {
          title: `Solo Anuncios Monetag (${accessPolicy.adDurationSeconds}s)`,
          desc: 'Sin cobrar monedas al público; los usuarios desbloquean viendo 1 anuncio.',
          pill: 'Solo Anuncios',
          pillClass: 'bg-sky-50 border-sky-200 text-sky-700',
        }
      : accessPolicy?.unlockMode === 'coins_only'
      ? {
          title: `Solo Diamantes (${accessPolicy.unlockLikeChatCoins} 💎)`,
          desc: 'Anuncios desactivados globalmente; desbloqueo inmediato con Diamantes o membresía PRO.',
          pill: 'Solo Diamantes 💎',
          pillClass: 'bg-sky-50 border-sky-200 text-sky-800',
        }
      : {
          title: `Híbrido: Anuncio (${accessPolicy?.adDurationSeconds || 12}s), ${accessPolicy?.unlockLikeChatCoins || 2} 💎 o PRO`,
          desc: 'Cada usuario elige ver 1 anuncio gratis, usar Diamantes al instante o hacerse Conoscamosnos PRO.',
          pill: 'Diamantes + Ads',
          pillClass: 'bg-rose-50 border-rose-200 text-rose-700',
        };

  return (
    <div className="space-y-6">
      {/* Cabecera ejecutiva + selector temporal */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FF2E54] flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5" />
            Resumen Ejecutivo
          </p>
          <h2 className="font-display text-xl sm:text-2xl font-black text-zinc-900 tracking-tight mt-0.5">
            Pulso en Tiempo Real
          </h2>
        </div>

        <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-white border border-zinc-200/85 shadow-sm">
          {RANGE_OPTIONS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onDateFilterChange(f.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition ${
                dateFilter === f.id
                  ? 'bg-gradient-to-r from-[#FF2E54] to-rose-500 text-white shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Estado Global Actual de Monetización */}
      <AdminSectionCard accent="amber" className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${modeBadge.pillClass}`}>
              {modeBadge.pill}
            </span>
            <p className="text-xs sm:text-sm font-black text-zinc-900 truncate">{modeBadge.title}</p>
          </div>
          <p className="text-[11px] text-zinc-600 leading-relaxed">{modeBadge.desc}</p>
        </div>

        <button
          type="button"
          onClick={() => onNavigateTab('settings')}
          className="px-4 py-2.5 rounded-full bg-zinc-900 text-white text-xs font-black hover:bg-zinc-800 active:scale-[0.98] transition shrink-0 shadow-sm"
        >
          Cambiar Cobros / Intercambio →
        </button>
      </AdminSectionCard>

      {/* Bento KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Crecimiento */}
        <AdminSectionCard accent="crimson" className="p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-[#FF2E54]">
              Crecimiento
            </span>
            <div className="w-9 h-9 rounded-2xl bg-rose-50 border border-rose-200 text-[#FF2E54] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>

          <div>
            <p className="font-display text-3xl font-black text-zinc-900 tabular-nums tracking-tight">
              {metrics.newUsersCount}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Comunidad total:{' '}
              <strong className="text-zinc-900 tabular-nums">{metrics.totalUsers}</strong> perfiles
            </p>
          </div>

          {/* Sparkline 7 días */}
          <div className="flex items-end gap-1.5 h-12 pt-1 border-t border-rose-100">
            {metrics.dailyBuckets.map((b, idx) => {
              const barHeight = b.count > 0 ? Math.max(10, Math.round((b.count / maxDailyCount) * 28)) : 4;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1" title={`${b.label}: ${b.count}`}>
                  <div
                    className={`w-full rounded-t-md transition-all ${
                      b.count > 0
                        ? 'bg-gradient-to-t from-[#FF2E54] to-amber-300'
                        : 'bg-zinc-200/70'
                    }`}
                    style={{ height: `${barHeight}px` }}
                  />
                  <span className="text-[9px] font-bold text-zinc-400 uppercase">
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
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-emerald-700">
              Ingresos del Periodo
            </span>
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>

          <div>
            <p className="font-display text-3xl font-black text-zinc-900 tabular-nums tracking-tight">
              {formatUSD(metrics.totalRevenueUSD)}
            </p>
            <p className="text-xs text-emerald-700 mt-1 font-bold">
              Caja neta: <span className="tabular-nums">{formatUSD(metrics.netBalanceUSD)}</span>
            </p>
          </div>

          <div className="pt-2.5 border-t border-emerald-100 grid grid-cols-2 gap-2 text-[10.5px]">
            <div className="px-2.5 py-1.5 rounded-xl bg-white border border-emerald-100">
              <span className="text-zinc-500 block">Recargas</span>
              <strong className="text-zinc-900 tabular-nums">
                {formatUSD(metrics.gatewayCompletedUSD + metrics.manualApprovedUSD)}
              </strong>
            </div>
            <div className="px-2.5 py-1.5 rounded-xl bg-white border border-amber-100">
              <span className="text-zinc-500 block">Ads est.</span>
              <strong className="text-amber-700 tabular-nums">
                {formatUSD(metrics.adEstRevenueUSD)}
              </strong>
            </div>
          </div>
        </AdminSectionCard>

        {/* 3. Presencia Activa */}
        <AdminSectionCard accent="sky" className="p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-sky-700">
              Presencia en Vivo
            </span>
            <div className="w-9 h-9 rounded-2xl bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>

          <div>
            <p className="font-display text-3xl font-black text-zinc-900 tabular-nums flex items-center gap-2.5">
              {metrics.activeNowCount}
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
            </p>
            <p className="text-xs text-zinc-500 mt-1">Conectados en los últimos 5 min</p>
          </div>

          <div className="pt-2.5 border-t border-sky-100 flex items-center justify-between text-xs">
            <span className="text-zinc-500">Activos últimas 24h</span>
            <strong className="px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 font-extrabold tabular-nums">
              {metrics.active24hCount}
            </strong>
          </div>
        </AdminSectionCard>

        {/* 4. Bandeja Operativa */}
        <AdminSectionCard accent="amber" className="p-5 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-amber-800">
              Centro Operativo
            </span>
            <div className="w-9 h-9 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
              {totalPendingOps === 0 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
            </div>
          </div>

          <div className="space-y-1.5 text-xs">
            <button
              type="button"
              onClick={() => onNavigateTab('reports')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white hover:bg-rose-50/70 border border-zinc-200/70 transition"
            >
              <span className="text-zinc-700 font-semibold flex items-center gap-2">
                <Flag className="w-3.5 h-3.5 text-[#FF2E54]" />
                Reportes abiertos
              </span>
              <strong className="text-[#FF2E54] tabular-nums">{metrics.openReportsCount}</strong>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('verification')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white hover:bg-sky-50/70 border border-zinc-200/70 transition"
            >
              <span className="text-zinc-700 font-semibold flex items-center gap-2">
                <BadgeCheck className="w-3.5 h-3.5 text-sky-500" />
                Solicitudes Check
              </span>
              <strong className="text-sky-700 tabular-nums">
                {metrics.pendingVerificationsCount}
              </strong>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('treasury')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white hover:bg-amber-50/70 border border-zinc-200/70 transition"
            >
              <span className="text-zinc-700 font-semibold flex items-center gap-2">
                <Wallet className="w-3.5 h-3.5 text-amber-600" />
                Pagos / Retiros
              </span>
              <strong className="text-amber-700 tabular-nums">
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
              <h3 className="font-display text-base font-black text-zinc-900 flex items-center gap-2">
                <Globe className="w-4 h-4 text-sky-500" />
                Presencia Geográfica
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Distribución en tiempo real por país
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-[11px] font-extrabold text-zinc-700 tabular-nums">
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
                const rankBadge = RANK_BADGES[idx] || 'bg-zinc-100 text-zinc-600 border border-zinc-200';
                return (
                  <div key={c.code} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-zinc-800 flex items-center gap-2 min-w-0">
                        <span
                          className={`w-5 h-5 rounded-lg text-[10px] font-black flex items-center justify-center shrink-0 ${rankBadge}`}
                        >
                          {idx + 1}
                        </span>
                        <span className="text-base leading-none">{c.flag}</span>
                        <span className="truncate">{c.name}</span>
                      </span>
                      <span className="font-extrabold text-zinc-900 tabular-nums shrink-0">
                        {c.count} <span className="text-zinc-500 font-semibold">({pct}%)</span>
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-zinc-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#FF2E54] via-rose-400 to-amber-300 transition-all duration-500"
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
            <h3 className="font-display text-base font-black text-zinc-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Embudo de Monetización
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Usuarios gratuitos vía anuncios frente a compradores de Diamantes
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 via-white to-teal-50/70 border border-emerald-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-extrabold text-emerald-700 uppercase tracking-wider">
                  Vía Anuncios
                </span>
                <Tv className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="font-display text-3xl font-black text-zinc-900 tabular-nums">
                {metrics.adUsersCount}
              </p>
              <p className="text-[11px] text-zinc-600 leading-snug">
                <strong className="text-emerald-700">{metrics.adConversionPct}%</strong> del total ·{' '}
                {metrics.adImpressionsTotal} impresiones
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 via-white to-rose-50/70 border border-amber-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-extrabold text-amber-800 uppercase tracking-wider">
                  Compradores
                </span>
                <Gem className="w-4 h-4 text-sky-500" />
              </div>
              <p className="font-display text-3xl font-black text-zinc-900 tabular-nums">
                {metrics.payingUsersCount}
              </p>
              <p className="text-[11px] text-zinc-600 leading-snug">
                <strong className="text-amber-700">{metrics.paidConversionPct}%</strong> del total ·{' '}
                {formatUSD(metrics.gatewayCompletedUSD + metrics.manualApprovedUSD)}
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-zinc-100">
            <div className="flex items-center justify-between text-[11px] font-bold text-zinc-500">
              <span>Balance de monetizadores activos</span>
              <span className="tabular-nums text-zinc-800">
                {adSharePct}% Ads / {paidSharePct}% Compras
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-zinc-100 overflow-hidden flex">
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
