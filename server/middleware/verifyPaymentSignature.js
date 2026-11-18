import crypto from 'node:crypto';

/**
 * Ordena recursivamente las claves de un objeto JSON (requerido por la especificación IPN de NowPayments).
 */
export function sortObjectKeysDeep(value) {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeysDeep);
  }
  if (value !== null && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortObjectKeysDeep(value[key]);
        return acc;
      }, {});
  }
  return value;
}

/**
 * Comparación en tiempo constante para evitar ataques de timing sobre firmas criptográficas.
 */
function safeCompareHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a.trim().toLowerCase(), 'utf8');
  const bufB = Buffer.from(b.trim().toLowerCase(), 'utf8');
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verifica firma IPN de NowPayments (HMAC-SHA512 con claves JSON ordenadas alfabéticamente).
 * Header oficial: x-nowpayments-sig
 */
export function verifyNowPaymentsSignature(payload, receivedSig, ipnSecret) {
  if (!ipnSecret) {
    return { valid: false, reason: 'NOWPAYMENTS_IPN_SECRET no está configurado en el servidor.' };
  }
  if (!receivedSig) {
    return { valid: false, reason: 'Falta cabecera criptográfica x-nowpayments-sig.' };
  }
  const sortedPayload = sortObjectKeysDeep(payload);
  const expectedSig = crypto
    .createHmac('sha512', ipnSecret)
    .update(JSON.stringify(sortedPayload))
    .digest('hex');

  if (!safeCompareHex(receivedSig, expectedSig)) {
    return { valid: false, reason: 'Firma HMAC-SHA512 de NowPayments inválida.' };
  }
  return { valid: true, provider: 'nowpayments' };
}

/**
 * Verifica firma oficial de Payeer Merchant Status Webhook (SHA-256 en mayúsculas).
 * Campos oficiales: m_operation_id:m_operation_ps:m_operation_date:m_operation_pay_date:m_shop:m_orderid:m_amount:m_curr:m_desc:m_status:SECRET_KEY
 */
export function verifyPayeerSignature(payload, secretKey, expectedShopId = '') {
  if (!secretKey) {
    return { valid: false, reason: 'PAYEER_SECRET_KEY no está configurado en el servidor.' };
  }
  const receivedSign = payload?.m_sign;
  if (!receivedSign) {
    return { valid: false, reason: 'Falta firma m_sign en el callback de Payeer.' };
  }
  if (expectedShopId && String(payload.m_shop || '') !== String(expectedShopId)) {
    return { valid: false, reason: 'm_shop no coincide con el comercio configurado.' };
  }

  const hashParts = [
    payload.m_operation_id ?? '',
    payload.m_operation_ps ?? '',
    payload.m_operation_date ?? '',
    payload.m_operation_pay_date ?? '',
    payload.m_shop ?? '',
    payload.m_orderid ?? '',
    payload.m_amount ?? '',
    payload.m_curr ?? '',
    payload.m_desc ?? '',
    payload.m_status ?? '',
    secretKey,
  ];

  const expectedSign = crypto
    .createHash('sha256')
    .update(hashParts.join(':'))
    .digest('hex')
    .toUpperCase();

  if (!safeCompareHex(receivedSign, expectedSign)) {
    return { valid: false, reason: 'Firma SHA-256 de Payeer inválida.' };
  }
  return { valid: true, provider: 'payeer' };
}

/**
 * Verificador unificado agnóstico del runtime (funciona igual en Vercel Functions y Express).
 */
export function verifyWebhookSignature({ headers = {}, payload = {} }) {
  const normalizedHeaders = {};
  Object.entries(headers).forEach(([k, v]) => {
    normalizedHeaders[String(k).toLowerCase()] = Array.isArray(v) ? v[0] : v;
  });

  const nowSig = normalizedHeaders['x-nowpayments-sig'];
  if (nowSig || payload?.payment_id !== undefined) {
    return verifyNowPaymentsSignature(payload, nowSig, process.env.NOWPAYMENTS_IPN_SECRET);
  }

  if (payload?.m_operation_id !== undefined || payload?.m_sign !== undefined) {
    return verifyPayeerSignature(
      payload,
      process.env.PAYEER_SECRET_KEY,
      process.env.PAYEER_SHOP_ID
    );
  }

  return {
    valid: false,
    reason: 'Proveedor de pago no reconocido o cabecera de firma ausente (NowPayments / Payeer).',
  };
}

/**
 * Middleware de seguridad para Express: verifica firma criptográfica antes de ejecutar el controlador.
 */
export function verifyPaymentSignatureMiddleware(req, res, next) {
  const result = verifyWebhookSignature({
    headers: req.headers,
    payload: req.body,
  });

  if (!result.valid) {
    console.error('[Webhook Security] Firma rechazada:', result.reason);
    return res.status(401).json({
      ok: false,
      error: result.reason,
    });
  }

  req.paymentProvider = result.provider;
  return next();
}
