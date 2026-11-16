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
  const q = query(
    collection(db, 'matches'),
    where('participants', 'array-contains', userId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => toMillis(b.lastMessageAt) - toMillis(a.lastMessageAt));
      callback(list);
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}

export function subscribeChatMessages(matchId, callback) {
  const q = query(
    collection(db, 'matches', matchId, 'messages'),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (err) => console.error('Error escuchando mensajes:', err)
  );
}

export async function sendTextMessage({ matchId, senderId, text }) {
  const cleanText = text.trim();
  if (!cleanText) return;

  await addDoc(collection(db, 'matches', matchId, 'messages'), {
    senderId,
    type: 'text',
    text: cleanText,
    createdAt: serverTimestamp(),
  });

  await updateDoc(doc(db, 'matches', matchId), {
    lastMessage: cleanText.slice(0, 80),
    lastMessageAt: serverTimestamp(),
  });
}

export async function sendImageMessage({ matchId, senderId, imageUrl }) {
  if (!imageUrl) return;

  await addDoc(collection(db, 'matches', matchId, 'messages'), {
    senderId,
    type: 'image',
    imageUrl,
    text: '',
    createdAt: serverTimestamp(),
  });

  await updateDoc(doc(db, 'matches', matchId), {
    lastMessage: '📷 Foto enviada',
    lastMessageAt: serverTimestamp(),
  });
}

/**
 * Transacción atómica de regalo virtual:
 * - Verifica saldo del emisor
 * - Descuenta monedas al emisor
 * - Suma +1 a giftsReceivedCount y acredita diamantes (earningsDiamonds) al receptor
 * - Registra giftTransactions
 * - Si existe match/sala de chat, inserta el mensaje especial type: 'gift'
 */
export async function sendVirtualGift({ matchId = null, sender, receiver, gift }) {
  const senderId = sender.uid;
  const receiverId = receiver.uid || receiver.id;
  if (!receiverId || senderId === receiverId) {
    throw new Error('Destinatario de regalo inválido.');
  }

  const resolvedMatchId = matchId || buildMatchId(senderId, receiverId);
  const senderRef = doc(db, 'users', senderId);
  const receiverRef = doc(db, 'users', receiverId);
  const matchRef = doc(db, 'matches', resolvedMatchId);
  const giftTxRef = doc(collection(db, 'giftTransactions'));
  const messageRef = doc(collection(db, 'matches', resolvedMatchId, 'messages'));

  const diamondsToCredit = gift.price * ECONOMY_CONFIG.diamondsPerCoin;

  await runTransaction(db, async (transaction) => {
    const [senderSnap, receiverSnap, matchSnap] = await Promise.all([
      transaction.get(senderRef),
      transaction.get(receiverRef),
      transaction.get(matchRef),
    ]);

    if (!senderSnap.exists() || !receiverSnap.exists()) {
      throw new Error('Uno de los perfiles ya no existe.');
    }

    const senderCoins = Number(senderSnap.data().coins || 0);
    if (senderCoins < gift.price) {
      throw new Error(`No tienes suficientes monedas. Necesitas ${gift.price} monedas para enviar ${gift.name}.`);
    }

    const receiverGiftsCount = Number(receiverSnap.data().giftsReceivedCount || 0);
    const receiverDiamonds = Number(receiverSnap.data().earningsDiamonds || 0);

    transaction.update(senderRef, {
      coins: senderCoins - gift.price,
      updatedAt: serverTimestamp(),
    });

    transaction.update(receiverRef, {
      giftsReceivedCount: receiverGiftsCount + 1,
      earningsDiamonds: receiverDiamonds + diamondsToCredit,
      updatedAt: serverTimestamp(),
    });

    transaction.set(giftTxRef, {
      senderId,
      senderName: sender.name || senderSnap.data().name || 'Usuario',
      receiverId,
      receiverName: receiver.name || receiverSnap.data().name || 'Usuario',
      giftId: gift.id,
      giftName: gift.name,
      giftIcon: gift.icon,
      coinsCost: gift.price,
      diamondsCredited: diamondsToCredit,
      matchId: matchSnap.exists() ? resolvedMatchId : null,
      createdAt: serverTimestamp(),
    });

    if (matchSnap.exists()) {
      transaction.set(messageRef, {
        senderId,
        senderName: sender.name || senderSnap.data().name || 'Usuario',
        receiverId,
        type: 'gift',
        giftId: gift.id,
        giftName: gift.name,
        giftIcon: gift.icon,
        giftValue: gift.price,
        diamondsCredited: diamondsToCredit,
        createdAt: serverTimestamp(),
      });

      transaction.update(matchRef, {
        lastMessage: `${gift.icon} Envió ${gift.name} (${gift.price} monedas)`,
        lastMessageAt: serverTimestamp(),
      });
    }
  });

  return { giftTxId: giftTxRef.id, diamondsCredited: diamondsToCredit };
}
