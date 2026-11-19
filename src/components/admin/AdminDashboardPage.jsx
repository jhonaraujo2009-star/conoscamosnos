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
import {
  BOOST_PLANS,
  DIAMOND_PACKAGES,
  PRO_PLANS,
  VIRTUAL_GIFTS,
  resolveAccessPolicy,
} from '../../config/constants';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeAllAdImpressions } from '../../services/adRewardService';
import {
  DEFAULT_LIVE_ECONOMY,
  purgeAdminRevenueRecords,
  setUserSuspensionStatus,
  setUserVerificationBadge,
  subscribeAllUsersForAdmin,
  updateEconomyConfig,
  updatePlatformAccessConfig,
  updateProPlansConfig,
} from '../../services/adminService';
import { logoutUser } from '../../services/authService';
import { subscribeAllGiftTransactions } from '../../services/chatService';
import {
  approvePaymentRequest,
  deleteManualPaymentRequest,
  rejectPaymentRequest,
  subscribeAllPaymentRequests,
  subscribeAllPaymentTransactions,
  subscribeAllStoreActivations,
  togglePaymentRequestReviewed,
} from '../../services/monetizationService';
import { subscribeAllReports, updateReportStatus } from '../../services/userService';
import {
  markWithdrawalPaid,
  rejectWithdrawalRequest,
  subscribeAllWithdrawals,
} from '../../services/withdrawalService';
import {
  formatUSD,
  isBoostActive,
  isProActive,
  isProfileVerified,
  isUserActuallyOnline,
  toMillis,
} from '../../utils/formatters';
import AdminOverviewTab from './AdminOverviewTab';
import AdminReportsTab from './AdminReportsTab';
import AdminRevenueCleanupModal from './AdminRevenueCleanupModal';
import AdminSettingsTab from './AdminSettingsTab';
import AdminTreasuryTab from './AdminTreasuryTab';
import AdminVerificationTab from './AdminVerificationTab';

const NAV_TABS = [
  { id: 'overview', label: 'Estadísticas', icon: BarChart3 },
  { id: 'reports', label: 'Seguridad', icon: Flag },
  { id: 'verification', label: 'Check Azul', icon: BadgeCheck },
  { id: 'treasury', label: 'Tesorería', icon: DollarSign },
  { id: 'settings', label: 'Economía y Acceso', icon: Settings },
];

export default function AdminDashboardPage({ onSuccess, onError }) {
  const navigate = useNavigate();
  const { userProfile, economyConfig } = useAuth();
  const livePolicy = useMemo(() => resolveAccessPolicy(economyConfig), [economyConfig]);

  const [activeTab, setActiveTab] = useState('overview');
  const [dateFilter, setDateFilter] = useState('month'); // 'day' | 'week' | 'month' | 'all'
  const [users, setUsers] = useState([]);
  const [paymentRequests, setPaymentRequests] = useState([]);
  const [paymentTxs, setPaymentTxs] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [reports, setReports] = useState([]);
  const [adImpressions, setAdImpressions] = useState([]);
  const [giftTxs, setGiftTxs] = useState([]);
  const [storeActivations, setStoreActivations] = useState([]);

  const [copiedKey, setCopiedKey] = useState('');
  const [busyId, setBusyId] = useState('');
  const [payoutRefs, setPayoutRefs] = useState({});
  const [previewImg, setPreviewImg] = useState(null);
  const [cleanupModalOpen, setCleanupModalOpen] = useState(false);
  const [cleaningRevenue, setCleaningRevenue] = useState(false);

  const [baseDiamondPrice, setBaseDiamondPrice] = useState(
    String(economyConfig?.baseDiamondValueUSD ?? 0.01)
  );
  const [creatorSharePct, setCreatorSharePct] = useState(
    String(Math.round((economyConfig?.creatorShareRatio ?? 0.6) * 100))
  );
  const [minWithdrawDiamonds, setMinWithdrawDiamonds] = useState(
    String(economyConfig?.minWithdrawalDiamonds ?? 500)
  );
  const [proPlansDraft, setProPlansDraft] = useState(
    economyConfig?.proPlans || PRO_PLANS
  );
  const [boostPlansDraft, setBoostPlansDraft] = useState(
    economyConfig?.boostPlans || BOOST_PLANS
  );
  const [giftsDraft, setGiftsDraft] = useState(
    economyConfig?.virtualGifts || VIRTUAL_GIFTS
  );
  const [packagesDraft, setPackagesDraft] = useState(
    economyConfig?.diamondPackages || economyConfig?.coinPackages || DIAMOND_PACKAGES
  );
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingProPlans, setSavingProPlans] = useState(false);

  const [accessDraft, setAccessDraft] = useState(() => resolveAccessPolicy(economyConfig));
  const [savingAccess, setSavingAccess] = useState(false);

  const [channelsDraft, setChannelsDraft] = useState(
    () => economyConfig?.paymentChannels || DEFAULT_LIVE_ECONOMY.paymentChannels
  );
  const [savingChannels, setSavingChannels] = useState(false);

  useEffect(() => {
    setBaseDiamondPrice(String(economyConfig?.baseDiamondValueUSD ?? 0.01));
    setCreatorSharePct(String(Math.round((economyConfig?.creatorShareRatio ?? 0.6) * 100)));
    setMinWithdrawDiamonds(String(economyConfig?.minWithdrawalDiamonds ?? 500));
    setProPlansDraft(economyConfig?.proPlans || PRO_PLANS);
    setBoostPlansDraft(economyConfig?.boostPlans || BOOST_PLANS);
    setGiftsDraft(economyConfig?.virtualGifts || VIRTUAL_GIFTS);
    setPackagesDraft(
      economyConfig?.diamondPackages || economyConfig?.coinPackages || DIAMOND_PACKAGES
    );
    setAccessDraft(resolveAccessPolicy(economyConfig));
    setChannelsDraft({
      ...DEFAULT_LIVE_ECONOMY.paymentChannels,
      ...(economyConfig?.paymentChannels || {}),
    });
  }, [economyConfig]);

  useEffect(() => {
    const unsubUsers = subscribeAllUsersForAdmin(setUsers);
    const unsubReqs = subscribeAllPaymentRequests(setPaymentRequests);
    const unsubTxs = subscribeAllPaymentTransactions(setPaymentTxs);
    const unsubW = subscribeAllWithdrawals(setWithdrawals);
    const unsubReports = subscribeAllReports(setReports);
    const unsubAds = subscribeAllAdImpressions(setAdImpressions);
    const unsubGifts = subscribeAllGiftTransactions(setGiftTxs);
    const unsubActs = subscribeAllStoreActivations(setStoreActivations);

    return () => {
      unsubUsers();
      unsubReqs();
      unsubTxs();
      unsubW();
      unsubReports();
      unsubAds();
      unsubGifts();
      unsubActs();
    };
  }, []);

  useEffect(() => {
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) return undefined;
    metaTheme.setAttribute('content', '#FAF4E8');
    return () => {
      metaTheme.setAttribute('content', '#FAF7F9');
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

    const inRange = (item, ...tsFields) => {
      if (rangeStartMs === 0) return true;
      for (const field of tsFields) {
        const ms = toMillis(item?.[field]);
        if (ms > 0) return ms >= rangeStartMs;
      }
      return false;
    };

    const newUsersCount = users.filter((u) => inRange(u, 'createdAt')).length;

    const activeNowCount = users.filter((u) => isUserActuallyOnline(u, { bypassPrivacy: true })).length;
    const active24hCount = users.filter((u) => {
      const ms = toMillis(u.lastSeen);
      return ms > 0 && now - ms <= 24 * 60 * 60 * 1000;
    }).length;

    const approvedReqsInRange = paymentRequests.filter(
      (r) => r.status === 'approved' && inRange(r, 'reviewedAt', 'createdAt')
    );
    const completedTxsInRange = paymentTxs.filter(
      (t) => t.status === 'completed' && inRange(t, 'createdAt')
    );
    const adsInRange = adImpressions.filter((imp) => inRange(imp, 'createdAt'));
    const paidWithdrawalsInRange = withdrawals.filter(
      (w) => w.status === 'paid' && inRange(w, 'paidAt', 'createdAt')
    );

    const manualApprovedUSD = approvedReqsInRange.reduce(
      (acc, r) => acc + Number(r.amountUSD || 0),
      0
    );
    const gatewayCompletedUSD = completedTxsInRange.reduce(
      (acc, t) => acc + Number(t.amountUSD || 0),
      0
    );
    const adEstRevenueUSD = adsInRange.reduce(
      (acc, imp) => acc + Number(imp.estimatedRevenueUSD || 0),
      0
    );
    const totalRevenueUSD = manualApprovedUSD + gatewayCompletedUSD + adEstRevenueUSD;
    const totalPaidOutUSD = paidWithdrawalsInRange.reduce(
      (acc, w) => acc + Number(w.netPayoutUSD || 0),
      0
    );
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

    const adUserIds = new Set(adsInRange.map((a) => a.userId).filter(Boolean));
    const payingUserIds = new Set(
      [
        ...approvedReqsInRange.map((r) => r.userId),
        ...completedTxsInRange.map((t) => t.userId),
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
    const paidWithdrawalsCount = paidWithdrawalsInRange.length;

    const activeProCount = users.filter(isProActive).length;
    const activeBoostCount = users.filter(isBoostActive).length;

    const giftsInRange = giftTxs.filter((g) => inRange(g, 'createdAt'));
    const exclusivePhotosInRange = giftsInRange.filter((g) => g.giftId === 'exclusive_photo');
    const virtualGiftsInRange = giftsInRange.filter((g) => g.giftId !== 'exclusive_photo');

    const exclusivePhotosCount = exclusivePhotosInRange.length;
    const exclusivePhotosDiamonds = exclusivePhotosInRange.reduce(
      (acc, g) => acc + Number(g.diamondsCost ?? g.coinsCost ?? g.diamondsCredited ?? 0),
      0
    );
    const giftsSentCount = virtualGiftsInRange.length;
    const giftsSentDiamonds = virtualGiftsInRange.reduce(
      (acc, g) => acc + Number(g.diamondsCost ?? g.coinsCost ?? g.diamondsCredited ?? 0),
      0
    );

    const actsInRange = storeActivations.filter((a) => inRange(a, 'createdAt'));
    const proActivationsCount =
      actsInRange.filter((a) => a.kind === 'pro').length +
      approvedReqsInRange.filter((r) => r.creditTarget === 'pro').length +
      completedTxsInRange.filter((t) => t.creditField === 'pro').length;
    const totalDiamondsSpentInRange =
      exclusivePhotosDiamonds +
      giftsSentDiamonds +
      actsInRange.reduce((acc, a) => acc + Number(a.diamondsSpent || 0), 0);

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
      adImpressionsTotal: adsInRange.length,
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
      activeProCount,
      activeBoostCount,
      proActivationsCount,
      exclusivePhotosCount,
      exclusivePhotosDiamonds,
      giftsSentCount,
      giftsSentDiamonds,
      totalDiamondsSpentInRange,
    };
  }, [
    users,
    dateFilter,
    paymentRequests,
    paymentTxs,
    adImpressions,
    withdrawals,
    reports,
    giftTxs,
    storeActivations,
  ]);

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
      const approval = await approvePaymentRequest({ requestId: req.id, adminId: userProfile.uid });
      if (req.creditTarget === 'pro') {
        onSuccess?.(
          `👑 Aprobado: Membresía Conoscamosnos PRO (${approval?.durationDays || req.proDurationDays || 7} días) activada para ${req.userName}.`
        );
      } else {
        const units = approval?.unitsCredited || req.diamondsToCredit || req.coinsToCredit || 0;
        const balanceSuffix = Number.isFinite(approval?.newDiamondsBalance)
          ? ` (saldo: ${approval.newDiamondsBalance} 💎)`
          : '';
        onSuccess?.(`✅ Aprobado: +${units} 💎 acreditados a ${req.userName}${balanceSuffix}.`);
      }
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

  const handleToggleRechargeReviewed = async (req) => {
    const nextReviewed = !req.adminChecked;
    setBusyId(req.id);
    try {
      await togglePaymentRequestReviewed({
        requestId: req.id,
        adminId: userProfile.uid,
        reviewed: nextReviewed,
      });
      onSuccess?.(
        nextReviewed
          ? '✓ Recarga marcada como revisada.'
          : 'Marca de revisado retirada.'
      );
    } catch (err) {
      onError?.(err.message || 'No se pudo actualizar el estado de revisión.');
    } finally {
      setBusyId('');
    }
  };

  const handleDeleteRecharge = async (req) => {
    setBusyId(req.id);
    try {
      await deleteManualPaymentRequest({ requestId: req.id });
      onSuccess?.(`🗑️ Recarga de ${req.userName || 'usuario'} eliminada del reporte.`);
    } catch (err) {
      onError?.(err.message || 'No se pudo eliminar el registro de recarga.');
    } finally {
      setBusyId('');
    }
  };

  const handlePurgeRevenue = async ({ mode, ranges, collections }) => {
    if (cleaningRevenue) return;
    setCleaningRevenue(true);
    try {
      const res = await purgeAdminRevenueRecords({ mode, ranges, collections });
      setCleanupModalOpen(false);
      onSuccess?.(
        `🧹 Limpieza completada: ${res.totalDeleted || 0} registro(s) eliminado(s).`
      );
    } catch (err) {
      onError?.(err.message || 'No se pudo completar la limpieza de ingresos.');
    } finally {
      setCleaningRevenue(false);
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
        diamondPackages: packagesDraft,
      });
      onSuccess?.('💎 Configuración económica y % de retiro actualizados en tiempo real.');
    } catch (err) {
      onError?.(err.message || 'No se pudo guardar la configuración económica.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSaveProPlansConfig = async (e) => {
    e.preventDefault();
    if (savingProPlans) return;
    setSavingProPlans(true);
    try {
      await updateProPlansConfig({
        adminId: userProfile.uid,
        proPlans: proPlansDraft,
        boostPlans: boostPlansDraft,
        virtualGifts: giftsDraft,
      });
      onSuccess?.('👑 Planes Conoscamosnos PRO, Boost VIP y Regalos actualizados en tiempo real.');
    } catch (err) {
      onError?.(err.message || 'No se pudieron guardar los planes PRO y Boost.');
    } finally {
      setSavingProPlans(false);
    }
  };

  const persistPlatformPolicy = async (channels = null) => {
    await updatePlatformAccessConfig({
      adminId: userProfile.uid,
      unlockMode: accessDraft.unlockMode,
      enableDiamondCharges: accessDraft.enableDiamondCharges,
      enableRewardedAds: accessDraft.enableRewardedAds,
      adDurationSeconds: Number(accessDraft.adDurationSeconds),
      monetagDirectLink: accessDraft.monetagDirectLink,
      unlockLikeDiamonds: Number(accessDraft.unlockLikeDiamonds),
      unlockAllLikesDiamonds: Number(accessDraft.unlockAllLikesDiamonds),
      unlockChatDiamonds: Number(accessDraft.unlockChatDiamonds),
      unlockExclusivePhotoDiamonds: Number(accessDraft.unlockExclusivePhotoDiamonds),
      estimatedAdCpmUSD: Number(accessDraft.estimatedAdCpmUSD),
      paymentChannels: channels,
    });
  };

  const handleSaveAccessConfig = async (e) => {
    e.preventDefault();
    if (savingAccess) return;
    setSavingAccess(true);
    try {
      await persistPlatformPolicy();
      onSuccess?.('✅ Política global de cobros y anuncios aplicada en tiempo real.');
    } catch (err) {
      onError?.(err.message || 'No se pudo guardar la política global.');
    } finally {
      setSavingAccess(false);
    }
  };

  const handleSaveChannelsConfig = async (e) => {
    e.preventDefault();
    if (savingChannels) return;
    setSavingChannels(true);
    try {
      await persistPlatformPolicy(channelsDraft);
      onSuccess?.('💳 Canales de cobro directo actualizados en tiempo real.');
    } catch (err) {
      onError?.(err.message || 'No se pudieron guardar los canales de cobro.');
    } finally {
      setSavingChannels(false);
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
      className="h-[100dvh] w-screen overflow-y-auto bg-[#FAF4E8] text-[#2C241E]"
      style={{
        backgroundImage:
          'radial-gradient(at 10% 0%, rgba(245,213,174,0.34) 0px, transparent 52%), radial-gradient(at 90% 6%, rgba(254,232,205,0.45) 0px, transparent 50%), radial-gradient(at 50% 96%, rgba(253,226,214,0.28) 0px, transparent 52%)',
      }}
    >
      {/* Cabecera Crema Luminosa */}
      <header className="sticky top-0 z-30 border-b border-[#E9DFCD] bg-[#FFFBF2]/95 backdrop-blur-xl shadow-[0_8px_24px_-16px_rgba(120,88,48,0.12)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-400 via-[#FF2E54] to-amber-400 flex items-center justify-center shadow-md shadow-rose-200/70 shrink-0">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-base sm:text-lg font-black tracking-tight text-[#2C241E] truncate">
                  Conoscamosnos · Executive Suite
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-extrabold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  En vivo
                </span>
              </div>
              <p className="text-[11px] text-[#857566] truncate">
                {userProfile?.name} · Super Admin
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/app')}
              className="px-4 py-2.5 rounded-full bg-gradient-to-r from-[#FF2E54] via-rose-500 to-amber-500 text-white text-xs sm:text-sm font-black shadow-md shadow-rose-200 hover:brightness-105 active:scale-[0.98] transition flex items-center gap-2"
            >
              <Flame className="w-4 h-4 fill-white" />
              <span>Entrar a la App</span>
            </button>

            <button
              type="button"
              onClick={() => logoutUser(userProfile?.uid)}
              className="p-2.5 rounded-full bg-[#F4ECDD] hover:bg-[#EAE0CE] border border-[#E2D5BE] text-[#5C4E41] hover:text-[#2C241E] transition"
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
                    ? 'bg-gradient-to-r from-[#FF2E54] to-rose-500 text-white border-rose-500 shadow-sm'
                    : 'bg-[#FFFDF8] text-[#5C4E41] border-[#E8DEC9] hover:bg-[#F5EDE0] hover:text-[#2C241E]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {badge > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-black tabular-nums ${
                      active ? 'bg-white text-[#FF2E54]' : 'bg-[#FF2E54] text-white'
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

      {/* Contenido Principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-16">
        {activeTab === 'overview' && (
          <AdminOverviewTab
            metrics={metrics}
            accessPolicy={livePolicy}
            dateFilter={dateFilter}
            onDateFilterChange={setDateFilter}
            onNavigateTab={setActiveTab}
            onOpenRevenueCleanup={() => setCleanupModalOpen(true)}
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
            onToggleRechargeReviewed={handleToggleRechargeReviewed}
            onDeleteRecharge={handleDeleteRecharge}
            onOpenRevenueCleanup={() => setCleanupModalOpen(true)}
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
            proPlansDraft={proPlansDraft}
            onProPlansDraftChange={setProPlansDraft}
            boostPlansDraft={boostPlansDraft}
            onBoostPlansDraftChange={setBoostPlansDraft}
            giftsDraft={giftsDraft}
            onGiftsDraftChange={setGiftsDraft}
            savingProPlans={savingProPlans}
            onSaveProPlansConfig={handleSaveProPlansConfig}
            packagesDraft={packagesDraft}
            onPackagesDraftChange={setPackagesDraft}
            savingConfig={savingConfig}
            onSaveEconomyConfig={handleSaveEconomyConfig}
            accessDraft={accessDraft}
            onAccessDraftChange={setAccessDraft}
            savingAccess={savingAccess}
            onSaveAccessConfig={handleSaveAccessConfig}
            channelsDraft={channelsDraft}
            onChannelsDraftChange={setChannelsDraft}
            savingChannels={savingChannels}
            onSaveChannelsConfig={handleSaveChannelsConfig}
            webhookEndpointUrl={webhookEndpointUrl}
            copiedKey={copiedKey}
            onCopyWebhook={() => handleCopyText('webhook_url', webhookEndpointUrl, 'Endpoint IPN')}
          />
        )}
      </main>

      {/* Modal de limpieza de ingresos / días de prueba */}
      <AdminRevenueCleanupModal
        open={cleanupModalOpen}
        onClose={() => !cleaningRevenue && setCleanupModalOpen(false)}
        paymentRequests={paymentRequests}
        paymentTxs={paymentTxs}
        adImpressions={adImpressions}
        withdrawals={withdrawals}
        giftTxs={giftTxs}
        storeActivations={storeActivations}
        onConfirmPurge={handlePurgeRevenue}
        busy={cleaningRevenue}
      />

      {/* Lightbox claro crema de comprobantes */}
      {previewImg && (
        <div
          className="fixed inset-0 z-[80] bg-[#2B221B]/55 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setPreviewImg(null)}
        >
          <div
            className="relative max-w-3xl w-full bg-[#FFFDF8] border border-[#E8DEC9] rounded-[28px] p-3.5 sm:p-4 shadow-2xl flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between gap-2 px-1">
              <span className="text-xs font-black text-[#2C241E]">
                Comprobante adjunto
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={previewImg}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 rounded-full bg-[#F4ECDD] hover:bg-[#EAE0CE] border border-[#E2D5BE] text-[#4B3E33] text-xs font-bold inline-flex items-center gap-1.5 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Abrir original
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewImg(null)}
                  className="p-2 rounded-full bg-[#F4ECDD] hover:bg-[#EAE0CE] border border-[#E2D5BE] text-[#2C241E] transition"
                  aria-label="Cerrar imagen"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <img
              src={previewImg}
              alt="Comprobante ampliado"
              className="max-w-full max-h-[78dvh] rounded-2xl border border-[#E8DEC9] bg-[#FAF4E8] object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
