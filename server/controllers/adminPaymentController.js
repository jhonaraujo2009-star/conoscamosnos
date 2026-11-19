import { FieldValue, getAdminAuth, getAdminFirestore } from '../config/firebaseAdmin.js';

const SUPER_ADMIN_EMAILS = new Set(['jhonaraujo2009@gmail.com']);

const DEFAULT_DIAMOND_PACKAGES = [
  { id: 'pack_100', diamonds: 100, priceUSD: 1.99, label: 'Inicio' },
  { id: 'pack_550', diamonds: 550, priceUSD: 7.99, label: 'Popular' },
  { id: 'pack_1200', diamonds: 1200, priceUSD: 14.99, label: 'VIP Pro' },
  { id: 'pack_3000', diamonds: 3000, priceUSD: 29.99, label: 'Elite Global' },
];

const DEFAULT_PRO_PLANS = [
  {
    id: 'pro_weekly',
    title: 'Conoscamosnos PRO · 7 Días',
    shortLabel: 'PRO Semanal',
    durationDays: 7,
    priceUSD: 4.99,
    priceDiamonds: 250,
  },
  {
    id: 'pro_monthly',
    title: 'Conoscamosnos PRO · 30 Días',
    shortLabel: 'PRO Mensual',
    durationDays: 30,
    priceUSD: 12.99,
    priceDiamonds: 600,
  },
];

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function toMillisServer(value) {
  if (!value) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (value?.seconds) return value.seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Super Admin: aprueba de forma autoritativa y atómica una recarga manual (Diamantes o Membresía PRO)
 * validando el catálogo oficial de appConfig/economy y consolidando saldos legacy en el usuario destino.
 */
export async function approveManualPaymentRequest({ authHeader = '', requestId = '' }) {
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
    console.error('[Admin Approve Payment] Error inicializando Firebase Admin:', err);
    return {
      statusCode: 500,
      body: { ok: false, error: 'Error de configuración del servidor (Firebase Admin SDK).' },
    };
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(bearerMatch[1]);
  } catch (err) {
    console.error('[Admin Approve Payment] Error verificando token:', err);
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
        body: { ok: false, error: 'Acceso denegado: solo el Super Admin puede aprobar pagos.' },
      };
    }

    const cleanId = String(requestId || '').trim();
    if (!cleanId || cleanId.includes('/') || cleanId.length > 200) {
      return {
        statusCode: 400,
        body: { ok: false, error: 'Identificador de solicitud de pago inválido.' },
      };
    }

    const reqRef = db.collection('paymentRequests').doc(cleanId);
    const economyRef = db.collection('appConfig').doc('economy');

    const outcome = await db.runTransaction(async (transaction) => {
      const [reqSnap, economySnap] = await Promise.all([
        transaction.get(reqRef),
        transaction.get(economyRef),
      ]);

      if (!reqSnap.exists) {
        throw new HttpError(404, 'La solicitud de pago no existe.');
      }

      const reqData = reqSnap.data() || {};
      if (reqData.status !== 'pending') {
        throw new HttpError(409, 'Esta solicitud ya fue procesada anteriormente.');
      }

      const targetUserId = String(reqData.userId || '').trim();
      if (!targetUserId) {
        throw new HttpError(400, 'La solicitud no tiene usuario destinatario válido.');
      }

      const userRef = db.collection('users').doc(targetUserId);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) {
        throw new HttpError(404, 'El usuario destinatario no existe.');
      }

      const userData = userSnap.data() || {};
      const economyData = economySnap.exists ? economySnap.data() || {} : {};

      if (reqData.creditTarget === 'pro') {
        if (!reqData.proofUrl || !String(reqData.referenceNumber || '').trim()) {
          throw new HttpError(
            400,
            'La solicitud PRO debe incluir comprobante y número de referencia válidos.'
          );
        }

        const proPlans =
          Array.isArray(economyData.proPlans) && economyData.proPlans.length > 0
            ? economyData.proPlans
            : DEFAULT_PRO_PLANS;
        const officialPlan = proPlans.find((p) => p.id === reqData.packageId);
        if (!officialPlan) {
          throw new HttpError(400, 'El plan PRO de esta solicitud no es válido.');
        }

        if (Number(reqData.amountUSD || 0) + 0.05 < Number(officialPlan.priceUSD || 0)) {
          throw new HttpError(
            400,
            `El monto del comprobante (${reqData.amountUSD} USD) es inferior al precio oficial del plan (${officialPlan.priceUSD} USD).`
          );
        }

        const durationDays = Math.max(
          1,
          Math.min(365, Math.floor(Number(officialPlan.durationDays || 7)))
        );
        const existingMs = toMillisServer(userData.proExpiresAt);
        const nowMs = Date.now();
        const baseMs = existingMs > nowMs ? existingMs : nowMs;
        const newExpiryMs = baseMs + durationDays * 24 * 60 * 60 * 1000;

        transaction.update(userRef, {
          isPro: true,
          proPlanId: officialPlan.id,
          proExpiresAt: new Date(newExpiryMs),
          proPaymentSource: 'manual_verified',
          proLastPaymentId: cleanId,
          updatedAt: FieldValue.serverTimestamp(),
        });

        transaction.update(reqRef, {
          status: 'approved',
          creditedProDays: durationDays,
          creditedAt: FieldValue.serverTimestamp(),
          reviewedBy: decoded.uid,
          reviewedAt: FieldValue.serverTimestamp(),
        });

        return {
          creditTarget: 'pro',
          durationDays,
          newProExpiryMs: newExpiryMs,
        };
      }

      const packages =
        Array.isArray(economyData.diamondPackages) && economyData.diamondPackages.length > 0
          ? economyData.diamondPackages
          : Array.isArray(economyData.coinPackages) && economyData.coinPackages.length > 0
          ? economyData.coinPackages
          : DEFAULT_DIAMOND_PACKAGES;

      const officialPkg = packages.find((p) => p.id === reqData.packageId) || null;
      const unitsToCredit = officialPkg
        ? Math.floor(Number(officialPkg.diamonds ?? officialPkg.coins ?? 0))
        : Math.floor(Number(reqData.diamondsToCredit ?? reqData.coinsToCredit ?? 0));

      if (!Number.isFinite(unitsToCredit) || unitsToCredit <= 0) {
        throw new HttpError(
          400,
          'Cantidad de diamantes a acreditar inválida (0). No se aprobó la solicitud.'
        );
      }

      const currDiamonds = Math.max(0, Math.floor(Number(userData.diamonds || 0)));
      const currCoins = Math.max(0, Math.floor(Number(userData.coins || 0)));
      const newDiamondsBalance = currDiamonds + currCoins + unitsToCredit;

      const userUpdate = {
        diamonds: newDiamondsBalance,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (currCoins > 0) {
        userUpdate.coins = 0;
      }

      transaction.update(userRef, userUpdate);
      transaction.update(reqRef, {
        status: 'approved',
        creditedDiamonds: unitsToCredit,
        creditedAt: FieldValue.serverTimestamp(),
        reviewedBy: decoded.uid,
        reviewedAt: FieldValue.serverTimestamp(),
      });

      return {
        creditTarget: 'diamonds',
        unitsCredited: unitsToCredit,
        newDiamondsBalance,
      };
    });

    return {
      statusCode: 200,
      body: {
        ok: true,
        requestId: cleanId,
        ...outcome,
      },
    };
  } catch (err) {
    if (err instanceof HttpError) {
      return {
        statusCode: err.statusCode,
        body: { ok: false, error: err.message },
      };
    }
    console.error('[Admin Approve Payment] Error aprobando pago:', err);
    return {
      statusCode: 500,
      body: {
        ok: false,
        error: err?.message || 'Error interno aprobando la solicitud de pago.',
      },
    };
  }
}

export async function approvePaymentExpressHandler(req, res) {
  try {
    const result = await approveManualPaymentRequest({
      authHeader: req.headers.authorization || '',
      requestId: req.body?.requestId,
    });
    return res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error('[Admin Approve Payment Express] Error fatal:', err);
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Error interno aprobando la solicitud de pago.',
    });
  }
}
