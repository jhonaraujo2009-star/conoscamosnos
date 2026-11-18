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
 * Verificador unificado agnóstico del runtime (funciona igual en Vercel Functions y Express).
 * Valida únicamente callbacks oficiales firmados de NowPayments (HMAC-SHA512).
 */
export function verifyWebhookSignature({ headers = {}, payload = {} }) {
  const normalizedHeaders = {};
  Object.entries(headers).forEach(([k, v]) => {
    normalizedHeaders[String(k).toLowerCase()] = Array.isArray(v) ? v[0] : v;
  });

  const nowSig = normalizedHeaders['x-nowpayments-sig'];
  if (nowSig || payload?.payment_id !== undefined || payload?.invoice_id !== undefined) {
    return verifyNowPaymentsSignature(payload, nowSig, process.env.NOWPAYMENTS_IPN_SECRET);
  }

  return {
    valid: false,
    reason: 'Cabecera de firma criptográfica x-nowpayments-sig ausente o payload no reconocido.',
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
