import { FieldValue, getAdminAuth, getAdminFirestore } from '../config/firebaseAdmin.js';

const SUPER_ADMIN_EMAILS = new Set(['jhonaraujo2009@gmail.com']);
const MAX_BATCH_PROFILES = 150;

function sanitizeHttpUrl(raw) {
  const val = String(raw || '').trim();
  return /^https:\/\/[^\s]+$/i.test(val) ? val : '';
}

function sanitizeBulkProfile(raw, { batchId, adminUid }) {
  const photoUrl = sanitizeHttpUrl(raw?.photoUrl || raw?.photos?.[0]);
  if (!photoUrl) return null;

  const cleanName = String(raw?.name || 'Usuario').trim().slice(0, 45) || 'Usuario';
  const cleanAge = Math.max(18, Math.min(75, Math.floor(Number(raw?.age) || 24)));
  const cleanGender =
    raw?.gender === 'Hombre' || raw?.gender === 'Mujer' || raw?.gender === 'No binario'
      ? raw.gender
      : 'Mujer';
  const cleanInterestedIn =
    raw?.interestedIn === 'Mujeres' || raw?.interestedIn === 'Hombres' || raw?.interestedIn === 'Todos'
      ? raw.interestedIn
      : 'Todos';

  const countryCode = String(raw?.country?.code || 'CO').trim().toUpperCase().slice(0, 4);
  const countryName = String(raw?.country?.name || 'Colombia').trim().slice(0, 45);
  const countryFlag = String(raw?.country?.flag || '🌎').trim().slice(0, 8);
  const cleanCity = String(raw?.city || '').trim().slice(0, 60);

  const rawLat = Number(raw?.approxGeo?.lat);
  const rawLng = Number(raw?.approxGeo?.lng);
  const approxGeo =
    Number.isFinite(rawLat) && Number.isFinite(rawLng)
      ? { lat: Number(rawLat.toFixed(5)), lng: Number(rawLng.toFixed(5)) }
      : null;

  const interests = Array.isArray(raw?.interests)
    ? raw.interests.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 6)
    : [];
  const prompts = Array.isArray(raw?.prompts)
    ? [String(raw.prompts[0] || '').trim().slice(0, 220), String(raw.prompts[1] || '').trim().slice(0, 220)]
    : ['', ''];

  const allowPaidMessages = Boolean(raw?.allowPaidMessages);
  const messagePriceDiamonds = Math.max(
    5,
    Math.min(5000, Math.floor(Number(raw?.messagePriceDiamonds) || 25))
  );

  return {
    name: cleanName,
    age: cleanAge,
    gender: cleanGender,
    interestedIn: cleanInterestedIn,
    country: { code: countryCode, name: countryName, flag: countryFlag },
    city: cleanCity,
    ...(approxGeo ? { approxGeo } : {}),
    job: String(raw?.job || '').trim().slice(0, 60),
    lifestyle: String(raw?.lifestyle || '').trim().slice(0, 60),
    bio: String(raw?.bio || '').trim().slice(0, 500),
    lookingFor: String(raw?.lookingFor || 'Hacer Amigos').trim().slice(0, 50),
    interests,
    prompts,
    photos: [photoUrl],
    isVerified: Boolean(raw?.isVerified),
    isOnline: Boolean(raw?.isOnline),
    allowPaidMessages,
    messagePriceDiamonds,
    onboardingCompleted: true,
    createdByAdminBulk: true,
    bulkBatchId: batchId,
    createdByAdminUid: adminUid,
    role: 'user',
    isBanned: false,
    diamonds: 0,
    coins: 0,
    earningsDiamonds: 0,
    likesCount: 0,
    giftsReceivedCount: 0,
    blockedUsers: [],
    createdAt: FieldValue.serverTimestamp(),
    lastSeen: FieldValue.serverTimestamp(),
  };
}

async function deleteDocsInChunks(db, docRefs, chunkSize = 400) {
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
 * Super Admin: creación masiva de perfiles a partir de fotos subidas y eliminación segura
 * limitada exclusivamente a documentos marcados con `createdByAdminBulk === true`.
 */
export async function handleAdminBulkProfiles({
  authHeader = '',
  action = '',
  profiles = [],
  batchId = '',
  uids = [],
  mode = '',
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
    console.error('[Admin BulkProfiles] Error inicializando Firebase Admin:', err);
    return {
      statusCode: 500,
      body: { ok: false, error: 'Error de configuración del servidor (Firebase Admin SDK).' },
    };
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(bearerMatch[1]);
  } catch {
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
      const role = adminSnap.data()?.role;
      isRoleAdmin = role === 'SUPER_ADMIN' || role === 'admin';
    }

    if (!isSuperEmail && !isRoleAdmin) {
      return {
        statusCode: 403,
        body: { ok: false, error: 'Solo el Super Admin autorizado puede gestionar perfiles masivos.' },
      };
    }

    if (action === 'create_bulk_profiles') {
      if (!Array.isArray(profiles) || profiles.length === 0) {
        return {
          statusCode: 400,
          body: { ok: false, error: 'Envía al menos 1 perfil con foto válida.' },
        };
      }
      if (profiles.length > MAX_BATCH_PROFILES) {
        return {
          statusCode: 400,
          body: { ok: false, error: `Máximo ${MAX_BATCH_PROFILES} perfiles por solicitud.` },
        };
      }

      const cleanBatchId =
        String(batchId || `bulk_${Date.now()}`).trim().slice(0, 64) || `bulk_${Date.now()}`;
      const sanitizedList = profiles
        .map((p) => sanitizeBulkProfile(p, { batchId: cleanBatchId, adminUid: decoded.uid }))
        .filter(Boolean);

      if (sanitizedList.length === 0) {
        return {
          statusCode: 400,
          body: { ok: false, error: 'Ningún perfil tenía una URL HTTPS de foto válida.' },
        };
      }

      const createdIds = [];
      for (let i = 0; i < sanitizedList.length; i += 400) {
        const chunk = sanitizedList.slice(i, i + 400);
        const batch = db.batch();
        chunk.forEach((docData) => {
          const ref = db.collection('users').doc();
          createdIds.push(ref.id);
          batch.set(ref, { ...docData, uid: ref.id });
        });
        await batch.commit();
      }

      return {
        statusCode: 200,
        body: {
          ok: true,
          createdCount: createdIds.length,
          createdIds,
          batchId: cleanBatchId,
        },
      };
    }

    if (action === 'delete_bulk_profiles') {
      const refsToDelete = [];

      if (mode === 'all_bulk') {
        const snap = await db.collection('users').where('createdByAdminBulk', '==', true).get();
        snap.docs.forEach((d) => {
          if (d.data()?.createdByAdminBulk === true) {
            refsToDelete.push(d.ref);
          }
        });
      } else {
        const cleanUids = Array.isArray(uids)
          ? Array.from(new Set(uids.map((u) => String(u || '').trim()).filter(Boolean))).slice(0, 400)
          : [];
        if (cleanUids.length === 0) {
          return {
            statusCode: 400,
            body: { ok: false, error: 'Selecciona al menos 1 perfil generado masivamente.' },
          };
        }
        const docRefs = cleanUids.map((id) => db.collection('users').doc(id));
        const snaps = await db.getAll(...docRefs);
        snaps.forEach((s) => {
          // Seguridad estricta: jamás borrar cuentas reales de usuarios
          if (s.exists && s.data()?.createdByAdminBulk === true) {
            refsToDelete.push(s.ref);
          }
        });
      }

      const deletedCount = await deleteDocsInChunks(db, refsToDelete);
      return {
        statusCode: 200,
        body: {
          ok: true,
          deletedCount,
        },
      };
    }

    return {
      statusCode: 400,
      body: { ok: false, error: 'Acción administrativa inválida.' },
    };
  } catch (err) {
    console.error('[Admin BulkProfiles] Error interno:', err);
    return {
      statusCode: 500,
      body: {
        ok: false,
        error: err?.message || 'Error interno procesando perfiles masivos.',
      },
    };
  }
}

export async function adminBulkProfilesExpressHandler(req, res) {
  try {
    const result = await handleAdminBulkProfiles({
      authHeader: req.headers.authorization || '',
      action: req.body?.action,
      profiles: req.body?.profiles,
      batchId: req.body?.batchId,
      uids: req.body?.uids,
      mode: req.body?.mode,
    });
    return res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error('[Admin BulkProfiles Express] Error fatal:', err);
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Error interno procesando perfiles masivos.',
    });
  }
}
