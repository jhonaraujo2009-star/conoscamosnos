import { arrayUnion, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { app, auth, db } from '../config/firebase';

let foregroundListenerBound = false;

export function getBrowserPushStatus() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { supported: false, permission: 'unsupported' };
  }
  return {
    supported: true,
    permission: Notification.permission, // 'default' | 'granted' | 'denied'
  };
}

/**
 * Muestra una notificación nativa del navegador / Service Worker cuando la pestaña
 * está en segundo plano o para confirmar la activación de alertas.
 */
export async function showLocalServiceWorkerNotification({
  title = 'Conoscamosnos',
  body = '',
  tag = 'conoscamosnos-push',
  url = '/app',
  forceWhenVisible = false,
}) {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;
  if (!forceWhenVisible && typeof document !== 'undefined' && document.visibilityState === 'visible') {
    return false;
  }

  try {
    if ('serviceWorker' in navigator) {
      const reg =
        (await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js')) ||
        (await navigator.serviceWorker.ready.catch(() => null));
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, {
          body,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          tag,
          renotify: true,
          data: { url },
        });
        return true;
      }
    }
    const n = new Notification(title, {
      body,
      icon: '/icons/icon-192.png',
      tag,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}

/**
 * Solicita permiso de notificaciones Push al navegador, registra `/firebase-messaging-sw.js`,
 * obtiene el token FCM (si está soportado) y lo guarda en la bóveda privada `users/{uid}/private/fcmTokens`.
 */
export async function enablePushNotifications(uid) {
  if (!uid || !db) {
    throw new Error('Debes iniciar sesión para activar las notificaciones.');
  }
  if (typeof window === 'undefined' || !('Notification' in window)) {
    throw new Error('Tu navegador no soporta notificaciones Push web.');
  }

  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();

  if (permission !== 'granted') {
    throw new Error(
      'Permiso de notificaciones denegado. Habilítalo en el candado de la barra de direcciones de tu navegador.'
    );
  }

  let swReg = null;
  if ('serviceWorker' in navigator) {
    swReg = await navigator.serviceWorker
      .register('/firebase-messaging-sw.js')
      .catch(() => null);
  }

  let fcmToken = '';
  try {
    const fcmSupported = await isSupported().catch(() => false);
    if (fcmSupported && app) {
      const messaging = getMessaging(app);
      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || undefined;
      fcmToken = await getToken(messaging, {
        serviceWorkerRegistration: swReg || undefined,
        ...(vapidKey ? { vapidKey } : {}),
      }).catch(() => '');

      if (!foregroundListenerBound) {
        foregroundListenerBound = true;
        onMessage(messaging, (payload) => {
          const title = payload?.notification?.title || payload?.data?.title || 'Conoscamosnos';
          const body = payload?.notification?.body || payload?.data?.body || '';
          showLocalServiceWorkerNotification({
            title,
            body,
            tag: payload?.data?.type || 'fcm-msg',
            url: payload?.data?.url || '/app',
          });
        });
      }
    }
  } catch {
    // Continuar con Web Notifications del Service Worker aunque falte VAPID key opcional
  }

  if (fcmToken) {
    await setDoc(
      doc(db, 'users', uid, 'private', 'fcmTokens'),
      {
        tokens: arrayUnion(fcmToken),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  await updateDoc(doc(db, 'users', uid), {
    pushNotificationsEnabled: true,
    updatedAt: serverTimestamp(),
  });

  await showLocalServiceWorkerNotification({
    title: '🔔 ¡Notificaciones activadas!',
    body: 'Recibirás alertas cuando te envíen un Regalo, un Match o un mensaje nuevo.',
    tag: 'conoscamosnos-welcome-push',
    forceWhenVisible: true,
  });

  return { enabled: true, fcmToken: Boolean(fcmToken) };
}

export async function disablePushNotifications(uid) {
  if (!uid || !db) return;
  await updateDoc(doc(db, 'users', uid), {
    pushNotificationsEnabled: false,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Despacha en segundo plano una notificación Push Web (FCM) al destinatario vía `/api/notifications/send`.
 * Nunca bloquea la acción principal si el usuario destinatario no tiene tokens registrados.
 */
export async function sendPushNotificationToUser({
  recipientUid,
  type = 'message',
  title = 'Conoscamosnos',
  body = '',
  link = '/app',
}) {
  if (!recipientUid || !auth?.currentUser || auth.currentUser.uid === recipientUid) {
    return;
  }
  try {
    const idToken = await auth.currentUser.getIdToken();
    await fetch('/api/notifications/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        recipientUid,
        type,
        title,
        body,
        link,
      }),
    });
  } catch {
    // Silencioso para no interrumpir el flujo de chat/regalos/matches
  }
}
