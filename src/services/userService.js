import {
  addDoc,
  arrayRemove,
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
  setDoc,
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
  if (Array.isArray(updates.prompts)) sanitized.prompts = updates.prompts.slice(0, 4);
  if (typeof updates.height === 'string') sanitized.height = updates.height.trim();
  if (typeof updates.job === 'string') sanitized.job = updates.job.trim();
  if (typeof updates.education === 'string') sanitized.education = updates.education.trim();
  if (typeof updates.lifestyle === 'string') sanitized.lifestyle = updates.lifestyle.trim();
  if (typeof updates.smartPhotos === 'boolean') sanitized.smartPhotos = updates.smartPhotos;
  if (typeof updates.smartBestPhotoUrl === 'string') sanitized.smartBestPhotoUrl = updates.smartBestPhotoUrl;
  if (typeof updates.hideAge === 'boolean') sanitized.hideAge = updates.hideAge;
  if (typeof updates.hideDistance === 'boolean') sanitized.hideDistance = updates.hideDistance;
  if (typeof updates.hideOnlineStatus === 'boolean') sanitized.hideOnlineStatus = updates.hideOnlineStatus;
  if (typeof updates.discoverable === 'boolean') sanitized.discoverable = updates.discoverable;
  if (typeof updates.requireGiftToChat === 'boolean') {
    sanitized.requireGiftToChat = updates.requireGiftToChat;
  }
  if (updates.approxGeo !== undefined) sanitized.approxGeo = updates.approxGeo;

  await updateDoc(doc(db, 'users', uid), sanitized);
}

/**
 * Guarda la cuenta de cobro privada del usuario (Binance Pay, PayPal, banco, etc.)
 * en la subcolección estrictamente privada users/{uid}/private/payout.
 */
export async function saveUserPayoutAccount(uid, { methodId, methodName, accountValue, holderName = '' }) {
  if (!uid) throw new Error('Sesión inválida.');
  const cleanAccount = String(accountValue || '').trim();
  if (cleanAccount.length < 4) {
    throw new Error('Ingresa un número de cuenta, ID de Binance o correo de PayPal válido.');
  }
  await setDoc(
    doc(db, 'users', uid, 'private', 'payout'),
    {
      methodId: String(methodId || 'binance_pay'),
      methodName: String(methodName || 'Binance Pay (USDT)'),
      accountValue: cleanAccount,
      holderName: String(holderName || '').trim(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export function subscribeUserPayoutAccount(uid, callback) {
  if (!uid || !db) {
    callback(null);
    return () => {};
  }
  return onSnapshot(
    doc(db, 'users', uid, 'private', 'payout'),
    (snap) => {
      callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    },
    () => callback(null)
  );
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
        if (u.discoverable === false) return false;
        if (blockedSet.has(u.id)) return false;
        if (Array.isArray(u.blockedUsers) && u.blockedUsers.includes(currentUserId)) return false;
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
  constraints.push(limit(100));

  const blockedSet = new Set(blockedUsers);
  const filterAndSort = (snapshot) =>
    snapshot.docs
      .map((d) => ({ uid: d.id, id: d.id, ...d.data() }))
      .filter((u) => {
        if (u.id === currentUserId || blockedSet.has(u.id)) return false;
        if (u.discoverable === false) return false;
        if (Array.isArray(u.blockedUsers) && u.blockedUsers.includes(currentUserId)) return false;
        const hasPhoto = Array.isArray(u.photos) && u.photos.length > 0 && Boolean(u.photos[0]);
        const isReady = u.onboardingCompleted || hasPhoto || (u.name && u.name !== 'Nuevo Usuario');
        if (!isReady) return false;
        if (scope === 'local' && countryCode && u.country?.code !== countryCode) return false;
        return true;
      })
      .sort((a, b) => {
        const boostDiff = Number(isBoostActive(b)) - Number(isBoostActive(a));
        if (boostDiff !== 0) return boostDiff;
        const likesDiff = (b.likesCount || 0) - (a.likesCount || 0);
        if (likesDiff !== 0) return likesDiff;
        return (b.giftsReceivedCount || 0) - (a.giftsReceivedCount || 0);
      });

  const activeUnsub = onSnapshot(
    query(usersRef, ...constraints),
    (snapshot) => onData(filterAndSort(snapshot)),
    (err) => {
      if (onError) onError(err);
    }
  );

  return () => activeUnsub();
}

function matchesGenderPreference(preferredOrUser, candidate) {
  const pref =
    typeof preferredOrUser === 'string'
      ? preferredOrUser
      : preferredOrUser?.interestedIn || 'Todos';
  if (pref === 'Todos') return true;
  if (pref === 'Mujeres') return candidate.gender === 'Mujer';
  if (pref === 'Hombres') return candidate.gender === 'Hombre';
  return true;
}

export async function fetchDiscoverProfiles({
  currentUser,
  scope = 'global',
  lookingForFilter = 'Todos',
  genderPreference = null,
  minAge = MIN_AGE,
  maxAge = 99,
  passedIds = [],
  includeAlreadyLiked = false,
}) {
  const usersRef = collection(db, 'users');
  const constraints = [];

  if (scope === 'local' && currentUser?.country?.code) {
    constraints.push(where('country.code', '==', currentUser.country.code));
  }
  constraints.push(limit(80));

  const [usersSnap, myLikesSnap] = await Promise.all([
    getDocs(query(usersRef, ...constraints)),
    getDocs(query(collection(db, 'likes'), where('fromUserId', '==', currentUser.uid))),
  ]);

  const likedIds = new Set(myLikesSnap.docs.map((d) => d.data().toUserId));
  const passedSet = new Set(Array.isArray(passedIds) ? passedIds : []);
  const blockedSet = new Set(currentUser.blockedUsers || []);
  const resolvedGenderPref = genderPreference ?? (currentUser?.interestedIn || 'Todos');
  const safeMinAge = Math.max(MIN_AGE, Number(minAge || MIN_AGE));
  const safeMaxAge = Math.min(99, Number(maxAge || 99));

  const hasUploadedPhotos = (u) => Array.isArray(u?.photos) && u.photos.length > 0 && Boolean(u.photos[0]);

  const candidates = usersSnap.docs
    .map((d) => {
      const data = d.data();
      return {
        uid: d.id,
        id: d.id,
        ...data,
        alreadyLiked: likedIds.has(d.id),
      };
    })
    .filter((u) => {
      if (u.id === currentUser.uid) return false;
      if (u.discoverable === false) return false;
      if (blockedSet.has(u.id)) return false;
      if (Array.isArray(u.blockedUsers) && u.blockedUsers.includes(currentUser.uid)) return false;
      const isProfileReady =
        u.onboardingCompleted || hasUploadedPhotos(u) || (u.name && u.name !== 'Nuevo Usuario');
      if (!isProfileReady) return false;
      if (!includeAlreadyLiked && (likedIds.has(u.id) || passedSet.has(u.id))) return false;
      if (lookingForFilter !== 'Todos' && u.lookingFor !== lookingForFilter) return false;
      if (resolvedGenderPref !== 'Todos' && !matchesGenderPreference(resolvedGenderPref, u)) {
        return false;
      }
      const candidateAge = Number(u.age || 24);
      if (candidateAge < safeMinAge || candidateAge > safeMaxAge) return false;
      return true;
    })
    // Priorizar perfiles con fotos reales subidas y con Boost VIP activo
    .sort((a, b) => {
      const photoDiff = Number(hasUploadedPhotos(b)) - Number(hasUploadedPhotos(a));
      if (photoDiff !== 0) return photoDiff;
      const boostDiff = Number(isBoostActive(b)) - Number(isBoostActive(a));
      if (boostDiff !== 0) return boostDiff;
      return Number(matchesGenderPreference(resolvedGenderPref, b)) - Number(matchesGenderPreference(resolvedGenderPref, a));
    });

  return candidates;
}

export async function blockUser(currentUid, targetUid) {
  if (!currentUid || !targetUid || currentUid === targetUid) return;
  await updateDoc(doc(db, 'users', currentUid), {
    blockedUsers: arrayUnion(targetUid),
    updatedAt: serverTimestamp(),
  });
}

export async function unblockUser(currentUid, targetUid) {
  if (!currentUid || !targetUid) return;
  await updateDoc(doc(db, 'users', currentUid), {
    blockedUsers: arrayRemove(targetUid),
    updatedAt: serverTimestamp(),
  });
}

export async function reportUser({
  reporterId,
  reporterName = '',
  reportedUserId,
  reportedUserName = '',
  reportedUserPhoto = '',
  reason,
  details = '',
}) {
  if (!reporterId || !reportedUserId || reporterId === reportedUserId) {
    throw new Error('No puedes reportar este perfil.');
  }
  await addDoc(collection(db, 'reports'), {
    reporterId,
    reporterName: reporterName.trim(),
    reportedUserId,
    reportedUserName: reportedUserName.trim(),
    reportedUserPhoto: reportedUserPhoto || '',
    reason,
    details: details.trim(),
    status: 'open',
    createdAt: serverTimestamp(),
  });
}

/**
 * Suscribe únicamente a los reportes creados por el usuario actual (estrictamente privado por perfil).
 */
export function subscribeUserReports(reporterUid, onData, onError) {
  if (!reporterUid || !db) {
    onData([]);
    return () => {};
  }
  const q = query(collection(db, 'reports'), where('reporterId', '==', reporterUid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      onData(list);
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}

export function subscribeAllReports(onData, onError) {
  if (!db) {
    onData([]);
    return () => {};
  }
  const q = query(collection(db, 'reports'), limit(100));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      onData(list);
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}

export async function updateReportStatus({ reportId, adminId, status }) {
  await updateDoc(doc(db, 'reports', reportId), {
    status,
    reviewedBy: adminId,
    reviewedAt: serverTimestamp(),
  });
}
