import { FieldValue, getAdminAuth, getAdminFirestore, getAdminMessaging } from '../config/firebaseAdmin.js';

/**
 * Envía una notificación Push Web (FCM) real a todos los dispositivos registrados
 * del usuario destinatario en `users/{recipientUid}/private/fcmTokens`.
 * Funciona incluso cuando el usuario tiene la PWA cerrada.
 */
export async function dispatchPushNotificationInternal({
  senderUid = '',
  recipientUid = '',
  type = 'message',
  title = 'Conoscamosnos',
  body = 'Tienes una nueva notificación en Conoscamosnos',
  link = '/app',
}) {
  const cleanRecipientUid = String(recipientUid || '').trim();
  if (!cleanRecipientUid) {
    return { statusCode: 400, body: { ok: false, error: 'Falta recipientUid.' } };
  }
  if (senderUid && senderUid === cleanRecipientUid) {
    return { statusCode: 200, body: { ok: true, skipped: 'self' } };
  }

  try {
    const db = getAdminFirestore();
    const [recipientSnap, tokensSnap] = await Promise.all([
      db.collection('users').doc(cleanRecipientUid).get(),
      db.collection('users').doc(cleanRecipientUid).collection('private').doc('fcmTokens').get(),
    ]);

    if (!recipientSnap.exists) {
      return { statusCode: 200, body: { ok: true, skipped: 'recipient_not_found' } };
    }

    const recipientData = recipientSnap.data() || {};
    if (recipientData.pushNotificationsEnabled === false) {
      return { statusCode: 200, body: { ok: true, skipped: 'disabled_by_user' } };
    }
    if (
      senderUid &&
      Array.isArray(recipientData.blockedUsers) &&
      recipientData.blockedUsers.includes(senderUid)
    ) {
      return { statusCode: 200, body: { ok: true, skipped: 'blocked' } };
    }

    const tokensData = tokensSnap.exists ? tokensSnap.data() || {} : {};
    const tokens = Array.isArray(tokensData.tokens)
      ? Array.from(new Set(tokensData.tokens.filter((t) => typeof t === 'string' && t.length > 20)))
      : [];

    if (tokens.length === 0) {
      return { statusCode: 200, body: { ok: true, sent: 0, skipped: 'no_tokens' } };
    }

    const cleanTitle = String(title || 'Conoscamosnos').slice(0, 90);
    const cleanBody = String(body || 'Tienes una novedad en Conoscamosnos').slice(0, 180);
    const cleanLink = String(link || '/app');
    const cleanType = String(type || 'message');

    const messaging = getAdminMessaging();
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: cleanTitle,
        body: cleanBody,
      },
      data: {
        type: cleanType,
        senderUid: senderUid || '',
        title: cleanTitle,
        body: cleanBody,
        url: cleanLink,
      },
      webpush: {
        headers: {
          Urgency: 'high',
        },
        notification: {
          title: cleanTitle,
          body: cleanBody,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          tag: `conoscamosnos_${cleanType}_${senderUid || 'system'}`,
          renotify: true,
        },
        fcmOptions: {
          link: cleanLink,
        },
      },
    });

    // Limpiar tokens caducados o revocados por el navegador
    const invalidTokens = [];
    response.responses.forEach((r, idx) => {
      if (!r.success) {
        const code = r.error?.code || '';
        if (
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/registration-token-not-registered'
        ) {
          invalidTokens.push(tokens[idx]);
        }
      }
    });

    if (invalidTokens.length > 0) {
      await db
        .collection('users')
        .doc(cleanRecipientUid)
        .collection('private')
        .doc('fcmTokens')
        .set(
          {
            tokens: FieldValue.arrayRemove(...invalidTokens),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    }

    return {
      statusCode: 200,
      body: {
        ok: true,
        sent: response.successCount,
        failed: response.failureCount,
      },
    };
  } catch (err) {
    console.error('[PushNotificationController] Error enviando push FCM:', err);
    return {
      statusCode: 200,
      body: {
        ok: false,
        skipped: 'fcm_error',
        error: err?.message || 'No se pudo despachar el push FCM.',
      },
    };
  }
}

export async function sendPushNotification({
  authHeader = '',
  recipientUid = '',
  type = 'message',
  title = 'Conoscamosnos',
  body = 'Tienes una nueva notificación en Conoscamosnos',
  link = '/app',
}) {
  const bearerMatch = String(authHeader || '').match(/^Bearer\s+(.+)$/i);
  if (!bearerMatch?.[1]) {
    return {
      statusCode: 401,
      body: { ok: false, error: 'Se requiere sesión autenticada para enviar notificaciones.' },
    };
  }

  const cleanRecipientUid = String(recipientUid || '').trim();
  if (!cleanRecipientUid) {
    return {
      statusCode: 400,
      body: { ok: false, error: 'Falta recipientUid.' },
    };
  }

  let senderUid = '';
  try {
    const decoded = await getAdminAuth().verifyIdToken(bearerMatch[1]);
    senderUid = decoded.uid;
  } catch {
    return {
      statusCode: 401,
      body: { ok: false, error: 'Token de sesión inválido.' },
    };
  }

  return dispatchPushNotificationInternal({
    senderUid,
    recipientUid: cleanRecipientUid,
    type,
    title,
    body,
    link,
  });
}

export async function sendPushExpressHandler(req, res) {
  const result = await sendPushNotification({
    authHeader: req.headers.authorization || '',
    recipientUid: req.body?.recipientUid,
    type: req.body?.type,
    title: req.body?.title,
    body: req.body?.body,
    link: req.body?.link,
  });
  return res.status(result.statusCode).json(result.body);
}
