import {
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  AD_REWARD_CONFIG,
  BOOST_PLANS,
  DIAMOND_PACKAGES,
  ECONOMY_CONFIG,
  PRO_PLANS,
  VIRTUAL_GIFTS,
  deriveUnlockMode,
  resolveAccessPolicy,
  resolveVirtualGifts,
} from '../config/constants';
import { toMillis } from '../utils/formatters';

export const DEFAULT_LIVE_ECONOMY = {
  ...ECONOMY_CONFIG,
  creatorSharePercent: Math.round(ECONOMY_CONFIG.creatorShareRatio * 100),
  diamondPackages: DIAMOND_PACKAGES,
  proPlans: PRO_PLANS,
  boostPlans: BOOST_PLANS,
  virtualGifts: VIRTUAL_GIFTS,
  ...resolveAccessPolicy(AD_REWARD_CONFIG),
  paymentChannels: {
    enableZinli: true,
    zinliEmail: import.meta.env.VITE_ZINLI_EMAIL || 'jhonaraujo2009@gmail.com',
    enablePagoMovil: true,
    pagoMovilInfo:
      import.meta.env.VITE_PAGO_MOVIL_INFO ||
      '0412-0496690 | V-23493744 | Banco de Venezuela (0102)',
    enableBinancePay: Boolean(import.meta.env.VITE_BINANCE_PAY_ID),
    binancePayId: import.meta.env.VITE_BINANCE_PAY_ID || '',
  },
};

/**
 * Escucha la configuración económica y política de acceso global en vivo (appConfig/economy).
 * Permite al Super Admin habilitar/inhabilitar cobros, anuncios, duración y precios en tiempo real.
 */
export function subscribeEconomyConfig(callback) {
  if (!db) {
    callback(DEFAULT_LIVE_ECONOMY);
    return () => {};
  }

  return onSnapshot(
    doc(db, 'appConfig', 'economy'),
    (snap) => {
      if (!snap.exists()) {
        callback(DEFAULT_LIVE_ECONOMY);
        return;
      }
      const data = snap.data() || {};
      const baseDiamondValueUSD = Number(
        data.baseDiamondValueUSD ?? ECONOMY_CONFIG.baseDiamondValueUSD
      );
      const creatorShareRatio = Number(
        data.creatorShareRatio ?? ECONOMY_CONFIG.creatorShareRatio
      );
      const creatorSharePercent = Math.round(creatorShareRatio * 100);
      const platformFeeRatio = Number((1 - creatorShareRatio).toFixed(4));
      const diamondToNetUSDRate = Number(
        (baseDiamondValueUSD * creatorShareRatio).toFixed(4)
      );
      const minWithdrawalDiamonds = Math.max(
        100,
        Math.floor(Number(data.minWithdrawalDiamonds ?? ECONOMY_CONFIG.minWithdrawalDiamonds))
      );
      const diamondPackages =
        Array.isArray(data.diamondPackages) && data.diamondPackages.length > 0
          ? data.diamondPackages
          : Array.isArray(data.coinPackages) && data.coinPackages.length > 0
          ? data.coinPackages
          : DIAMOND_PACKAGES;
      const proPlans =
        Array.isArray(data.proPlans) && data.proPlans.length > 0
          ? data.proPlans
          : PRO_PLANS;
      const boostPlans =
        Array.isArray(data.boostPlans) && data.boostPlans.length > 0
          ? data.boostPlans
          : BOOST_PLANS;
      const virtualGifts = resolveVirtualGifts(data);
      const accessPolicy = resolveAccessPolicy(data);
      const paymentChannels = {
        ...DEFAULT_LIVE_ECONOMY.paymentChannels,
        ...(data.paymentChannels || {}),
      };

      callback({
        ...ECONOMY_CONFIG,
        ...data,
        ...accessPolicy,
        paymentChannels,
        baseDiamondValueUSD,
        creatorShareRatio,
        creatorSharePercent,
        platformFeeRatio,
        diamondToNetUSDRate,
        minWithdrawalDiamonds,
        diamondPackages,
        proPlans,
        boostPlans,
        virtualGifts,
      });
    },
    () => callback(DEFAULT_LIVE_ECONOMY)
  );
}

/**
 * Super Admin: actualiza el modo global de monetización (Libre / Solo Ads / Solo Diamantes / Híbrido),
 * duración de anuncios, enlace Direct Link de Monetag, tarifas de desbloqueo y canales de pago directo.
 */
export async function updatePlatformAccessConfig({
  adminId,
  unlockMode,
  enableDiamondCharges,
  enableRewardedAds,
  adDurationSeconds = 12,
  monetagDirectLink = AD_REWARD_CONFIG.monetagDirectLink,
  unlockLikeDiamonds = 2,
  unlockAllLikesDiamonds = 10,
  unlockChatDiamonds = 2,
  unlockExclusivePhotoDiamonds = 15,
  estimatedAdCpmUSD = 5,
  paymentChannels = null,
}) {
  if (!adminId) throw new Error('Sesión de Super Admin inválida.');

  const normalizedInputMode = unlockMode === 'coins_only' ? 'diamonds_only' : unlockMode;
  const resolvedMode = ['free', 'ads_only', 'diamonds_only', 'hybrid'].includes(normalizedInputMode)
    ? normalizedInputMode
    : deriveUnlockMode(Boolean(enableDiamondCharges), Boolean(enableRewardedAds));

  const diamondsActive = resolvedMode === 'diamonds_only' || resolvedMode === 'hybrid';
  const adsActive = resolvedMode === 'ads_only' || resolvedMode === 'hybrid';

  const cleanDuration = Math.floor(Number(adDurationSeconds));
  if (!Number.isFinite(cleanDuration) || cleanDuration < 5 || cleanDuration > 60) {
    throw new Error('La duración del anuncio debe estar entre 5 y 60 segundos.');
  }

  const cleanDirectLink = String(monetagDirectLink || '').trim();
  if (cleanDirectLink && !/^https?:\/\//i.test(cleanDirectLink)) {
    throw new Error('El Direct Link de Monetag debe comenzar con https:// o http://');
  }

  const cleanLikeDiamonds = Math.max(1, Math.floor(Number(unlockLikeDiamonds || 2)));
  const cleanAllLikesDiamonds = Math.max(1, Math.floor(Number(unlockAllLikesDiamonds || 10)));
  const cleanChatDiamonds = Math.max(1, Math.floor(Number(unlockChatDiamonds || 2)));
  const cleanExclusivePhotoDiamonds = Math.max(
    1,
    Math.floor(Number(unlockExclusivePhotoDiamonds || 15))
  );
  const cleanCpm = Math.max(0.1, Number(Number(estimatedAdCpmUSD || 5).toFixed(2)));

  const payload = {
    unlockMode: resolvedMode,
    enableDiamondCharges: diamondsActive,
    enableRewardedAds: adsActive,
    adDurationSeconds: cleanDuration,
    monetagDirectLink: cleanDirectLink,
    unlockLikeDiamonds: cleanLikeDiamonds,
    unlockAllLikesDiamonds: cleanAllLikesDiamonds,
    unlockChatDiamonds: cleanChatDiamonds,
    unlockExclusivePhotoDiamonds: cleanExclusivePhotoDiamonds,
    estimatedAdCpmUSD: cleanCpm,
    updatedBy: adminId,
    updatedAt: serverTimestamp(),
  };

  if (paymentChannels && typeof paymentChannels === 'object') {
    payload.paymentChannels = {
      enableZinli: Boolean(paymentChannels.enableZinli),
      zinliEmail: String(paymentChannels.zinliEmail || '').trim(),
      enablePagoMovil: Boolean(paymentChannels.enablePagoMovil),
      pagoMovilInfo: String(paymentChannels.pagoMovilInfo || '').trim(),
      enableBinancePay: Boolean(paymentChannels.enableBinancePay),
      binancePayId: String(paymentChannels.binancePayId || '').trim(),
    };
  }

  await setDoc(doc(db, 'appConfig', 'economy'), payload, { merge: true });
}

/**
 * Super Admin: actualiza el precio base, % de retiro de creadores y paquetes de Diamantes en appConfig/economy.
 */
export async function updateEconomyConfig({
  adminId,
  baseDiamondValueUSD,
  creatorShareRatio = 0.6,
  minWithdrawalDiamonds = 500,
  diamondPackages = DIAMOND_PACKAGES,
}) {
  const cleanBase = Number(baseDiamondValueUSD);
  const cleanShare = Number(creatorShareRatio);
  const cleanMin = Math.floor(Number(minWithdrawalDiamonds));

  if (!Number.isFinite(cleanBase) || cleanBase <= 0 || cleanBase > 5) {
    throw new Error('El precio base por diamante debe ser mayor a $0 y menor o igual a $5.00 USD.');
  }
  if (!Number.isFinite(cleanShare) || cleanShare < 0.05 || cleanShare > 0.95) {
    throw new Error('El porcentaje de retiro para el usuario debe estar entre 5% y 95%.');
  }
  if (!Number.isFinite(cleanMin) || cleanMin < 100) {
    throw new Error('El retiro mínimo debe ser al menos 100 diamantes.');
  }

  const sanitizedPackages = (
    Array.isArray(diamondPackages) ? diamondPackages : DIAMOND_PACKAGES
  ).map((pkg) => {
    const units = Math.max(10, Math.floor(Number(pkg.diamonds ?? pkg.coins ?? 0)));
    const { coins: _omitLegacyCoins, ...rest } = pkg;
    return {
      ...rest,
      diamonds: units,
      priceUSD: Number(Math.max(0.5, Number(pkg.priceUSD || 0)).toFixed(2)),
    };
  });

  await setDoc(
    doc(db, 'appConfig', 'economy'),
    {
      baseDiamondValueUSD: Number(cleanBase.toFixed(4)),
      creatorShareRatio: Number(cleanShare.toFixed(4)),
      creatorSharePercent: Math.round(cleanShare * 100),
      platformFeeRatio: Number((1 - cleanShare).toFixed(4)),
      diamondToNetUSDRate: Number((cleanBase * cleanShare).toFixed(4)),
      minWithdrawalDiamonds: cleanMin,
      diamondPackages: sanitizedPackages,
      updatedBy: adminId,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Super Admin: actualiza planes de Conoscamosnos PRO y Boost VIP en tiempo real.
 */
export async function updateProPlansConfig({
  adminId,
  proPlans = PRO_PLANS,
  boostPlans = null,
  virtualGifts = null,
}) {
  if (!adminId) throw new Error('Sesión de Super Admin inválida.');
  const sanitizedProPlans = (Array.isArray(proPlans) ? proPlans : PRO_PLANS).map((plan) => {
    const durationDays = Math.max(1, Math.min(365, Math.floor(Number(plan.durationDays || 7))));
    const priceUSD = Number(Math.max(0.99, Number(plan.priceUSD || 4.99)).toFixed(2));
    const priceDiamonds = Math.max(10, Math.floor(Number(plan.priceDiamonds || 250)));
    return {
      ...plan,
      durationDays,
      priceUSD,
      priceDiamonds,
    };
  });

  const payload = {
    proPlans: sanitizedProPlans,
    updatedBy: adminId,
    updatedAt: serverTimestamp(),
  };

  if (Array.isArray(boostPlans) && boostPlans.length > 0) {
    payload.boostPlans = boostPlans.map((plan) => {
      const { costCoins: _omitLegacyCostCoins, ...rest } = plan;
      return {
        ...rest,
        durationHours: Math.max(1, Math.min(24 * 30, Math.floor(Number(plan.durationHours || 24)))),
        costDiamonds: Math.max(10, Math.floor(Number(plan.costDiamonds ?? plan.costCoins ?? 50))),
      };
    });
  }

  if (Array.isArray(virtualGifts) && virtualGifts.length > 0) {
    const sanitizedGifts = resolveVirtualGifts({ virtualGifts }).map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
      price: Math.max(1, Math.min(50000, Math.floor(Number(g.price || 10)))),
      accent: g.accent,
      tagline: g.tagline,
    }));
    payload.virtualGifts = sanitizedGifts;
  }

  await setDoc(doc(db, 'appConfig', 'economy'), payload, { merge: true });
}

/**
 * Super Admin: escucha en tiempo real la colección de usuarios para analítica, demografía y verificación.
 */
export function subscribeAllUsersForAdmin(callback, onError) {
  if (!db) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, 'users'), limit(500));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ uid: d.id, id: d.id, ...d.data() }))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      callback(list);
    },
    (err) => {
      console.error('Error escuchando usuarios para Super Admin:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Super Admin: suspende/banea (o reactiva) a un usuario denunciado y resuelve el reporte vinculado.
 */
export async function setUserSuspensionStatus({
  targetUid,
  adminId,
  suspended = true,
  reason = 'Incumplimiento de las normas comunitarias',
  reportId = null,
}) {
  if (!targetUid || !adminId) {
    throw new Error('Faltan datos para aplicar la moderación.');
  }
  if (targetUid === adminId) {
    throw new Error('No puedes suspender tu propia cuenta de Super Admin.');
  }

  const batch = writeBatch(db);
  const userRef = doc(db, 'users', targetUid);

  batch.update(userRef, {
    isBanned: Boolean(suspended),
    accountStatus: suspended ? 'banned' : 'active',
    banReason: suspended ? String(reason || '').trim() : '',
    bannedBy: suspended ? adminId : null,
    bannedAt: suspended ? serverTimestamp() : null,
    discoverable: !suspended,
    updatedAt: serverTimestamp(),
  });

  if (reportId) {
    const reportRef = doc(db, 'reports', reportId);
    batch.update(reportRef, {
      status: suspended ? 'resolved' : 'dismissed',
      actionTaken: suspended ? 'user_banned' : 'reactivated',
      reviewedBy: adminId,
      reviewedAt: serverTimestamp(),
    });
  }

  await batch.commit();
}

/**
 * Super Admin: aprueba o revoca el sello oficial de verificación ("Check Azul").
 */
export async function setUserVerificationBadge({ targetUid, adminId, approved = true }) {
  if (!targetUid || !adminId) {
    throw new Error('Faltan datos para actualizar la verificación.');
  }

  await updateDoc(doc(db, 'users', targetUid), {
    verifiedBadge: Boolean(approved),
    verificationStatus: approved ? 'approved' : 'rejected',
    verifiedBy: approved ? adminId : null,
    verifiedAt: approved ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  });
}
