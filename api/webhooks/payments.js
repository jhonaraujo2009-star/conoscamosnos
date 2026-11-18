import { verifyWebhookSignature } from '../../server/middleware/verifyPaymentSignature.js';
import { processVerifiedPaymentWebhook } from '../../server/controllers/paymentWebhookController.js';

/**
 * Parseo seguro para callbacks JSON de NowPayments.
 */
async function parseWebhookBody(request) {
  const rawText = await request.text();
  if (!rawText) return {};

  try {
    return JSON.parse(rawText);
  } catch {
    return {};
  }
}

export async function GET() {
  return Response.json(
    {
      ok: true,
      endpoint: '/api/webhooks/payments',
      providers: ['nowpayments'],
    },
    { status: 200 }
  );
}

/**
 * Vercel Serverless Function (Node.js Runtime) — POST /api/webhooks/payments
 * Recibe callbacks IPN de NowPayments, valida la firma HMAC-SHA512 y acredita saldo atómicamente en Firestore.
 */
export async function POST(request) {
  try {
    const payload = await parseWebhookBody(request);
    const headers = Object.fromEntries(request.headers.entries());

    // 1. Middleware / Verificación criptográfica estricta antes de tocar Firestore
    const verification = verifyWebhookSignature({ headers, payload });
    if (!verification.valid) {
      console.error('[Vercel Webhook] Firma inválida rechazada:', verification.reason);
      return Response.json({ ok: false, error: verification.reason }, { status: 401 });
    }

    // 2. Acreditación atómica e idempotente en Firestore Admin SDK
    const result = await processVerifiedPaymentWebhook({ payload });

    return Response.json(result.body, { status: result.statusCode });
  } catch (err) {
    console.error('[Vercel Webhook] Error fatal procesando pago:', err);
    return Response.json(
      { ok: false, error: err?.message || 'Error interno procesando el webhook.' },
      { status: 500 }
    );
  }
}
