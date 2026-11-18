import { FieldValue, getAdminAuth, getAdminFirestore } from '../config/firebaseAdmin.js';

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

const DEFAULT_BOOST_PLANS = [
  {
    id: 'boost_24h',
    durationHours: 24,
    costDiamonds: 50,
    title: 'Boost Express 24h',
  },
  {
    id: 'boost_7d',
    durationHours: 24 * 7,
    costDiamonds: 200,
    title: 'Boost VIP Semanal (7 días)',
  },
];

function toMillisServer(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (value?.seconds) return value.seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

/**
 * Activa o extiende Conoscamosnos PRO o Boost VIP de forma autoritativa en el servidor
 * descontando Diamantes (y consolidando cualquier saldo legacy) dentro de una transacción atómica.
 */
export async function activateStorePlan({
  authHeader = '',
  kind = '',
  planId = '',
}) {
  const bearerMatch = String(authHeader || '').match(/^Bearer\s+(.+)$/i);
  if (!bearerMatch?.[1]) {
    return {
      statusCode: 401,
      body: { ok: false, error: 'Se requiere sesión autenticada (Bearer token) para activar un plan.' },
    };
  }

  const normalizedKind = String(kind || '').trim().toLowerCase();
  const normalizedPlanId = String(planId || '').trim();
  if ((normalizedKind !== 'pro' && normalizedKind !== 'boost') || !normalizedPlanId) {
    return {
      statusCode: 400,
      body: { ok: false, error: 'Tipo de plan o identificador inválido.' },
    };
  }

  let db;
  let uid = '';
  let economyCfg = {};

  try {
    db = getAdminFirestore();
    const decoded = await getAdminAuth().verifyIdToken(bearerMatch[1]);
    uid = decoded.uid;

    const cfgSnap = await db.collection('appConfig').doc('economy').get();
    if (cfgSnap.exists) {
      economyCfg = cfgSnap.data() || {};
    }
  } catch (err) {
    console.error('[Store Activate] Error verificando Firebase Admin/Token:', err);
    return {
      statusCode: 401,
      body: {
        ok: false,
        error: 'No se pudo validar tu sesión en el servidor.',
      },
    };
  }

  const catalog =
    normalizedKind === 'pro'
      ? Array.isArray(economyCfg?.proPlans) && economyCfg.proPlans.length > 0
        ? economyCfg.proPlans
        : DEFAULT_PRO_PLANS
      : Array.isArray(economyCfg?.boostPlans) && economyCfg.boostPlans.length > 0
      ? economyCfg.boostPlans
      : DEFAULT_BOOST_PLANS;

  const plan = catalog.find((p) => p.id === normalizedPlanId);
  if (!plan) {
    return {
      statusCode: 400,
      body: {
        ok: false,
        error: normalizedKind === 'pro' ? 'Plan Conoscamosnos PRO inválido.' : 'Plan Boost VIP inválido.',
      },
    };
  }

  const costDiamonds =
    normalizedKind === 'pro'
      ? Math.max(10, Math.floor(Number(plan.priceDiamonds || 250)))
      : Math.max(10, Math.floor(Number(plan.costDiamonds ?? plan.costCoins ?? 50)));
  const durationDays =
    normalizedKind === 'pro'
      ? Math.max(1, Math.min(365, Math.floor(Number(plan.durationDays || 7))))
      : 0;
  const durationHours =
    normalizedKind === 'boost'
      ? Math.max(1, Math.min(24 * 30, Math.floor(Number(plan.durationHours || 24))))
      : 0;

  const userRef = db.collection('users').doc(uid);
  const activationRef = db.collection('storeActivations').doc();

  try {
    const result = await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) {
        throw new HttpError(404, 'Perfil de usuario no encontrado.');
      }

      const userData = userSnap.data() || {};
      if (userData.isBanned === true || userData.accountStatus === 'banned') {
        throw new HttpError(403, 'Tu cuenta está suspendida y no puede activar planes.');
      }

      const currDiamonds = Math.max(0, Math.floor(Number(userData.diamonds || 0)));
      const currCoins = Math.max(0, Math.floor(Number(userData.coins || 0)));
      const totalSpendable = currDiamonds + currCoins;

      if (totalSpendable < costDiamonds) {
        throw new HttpError(
          400,
          normalizedKind === 'pro'
            ? `Necesitas ${costDiamonds} 💎 para activar ${plan.shortLabel || 'Conoscamosnos PRO'}.`
            : `Necesitas ${costDiamonds} 💎 para activar este Boost VIP.`
        );
      }

      const remainingDiamonds = totalSpendable - costDiamonds;
      const nowMs = Date.now();
      let newExpiryMs = nowMs;

      const userUpdate = {
        diamonds: remainingDiamonds,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (currCoins > 0) {
        userUpdate.coins = 0;
      }

      if (normalizedKind === 'pro') {
        const existingMs = toMillisServer(userData.proExpiresAt);
        const baseMs = existingMs > nowMs ? existingMs : nowMs;
        newExpiryMs = baseMs + durationDays * 24 * 60 * 60 * 1000;
        userUpdate.isPro = true;
        userUpdate.proPlanId = plan.id;
        userUpdate.proExpiresAt = new Date(newExpiryMs);
      } else {
        const existingMs = toMillisServer(userData.boostExpiresAt);
        const baseMs = existingMs > nowMs ? existingMs : nowMs;
        newExpiryMs = baseMs + durationHours * 60 * 60 * 1000;
        userUpdate.isBoosted = true;
        userUpdate.boostExpiresAt = new Date(newExpiryMs);
        userUpdate.boostCountry = userData.country?.code || 'GLOBAL';
      }

      transaction.update(userRef, userUpdate);
      transaction.set(activationRef, {
        userId: uid,
        userName: userData.name || 'Usuario',
        kind: normalizedKind,
        planId: plan.id,
        diamondsSpent: costDiamonds,
        durationDays,
        durationHours,
        expiresAt: new Date(newExpiryMs),
        createdAt: FieldValue.serverTimestamp(),
      });

      return {
        newExpiryMs,
        remainingDiamonds,
      };
    });

    return {
      statusCode: 200,
      body: {
        ok: true,
        kind: normalizedKind,
        planId: plan.id,
        diamondsSpent: costDiamonds,
        newExpiryMs: result.newExpiryMs,
        remainingDiamonds: result.remainingDiamonds,
      },
    };
  } catch (err) {
    if (err instanceof HttpError) {
      return {
        statusCode: err.statusCode,
        body: { ok: false, error: err.message },
      };
    }
    console.error('[Store Activate] Error en transacción:', err);
    return {
      statusCode: 500,
      body: { ok: false, error: err?.message || 'Error interno activando el plan.' },
    };
  }
}

export async function storeActivateExpressHandler(req, res) {
  try {
    const result = await activateStorePlan({
      authHeader: req.headers.authorization || '',
      kind: req.body?.kind,
      planId: req.body?.planId,
    });
    return res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error('[Store Activate Express] Error fatal:', err);
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Error interno activando el plan.',
    });
  }
}
