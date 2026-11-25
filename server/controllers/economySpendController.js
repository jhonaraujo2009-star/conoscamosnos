import { FieldValue, getAdminAuth, getAdminFirestore } from '../config/firebaseAdmin.js';
import { dispatchPushNotificationInternal } from './pushNotificationController.js';
import { handleSyncWelcomeAutoLikes } from '../services/welcomeAutoLikesService.js';

export const SUPER_LIKE_WEEKLY_LIMIT_FREE = 2;
export const SUPER_LIKE_WEEKLY_LIMIT_PRO = 20;

const DEFAULT_VIRTUAL_GIFTS = [
  { id: 'rose', name: 'Rosa', icon: '🌹', price: 10 },
  { id: 'coffee', name: 'Café', icon: '☕', price: 25 },
  { id: 'teddy', name: 'Peluche', icon: '🧸', price: 50 },
  { id: 'champagne', name: 'Champaña', icon: '🍾', price: 150 },
  { id: 'diamond', name: 'Diamante Real', icon: '💎', price: 500 },
];

class HttpError extends Error {
  constructor(statusCode, message, extra = {}) {
    super(message);
    this.statusCode = statusCode;
    this.extra = extra;
  }
}

function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  const parsed = Date.parse(ts);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isServerProActive(userData, nowMs = Date.now()) {
  if (!userData || userData.isPro !== true || !userData.proExpiresAt) return false;
  return toMillis(userData.proExpiresAt) > nowMs;
}

export function getIsoWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function resolveWeeklySuperLikeQuota(userData, date = new Date()) {
  const nowMs = date instanceof Date ? date.getTime() : Date.now();
  const pro = isServerProActive(userData, nowMs);
  const limit = pro ? SUPER_LIKE_WEEKLY_LIMIT_PRO : SUPER_LIKE_WEEKLY_LIMIT_FREE;
  const weekKey = getIsoWeekKey(date instanceof Date ? date : new Date(nowMs));
  const used =
    userData?.superLikesWeekKey === weekKey
      ? Math.max(0, Math.floor(Number(userData?.superLikesUsedThisWeek || 0)))
      : 0;
  const remaining = Math.max(0, limit - used);
  return {
    used,
    limit,
    remaining,
    isPro: pro,
    weekKey,
  };
}

function buildParticipantSnapshot(userData, uid) {
  return {
    uid,
    name: userData?.name || 'Usuario',
    photo: userData?.photos?.[0] || userData?.photo || '',
    country: userData?.country || null,
  };
}

function resolveServerGifts(economyCfg = {}) {
  const customList = Array.isArray(economyCfg?.virtualGifts) ? economyCfg.virtualGifts : [];
  const byId = {};
  customList.forEach((g) => {
    if (g?.id) byId[g.id] = g;
  });
  return DEFAULT_VIRTUAL_GIFTS.map((base) => {
    const ov = byId[base.id];
    if (!ov) return base;
    const rawPrice = Number(ov.price);
    const price =
      Number.isFinite(rawPrice) && rawPrice >= 1
        ? Math.max(1, Math.min(50000, Math.floor(rawPrice)))
        : base.price;
    return { ...base, price };
  });
}

function buildMatchId(uidA, uidB) {
  return [uidA, uidB].sort().join('_');
}

function computeRemainingUpdate(userData, cost) {
  const currDiamonds = Math.max(0, Math.floor(Number(userData?.diamonds || 0)));
  const currCoins = Math.max(0, Math.floor(Number(userData?.coins || 0)));
  const totalSpendable = currDiamonds + currCoins;
  if (totalSpendable < cost) {
    return null;
  }
  const remainingDiamonds = totalSpendable - cost;
  const update = {
    diamonds: remainingDiamonds,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (currCoins > 0) {
    update.coins = 0;
  }
  return { remainingDiamonds, update };
}

function isUserBanned(userData) {
  return userData?.isBanned === true || userData?.accountStatus === 'banned';
}

function areBlocked(userA, uidA, userB, uidB) {
  return (
    (Array.isArray(userA?.blockedUsers) && userA.blockedUsers.includes(uidB)) ||
    (Array.isArray(userB?.blockedUsers) && userB.blockedUsers.includes(uidA))
  );
}

/**
 * Procesa de forma autoritativa y atómica todos los desbloqueos, recompensas publicitarias,
 * Fotos Exclusivas VIP y regalos virtuales en el servidor con Firebase Admin SDK.
 */
export async function processEconomySpend({
  authHeader = '',
  action = '',
  payload = {},
}) {
  const bearerMatch = String(authHeader || '').match(/^Bearer\s+(.+)$/i);
  if (!bearerMatch?.[1]) {
    return {
      statusCode: 401,
      body: { ok: false, error: 'Se requiere sesión autenticada (Bearer token).' },
    };
  }

  let db;
  let adminAuth;
  try {
    db = getAdminFirestore();
    adminAuth = getAdminAuth();
  } catch (err) {
    console.error('[EconomySpend] Error inicializando Firebase Admin:', err);
    return {
      statusCode: 500,
      body: { ok: false, error: 'Error de configuración del servidor (Firebase Admin SDK).' },
    };
  }

  let uid = '';
  try {
    const decoded = await adminAuth.verifyIdToken(bearerMatch[1]);
    uid = decoded.uid;
  } catch (err) {
    console.error('[EconomySpend] Error verificando token:', err);
    return {
      statusCode: 401,
      body: { ok: false, error: 'Tu sesión expiró o es inválida.' },
    };
  }

  let economyCfg = {};
  try {
    const cfgSnap = await db.collection('appConfig').doc('economy').get();
    if (cfgSnap.exists) {
      economyCfg = cfgSnap.data() || {};
    }
  } catch (err) {
    console.error('[EconomySpend] Error leyendo appConfig/economy:', err);
    return {
      statusCode: 500,
      body: { ok: false, error: 'No se pudo consultar la configuración económica en el servidor.' },
    };
  }

  const cleanAction = String(action || '').trim().toLowerCase();
  const unlocksRef = db.collection('users').doc(uid).collection('private').doc('unlocks');
  const userRef = db.collection('users').doc(uid);

  const unlockMode =
    economyCfg?.unlockMode === 'coins_only' ? 'diamonds_only' : economyCfg?.unlockMode || 'hybrid';
  const diamondChargesAllowed =
    typeof economyCfg?.enableDiamondCharges === 'boolean'
      ? economyCfg.enableDiamondCharges
      : typeof economyCfg?.enableCoinCharges === 'boolean'
      ? economyCfg.enableCoinCharges
      : unlockMode === 'diamonds_only' || unlockMode === 'hybrid';
  const rewardedAdsAllowed =
    typeof economyCfg?.enableRewardedAds === 'boolean'
      ? economyCfg.enableRewardedAds
      : unlockMode === 'ads_only' || unlockMode === 'hybrid';

  try {
    if (cleanAction === 'unlock_like') {
      const targetUid = String(payload?.targetUid || '').trim();
      if (!targetUid || targetUid === uid) {
        throw new HttpError(400, 'Perfil de usuario inválido.');
      }
      if (!diamondChargesAllowed) {
        throw new HttpError(403, 'El desbloqueo con Diamantes está deshabilitado actualmente.');
      }
      const cost = Math.max(
        1,
        Math.floor(Number(economyCfg?.unlockLikeDiamonds ?? economyCfg?.unlockLikeCoins ?? 2))
      );
      const activationRef = db.collection('storeActivations').doc();

      const outcome = await db.runTransaction(async (transaction) => {
        const [userSnap, unlocksSnap] = await Promise.all([
          transaction.get(userRef),
          transaction.get(unlocksRef),
        ]);
        if (!userSnap.exists) throw new HttpError(404, 'Perfil de usuario no encontrado.');
        const userData = userSnap.data() || {};
        if (isUserBanned(userData)) throw new HttpError(403, 'Cuenta suspendida.');

        const existingRevealed = Array.isArray(unlocksSnap.data()?.revealedLikeIds)
          ? unlocksSnap.data().revealedLikeIds
          : [];
        if (existingRevealed.includes(targetUid)) {
          return {
            unlocked: true,
            alreadyUnlocked: true,
            targetUid,
            costDiamonds: 0,
            remainingDiamonds: Number(userData.diamonds || 0) + Number(userData.coins || 0),
          };
        }

        const deduction = computeRemainingUpdate(userData, cost);
        if (!deduction) {
          throw new HttpError(400, `Necesitas ${cost} 💎 para revelar este Like al instante.`);
        }

        transaction.update(userRef, deduction.update);
        transaction.set(
          unlocksRef,
          {
            revealedLikeIds: Array.from(new Set([...existingRevealed, targetUid])),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        transaction.set(activationRef, {
          userId: uid,
          userName: userData.name || 'Usuario',
          kind: 'unlock_like',
          targetUid,
          diamondsSpent: cost,
          createdAt: FieldValue.serverTimestamp(),
        });

        return {
          unlocked: true,
          alreadyUnlocked: false,
          targetUid,
          costDiamonds: cost,
          remainingDiamonds: deduction.remainingDiamonds,
        };
      });

      return { statusCode: 200, body: { ok: true, ...outcome } };
    }

    if (cleanAction === 'unlock_all_likes') {
      if (!diamondChargesAllowed) {
        throw new HttpError(403, 'El desbloqueo con Diamantes está deshabilitado actualmente.');
      }
      const rawIds = Array.isArray(payload?.targetUids) ? payload.targetUids : [];
      const cleanIds = Array.from(
        new Set(rawIds.map((id) => String(id || '').trim()).filter((id) => id && id !== uid))
      ).slice(0, 200);
      if (cleanIds.length === 0) {
        throw new HttpError(400, 'No hay Likes pendientes por revelar.');
      }

      const singleCost = Math.max(
        1,
        Math.floor(Number(economyCfg?.unlockLikeDiamonds ?? economyCfg?.unlockLikeCoins ?? 2))
      );
      const bundleCap = Math.max(
        1,
        Math.floor(
          Number(economyCfg?.unlockAllLikesDiamonds ?? economyCfg?.unlockAllLikesCoins ?? 10)
        )
      );
      const activationRef = db.collection('storeActivations').doc();

      const outcome = await db.runTransaction(async (transaction) => {
        const [userSnap, unlocksSnap] = await Promise.all([
          transaction.get(userRef),
          transaction.get(unlocksRef),
        ]);
        if (!userSnap.exists) throw new HttpError(404, 'Perfil de usuario no encontrado.');
        const userData = userSnap.data() || {};
        if (isUserBanned(userData)) throw new HttpError(403, 'Cuenta suspendida.');

        const existingRevealed = Array.isArray(unlocksSnap.data()?.revealedLikeIds)
          ? unlocksSnap.data().revealedLikeIds
          : [];
        const existingSet = new Set(existingRevealed);
        const pendingIds = cleanIds.filter((id) => !existingSet.has(id));

        if (pendingIds.length === 0) {
          return {
            unlockedCount: 0,
            costDiamonds: 0,
            remainingDiamonds: Number(userData.diamonds || 0) + Number(userData.coins || 0),
          };
        }

        const cost = Math.min(bundleCap, pendingIds.length * singleCost);
        const deduction = computeRemainingUpdate(userData, cost);
        if (!deduction) {
          throw new HttpError(
            400,
            `Necesitas ${cost} 💎 para revelar todos tus Likes al instante.`
          );
        }

        const merged = Array.from(new Set([...existingRevealed, ...pendingIds]));
        transaction.update(userRef, deduction.update);
        transaction.set(
          unlocksRef,
          {
            revealedLikeIds: merged,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        transaction.set(activationRef, {
          userId: uid,
          userName: userData.name || 'Usuario',
          kind: 'unlock_all_likes',
          unlockedCount: pendingIds.length,
          diamondsSpent: cost,
          createdAt: FieldValue.serverTimestamp(),
        });

        return {
          unlockedCount: pendingIds.length,
          costDiamonds: cost,
          remainingDiamonds: deduction.remainingDiamonds,
        };
      });

      return { statusCode: 200, body: { ok: true, ...outcome } };
    }

    if (cleanAction === 'unlock_chat') {
      if (!diamondChargesAllowed) {
        throw new HttpError(403, 'El desbloqueo con Diamantes está deshabilitado actualmente.');
      }
      const targetUid = String(payload?.targetUid || '').trim();
      if (!targetUid || targetUid === uid) {
        throw new HttpError(400, 'Perfil de destino inválido.');
      }
      const cost = Math.max(
        1,
        Math.floor(Number(economyCfg?.unlockChatDiamonds ?? economyCfg?.unlockLikeChatCoins ?? 2))
      );
      const activationRef = db.collection('storeActivations').doc();

      const outcome = await db.runTransaction(async (transaction) => {
        const [userSnap, unlocksSnap] = await Promise.all([
          transaction.get(userRef),
          transaction.get(unlocksRef),
        ]);
        if (!userSnap.exists) throw new HttpError(404, 'Perfil de usuario no encontrado.');
        const userData = userSnap.data() || {};
        if (isUserBanned(userData)) throw new HttpError(403, 'Cuenta suspendida.');

        const existingChats = Array.isArray(unlocksSnap.data()?.chatUnlockedUserIds)
          ? unlocksSnap.data().chatUnlockedUserIds
          : [];
        if (existingChats.includes(targetUid)) {
          return {
            unlocked: true,
            alreadyUnlocked: true,
            targetUid,
            costDiamonds: 0,
            remainingDiamonds: Number(userData.diamonds || 0) + Number(userData.coins || 0),
          };
        }

        const deduction = computeRemainingUpdate(userData, cost);
        if (!deduction) {
          throw new HttpError(400, `Necesitas ${cost} 💎 para abrir este chat sin anuncios.`);
        }

        transaction.update(userRef, deduction.update);
        transaction.set(
          unlocksRef,
          {
            chatUnlockedUserIds: Array.from(new Set([...existingChats, targetUid])),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        transaction.set(activationRef, {
          userId: uid,
          userName: userData.name || 'Usuario',
          kind: 'unlock_chat',
          targetUid,
          diamondsSpent: cost,
          createdAt: FieldValue.serverTimestamp(),
        });

        return {
          unlocked: true,
          alreadyUnlocked: false,
          targetUid,
          costDiamonds: cost,
          remainingDiamonds: deduction.remainingDiamonds,
        };
      });

      return { statusCode: 200, body: { ok: true, ...outcome } };
    }

    if (cleanAction === 'ad_unlock') {
      if (unlockMode === 'diamonds_only' || !rewardedAdsAllowed) {
        throw new HttpError(
          403,
          'Los desbloqueos por anuncio están desactivados por la administración.'
        );
      }
      const purpose = String(payload?.purpose || '').trim();
      const targetUid = String(payload?.targetUid || '').trim();
      const provider = String(payload?.provider || 'monetag').trim() || 'monetag';
      if (!targetUid || targetUid === uid) {
        throw new HttpError(400, 'Perfil destino inválido.');
      }
      if (purpose !== 'reveal_like' && purpose !== 'unlock_chat') {
        throw new HttpError(400, 'Tipo de recompensa publicitaria no soportado.');
      }

      const cpm = Math.max(0.1, Number(economyCfg?.estimatedAdCpmUSD ?? 5));
      const estimatedRevenueUSD = Number(Math.max(0.0005, cpm / 1000).toFixed(4));
      const fieldName = purpose === 'reveal_like' ? 'revealedLikeIds' : 'chatUnlockedUserIds';
      const adImpRef = db.collection('adImpressions').doc();

      await db.runTransaction(async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists) throw new HttpError(404, 'Perfil no encontrado.');
        if (isUserBanned(userSnap.data())) throw new HttpError(403, 'Cuenta suspendida.');

        transaction.set(
          unlocksRef,
          {
            [fieldName]: FieldValue.arrayUnion(targetUid),
            totalAdsWatched: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        transaction.set(adImpRef, {
          userId: uid,
          targetUserId: targetUid,
          purpose,
          provider,
          estimatedRevenueUSD,
          createdAt: FieldValue.serverTimestamp(),
        });
      });

      return {
        statusCode: 200,
        body: { ok: true, unlocked: true, targetUid, purpose },
      };
    }

    if (cleanAction === 'unlock_exclusive_photo') {
      const targetUid = String(payload?.targetUid || '').trim();
      const photoUrl = String(payload?.photoUrl || '').trim();
      if (!targetUid || targetUid === uid || !/^https?:\/\//i.test(photoUrl)) {
        throw new HttpError(400, 'Datos inválidos para desbloquear la Foto Exclusiva VIP.');
      }

      const cost = Math.max(
        1,
        Math.floor(Number(economyCfg?.unlockExclusivePhotoDiamonds ?? 15))
      );
      const photoKey = `${targetUid}::${photoUrl}`;
      const receiverRef = db.collection('users').doc(targetUid);
      const giftTxRef = db.collection('giftTransactions').doc();

      const outcome = await db.runTransaction(async (transaction) => {
        const [senderSnap, receiverSnap, unlocksSnap] = await Promise.all([
          transaction.get(userRef),
          transaction.get(receiverRef),
          transaction.get(unlocksRef),
        ]);
        if (!senderSnap.exists || !receiverSnap.exists) {
          throw new HttpError(404, 'El perfil ya no está disponible.');
        }

        const senderData = senderSnap.data() || {};
        const receiverData = receiverSnap.data() || {};
        if (isUserBanned(senderData)) throw new HttpError(403, 'Tu cuenta está suspendida.');
        if (areBlocked(senderData, uid, receiverData, targetUid)) {
          throw new HttpError(403, 'Existe un bloqueo activo con este perfil.');
        }

        const existingPhotos = Array.isArray(unlocksSnap.data()?.unlockedPhotoKeys)
          ? unlocksSnap.data().unlockedPhotoKeys
          : [];
        if (existingPhotos.includes(photoKey)) {
          return {
            alreadyUnlocked: true,
            unlocked: true,
            photoKey,
            costDiamonds: 0,
            senderName: senderData.name || 'Alguien',
          };
        }

        const deduction = computeRemainingUpdate(senderData, cost);
        if (!deduction) {
          throw new HttpError(
            400,
            `Necesitas ${cost} 💎 para desbloquear esta Foto Exclusiva VIP (o hazte Conoscamosnos PRO para verlas todas gratis).`
          );
        }

        const receiverGiftsCount = Number(receiverData.giftsReceivedCount || 0);
        const receiverEarnings = Number(receiverData.earningsDiamonds || 0);
        const prevGiftCounts =
          receiverData.giftCounts && typeof receiverData.giftCounts === 'object'
            ? { ...receiverData.giftCounts }
            : {};
        prevGiftCounts.exclusive_photo = Number(prevGiftCounts.exclusive_photo || 0) + 1;

        transaction.update(userRef, deduction.update);
        transaction.update(receiverRef, {
          giftsReceivedCount: receiverGiftsCount + 1,
          earningsDiamonds: receiverEarnings + cost,
          giftCounts: prevGiftCounts,
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.set(
          unlocksRef,
          {
            unlockedPhotoKeys: Array.from(new Set([...existingPhotos, photoKey])),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        transaction.set(giftTxRef, {
          senderId: uid,
          senderName: senderData.name || 'Usuario',
          receiverId: targetUid,
          receiverName: receiverData.name || 'Usuario',
          giftId: 'exclusive_photo',
          giftName: 'Foto Exclusiva VIP',
          giftIcon: '📸',
          photoUrl,
          diamondsCost: cost,
          diamondsCredited: cost,
          matchId: buildMatchId(uid, targetUid),
          createdAt: FieldValue.serverTimestamp(),
        });

        return {
          alreadyUnlocked: false,
          unlocked: true,
          photoKey,
          costDiamonds: cost,
          remainingDiamonds: deduction.remainingDiamonds,
          senderName: senderData.name || 'Alguien',
        };
      });

      if (!outcome.alreadyUnlocked) {
        dispatchPushNotificationInternal({
          senderUid: uid,
          recipientUid: targetUid,
          type: 'photo_unlock',
          title: '📸 ¡Desbloquearon tu Foto Exclusiva VIP!',
          body: `${outcome.senderName} desbloqueó una foto de tu Álbum VIP (+${cost} 💎 retirables).`,
          link: '/app',
        }).catch(() => {});
      }

      return {
        statusCode: 200,
        body: {
          ok: true,
          unlocked: true,
          photoKey: outcome.photoKey,
          costDiamonds: outcome.costDiamonds,
        },
      };
    }

    if (cleanAction === 'send_gift') {
      const receiverId = String(payload?.receiverId || '').trim();
      const giftId = String(payload?.giftId || '').trim();
      if (!receiverId || receiverId === uid || !giftId) {
        throw new HttpError(400, 'Destinatario o regalo inválido.');
      }

      const catalog = resolveServerGifts(economyCfg);
      const gift = catalog.find((g) => g.id === giftId);
      if (!gift) {
        throw new HttpError(400, 'El regalo seleccionado no es válido.');
      }

      const resolvedMatchId = String(payload?.matchId || '').trim() || buildMatchId(uid, receiverId);
      const receiverRef = db.collection('users').doc(receiverId);
      const matchRef = db.collection('matches').doc(resolvedMatchId);
      const giftTxRef = db.collection('giftTransactions').doc();
      const messageRef = matchRef.collection('messages').doc();
      const nowMs = Date.now();

      const outcome = await db.runTransaction(async (transaction) => {
        const [senderSnap, receiverSnap, matchSnap] = await Promise.all([
          transaction.get(userRef),
          transaction.get(receiverRef),
          transaction.get(matchRef),
        ]);

        if (!senderSnap.exists || !receiverSnap.exists) {
          throw new HttpError(404, 'Uno de los perfiles ya no existe.');
        }

        const senderData = senderSnap.data() || {};
        const receiverData = receiverSnap.data() || {};
        if (isUserBanned(senderData)) throw new HttpError(403, 'Tu cuenta está suspendida.');
        if (areBlocked(senderData, uid, receiverData, receiverId)) {
          throw new HttpError(
            403,
            'No puedes enviar regalos a este perfil porque existe un bloqueo activo.'
          );
        }

        const deduction = computeRemainingUpdate(senderData, gift.price);
        if (!deduction) {
          throw new HttpError(
            400,
            `No tienes suficientes diamantes. Necesitas ${gift.price} 💎 para enviar ${gift.name}.`
          );
        }

        const receiverGiftsCount = Number(receiverData.giftsReceivedCount || 0);
        const receiverEarnings = Number(receiverData.earningsDiamonds || 0);
        const prevGiftCounts =
          receiverData.giftCounts && typeof receiverData.giftCounts === 'object'
            ? { ...receiverData.giftCounts }
            : {};
        prevGiftCounts[gift.id] = Number(prevGiftCounts[gift.id] || 0) + 1;

        transaction.update(userRef, deduction.update);
        transaction.update(receiverRef, {
          giftsReceivedCount: receiverGiftsCount + 1,
          earningsDiamonds: receiverEarnings + gift.price,
          giftCounts: prevGiftCounts,
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.set(giftTxRef, {
          senderId: uid,
          senderName: senderData.name || 'Usuario',
          receiverId,
          receiverName: receiverData.name || 'Usuario',
          giftId: gift.id,
          giftName: gift.name,
          giftIcon: gift.icon,
          diamondsCost: gift.price,
          diamondsCredited: gift.price,
          matchId: resolvedMatchId,
          createdAt: FieldValue.serverTimestamp(),
        });

        const participantProfiles = {
          [uid]: {
            uid,
            name: senderData.name || 'Usuario',
            photo: senderData.photos?.[0] || '',
            country: senderData.country || null,
          },
          [receiverId]: {
            uid: receiverId,
            name: receiverData.name || 'Usuario',
            photo: receiverData.photos?.[0] || '',
            country: receiverData.country || null,
          },
        };

        if (matchSnap.exists) {
          const existingMatch = matchSnap.data() || {};
          const nextGiftUnlocked = {
            ...(existingMatch.giftUnlockedBy || {}),
            [uid]: true,
          };
          transaction.update(matchRef, {
            participantProfiles,
            giftUnlockedBy: nextGiftUnlocked,
            lastMessage: `${gift.icon} Envió ${gift.name} (${gift.price} 💎)`,
            lastSenderId: uid,
            lastMessageAt: FieldValue.serverTimestamp(),
            lastMessageClientMs: nowMs,
            [`lastReadBy.${uid}`]: FieldValue.serverTimestamp(),
            [`lastReadByClientMs.${uid}`]: nowMs,
          });
        } else {
          transaction.set(matchRef, {
            participants: [uid, receiverId].sort(),
            participantProfiles,
            isVipDirect: false,
            giftUnlockedBy: { [uid]: true },
            lastMessage: `${gift.icon} Envió ${gift.name} (${gift.price} 💎)`,
            lastSenderId: uid,
            lastMessageAt: FieldValue.serverTimestamp(),
            lastMessageClientMs: nowMs,
            lastReadBy: { [uid]: FieldValue.serverTimestamp() },
            lastReadByClientMs: { [uid]: nowMs },
            createdAt: FieldValue.serverTimestamp(),
          });
        }

        transaction.set(messageRef, {
          senderId: uid,
          senderName: senderData.name || 'Usuario',
          receiverId,
          type: 'gift',
          giftId: gift.id,
          giftName: gift.name,
          giftIcon: gift.icon,
          giftValue: gift.price,
          diamondsCredited: gift.price,
          clientCreatedAt: nowMs,
          createdAt: FieldValue.serverTimestamp(),
        });

        return {
          giftTxId: giftTxRef.id,
          diamondsCredited: gift.price,
          matchId: resolvedMatchId,
          remainingDiamonds: deduction.remainingDiamonds,
          senderName: senderData.name || 'Alguien',
        };
      });

      dispatchPushNotificationInternal({
        senderUid: uid,
        recipientUid: receiverId,
        type: 'gift',
        title: `${gift.icon || '🎁'} ¡Recibiste un regalo en Conoscamosnos!`,
        body: `${outcome.senderName} te envió ${gift.name} (+${gift.price} 💎 retirables).`,
        link: '/app',
      }).catch(() => {});

      return {
        statusCode: 200,
        body: {
          ok: true,
          giftTxId: outcome.giftTxId,
          diamondsCredited: outcome.diamondsCredited,
          matchId: outcome.matchId,
          remainingDiamonds: outcome.remainingDiamonds,
        },
      };
    }

    if (cleanAction === 'send_paid_message') {
      const receiverId = String(payload?.receiverId || '').trim();
      const rawText = String(payload?.text || '').trim();
      if (!receiverId || receiverId === uid) {
        throw new HttpError(400, 'Destinatario inválido.');
      }
      if (!rawText) {
        throw new HttpError(400, 'Escribe un mensaje antes de enviarlo.');
      }
      const cleanText = rawText.slice(0, 300);
      const resolvedMatchId = buildMatchId(uid, receiverId);
      const receiverRef = db.collection('users').doc(receiverId);
      const matchRef = db.collection('matches').doc(resolvedMatchId);
      const giftTxRef = db.collection('giftTransactions').doc();
      const messageRef = matchRef.collection('messages').doc();
      const nowMs = Date.now();

      const outcome = await db.runTransaction(async (transaction) => {
        const [senderSnap, receiverSnap, matchSnap] = await Promise.all([
          transaction.get(userRef),
          transaction.get(receiverRef),
          transaction.get(matchRef),
        ]);

        if (!senderSnap.exists || !receiverSnap.exists) {
          throw new HttpError(404, 'Uno de los perfiles ya no está disponible.');
        }

        const senderData = senderSnap.data() || {};
        const receiverData = receiverSnap.data() || {};
        if (isUserBanned(senderData)) throw new HttpError(403, 'Tu cuenta está suspendida.');
        if (isUserBanned(receiverData)) throw new HttpError(403, 'Este perfil no está disponible.');
        if (areBlocked(senderData, uid, receiverData, receiverId)) {
          throw new HttpError(
            403,
            'No puedes enviar mensajes a este perfil porque existe un bloqueo activo.'
          );
        }

        if (receiverData.allowPaidMessages !== true) {
          throw new HttpError(
            403,
            `${receiverData.name || 'Este perfil'} solo acepta mensajes tras hacer Match.`
          );
        }

        const rawPrice = Math.floor(Number(receiverData.messagePriceDiamonds));
        const price =
          Number.isFinite(rawPrice) && rawPrice >= 1
            ? Math.min(5000, rawPrice)
            : 25;

        const deduction = computeRemainingUpdate(senderData, price);
        if (!deduction) {
          throw new HttpError(
            400,
            `No tienes suficientes diamantes. Necesitas ${price} 💎 para enviar este mensaje prioritario.`
          );
        }

        const receiverGiftsCount = Number(receiverData.giftsReceivedCount || 0);
        const receiverEarnings = Number(receiverData.earningsDiamonds || 0);
        const prevGiftCounts =
          receiverData.giftCounts && typeof receiverData.giftCounts === 'object'
            ? { ...receiverData.giftCounts }
            : {};
        prevGiftCounts.paid_message = Number(prevGiftCounts.paid_message || 0) + 1;

        transaction.update(userRef, deduction.update);
        transaction.update(receiverRef, {
          giftsReceivedCount: receiverGiftsCount + 1,
          earningsDiamonds: receiverEarnings + price,
          giftCounts: prevGiftCounts,
          updatedAt: FieldValue.serverTimestamp(),
        });

        transaction.set(giftTxRef, {
          senderId: uid,
          senderName: senderData.name || 'Usuario',
          receiverId,
          receiverName: receiverData.name || 'Usuario',
          giftId: 'paid_message',
          giftName: 'Mensaje Prioritario VIP',
          giftIcon: '💎',
          diamondsCost: price,
          diamondsCredited: price,
          matchId: resolvedMatchId,
          createdAt: FieldValue.serverTimestamp(),
        });

        const participantProfiles = {
          [uid]: buildParticipantSnapshot(senderData, uid),
          [receiverId]: buildParticipantSnapshot(receiverData, receiverId),
        };

        const existingMatch = matchSnap.exists ? matchSnap.data() || {} : null;
        const alreadyActiveMatch = Boolean(
          existingMatch &&
            existingMatch.isPaidRequest !== true &&
            existingMatch.paidRequestStatus !== 'rejected'
        );

        if (matchSnap.exists) {
          const updateData = {
            participantProfiles,
            isVipDirect: true,
            lastMessage: cleanText.slice(0, 90),
            lastSenderId: uid,
            lastMessageAt: FieldValue.serverTimestamp(),
            lastMessageClientMs: nowMs,
            [`lastReadBy.${uid}`]: FieldValue.serverTimestamp(),
            [`lastReadByClientMs.${uid}`]: nowMs,
            [`unreadCount.${uid}`]: 0,
            [`unreadCount.${receiverId}`]: FieldValue.increment(1),
          };
          if (!alreadyActiveMatch) {
            updateData.isPaidRequest = true;
            updateData.paidRequestStatus = 'pending';
            updateData.paidRequestBy = uid;
            updateData.paidRequestDiamonds = price;
            updateData.paidRequestMessage = cleanText;
            updateData.paidRequestCreatedAt = FieldValue.serverTimestamp();
          }
          transaction.update(matchRef, updateData);
        } else {
          transaction.set(matchRef, {
            participants: [uid, receiverId].sort(),
            participantProfiles,
            isVipDirect: true,
            isPaidRequest: true,
            paidRequestStatus: 'pending',
            paidRequestBy: uid,
            paidRequestDiamonds: price,
            paidRequestMessage: cleanText,
            paidRequestCreatedAt: FieldValue.serverTimestamp(),
            giftUnlockedBy: { [uid]: true },
            lastMessage: cleanText.slice(0, 90),
            lastSenderId: uid,
            lastMessageAt: FieldValue.serverTimestamp(),
            lastMessageClientMs: nowMs,
            lastReadBy: { [uid]: FieldValue.serverTimestamp() },
            lastReadByClientMs: { [uid]: nowMs },
            unreadCount: { [uid]: 0, [receiverId]: 1 },
            createdAt: FieldValue.serverTimestamp(),
          });
        }

        transaction.set(messageRef, {
          senderId: uid,
          senderName: senderData.name || 'Usuario',
          receiverId,
          type: 'paid_message',
          text: cleanText,
          diamondsPaid: price,
          clientCreatedAt: nowMs,
          createdAt: FieldValue.serverTimestamp(),
        });

        return {
          giftTxId: giftTxRef.id,
          diamondsCredited: price,
          matchId: resolvedMatchId,
          remainingDiamonds: deduction.remainingDiamonds,
          senderName: senderData.name || 'Alguien',
          price,
        };
      });

      dispatchPushNotificationInternal({
        senderUid: uid,
        recipientUid: receiverId,
        type: 'gift',
        title: `💎 ¡Mensaje Prioritario (+${outcome.price} 💎)!`,
        body: `${outcome.senderName}: "${cleanText.slice(0, 90)}"`,
        link: '/app',
      }).catch(() => {});

      return {
        statusCode: 200,
        body: {
          ok: true,
          giftTxId: outcome.giftTxId,
          diamondsCredited: outcome.diamondsCredited,
          matchId: outcome.matchId,
          remainingDiamonds: outcome.remainingDiamonds,
          price: outcome.price,
        },
      };
    }

    if (cleanAction === 'send_super_like') {
      const targetUid = String(payload?.targetUid || '').trim();
      if (!targetUid || targetUid === uid) {
        throw new HttpError(400, 'Perfil destinatario inválido para Super Like.');
      }

      const likedPhotoUrl =
        typeof payload?.likedPhotoUrl === 'string' ? payload.likedPhotoUrl.slice(0, 1200) : '';
      const likedPhotoIndex = Math.max(
        0,
        Math.min(20, Math.floor(Number(payload?.likedPhotoIndex || 0)))
      );

      const targetRef = db.collection('users').doc(targetUid);
      const likeRef = db.collection('likes').doc(`${uid}_${targetUid}`);
      const reverseLikeRef = db.collection('likes').doc(`${targetUid}_${uid}`);
      const matchId = buildMatchId(uid, targetUid);
      const matchRef = db.collection('matches').doc(matchId);
      const nowMs = Date.now();

      const outcome = await db.runTransaction(async (transaction) => {
        const [senderSnap, targetSnap, likeSnap, reverseSnap, matchSnap] = await Promise.all([
          transaction.get(userRef),
          transaction.get(targetRef),
          transaction.get(likeRef),
          transaction.get(reverseLikeRef),
          transaction.get(matchRef),
        ]);

        if (!senderSnap.exists || !targetSnap.exists) {
          throw new HttpError(404, 'El perfil ya no está disponible.');
        }

        const senderData = senderSnap.data() || {};
        const targetData = targetSnap.data() || {};
        if (isUserBanned(senderData)) {
          throw new HttpError(403, 'Tu cuenta está suspendida.');
        }
        if (isUserBanned(targetData)) {
          throw new HttpError(403, 'Este perfil no está disponible.');
        }
        if (areBlocked(senderData, uid, targetData, targetUid)) {
          throw new HttpError(
            403,
            'No puedes interactuar con este perfil porque existe un bloqueo activo.'
          );
        }

        const quota = resolveWeeklySuperLikeQuota(senderData, new Date(nowMs));

        if (likeSnap.exists && likeSnap.data()?.isSuperLike === true) {
          return {
            alreadyLiked: true,
            matched: matchSnap.exists,
            matchId,
            isSuperLike: true,
            senderName: senderData.name || 'Alguien',
            quota,
          };
        }

        if (quota.used >= quota.limit) {
          throw new HttpError(
            429,
            quota.isPro
              ? 'Ya usaste tus 20 Super Likes semanales PRO. Se renuevan el próximo lunes.'
              : 'Ya usaste tus 2 Super Likes semanales. Hazte Conoscamosnos PRO para disfrutar 20 cada semana.',
            {
              code: 'SUPER_LIKE_LIMIT_REACHED',
              quota: { ...quota, remaining: 0 },
            }
          );
        }

        const nextUsed = quota.used + 1;
        const nextQuota = {
          used: nextUsed,
          limit: quota.limit,
          remaining: Math.max(0, quota.limit - nextUsed),
          isPro: quota.isPro,
          weekKey: quota.weekKey,
        };

        transaction.update(userRef, {
          superLikesWeekKey: quota.weekKey,
          superLikesUsedThisWeek: nextUsed,
          lastSuperLikeAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        const isNewLikeDoc = !likeSnap.exists;
        transaction.set(
          likeRef,
          {
            fromUserId: uid,
            toUserId: targetUid,
            likedPhotoUrl,
            likedPhotoIndex,
            isSuperLike: true,
            superLikedAt: FieldValue.serverTimestamp(),
            createdAt: isNewLikeDoc
              ? FieldValue.serverTimestamp()
              : likeSnap.data()?.createdAt || FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        if (isNewLikeDoc) {
          transaction.update(targetRef, {
            likesCount: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }

        const isMutual = reverseSnap.exists;
        if (isMutual && !matchSnap.exists) {
          transaction.set(matchRef, {
            participants: [uid, targetUid].sort(),
            participantProfiles: {
              [uid]: buildParticipantSnapshot(senderData, uid),
              [targetUid]: buildParticipantSnapshot(targetData, targetUid),
            },
            isVipDirect: false,
            giftUnlockedBy: {},
            lastMessage: '⭐🎉 ¡Hicieron Super Match! Envía el primer mensaje.',
            lastSenderId: uid,
            lastMessageAt: FieldValue.serverTimestamp(),
            lastMessageClientMs: nowMs,
            lastReadBy: { [uid]: FieldValue.serverTimestamp() },
            lastReadByClientMs: { [uid]: nowMs },
            createdAt: FieldValue.serverTimestamp(),
          });
        }

        return {
          alreadyLiked: false,
          matched: isMutual || matchSnap.exists,
          matchId,
          isSuperLike: true,
          senderName: senderData.name || 'Alguien',
          quota: nextQuota,
        };
      });

      if (!outcome.alreadyLiked) {
        dispatchPushNotificationInternal({
          senderUid: uid,
          recipientUid: targetUid,
          type: outcome.matched ? 'match' : 'super_like',
          title: outcome.matched
            ? `⭐💘 ¡Super Match con ${outcome.senderName}!`
            : `⭐ ¡${outcome.senderName} te envió un Super Like!`,
          body: outcome.matched
            ? 'Se gustaron mutuamente. Entra a Conoscamosnos para enviar el primer mensaje.'
            : 'Le encantó tu perfil. Entra gratis a Likes para ver quién te lo envió.',
          link: '/app',
        }).catch(() => {});
      }

      return {
        statusCode: 200,
        body: {
          ok: true,
          alreadyLiked: outcome.alreadyLiked,
          matched: outcome.matched,
          matchId: outcome.matchId,
          isSuperLike: true,
          quota: outcome.quota,
        },
      };
    }

    if (cleanAction === 'unmatch_user') {
      const targetUid = String(
        payload?.targetUserId || payload?.targetUid || payload?.peerId || ''
      ).trim();
      if (!targetUid || targetUid === uid) {
        throw new HttpError(400, 'Usuario inválido para eliminar el Match.');
      }

      const matchId = buildMatchId(uid, targetUid);
      const matchRef = db.collection('matches').doc(matchId);
      const matchSnap = await matchRef.get();

      if (matchSnap.exists) {
        const participants = Array.isArray(matchSnap.data()?.participants)
          ? matchSnap.data().participants
          : [];
        if (!participants.includes(uid)) {
          throw new HttpError(403, 'No tienes permiso para eliminar este Match.');
        }
      }

      // Borrar subcolección messages en lotes seguros
      while (true) {
        const msgBatchSnap = await matchRef.collection('messages').limit(400).get();
        if (msgBatchSnap.empty) break;
        const msgBatch = db.batch();
        msgBatchSnap.docs.forEach((docSnap) => msgBatch.delete(docSnap.ref));
        await msgBatch.commit();
        if (msgBatchSnap.size < 400) break;
      }

      const batch = db.batch();
      if (matchSnap.exists) {
        batch.delete(matchRef);
      }
      batch.delete(db.collection('likes').doc(`${uid}_${targetUid}`));
      batch.delete(db.collection('likes').doc(`${targetUid}_${uid}`));
      await batch.commit();

      return {
        statusCode: 200,
        body: {
          ok: true,
          unmatched: true,
          matchId,
          targetUserId: targetUid,
        },
      };
    }

    if (cleanAction === 'sync_welcome_likes') {
      const outcome = await handleSyncWelcomeAutoLikes({
        db,
        uid,
        economyCfg,
      });
      return {
        statusCode: 200,
        body: {
          ok: true,
          ...outcome,
        },
      };
    }

    throw new HttpError(400, 'Acción económica no reconocida.');
  } catch (err) {
    if (err instanceof HttpError) {
      return {
        statusCode: err.statusCode,
        body: { ok: false, error: err.message, ...(err.extra || {}) },
      };
    }
    console.error('[EconomySpend] Error interno:', err);
    return {
      statusCode: 500,
      body: { ok: false, error: err?.message || 'Error interno procesando la operación.' },
    };
  }
}

export async function economySpendExpressHandler(req, res) {
  try {
    const result = await processEconomySpend({
      authHeader: req.headers.authorization || '',
      action: req.body?.action,
      payload: req.body || {},
    });
    return res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error('[EconomySpend Express] Error fatal:', err);
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Error interno procesando la operación.',
    });
  }
}
