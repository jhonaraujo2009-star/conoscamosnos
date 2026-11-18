import { Router } from 'express';
import { verifyPaymentSignatureMiddleware } from '../middleware/verifyPaymentSignature.js';
import { paymentWebhookExpressHandler } from '../controllers/paymentWebhookController.js';

const router = Router();

/**
 * POST /api/webhooks/payments
 * Recibe callbacks firmados de NowPayments (JSON) y Payeer (x-www-form-urlencoded / JSON).
 */
router.post(
  '/payments',
  verifyPaymentSignatureMiddleware,
  paymentWebhookExpressHandler
);

export default router;
