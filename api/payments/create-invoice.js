import { createNowPaymentsInvoice } from '../../server/controllers/createInvoiceController.js';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const url = new URL(request.url);
    const forwardedProto = request.headers.get('x-forwarded-proto');
    const forwardedHost = request.headers.get('x-forwarded-host');
    const origin =
      forwardedProto && forwardedHost
        ? `${forwardedProto}://${forwardedHost}`
        : `${url.protocol}//${url.host}`;

    const result = await createNowPaymentsInvoice({
      authHeader: request.headers.get('authorization') || '',
      packageId: body?.packageId,
      creditTarget: body?.creditTarget,
      origin,
    });

    return Response.json(result.body, { status: result.statusCode });
  } catch (err) {
    console.error('[Vercel Create Invoice] Error fatal:', err);
    return Response.json(
      { ok: false, error: err?.message || 'Error interno al crear la factura de NowPayments.' },
      { status: 500 }
    );
  }
}
