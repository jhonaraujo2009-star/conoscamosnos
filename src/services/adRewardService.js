import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { AD_REWARD_CONFIG } from '../config/constants';
import { splitDiamondDeduction, toMillis } from '../utils/formatters';

function getUnlocksRef(uid) {
  return doc(db, 'users', uid, 'private', 'unlocks');
}

/**
 * Suscribe de forma estrictamente privada a los desbloqueos (Likes revelados y Chats desbloqueados)
 * del usuario autenticado.
 */
export function subscribeUserUnlocks(uid, callback) {
  if (!uid || !db) {
    callback({ revealedLikeIds: [], chatUnlockedUserIds: [], totalAdsWatched: 0 });
    return () => {};
  }

  return onSnapshot(
    getUnlocksRef(uid),
    (snap) => {
      if (!snap.exists()) {
        callback({ revealedLikeIds: [], chatUnlockedUserIds: [], totalAdsWatched: 0 });
        return;
      }
      const data = snap.data() || {};
      callback({
        revealedLikeIds: Array.isArray(data.revealedLikeIds) ? data.revealedLikeIds : [],
        chatUnlockedUserIds: Array.isArray(data.chatUnlockedUserIds) ? data.chatUnlockedUserIds : [],
        totalAdsWatched: Number(data.totalAdsWatched || 0),
      });
    },
    () => {
      callback({ revealedLikeIds: [], chatUnlockedUserIds: [], totalAdsWatched: 0 });
    }
  );
}

/**
 * Registra un desbloqueo obtenido gratuitamente tras ver un anuncio publicitario completo.
 * También guarda la impresión para métricas del Panel Super Admin.
 */
export async function recordAdRewardUnlock({
  uid,
  purpose,
  targetUid,
  provider = AD_REWARD_CONFIG.provider,
  estimatedRevenueUSD = Number((AD_REWARD_CONFIG.estimatedAdCpmUSD / 1000).toFixed(4)),
}) {
  if (!uid || !targetUid) {
    throw new Error('Datos inválidos para registrar la recompensa del anuncio.');
  }
  if (purpose !== 'reveal_like' && purpose !== 'unlock_chat') {
    throw new Error('Tipo de recompensa publicitaria no soportado.');
  }

  const unlocksRef = getUnlocksRef(uid);
  const fieldName = purpose === 'reveal_like' ? 'revealedLikeIds' : 'chatUnlockedUserIds';

  await setDoc(
    unlocksRef,
    {
      [fieldName]: arrayUnion(targetUid),
      totalAdsWatched: increment(1),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // Registro de auditoría / ingresos estimados de publicidad para el administrador
  try {
    await addDoc(collection(db, 'adImpressions'), {
      userId: uid,
      targetUserId: targetUid,
      purpose,
      provider,
      estimatedRevenueUSD: Number(Number(estimatedRevenueUSD || 0.005).toFixed(4)),
      createdAt: serverTimestamp(),
    });
  } catch {
    // No bloquear la experiencia del usuario si las reglas de adImpressions aún no se publican
  }

  return { unlocked: true, targetUid, purpose };
}

/**
 * Desbloquea un Like específico gastando Diamantes (💎) de forma atómica.
 */
export async function unlockLikeWithCoins({
  uid,
  targetUid,
  costCoins = AD_REWARD_CONFIG.unlockLikeCoins,
}) {
  if (!uid || !targetUid) throw new Error('Perfil inválido.');
  const userRef = doc(db, 'users', uid);
  const unlocksRef = getUnlocksRef(uid);

  await runTransaction(db, async (transaction) => {
    const [userSnap, unlocksSnap] = await Promise.all([
      transaction.get(userRef),
      transaction.get(unlocksRef),
    ]);
    if (!userSnap.exists()) throw new Error('Perfil de usuario no encontrado.');

    const existingRevealed = Array.isArray(unlocksSnap.data()?.revealedLikeIds)
      ? unlocksSnap.data().revealedLikeIds
      : [];
    if (existingRevealed.includes(targetUid)) {
      return;
    }

    const nextBalances = splitDiamondDeduction(userSnap.data(), costCoins);
    if (!nextBalances) {
      throw new Error(`Necesitas ${costCoins} 💎 para revelar este Like al instante.`);
    }

    transaction.update(userRef, {
      diamonds: nextBalances.diamonds,
      coins: nextBalances.coins,
      updatedAt: serverTimestamp(),
    });

    transaction.set(
      unlocksRef,
      {
        revealedLikeIds: Array.from(new Set([...existingRevealed, targetUid])),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });

  return { unlocked: true, targetUid, costCoins };
}

/**
 * Desbloquea todos los Likes pendientes de una vez con Diamantes (💎).
 */
export async function unlockAllLikesWithCoins({
  uid,
  targetUids = [],
  costCoins = AD_REWARD_CONFIG.unlockAllLikesCoins,
}) {
  const cleanIds = Array.from(new Set(targetUids.filter(Boolean)));
  if (!uid || cleanIds.length === 0) throw new Error('No hay Likes pendientes por revelar.');

  const userRef = doc(db, 'users', uid);
  const unlocksRef = getUnlocksRef(uid);

  await runTransaction(db, async (transaction) => {
    const [userSnap, unlocksSnap] = await Promise.all([
      transaction.get(userRef),
      transaction.get(unlocksRef),
    ]);
    if (!userSnap.exists()) throw new Error('Perfil de usuario no encontrado.');

    const nextBalances = splitDiamondDeduction(userSnap.data(), costCoins);
    if (!nextBalances) {
      throw new Error(`Necesitas ${costCoins} 💎 para revelar todos tus Likes al instante.`);
    }

    const existingRevealed = Array.isArray(unlocksSnap.data()?.revealedLikeIds)
      ? unlocksSnap.data().revealedLikeIds
      : [];
    const merged = Array.from(new Set([...existingRevealed, ...cleanIds]));

    transaction.update(userRef, {
      diamonds: nextBalances.diamonds,
      coins: nextBalances.coins,
      updatedAt: serverTimestamp(),
    });

    transaction.set(
      unlocksRef,
      {
        revealedLikeIds: merged,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });

  return { unlockedCount: cleanIds.length, costCoins };
}

/**
 * Desbloquea el acceso para enviar mensaje a un perfil sin Match gastando Diamantes (💎) atómicamente.
 */
export async function unlockChatWithCoins({
  uid,
  targetUid,
  costCoins = AD_REWARD_CONFIG.unlockLikeChatCoins,
}) {
  if (!uid || !targetUid) throw new Error('Perfil inválido.');
  const userRef = doc(db, 'users', uid);
  const unlocksRef = getUnlocksRef(uid);

  await runTransaction(db, async (transaction) => {
    const [userSnap, unlocksSnap] = await Promise.all([
      transaction.get(userRef),
      transaction.get(unlocksRef),
    ]);
    if (!userSnap.exists()) throw new Error('Perfil de usuario no encontrado.');

    const existingChats = Array.isArray(unlocksSnap.data()?.chatUnlockedUserIds)
      ? unlocksSnap.data().chatUnlockedUserIds
      : [];
    if (existingChats.includes(targetUid)) {
      return;
    }

    const nextBalances = splitDiamondDeduction(userSnap.data(), costCoins);
    if (!nextBalances) {
      throw new Error(`Necesitas ${costCoins} 💎 para abrir este chat sin anuncios.`);
    }

    transaction.update(userRef, {
      diamonds: nextBalances.diamonds,
      coins: nextBalances.coins,
      updatedAt: serverTimestamp(),
    });

    transaction.set(
      unlocksRef,
      {
        chatUnlockedUserIds: Array.from(new Set([...existingChats, targetUid])),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });

  return { unlocked: true, targetUid, costCoins };
}

/**
 * Super Admin: escucha métricas recientes de anuncios recompensados vistos.
 */
export function subscribeAllAdImpressions(callback) {
  if (!db) {
    callback([]);
    return () => {};
  }
  let activeUnsub = () => {};
  let disposed = false;

  const mapDocs = (snap) =>
    snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

  const orderedQ = query(collection(db, 'adImpressions'), orderBy('createdAt', 'desc'), limit(250));
  activeUnsub = onSnapshot(
    orderedQ,
    (snap) => callback(mapDocs(snap)),
    () => {
      if (disposed) return;
      const fallbackQ = query(collection(db, 'adImpressions'), limit(250));
      activeUnsub = onSnapshot(
        fallbackQ,
        (snap) => callback(mapDocs(snap)),
        () => callback([])
      );
    }
  );

  return () => {
    disposed = true;
    activeUnsub();
  };
}
