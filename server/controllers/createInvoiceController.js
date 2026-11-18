import { admin, getAdminFirestore } from '../config/firebaseAdmin.js';

const DEFAULT_PACKAGES = [
  { id: 'pack_100', coins: 100, priceUSD: 1.99, label: 'Inicio' },
  { id: 'pack_550', coins: 550, priceUSD: 7.99, label: 'Popular' },
  { id: 'pack_1200', coins: 1200, priceUSD: 14.99, label: 'VIP Pro' },
  { id: 'pack_3000', coins: 3000, priceUSD: 29.99, label: 'Elite Global' },
];

/**
 * Crea una factura oficial en NowPayments (https://api.nowpayments.io/v1/invoice)
 * utilizando NOWPAYMENTS_API_KEY en el servidor (nunca expuesta en el navegador).
 */
export async function createNowPaymentsInvoice({
  authHeader = '',
  packageId,
  creditTarget = 'coins',
  origin = '',
}) {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: {
        ok: false,
        error:
          'NOWPAYMENTS_API_KEY no está configurada en el servidor (Vercel Environment Variables).',
      },
    };
  }

  const bearerMatch = String(authHeader || '').match(/^Bearer\s+(.+)$/i);
  if (!bearerMatch?.[1]) {
    return {
      statusCode: 401,
      body: { ok: false, error: 'Se requiere sesión autenticada (Bearer token) para generar un pago.' },
    };
  }

  // Verificar token de Firebase Auth para asegurar que el comprador es el dueño del uid
  let uid = '';
  let packages = DEFAULT_PACKAGES;

  try {
    const db = getAdminFirestore();
    const decoded = await admin.auth().verifyIdToken(bearerMatch[1]);
    uid = decoded.uid;

    const configSnap = await db.collection('appConfig').doc('economy').get();
    if (configSnap.exists) {
      const cfg = configSnap.data();
      if (Array.isArray(cfg?.coinPackages) && cfg.coinPackages.length > 0) {
        packages = cfg.coinPackages;
      }
    }
  } catch (err) {
    console.error('[NowPayments Invoice] Error verificando Firebase Admin/Token:', err);
    return {
      statusCode: 401,
      body: {
        ok: false,
        error:
          'No se pudo verificar tu sesión en el servidor. Verifica FIREBASE_SERVICE_ACCOUNT_JSON en Vercel.',
      },
    };
  }

  const pkg = packages.find((p) => p.id === packageId);
  if (!pkg) {
    return {
      statusCode: 400,
      body: { ok: false, error: 'Paquete de monedas inválido.' },
    };
  }

  const safeTarget = creditTarget === 'diamonds' ? 'diamonds' : 'coins';
  const cleanOrigin = String(origin || process.env.APP_PUBLIC_URL || 'https://conoscamosnos.vercel.app').replace(/\/$/, '');
  const orderId = `uid:${uid}|pkg:${pkg.id}|target:${safeTarget}`;

  const nowPaymentsPayload = {
    price_amount: Number(pkg.priceUSD),
    price_currency: 'usd',
    order_id: orderId,
    order_description: `Conoscamosnos - ${pkg.coins} Monedas (${pkg.label || pkg.id})`,
    ipn_callback_url: `${cleanOrigin}/api/webhooks/payments`,
    success_url: `${cleanOrigin}/app?payment=success`,
    cancel_url: `${cleanOrigin}/app?payment=cancel`,
  };

  const response = await fetch('https://api.nowpayments.io/v1/invoice', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(nowPaymentsPayload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.invoice_url) {
    console.error('[NowPayments Invoice] Respuesta de error:', response.status, data);
    return {
      statusCode: 502,
      body: {
        ok: false,
        error: data?.message || 'NowPayments no pudo generar la factura en este momento.',
      },
    };
  }

  console.info('[NowPayments Invoice] Factura generada:', {
    uid,
    packageId: pkg.id,
    invoiceId: data.id,
    amountUSD: pkg.priceUSD,
  });

  return {
    statusCode: 200,
    body: {
      ok: true,
      invoiceId: data.id,
      invoiceUrl: data.invoice_url,
      orderId,
      amountUSD: pkg.priceUSD,
      coins: pkg.coins,
    },
  };
}

export async function createInvoiceExpressHandler(req, res) {
  try {
    const origin = `${req.protocol}://${req.get('host')}`;
    const result = await createNowPaymentsInvoice({
      authHeader: req.headers.authorization || '',
      packageId: req.body?.packageId,
      creditTarget: req.body?.creditTarget,
      origin,
    });
    return res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error('[NowPayments Invoice Express] Error fatal:', err);
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Error interno generando la factura.',
    });
  }
}
