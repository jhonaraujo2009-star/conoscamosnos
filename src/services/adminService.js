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
  COIN_PACKAGES,
  ECONOMY_CONFIG,
  deriveUnlockMode,
  resolveAccessPolicy,
} from '../config/constants';
import { toMillis } from '../utils/formatters';

export const DEFAULT_LIVE_ECONOMY = {
  ...ECONOMY_CONFIG,
  coinPackages: COIN_PACKAGES,
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
      const platformFeeRatio = Number((1 - creatorShareRatio).toFixed(4));
      const diamondToNetUSDRate = Number(
        (baseDiamondValueUSD * creatorShareRatio).toFixed(4)
      );
      const minWithdrawalDiamonds = Math.max(
        100,
        Math.floor(Number(data.minWithdrawalDiamonds ?? ECONOMY_CONFIG.minWithdrawalDiamonds))
      );
      const coinPackages =
        Array.isArray(data.coinPackages) && data.coinPackages.length > 0
          ? data.coinPackages
          : COIN_PACKAGES;
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
        platformFeeRatio,
        diamondToNetUSDRate,
        minWithdrawalDiamonds,
        coinPackages,
      });
    },
    () => callback(DEFAULT_LIVE_ECONOMY)
  );
}

/**
 * Super Admin: actualiza el modo global de monetización (Libre / Solo Ads / Solo Monedas / Híbrido),
 * duración de anuncios, enlace Direct Link de Monetag, tarifas de desbloqueo y canales de pago directo.
 */
export async function updatePlatformAccessConfig({
  adminId,
  unlockMode,
  enableCoinCharges,
  enableRewardedAds,
  adDurationSeconds = 12,
  monetagDirectLink = AD_REWARD_CONFIG.monetagDirectLink,
  unlockLikeCoins = 10,
  unlockAllLikesCoins = 30,
  unlockLikeChatCoins = 10,
  estimatedAdCpmUSD = 5,
  paymentChannels = null,
}) {
  if (!adminId) throw new Error('Sesión de Super Admin inválida.');

  const resolvedMode = ['free', 'ads_only', 'coins_only', 'hybrid'].includes(unlockMode)
    ? unlockMode
    : deriveUnlockMode(Boolean(enableCoinCharges), Boolean(enableRewardedAds));

  const coinsActive = resolvedMode === 'coins_only' || resolvedMode === 'hybrid';
  const adsActive = resolvedMode === 'ads_only' || resolvedMode === 'hybrid';

  const cleanDuration = Math.floor(Number(adDurationSeconds));
  if (!Number.isFinite(cleanDuration) || cleanDuration < 5 || cleanDuration > 60) {
    throw new Error('La duración del anuncio debe estar entre 5 y 60 segundos.');
  }

  const cleanDirectLink = String(monetagDirectLink || '').trim();
  if (cleanDirectLink && !/^https?:\/\//i.test(cleanDirectLink)) {
    throw new Error('El Direct Link de Monetag debe comenzar con https:// o http://');
  }

  const cleanLikeCoins = Math.max(1, Math.floor(Number(unlockLikeCoins || 10)));
  const cleanAllLikesCoins = Math.max(1, Math.floor(Number(unlockAllLikesCoins || 30)));
  const cleanChatCoins = Math.max(1, Math.floor(Number(unlockLikeChatCoins || 10)));
  const cleanCpm = Math.max(0.1, Number(Number(estimatedAdCpmUSD || 5).toFixed(2)));

  const payload = {
    unlockMode: resolvedMode,
    enableCoinCharges: coinsActive,
    enableRewardedAds: adsActive,
    adDurationSeconds: cleanDuration,
    monetagDirectLink: cleanDirectLink,
    unlockLikeCoins: cleanLikeCoins,
    unlockAllLikesCoins: cleanAllLikesCoins,
    unlockLikeChatCoins: cleanChatCoins,
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
 * Super Admin: actualiza el precio de los diamantes y paquetes en appConfig/economy.
 */
export async function updateEconomyConfig({
  adminId,
  baseDiamondValueUSD,
  creatorShareRatio = 0.6,
  minWithdrawalDiamonds = 500,
  coinsPerDiamond = 2,
  coinPackages = COIN_PACKAGES,
}) {
  const cleanBase = Number(baseDiamondValueUSD);
  const cleanShare = Number(creatorShareRatio);
  const cleanMin = Math.floor(Number(minWithdrawalDiamonds));
  const cleanExchangeRate = Math.floor(Number(coinsPerDiamond));

  if (!Number.isFinite(cleanBase) || cleanBase <= 0 || cleanBase > 5) {
    throw new Error('El precio base por diamante debe ser mayor a $0 y menor o igual a $5.00 USD.');
  }
  if (!Number.isFinite(cleanShare) || cleanShare < 0.1 || cleanShare > 0.95) {
    throw new Error('El porcentaje para creadores debe estar entre 10% y 95%.');
  }
  if (!Number.isFinite(cleanMin) || cleanMin < 100) {
    throw new Error('El retiro mínimo debe ser al menos 100 diamantes.');
  }
  if (!Number.isFinite(cleanExchangeRate) || cleanExchangeRate < 1 || cleanExchangeRate > 100) {
    throw new Error('La tasa de intercambio debe estar entre 1 y 100 monedas por diamante.');
  }

  const sanitizedPackages = (Array.isArray(coinPackages) ? coinPackages : COIN_PACKAGES).map(
    (pkg) => {
      const units = Math.max(10, Math.floor(Number(pkg.diamonds ?? pkg.coins ?? 0)));
      return {
        ...pkg,
        diamonds: units,
        coins: units,
        priceUSD: Number(Math.max(0.5, Number(pkg.priceUSD || 0)).toFixed(2)),
      };
    }
  );

  await setDoc(
    doc(db, 'appConfig', 'economy'),
    {
      diamondsPerCoin: 1,
      coinsPerDiamond: cleanExchangeRate,
      baseDiamondValueUSD: Number(cleanBase.toFixed(4)),
      creatorShareRatio: Number(cleanShare.toFixed(2)),
      platformFeeRatio: Number((1 - cleanShare).toFixed(2)),
      diamondToNetUSDRate: Number((cleanBase * cleanShare).toFixed(4)),
      minWithdrawalDiamonds: cleanMin,
      coinPackages: sanitizedPackages,
      updatedBy: adminId,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Super Admin: actualiza la tasa sugerida e editable de intercambio Diamantes comprados -> Monedas.
 */
export async function updateExchangeConfig({ adminId, coinsPerDiamond = 2 }) {
  if (!adminId) throw new Error('Sesión de Super Admin inválida.');
  const cleanRate = Math.floor(Number(coinsPerDiamond));
  if (!Number.isFinite(cleanRate) || cleanRate < 1 || cleanRate > 100) {
    throw new Error('La tasa de intercambio debe estar entre 1 y 100 monedas por diamante.');
  }
  await setDoc(
    doc(db, 'appConfig', 'economy'),
    {
      coinsPerDiamond: cleanRate,
      updatedBy: adminId,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
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
