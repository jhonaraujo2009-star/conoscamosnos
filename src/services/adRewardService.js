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
import { AD_REWARD_CONFIG, EXCLUSIVE_PHOTO_DEFAULT_COST } from '../config/constants';
import {
  buildExclusivePhotoKey,
  buildMatchId,
  splitDiamondDeduction,
  toMillis,
} from '../utils/formatters';
import { sendPushNotificationToUser } from './pushNotificationService';

function getUnlocksRef(uid) {
  return doc(db, 'users', uid, 'private', 'unlocks');
}

/**
 * Suscribe de forma estrictamente privada a los desbloqueos (Likes revelados y Chats desbloqueados)
 * del usuario autenticado.
 */
export function subscribeUserUnlocks(uid, callback) {
  if (!uid || !db) {
    callback({
      revealedLikeIds: [],
      chatUnlockedUserIds: [],
      unlockedPhotoKeys: [],
      totalAdsWatched: 0,
    });
    return () => {};
  }

  return onSnapshot(
    getUnlocksRef(uid),
    (snap) => {
      if (!snap.exists()) {
        callback({
          revealedLikeIds: [],
          chatUnlockedUserIds: [],
          unlockedPhotoKeys: [],
          totalAdsWatched: 0,
        });
        return;
      }
      const data = snap.data() || {};
      callback({
        revealedLikeIds: Array.isArray(data.revealedLikeIds) ? data.revealedLikeIds : [],
        chatUnlockedUserIds: Array.isArray(data.chatUnlockedUserIds) ? data.chatUnlockedUserIds : [],
        unlockedPhotoKeys: Array.isArray(data.unlockedPhotoKeys) ? data.unlockedPhotoKeys : [],
        totalAdsWatched: Number(data.totalAdsWatched || 0),
      });
    },
    () => {
      callback({
        revealedLikeIds: [],
        chatUnlockedUserIds: [],
        unlockedPhotoKeys: [],
        totalAdsWatched: 0,
      });
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
 * Desbloquea una Foto Exclusiva VIP del álbum de otro perfil pagando Diamantes (15 💎 por defecto)
 * y acredita atómicamente esos mismos Diamantes como ganancia retirable (`earningsDiamonds`) al creador.
 */
export async function unlockExclusivePhotoWithDiamonds({
  sender,
  targetUser,
  photoUrl,
  costDiamonds = EXCLUSIVE_PHOTO_DEFAULT_COST,
}) {
  const senderUid = sender?.uid || sender?.id;
  const targetUid = targetUser?.uid || targetUser?.id;
  if (!senderUid || !targetUid || !photoUrl || senderUid === targetUid) {
    throw new Error('Datos inválidos para desbloquear la Foto Exclusiva VIP.');
  }

  const cleanCost = Math.max(1, Math.floor(Number(costDiamonds || EXCLUSIVE_PHOTO_DEFAULT_COST)));
  const photoKey = buildExclusivePhotoKey(targetUid, photoUrl);
  const senderRef = doc(db, 'users', senderUid);
  const receiverRef = doc(db, 'users', targetUid);
  const unlocksRef = getUnlocksRef(senderUid);
  const giftTxRef = doc(collection(db, 'giftTransactions'));

  let alreadyUnlocked = false;

  await runTransaction(db, async (transaction) => {
    const [senderSnap, receiverSnap, unlocksSnap] = await Promise.all([
      transaction.get(senderRef),
      transaction.get(receiverRef),
      transaction.get(unlocksRef),
    ]);

    if (!senderSnap.exists() || !receiverSnap.exists()) {
      throw new Error('El perfil ya no está disponible.');
    }

    const existingPhotos = Array.isArray(unlocksSnap.data()?.unlockedPhotoKeys)
      ? unlocksSnap.data().unlockedPhotoKeys
      : [];
    if (existingPhotos.includes(photoKey)) {
      alreadyUnlocked = true;
      return;
    }

    const senderData = senderSnap.data();
    const receiverData = receiverSnap.data();
    const nextBalances = splitDiamondDeduction(senderData, cleanCost);
    if (!nextBalances) {
      throw new Error(
        `Necesitas ${cleanCost} 💎 para desbloquear esta Foto Exclusiva VIP (o hazte Conoscamosnos PRO para verlas todas gratis).`
      );
    }

    const receiverGiftsCount = Number(receiverData.giftsReceivedCount || 0);
    const receiverEarnings = Number(receiverData.earningsDiamonds || 0);
    const prevGiftCounts =
      receiverData.giftCounts && typeof receiverData.giftCounts === 'object'
        ? { ...receiverData.giftCounts }
        : {};
    prevGiftCounts.exclusive_photo = Number(prevGiftCounts.exclusive_photo || 0) + 1;

    transaction.update(senderRef, {
      diamonds: nextBalances.diamonds,
      coins: nextBalances.coins,
      updatedAt: serverTimestamp(),
    });

    transaction.update(receiverRef, {
      giftsReceivedCount: receiverGiftsCount + 1,
      earningsDiamonds: receiverEarnings + cleanCost,
      giftCounts: prevGiftCounts,
      updatedAt: serverTimestamp(),
    });

    transaction.set(
      unlocksRef,
      {
        unlockedPhotoKeys: Array.from(new Set([...existingPhotos, photoKey])),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    transaction.set(giftTxRef, {
      senderId: senderUid,
      senderName: sender.name || senderData.name || 'Usuario',
      receiverId: targetUid,
      receiverName: targetUser.name || receiverData.name || 'Usuario',
      giftId: 'exclusive_photo',
      giftName: 'Foto Exclusiva VIP',
      giftIcon: '📸',
      photoUrl,
      coinsCost: cleanCost,
      diamondsCost: cleanCost,
      diamondsCredited: cleanCost,
      matchId: buildMatchId(senderUid, targetUid),
      createdAt: serverTimestamp(),
    });
  });

  if (!alreadyUnlocked) {
    sendPushNotificationToUser({
      recipientUid: targetUid,
      type: 'photo_unlock',
      title: '📸 ¡Desbloquearon tu Foto Exclusiva VIP!',
      body: `${sender.name || 'Alguien'} desbloqueó una foto de tu Álbum VIP (+${cleanCost} 💎 retirables).`,
      link: '/app',
    });
  }

  return { unlocked: true, photoKey, costDiamonds: cleanCost };
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
