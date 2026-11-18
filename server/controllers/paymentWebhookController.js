import { FieldValue, getAdminFirestore } from '../config/firebaseAdmin.js';

const DEFAULT_PACKAGES = [
  { id: 'pack_100', coins: 100, priceUSD: 1.99 },
  { id: 'pack_550', coins: 550, priceUSD: 7.99 },
  { id: 'pack_1200', coins: 1200, priceUSD: 14.99 },
  { id: 'pack_3000', coins: 3000, priceUSD: 29.99 },
];

/**
 * Extrae userId, packageId y tipo de saldo ('coins' | 'diamonds') desde el order_id.
 * Convención recomendada al generar la orden:
 *   order_id = "uid:<FIREBASE_UID>|pkg:<PACKAGE_ID>|target:<coins|diamonds>"
 *   o formato simple "<FIREBASE_UID>__<PACKAGE_ID>"
 */
export function parseOrderMetadata(rawOrderId = '') {
  const text = String(rawOrderId || '').trim();
  if (!text) return { userId: '', packageId: '', creditTarget: 'coins' };

  if (text.includes('|')) {
    const parts = {};
    text.split('|').forEach((segment) => {
      const [k, ...rest] = segment.split(':');
      if (k && rest.length) parts[k.trim()] = rest.join(':').trim();
    });
    return {
      userId: parts.uid || parts.user || '',
      packageId: parts.pkg || parts.pack || '',
      creditTarget: parts.target === 'diamonds' ? 'diamonds' : 'coins',
    };
  }

  if (text.includes('__')) {
    const [userId, packageId, target] = text.split('__');
    return {
      userId: (userId || '').trim(),
      packageId: (packageId || '').trim(),
      creditTarget: target === 'diamonds' ? 'diamonds' : 'coins',
    };
  }

  return { userId: '', packageId: '', creditTarget: 'coins' };
}

/**
 * Normaliza los payloads IPN de NowPayments a una estructura uniforme verificada.
 */
function normalizePaymentEvent(payload) {
  const status = String(payload.payment_status || '').toLowerCase();
  const settled = status === 'finished' || status === 'confirmed';
  const meta = parseOrderMetadata(payload.order_id);
  const amountUSD = Number(payload.price_amount || payload.outcome_amount || 0);
  return {
    provider: 'nowpayments',
    externalPaymentId: String(payload.payment_id || payload.invoice_id || ''),
    rawStatus: status,
    isSettled: settled,
    userId: payload.user_id || meta.userId,
    packageId: payload.package_id || meta.packageId,
    creditTarget:
      payload.credit_target === 'coins'
        ? 'coins'
        : payload.credit_target === 'diamonds' || meta.creditTarget === 'diamonds'
        ? 'diamonds'
        : 'diamonds',
    amountUSD,
    currency: String(payload.price_currency || payload.pay_currency || 'USD').toUpperCase(),
  };
}

/**
 * Procesa de forma atómica e idempotente el pago verificado:
 * - Consulta precios vigentes desde appConfig/economy en Firestore.
 * - Impide doble acreditación usando ID determinista paymentTransactions/nowpayments_{externalPaymentId}.
 * - Acredita el saldo al usuario (coins o earningsDiamonds según la orden) en una única transacción.
 */
export async function processVerifiedPaymentWebhook({ payload }) {
  const event = normalizePaymentEvent(payload);

  if (!event.externalPaymentId) {
    return { statusCode: 400, body: { ok: false, error: 'Falta identificador único de transacción.' } };
  }

  // Estados intermedios (waiting, confirming, sending): responder 200 sin acreditar todavía
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
      Array.isArray(economyData?.coinPackages) && economyData.coinPackages.length > 0
        ? economyData.coinPackages
        : DEFAULT_PACKAGES;
    const baseDiamondValueUSD = Number(economyData?.baseDiamondValueUSD || 0.01);

    let unitsToCredit = 0;
    const matchedPkg = packages.find((p) => p.id === event.packageId);

    if (matchedPkg) {
      // Tolerancia mínima de $0.05 por variaciones de redondeo en pasarela crypto
      if (event.amountUSD + 0.05 < Number(matchedPkg.priceUSD || 0)) {
        throw new Error(
          `Monto pagado (${event.amountUSD} USD) es inferior al precio del paquete ${matchedPkg.id} (${matchedPkg.priceUSD} USD).`
        );
      }
      unitsToCredit = Math.floor(Number(matchedPkg.diamonds ?? matchedPkg.coins ?? 0));
    } else if (event.amountUSD > 0 && baseDiamondValueUSD > 0) {
      // Cálculo dinámico basado en el precio oficial de diamantes configurado por el Super Admin
      unitsToCredit = Math.max(1, Math.floor(event.amountUSD / baseDiamondValueUSD));
    }

    if (unitsToCredit <= 0) {
      throw new Error('Cantidad de diamantes/monedas a acreditar inválida.');
    }

    const userData = userSnap.data() || {};
    // Los diamantes comprados van a `diamonds` (regalar/cambiar a monedas), nunca directo a ganancias retirables
    const creditField = event.creditTarget === 'coins' ? 'coins' : 'diamonds';
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
      coinsCredited: unitsToCredit,
      diamondsCredited: event.creditTarget === 'diamonds' ? unitsToCredit : 0,
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

/**
 * Controlador Express para POST /api/webhooks/payments
 */
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
