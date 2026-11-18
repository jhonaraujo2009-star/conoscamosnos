import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../config/firebase';
import { COUNTRIES } from '../config/constants';
import { buildUserBaseFolder } from './cloudinaryService';

export const SUPER_ADMIN_EMAIL = 'jhonaraujo2009@gmail.com';

export function isVerifiedSuperAdminAccount(firebaseUser) {
  return Boolean(
    firebaseUser?.emailVerified &&
      String(firebaseUser?.email || '').trim().toLowerCase() === SUPER_ADMIN_EMAIL
  );
}

export async function ensureUserDocument(firebaseUser, extra = {}) {
  if (!firebaseUser) return null;
  const userRef = doc(db, 'users', firebaseUser.uid);
  const snap = await getDoc(userRef);
  const isOwnerSuperAdmin = isVerifiedSuperAdminAccount(firebaseUser);

  if (!snap.exists()) {
    const defaultCountry = COUNTRIES[0];
    const baseDoc = {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      name: extra.name || firebaseUser.displayName || 'Nuevo Usuario',
      age: 18,
      gender: 'Mujer',
      interestedIn: 'Todos',
      role: isOwnerSuperAdmin ? 'SUPER_ADMIN' : 'user',
      accountStatus: 'active',
      isBanned: false,
      verifiedBadge: false,
      verificationStatus: 'none',
      country: defaultCountry,
      city: '',
      bio: '',
      lookingFor: 'Hacer Amigos',
      interests: [],
      likesCount: 0,
      giftsReceivedCount: 0,
      giftCounts: {},
      isOnline: true,
      lastSeen: serverTimestamp(),
      coins: 0,
      earningsDiamonds: 0,
      pendingWithdrawalDiamonds: 0,
      totalWithdrawnUSD: 0,
      isBoosted: false,
      boostExpiresAt: null,
      boostCountry: null,
      cloudinaryFolder: buildUserBaseFolder(firebaseUser.uid),
      photos: firebaseUser.photoURL ? [firebaseUser.photoURL] : [],
      blockedUsers: [],
      smartPhotos: false,
      smartBestPhotoUrl: '',
      hideAge: false,
      hideDistance: false,
      hideOnlineStatus: false,
      discoverable: true,
      requireGiftToChat: false,
      approxGeo: null,
      onboardingCompleted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(userRef, baseDoc);
    return baseDoc;
  }

  const updates = {
    isOnline: true,
    lastSeen: serverTimestamp(),
  };
  if (!snap.data()?.cloudinaryFolder) {
    updates.cloudinaryFolder = buildUserBaseFolder(firebaseUser.uid);
  }
  if (isOwnerSuperAdmin && snap.data()?.role !== 'SUPER_ADMIN') {
    updates.role = 'SUPER_ADMIN';
  }
  await updateDoc(userRef, updates);
  return { id: snap.id, ...snap.data(), ...updates };
}

export async function registerWithEmail({ email, password, name }) {
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (name) {
    await updateProfile(credential.user, { displayName: name.trim() });
  }
  await ensureUserDocument(credential.user, { name: name?.trim() });
  return credential.user;
}

export async function loginWithEmail({ email, password }) {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  await ensureUserDocument(credential.user);
  return credential.user;
}

export async function loginWithGoogle() {
  const credential = await signInWithPopup(auth, googleProvider);
  await ensureUserDocument(credential.user);
  return credential.user;
}

export async function logoutUser(uid) {
  if (uid && db) {
    try {
      await updateDoc(doc(db, 'users', uid), {
        isOnline: false,
        lastSeen: serverTimestamp(),
      });
    } catch {
      // No bloquear cierre de sesión si falla la actualización de presencia
    }
  }
  await signOut(auth);
}
