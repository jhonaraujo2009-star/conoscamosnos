import { handleAdminCleanup } from '../../server/controllers/adminCleanupController.js';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await handleAdminCleanup({
      authHeader: request.headers.get('authorization') || '',
      action: body?.action,
      requestId: body?.requestId,
      mode: body?.mode,
      ranges: body?.ranges,
      collections: body?.collections,
    });

    return Response.json(result.body, { status: result.statusCode });
  } catch (err) {
    console.error('[Vercel Admin Cleanup] Error fatal:', err);
    return Response.json(
      { ok: false, error: err?.message || 'Error interno ejecutando limpieza administrativa.' },
      { status: 500 }
    );
  }
}
