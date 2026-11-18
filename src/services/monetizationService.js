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
  where,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { splitDiamondDeduction, toMillis } from '../utils/formatters';

/**
 * Solicita al backend seguro (/api/payments/create-invoice) una factura oficial de NowPayments
 * asociada al uid autenticado y al paquete o plan PRO elegido, para acreditación automática vía Webhook.
 */
export async function createNowPaymentsCheckout({ pkg, creditTarget = 'diamonds' }) {
  const currentUser = auth?.currentUser;
  if (!currentUser) {
    throw new Error('Debes iniciar sesión para realizar una recarga.');
  }
  const idToken = await currentUser.getIdToken();
  const res = await fetch('/api/payments/create-invoice', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      packageId: pkg.id,
      creditTarget,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.invoiceUrl) {
    throw new Error(
      data?.error || 'No se pudo conectar con NowPayments. Verifica las variables de entorno en Vercel.'
    );
  }
  return data;
}

export async function simulateAutoPaymentConfirmation({
  userId,
  userName,
  pkg,
  provider = 'nowpayments',
  creditTarget = 'diamonds',
}) {
  const userRef = doc(db, 'users', userId);
  const txRef = doc(collection(db, 'paymentTransactions'));
  const isProOrder = creditTarget === 'pro';
  const durationDays = Math.max(1, Math.floor(Number(pkg.durationDays || 7)));
  const units = Math.max(
    10,
    Math.floor(Number(pkg.diamonds ?? pkg.priceDiamonds ?? pkg.coins ?? 100))
  );
  const field = isProOrder ? 'pro' : creditTarget === 'coins' ? 'coins' : 'diamonds';

  let newProExpiryMs = 0;

  await runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) {
      throw new Error('Usuario no encontrado.');
    }

    const userData = userSnap.data();

    if (isProOrder) {
      const existingExpiryMs = toMillis(userData.proExpiresAt);
      const baseTimeMs = existingExpiryMs > Date.now() ? existingExpiryMs : Date.now();
      newProExpiryMs = baseTimeMs + durationDays * 24 * 60 * 60 * 1000;

      transaction.update(userRef, {
        isPro: true,
        proPlanId: pkg.id,
        proExpiresAt: Timestamp.fromMillis(newProExpiryMs),
        updatedAt: serverTimestamp(),
      });
    } else {
      const currentBalance = Number(userData[field] || 0);
      transaction.update(userRef, {
        [field]: currentBalance + units,
        updatedAt: serverTimestamp(),
      });
    }

    transaction.set(txRef, {
      userId,
      userName: userName || userData.name || 'Usuario',
      provider,
      packageId: pkg.id,
      amountUSD: Number(pkg.priceUSD || 0),
      creditField: field,
      proDurationDays: isProOrder ? durationDays : 0,
      coinsCredited: units,
      diamondsCredited: isProOrder ? 0 : units,
      customData: { userId, packageId: pkg.id, creditTarget: field, durationDays },
      source: 'simulator',
      status: 'completed',
      createdAt: serverTimestamp(),
    });
  });

  return {
    txId: txRef.id,
    coinsAdded: isProOrder ? 0 : units,
    diamondsAdded: isProOrder ? 0 : units,
    proDaysAdded: isProOrder ? durationDays : 0,
    newProExpiryMs,
    creditField: field,
  };
}

export async function submitManualPaymentRequest({
  user,
  pkg,
  method,
  referenceNumber,
  proofUrl,
  creditTarget = 'diamonds',
}) {
  if (!referenceNumber?.trim()) {
    throw new Error('Ingresa el número de referencia del pago.');
  }
  if (!proofUrl) {
    throw new Error('Debes subir la captura del comprobante a Cloudinary.');
  }

  const isProOrder = creditTarget === 'pro';
  const durationDays = isProOrder ? Math.max(1, Math.floor(Number(pkg.durationDays || 7))) : 0;
  const units = Math.max(
    10,
    Math.floor(Number(pkg.diamonds ?? pkg.priceDiamonds ?? pkg.coins ?? 100))
  );
  const target = isProOrder ? 'pro' : creditTarget === 'coins' ? 'coins' : 'diamonds';

  const docRef = await addDoc(collection(db, 'paymentRequests'), {
    userId: user.uid,
    userName: user.name || 'Usuario',
    userEmail: user.email || '',
    userPhoto: user.photos?.[0] || '',
    countryCode: user.country?.code || 'GLOBAL',
    countryFlag: user.country?.flag || '🌎',
    packageId: pkg.id,
    packageLabel: pkg.title || pkg.shortLabel || pkg.label || pkg.id,
    methodId: method.id,
    methodName: method.name,
    currency: method.currency,
    amountUSD: Number(pkg.priceUSD || 0),
    creditTarget: target,
    proDurationDays: durationDays,
    diamondsToCredit: units,
    coinsToCredit: units,
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
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (err) => console.error('Error escuchando solicitudes de pago admin:', err)
  );
}

export function subscribeAllPaymentTransactions(callback) {
  const q = query(collection(db, 'paymentTransactions'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (err) => console.error('Error escuchando transacciones admin:', err)
  );
}

/**
 * Super Admin: aprueba una solicitud de recarga y acredita Diamantes (💎) o membresía Conoscamosnos PRO atómicamente.
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

    const userData = userSnap.data();

    if (reqData.creditTarget === 'pro') {
      const durationDays = Math.max(1, Math.floor(Number(reqData.proDurationDays || 7)));
      const existingExpiryMs = toMillis(userData.proExpiresAt);
      const baseTimeMs = existingExpiryMs > Date.now() ? existingExpiryMs : Date.now();
      const newExpiryMs = baseTimeMs + durationDays * 24 * 60 * 60 * 1000;

      transaction.update(userRef, {
        isPro: true,
        proPlanId: reqData.packageId || 'pro_weekly',
        proExpiresAt: Timestamp.fromMillis(newExpiryMs),
        updatedAt: serverTimestamp(),
      });
    } else {
      const targetField = reqData.creditTarget === 'coins' ? 'coins' : 'diamonds';
      const currentBalance = Number(userData[targetField] || 0);
      const unitsToCredit = Number(reqData.diamondsToCredit || reqData.coinsToCredit || 0);

      transaction.update(userRef, {
        [targetField]: currentBalance + unitsToCredit,
        updatedAt: serverTimestamp(),
      });
    }

    transaction.update(reqRef, {
      status: 'approved',
      reviewedBy: adminId,
      reviewedAt: serverTimestamp(),
    });
  });
}

export async function rejectPaymentRequest({ requestId, adminId, reason = 'Comprobante inválido o no localizado' }) {
  const reqRef = doc(db, 'paymentRequests', requestId);
  await runTransaction(db, async (transaction) => {
    const reqSnap = await transaction.get(reqRef);
    if (!reqSnap.exists()) {
      throw new Error('La solicitud de pago no existe.');
    }
    if (reqSnap.data().status !== 'pending') {
      throw new Error('Esta solicitud ya fue procesada anteriormente.');
    }
    transaction.update(reqRef, {
      status: 'rejected',
      rejectionReason: reason,
      reviewedBy: adminId,
      reviewedAt: serverTimestamp(),
    });
  });
}

/**
 * Descuenta Diamantes (💎) y activa/extiende el Boost VIP por país.
 */
export async function activateCountryBoost({ userId, plan }) {
  const userRef = doc(db, 'users', userId);
  const cost = Math.max(1, Math.floor(Number(plan.costDiamonds ?? plan.costCoins ?? 50)));

  const result = await runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) {
      throw new Error('Perfil de usuario no encontrado.');
    }

    const data = userSnap.data();
    const nextBalances = splitDiamondDeduction(data, cost);
    if (!nextBalances) {
      throw new Error(`Necesitas ${cost} 💎 para activar este Boost VIP.`);
    }

    const existingExpiryMs = toMillis(data.boostExpiresAt);
    const baseTimeMs = existingExpiryMs > Date.now() ? existingExpiryMs : Date.now();
    const newExpiryMs = baseTimeMs + plan.durationHours * 60 * 60 * 1000;

    transaction.update(userRef, {
      diamonds: nextBalances.diamonds,
      coins: nextBalances.coins,
      isBoosted: true,
      boostExpiresAt: Timestamp.fromMillis(newExpiryMs),
      boostCountry: data.country?.code || 'GLOBAL',
      updatedAt: serverTimestamp(),
    });

    return { newExpiryMs, cost };
  });

  return result;
}

/**
 * Activa o extiende la membresía Conoscamosnos PRO al instante usando saldo de Diamantes (💎).
 */
export async function activateProWithDiamonds({ userId, plan }) {
  if (!userId || !plan) {
    throw new Error('Plan Conoscamosnos PRO inválido.');
  }
  const userRef = doc(db, 'users', userId);
  const costDiamonds = Math.max(1, Math.floor(Number(plan.priceDiamonds || 250)));
  const durationDays = Math.max(1, Math.floor(Number(plan.durationDays || 7)));

  const result = await runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) {
      throw new Error('Perfil de usuario no encontrado.');
    }

    const data = userSnap.data();
    const nextBalances = splitDiamondDeduction(data, costDiamonds);
    if (!nextBalances) {
      throw new Error(
        `Necesitas ${costDiamonds} 💎 para activar ${plan.shortLabel || 'Conoscamosnos PRO'}.`
      );
    }

    const existingExpiryMs = toMillis(data.proExpiresAt);
    const baseTimeMs = existingExpiryMs > Date.now() ? existingExpiryMs : Date.now();
    const newExpiryMs = baseTimeMs + durationDays * 24 * 60 * 60 * 1000;

    transaction.update(userRef, {
      diamonds: nextBalances.diamonds,
      coins: nextBalances.coins,
      isPro: true,
      proPlanId: plan.id,
      proExpiresAt: Timestamp.fromMillis(newExpiryMs),
      updatedAt: serverTimestamp(),
    });

    return { newExpiryMs, costDiamonds, durationDays };
  });

  return result;
}
