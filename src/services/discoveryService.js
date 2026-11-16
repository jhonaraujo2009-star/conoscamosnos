import {
  addDoc,
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { VIP_DM_COST } from '../config/constants';
import { buildMatchId } from '../utils/formatters';

function buildParticipantSnapshot(user) {
  return {
    uid: user.uid || user.id,
    name: user.name || 'Usuario',
    photo: user.photos?.[0] || user.photo || '',
    country: user.country || null,
  };
}

export async function checkConnectionStatus(currentUid, targetUid) {
  if (!currentUid || !targetUid || currentUid === targetUid) {
    return { iLiked: false, isMatched: false, matchId: null };
  }
  const matchId = buildMatchId(currentUid, targetUid);
  const likeId = `${currentUid}_${targetUid}`;
  const [likeSnap, matchSnap] = await Promise.all([
    getDoc(doc(db, 'likes', likeId)),
    getDoc(doc(db, 'matches', matchId)),
  ]);
  return {
    iLiked: likeSnap.exists(),
    isMatched: matchSnap.exists(),
    matchId,
  };
}

/**
 * Abre o crea una sala de chat privada 1-a-1 entre dos perfiles independientes (gratis).
 * Garantiza que únicamente los 2 participantes tengan acceso a la conversación.
 */
export async function openOrCreateDirectChat({ currentUser, targetUser }) {
  const fromUid = currentUser?.uid || currentUser?.id;
  const toUid = targetUser?.uid || targetUser?.id;
  if (!fromUid || !toUid || fromUid === toUid) {
    throw new Error('No puedes iniciar un chat contigo mismo.');
  }

  const matchId = buildMatchId(fromUid, toUid);
  const matchRef = doc(db, 'matches', matchId);

  const txResult = await runTransaction(db, async (transaction) => {
    const matchSnap = await transaction.get(matchRef);

    if (matchSnap.exists()) {
      const existingData = matchSnap.data();
      const updatedProfiles = {
        ...(existingData.participantProfiles || {}),
        [fromUid]: buildParticipantSnapshot(currentUser),
        [toUid]: buildParticipantSnapshot(targetUser),
      };
      transaction.update(matchRef, {
        participantProfiles: updatedProfiles,
      });
      return {
        matchId,
        createdNow: false,
        matchData: { id: matchSnap.id, ...existingData, participantProfiles: updatedProfiles },
      };
    }

    const newMatchData = {
      participants: [fromUid, toUid].sort(),
      participantProfiles: {
        [fromUid]: buildParticipantSnapshot(currentUser),
        [toUid]: buildParticipantSnapshot(targetUser),
      },
      isVipDirect: false,
      lastMessage: '🔒 Chat privado iniciado. ¡Saluda!',
      lastSenderId: fromUid,
      lastMessageAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    };

    transaction.set(matchRef, newMatchData);
    return { matchId, createdNow: true, matchData: { id: matchId, ...newMatchData } };
  });

  return txResult;
}

/**
 * Envía un Like. Si existe Like mutuo, crea el Match automáticamente.
 */
export async function sendLike({ currentUser, targetUser }) {
  const fromUid = currentUser.uid;
  const toUid = targetUser.uid || targetUser.id;
  if (fromUid === toUid) {
    throw new Error('No puedes darte like a ti mismo.');
  }

  const likeRef = doc(db, 'likes', `${fromUid}_${toUid}`);
  const reverseLikeRef = doc(db, 'likes', `${toUid}_${fromUid}`);
  const targetUserRef = doc(db, 'users', toUid);
  const matchId = buildMatchId(fromUid, toUid);
  const matchRef = doc(db, 'matches', matchId);

  const result = await runTransaction(db, async (transaction) => {
    const [likeSnap, reverseSnap, targetSnap, matchSnap] = await Promise.all([
      transaction.get(likeRef),
      transaction.get(reverseLikeRef),
      transaction.get(targetUserRef),
      transaction.get(matchRef),
    ]);

    if (!targetSnap.exists()) {
      throw new Error('El perfil ya no está disponible.');
    }

    if (likeSnap.exists()) {
      return { alreadyLiked: true, matched: matchSnap.exists(), matchId };
    }

    const currentLikes = Number(targetSnap.data().likesCount || 0);
    const isMutual = reverseSnap.exists();

    transaction.set(likeRef, {
      fromUserId: fromUid,
      toUserId: toUid,
      createdAt: serverTimestamp(),
    });

    transaction.update(targetUserRef, {
      likesCount: currentLikes + 1,
      updatedAt: serverTimestamp(),
    });

    if (isMutual && !matchSnap.exists()) {
      transaction.set(matchRef, {
        participants: [fromUid, toUid].sort(),
        participantProfiles: {
          [fromUid]: buildParticipantSnapshot(currentUser),
          [toUid]: buildParticipantSnapshot(targetUser),
        },
        isVipDirect: false,
        lastMessage: '🎉 ¡Hicieron Match! Envía el primer mensaje.',
        lastSenderId: fromUid,
        lastMessageAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
    }

    return {
      alreadyLiked: false,
      matched: isMutual || matchSnap.exists(),
      matchId,
    };
  });

  return result;
}

/**
 * Mensaje Directo VIP (50 monedas): abre/crea chat inmediato con etiqueta VIP destacada.
 */
export async function startVipDirectMessage({ currentUser, targetUser }) {
  const fromUid = currentUser.uid;
  const toUid = targetUser.uid || targetUser.id;
  const matchId = buildMatchId(fromUid, toUid);

  const senderRef = doc(db, 'users', fromUid);
  const matchRef = doc(db, 'matches', matchId);

  const txResult = await runTransaction(db, async (transaction) => {
    const [senderSnap, matchSnap] = await Promise.all([
      transaction.get(senderRef),
      transaction.get(matchRef),
    ]);

    if (matchSnap.exists()) {
      return { matchId, createdNow: false, matchData: { id: matchSnap.id, ...matchSnap.data() } };
    }

    if (!senderSnap.exists()) {
      throw new Error('Tu perfil no fue encontrado.');
    }

    const currentCoins = Number(senderSnap.data().coins || 0);
    if (currentCoins < VIP_DM_COST) {
      throw new Error(`Necesitas ${VIP_DM_COST} monedas para enviar un Mensaje Directo VIP.`);
    }

    const newMatchData = {
      participants: [fromUid, toUid].sort(),
      participantProfiles: {
        [fromUid]: buildParticipantSnapshot(currentUser),
        [toUid]: buildParticipantSnapshot(targetUser),
      },
      isVipDirect: true,
      vipInitiatorId: fromUid,
      lastMessage: '⚡ Mensaje Directo VIP desbloqueado',
      lastSenderId: fromUid,
      lastMessageAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    };

    transaction.update(senderRef, {
      coins: currentCoins - VIP_DM_COST,
      updatedAt: serverTimestamp(),
    });

    transaction.set(matchRef, newMatchData);

    return { matchId, createdNow: true, matchData: { id: matchId, ...newMatchData } };
  });

  if (txResult.createdNow) {
    await addDoc(collection(db, 'matches', matchId, 'messages'), {
      senderId: fromUid,
      type: 'system',
      text: `⚡ ${currentUser.name} activó un Mensaje Directo VIP`,
      clientCreatedAt: Date.now(),
      createdAt: serverTimestamp(),
    });
  }

  return txResult;
}
