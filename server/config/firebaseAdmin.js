import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

let appInstance = null;
let firestoreInstance = null;
let authInstance = null;
let messagingInstance = null;

/**
 * Inicializa Firebase Admin SDK v14+ en modo modular ESM (Vercel Functions y Express).
 * Soporta FIREBASE_SERVICE_ACCOUNT_JSON (JSON en una línea) o variables separadas.
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

  if (serviceAccountJson) {
    const parsed = JSON.parse(serviceAccountJson);
    if (typeof parsed.private_key === 'string') {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    appInstance = initializeApp({
      credential: cert(parsed),
    });
  } else if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    appInstance = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  } else {
    throw new Error(
      'Firebase Admin SDK no está configurado. Define FIREBASE_SERVICE_ACCOUNT_JSON o FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY.'
    );
  }

  return appInstance;
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
