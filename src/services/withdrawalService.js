import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { ECONOMY_CONFIG } from '../config/constants';
import { calculateWithdrawalBreakdown, toMillis } from '../utils/formatters';

/**
 * Solicita el retiro de diamantes ganados por regalos.
 * Congela atómicamente los diamantes en pendingWithdrawalDiamonds para evitar doble gasto
 * mientras la empresa realiza el pago real al usuario.
 */
export async function requestDiamondsWithdrawal({ user, amountDiamonds, payoutMethod, payoutDetails }) {
  const cleanAmount = Math.floor(Number(amountDiamonds || 0));
  if (cleanAmount < ECONOMY_CONFIG.minWithdrawalDiamonds) {
    throw new Error(
      `El retiro mínimo es de ${ECONOMY_CONFIG.minWithdrawalDiamonds} diamantes.`
    );
  }
  if (!payoutDetails || payoutDetails.trim().length < 4) {
    throw new Error('Ingresa los datos de tu cuenta o billetera para recibir el pago.');
  }

  const breakdown = calculateWithdrawalBreakdown(cleanAmount);
  const userRef = doc(db, 'users', user.uid);
  const withdrawalRef = doc(collection(db, 'withdrawalRequests'));

  await runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) {
      throw new Error('Usuario no encontrado.');
    }

    const userData = userSnap.data();
    const availableDiamonds = Number(userData.earningsDiamonds || 0);
    const currentPending = Number(userData.pendingWithdrawalDiamonds || 0);

    if (availableDiamonds < cleanAmount) {
      throw new Error('No tienes suficientes diamantes disponibles para este retiro.');
    }

    transaction.update(userRef, {
      earningsDiamonds: availableDiamonds - cleanAmount,
      pendingWithdrawalDiamonds: currentPending + cleanAmount,
      updatedAt: serverTimestamp(),
    });

    transaction.set(withdrawalRef, {
      userId: user.uid,
      userName: user.name || userData.name || 'Usuario',
      userEmail: user.email || userData.email || '',
      userPhoto: user.photos?.[0] || '',
      countryCode: user.country?.code || 'GLOBAL',
      countryFlag: user.country?.flag || '🌎',
      amountDiamonds: cleanAmount,
      grossUSD: breakdown.grossUSD,
      platformFeeUSD: breakdown.platformFeeUSD,
      netPayoutUSD: breakdown.netPayoutUSD,
      payoutMethodId: payoutMethod.id,
      payoutMethodName: payoutMethod.name,
      payoutDetails: payoutDetails.trim(),
      status: 'pending',
      createdAt: serverTimestamp(),
    });
  });

  return { withdrawalId: withdrawalRef.id, ...breakdown };
}

export function subscribeMyWithdrawals(userId, callback) {
  const q = query(
    collection(db, 'withdrawalRequests'),
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
    (err) => console.error('Error escuchando mis retiros:', err)
  );
}

export function subscribeAllWithdrawals(callback) {
  const q = query(collection(db, 'withdrawalRequests'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (err) => console.error('Error escuchando retiros admin:', err)
  );
}

/**
 * Super Admin: confirma que la empresa ya transfirió el dinero real al usuario.
 */
export async function markWithdrawalPaid({
  withdrawalId,
  adminId,
  payoutReference,
  payoutProofUrl = '',
}) {
  if (!payoutReference?.trim()) {
    throw new Error('Ingresa la referencia de la transferencia realizada por la empresa.');
  }

  const withdrawalRef = doc(db, 'withdrawalRequests', withdrawalId);

  await runTransaction(db, async (transaction) => {
    const reqSnap = await transaction.get(withdrawalRef);
    if (!reqSnap.exists()) {
      throw new Error('La solicitud de retiro no existe.');
    }
    const reqData = reqSnap.data();
    if (reqData.status !== 'pending') {
      throw new Error('Esta solicitud de retiro ya fue procesada.');
    }

    const userRef = doc(db, 'users', reqData.userId);
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) {
      throw new Error('Usuario destinatario no encontrado.');
    }

    const userData = userSnap.data();
    const currentPending = Number(userData.pendingWithdrawalDiamonds || 0);
    const currentTotalWithdrawn = Number(userData.totalWithdrawnUSD || 0);

    transaction.update(userRef, {
      pendingWithdrawalDiamonds: Math.max(0, currentPending - Number(reqData.amountDiamonds || 0)),
      totalWithdrawnUSD: Number((currentTotalWithdrawn + Number(reqData.netPayoutUSD || 0)).toFixed(2)),
      updatedAt: serverTimestamp(),
    });

    transaction.update(withdrawalRef, {
      status: 'paid',
      payoutReference: payoutReference.trim(),
      payoutProofUrl,
      reviewedBy: adminId,
      paidAt: serverTimestamp(),
    });
  });
}

/**
 * Super Admin: rechaza un retiro y devuelve los diamantes al saldo del usuario.
 */
export async function rejectWithdrawalRequest({
  withdrawalId,
  adminId,
  reason = 'Datos de cobro inválidos o inconsistentes',
}) {
  const withdrawalRef = doc(db, 'withdrawalRequests', withdrawalId);

  await runTransaction(db, async (transaction) => {
    const reqSnap = await transaction.get(withdrawalRef);
    if (!reqSnap.exists()) {
      throw new Error('La solicitud de retiro no existe.');
    }
    const reqData = reqSnap.data();
    if (reqData.status !== 'pending') {
      throw new Error('Esta solicitud de retiro ya fue procesada.');
    }

    const userRef = doc(db, 'users', reqData.userId);
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) {
      throw new Error('Usuario no encontrado.');
    }

    const userData = userSnap.data();
    const currentDiamonds = Number(userData.earningsDiamonds || 0);
    const currentPending = Number(userData.pendingWithdrawalDiamonds || 0);
    const amount = Number(reqData.amountDiamonds || 0);

    transaction.update(userRef, {
      earningsDiamonds: currentDiamonds + amount,
      pendingWithdrawalDiamonds: Math.max(0, currentPending - amount),
      updatedAt: serverTimestamp(),
    });

    transaction.update(withdrawalRef, {
      status: 'rejected',
      rejectionReason: reason,
      reviewedBy: adminId,
      reviewedAt: serverTimestamp(),
    });
  });
}
