import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

let appInstance = null;
let firestoreInstance = null;
let authInstance = null;
let messagingInstance = null;

function stripWrappingQuotes(value) {
  let out = String(value || '').trim();
  if (
    out.length >= 2 &&
    ((out.startsWith('"') && out.endsWith('"')) || (out.startsWith("'") && out.endsWith("'")))
  ) {
    out = out.slice(1, -1).trim();
  }
  return out;
}

/**
 * Escapa saltos de línea literales dentro de strings JSON (frecuente al pegar JSON en Vercel).
 */
function sanitizeControlCharsInJsonStrings(text) {
  let result = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        result += ch;
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        result += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        result += ch;
        inString = false;
        continue;
      }
      if (ch === '\r') {
        continue;
      }
      if (ch === '\n') {
        result += '\\n';
        continue;
      }
      if (ch === '\t') {
        result += '\\t';
        continue;
      }
      result += ch;
    } else {
      if (ch === '"') {
        inString = true;
      }
      result += ch;
    }
  }

  return result;
}

function tryJsonParse(candidate) {
  const first = JSON.parse(candidate);
  if (typeof first === 'string') {
    return JSON.parse(first);
  }
  return first;
}

/**
 * Parsea de forma resiliente FIREBASE_SERVICE_ACCOUNT_JSON en formatos:
 * JSON estándar, JSON entrecomillado, JSON doblemente serializado, multilínea con saltos literales o Base64.
 */
export function parseServiceAccountJson(raw) {
  let text = stripWrappingQuotes(raw);
  if (!text) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON está vacío.');
  }

  if (!text.startsWith('{')) {
    try {
      const decoded = Buffer.from(text, 'base64').toString('utf8').trim();
      if (decoded.startsWith('{')) {
        text = decoded;
      }
    } catch {
      // Continuar con los demás intentos de parseo
    }
  }

  let parsed = null;
  try {
    parsed = tryJsonParse(text);
  } catch {
    try {
      const sanitized = sanitizeControlCharsInJsonStrings(text);
      parsed = tryJsonParse(sanitized);
    } catch {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT_JSON tiene formato JSON inválido (verifica comillas o saltos de línea).'
      );
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON no contiene un objeto de credenciales válido.');
  }

  if (typeof parsed.private_key === 'string') {
    parsed.private_key = stripWrappingQuotes(parsed.private_key).replace(/\\n/g, '\n');
  }

  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_JSON debe incluir project_id, client_email y private_key.'
    );
  }

  return parsed;
}

function normalizePrivateKey(rawKey) {
  return stripWrappingQuotes(rawKey).replace(/\\n/g, '\n');
}

function sanitizeAdminErrorMessage(err) {
  const raw = String(err?.message || 'Error inicializando Firebase Admin SDK.')
    .replace(/\s+/g, ' ')
    .trim();
  if (raw.includes('PRIVATE KEY')) {
    return 'Clave privada de Firebase Admin inválida o mal formateada.';
  }
  return raw.slice(0, 160);
}

/**
 * Inicializa Firebase Admin SDK v13+ en modo modular ESM (Vercel Functions y Express).
 * Soporta FIREBASE_SERVICE_ACCOUNT_JSON (múltiples formatos) o variables separadas.
 */
export function getAdminApp() {
  if (appInstance) {
    return appInstance;
  }

  const existing = getApps();
  if (existing.length > 0) {
    appInstance = existing[0];
    return appInstance;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const hasSeparateEnv = Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
  );

  let jsonParseError = null;

  if (serviceAccountJson && String(serviceAccountJson).trim()) {
    try {
      const parsed = parseServiceAccountJson(serviceAccountJson);
      appInstance = initializeApp({
        credential: cert(parsed),
      });
      return appInstance;
    } catch (err) {
      jsonParseError = err;
      if (!hasSeparateEnv) {
        throw err;
      }
    }
  }

  if (hasSeparateEnv) {
    appInstance = initializeApp({
      credential: cert({
        projectId: stripWrappingQuotes(process.env.FIREBASE_PROJECT_ID),
        clientEmail: stripWrappingQuotes(process.env.FIREBASE_CLIENT_EMAIL),
        privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
      }),
    });
    return appInstance;
  }

  if (jsonParseError) {
    throw jsonParseError;
  }

  throw new Error(
    'Firebase Admin SDK no está configurado. Define FIREBASE_SERVICE_ACCOUNT_JSON o FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY.'
  );
}

/**
 * Comprueba en vivo que Firebase Admin SDK inicializa sin errores (para endpoint de diagnóstico).
 */
export function checkAdminHealth() {
  try {
    getAdminApp();
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: sanitizeAdminErrorMessage(err) };
  }
}

export function getAdminFirestore() {
  if (firestoreInstance) {
    return firestoreInstance;
  }
  firestoreInstance = getFirestore(getAdminApp());
  return firestoreInstance;
}

export function getAdminAuth() {
  if (authInstance) {
    return authInstance;
  }
  authInstance = getAuth(getAdminApp());
  return authInstance;
}

export function getAdminMessaging() {
  if (messagingInstance) {
    return messagingInstance;
  }
  messagingInstance = getMessaging(getAdminApp());
  return messagingInstance;
}

export { FieldValue };
