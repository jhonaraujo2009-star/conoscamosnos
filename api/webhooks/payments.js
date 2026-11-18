import { verifyWebhookSignature } from '../../server/middleware/verifyPaymentSignature.js';
import { processVerifiedPaymentWebhook } from '../../server/controllers/paymentWebhookController.js';

/**
 * Parseo seguro para NowPayments (application/json) y Payeer (application/x-www-form-urlencoded).
 */
async function parseWebhookBody(request) {
  const contentType = (request.headers.get('content-type') || '').toLowerCase();
  const rawText = await request.text();
  if (!rawText) return {};

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(rawText);
    return Object.fromEntries(params.entries());
  }

  try {
    return JSON.parse(rawText);
  } catch {
    const params = new URLSearchParams(rawText);
    return Object.fromEntries(params.entries());
  }
}

export async function GET() {
  return Response.json(
    {
      ok: true,
      endpoint: '/api/webhooks/payments',
      providers: ['nowpayments', 'payeer'],
    },
    { status: 200 }
  );
}

/**
 * Vercel Serverless Function (Node.js Runtime) — POST /api/webhooks/payments
 * Recibe callbacks de NowPayments / Payeer, valida firma criptográfica y acredita saldo atómicamente en Firestore.
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
    const result = await processVerifiedPaymentWebhook({
      provider: verification.provider,
      payload,
    });

    if (result.textResponse) {
      return new Response(result.textResponse, {
        status: result.statusCode,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    return Response.json(result.body, { status: result.statusCode });
  } catch (err) {
    console.error('[Vercel Webhook] Error fatal procesando pago:', err);
    return Response.json(
      { ok: false, error: err?.message || 'Error interno procesando el webhook.' },
      { status: 500 }
    );
  }
}
