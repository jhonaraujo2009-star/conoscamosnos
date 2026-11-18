import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  Ban,
  BarChart3,
  Check,
  CheckCircle2,
  Coins,
  Copy,
  Crown,
  DollarSign,
  ExternalLink,
  Flag,
  Flame,
  Gem,
  Globe,
  LogOut,
  Save,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tv,
  Unlock,
  Users,
  Webhook,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeAllAdImpressions } from '../../services/adRewardService';
import {
  setUserSuspensionStatus,
  setUserVerificationBadge,
  subscribeAllUsersForAdmin,
  updateEconomyConfig,
} from '../../services/adminService';
import { logoutUser } from '../../services/authService';
import {
  approvePaymentRequest,
  rejectPaymentRequest,
  subscribeAllPaymentRequests,
  subscribeAllPaymentTransactions,
} from '../../services/monetizationService';
import { subscribeAllReports, updateReportStatus } from '../../services/userService';
import {
  markWithdrawalPaid,
  rejectWithdrawalRequest,
  subscribeAllWithdrawals,
} from '../../services/withdrawalService';
import {
  formatUSD,
  getPrimaryPhoto,
  isProfileVerified,
  isUserActuallyOnline,
  toMillis,
} from '../../utils/formatters';

const NAV_TABS = [
  { id: 'overview', label: 'Estadísticas', icon: BarChart3 },
  { id: 'reports', label: 'Reportes', icon: Flag },
  { id: 'verification', label: 'Check Azul', icon: BadgeCheck },
  { id: 'treasury', label: 'Tesorería', icon: DollarSign },
  { id: 'settings', label: 'Precios y API', icon: Settings },
];

export default function AdminDashboardPage({ onSuccess, onError }) {
  const navigate = useNavigate();
  const { userProfile, economyConfig } = useAuth();

  const [activeTab, setActiveTab] = useState('overview');
  const [dateFilter, setDateFilter] = useState('month'); // 'day' | 'week' | 'month' | 'all'
  const [users, setUsers] = useState([]);
  const [paymentRequests, setPaymentRequests] = useState([]);
  const [paymentTxs, setPaymentTxs] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [reports, setReports] = useState([]);
  const [adImpressions, setAdImpressions] = useState([]);

  // Filtros y acciones de módulos
  const [verificationFilter, setVerificationFilter] = useState('all'); // 'pending' | 'verified' | 'all'
  const [userSearch, setUserSearch] = useState('');
  const [treasurySubTab, setTreasurySubTab] = useState('recharges'); // 'recharges' | 'withdrawals' | 'webhooks'
  const [busyId, setBusyId] = useState('');
  const [payoutRefs, setPayoutRefs] = useState({});
  const [previewImg, setPreviewImg] = useState(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Formulario de configuración económica (precio de diamantes en Firestore)
  const [baseDiamondPrice, setBaseDiamondPrice] = useState(
    String(economyConfig?.baseDiamondValueUSD ?? 0.01)
  );
  const [creatorSharePct, setCreatorSharePct] = useState(
    String(Math.round((economyConfig?.creatorShareRatio ?? 0.6) * 100))
  );
  const [minWithdrawDiamonds, setMinWithdrawDiamonds] = useState(
    String(economyConfig?.minWithdrawalDiamonds ?? 500)
  );
  const [packagesDraft, setPackagesDraft] = useState(economyConfig?.coinPackages || []);
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    setBaseDiamondPrice(String(economyConfig?.baseDiamondValueUSD ?? 0.01));
    setCreatorSharePct(String(Math.round((economyConfig?.creatorShareRatio ?? 0.6) * 100)));
    setMinWithdrawDiamonds(String(economyConfig?.minWithdrawalDiamonds ?? 500));
    setPackagesDraft(economyConfig?.coinPackages || []);
  }, [economyConfig]);

  // Suscripciones en tiempo real a todo el ecosistema
  useEffect(() => {
    const unsubUsers = subscribeAllUsersForAdmin(setUsers);
    const unsubReqs = subscribeAllPaymentRequests(setPaymentRequests);
    const unsubTxs = subscribeAllPaymentTransactions(setPaymentTxs);
    const unsubW = subscribeAllWithdrawals(setWithdrawals);
    const unsubReports = subscribeAllReports(setReports);
    const unsubAds = subscribeAllAdImpressions(setAdImpressions);

    return () => {
      unsubUsers();
      unsubReqs();
      unsubTxs();
      unsubW();
      unsubReports();
      unsubAds();
    };
  }, []);

  const userById = useMemo(() => {
    const map = {};
    users.forEach((u) => {
      map[u.uid] = u;
    });
    return map;
  }, [users]);

  // ==================== MÉTRICAS EN TIEMPO REAL ====================
  const metrics = useMemo(() => {
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1).getTime();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    const rangeStartMs =
      dateFilter === 'day'
        ? startOfToday.getTime()
        : dateFilter === 'week'
        ? sevenDaysAgo
        : dateFilter === 'month'
        ? startOfMonth
        : 0;

    const newUsersInRange = users.filter((u) => {
      const created = toMillis(u.createdAt);
      if (rangeStartMs === 0) return true;
      return created >= rangeStartMs;
    });

    const activeNowCount = users.filter((u) => isUserActuallyOnline(u, { bypassPrivacy: true })).length;
    const active24hCount = users.filter((u) => {
      const ms = toMillis(u.lastSeen);
      return ms > 0 && now - ms <= 24 * 60 * 60 * 1000;
    }).length;

    // Ingresos totales ($)
    const manualApprovedUSD = paymentRequests
      .filter((r) => r.status === 'approved')
      .reduce((acc, r) => acc + Number(r.amountUSD || 0), 0);
    const gatewayCompletedUSD = paymentTxs
      .filter((t) => t.status === 'completed')
      .reduce((acc, t) => acc + Number(t.amountUSD || 0), 0);
    const adEstRevenueUSD = adImpressions.reduce(
      (acc, imp) => acc + Number(imp.estimatedRevenueUSD || 0),
      0
    );
    const totalRevenueUSD = manualApprovedUSD + gatewayCompletedUSD + adEstRevenueUSD;
    const totalPaidOutUSD = withdrawals
      .filter((w) => w.status === 'paid')
      .reduce((acc, w) => acc + Number(w.netPayoutUSD || 0), 0);
    const netBalanceUSD = totalRevenueUSD - totalPaidOutUSD;

    // Demografía por país
    const countryMap = {};
    users.forEach((u) => {
      const code = u.country?.code || 'GLOBAL';
      const name = u.country?.name || 'Sin especificar';
      const flag = u.country?.flag || '🌎';
      if (!countryMap[code]) {
        countryMap[code] = { code, name, flag, count: 0 };
      }
      countryMap[code].count += 1;
    });
    const countries = Object.values(countryMap).sort((a, b) => b.count - a.count);

    // Embudos de monetización: Consumidores de Publicidad vs Pagadores de Diamantes/Monedas
    const adUserIds = new Set(adImpressions.map((a) => a.userId).filter(Boolean));
    const payingUserIds = new Set([
      ...paymentRequests.filter((r) => r.status === 'approved').map((r) => r.userId),
      ...paymentTxs.filter((t) => t.status === 'completed').map((t) => t.userId),
    ].filter(Boolean));

    const totalUsers = users.length;
    const adUsersCount = adUserIds.size;
    const payingUsersCount = payingUserIds.size;
    const adConversionPct = totalUsers > 0 ? Math.round((adUsersCount / totalUsers) * 100) : 0;
    const paidConversionPct = totalUsers > 0 ? Math.round((payingUsersCount / totalUsers) * 100) : 0;

    // Tendencia diaria últimos 7 días
    const dailyBuckets = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfToday.getTime() - (6 - i) * 24 * 60 * 60 * 1000);
      const dayStart = d.getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      const count = users.filter((u) => {
        const ms = toMillis(u.createdAt);
        return ms >= dayStart && ms < dayEnd;
      }).length;
      const label = new Intl.DateTimeFormat('es', { weekday: 'short' }).format(d);
      return { label, count };
    });

    const openReportsCount = reports.filter((r) => !r.status || r.status === 'open').length;
    const pendingVerificationsCount = users.filter(
      (u) => u.verificationStatus === 'pending' && !isProfileVerified(u)
    ).length;
    const pendingRechargesCount = paymentRequests.filter((r) => r.status === 'pending').length;
    const pendingWithdrawalsCount = withdrawals.filter((w) => w.status === 'pending').length;

    return {
      totalUsers,
      newUsersCount: newUsersInRange.length,
      activeNowCount,
      active24hCount,
      totalRevenueUSD,
      manualApprovedUSD,
      gatewayCompletedUSD,
      adEstRevenueUSD,
      totalPaidOutUSD,
      netBalanceUSD,
      countries,
      adUsersCount,
      adImpressionsTotal: adImpressions.length,
      payingUsersCount,
      adConversionPct,
      paidConversionPct,
      dailyBuckets,
      openReportsCount,
      pendingVerificationsCount,
      pendingRechargesCount,
      pendingWithdrawalsCount,
    };
  }, [users, dateFilter, paymentRequests, paymentTxs, adImpressions, withdrawals, reports]);

  const filteredVerificationUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return users
      .filter((u) => {
        const verified = isProfileVerified(u);
        if (verificationFilter === 'pending' && (verified || u.verificationStatus !== 'pending')) {
          return false;
        }
        if (verificationFilter === 'verified' && !verified) return false;
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
  }, [users, verificationFilter, userSearch]);

  // ==================== HANDLERS DE MODERACIÓN Y CONFIG ====================
  const handleToggleBan = async (targetUid, targetName, currentlyBanned, reason, reportId = null) => {
    setBusyId(reportId || targetUid);
    try {
      await setUserSuspensionStatus({
        targetUid,
        adminId: userProfile.uid,
        suspended: !currentlyBanned,
        reason: reason || 'Incumplimiento de normas comunitarias',
        reportId,
      });
      onSuccess?.(
        !currentlyBanned
          ? `🚫 Usuario ${targetName || targetUid} suspendido/baneado del sistema.`
          : `✅ Cuenta de ${targetName || targetUid} reactivada.`
      );
    } catch (err) {
      onError?.(err.message || 'No se pudo actualizar la suspensión.');
    } finally {
      setBusyId('');
    }
  };

  const handleReportStatus = async (report, nextStatus) => {
    setBusyId(report.id);
    try {
      await updateReportStatus({
        reportId: report.id,
        adminId: userProfile.uid,
        status: nextStatus,
      });
      onSuccess?.(nextStatus === 'resolved' ? 'Reporte marcado como revisado.' : 'Reporte cerrado.');
    } catch (err) {
      onError?.(err.message || 'No se pudo actualizar el reporte.');
    } finally {
      setBusyId('');
    }
  };

  const handleToggleBlueCheck = async (targetUser) => {
    const currentlyVerified = isProfileVerified(targetUser);
    setBusyId(targetUser.uid);
    try {
      await setUserVerificationBadge({
        targetUid: targetUser.uid,
        adminId: userProfile.uid,
        approved: !currentlyVerified,
      });
      onSuccess?.(
        !currentlyVerified
          ? `☑️ Check Azul otorgado a ${targetUser.name}.`
          : `Check Azul revocado a ${targetUser.name}.`
      );
    } catch (err) {
      onError?.(err.message || 'No se pudo actualizar la verificación.');
    } finally {
      setBusyId('');
    }
  };

  const handleApproveRecharge = async (req) => {
    setBusyId(req.id);
    try {
      await approvePaymentRequest({ requestId: req.id, adminId: userProfile.uid });
      onSuccess?.(`✅ Aprobado: +${req.coinsToCredit} monedas a ${req.userName}.`);
    } catch (err) {
      onError?.(err.message || 'No se pudo aprobar la recarga.');
    } finally {
      setBusyId('');
    }
  };

  const handleRejectRecharge = async (req) => {
    setBusyId(req.id);
    try {
      await rejectPaymentRequest({ requestId: req.id, adminId: userProfile.uid });
      onSuccess?.(`Recarga de ${req.userName} rechazada.`);
    } catch (err) {
      onError?.(err.message || 'No se pudo rechazar la recarga.');
    } finally {
      setBusyId('');
    }
  };

  const handlePayWithdrawal = async (w) => {
    const refText = payoutRefs[w.id] || '';
    if (!refText.trim()) {
      return onError?.('Ingresa la referencia / TxID de la transferencia.');
    }
    setBusyId(w.id);
    try {
      await markWithdrawalPaid({
        withdrawalId: w.id,
        adminId: userProfile.uid,
        payoutReference: refText,
      });
      onSuccess?.(`💸 Retiro de ${formatUSD(w.netPayoutUSD)} confirmado para ${w.userName}.`);
    } catch (err) {
      onError?.(err.message || 'No se pudo confirmar el retiro.');
    } finally {
      setBusyId('');
    }
  };

  const handleRejectWithdrawal = async (w) => {
    setBusyId(w.id);
    try {
      await rejectWithdrawalRequest({ withdrawalId: w.id, adminId: userProfile.uid });
      onSuccess?.(`Retiro rechazado. Los ${w.amountDiamonds} 💎 fueron devueltos a ${w.userName}.`);
    } catch (err) {
      onError?.(err.message || 'No se pudo rechazar el retiro.');
    } finally {
      setBusyId('');
    }
  };

  const handleSaveEconomyConfig = async (e) => {
    e.preventDefault();
    if (savingConfig) return;
    setSavingConfig(true);
    try {
      await updateEconomyConfig({
        adminId: userProfile.uid,
        baseDiamondValueUSD: Number(baseDiamondPrice),
        creatorShareRatio: Number(creatorSharePct) / 100,
        minWithdrawalDiamonds: Number(minWithdrawDiamonds),
        coinPackages: packagesDraft,
      });
      onSuccess?.('💎 Configuración de precios de diamantes actualizada en tiempo real en Firestore.');
    } catch (err) {
      onError?.(err.message || 'No se pudo guardar la configuración económica.');
    } finally {
      setSavingConfig(false);
    }
  };

  const webhookEndpointUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/webhooks/payments`
      : 'https://tu-dominio.vercel.app/api/webhooks/payments';

  const handleCopyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookEndpointUrl);
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 1800);
    } catch {
      onError?.('No se pudo copiar el endpoint.');
    }
  };

  const maxDailyCount = Math.max(1, ...metrics.dailyBuckets.map((b) => b.count));
  const funnelTotal = Math.max(1, metrics.adUsersCount + metrics.payingUsersCount);
  const previewNetDiamondRate = Number(
    (Number(baseDiamondPrice || 0) * (Number(creatorSharePct || 60) / 100)).toFixed(4)
  );

  return (
    <div className="h-[100dvh] w-screen overflow-y-auto bg-[#09080F] text-zinc-100">
      {/* ==================== NAVBAR SUPER ADMIN ==================== */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0E0C17]/95 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#FF2E54] via-rose-500 to-amber-400 flex items-center justify-center shadow-lg shadow-[#FF2E54]/25 shrink-0">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-base sm:text-lg font-black tracking-tight text-white truncate">
                  Conoscamosnos · Super Admin
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-[10px] font-extrabold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  En vivo
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 truncate">
                {userProfile?.name} ({userProfile?.role}) · Centro de Control y Tesorería
              </p>
            </div>
          </div>

          {/* Botón destacado requerido: Entrar a Conoscamosnos (Modo Usuario) -> /app */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/app')}
              className="px-4 py-2.5 rounded-full bg-gradient-to-r from-[#FF2E54] via-rose-500 to-amber-500 text-white text-xs sm:text-sm font-black shadow-lg shadow-[#FF2E54]/30 hover:brightness-110 active:scale-[0.98] transition flex items-center gap-2"
            >
              <Flame className="w-4 h-4 fill-white" />
              <span>Entrar a Conoscamosnos (Modo Usuario)</span>
            </button>

            <button
              type="button"
              onClick={() => logoutUser(userProfile?.uid)}
              className="p-2.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-zinc-300 hover:text-white transition"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sub-navegación de Módulos */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {NAV_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            const badge =
              tab.id === 'reports'
                ? metrics.openReportsCount
                : tab.id === 'verification'
                ? metrics.pendingVerificationsCount
                : tab.id === 'treasury'
                ? metrics.pendingRechargesCount + metrics.pendingWithdrawalsCount
                : 0;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-2xl text-xs font-extrabold flex items-center gap-2 shrink-0 border transition ${
                  active
                    ? 'bg-white text-zinc-950 border-white shadow-md'
                    : 'bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {badge > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                      active ? 'bg-[#FF2E54] text-white' : 'bg-[#FF2E54]/90 text-white'
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* ==================== CONTENIDO PRINCIPAL ==================== */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-16">
        {/* ==================== TAB 1: DASHBOARD ESTADÍSTICO ==================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Filtro de período para registros nuevos */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-black text-white">
                  Métricas en Tiempo Real
                </h2>
                <p className="text-xs text-zinc-400">
                  Sincronizado con Firestore: usuarios, ingresos, actividad, demografía y embudos.
                </p>
              </div>
              <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-white/5 border border-white/10">
                {[
                  { id: 'day', label: 'Hoy' },
                  { id: 'week', label: '7 días' },
                  { id: 'month', label: 'Este mes' },
                  { id: 'all', label: 'Todo' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setDateFilter(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
                      dateFilter === f.id
                        ? 'bg-gradient-to-r from-[#FF2E54] to-rose-500 text-white shadow'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Usuarios nuevos registrados */}
              <div className="rounded-3xl p-5 bg-gradient-to-br from-[#161224] to-[#110E1B] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400">
                    Usuarios Nuevos
                  </span>
                  <div className="w-9 h-9 rounded-2xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <p className="font-display text-3xl font-black text-white tabular-nums">
                    {metrics.newUsersCount}
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">
                    Total registrados: <strong className="text-white">{metrics.totalUsers}</strong>
                  </p>
                </div>
                {/* Mini barras de últimos 7 días */}
                <div className="flex items-end gap-1.5 h-10 pt-1">
                  {metrics.dailyBuckets.map((b, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t-md bg-gradient-to-t from-indigo-500 to-sky-400 transition-all"
                        style={{ height: `${Math.max(12, Math.round((b.count / maxDailyCount) * 28))}px` }}
                        title={`${b.label}: ${b.count}`}
                      />
                      <span className="text-[9px] text-zinc-500 uppercase">{b.label.slice(0, 2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Ingresos totales generados ($) */}
              <div className="rounded-3xl p-5 bg-gradient-to-br from-[#10201C] to-[#0D1415] border border-emerald-400/25 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-300">
                    Ingresos Totales ($)
                  </span>
                  <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <p className="font-display text-3xl font-black text-white tabular-nums">
                    {formatUSD(metrics.totalRevenueUSD)}
                  </p>
                  <p className="text-xs text-emerald-300/90 mt-1 font-semibold">
                    Balance neto: {formatUSD(metrics.netBalanceUSD)}
                  </p>
                </div>
                <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-2 text-[10px] text-zinc-400">
                  <div>
                    <span className="block">Pasarelas / Manual</span>
                    <strong className="text-zinc-200">
                      {formatUSD(metrics.gatewayCompletedUSD + metrics.manualApprovedUSD)}
                    </strong>
                  </div>
                  <div>
                    <span className="block">Publicidad (Est.)</span>
                    <strong className="text-amber-300">{formatUSD(metrics.adEstRevenueUSD)}</strong>
                  </div>
                </div>
              </div>

              {/* 3. Usuarios Activos (Última conexión) */}
              <div className="rounded-3xl p-5 bg-gradient-to-br from-[#1B1020] to-[#120D18] border border-rose-400/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-300">
                    Usuarios Activos
                  </span>
                  <div className="w-9 h-9 rounded-2xl bg-rose-500/20 text-rose-300 flex items-center justify-center">
                    <Activity className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <p className="font-display text-3xl font-black text-white tabular-nums flex items-center gap-2">
                    {metrics.activeNowCount}
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">
                    En línea ahora (últimos 5 min)
                  </p>
                </div>
                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400">Activos últimas 24h:</span>
                  <strong className="text-white">{metrics.active24hCount} usuarios</strong>
                </div>
              </div>

              {/* 4. Salud y Pendientes */}
              <div className="rounded-3xl p-5 bg-gradient-to-br from-[#1C160F] to-[#131015] border border-amber-400/25 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300">
                    Bandeja Operativa
                  </span>
                  <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                </div>
                <div className="space-y-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveTab('reports')}
                    className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 transition"
                  >
                    <span className="text-zinc-300">Reportes abiertos</span>
                    <strong className="text-rose-400">{metrics.openReportsCount}</strong>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('verification')}
                    className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 transition"
                  >
                    <span className="text-zinc-300">Solicitudes Check Azul</span>
                    <strong className="text-sky-400">{metrics.pendingVerificationsCount}</strong>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('treasury')}
                    className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 transition"
                  >
                    <span className="text-zinc-300">Pagos / Retiros pend.</span>
                    <strong className="text-amber-300">
                      {metrics.pendingRechargesCount + metrics.pendingWithdrawalsCount}
                    </strong>
                  </button>
                </div>
              </div>
            </div>

            {/* Grid 2 Columnas: Demografía por País + Embudo de Monetización */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Demografía por País */}
              <section className="rounded-3xl p-5 bg-[#12101D] border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-base font-extrabold text-white flex items-center gap-2">
                      <Globe className="w-4 h-4 text-sky-400" />
                      Demografía por País
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Distribución geográfica de perfiles registrados
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-white/5 text-xs font-bold text-zinc-300">
                    {metrics.countries.length} países
                  </span>
                </div>

                {metrics.countries.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-8 text-center">Sin registros todavía.</p>
                ) : (
                  <div className="space-y-3">
                    {metrics.countries.slice(0, 8).map((c) => {
                      const pct =
                        metrics.totalUsers > 0
                          ? Math.round((c.count / metrics.totalUsers) * 100)
                          : 0;
                      return (
                        <div key={c.code} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-zinc-200 flex items-center gap-2">
                              <span className="text-base">{c.flag}</span>
                              <span>{c.name}</span>
                              <span className="text-[10px] text-zinc-500 font-mono">({c.code})</span>
                            </span>
                            <span className="font-extrabold text-white tabular-nums">
                              {c.count} <span className="text-zinc-400 font-semibold">({pct}%)</span>
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#FF2E54] via-rose-400 to-amber-400"
                              style={{ width: `${Math.max(4, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Embudo de Monetización: Publicidad vs Compradores de Diamantes */}
              <section className="rounded-3xl p-5 bg-[#12101D] border border-white/10 space-y-5 flex flex-col justify-between">
                <div>
                  <h3 className="font-display text-base font-extrabold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Embudo de Monetización
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Comparativa en vivo: usuarios que consumen publicidad vs. usuarios que compran diamantes/monedas
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/15 to-teal-500/5 border border-emerald-400/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold text-emerald-300 uppercase">
                        Consumen Publicidad
                      </span>
                      <Tv className="w-4 h-4 text-emerald-300" />
                    </div>
                    <p className="font-display text-3xl font-black text-white tabular-nums">
                      {metrics.adUsersCount}
                    </p>
                    <p className="text-[11px] text-zinc-300">
                      <strong>{metrics.adConversionPct}%</strong> del total ·{' '}
                      {metrics.adImpressionsTotal} anuncios vistos
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-gradient-to-br from-sky-500/15 to-indigo-500/10 border border-sky-400/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold text-sky-300 uppercase">
                        Pagan Diamantes
                      </span>
                      <Gem className="w-4 h-4 text-sky-300" />
                    </div>
                    <p className="font-display text-3xl font-black text-white tabular-nums">
                      {metrics.payingUsersCount}
                    </p>
                    <p className="text-[11px] text-zinc-300">
                      <strong>{metrics.paidConversionPct}%</strong> del total ·{' '}
                      {formatUSD(metrics.gatewayCompletedUSD + metrics.manualApprovedUSD)}
                    </p>
                  </div>
                </div>

                {/* Barra comparativa apilada */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400">
                    <span>Proporción de monetizadores activos</span>
                    <span>
                      {Math.round((metrics.adUsersCount / funnelTotal) * 100)}% Ads /{' '}
                      {Math.round((metrics.payingUsersCount / funnelTotal) * 100)}% Pagos
                    </span>
                  </div>
                  <div className="w-full h-3.5 rounded-full bg-white/10 overflow-hidden flex">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all"
                      style={{
                        width: `${Math.round((metrics.adUsersCount / funnelTotal) * 100)}%`,
                      }}
                    />
                    <div
                      className="h-full bg-gradient-to-r from-sky-400 to-indigo-500 transition-all"
                      style={{
                        width: `${Math.round((metrics.payingUsersCount / funnelTotal) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ==================== TAB 2: MÓDULO DE REPORTES (SUSPENDER / BANEAR) ==================== */}
        {activeTab === 'reports' && (
          <section className="rounded-3xl bg-[#12101D] border border-white/10 overflow-hidden">
            <div className="p-5 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-black text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-[#FF2E54]" />
                  Módulo de Reportes y Suspensiones
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Suspender o banear bloquea el acceso del usuario inmediatamente y lo retira de Swipe y Explorar.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-rose-500/15 border border-rose-400/30 text-rose-300 text-xs font-extrabold">
                {reports.length} reportes totales · {metrics.openReportsCount} abiertos
              </span>
            </div>

            {reports.length === 0 ? (
              <p className="text-sm text-zinc-400 text-center py-12">
                No hay denuncias registradas por la comunidad.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 text-zinc-400 uppercase text-[10px] font-extrabold tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Usuario Denunciado</th>
                      <th className="px-4 py-3">Motivo y Detalle</th>
                      <th className="px-4 py-3">Denunciante</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {reports.map((rep) => {
                      const target = userById[rep.reportedUserId];
                      const isBanned = Boolean(target?.isBanned || target?.accountStatus === 'banned');
                      const busy = busyId === rep.id || busyId === rep.reportedUserId;
                      return (
                        <tr key={rep.id} className="hover:bg-white/[0.02] transition">
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <img
                                src={
                                  rep.reportedUserPhoto ||
                                  getPrimaryPhoto(target || { name: rep.reportedUserName || '?' }, 120)
                                }
                                alt=""
                                className="w-10 h-10 rounded-xl object-cover bg-zinc-800 shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="font-extrabold text-white truncate">
                                  {rep.reportedUserName || target?.name || rep.reportedUserId}
                                </p>
                                <span
                                  className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase ${
                                    isBanned
                                      ? 'bg-rose-500/20 text-rose-300 border border-rose-400/30'
                                      : 'bg-emerald-500/15 text-emerald-300'
                                  }`}
                                >
                                  {isBanned ? 'Baneado' : 'Activo'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 max-w-xs">
                            <p className="font-bold text-rose-300">{rep.reason}</p>
                            {rep.details && (
                              <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2">
                                “{rep.details}”
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-zinc-300 font-semibold">
                            {rep.reporterName || rep.reporterId?.slice(0, 8)}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="px-2.5 py-1 rounded-full bg-white/10 text-[10px] font-extrabold uppercase text-zinc-200">
                              {rep.status || 'open'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="inline-flex items-center gap-2">
                              {(!rep.status || rep.status === 'open') && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => handleReportStatus(rep, 'dismissed')}
                                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-200 font-bold disabled:opacity-50"
                                >
                                  Descartar
                                </button>
                              )}
                              {rep.reportedUserId && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    handleToggleBan(
                                      rep.reportedUserId,
                                      rep.reportedUserName || target?.name,
                                      isBanned,
                                      rep.reason,
                                      rep.id
                                    )
                                  }
                                  className={`px-3 py-1.5 rounded-xl font-extrabold inline-flex items-center gap-1.5 disabled:opacity-50 transition ${
                                    isBanned
                                      ? 'bg-emerald-500/20 border border-emerald-400/35 text-emerald-300 hover:bg-emerald-500/30'
                                      : 'bg-[#FF2E54] hover:brightness-110 text-white shadow'
                                  }`}
                                >
                                  {isBanned ? (
                                    <>
                                      <Unlock className="w-3.5 h-3.5" /> Reactivar
                                    </>
                                  ) : (
                                    <>
                                      <Ban className="w-3.5 h-3.5" /> Suspender / Banear
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ==================== TAB 3: MÓDULO DE VERIFICACIÓN (CHECK AZUL) ==================== */}
        {activeTab === 'verification' && (
          <section className="rounded-3xl bg-[#12101D] border border-white/10 overflow-hidden">
            <div className="p-5 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-black text-white flex items-center gap-2">
                  <BadgeCheck className="w-5 h-5 text-sky-400 fill-sky-400 stroke-[#12101D]" />
                  Verificación de Perfiles (Check Azul)
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Aprueba solicitudes o verifica perfiles auténticos para otorgarles la insignia oficial azul.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Buscar nombre, correo o ciudad..."
                    className="pl-8 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-sky-400"
                  />
                </div>
                <div className="inline-flex p-1 rounded-xl bg-white/5 border border-white/10 text-xs">
                  {[
                    { id: 'all', label: 'Todos' },
                    { id: 'pending', label: `Solicitudes (${metrics.pendingVerificationsCount})` },
                    { id: 'verified', label: 'Verificados' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setVerificationFilter(f.id)}
                      className={`px-2.5 py-1 rounded-lg font-bold transition ${
                        verificationFilter === f.id
                          ? 'bg-sky-500 text-white'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/5 text-zinc-400 uppercase text-[10px] font-extrabold tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Perfil</th>
                    <th className="px-4 py-3">Ubicación y Fotos</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Check Azul</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredVerificationUsers.map((u) => {
                    const verified = isProfileVerified(u);
                    const isPending = u.verificationStatus === 'pending' && !verified;
                    const busy = busyId === u.uid;
                    return (
                      <tr key={u.uid} className="hover:bg-white/[0.02] transition">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <img
                              src={getPrimaryPhoto(u, 140)}
                              alt={u.name}
                              className="w-11 h-11 rounded-2xl object-cover bg-zinc-800 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="font-extrabold text-white flex items-center gap-1">
                                <span className="truncate">
                                  {u.name}
                                  {u.age ? `, ${u.age}` : ''}
                                </span>
                                {verified && (
                                  <BadgeCheck className="w-4 h-4 text-sky-400 fill-sky-400 stroke-[#12101D] shrink-0" />
                                )}
                              </p>
                              <p className="text-[11px] text-zinc-400 truncate">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-zinc-200">
                            {u.country?.flag || '🌎'} {u.city || u.country?.name || 'Global'}
                          </p>
                          <p className="text-[11px] text-zinc-500">
                            {(u.photos || []).length} fotos · {u.bio ? 'Con biografía' : 'Sin bio'}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          {verified ? (
                            <span className="px-2.5 py-1 rounded-full bg-sky-500/20 border border-sky-400/35 text-sky-300 text-[10px] font-black uppercase">
                              Verificado ✓
                            </span>
                          ) : isPending ? (
                            <span className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/35 text-amber-300 text-[10px] font-black uppercase">
                              Solicitud pendiente
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-white/5 text-zinc-400 text-[10px] font-bold uppercase">
                              Estándar
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleToggleBlueCheck(u)}
                            className={`px-3.5 py-2 rounded-xl font-extrabold inline-flex items-center gap-1.5 disabled:opacity-50 transition ${
                              verified
                                ? 'bg-white/10 hover:bg-rose-500/20 text-zinc-200 hover:text-rose-300'
                                : 'bg-gradient-to-r from-sky-500 to-indigo-500 hover:brightness-110 text-white shadow'
                            }`}
                          >
                            <BadgeCheck className="w-3.5 h-3.5" />
                            {busy ? 'Guardando...' : verified ? 'Revocar Check' : 'Otorgar Check Azul'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ==================== TAB 4: TESORERÍA (RECARGAS, RETIROS Y WEBHOOKS) ==================== */}
        {activeTab === 'treasury' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex p-1 rounded-2xl bg-white/5 border border-white/10 text-xs">
                {[
                  { id: 'recharges', label: `Recargas Manuales (${metrics.pendingRechargesCount})` },
                  { id: 'withdrawals', label: `Retiros USD (${metrics.pendingWithdrawalsCount})` },
                  { id: 'webhooks', label: `Pagos API / Webhooks (${paymentTxs.length})` },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTreasurySubTab(t.id)}
                    className={`px-3.5 py-2 rounded-xl font-extrabold transition ${
                      treasurySubTab === t.id
                        ? 'bg-white text-zinc-950'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-emerald-300 font-bold flex items-center gap-1">
                  <ArrowDownLeft className="w-3.5 h-3.5" /> Ingresos: {formatUSD(metrics.totalRevenueUSD)}
                </span>
                <span className="text-sky-300 font-bold flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5" /> Pagado: {formatUSD(metrics.totalPaidOutUSD)}
                </span>
              </div>
            </div>

            {treasurySubTab === 'recharges' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {paymentRequests.length === 0 ? (
                  <p className="text-xs text-zinc-500 col-span-2 text-center py-10">
                    Sin solicitudes manuales de recarga.
                  </p>
                ) : (
                  paymentRequests.map((req) => (
                    <div
                      key={req.id}
                      className="p-4 rounded-3xl bg-[#12101D] border border-white/10 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-extrabold text-white">
                            {req.countryFlag} {req.userName}
                          </p>
                          <p className="text-[11px] text-zinc-400">
                            {req.methodName} • Ref:{' '}
                            <span className="font-mono text-zinc-200">{req.referenceNumber}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-emerald-400">{formatUSD(req.amountUSD)}</p>
                          <p className="text-xs font-bold text-amber-300">+{req.coinsToCredit} 🪙</p>
                        </div>
                      </div>

                      {req.proofUrl && (
                        <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/40">
                          <img
                            src={req.proofUrl}
                            alt="Comprobante"
                            onClick={() => setPreviewImg(req.proofUrl)}
                            className="w-full max-h-40 object-contain cursor-pointer"
                          />
                          <a
                            href={req.proofUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="absolute bottom-2 right-2 px-2.5 py-1 rounded-full bg-black/75 text-white text-[10px] font-bold inline-flex items-center gap-1"
                          >
                            Abrir <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}

                      {req.status === 'pending' ? (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={busyId === req.id}
                            onClick={() => handleRejectRecharge(req)}
                            className="py-2.5 rounded-xl bg-rose-500/15 border border-rose-400/30 text-rose-300 text-xs font-extrabold flex items-center justify-center gap-1 hover:bg-rose-500/25 disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" /> Rechazar
                          </button>
                          <button
                            type="button"
                            disabled={busyId === req.id}
                            onClick={() => handleApproveRecharge(req)}
                            className="py-2.5 rounded-xl bg-emerald-500 text-zinc-950 text-xs font-black flex items-center justify-center gap-1 hover:brightness-110 disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Aprobar
                          </button>
                        </div>
                      ) : (
                        <p className="text-[11px] font-extrabold uppercase text-zinc-400">
                          Estado: {req.status}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {treasurySubTab === 'withdrawals' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {withdrawals.length === 0 ? (
                  <p className="text-xs text-zinc-500 col-span-2 text-center py-10">
                    Sin solicitudes de retiro de creadores.
                  </p>
                ) : (
                  withdrawals.map((w) => (
                    <div
                      key={w.id}
                      className="p-4 rounded-3xl bg-[#12101D] border border-white/10 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-extrabold text-white">
                            {w.countryFlag} {w.userName}
                          </p>
                          <p className="text-[11px] text-sky-300 font-semibold">
                            {w.payoutMethodName}: {w.payoutDetails}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-emerald-400">
                            Pagar {formatUSD(w.netPayoutUSD)}
                          </p>
                          <p className="text-[11px] text-zinc-400">{w.amountDiamonds} 💎</p>
                        </div>
                      </div>

                      {w.status === 'pending' ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            placeholder="TxID / Referencia del pago enviado"
                            value={payoutRefs[w.id] || ''}
                            onChange={(e) =>
                              setPayoutRefs((prev) => ({ ...prev, [w.id]: e.target.value }))
                            }
                            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-sky-400"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              disabled={busyId === w.id}
                              onClick={() => handleRejectWithdrawal(w)}
                              className="py-2 rounded-xl bg-rose-500/15 border border-rose-400/30 text-rose-300 text-xs font-extrabold disabled:opacity-50"
                            >
                              Rechazar y Devolver 💎
                            </button>
                            <button
                              type="button"
                              disabled={busyId === w.id}
                              onClick={() => handlePayWithdrawal(w)}
                              className="py-2 rounded-xl bg-sky-500 text-zinc-950 text-xs font-black disabled:opacity-50"
                            >
                              Confirmar Pago
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[11px] text-zinc-400 flex justify-between">
                          <span className="uppercase font-bold">Estado: {w.status}</span>
                          {w.payoutReference && (
                            <span className="font-mono text-emerald-300">Ref: {w.payoutReference}</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {treasurySubTab === 'webhooks' && (
              <div className="rounded-3xl bg-[#12101D] border border-white/10 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 text-zinc-400 uppercase text-[10px] font-extrabold">
                    <tr>
                      <th className="px-4 py-3">Proveedor</th>
                      <th className="px-4 py-3">Usuario</th>
                      <th className="px-4 py-3">Monto</th>
                      <th className="px-4 py-3">Acreditado</th>
                      <th className="px-4 py-3">Firma / Origen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {paymentTxs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                          Aún no se han recibido pagos automáticos vía Webhook.
                        </td>
                      </tr>
                    ) : (
                      paymentTxs.map((tx) => (
                        <tr key={tx.id}>
                          <td className="px-4 py-3 font-extrabold uppercase text-sky-300">
                            {tx.provider || 'gateway'}
                          </td>
                          <td className="px-4 py-3 text-white font-semibold">
                            {tx.userName || tx.userId}
                          </td>
                          <td className="px-4 py-3 text-emerald-400 font-black">
                            {formatUSD(tx.amountUSD)}
                          </td>
                          <td className="px-4 py-3 text-amber-300 font-bold">
                            +{tx.coinsCredited || tx.diamondsCredited || 0}
                          </td>
                          <td className="px-4 py-3 text-zinc-400">
                            {tx.verifiedSignature ? '🔒 Firma HMAC/SHA verificada' : tx.source || 'admin'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 5: CONFIGURACIÓN ECONÓMICA & WEBHOOK API ==================== */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Formulario para actualizar el precio de los diamantes en Firestore */}
            <form
              onSubmit={handleSaveEconomyConfig}
              className="rounded-3xl p-6 bg-[#12101D] border border-white/10 space-y-5"
            >
              <div>
                <h2 className="font-display text-lg font-black text-white flex items-center gap-2">
                  <Gem className="w-5 h-5 text-sky-400" />
                  Precio de Diamantes y Economía (Firestore)
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Los cambios guardados en <code className="text-sky-300">appConfig/economy</code> se reflejan en tiempo real en toda la app y en el webhook de pagos.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-zinc-300 block mb-1">
                    Precio base / 💎 (USD)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    max="5"
                    required
                    value={baseDiamondPrice}
                    onChange={(e) => setBaseDiamondPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm font-black text-white focus:outline-none focus:border-sky-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-zinc-300 block mb-1">
                    % Neto Creador
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="95"
                    required
                    value={creatorSharePct}
                    onChange={(e) => setCreatorSharePct(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm font-black text-white focus:outline-none focus:border-sky-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-zinc-300 block mb-1">
                    Retiro Mínimo (💎)
                  </label>
                  <input
                    type="number"
                    min="100"
                    step="50"
                    required
                    value={minWithdrawDiamonds}
                    onChange={(e) => setMinWithdrawDiamonds(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm font-black text-white focus:outline-none focus:border-sky-400"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-400/25 text-xs text-sky-200 flex items-center justify-between">
                <span>Pago neto resultante al creador por diamante:</span>
                <strong className="text-white text-sm">${previewNetDiamondRate} USD / 💎</strong>
              </div>

              {/* Editor de precios de paquetes */}
              <div className="space-y-2.5">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400">
                  Paquetes de Compra (Monedas / Diamantes)
                </p>
                <div className="space-y-2">
                  {packagesDraft.map((pkg, idx) => (
                    <div
                      key={pkg.id}
                      className="grid grid-cols-12 gap-2 items-center p-2.5 rounded-2xl bg-white/5 border border-white/10"
                    >
                      <div className="col-span-4 min-w-0">
                        <p className="text-xs font-extrabold text-white truncate">{pkg.label}</p>
                        <p className="text-[10px] font-mono text-zinc-500">{pkg.id}</p>
                      </div>
                      <div className="col-span-4">
                        <label className="text-[9px] text-zinc-400 block">Monedas/💎</label>
                        <input
                          type="number"
                          min="10"
                          value={pkg.coins}
                          onChange={(e) => {
                            const next = [...packagesDraft];
                            next[idx] = { ...next[idx], coins: Number(e.target.value) };
                            setPackagesDraft(next);
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs font-bold text-amber-300"
                        />
                      </div>
                      <div className="col-span-4">
                        <label className="text-[9px] text-zinc-400 block">Precio (USD)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.5"
                          value={pkg.priceUSD}
                          onChange={(e) => {
                            const next = [...packagesDraft];
                            next[idx] = { ...next[idx], priceUSD: Number(e.target.value) };
                            setPackagesDraft(next);
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs font-bold text-emerald-300"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={savingConfig}
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 text-zinc-950 font-black text-sm shadow-lg hover:brightness-110 disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {savingConfig ? 'Guardando en Firestore...' : 'Guardar Precios de Diamantes'}
              </button>
            </form>

            {/* Tarjeta de Integración de API Webhooks (NowPayments / Payeer) */}
            <section className="rounded-3xl p-6 bg-[#12101D] border border-white/10 space-y-4">
              <div>
                <h2 className="font-display text-lg font-black text-white flex items-center gap-2">
                  <Webhook className="w-5 h-5 text-amber-400" />
                  API de Webhooks (NowPayments / Payeer)
                </h2>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Configura esta URL como Callback / IPN en tu panel de <strong>NowPayments</strong> o <strong>Payeer</strong>. El middleware valida la firma criptográfica (<code className="text-amber-300">HMAC-SHA512</code> / <code className="text-amber-300">SHA-256</code>) antes de acreditar saldo en Firestore.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
                  Endpoint POST Oficial
                </span>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono text-white break-all flex-1">
                    {webhookEndpointUrl}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyWebhook}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white inline-flex items-center gap-1 shrink-0"
                  >
                    {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedWebhook ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-xs text-zinc-300">
                <p className="font-extrabold text-white">Variables de entorno requeridas en Vercel / Servidor:</p>
                <ul className="space-y-1.5 text-[11px] font-mono text-zinc-400 bg-black/30 p-3.5 rounded-2xl border border-white/5">
                  <li><span className="text-amber-300">NOWPAYMENTS_IPN_SECRET</span>=...</li>
                  <li><span className="text-amber-300">PAYEER_SHOP_ID</span>=...</li>
                  <li><span className="text-amber-300">PAYEER_SECRET_KEY</span>=...</li>
                  <li><span className="text-sky-300">FIREBASE_SERVICE_ACCOUNT_JSON</span>=&#123;...&#125;</li>
                </ul>
                <p className="text-[11px] text-zinc-400 leading-relaxed pt-1">
                  Convención de <code className="text-zinc-200">order_id</code> al crear facturas:{' '}
                  <code className="text-emerald-300">uid:USER_ID|pkg:pack_550|target:coins</code> (o <code className="text-sky-300">target:diamonds</code>).
                </p>
              </div>
            </section>
          </div>
        )}
      </main>

      {previewImg && (
        <div
          className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewImg(null)}
        >
          <img
            src={previewImg}
            alt="Comprobante ampliado"
            className="max-w-full max-h-[88dvh] rounded-2xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
