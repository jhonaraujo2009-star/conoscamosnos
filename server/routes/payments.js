import { Router } from 'express';
import { verifyPaymentSignatureMiddleware } from '../middleware/verifyPaymentSignature.js';
import { paymentWebhookExpressHandler } from '../controllers/paymentWebhookController.js';

const router = Router();

router.get('/payments', (_req, res) => {
  const hasFirebaseAdmin = Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      (process.env.FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_CLIENT_EMAIL &&
        process.env.FIREBASE_PRIVATE_KEY)
  );
  const hasApiKey = Boolean(process.env.NOWPAYMENTS_API_KEY);
  const hasIpnSecret = Boolean(process.env.NOWPAYMENTS_IPN_SECRET);

  res.status(200).json({
    ok: true,
    endpoint: '/api/webhooks/payments',
    providers: ['nowpayments'],
    configured: {
      apiKey: hasApiKey,
      ipnSecret: hasIpnSecret,
      firebaseAdmin: hasFirebaseAdmin,
      ready: hasApiKey && hasIpnSecret && hasFirebaseAdmin,
    },
  });
});

/**
 * POST /api/webhooks/payments
 * Recibe callbacks firmados IPN de NowPayments (JSON con firma HMAC-SHA512).
 */
router.post(
  '/payments',
  verifyPaymentSignatureMiddleware,
  paymentWebhookExpressHandler
);

export default router;
