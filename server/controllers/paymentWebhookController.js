import { FieldValue, getAdminFirestore } from '../config/firebaseAdmin.js';

const DEFAULT_PACKAGES = [
  { id: 'pack_100', diamonds: 100, priceUSD: 1.99 },
  { id: 'pack_550', diamonds: 550, priceUSD: 7.99 },
  { id: 'pack_1200', diamonds: 1200, priceUSD: 14.99 },
  { id: 'pack_3000', diamonds: 3000, priceUSD: 29.99 },
];

const DEFAULT_PRO_PLANS = [
  { id: 'pro_weekly', durationDays: 7, priceUSD: 4.99, priceDiamonds: 250 },
  { id: 'pro_monthly', durationDays: 30, priceUSD: 12.99, priceDiamonds: 600 },
];

/**
 * Extrae userId, packageId y tipo de saldo ('diamonds' | 'pro') desde el order_id.
 */
export function parseOrderMetadata(rawOrderId = '') {
  const text = String(rawOrderId || '').trim();
  if (!text) return { userId: '', packageId: '', creditTarget: 'diamonds' };

  if (text.includes('|')) {
    const parts = {};
    text.split('|').forEach((segment) => {
      const [k, ...rest] = segment.split(':');
      if (k && rest.length) parts[k.trim()] = rest.join(':').trim();
    });
    const rawTarget = parts.target || 'diamonds';
    return {
      userId: parts.uid || parts.user || '',
      packageId: parts.pkg || parts.pack || '',
      creditTarget: rawTarget === 'pro' ? 'pro' : 'diamonds',
    };
  }

  if (text.includes('__')) {
    const [userId, packageId, target] = text.split('__');
    return {
      userId: (userId || '').trim(),
      packageId: (packageId || '').trim(),
      creditTarget: target === 'pro' ? 'pro' : 'diamonds',
    };
  }

  return { userId: '', packageId: '', creditTarget: 'diamonds' };
}

/**
 * Normaliza los payloads IPN de NowPayments a una estructura uniforme verificada.
 */
function normalizePaymentEvent(payload) {
  const status = String(payload.payment_status || '').toLowerCase();
  const settled = status === 'finished' || status === 'confirmed';
  const meta = parseOrderMetadata(payload.order_id);
  const amountUSD = Number(payload.price_amount || payload.outcome_amount || 0);
  const payAmount = Number(payload.pay_amount || 0);
  const actuallyPaid = Number(payload.actually_paid || 0);
  const priceCurrency = String(payload.price_currency || '').trim().toUpperCase();
  const resolvedTarget =
    payload.credit_target === 'pro' || meta.creditTarget === 'pro' ? 'pro' : 'diamonds';
  return {
    provider: 'nowpayments',
    externalPaymentId: String(payload.payment_id || payload.invoice_id || ''),
    rawStatus: status,
    isSettled: settled,
    userId: payload.user_id || meta.userId,
    packageId: payload.package_id || meta.packageId,
    creditTarget: resolvedTarget,
    amountUSD,
    payAmount,
    actuallyPaid,
    priceCurrency,
    currency: String(payload.price_currency || payload.pay_currency || 'USD').toUpperCase(),
  };
}

/**
 * Procesa de forma atómica e idempotente el pago verificado:
 * - Consulta precios vigentes desde appConfig/economy en Firestore.
 * - Impide doble acreditación usando ID determinista paymentTransactions/nowpayments_{externalPaymentId}.
 * - Acredita Diamantes (💎) o activa membresía Conoscamosnos PRO en una única transacción.
 */
export async function processVerifiedPaymentWebhook({ payload }) {
  const event = normalizePaymentEvent(payload);

  if (!event.externalPaymentId) {
    return { statusCode: 400, body: { ok: false, error: 'Falta identificador único de transacción.' } };
  }

  if (!event.isSettled) {
    console.info('[PaymentWebhook] Estado no liquidado ignorado:', {
      provider: event.provider,
      externalPaymentId: event.externalPaymentId,
      status: event.rawStatus,
    });
    return {
      statusCode: 200,
      body: { ok: true, ignored: true, status: event.rawStatus },
    };
  }

  if (!event.userId) {
    return {
      statusCode: 400,
      body: { ok: false, error: 'No se pudo identificar el userId del comprador en order_id.' },
    };
  }

  if (event.priceCurrency && event.priceCurrency !== 'USD') {
    return {
      statusCode: 400,
      body: {
        ok: false,
        error: `Moneda de precio inválida (${event.priceCurrency}). Solo se acepta USD.`,
      },
    };
  }

  if (
    event.payAmount > 0 &&
    event.actuallyPaid > 0 &&
    event.actuallyPaid < event.payAmount * 0.98
  ) {
    return {
      statusCode: 400,
      body: {
        ok: false,
        error: `Pago cripto incompleto (${event.actuallyPaid} recibido vs ${event.payAmount} requerido).`,
      },
    };
  }

  const db = getAdminFirestore();
  const txDocId = `${event.provider}_${event.externalPaymentId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const txRef = db.collection('paymentTransactions').doc(txDocId);
  const userRef = db.collection('users').doc(event.userId);
  const configRef = db.collection('appConfig').doc('economy');

  const outcome = await db.runTransaction(async (transaction) => {
    const [existingTxSnap, userSnap, configSnap] = await Promise.all([
      transaction.get(txRef),
      transaction.get(userRef),
      transaction.get(configRef),
    ]);

    if (existingTxSnap.exists) {
      return { duplicate: true, txId: txDocId };
    }

    if (!userSnap.exists) {
      throw new Error(`Usuario ${event.userId} no existe en Firestore.`);
    }

    const economyData = configSnap.exists ? configSnap.data() : {};
    const packages =
      Array.isArray(economyData?.diamondPackages) && economyData.diamondPackages.length > 0
        ? economyData.diamondPackages
        : Array.isArray(economyData?.coinPackages) && economyData.coinPackages.length > 0
        ? economyData.coinPackages
        : DEFAULT_PACKAGES;
    const proPlans =
      Array.isArray(economyData?.proPlans) && economyData.proPlans.length > 0
        ? economyData.proPlans
        : DEFAULT_PRO_PLANS;
    const baseDiamondValueUSD = Number(economyData?.baseDiamondValueUSD || 0.01);
    const userData = userSnap.data() || {};

    if (event.creditTarget === 'pro') {
      const matchedPro = proPlans.find((p) => p.id === event.packageId);
      if (!matchedPro) {
        throw new Error(`Plan PRO desconocido en webhook (${event.packageId || 'vacío'}).`);
      }
      if (event.amountUSD + 0.05 < Number(matchedPro.priceUSD || 0)) {
        throw new Error(
          `Monto pagado (${event.amountUSD} USD) es inferior al precio del plan PRO ${matchedPro.id} (${matchedPro.priceUSD} USD).`
        );
      }
      const durationDays = Math.max(1, Math.min(365, Math.floor(Number(matchedPro.durationDays || 7))));
      const rawExisting = userData.proExpiresAt;
      const existingMs =
        typeof rawExisting?.toMillis === 'function'
          ? rawExisting.toMillis()
          : typeof rawExisting === 'number'
          ? rawExisting
          : 0;
      const baseTimeMs = existingMs > Date.now() ? existingMs : Date.now();
      const newExpiryDate = new Date(baseTimeMs + durationDays * 24 * 60 * 60 * 1000);

      transaction.update(userRef, {
        isPro: true,
        proPlanId: matchedPro.id,
        proExpiresAt: newExpiryDate,
        proPaymentSource: 'nowpayments_webhook',
        proLastPaymentId: txDocId,
        updatedAt: FieldValue.serverTimestamp(),
      });

      transaction.set(txRef, {
        userId: event.userId,
        userName: userData.name || 'Usuario',
        provider: event.provider,
        externalPaymentId: event.externalPaymentId,
        packageId: matchedPro.id,
        creditField: 'pro',
        proDurationDays: durationDays,
        diamondsCredited: 0,
        amountUSD: Number(event.amountUSD.toFixed(2)),
        currency: event.currency,
        rawStatus: event.rawStatus,
        verifiedSignature: true,
        source: 'webhook',
        status: 'completed',
        createdAt: FieldValue.serverTimestamp(),
      });

      return {
        duplicate: false,
        txId: txDocId,
        proDurationDays: durationDays,
        creditField: 'pro',
        amountUSD: Number(event.amountUSD.toFixed(2)),
      };
    }

    let unitsToCredit = 0;
    const matchedPkg = packages.find((p) => p.id === event.packageId);

    if (matchedPkg) {
      if (event.amountUSD + 0.05 < Number(matchedPkg.priceUSD || 0)) {
        throw new Error(
          `Monto pagado (${event.amountUSD} USD) es inferior al precio del paquete ${matchedPkg.id} (${matchedPkg.priceUSD} USD).`
        );
      }
      unitsToCredit = Math.floor(Number(matchedPkg.diamonds ?? matchedPkg.coins ?? 0));
    } else if (event.amountUSD > 0 && baseDiamondValueUSD > 0) {
      unitsToCredit = Math.max(1, Math.floor(event.amountUSD / baseDiamondValueUSD));
    }

    if (unitsToCredit <= 0) {
      throw new Error('Cantidad de diamantes a acreditar inválida.');
    }

    const creditField = 'diamonds';
    const currentBalance = Number(userData[creditField] || 0);

    transaction.update(userRef, {
      [creditField]: currentBalance + unitsToCredit,
      updatedAt: FieldValue.serverTimestamp(),
    });

    transaction.set(txRef, {
      userId: event.userId,
      userName: userData.name || 'Usuario',
      provider: event.provider,
      externalPaymentId: event.externalPaymentId,
      packageId: event.packageId || 'dynamic_rate',
      creditField,
      diamondsCredited: unitsToCredit,
      amountUSD: Number(event.amountUSD.toFixed(2)),
      currency: event.currency,
      rawStatus: event.rawStatus,
      verifiedSignature: true,
      source: 'webhook',
      status: 'completed',
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      duplicate: false,
      txId: txDocId,
      unitsToCredit,
      creditField,
      amountUSD: Number(event.amountUSD.toFixed(2)),
    };
  });

  console.info('[PaymentWebhook] Transacción procesada:', {
    provider: event.provider,
    userId: event.userId,
    ...outcome,
  });

  return {
    statusCode: 200,
    body: { ok: true, ...outcome },
  };
}

export async function paymentWebhookExpressHandler(req, res) {
  try {
    const result = await processVerifiedPaymentWebhook({
      payload: req.body,
    });

    return res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error('[PaymentWebhook] Error procesando webhook:', err);
    return res.status(500).json({
      ok: false,
      error: err.message || 'Error interno al procesar el webhook de pago.',
    });
  }
}
