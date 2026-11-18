import { FieldValue, getAdminAuth, getAdminFirestore } from '../config/firebaseAdmin.js';
import { dispatchPushNotificationInternal } from './pushNotificationController.js';

const DEFAULT_VIRTUAL_GIFTS = [
  { id: 'rose', name: 'Rosa', icon: '🌹', price: 10 },
  { id: 'coffee', name: 'Café', icon: '☕', price: 25 },
  { id: 'teddy', name: 'Peluche', icon: '🧸', price: 50 },
  { id: 'champagne', name: 'Champaña', icon: '🍾', price: 150 },
  { id: 'diamond', name: 'Diamante Real', icon: '💎', price: 500 },
];

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
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
  let uid = '';
  let economyCfg = {};

  try {
    db = getAdminFirestore();
    const decoded = await getAdminAuth().verifyIdToken(bearerMatch[1]);
    uid = decoded.uid;

    const cfgSnap = await db.collection('appConfig').doc('economy').get();
    if (cfgSnap.exists) {
      economyCfg = cfgSnap.data() || {};
    }
  } catch (err) {
    console.error('[EconomySpend] Error verificando Firebase Admin/Token:', err);
    return {
      statusCode: 401,
      body: { ok: false, error: 'No se pudo validar tu sesión en el servidor.' },
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

    throw new HttpError(400, 'Acción económica no reconocida.');
  } catch (err) {
    if (err instanceof HttpError) {
      return {
        statusCode: err.statusCode,
        body: { ok: false, error: err.message },
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
