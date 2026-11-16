import {
  Timestamp,
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { CHECKOUT_CONFIG } from '../config/constants';
import { toMillis } from '../utils/formatters';

export function buildCheckoutUrl(provider, userId, pkg) {
  const customData = { userId, packageId: pkg.id };

  if (provider === 'lemonsqueezy') {
    const url = new URL(`${CHECKOUT_CONFIG.lemonSqueezyBaseUrl}/${pkg.id}`);
    url.searchParams.set('checkout[custom][user_id]', customData.userId);
    url.searchParams.set('checkout[custom][package_id]', customData.packageId);
    return {
      url: url.toString(),
      customData,
    };
  }

  const paypalUrl = `${CHECKOUT_CONFIG.paypalBaseUrl}/${pkg.priceUSD}?custom=${encodeURIComponent(
    JSON.stringify(customData)
  )}`;
  return {
    url: paypalUrl,
    customData,
  };
}

/**
 * Simulador de confirmación automática / webhook de LemonSqueezy o PayPal
 * para acreditar monedas de prueba inmediatamente en modo MVP.
 */
export async function simulateAutoPaymentConfirmation({ userId, userName, pkg, provider = 'lemonsqueezy' }) {
  const userRef = doc(db, 'users', userId);
  const txRef = doc(collection(db, 'paymentTransactions'));

  await runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) {
      throw new Error('Usuario no encontrado.');
    }

    const currentCoins = Number(userSnap.data().coins || 0);
    transaction.update(userRef, {
      coins: currentCoins + pkg.coins,
      updatedAt: serverTimestamp(),
    });

    transaction.set(txRef, {
      userId,
      userName: userName || userSnap.data().name || 'Usuario',
      provider,
      packageId: pkg.id,
      amountUSD: pkg.priceUSD,
      coinsCredited: pkg.coins,
      customData: { userId, packageId: pkg.id },
      source: 'simulator',
      status: 'completed',
      createdAt: serverTimestamp(),
    });
  });

  return { txId: txRef.id, coinsAdded: pkg.coins };
}

export async function submitManualPaymentRequest({
  user,
  pkg,
  method,
  referenceNumber,
  proofUrl,
}) {
  if (!referenceNumber?.trim()) {
    throw new Error('Ingresa el número de referencia del pago.');
  }
  if (!proofUrl) {
    throw new Error('Debes subir la captura del comprobante a Cloudinary.');
  }

  const docRef = await addDoc(collection(db, 'paymentRequests'), {
    userId: user.uid,
    userName: user.name || 'Usuario',
    userEmail: user.email || '',
    userPhoto: user.photos?.[0] || '',
    countryCode: user.country?.code || 'GLOBAL',
    countryFlag: user.country?.flag || '🌎',
    packageId: pkg.id,
    methodId: method.id,
    methodName: method.name,
    currency: method.currency,
    amountUSD: pkg.priceUSD,
    coinsToCredit: pkg.coins,
    referenceNumber: referenceNumber.trim(),
    proofUrl,
    status: 'pending',
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}

export function subscribeMyPaymentRequests(userId, callback) {
  const q = query(
    collection(db, 'paymentRequests'),
    where('userId', '==', userId)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      callback(list);
    },
    (err) => console.error('Error escuchando solicitudes de pago:', err)
  );
}

export function subscribeAllPaymentRequests(callback) {
  const q = query(collection(db, 'paymentRequests'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function subscribeAllPaymentTransactions(callback) {
  const q = query(collection(db, 'paymentTransactions'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

/**
 * Super Admin: aprueba una solicitud de recarga y acredita monedas atómicamente con runTransaction.
 */
export async function approvePaymentRequest({ requestId, adminId }) {
  const reqRef = doc(db, 'paymentRequests', requestId);

  await runTransaction(db, async (transaction) => {
    const reqSnap = await transaction.get(reqRef);
    if (!reqSnap.exists()) {
      throw new Error('La solicitud de pago no existe.');
    }

    const reqData = reqSnap.data();
    if (reqData.status !== 'pending') {
      throw new Error('Esta solicitud ya fue procesada anteriormente.');
    }

    const userRef = doc(db, 'users', reqData.userId);
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) {
      throw new Error('El usuario destinatario no existe.');
    }

    const currentCoins = Number(userSnap.data().coins || 0);
    const coinsToCredit = Number(reqData.coinsToCredit || 0);

    transaction.update(userRef, {
      coins: currentCoins + coinsToCredit,
      updatedAt: serverTimestamp(),
    });

    transaction.update(reqRef, {
      status: 'approved',
      reviewedBy: adminId,
      reviewedAt: serverTimestamp(),
    });
  });
}

export async function rejectPaymentRequest({ requestId, adminId, reason = 'Comprobante inválido o no localizado' }) {
  await updateDoc(doc(db, 'paymentRequests', requestId), {
    status: 'rejected',
    rejectionReason: reason,
    reviewedBy: adminId,
    reviewedAt: serverTimestamp(),
  });
}

/**
 * Descuenta monedas y activa/extiende el Boost VIP por país.
 */
export async function activateCountryBoost({ userId, plan }) {
  const userRef = doc(db, 'users', userId);

  const result = await runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) {
      throw new Error('Perfil de usuario no encontrado.');
    }

    const data = userSnap.data();
    const currentCoins = Number(data.coins || 0);
    if (currentCoins < plan.costCoins) {
      throw new Error(`Necesitas ${plan.costCoins} monedas para activar este Boost.`);
    }

    const existingExpiryMs = toMillis(data.boostExpiresAt);
    const baseTimeMs = existingExpiryMs > Date.now() ? existingExpiryMs : Date.now();
    const newExpiryMs = baseTimeMs + plan.durationHours * 60 * 60 * 1000;

    transaction.update(userRef, {
      coins: currentCoins - plan.costCoins,
      isBoosted: true,
      boostExpiresAt: Timestamp.fromMillis(newExpiryMs),
      boostCountry: data.country?.code || 'GLOBAL',
      updatedAt: serverTimestamp(),
    });

    return { newExpiryMs };
  });

  return result;
}
