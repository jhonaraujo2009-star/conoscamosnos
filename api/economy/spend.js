import { processEconomySpend } from '../../server/controllers/economySpendController.js';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await processEconomySpend({
      authHeader: request.headers.get('authorization') || '',
      action: body?.action,
      payload: body || {},
    });

    return Response.json(result.body, { status: result.statusCode });
  } catch (err) {
    console.error('[Vercel Economy Spend] Error fatal:', err);
    return Response.json(
      { ok: false, error: err?.message || 'Error interno procesando la operación económica.' },
      { status: 500 }
    );
  }
}
