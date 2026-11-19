import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { toMillis } from '../utils/formatters';

/**
 * Solicita al backend seguro (/api/payments/create-invoice) una factura oficial de NowPayments
 * asociada al uid autenticado y al paquete o plan PRO elegido, para acreditación automática vía Webhook.
 */
export async function createNowPaymentsCheckout({ pkg, creditTarget = 'diamonds' }) {
  const currentUser = auth?.currentUser;
  if (!currentUser) {
    throw new Error('Debes iniciar sesión para realizar un pago.');
  }
  const safeTarget = creditTarget === 'pro' ? 'pro' : 'diamonds';
  const idToken = await currentUser.getIdToken(true);
  const res = await fetch('/api/payments/create-invoice', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      packageId: pkg.id,
      creditTarget: safeTarget,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.invoiceUrl) {
    throw new Error(
      data?.error ||
        (res.status === 404
          ? 'El servidor de pagos (/api/payments/create-invoice) no respondió.'
          : 'No se pudo conectar con la pasarela NowPayments.')
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
  if (creditTarget === 'pro') {
    throw new Error(
      'La Membresía PRO solo se puede activar con pago real verificado; no admite simulación.'
    );
  }
  const userRef = doc(db, 'users', userId);
  const txRef = doc(collection(db, 'paymentTransactions'));
  const units = Math.max(
    10,
    Math.floor(Number(pkg.diamonds ?? pkg.priceDiamonds ?? pkg.coins ?? 100))
  );
  const field = 'diamonds';

  await runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) {
      throw new Error('Usuario no encontrado.');
    }

    const userData = userSnap.data();
    const currentBalance = Number(userData.diamonds || 0);
    transaction.update(userRef, {
      diamonds: currentBalance + units,
      updatedAt: serverTimestamp(),
    });

    transaction.set(txRef, {
      userId,
      userName: userName || userData.name || 'Usuario',
      provider,
      packageId: pkg.id,
      amountUSD: Number(pkg.priceUSD || 0),
      creditField: field,
      proDurationDays: 0,
      diamondsCredited: units,
      customData: { userId, packageId: pkg.id, creditTarget: field, durationDays: 0 },
      source: 'simulator',
      status: 'completed',
      createdAt: serverTimestamp(),
    });
  });

  return {
    txId: txRef.id,
    diamondsAdded: units,
    proDaysAdded: 0,
    newProExpiryMs: 0,
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
  const target = isProOrder ? 'pro' : 'diamonds';

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
    diamondsToCredit: isProOrder ? 0 : units,
    coinsToCredit: isProOrder ? 0 : units,
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

export function subscribeMyPaymentTransactions(userId, callback) {
  if (!userId || !db) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, 'paymentTransactions'), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      callback(list);
    },
    (err) => console.error('Error escuchando mis transacciones:', err)
  );
}

export function subscribeMyStoreActivations(userId, callback) {
  if (!userId || !db) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, 'storeActivations'), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      callback(list);
    },
    (err) => console.error('Error escuchando activaciones:', err)
  );
}

export function subscribeAllStoreActivations(callback) {
  if (!db) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, 'storeActivations'), limit(300));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      callback(list);
    },
    (err) => console.error('Error escuchando activaciones admin:', err)
  );
}

/**
 * Super Admin: aprueba una solicitud de recarga y acredita Diamantes (💎) o membresía Conoscamosnos PRO
 * de forma autoritativa desde el servidor (/api/admin/approve-payment).
 */
export async function approvePaymentRequest({ requestId }) {
  const currentUser = auth?.currentUser;
  if (!currentUser) {
    throw new Error('Debes iniciar sesión como Super Admin.');
  }
  if (!requestId) {
    throw new Error('Identificador de solicitud inválido.');
  }

  const idToken = await currentUser.getIdToken(true);
  const res = await fetch('/api/admin/approve-payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ requestId }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    throw new Error(
      data?.error ||
        (res.status === 404
          ? 'El endpoint de aprobación (/api/admin/approve-payment) no respondió.'
          : 'No se pudo aprobar la solicitud en el servidor.')
    );
  }
  return data;
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
 * Super Admin: marca o desmarca una recarga manual como revisada sin alterar status ni reviewedAt.
 */
export async function togglePaymentRequestReviewed({ requestId, adminId, reviewed = true }) {
  if (!requestId || !adminId) {
    throw new Error('Faltan datos para actualizar la revisión.');
  }
  await updateDoc(doc(db, 'paymentRequests', requestId), {
    adminChecked: Boolean(reviewed),
    adminCheckedBy: reviewed ? adminId : null,
    adminCheckedAt: reviewed ? serverTimestamp() : null,
  });
}

/**
 * Super Admin: elimina definitivamente un registro de recarga manual desde /api/admin/cleanup.
 */
export async function deleteManualPaymentRequest({ requestId }) {
  const currentUser = auth?.currentUser;
  if (!currentUser) {
    throw new Error('Debes iniciar sesión como Super Admin.');
  }
  if (!requestId) {
    throw new Error('Identificador de recarga inválido.');
  }

  const idToken = await currentUser.getIdToken();
  const res = await fetch('/api/admin/cleanup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      action: 'delete_payment_request',
      requestId,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || 'No se pudo eliminar la recarga manual.');
  }
  return data;
}

async function callServerStoreActivate({ kind, planId }) {
  const currentUser = auth?.currentUser;
  if (!currentUser) {
    throw new Error('Debes iniciar sesión para realizar esta activación.');
  }
  const idToken = await currentUser.getIdToken();
  const res = await fetch('/api/store/activate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      kind,
      planId,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || 'No se pudo completar la activación en el servidor.');
  }
  return data;
}

/**
 * Descuenta Diamantes (💎) y activa/extiende el Boost VIP de forma segura en el servidor (/api/store/activate).
 */
export async function activateCountryBoost({ plan }) {
  if (!plan?.id) {
    throw new Error('Plan Boost VIP inválido.');
  }
  return callServerStoreActivate({ kind: 'boost', planId: plan.id });
}

/**
 * La Membresía Conoscamosnos PRO ya no puede activarse con Diamantes ni saldo interno:
 * solo se obtiene pagando directamente en pasarela o transferencia verificada.
 */
export async function activateProWithDiamonds() {
  throw new Error(
    'La Membresía PRO solo se puede obtener mediante pago real verificado en pasarela o transferencia aprobada.'
  );
}
