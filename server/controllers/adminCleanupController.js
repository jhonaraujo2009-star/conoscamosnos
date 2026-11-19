import { getAdminAuth, getAdminFirestore } from '../config/firebaseAdmin.js';

const SUPER_ADMIN_EMAILS = new Set(['jhonaraujo2009@gmail.com']);

const ALLOWED_COLLECTIONS = new Set([
  'paymentRequests',
  'paymentTransactions',
  'withdrawalRequests',
  'adImpressions',
  'giftTransactions',
  'storeActivations',
]);

function toMillisServer(value) {
  if (!value) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (value?.seconds) return value.seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getRecordTimestampMs(collectionName, data) {
  if (collectionName === 'paymentRequests') {
    return toMillisServer(data?.reviewedAt) || toMillisServer(data?.createdAt);
  }
  if (collectionName === 'withdrawalRequests') {
    return toMillisServer(data?.paidAt) || toMillisServer(data?.createdAt);
  }
  return toMillisServer(data?.createdAt);
}

async function deleteDocsInChunks(db, docRefs, chunkSize = 400) {
  if (!Array.isArray(docRefs) || docRefs.length === 0) return 0;
  let deleted = 0;
  for (let i = 0; i < docRefs.length; i += chunkSize) {
    const slice = docRefs.slice(i, i + chunkSize);
    const batch = db.batch();
    slice.forEach((ref) => batch.delete(ref));
    await batch.commit();
    deleted += slice.length;
  }
  return deleted;
}

/**
 * Super Admin: elimina solicitudes de recarga manual o limpia registros financieros/de prueba por día o histórico.
 */
export async function handleAdminCleanup({
  authHeader = '',
  action = '',
  requestId = '',
  mode = '',
  ranges = [],
  collections = [],
}) {
  const bearerMatch = String(authHeader || '').match(/^Bearer\s+(.+)$/i);
  if (!bearerMatch?.[1]) {
    return {
      statusCode: 401,
      body: { ok: false, error: 'Se requiere sesión autenticada de Super Admin.' },
    };
  }

  let db;
  let adminAuth;
  try {
    db = getAdminFirestore();
    adminAuth = getAdminAuth();
  } catch (err) {
    console.error('[Admin Cleanup] Error inicializando Firebase Admin:', err);
    return {
      statusCode: 500,
      body: { ok: false, error: 'Error de configuración del servidor (Firebase Admin SDK).' },
    };
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(bearerMatch[1]);
  } catch (err) {
    console.error('[Admin Cleanup] Error verificando token:', err);
    return {
      statusCode: 401,
      body: { ok: false, error: 'Tu sesión expiró o es inválida.' },
    };
  }

  try {
    const email = String(decoded.email || '').trim().toLowerCase();
    const isSuperEmail = SUPER_ADMIN_EMAILS.has(email) && decoded.email_verified === true;
    let isRoleAdmin = false;

    if (!isSuperEmail) {
      const adminSnap = await db.collection('users').doc(decoded.uid).get();
      const role = adminSnap.exists ? adminSnap.data()?.role : '';
      isRoleAdmin = role === 'SUPER_ADMIN' || role === 'admin';
    }

    if (!isSuperEmail && !isRoleAdmin) {
      return {
        statusCode: 403,
        body: { ok: false, error: 'Acceso denegado: solo el Super Admin puede ejecutar limpiezas.' },
      };
    }

    const normalizedAction = String(action || '').trim();

    if (normalizedAction === 'delete_payment_request') {
      const cleanId = String(requestId || '').trim();
      if (!cleanId || cleanId.includes('/') || cleanId.length > 200) {
        return {
          statusCode: 400,
          body: { ok: false, error: 'Identificador de recarga manual inválido.' },
        };
      }

      const ref = db.collection('paymentRequests').doc(cleanId);
      const snap = await ref.get();
      if (snap.exists) {
        await ref.delete();
      }

      return {
        statusCode: 200,
        body: {
          ok: true,
          action: 'delete_payment_request',
          requestId: cleanId,
          deleted: snap.exists ? 1 : 0,
        },
      };
    }

    if (normalizedAction === 'purge_revenue') {
      const targetCollections = [
        ...new Set(
          (Array.isArray(collections) ? collections : []).map((c) => String(c || '').trim())
        ),
      ].filter((c) => ALLOWED_COLLECTIONS.has(c));

      if (targetCollections.length === 0) {
        return {
          statusCode: 400,
          body: { ok: false, error: 'Selecciona al menos una categoría válida para limpiar.' },
        };
      }

      const normalizedMode = String(mode || '').trim();
      if (normalizedMode !== 'all' && normalizedMode !== 'ranges') {
        return {
          statusCode: 400,
          body: { ok: false, error: 'Modo de limpieza inválido.' },
        };
      }

      let cleanRanges = [];
      if (normalizedMode === 'ranges') {
        if (!Array.isArray(ranges) || ranges.length === 0 || ranges.length > 366) {
          return {
            statusCode: 400,
            body: { ok: false, error: 'Selecciona al menos un día o rango de fechas válido.' },
          };
        }
        cleanRanges = ranges.map((r) => ({
          startMs: Number(r?.startMs),
          endMs: Number(r?.endMs),
        }));
        const allValid = cleanRanges.every(
          (r) =>
            Number.isFinite(r.startMs) &&
            Number.isFinite(r.endMs) &&
            r.startMs > 0 &&
            r.endMs >= r.startMs
        );
        if (!allValid) {
          return {
            statusCode: 400,
            body: { ok: false, error: 'Rango de fechas inválido para limpieza.' },
          };
        }
      }

      const deletedByCollection = {};
      let totalDeleted = 0;

      for (const colName of targetCollections) {
        const snap = await db.collection(colName).get();
        const refsToDelete = [];

        snap.docs.forEach((docSnap) => {
          if (normalizedMode === 'all') {
            refsToDelete.push(docSnap.ref);
            return;
          }
          const ts = getRecordTimestampMs(colName, docSnap.data());
          if (ts > 0 && cleanRanges.some((r) => ts >= r.startMs && ts <= r.endMs)) {
            refsToDelete.push(docSnap.ref);
          }
        });

        const count = await deleteDocsInChunks(db, refsToDelete);
        deletedByCollection[colName] = count;
        totalDeleted += count;
      }

      return {
        statusCode: 200,
        body: {
          ok: true,
          action: 'purge_revenue',
          mode: normalizedMode,
          totalDeleted,
          deletedByCollection,
        },
      };
    }

    return {
      statusCode: 400,
      body: { ok: false, error: 'Acción administrativa inválida.' },
    };
  } catch (err) {
    console.error('[Admin Cleanup] Error ejecutando limpieza:', err);
    return {
      statusCode: 500,
      body: {
        ok: false,
        error: err?.message || 'Error interno ejecutando limpieza administrativa.',
      },
    };
  }
}

export async function adminCleanupExpressHandler(req, res) {
  try {
    const result = await handleAdminCleanup({
      authHeader: req.headers.authorization || '',
      action: req.body?.action,
      requestId: req.body?.requestId,
      mode: req.body?.mode,
      ranges: req.body?.ranges,
      collections: req.body?.collections,
    });
    return res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error('[Admin Cleanup Express] Error fatal:', err);
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Error interno ejecutando limpieza administrativa.',
    });
  }
}
