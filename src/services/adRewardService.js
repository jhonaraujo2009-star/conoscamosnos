import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { AD_REWARD_CONFIG, EXCLUSIVE_PHOTO_DEFAULT_COST } from '../config/constants';
import { toMillis } from '../utils/formatters';

function getUnlocksRef(uid) {
  return doc(db, 'users', uid, 'private', 'unlocks');
}

async function callEconomySpend(payload) {
  const currentUser = auth?.currentUser;
  if (!currentUser) {
    throw new Error('Debes iniciar sesión para realizar esta operación.');
  }
  const idToken = await currentUser.getIdToken();
  const res = await fetch('/api/economy/spend', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || 'No se pudo completar la operación en el servidor.');
  }
  return data;
}

/**
 * Suscribe de forma estrictamente privada a los desbloqueos (Likes revelados, Chats y Fotos VIP)
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
 * Registra en el servidor un desbloqueo obtenido gratuitamente tras ver un anuncio completo.
 */
export async function recordAdRewardUnlock({
  uid,
  purpose,
  targetUid,
  provider = AD_REWARD_CONFIG.provider,
}) {
  if (!uid || !targetUid) {
    throw new Error('Datos inválidos para registrar la recompensa del anuncio.');
  }
  if (purpose !== 'reveal_like' && purpose !== 'unlock_chat') {
    throw new Error('Tipo de recompensa publicitaria no soportado.');
  }

  return callEconomySpend({
    action: 'ad_unlock',
    purpose,
    targetUid,
    provider,
  });
}

/**
 * Desbloquea un Like específico gastando Diamantes (💎) de forma autoritativa en el servidor.
 */
export async function unlockLikeWithDiamonds({
  uid,
  targetUid,
  costDiamonds = AD_REWARD_CONFIG.unlockLikeDiamonds,
}) {
  if (!uid || !targetUid) throw new Error('Perfil inválido.');
  const res = await callEconomySpend({
    action: 'unlock_like',
    targetUid,
    costDiamonds,
  });
  return { unlocked: true, targetUid, costDiamonds: res.costDiamonds ?? costDiamonds };
}

/**
 * Desbloquea todos los Likes pendientes de una vez con Diamantes (💎) en el servidor.
 */
export async function unlockAllLikesWithDiamonds({
  uid,
  targetUids = [],
  costDiamonds = AD_REWARD_CONFIG.unlockAllLikesDiamonds,
}) {
  const cleanIds = Array.from(new Set(targetUids.filter(Boolean)));
  if (!uid || cleanIds.length === 0) throw new Error('No hay Likes pendientes por revelar.');

  const res = await callEconomySpend({
    action: 'unlock_all_likes',
    targetUids: cleanIds,
    costDiamonds,
  });
  return {
    unlockedCount: res.unlockedCount ?? cleanIds.length,
    costDiamonds: res.costDiamonds ?? costDiamonds,
  };
}

/**
 * Desbloquea el acceso para enviar mensaje a un perfil sin Match en el servidor.
 */
export async function unlockChatWithDiamonds({
  uid,
  targetUid,
  costDiamonds = AD_REWARD_CONFIG.unlockChatDiamonds,
}) {
  if (!uid || !targetUid) throw new Error('Perfil inválido.');
  const res = await callEconomySpend({
    action: 'unlock_chat',
    targetUid,
    costDiamonds,
  });
  return { unlocked: true, targetUid, costDiamonds: res.costDiamonds ?? costDiamonds };
}

/**
 * Desbloquea una Foto Exclusiva VIP y acredita Diamantes Ganados (`earningsDiamonds`) al creador desde el servidor.
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

  const res = await callEconomySpend({
    action: 'unlock_exclusive_photo',
    targetUid,
    photoUrl,
    costDiamonds,
  });
  return {
    unlocked: true,
    photoKey: res.photoKey,
    costDiamonds: res.costDiamonds ?? costDiamonds,
  };
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
