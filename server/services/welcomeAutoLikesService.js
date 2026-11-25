import { FieldValue } from '../config/firebaseAdmin.js';
import { dispatchPushNotificationInternal } from '../controllers/pushNotificationController.js';

const MAX_WELCOME_AUTO_LIKES = 2;

function toMillisServer(value) {
  if (!value) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (value?.seconds) return value.seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function buildMatchId(uidA, uidB) {
  return [uidA, uidB].sort().join('_');
}

function buildParticipantSnapshot(user = {}) {
  return {
    name: user.name || 'Usuario',
    photo: user.photos?.[0] || user.photo || '',
    country: user.country || null,
  };
}

/**
 * Calcula una agenda estricta de máximo 2 auto-likes de bienvenida:
 * - Like #1 entre el minuto 5 y 10 desde `baseTimeMs` (300s..600s)
 * - Like #2 entre el minuto 15 y 30 desde `baseTimeMs`, garantizando una diferencia de 15 a 25 minutos después del Like #1
 */
export function computeWelcomeLikeSchedule(baseTimeMs, randomFn = Math.random) {
  const safeBase = Number.isFinite(Number(baseTimeMs)) ? Number(baseTimeMs) : Date.now();
  const rand = typeof randomFn === 'function' ? randomFn : Math.random;

  const firstDelaySec = 300 + Math.floor(rand() * 301); // [300..600]s (5..10 min)
  const maxGapSec = 1800 - firstDelaySec; // [1200..1500]s -> topado a min 30 global
  const minGapSec = 900; // 15 min
  const gapSpan = Math.max(0, maxGapSec - minGapSec);
  const gapSec = minGapSec + Math.floor(rand() * (gapSpan + 1)); // [900..1500]s (15..25 min)

  const dueAt0 = safeBase + firstDelaySec * 1000;
  const dueAt1 = dueAt0 + gapSec * 1000;

  return {
    maxLikes: MAX_WELCOME_AUTO_LIKES,
    slots: [
      { index: 0, dueAtMs: dueAt0, status: 'pending', senderUid: null, sentAtMs: null },
      { index: 1, dueAtMs: dueAt1, status: 'pending', senderUid: null, sentAtMs: null },
    ],
  };
}

/**
 * Selecciona el mejor perfil masivo activo compatible con el usuario nuevo sin repetir remitentes.
 */
export function pickBestBulkSenderForUser(
  targetUser,
  bulkProfiles = [],
  excludedSenderIds = new Set(),
  randomFn = Math.random
) {
  const targetUid = targetUser?.uid || targetUser?.id || '';
  const blockedSet = new Set(Array.isArray(targetUser?.blockedUsers) ? targetUser.blockedUsers : []);

  const baseCandidates = (Array.isArray(bulkProfiles) ? bulkProfiles : []).filter((p) => {
    const pUid = p?.uid || p?.id || '';
    if (!pUid || pUid === targetUid) return false;
    if (p.createdByAdminBulk !== true) return false;
    if (p.isBanned === true || p.accountStatus === 'banned' || p.accountStatus === 'suspended') {
      return false;
    }
    if (p.isBulkHidden === true) return false;
    if (!Array.isArray(p.photos) || !p.photos[0]) return false;
    if (excludedSenderIds.has(pUid)) return false;
    if (blockedSet.has(pUid)) return false;
    if (Array.isArray(p.blockedUsers) && p.blockedUsers.includes(targetUid)) return false;
    return true;
  });

  if (baseCandidates.length === 0) return null;

  let preferredPool = baseCandidates;
  if (targetUser?.interestedIn === 'Mujeres') {
    const mujeres = baseCandidates.filter((p) => p.gender === 'Mujer');
    if (mujeres.length > 0) preferredPool = mujeres;
  } else if (targetUser?.interestedIn === 'Hombres') {
    const hombres = baseCandidates.filter((p) => p.gender === 'Hombre');
    if (hombres.length > 0) preferredPool = hombres;
  }

  const rand = typeof randomFn === 'function' ? randomFn : Math.random;
  let best = null;
  let bestScore = -Infinity;

  for (const p of preferredPool) {
    let score = rand() * 1.5;
    if (p.country?.code && p.country.code === targetUser?.country?.code) {
      score += 3;
    }
    if (
      p.interestedIn === 'Todos' ||
      (targetUser?.gender === 'Hombre' && p.interestedIn === 'Hombres') ||
      (targetUser?.gender === 'Mujer' && p.interestedIn === 'Mujeres')
    ) {
      score += 2;
    }
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }

  return best;
}

export async function loadActiveBulkProfiles(db) {
  const snap = await db.collection('users').where('createdByAdminBulk', '==', true).limit(250).get();
  return snap.docs
    .map((d) => ({ uid: d.id, id: d.id, ...d.data() }))
    .filter(
      (p) =>
        p.isBulkHidden !== true &&
        p.isBanned !== true &&
        p.accountStatus !== 'banned' &&
        p.accountStatus !== 'suspended' &&
        Array.isArray(p.photos) &&
        Boolean(p.photos[0])
    );
}

/**
 * Procesa la agenda de hasta 2 Me gusta automáticos escalonados para un usuario recién registrado.
 */
export async function processUserWelcomeLikes(
  db,
  targetUid,
  { economyCfg = {}, nowMs = Date.now(), cachedBulkProfiles = null } = {}
) {
  if (!db || !targetUid) {
    return { completed: true, sentNow: 0, nextDueAtMs: null };
  }

  if (economyCfg?.showAdminBulkProfiles === false || economyCfg?.enableBulkAutoLikes === false) {
    return { paused: true, completed: false, sentNow: 0, nextDueAtMs: null };
  }

  const welcomeRef = db.collection('welcomeAutoLikes').doc(targetUid);
  const targetUserRef = db.collection('users').doc(targetUid);

  const [welcomeSnap, targetUserSnap] = await Promise.all([welcomeRef.get(), targetUserRef.get()]);

  if (!targetUserSnap.exists) {
    return { completed: true, sentNow: 0, nextDueAtMs: null };
  }

  const targetData = { uid: targetUid, ...targetUserSnap.data() };
  if (
    targetData.createdByAdminBulk === true ||
    targetData.role === 'SUPER_ADMIN' ||
    targetData.role === 'admin' ||
    targetData.isBanned === true ||
    targetData.accountStatus === 'banned'
  ) {
    return { completed: true, sentNow: 0, nextDueAtMs: null };
  }

  if (!targetData.onboardingCompleted) {
    return { completed: false, waitingOnboarding: true, sentNow: 0, nextDueAtMs: null };
  }

  let welcomeData = welcomeSnap.exists ? welcomeSnap.data() : null;

  if (!welcomeData) {
    const baseTimeMs =
      toMillisServer(targetData.onboardingCompletedAt) || toMillisServer(targetData.createdAt) || 0;
    const isEligible =
      targetData.welcomeAutoLikesEligible === true ||
      (baseTimeMs > 0 && nowMs - baseTimeMs <= 60 * 60 * 1000);

    if (!isEligible) {
      await Promise.all([
        welcomeRef.set(
          {
            uid: targetUid,
            completed: true,
            skippedReason: 'existing_user',
            sentCount: 0,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        ),
        targetUserRef.update({ welcomeAutoLikesDone: true }).catch(() => {}),
      ]);
      return { completed: true, sentNow: 0, nextDueAtMs: null };
    }

    const effectiveBase = baseTimeMs || nowMs;
    const initialSchedule = computeWelcomeLikeSchedule(effectiveBase);
    welcomeData = await db.runTransaction(async (tx) => {
      const existingSnap = await tx.get(welcomeRef);
      if (existingSnap.exists) {
        return existingSnap.data();
      }
      const newDoc = {
        uid: targetUid,
        baseTimeMs: effectiveBase,
        maxLikes: MAX_WELCOME_AUTO_LIKES,
        slots: initialSchedule.slots,
        sentCount: 0,
        sentSenderIds: [],
        nextDueAtMs: initialSchedule.slots[0].dueAtMs,
        completed: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      tx.set(welcomeRef, newDoc);
      return newDoc;
    });
  }

  if (welcomeData?.completed === true || Number(welcomeData?.sentCount || 0) >= MAX_WELCOME_AUTO_LIKES) {
    if (!targetData.welcomeAutoLikesDone) {
      await targetUserRef.update({ welcomeAutoLikesDone: true }).catch(() => {});
    }
    return { completed: true, sentNow: 0, nextDueAtMs: null };
  }

  const slots = Array.isArray(welcomeData?.slots)
    ? welcomeData.slots.map((s, idx) => ({ ...s, index: s?.index ?? idx }))
    : computeWelcomeLikeSchedule(welcomeData?.baseTimeMs || nowMs).slots;

  const duePendingSlots = slots.filter((s) => s.status === 'pending' && nowMs >= Number(s.dueAtMs || 0));
  if (duePendingSlots.length === 0) {
    const nextPending = slots
      .filter((s) => s.status === 'pending')
      .sort((a, b) => Number(a.dueAtMs || 0) - Number(b.dueAtMs || 0))[0];
    return {
      completed: false,
      sentNow: 0,
      nextDueAtMs: nextPending ? Number(nextPending.dueAtMs) : null,
    };
  }

  // Si aún no tiene foto principal, posponer 5 min el turno pendiente
  const primaryPhoto = Array.isArray(targetData.photos) && targetData.photos[0] ? targetData.photos[0] : '';
  if (!primaryPhoto) {
    const postponedAtMs = nowMs + 5 * 60 * 1000;
    const updatedSlots = slots.map((s) =>
      s.status === 'pending' && nowMs >= Number(s.dueAtMs || 0)
        ? { ...s, dueAtMs: postponedAtMs }
        : s
    );
    const nextPending = updatedSlots
      .filter((s) => s.status === 'pending')
      .sort((a, b) => Number(a.dueAtMs || 0) - Number(b.dueAtMs || 0))[0];
    await welcomeRef.update({
      slots: updatedSlots,
      nextDueAtMs: nextPending ? Number(nextPending.dueAtMs) : null,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return {
      completed: false,
      sentNow: 0,
      nextDueAtMs: nextPending ? Number(nextPending.dueAtMs) : postponedAtMs,
    };
  }

  const [bulkProfiles, existingLikesSnap] = await Promise.all([
    cachedBulkProfiles ? Promise.resolve(cachedBulkProfiles) : loadActiveBulkProfiles(db),
    db.collection('likes').where('toUserId', '==', targetUid).get(),
  ]);

  const existingLikerIds = new Set();
  let existingAutoLikesCount = 0;
  existingLikesSnap.docs.forEach((docSnap) => {
    const d = docSnap.data() || {};
    if (d.fromUserId) existingLikerIds.add(d.fromUserId);
    if (d.isAutoWelcomeLike === true) existingAutoLikesCount += 1;
  });

  if (existingAutoLikesCount >= MAX_WELCOME_AUTO_LIKES) {
    await Promise.all([
      welcomeRef.update({
        completed: true,
        sentCount: MAX_WELCOME_AUTO_LIKES,
        nextDueAtMs: null,
        updatedAt: FieldValue.serverTimestamp(),
      }),
      targetUserRef.update({ welcomeAutoLikesDone: true }).catch(() => {}),
    ]);
    return { completed: true, sentNow: 0, nextDueAtMs: null };
  }

  const baseTimeMs = Number(welcomeData?.baseTimeMs || nowMs);
  const moreThanOneHourPassed = nowMs - baseTimeMs >= 60 * 60 * 1000;
  const slotsToProcess = moreThanOneHourPassed ? duePendingSlots : duePendingSlots.slice(0, 1);

  let sentNow = 0;
  const excludedIds = new Set([...existingLikerIds, ...(welcomeData?.sentSenderIds || [])]);
  let latestNextDueAtMs = null;
  let isNowCompleted = false;

  for (const slot of slotsToProcess) {
    const sender = pickBestBulkSenderForUser(targetData, bulkProfiles, excludedIds);
    if (!sender) {
      // Sin perfiles masivos disponibles actualmente
      if (nowMs - baseTimeMs > 2 * 60 * 60 * 1000) {
        await db.runTransaction(async (tx) => {
          const wSnap = await tx.get(welcomeRef);
          if (!wSnap.exists) return;
          const wData = wSnap.data() || {};
          const currSlots = Array.isArray(wData.slots) ? [...wData.slots] : [...slots];
          if (currSlots[slot.index]?.status !== 'pending') return;
          currSlots[slot.index] = { ...currSlots[slot.index], status: 'skipped' };
          const pendingRest = currSlots.filter((s) => s.status === 'pending');
          const doneAll = pendingRest.length === 0 || Number(wData.sentCount || 0) >= MAX_WELCOME_AUTO_LIKES;
          tx.update(welcomeRef, {
            slots: currSlots,
            completed: doneAll,
            nextDueAtMs: doneAll ? null : Number(pendingRest[0]?.dueAtMs || 0) || null,
            updatedAt: FieldValue.serverTimestamp(),
          });
        });
        continue;
      }
      return {
        completed: false,
        sentNow,
        nextDueAtMs: nowMs + 10 * 60 * 1000,
      };
    }

    excludedIds.add(sender.uid);
    const likeRef = db.collection('likes').doc(`${sender.uid}_${targetUid}`);
    const reverseLikeRef = db.collection('likes').doc(`${targetUid}_${sender.uid}`);
    const matchId = buildMatchId(sender.uid, targetUid);
    const matchRef = db.collection('matches').doc(matchId);

    const txResult = await db.runTransaction(async (tx) => {
      const [wSnap, tSnap, likeSnap, reverseSnap, matchSnap] = await Promise.all([
        tx.get(welcomeRef),
        tx.get(targetUserRef),
        tx.get(likeRef),
        tx.get(reverseLikeRef),
        tx.get(matchRef),
      ]);

      if (!wSnap.exists || !tSnap.exists) {
        return { fired: false, completed: true, nextDueAtMs: null };
      }

      const wData = wSnap.data() || {};
      const tData = tSnap.data() || {};
      const currSentCount = Number(wData.sentCount || 0);
      if (wData.completed === true || currSentCount >= MAX_WELCOME_AUTO_LIKES) {
        tx.update(welcomeRef, { completed: true, nextDueAtMs: null });
        tx.update(targetUserRef, { welcomeAutoLikesDone: true });
        return { fired: false, completed: true, nextDueAtMs: null };
      }

      const currSlots = Array.isArray(wData.slots) ? [...wData.slots] : [...slots];
      if (currSlots[slot.index]?.status !== 'pending') {
        const pendingAfter = currSlots.filter((s) => s.status === 'pending');
        return {
          fired: false,
          completed: pendingAfter.length === 0,
          nextDueAtMs: pendingAfter[0] ? Number(pendingAfter[0].dueAtMs) : null,
        };
      }

      if (likeSnap.exists) {
        // Ese remitente ya había dado like manual; marcar omitido para no duplicar ni pasarse de 2
        currSlots[slot.index] = { ...currSlots[slot.index], status: 'skipped' };
        const pendingAfter = currSlots.filter((s) => s.status === 'pending');
        const nextDue = pendingAfter[0] ? Number(pendingAfter[0].dueAtMs) : null;
        tx.update(welcomeRef, {
          slots: currSlots,
          completed: pendingAfter.length === 0,
          nextDueAtMs: nextDue,
          updatedAt: FieldValue.serverTimestamp(),
        });
        return { fired: false, completed: pendingAfter.length === 0, nextDueAtMs: nextDue };
      }

      const txNowMs = Date.now();
      const targetPrimary = Array.isArray(tData.photos) && tData.photos[0] ? tData.photos[0] : primaryPhoto;

      tx.set(likeRef, {
        fromUserId: sender.uid,
        toUserId: targetUid,
        likedPhotoUrl: targetPrimary,
        likedPhotoIndex: 0,
        isSuperLike: false,
        isAutoWelcomeLike: true,
        createdAt: FieldValue.serverTimestamp(),
      });

      const nextLikesCount = Number(tData.likesCount || 0) + 1;
      const isMutual = reverseSnap.exists && !matchSnap.exists;

      if (isMutual) {
        tx.set(matchRef, {
          participants: [sender.uid, targetUid].sort(),
          participantProfiles: {
            [sender.uid]: buildParticipantSnapshot(sender),
            [targetUid]: buildParticipantSnapshot({ ...tData, uid: targetUid }),
          },
          isVipDirect: false,
          giftUnlockedBy: {},
          lastMessage: '🎉 ¡Hicieron Match! Envía el primer mensaje.',
          lastSenderId: sender.uid,
          lastMessageAt: FieldValue.serverTimestamp(),
          lastMessageClientMs: txNowMs,
          lastReadBy: { [sender.uid]: FieldValue.serverTimestamp() },
          lastReadByClientMs: { [sender.uid]: txNowMs },
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      currSlots[slot.index] = {
        ...currSlots[slot.index],
        status: 'sent',
        senderUid: sender.uid,
        sentAtMs: txNowMs,
      };

      // Garantizar brecha mínima de 15–22 min entre el Like #1 y el Like #2 si faltaba poco tiempo
      if (slot.index === 0 && !moreThanOneHourPassed && currSlots[1]?.status === 'pending') {
        const currentGap = Number(currSlots[1].dueAtMs || 0) - txNowMs;
        if (currentGap < 15 * 60 * 1000) {
          const safeGapMs = (15 + Math.floor(Math.random() * 8)) * 60 * 1000;
          currSlots[1] = { ...currSlots[1], dueAtMs: txNowMs + safeGapMs };
        }
      }

      const nextSentCount = currSentCount + 1;
      const nextSenderIds = Array.from(new Set([...(wData.sentSenderIds || []), sender.uid]));
      const remainingPending = currSlots
        .filter((s) => s.status === 'pending')
        .sort((a, b) => Number(a.dueAtMs || 0) - Number(b.dueAtMs || 0));
      const doneNow = nextSentCount >= MAX_WELCOME_AUTO_LIKES || remainingPending.length === 0;
      const nextDue = doneNow ? null : Number(remainingPending[0]?.dueAtMs || 0) || null;

      tx.update(welcomeRef, {
        slots: currSlots,
        sentCount: nextSentCount,
        sentSenderIds: nextSenderIds,
        nextDueAtMs: nextDue,
        completed: doneNow,
        updatedAt: FieldValue.serverTimestamp(),
      });

      const userPatch = {
        likesCount: nextLikesCount,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (doneNow) {
        userPatch.welcomeAutoLikesDone = true;
      }
      tx.update(targetUserRef, userPatch);

      return {
        fired: true,
        matched: isMutual || matchSnap.exists,
        completed: doneNow,
        nextDueAtMs: nextDue,
      };
    });

    latestNextDueAtMs = txResult.nextDueAtMs;
    isNowCompleted = txResult.completed;

    if (txResult.fired) {
      sentNow += 1;
      dispatchPushNotificationInternal({
        senderUid: sender.uid,
        recipientUid: targetUid,
        type: txResult.matched ? 'match' : 'like',
        title: txResult.matched
          ? '💘 ¡Nuevo Match en Conoscamosnos!'
          : '❤️ ¡Alguien le dio Me gusta a tu foto!',
        body: txResult.matched
          ? `${sender.name || 'Alguien'} también te dio corazón. Entra para chatear.`
          : 'Entra a Conoscamosnos para ver quién se fijó en tu perfil.',
        link: '/app',
      }).catch(() => {});
    }
  }

  if (latestNextDueAtMs === null && !isNowCompleted) {
    const freshSnap = await welcomeRef.get();
    const fresh = freshSnap.data() || {};
    isNowCompleted = fresh.completed === true;
    latestNextDueAtMs = fresh.nextDueAtMs ? Number(fresh.nextDueAtMs) : null;
  }

  return {
    completed: isNowCompleted,
    sentNow,
    nextDueAtMs: latestNextDueAtMs,
  };
}

/**
 * Ejecuta el motor de auto-likes de bienvenida para el usuario actual y despacha
 * oportunistamente hasta 4 agendas vencidas de otros usuarios recién registrados.
 */
export async function handleSyncWelcomeAutoLikes({ db, uid, economyCfg = {} }) {
  const nowMs = Date.now();
  let cachedBulkProfiles = null;

  const autoLikesActive =
    economyCfg?.showAdminBulkProfiles !== false && economyCfg?.enableBulkAutoLikes !== false;

  const ownResult = await processUserWelcomeLikes(db, uid, {
    economyCfg,
    nowMs,
  });

  if (autoLikesActive) {
    try {
      const pendingSnap = await db
        .collection('welcomeAutoLikes')
        .where('completed', '==', false)
        .limit(12)
        .get();

      const dueDocs = pendingSnap.docs
        .filter((d) => {
          if (d.id === uid) return false;
          const data = d.data() || {};
          const nextDue = Number(data.nextDueAtMs || Infinity);
          return Number.isFinite(nextDue) && nextDue <= nowMs;
        })
        .slice(0, 4);

      if (dueDocs.length > 0) {
        cachedBulkProfiles = await loadActiveBulkProfiles(db);
        for (const docSnap of dueDocs) {
          await processUserWelcomeLikes(db, docSnap.id, {
            economyCfg,
            nowMs,
            cachedBulkProfiles,
          }).catch(() => {});
        }
      }
    } catch {
      // No bloquear respuesta principal si la limpieza oportunista falla
    }
  }

  return ownResult;
}
