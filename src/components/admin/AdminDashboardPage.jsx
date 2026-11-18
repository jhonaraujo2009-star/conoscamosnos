import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  BarChart3,
  Crown,
  DollarSign,
  ExternalLink,
  Flag,
  Flame,
  LogOut,
  Settings,
  X,
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
import { formatUSD, isProfileVerified, isUserActuallyOnline, toMillis } from '../../utils/formatters';
import AdminOverviewTab from './AdminOverviewTab';
import AdminReportsTab from './AdminReportsTab';
import AdminSettingsTab from './AdminSettingsTab';
import AdminTreasuryTab from './AdminTreasuryTab';
import AdminVerificationTab from './AdminVerificationTab';

const NAV_TABS = [
  { id: 'overview', label: 'Estadísticas', icon: BarChart3 },
  { id: 'reports', label: 'Seguridad', icon: Flag },
  { id: 'verification', label: 'Check Azul', icon: BadgeCheck },
  { id: 'treasury', label: 'Tesorería', icon: DollarSign },
  { id: 'settings', label: 'Economía', icon: Settings },
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

  const [copiedKey, setCopiedKey] = useState('');
  const [busyId, setBusyId] = useState('');
  const [payoutRefs, setPayoutRefs] = useState({});
  const [previewImg, setPreviewImg] = useState(null);

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

    const newUsersCount = users.filter((u) => {
      if (rangeStartMs === 0) return true;
      return toMillis(u.createdAt) >= rangeStartMs;
    }).length;

    const activeNowCount = users.filter((u) => isUserActuallyOnline(u, { bypassPrivacy: true })).length;
    const active24hCount = users.filter((u) => {
      const ms = toMillis(u.lastSeen);
      return ms > 0 && now - ms <= 24 * 60 * 60 * 1000;
    }).length;

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

    const adUserIds = new Set(adImpressions.map((a) => a.userId).filter(Boolean));
    const payingUserIds = new Set(
      [
        ...paymentRequests.filter((r) => r.status === 'approved').map((r) => r.userId),
        ...paymentTxs.filter((t) => t.status === 'completed').map((t) => t.userId),
      ].filter(Boolean)
    );

    const totalUsers = users.length;
    const adUsersCount = adUserIds.size;
    const payingUsersCount = payingUserIds.size;
    const adConversionPct = totalUsers > 0 ? Math.round((adUsersCount / totalUsers) * 100) : 0;
    const paidConversionPct = totalUsers > 0 ? Math.round((payingUsersCount / totalUsers) * 100) : 0;

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
      newUsersCount,
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
          ? `🚫 Usuario ${targetName || targetUid} suspendido del sistema.`
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

  const handleRejectRecharge = async (req, reason) => {
    setBusyId(req.id);
    try {
      await rejectPaymentRequest({
        requestId: req.id,
        adminId: userProfile.uid,
        reason: reason?.trim() || 'Comprobante inválido o no localizado',
      });
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

  const handleRejectWithdrawal = async (w, reason) => {
    setBusyId(w.id);
    try {
      await rejectWithdrawalRequest({
        withdrawalId: w.id,
        adminId: userProfile.uid,
        reason: reason?.trim() || 'Datos de cobro inválidos o inconsistentes',
      });
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
      onSuccess?.('💎 Configuración económica actualizada en tiempo real.');
    } catch (err) {
      onError?.(err.message || 'No se pudo guardar la configuración económica.');
    } finally {
      setSavingConfig(false);
    }
  };

  const webhookEndpointUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/webhooks/payments`
      : 'https://conoscamosnos.vercel.app/api/webhooks/payments';

  const handleCopyText = async (key, text, label = 'Dato') => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(String(text));
      setCopiedKey(key);
      onSuccess?.(`${label} copiado al portapapeles.`);
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? '' : prev));
      }, 1800);
    } catch {
      onError?.('No se pudo copiar automáticamente.');
    }
  };

  return (
    <div
      className="h-[100dvh] w-screen overflow-y-auto bg-[#08060C] text-zinc-100"
      style={{
        backgroundImage:
          'radial-gradient(at 15% 0%, rgba(255,46,84,0.12) 0px, transparent 50%), radial-gradient(at 88% 4%, rgba(251,191,36,0.09) 0px, transparent 45%)',
      }}
    >
      {/* Cabecera Ejecutiva Obsidian Velvet */}
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#0B0811]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-300 via-[#FF2E54] to-rose-600 flex items-center justify-center shadow-lg shadow-[#FF2E54]/25 shrink-0">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-base sm:text-lg font-black tracking-tight text-white truncate">
                  Conoscamosnos · Executive Suite
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-[10px] font-extrabold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  En vivo
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 truncate">
                {userProfile?.name} · Super Admin
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/app')}
              className="px-4 py-2.5 rounded-full bg-gradient-to-r from-[#FF2E54] via-rose-500 to-amber-500 text-white text-xs sm:text-sm font-black shadow-lg shadow-[#FF2E54]/25 hover:brightness-110 active:scale-[0.98] transition flex items-center gap-2"
            >
              <Flame className="w-4 h-4 fill-white" />
              <span>Entrar a la App</span>
            </button>

            <button
              type="button"
              onClick={() => logoutUser(userProfile?.uid)}
              className="p-2.5 rounded-full bg-white/[0.06] hover:bg-white/[0.14] border border-white/10 text-zinc-300 hover:text-white transition"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Carril de Módulos */}
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
                    ? 'bg-gradient-to-r from-white to-amber-50 text-zinc-950 border-white shadow-md'
                    : 'bg-white/[0.04] text-zinc-300 border-white/[0.08] hover:bg-white/[0.1] hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {badge > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-[#FF2E54] text-white tabular-nums">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-16">
        {activeTab === 'overview' && (
          <AdminOverviewTab
            metrics={metrics}
            dateFilter={dateFilter}
            onDateFilterChange={setDateFilter}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'reports' && (
          <AdminReportsTab
            reports={reports}
            userById={userById}
            currentAdminUid={userProfile?.uid}
            busyId={busyId}
            onToggleBan={handleToggleBan}
            onUpdateStatus={handleReportStatus}
          />
        )}

        {activeTab === 'verification' && (
          <AdminVerificationTab
            users={users}
            pendingVerificationsCount={metrics.pendingVerificationsCount}
            busyId={busyId}
            onToggleBlueCheck={handleToggleBlueCheck}
          />
        )}

        {activeTab === 'treasury' && (
          <AdminTreasuryTab
            metrics={metrics}
            paymentRequests={paymentRequests}
            paymentTxs={paymentTxs}
            withdrawals={withdrawals}
            userById={userById}
            copiedKey={copiedKey}
            busyId={busyId}
            payoutRefs={payoutRefs}
            onPayoutRefChange={(id, val) =>
              setPayoutRefs((prev) => ({ ...prev, [id]: val }))
            }
            onCopy={handleCopyText}
            onPreviewImg={setPreviewImg}
            onApproveRecharge={handleApproveRecharge}
            onRejectRecharge={handleRejectRecharge}
            onPayWithdrawal={handlePayWithdrawal}
            onRejectWithdrawal={handleRejectWithdrawal}
          />
        )}

        {activeTab === 'settings' && (
          <AdminSettingsTab
            baseDiamondPrice={baseDiamondPrice}
            onBaseDiamondPriceChange={setBaseDiamondPrice}
            creatorSharePct={creatorSharePct}
            onCreatorSharePctChange={setCreatorSharePct}
            minWithdrawDiamonds={minWithdrawDiamonds}
            onMinWithdrawDiamondsChange={setMinWithdrawDiamonds}
            packagesDraft={packagesDraft}
            onPackagesDraftChange={setPackagesDraft}
            savingConfig={savingConfig}
            onSaveEconomyConfig={handleSaveEconomyConfig}
            webhookEndpointUrl={webhookEndpointUrl}
            copiedKey={copiedKey}
            onCopyWebhook={() => handleCopyText('webhook_url', webhookEndpointUrl, 'Endpoint IPN')}
          />
        )}
      </main>

      {/* Lightbox de comprobantes */}
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
