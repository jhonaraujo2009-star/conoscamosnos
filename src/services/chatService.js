import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { toMillis } from '../utils/formatters';
import { sendPushNotificationToUser } from './pushNotificationService';

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

export async function sendTextMessage({ matchId, senderId, senderName = '', recipientId = '', text }) {
  const cleanText = text.trim();
  if (!cleanText || !matchId || !senderId) return;

  const nowMs = Date.now();
  const resolvedRecipientId =
    recipientId ||
    String(matchId || '')
      .split('_')
      .find((id) => id && id !== senderId) ||
    '';

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

  if (resolvedRecipientId) {
    sendPushNotificationToUser({
      recipientUid: resolvedRecipientId,
      type: 'message',
      title: `💬 Mensaje de ${senderName || 'Conoscamosnos'}`,
      body: cleanText.slice(0, 120),
      link: '/app',
    });
  }
}

export async function sendImageMessage({ matchId, senderId, senderName = '', recipientId = '', imageUrl }) {
  if (!imageUrl || !matchId || !senderId) return;

  const nowMs = Date.now();
  const resolvedRecipientId =
    recipientId ||
    String(matchId || '')
      .split('_')
      .find((id) => id && id !== senderId) ||
    '';

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

  if (resolvedRecipientId) {
    sendPushNotificationToUser({
      recipientUid: resolvedRecipientId,
      type: 'message',
      title: `📷 ${senderName || 'Alguien'} te envió una foto`,
      body: 'Abre el chat privado en Conoscamosnos para verla.',
      link: '/app',
    });
  }
}

/**
 * Envía un regalo virtual de forma autoritativa y atómica a través de `/api/economy/spend`:
 * - Verifica precio vigente desde appConfig/economy y saldo del emisor en el servidor
 * - Descuenta Diamantes del emisor y acredita `earningsDiamonds` retirables al receptor
 * - Crea o actualiza la sala 1-a-1, inserta el mensaje `type: 'gift'` y dispara push FCM
 */
export async function sendVirtualGift({
  matchId = null,
  sender,
  receiver,
  gift,
}) {
  const senderId = sender?.uid || sender?.id;
  const receiverId = receiver?.uid || receiver?.id;
  if (!receiverId || !senderId || senderId === receiverId) {
    throw new Error('Destinatario de regalo inválido.');
  }
  if (!gift?.id) {
    throw new Error('Regalo virtual inválido.');
  }

  const currentUser = auth?.currentUser;
  if (!currentUser) {
    throw new Error('Debes iniciar sesión para enviar regalos.');
  }
  const idToken = await currentUser.getIdToken();
  const res = await fetch('/api/economy/spend', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      action: 'send_gift',
      receiverId,
      giftId: gift.id,
      matchId: matchId || '',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || 'No se pudo enviar el regalo.');
  }

  return {
    giftTxId: data.giftTxId,
    diamondsCredited: data.diamondsCredited,
    matchId: data.matchId,
  };
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

/**
 * Suscribe a los regalos y desbloqueos de Fotos VIP enviados por el usuario autenticado.
 */
export function subscribeSentGiftTransactions(senderUid, callback, onError) {
  if (!senderUid || !db) {
    callback([]);
    return () => {};
  }
  const q = query(
    collection(db, 'giftTransactions'),
    where('senderId', '==', senderUid)
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

/**
 * Super Admin: escucha regalos y desbloqueos de Fotos Exclusivas VIP recientes en toda la plataforma.
 */
export function subscribeAllGiftTransactions(callback, onError) {
  if (!db) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, 'giftTransactions'), limit(300));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      callback(list);
    },
    (err) => {
      console.error('Error escuchando giftTransactions admin:', err);
      if (onError) onError(err);
    }
  );
}
