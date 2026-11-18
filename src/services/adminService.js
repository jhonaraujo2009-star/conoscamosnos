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
import { COIN_PACKAGES, ECONOMY_CONFIG } from '../config/constants';
import { toMillis } from '../utils/formatters';

export const DEFAULT_LIVE_ECONOMY = {
  ...ECONOMY_CONFIG,
  coinPackages: COIN_PACKAGES,
};

/**
 * Escucha la configuración económica en vivo (appConfig/economy).
 * Permite al Super Admin ajustar el precio de los diamantes y paquetes en tiempo real.
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

      callback({
        ...ECONOMY_CONFIG,
        ...data,
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
 * Super Admin: actualiza el precio de los diamantes y paquetes en appConfig/economy.
 */
export async function updateEconomyConfig({
  adminId,
  baseDiamondValueUSD,
  creatorShareRatio = 0.6,
  minWithdrawalDiamonds = 500,
  coinPackages = COIN_PACKAGES,
}) {
  const cleanBase = Number(baseDiamondValueUSD);
  const cleanShare = Number(creatorShareRatio);
  const cleanMin = Math.floor(Number(minWithdrawalDiamonds));

  if (!Number.isFinite(cleanBase) || cleanBase <= 0 || cleanBase > 5) {
    throw new Error('El precio base por diamante debe ser mayor a $0 y menor o igual a $5.00 USD.');
  }
  if (!Number.isFinite(cleanShare) || cleanShare < 0.1 || cleanShare > 0.95) {
    throw new Error('El porcentaje para creadores debe estar entre 10% y 95%.');
  }
  if (!Number.isFinite(cleanMin) || cleanMin < 100) {
    throw new Error('El retiro mínimo debe ser al menos 100 diamantes.');
  }

  const sanitizedPackages = (Array.isArray(coinPackages) ? coinPackages : COIN_PACKAGES).map(
    (pkg) => ({
      ...pkg,
      coins: Math.max(10, Math.floor(Number(pkg.coins || 0))),
      priceUSD: Number(Math.max(0.5, Number(pkg.priceUSD || 0)).toFixed(2)),
    })
  );

  await setDoc(
    doc(db, 'appConfig', 'economy'),
    {
      diamondsPerCoin: 1,
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
