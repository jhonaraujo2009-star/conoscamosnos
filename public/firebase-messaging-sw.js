/* Service Worker oficial de Notificaciones Push Web (FCM & Web Push API) — Conoscamosnos */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      notification: {
        title: 'Conoscamosnos',
        body: event.data ? event.data.text() : 'Tienes una nueva notificación.',
      },
    };
  }

  const notif = payload.notification || {};
  const data = payload.data || {};
  const title = notif.title || data.title || 'Conoscamosnos';
  const body = notif.body || data.body || 'Tienes un nuevo mensaje, regalo o Match.';
  const icon = notif.icon || '/icons/icon-192.png';
  const badge = notif.badge || '/icons/icon-192.png';
  const tag = notif.tag || data.tag || 'conoscamosnos-push';
  const targetUrl =
    payload.fcmOptions?.link || data.url || notif.click_action || '/app';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      renotify: true,
      vibrate: [180, 80, 180],
      data: { url: targetUrl },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/app';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return null;
      })
  );
});
