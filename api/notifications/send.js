import { sendPushNotification } from '../../server/controllers/pushNotificationController.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      endpoint: '/api/notifications/send',
      service: 'fcm-web-push',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const body =
    typeof req.body === 'string'
      ? JSON.parse(req.body || '{}')
      : req.body || {};

  const result = await sendPushNotification({
    authHeader: req.headers.authorization || '',
    recipientUid: body.recipientUid,
    type: body.type,
    title: body.title,
    body: body.body,
    link: body.link,
  });

  return res.status(result.statusCode).json(result.body);
}
