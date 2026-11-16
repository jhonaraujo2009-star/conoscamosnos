import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { MAX_PHOTOS, MIN_AGE } from '../config/constants';
import { isBoostActive, toMillis } from '../utils/formatters';

export async function completeOnboarding(uid, formData) {
  const ageNum = Number(formData.age);
  if (Number.isNaN(ageNum) || ageNum < MIN_AGE) {
    throw new Error(`Debes tener al menos ${MIN_AGE} años para usar Conoscamosnos.`);
  }

  const photos = Array.isArray(formData.photos) ? formData.photos.slice(0, MAX_PHOTOS) : [];

  await updateDoc(doc(db, 'users', uid), {
    name: formData.name.trim(),
    age: ageNum,
    gender: formData.gender,
    interestedIn: formData.interestedIn,
    country: formData.country,
    city: formData.city.trim(),
    bio: formData.bio.trim(),
    lookingFor: formData.lookingFor,
    interests: formData.interests || [],
    photos,
    onboardingCompleted: true,
    isOnline: true,
    lastSeen: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateUserProfile(uid, updates) {
  const sanitized = {
    updatedAt: serverTimestamp(),
  };

  if (typeof updates.name === 'string') sanitized.name = updates.name.trim();
  if (updates.age !== undefined) {
    const ageNum = Number(updates.age);
    if (Number.isNaN(ageNum) || ageNum < MIN_AGE) {
      throw new Error(`La edad mínima permitida es ${MIN_AGE} años.`);
    }
    sanitized.age = ageNum;
  }
  if (updates.gender) sanitized.gender = updates.gender;
  if (updates.interestedIn) sanitized.interestedIn = updates.interestedIn;
  if (updates.country) sanitized.country = updates.country;
  if (typeof updates.city === 'string') sanitized.city = updates.city.trim();
  if (typeof updates.bio === 'string') sanitized.bio = updates.bio.trim();
  if (updates.lookingFor) sanitized.lookingFor = updates.lookingFor;
  if (Array.isArray(updates.interests)) sanitized.interests = updates.interests;
  if (Array.isArray(updates.photos)) sanitized.photos = updates.photos.slice(0, MAX_PHOTOS);

  await updateDoc(doc(db, 'users', uid), sanitized);
}

export async function updatePresence(uid, isOnline) {
  if (!uid || !db) return;
  try {
    await updateDoc(doc(db, 'users', uid), {
      isOnline,
      lastSeen: serverTimestamp(),
    });
  } catch {
    // Ignorar errores transitorios de presencia
  }
}

export async function getUserById(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return { uid: snap.id, id: snap.id, ...snap.data() };
}

export function subscribeUserById(uid, callback) {
  if (!uid || !db) return () => {};
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (snap.exists()) {
        callback({ uid: snap.id, id: snap.id, ...snap.data() });
      }
    },
    () => {}
  );
}

export function subscribeVipUsers({ scope, countryCode, currentUserId, blockedUsers = [] }, onData, onError) {
  const usersRef = collection(db, 'users');
  const constraints = [where('isBoosted', '==', true)];

  if (scope === 'local' && countryCode) {
    constraints.push(where('country.code', '==', countryCode));
  }
  constraints.push(orderBy('boostExpiresAt', 'desc'), limit(30));

  const blockedSet = new Set(blockedUsers);
  const filterAndSort = (snapshot) =>
    snapshot.docs
      .map((d) => ({ uid: d.id, id: d.id, ...d.data() }))
      .filter((u) => {
        if (u.id === currentUserId) return false;
        if (blockedSet.has(u.id)) return false;
        if (!u.onboardingCompleted) return false;
        if (scope === 'local' && countryCode && u.country?.code !== countryCode) return false;
        return isBoostActive(u);
      })
      .sort((a, b) => toMillis(b.boostExpiresAt) - toMillis(a.boostExpiresAt));

  let activeUnsub = () => {};
  let disposed = false;

  activeUnsub = onSnapshot(
    query(usersRef, ...constraints),
    (snapshot) => onData(filterAndSort(snapshot)),
    (err) => {
      if (err?.code === 'failed-precondition' && !disposed) {
        if (onError) onError(err);
        const fallbackQ = query(usersRef, where('isBoosted', '==', true), limit(50));
        activeUnsub = onSnapshot(fallbackQ, (snap) => onData(filterAndSort(snap)));
      } else if (onError) {
        onError(err);
      }
    }
  );

  return () => {
    disposed = true;
    activeUnsub();
  };
}

export function subscribePopularUsers({ scope, countryCode, currentUserId, blockedUsers = [] }, onData, onError) {
  const usersRef = collection(db, 'users');
  const constraints = [];

  if (scope === 'local' && countryCode) {
    constraints.push(where('country.code', '==', countryCode));
  }
  constraints.push(orderBy('likesCount', 'desc'), orderBy('giftsReceivedCount', 'desc'), limit(40));

  const blockedSet = new Set(blockedUsers);
  const filterAndSort = (snapshot) =>
    snapshot.docs
      .map((d) => ({ uid: d.id, id: d.id, ...d.data() }))
      .filter((u) => {
        if (u.id === currentUserId || blockedSet.has(u.id) || !u.onboardingCompleted) return false;
        if (scope === 'local' && countryCode && u.country?.code !== countryCode) return false;
        return true;
      })
      .sort((a, b) => {
        const likesDiff = (b.likesCount || 0) - (a.likesCount || 0);
        if (likesDiff !== 0) return likesDiff;
        return (b.giftsReceivedCount || 0) - (a.giftsReceivedCount || 0);
      });

  let activeUnsub = () => {};
  let disposed = false;

  activeUnsub = onSnapshot(
    query(usersRef, ...constraints),
    (snapshot) => onData(filterAndSort(snapshot)),
    (err) => {
      if (err?.code === 'failed-precondition' && !disposed) {
        if (onError) onError(err);
        const fallbackQ = query(usersRef, limit(60));
        activeUnsub = onSnapshot(fallbackQ, (snap) => onData(filterAndSort(snap)));
      } else if (onError) {
        onError(err);
      }
    }
  );

  return () => {
    disposed = true;
    activeUnsub();
  };
}

function matchesGenderPreference(currentUser, candidate) {
  const pref = currentUser?.interestedIn || 'Todos';
  if (pref === 'Todos') return true;
  if (pref === 'Mujeres') return candidate.gender === 'Mujer';
  if (pref === 'Hombres') return candidate.gender === 'Hombre';
  return true;
}

export async function fetchDiscoverProfiles({ currentUser, scope = 'global', lookingForFilter = 'Todos' }) {
  const usersRef = collection(db, 'users');
  const constraints = [];

  if (scope === 'local' && currentUser?.country?.code) {
    constraints.push(where('country.code', '==', currentUser.country.code));
  }
  constraints.push(limit(60));

  const [usersSnap, myLikesSnap] = await Promise.all([
    getDocs(query(usersRef, ...constraints)),
    getDocs(query(collection(db, 'likes'), where('fromUserId', '==', currentUser.uid))),
  ]);

  const likedIds = new Set(myLikesSnap.docs.map((d) => d.data().toUserId));
  const blockedSet = new Set(currentUser.blockedUsers || []);

  const candidates = usersSnap.docs
    .map((d) => ({ uid: d.id, id: d.id, ...d.data() }))
    .filter((u) => {
      if (u.id === currentUser.uid) return false;
      if (!u.onboardingCompleted) return false;
      if (blockedSet.has(u.id)) return false;
      if (likedIds.has(u.id)) return false;
      if (lookingForFilter !== 'Todos' && u.lookingFor !== lookingForFilter) return false;
      if (!matchesGenderPreference(currentUser, u)) return false;
      return true;
    })
    // Priorizar perfiles con Boost VIP activo primero
    .sort((a, b) => Number(isBoostActive(b)) - Number(isBoostActive(a)));

  return candidates;
}

export async function blockUser(currentUid, targetUid) {
  await updateDoc(doc(db, 'users', currentUid), {
    blockedUsers: arrayUnion(targetUid),
    updatedAt: serverTimestamp(),
  });
}

export async function reportUser({ reporterId, reportedUserId, reason, details = '' }) {
  await addDoc(collection(db, 'reports'), {
    reporterId,
    reportedUserId,
    reason,
    details: details.trim(),
    status: 'open',
    createdAt: serverTimestamp(),
  });
}
