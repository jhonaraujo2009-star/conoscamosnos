import { handleAdminBulkProfiles } from '../../server/controllers/adminBulkProfilesController.js';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await handleAdminBulkProfiles({
      authHeader: request.headers.get('authorization') || '',
      action: body?.action,
      profiles: body?.profiles,
      batchId: body?.batchId,
      uids: body?.uids,
      mode: body?.mode,
    });

    return Response.json(result.body, { status: result.statusCode });
  } catch (err) {
    console.error('[Vercel Admin BulkProfiles] Error fatal:', err);
    return Response.json(
      { ok: false, error: err?.message || 'Error interno procesando perfiles masivos.' },
      { status: 500 }
    );
  }
}
