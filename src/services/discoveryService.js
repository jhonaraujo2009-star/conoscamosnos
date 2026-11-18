import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { buildMatchId } from '../utils/formatters';

export function subscribeReceivedLikes(currentUid, callback) {
  if (!currentUid || !db) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, 'likes'), where('toUserId', '==', currentUid));
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    () => callback([])
  );
}

export function subscribeGivenLikesCount(currentUid, callback) {
  if (!currentUid || !db) {
    callback(0);
    return () => {};
  }
  const q = query(collection(db, 'likes'), where('fromUserId', '==', currentUid));
  return onSnapshot(
    q,
    (snap) => callback(snap.size),
    () => callback(0)
  );
}

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
    matchData: matchSnap.exists() ? { id: matchSnap.id, ...matchSnap.data() } : null,
  };
}

/**
 * Abre o crea una sala de chat privada 1-a-1 entre dos perfiles independientes.
 * Garantiza que únicamente los 2 participantes tengan acceso a la conversación.
 */
export async function openOrCreateDirectChat({ currentUser, targetUser }) {
  const fromUid = currentUser?.uid || currentUser?.id;
  const toUid = targetUser?.uid || targetUser?.id;
  if (!fromUid || !toUid || fromUid === toUid) {
    throw new Error('No puedes iniciar un chat contigo mismo.');
  }

  if (Array.isArray(currentUser?.blockedUsers) && currentUser.blockedUsers.includes(toUid)) {
    throw new Error('Desbloquea a este usuario primero para enviarle mensajes.');
  }
  if (Array.isArray(targetUser?.blockedUsers) && targetUser.blockedUsers.includes(fromUid)) {
    throw new Error('Este perfil no está disponible para recibir mensajes.');
  }

  const matchId = buildMatchId(fromUid, toUid);
  const matchRef = doc(db, 'matches', matchId);
  const nowMs = Date.now();

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
      giftUnlockedBy: {},
      lastMessage: '🔒 Chat privado iniciado. ¡Saluda!',
      lastSenderId: '',
      lastMessageAt: serverTimestamp(),
      lastMessageClientMs: nowMs,
      lastReadBy: { [fromUid]: serverTimestamp() },
      lastReadByClientMs: { [fromUid]: nowMs },
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
export async function sendLike({ currentUser, targetUser, likedPhotoUrl = '' }) {
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

    const targetData = targetSnap.data();
    if (
      (Array.isArray(currentUser?.blockedUsers) && currentUser.blockedUsers.includes(toUid)) ||
      (Array.isArray(targetData.blockedUsers) && targetData.blockedUsers.includes(fromUid))
    ) {
      throw new Error('No puedes interactuar con este perfil porque existe un bloqueo activo.');
    }

    if (likeSnap.exists()) {
      return { alreadyLiked: true, matched: matchSnap.exists(), matchId };
    }

    const currentLikes = Number(targetSnap.data().likesCount || 0);
    const isMutual = reverseSnap.exists();

    transaction.set(likeRef, {
      fromUserId: fromUid,
      toUserId: toUid,
      likedPhotoUrl: typeof likedPhotoUrl === 'string' ? likedPhotoUrl : '',
      createdAt: serverTimestamp(),
    });

    transaction.update(targetUserRef, {
      likesCount: currentLikes + 1,
      updatedAt: serverTimestamp(),
    });

    if (isMutual && !matchSnap.exists()) {
      const matchNowMs = Date.now();
      transaction.set(matchRef, {
        participants: [fromUid, toUid].sort(),
        participantProfiles: {
          [fromUid]: buildParticipantSnapshot(currentUser),
          [toUid]: buildParticipantSnapshot(targetUser),
        },
        isVipDirect: false,
        giftUnlockedBy: {},
        lastMessage: '🎉 ¡Hicieron Match! Envía el primer mensaje.',
        lastSenderId: fromUid,
        lastMessageAt: serverTimestamp(),
        lastMessageClientMs: matchNowMs,
        lastReadBy: { [fromUid]: serverTimestamp() },
        lastReadByClientMs: { [fromUid]: matchNowMs },
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
