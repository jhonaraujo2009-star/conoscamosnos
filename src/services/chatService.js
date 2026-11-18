import {
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
import { ECONOMY_CONFIG } from '../config/constants';
import { buildMatchId, toMillis } from '../utils/formatters';

export function subscribeUserMatches(userId, callback, onError) {
  if (!userId) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, 'matches'),
    where('participants', 'array-contains', userId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        // Garantizar que sólo se procesen conversaciones privadas 1-a-1 donde el usuario actual sea participante
        .filter(
          (m) =>
            Array.isArray(m.participants) &&
            m.participants.length === 2 &&
            m.participants.includes(userId)
        )
        .sort((a, b) => toMillis(b.lastMessageAt) - toMillis(a.lastMessageAt));
      callback(list);
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}

export function subscribeChatMessages(matchId, callback, onError) {
  if (!matchId) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, 'matches', matchId, 'messages'),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const sorted = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const timeA = toMillis(a.createdAt) || a.clientCreatedAt || 0;
          const timeB = toMillis(b.createdAt) || b.clientCreatedAt || 0;
          return timeA - timeB;
        });
      callback(sorted);
    },
    (err) => {
      console.error('Error escuchando mensajes:', err);
      if (onError) onError(err);
    }
  );
}

export async function markChatAsRead(matchId, userId) {
  if (!matchId || !userId) return;
  try {
    await updateDoc(doc(db, 'matches', matchId), {
      [`lastReadBy.${userId}`]: serverTimestamp(),
      [`lastReadByClientMs.${userId}`]: Date.now(),
    });
  } catch {
    // Ignorar si aún no se ha sincronizado el documento
  }
}

export async function sendTextMessage({ matchId, senderId, text }) {
  const cleanText = text.trim();
  if (!cleanText || !matchId || !senderId) return;

  const nowMs = Date.now();

  await addDoc(collection(db, 'matches', matchId, 'messages'), {
    senderId,
    type: 'text',
    text: cleanText,
    clientCreatedAt: nowMs,
    createdAt: serverTimestamp(),
  });

  await updateDoc(doc(db, 'matches', matchId), {
    lastMessage: cleanText.slice(0, 90),
    lastSenderId: senderId,
    lastMessageAt: serverTimestamp(),
    lastMessageClientMs: nowMs,
    [`lastReadBy.${senderId}`]: serverTimestamp(),
    [`lastReadByClientMs.${senderId}`]: nowMs,
  });
}

export async function sendImageMessage({ matchId, senderId, imageUrl }) {
  if (!imageUrl || !matchId || !senderId) return;

  const nowMs = Date.now();

  await addDoc(collection(db, 'matches', matchId, 'messages'), {
    senderId,
    type: 'image',
    imageUrl,
    text: '',
    clientCreatedAt: nowMs,
    createdAt: serverTimestamp(),
  });

  await updateDoc(doc(db, 'matches', matchId), {
    lastMessage: '📷 Foto enviada',
    lastSenderId: senderId,
    lastMessageAt: serverTimestamp(),
    lastMessageClientMs: nowMs,
    [`lastReadBy.${senderId}`]: serverTimestamp(),
    [`lastReadByClientMs.${senderId}`]: nowMs,
  });
}

/**
 * Transacción atómica de regalo virtual:
 * - Verifica saldo del emisor
 * - Descuenta monedas al emisor
 * - Suma +1 a giftsReceivedCount y acredita diamantes (earningsDiamonds) al receptor
 * - Registra giftTransactions
 * - Crea o actualiza la sala de chat privada 1-a-1 e inserta el mensaje especial type: 'gift'
 */
export async function sendVirtualGift({
  matchId = null,
  sender,
  receiver,
  gift,
  economyConfig = ECONOMY_CONFIG,
}) {
  const senderId = sender.uid || sender.id;
  const receiverId = receiver.uid || receiver.id;
  if (!receiverId || !senderId || senderId === receiverId) {
    throw new Error('Destinatario de regalo inválido.');
  }

  const resolvedMatchId = matchId || buildMatchId(senderId, receiverId);
  const senderRef = doc(db, 'users', senderId);
  const receiverRef = doc(db, 'users', receiverId);
  const matchRef = doc(db, 'matches', resolvedMatchId);
  const giftTxRef = doc(collection(db, 'giftTransactions'));
  const messageRef = doc(collection(db, 'matches', resolvedMatchId, 'messages'));

  const perCoin = Number(economyConfig?.diamondsPerCoin ?? ECONOMY_CONFIG.diamondsPerCoin);
  const diamondsToCredit = Math.max(1, Math.floor(gift.price * perCoin));
  const nowMs = Date.now();

  await runTransaction(db, async (transaction) => {
    const [senderSnap, receiverSnap, matchSnap] = await Promise.all([
      transaction.get(senderRef),
      transaction.get(receiverRef),
      transaction.get(matchRef),
    ]);

    if (!senderSnap.exists() || !receiverSnap.exists()) {
      throw new Error('Uno de los perfiles ya no existe.');
    }

    const senderData = senderSnap.data();
    const receiverData = receiverSnap.data();

    if (
      (Array.isArray(senderData.blockedUsers) && senderData.blockedUsers.includes(receiverId)) ||
      (Array.isArray(receiverData.blockedUsers) && receiverData.blockedUsers.includes(senderId))
    ) {
      throw new Error('No puedes enviar regalos a este perfil porque existe un bloqueo activo.');
    }

    const senderCoins = Number(senderData.coins || 0);
    if (senderCoins < gift.price) {
      throw new Error(`No tienes suficientes monedas. Necesitas ${gift.price} monedas para enviar ${gift.name}.`);
    }

    const receiverGiftsCount = Number(receiverData.giftsReceivedCount || 0);
    const receiverDiamonds = Number(receiverData.earningsDiamonds || 0);
    const prevGiftCounts =
      receiverData.giftCounts && typeof receiverData.giftCounts === 'object'
        ? { ...receiverData.giftCounts }
        : {};
    prevGiftCounts[gift.id] = Number(prevGiftCounts[gift.id] || 0) + 1;

    transaction.update(senderRef, {
      coins: senderCoins - gift.price,
      updatedAt: serverTimestamp(),
    });

    transaction.update(receiverRef, {
      giftsReceivedCount: receiverGiftsCount + 1,
      earningsDiamonds: receiverDiamonds + diamondsToCredit,
      giftCounts: prevGiftCounts,
      updatedAt: serverTimestamp(),
    });

    transaction.set(giftTxRef, {
      senderId,
      senderName: sender.name || senderData.name || 'Usuario',
      receiverId,
      receiverName: receiver.name || receiverData.name || 'Usuario',
      giftId: gift.id,
      giftName: gift.name,
      giftIcon: gift.icon,
      coinsCost: gift.price,
      diamondsCredited: diamondsToCredit,
      matchId: resolvedMatchId,
      createdAt: serverTimestamp(),
    });

    const participantProfiles = {
      [senderId]: {
        uid: senderId,
        name: sender.name || senderData.name || 'Usuario',
        photo: sender.photos?.[0] || senderData.photos?.[0] || '',
        country: sender.country || senderData.country || null,
      },
      [receiverId]: {
        uid: receiverId,
        name: receiver.name || receiverData.name || 'Usuario',
        photo: receiver.photos?.[0] || receiverData.photos?.[0] || '',
        country: receiver.country || receiverData.country || null,
      },
    };

    if (matchSnap.exists()) {
      const existingMatch = matchSnap.data() || {};
      const nextGiftUnlocked = {
        ...(existingMatch.giftUnlockedBy || {}),
        [senderId]: true,
      };
      transaction.update(matchRef, {
        participantProfiles,
        giftUnlockedBy: nextGiftUnlocked,
        lastMessage: `${gift.icon} Envió ${gift.name} (${gift.price} monedas)`,
        lastSenderId: senderId,
        lastMessageAt: serverTimestamp(),
        lastMessageClientMs: nowMs,
        [`lastReadBy.${senderId}`]: serverTimestamp(),
        [`lastReadByClientMs.${senderId}`]: nowMs,
      });
    } else {
      transaction.set(matchRef, {
        participants: [senderId, receiverId].sort(),
        participantProfiles,
        isVipDirect: false,
        giftUnlockedBy: { [senderId]: true },
        lastMessage: `${gift.icon} Envió ${gift.name} (${gift.price} monedas)`,
        lastSenderId: senderId,
        lastMessageAt: serverTimestamp(),
        lastMessageClientMs: nowMs,
        lastReadBy: { [senderId]: serverTimestamp() },
        lastReadByClientMs: { [senderId]: nowMs },
        createdAt: serverTimestamp(),
      });
    }

    transaction.set(messageRef, {
      senderId,
      senderName: sender.name || senderData.name || 'Usuario',
      receiverId,
      type: 'gift',
      giftId: gift.id,
      giftName: gift.name,
      giftIcon: gift.icon,
      giftValue: gift.price,
      diamondsCredited: diamondsToCredit,
      clientCreatedAt: nowMs,
      createdAt: serverTimestamp(),
    });
  });

  return { giftTxId: giftTxRef.id, diamondsCredited: diamondsToCredit, matchId: resolvedMatchId };
}

/**
 * Suscribe únicamente a los regalos recibidos por el usuario autenticado (estrictamente privado por receiverId).
 */
export function subscribeReceivedGiftTransactions(receiverUid, callback, onError) {
  if (!receiverUid || !db) {
    callback([]);
    return () => {};
  }
  const q = query(
    collection(db, 'giftTransactions'),
    where('receiverId', '==', receiverUid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      callback(list);
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}
