import admin from 'firebase-admin';

let firestoreInstance = null;

/**
 * Inicializa Firebase Admin SDK en modo singleton para el backend (Vercel Functions o Express).
 * Soporta FIREBASE_SERVICE_ACCOUNT_JSON (JSON en una línea) o variables separadas.
 */
export function getAdminFirestore() {
  if (firestoreInstance) {
    return firestoreInstance;
  }

  if (!admin.apps.length) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (serviceAccountJson) {
      const parsed = JSON.parse(serviceAccountJson);
      if (typeof parsed.private_key === 'string') {
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      }
      admin.initializeApp({
        credential: admin.credential.cert(parsed),
      });
    } else if (
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    ) {
      admin.initializeApp({
        credential: admin.credential.cert({
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
  }

  firestoreInstance = admin.firestore();
  return firestoreInstance;
}

export { admin };
