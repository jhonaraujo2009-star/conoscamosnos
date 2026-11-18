import { activateStorePlan } from '../../server/controllers/storeActivationController.js';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await activateStorePlan({
      authHeader: request.headers.get('authorization') || '',
      kind: body?.kind,
      planId: body?.planId,
    });

    return Response.json(result.body, { status: result.statusCode });
  } catch (err) {
    console.error('[Vercel Store Activate] Error fatal:', err);
    return Response.json(
      { ok: false, error: err?.message || 'Error interno activando el plan.' },
      { status: 500 }
    );
  }
}
