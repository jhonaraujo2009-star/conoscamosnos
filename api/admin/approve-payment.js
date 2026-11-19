import { approveManualPaymentRequest } from '../../server/controllers/adminPaymentController.js';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await approveManualPaymentRequest({
      authHeader: request.headers.get('authorization') || '',
      requestId: body?.requestId,
    });

    return Response.json(result.body, { status: result.statusCode });
  } catch (err) {
    console.error('[Vercel Admin Approve Payment] Error fatal:', err);
    return Response.json(
      { ok: false, error: err?.message || 'Error interno aprobando la solicitud de pago.' },
      { status: 500 }
    );
  }
}
