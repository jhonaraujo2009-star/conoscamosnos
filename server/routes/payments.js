import { Router } from 'express';
import { verifyPaymentSignatureMiddleware } from '../middleware/verifyPaymentSignature.js';
import { paymentWebhookExpressHandler } from '../controllers/paymentWebhookController.js';

const router = Router();

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
