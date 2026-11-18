import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  Ban,
  BarChart3,
  Building2,
  Check,
  CheckCircle2,
  Clock,
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
  Wallet,
  Webhook,
  X,
  XCircle,
  ZoomIn,
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
  formatGiftDate,
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
  const [treasuryStatusFilter, setTreasuryStatusFilter] = useState('all'); // 'all' | 'pending' | 'done' | 'rejected'
  const [treasurySearch, setTreasurySearch] = useState('');
  const [copiedTreasuryKey, setCopiedTreasuryKey] = useState('');
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
    const pendingRechargesUSD = paymentRequests
      .filter((r) => r.status === 'pending')
      .reduce((acc, r) => acc + Number(r.amountUSD || 0), 0);
    const pendingWithdrawalsUSD = withdrawals
      .filter((w) => w.status === 'pending')
      .reduce((acc, w) => acc + Number(w.netPayoutUSD || 0), 0);
    const paidWithdrawalsCount = withdrawals.filter((w) => w.status === 'paid').length;

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
      pendingRechargesUSD,
      pendingWithdrawalsUSD,
      paidWithdrawalsCount,
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

  const handleCopyTreasuryText = async (key, text, label = 'Dato') => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(String(text));
      setCopiedTreasuryKey(key);
      onSuccess?.(`${label} copiado al portapapeles.`);
      setTimeout(() => {
        setCopiedTreasuryKey((prev) => (prev === key ? '' : prev));
      }, 1800);
    } catch {
      onError?.('No se pudo copiar automáticamente.');
    }
  };

  const filteredPaymentRequests = useMemo(() => {
    const q = treasurySearch.trim().toLowerCase();
    return [...paymentRequests]
      .filter((r) => {
        if (treasuryStatusFilter === 'pending' && r.status !== 'pending') return false;
        if (treasuryStatusFilter === 'done' && r.status !== 'approved') return false;
        if (treasuryStatusFilter === 'rejected' && r.status !== 'rejected') return false;
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
  }, [paymentRequests, treasuryStatusFilter, treasurySearch]);

  const filteredWithdrawals = useMemo(() => {
    const q = treasurySearch.trim().toLowerCase();
    return [...withdrawals]
      .filter((w) => {
        if (treasuryStatusFilter === 'pending' && w.status !== 'pending') return false;
        if (treasuryStatusFilter === 'done' && w.status !== 'paid') return false;
        if (treasuryStatusFilter === 'rejected' && w.status !== 'rejected') return false;
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
  }, [withdrawals, treasuryStatusFilter, treasurySearch]);

  const filteredPaymentTxs = useMemo(() => {
    const q = treasurySearch.trim().toLowerCase();
    return paymentTxs.filter((tx) => {
      if (!q) return true;
      return (
        (tx.userName || '').toLowerCase().includes(q) ||
        (tx.userId || '').toLowerCase().includes(q) ||
        (tx.provider || '').toLowerCase().includes(q) ||
        (tx.externalPaymentId || '').toLowerCase().includes(q)
      );
    });
  }, [paymentTxs, treasurySearch]);

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

        {/* ==================== TAB 4: TESORERÍA FINTECH (RECARGAS, RETIROS Y NOWPAYMENTS) ==================== */}
        {activeTab === 'treasury' && (
          <div className="space-y-5">
            {/* Resumen Ejecutivo de Tesorería (KPIs interactivos) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="rounded-3xl p-4 sm:p-5 bg-gradient-to-br from-[#10231D] via-[#0F1B1A] to-[#0D1318] border border-emerald-400/25 space-y-2 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-emerald-300">
                    Ingresos Totales
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
                    <ArrowDownLeft className="w-4 h-4" />
                  </div>
                </div>
                <p className="font-display text-2xl sm:text-3xl font-black text-white tabular-nums">
                  {formatUSD(metrics.totalRevenueUSD)}
                </p>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10.5px] text-zinc-400 pt-1 border-t border-white/10">
                  <span>API: <strong className="text-zinc-200">{formatUSD(metrics.gatewayCompletedUSD)}</strong></span>
                  <span>Manual: <strong className="text-zinc-200">{formatUSD(metrics.manualApprovedUSD)}</strong></span>
                  <span>Ads: <strong className="text-amber-300">{formatUSD(metrics.adEstRevenueUSD)}</strong></span>
                </div>
              </div>

              <div className="rounded-3xl p-4 sm:p-5 bg-gradient-to-br from-[#231911] via-[#17131B] to-[#12101A] border border-amber-400/30 space-y-2 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-amber-300">
                    Por Validar / Pagar
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="space-y-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setTreasurySubTab('recharges');
                      setTreasuryStatusFilter('pending');
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-between text-xs transition"
                  >
                    <span className="text-zinc-300 font-semibold">Recargas pend.</span>
                    <span className="font-extrabold text-amber-300 tabular-nums">
                      {metrics.pendingRechargesCount} ({formatUSD(metrics.pendingRechargesUSD)})
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTreasurySubTab('withdrawals');
                      setTreasuryStatusFilter('pending');
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-between text-xs transition"
                  >
                    <span className="text-zinc-300 font-semibold">Retiros por pagar</span>
                    <span className="font-extrabold text-sky-300 tabular-nums">
                      {metrics.pendingWithdrawalsCount} ({formatUSD(metrics.pendingWithdrawalsUSD)})
                    </span>
                  </button>
                </div>
              </div>

              <div className="rounded-3xl p-4 sm:p-5 bg-gradient-to-br from-[#0F1B29] via-[#111522] to-[#10101A] border border-sky-400/25 space-y-2 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-sky-300">
                    Pagado a Creadores
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-300 flex items-center justify-center">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
                <p className="font-display text-2xl sm:text-3xl font-black text-white tabular-nums">
                  {formatUSD(metrics.totalPaidOutUSD)}
                </p>
                <p className="text-[11px] text-zinc-400 pt-1 border-t border-white/10">
                  <strong className="text-sky-200">{metrics.paidWithdrawalsCount}</strong> liquidaciones confirmadas
                </p>
              </div>

              <div className="rounded-3xl p-4 sm:p-5 bg-gradient-to-br from-[#19132B] via-[#131020] to-[#0F0E17] border border-indigo-400/25 space-y-2 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-indigo-300">
                    Balance Neto Caja
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center">
                    <Building2 className="w-4 h-4" />
                  </div>
                </div>
                <p className="font-display text-2xl sm:text-3xl font-black text-white tabular-nums">
                  {formatUSD(metrics.netBalanceUSD)}
                </p>
                <p className="text-[11px] text-zinc-400 pt-1 border-t border-white/10">
                  Margen retenido tras retiros enviados
                </p>
              </div>
            </div>

            {/* Barra de Navegación + Búsqueda + Filtros Rápidos */}
            <div className="rounded-3xl p-3.5 bg-[#12101D] border border-white/10 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex flex-wrap p-1 rounded-2xl bg-white/5 border border-white/10 text-xs gap-1">
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
                      label: 'NowPayments IPN',
                      count: paymentTxs.length,
                      icon: Webhook,
                      badgeAccent: 'bg-emerald-400/20 text-emerald-300',
                    },
                  ].map((t) => {
                    const TabIcon = t.icon;
                    const active = treasurySubTab === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setTreasurySubTab(t.id);
                          setTreasuryStatusFilter('all');
                        }}
                        className={`px-3.5 py-2 rounded-xl font-extrabold inline-flex items-center gap-1.5 transition ${
                          active
                            ? 'bg-white text-zinc-950 shadow-sm'
                            : 'text-zinc-300 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <TabIcon className="w-3.5 h-3.5" />
                        <span>{t.label}</span>
                        {t.count > 0 && (
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[10px] font-black tabular-nums ${
                              active && t.id !== 'webhooks'
                                ? 'bg-[#FF2E54] text-white'
                                : t.badgeAccent
                            }`}
                          >
                            {t.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="relative flex-1 min-w-[210px] max-w-xs">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={treasurySearch}
                    onChange={(e) => setTreasurySearch(e.target.value)}
                    placeholder="Buscar usuario, ref, TxID o cuenta..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-sky-400"
                  />
                </div>
              </div>

              {treasurySubTab !== 'webhooks' && (
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/10 text-xs">
                  {[
                    { id: 'all', label: 'Todos' },
                    {
                      id: 'pending',
                      label:
                        treasurySubTab === 'recharges'
                          ? `Pendientes (${metrics.pendingRechargesCount})`
                          : `Por Pagar (${metrics.pendingWithdrawalsCount})`,
                    },
                    {
                      id: 'done',
                      label: treasurySubTab === 'recharges' ? 'Aprobados' : 'Pagados',
                    },
                    { id: 'rejected', label: 'Rechazados' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setTreasuryStatusFilter(f.id)}
                      className={`px-3 py-1 rounded-full text-[11px] font-extrabold transition ${
                        treasuryStatusFilter === f.id
                          ? 'bg-sky-500 text-zinc-950 shadow-sm'
                          : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* SUB-TAB 1: RECARGAS MANUALES */}
            {treasurySubTab === 'recharges' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredPaymentRequests.length === 0 ? (
                  <div className="col-span-full rounded-3xl bg-[#12101D] border border-white/10 p-10 text-center space-y-2">
                    <Coins className="w-8 h-8 text-zinc-600 mx-auto" />
                    <p className="text-sm font-bold text-zinc-300">
                      Sin solicitudes en este filtro
                    </p>
                    <p className="text-xs text-zinc-500">
                      Cambia el filtro de estado o búsqueda para revisar otros comprobantes.
                    </p>
                  </div>
                ) : (
                  filteredPaymentRequests.map((req) => {
                    const userObj = userById[req.userId];
                    const avatar =
                      req.userPhoto || getPrimaryPhoto(userObj || { name: req.userName || '?' }, 120);
                    const isPending = req.status === 'pending';
                    const isApproved = req.status === 'approved';
                    const copyKey = `req_${req.id}`;

                    return (
                      <div
                        key={req.id}
                        className={`rounded-3xl p-4 sm:p-5 bg-[#12101D] border space-y-3.5 transition ${
                          isPending
                            ? 'border-amber-400/35 shadow-[0_10px_30px_-14px_rgba(245,158,11,0.35)]'
                            : 'border-white/10'
                        }`}
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
                                <p className="text-sm font-extrabold text-white truncate">
                                  {req.countryFlag} {req.userName}
                                </p>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase ${
                                    isPending
                                      ? 'bg-amber-500/20 border border-amber-400/40 text-amber-300'
                                      : isApproved
                                      ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300'
                                      : 'bg-rose-500/20 border border-rose-400/40 text-rose-300'
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
                            <p className="text-xs font-extrabold text-amber-300">
                              +{req.coinsToCredit} 🪙
                            </p>
                          </div>
                        </div>

                        {/* Referencia con copia 1-tap */}
                        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-black/35 border border-white/10">
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                              Referencia / Hash
                            </span>
                            <span className="text-xs font-mono font-bold text-zinc-100 break-all">
                              {req.referenceNumber}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyTreasuryText(copyKey, req.referenceNumber, 'Referencia')
                            }
                            className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] font-bold text-white inline-flex items-center gap-1 shrink-0 transition"
                          >
                            {copiedTreasuryKey === copyKey ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            {copiedTreasuryKey === copyKey ? 'Copiado' : 'Copiar'}
                          </button>
                        </div>

                        {req.proofUrl && (
                          <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/50 group">
                            <img
                              src={req.proofUrl}
                              alt="Comprobante"
                              onClick={() => setPreviewImg(req.proofUrl)}
                              className="w-full h-36 object-contain cursor-pointer group-hover:scale-[1.02] transition"
                            />
                            <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setPreviewImg(req.proofUrl)}
                                className="px-2.5 py-1 rounded-full bg-black/80 hover:bg-black text-white text-[10px] font-bold inline-flex items-center gap-1 backdrop-blur-sm"
                              >
                                <ZoomIn className="w-3 h-3" /> Ampliar
                              </button>
                              <a
                                href={req.proofUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1 rounded-full bg-black/80 hover:bg-black text-white text-[10px] font-bold inline-flex items-center gap-1 backdrop-blur-sm"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        )}

                        {isPending ? (
                          <div className="grid grid-cols-2 gap-2.5 pt-1">
                            <button
                              type="button"
                              disabled={busyId === req.id}
                              onClick={() => handleRejectRecharge(req)}
                              className="py-2.5 rounded-xl bg-rose-500/15 border border-rose-400/30 text-rose-300 text-xs font-extrabold flex items-center justify-center gap-1.5 hover:bg-rose-500/25 disabled:opacity-50 transition"
                            >
                              <XCircle className="w-4 h-4" /> Rechazar
                            </button>
                            <button
                              type="button"
                              disabled={busyId === req.id}
                              onClick={() => handleApproveRecharge(req)}
                              className="py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 text-zinc-950 text-xs font-black flex items-center justify-center gap-1.5 hover:brightness-110 disabled:opacity-50 shadow-md transition"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              {busyId === req.id ? 'Procesando...' : `Aprobar +${req.coinsToCredit} 🪙`}
                            </button>
                          </div>
                        ) : (
                          req.rejectionReason && (
                            <p className="text-[11px] text-rose-300/90 bg-rose-500/10 border border-rose-400/20 rounded-xl px-3 py-2">
                              Motivo: {req.rejectionReason}
                            </p>
                          )
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* SUB-TAB 2: RETIROS USD A CREADORES */}
            {treasurySubTab === 'withdrawals' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredWithdrawals.length === 0 ? (
                  <div className="col-span-full rounded-3xl bg-[#12101D] border border-white/10 p-10 text-center space-y-2">
                    <Wallet className="w-8 h-8 text-zinc-600 mx-auto" />
                    <p className="text-sm font-bold text-zinc-300">
                      Sin solicitudes de retiro en este filtro
                    </p>
                    <p className="text-xs text-zinc-500">
                      Los retiros de Diamantes solicitados por creadores aparecerán aquí.
                    </p>
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

                    return (
                      <div
                        key={w.id}
                        className={`rounded-3xl p-4 sm:p-5 bg-[#12101D] border space-y-3.5 transition ${
                          isPending
                            ? 'border-sky-400/35 shadow-[0_10px_30px_-14px_rgba(56,189,248,0.3)]'
                            : 'border-white/10'
                        }`}
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
                                <p className="text-sm font-extrabold text-white truncate">
                                  {w.countryFlag} {w.userName}
                                </p>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase ${
                                    isPending
                                      ? 'bg-sky-500/20 border border-sky-400/40 text-sky-300'
                                      : isPaid
                                      ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300'
                                      : 'bg-rose-500/20 border border-rose-400/40 text-rose-300'
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

                        {/* Cuenta de cobro copiable en 1 toque */}
                        <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-400/25 flex items-center justify-between gap-2.5">
                          <div className="min-w-0">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-300 block">
                              {w.payoutMethodName}
                            </span>
                            <span className="text-xs font-mono font-bold text-white break-all">
                              {w.payoutDetails}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyTreasuryText(copyAcctKey, w.payoutDetails, 'Cuenta de cobro')
                            }
                            className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] font-bold text-white inline-flex items-center gap-1 shrink-0 transition"
                          >
                            {copiedTreasuryKey === copyAcctKey ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            {copiedTreasuryKey === copyAcctKey ? 'Copiado' : 'Copiar'}
                          </button>
                        </div>

                        {isPending ? (
                          <div className="space-y-2.5">
                            <input
                              type="text"
                              placeholder="Pega aquí el TxID / Hash de la transferencia enviada"
                              value={payoutRefs[w.id] || ''}
                              onChange={(e) =>
                                setPayoutRefs((prev) => ({ ...prev, [w.id]: e.target.value }))
                              }
                              className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-sky-400"
                            />
                            <div className="grid grid-cols-2 gap-2.5">
                              <button
                                type="button"
                                disabled={busyId === w.id}
                                onClick={() => handleRejectWithdrawal(w)}
                                className="py-2.5 rounded-xl bg-rose-500/15 border border-rose-400/30 text-rose-300 text-xs font-extrabold hover:bg-rose-500/25 disabled:opacity-50 transition"
                              >
                                Devolver 💎
                              </button>
                              <button
                                type="button"
                                disabled={busyId === w.id}
                                onClick={() => handlePayWithdrawal(w)}
                                className="py-2.5 rounded-xl bg-gradient-to-r from-sky-400 to-emerald-400 text-zinc-950 text-xs font-black hover:brightness-110 disabled:opacity-50 shadow-md transition"
                              >
                                {busyId === w.id ? 'Confirmando...' : `Confirmar ${formatUSD(w.netPayoutUSD)}`}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
                            <span className="text-zinc-400">
                              Bruto {formatUSD(w.grossUSD)} · Fee {formatUSD(w.platformFeeUSD)}
                            </span>
                            {w.payoutReference && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopyTreasuryText(copyRefKey, w.payoutReference, 'Referencia de pago')
                                }
                                className="font-mono text-emerald-300 hover:text-emerald-200 inline-flex items-center gap-1"
                              >
                                Ref: {w.payoutReference}
                                {copiedTreasuryKey === copyRefKey ? (
                                  <Check className="w-3 h-3" />
                                ) : (
                                  <Copy className="w-3 h-3 opacity-70" />
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* SUB-TAB 3: PAGOS AUTOMÁTICOS NOWPAYMENTS (IPN VERIFICADOS) */}
            {treasurySubTab === 'webhooks' && (
              <div className="rounded-3xl bg-[#12101D] border border-white/10 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-2 bg-white/[0.02]">
                  <p className="text-xs font-extrabold text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Historial de Acreditaciones Automáticas NowPayments (HMAC-SHA512)
                  </p>
                  <span className="text-[11px] font-bold text-emerald-300 tabular-nums">
                    Total API: {formatUSD(metrics.gatewayCompletedUSD)}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/5 text-zinc-400 uppercase text-[10px] font-extrabold tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Pasarela / ID</th>
                        <th className="px-4 py-3">Usuario</th>
                        <th className="px-4 py-3">Monto</th>
                        <th className="px-4 py-3">Acreditado</th>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Seguridad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredPaymentTxs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                            Aún no se han recibido pagos automáticos vía NowPayments IPN.
                          </td>
                        </tr>
                      ) : (
                        filteredPaymentTxs.map((tx) => {
                          const copyTxKey = `tx_${tx.id}`;
                          return (
                            <tr key={tx.id} className="hover:bg-white/[0.02] transition">
                              <td className="px-4 py-3.5">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/30 text-[10px] font-black uppercase text-sky-300">
                                  {tx.provider || 'nowpayments'}
                                </span>
                                {tx.externalPaymentId && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCopyTreasuryText(copyTxKey, tx.externalPaymentId, 'ID de pago')
                                    }
                                    className="block mt-1 font-mono text-[10px] text-zinc-400 hover:text-white inline-flex items-center gap-1"
                                  >
                                    #{tx.externalPaymentId}
                                    {copiedTreasuryKey === copyTxKey ? (
                                      <Check className="w-2.5 h-2.5 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-2.5 h-2.5" />
                                    )}
                                  </button>
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-white font-bold">
                                {tx.userName || tx.userId}
                              </td>
                              <td className="px-4 py-3.5">
                                <span className="text-emerald-400 font-black tabular-nums">
                                  {formatUSD(tx.amountUSD)}
                                </span>
                                {tx.currency && (
                                  <span className="ml-1 text-[10px] text-zinc-400 uppercase">
                                    {tx.currency}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3.5 font-extrabold text-amber-300 tabular-nums">
                                +{tx.coinsCredited || tx.diamondsCredited || 0}{' '}
                                {tx.creditField === 'diamonds' ? '💎' : '🪙'}
                              </td>
                              <td className="px-4 py-3.5 text-zinc-400">
                                {formatGiftDate(tx.createdAt)}
                              </td>
                              <td className="px-4 py-3.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/25 text-[10px] font-extrabold text-emerald-300">
                                  <ShieldCheck className="w-3 h-3" />
                                  {tx.verifiedSignature ? 'HMAC-SHA512 OK' : tx.source || 'admin'}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
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

            {/* Tarjeta de Integración de API Webhooks (NowPayments) */}
            <section className="rounded-3xl p-6 bg-[#12101D] border border-white/10 space-y-4">
              <div>
                <h2 className="font-display text-lg font-black text-white flex items-center gap-2">
                  <Webhook className="w-5 h-5 text-amber-400" />
                  API de Webhooks (NowPayments)
                </h2>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Configura esta URL como Callback / IPN en tu panel de <strong>NowPayments</strong>. El middleware valida la firma criptográfica (<code className="text-amber-300">HMAC-SHA512</code>) antes de acreditar saldo en Firestore.
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
                  <li><span className="text-amber-300">NOWPAYMENTS_API_KEY</span>=...</li>
                  <li><span className="text-amber-300">NOWPAYMENTS_IPN_SECRET</span>=...</li>
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
          className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewImg(null)}
        >
          <div
            className="relative max-w-3xl w-full flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-end gap-2">
              <a
                href={previewImg}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold inline-flex items-center gap-1.5 transition"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Abrir original
              </a>
              <button
                type="button"
                onClick={() => setPreviewImg(null)}
                className="p-2 rounded-full bg-white text-zinc-950 hover:bg-zinc-200 transition shadow-lg"
                aria-label="Cerrar imagen"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={previewImg}
              alt="Comprobante ampliado"
              className="max-w-full max-h-[82dvh] rounded-2xl shadow-2xl border border-white/15 object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
