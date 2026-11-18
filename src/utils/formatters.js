import { ECONOMY_CONFIG, VIRTUAL_GIFTS } from '../config/constants';

export function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  const parsed = Date.parse(ts);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function isBoostActive(user) {
  if (!user || !user.isBoosted || !user.boostExpiresAt) return false;
  return toMillis(user.boostExpiresAt) > Date.now();
}

export function isProActive(user) {
  if (!user || !user.isPro || !user.proExpiresAt) return false;
  return toMillis(user.proExpiresAt) > Date.now();
}

export function buildExclusivePhotoKey(targetUid, photoUrl) {
  if (!targetUid || !photoUrl) return '';
  return `${String(targetUid).trim()}::${String(photoUrl).trim()}`;
}

export function isExclusivePhoto(targetUser, photoUrl, photoIndex = 0) {
  if (!targetUser || !photoUrl || photoIndex === 0) return false;
  const list = Array.isArray(targetUser.exclusivePhotoUrls)
    ? targetUser.exclusivePhotoUrls
    : [];
  return list.includes(photoUrl);
}

export function isExclusivePhotoUnlocked({
  targetUser,
  photoUrl,
  photoIndex = 0,
  viewerUser,
  userUnlocks,
  isFreeMode = false,
}) {
  if (!isExclusivePhoto(targetUser, photoUrl, photoIndex)) return true;
  const targetUid = targetUser?.uid || targetUser?.id;
  const viewerUid = viewerUser?.uid || viewerUser?.id;
  if (targetUid && viewerUid && targetUid === viewerUid) return true;
  if (isFreeMode || isProActive(viewerUser)) return true;
  const key = buildExclusivePhotoKey(targetUid, photoUrl);
  const unlockedList = Array.isArray(userUnlocks?.unlockedPhotoKeys)
    ? userUnlocks.unlockedPhotoKeys
    : [];
  return Boolean(key && unlockedList.includes(key));
}

export function getSpendableDiamonds(user) {
  if (!user) return 0;
  return Math.max(
    0,
    Math.floor(Number(user.diamonds || 0) + Number(user.coins || 0))
  );
}

export function splitDiamondDeduction(userData, cost) {
  const cleanCost = Math.max(0, Math.floor(Number(cost || 0)));
  const currDiamonds = Math.max(0, Math.floor(Number(userData?.diamonds || 0)));
  const currCoins = Math.max(0, Math.floor(Number(userData?.coins || 0)));
  if (currDiamonds + currCoins < cleanCost) {
    return null;
  }
  if (currDiamonds >= cleanCost) {
    return { diamonds: currDiamonds - cleanCost, coins: currCoins };
  }
  const rem = cleanCost - currDiamonds;
  return { diamonds: 0, coins: currCoins - rem };
}

export function formatTimeRemaining(ts) {
  const diff = toMillis(ts) - Date.now();
  if (diff <= 0) return 'Expirado';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${remHours}h`;
  }
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${Math.max(1, mins)}m`;
}

export function formatRelativeLastSeen(ts, isOnline, options = {}) {
  if (options.hideOnlineStatus && !options.bypassPrivacy) {
    return 'Actividad discreta';
  }
  if (isOnline) {
    const ms = toMillis(ts);
    // Consider offline if heartbeat hasn't updated in > 5 minutes
    if (!ms || Date.now() - ms < 5 * 60 * 1000) {
      return 'En línea ahora';
    }
  }
  const ms = toMillis(ts);
  if (!ms) return 'Reciente';
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return 'Hace un momento';
  if (diffSec < 3600) return `Hace ${Math.floor(diffSec / 60)} min`;
  if (diffSec < 86400) return `Hace ${Math.floor(diffSec / 3600)} h`;
  return `Hace ${Math.floor(diffSec / 86400)} d`;
}

export function isUserActuallyOnline(user, options = {}) {
  if (!options.bypassPrivacy && user?.hideOnlineStatus) return false;
  if (!user?.isOnline) return false;
  const lastMs = toMillis(user.lastSeen);
  if (!lastMs) return true;
  return Date.now() - lastMs < 5 * 60 * 1000;
}

export function formatSwipeActivity(user) {
  if (user?.hideOnlineStatus) {
    return { label: 'Miembro activo', activeNow: false, hidden: true };
  }
  if (isUserActuallyOnline(user)) {
    return { label: 'En línea ahora', activeNow: true };
  }
  const ms = toMillis(user?.lastSeen);
  if (!ms) return { label: 'Activo recientemente', activeNow: false };
  const diffMin = Math.floor((Date.now() - ms) / 60000);
  if (diffMin < 60) {
    return { label: `Activo hace ${Math.max(1, diffMin)} min`, activeNow: true };
  }
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return { label: `Activo hace ${diffHours} h`, activeNow: false };
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays <= 7) {
    return { label: `Activo hace ${diffDays} d`, activeNow: false };
  }
  return { label: 'Miembro de la comunidad', activeNow: false };
}

export function isProfileVerified(user) {
  if (!user) return false;
  return Boolean(user.verifiedBadge === true || user.verificationStatus === 'approved');
}

export function triggerHaptic(pattern = 12) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignorar en navegadores sin soporte háptico
  }
}

export function calculateProfileCompletion(user) {
  if (!user) return { percent: 0, missingItems: [] };
  const checks = [
    { done: Boolean(user.name && user.name !== 'Nuevo Usuario'), label: 'Nombre' },
    { done: Boolean(user.city?.trim()), label: 'Ciudad' },
    { done: Boolean(user.bio?.trim() && user.bio.trim().length >= 8), label: 'Biografía' },
    { done: Array.isArray(user.photos) && user.photos.filter(Boolean).length >= 2, label: 'Al menos 2 fotos' },
    { done: Array.isArray(user.interests) && user.interests.length >= 2, label: 'Intereses' },
    { done: Array.isArray(user.prompts) && user.prompts.filter((p) => p?.trim()).length >= 1, label: 'Frases personales' },
    { done: Boolean(user.job?.trim()), label: 'Empleo' },
    { done: Boolean(user.height?.trim()), label: 'Estatura' },
    { done: Boolean(user.education?.trim()), label: 'Educación' },
    { done: Boolean(user.lifestyle?.trim()), label: 'Estilo de vida' },
  ];
  const completed = checks.filter((c) => c.done).length;
  const percent = Math.round((completed / checks.length) * 100);
  const missingItems = checks.filter((c) => !c.done).map((c) => c.label);
  return { percent, missingItems };
}

export function formatUSD(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

export function formatDiamondRateUSD(rate) {
  const num = Number(rate || 0);
  if (!Number.isFinite(num)) return '$0.000';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 3,
    maximumFractionDigits: 4,
  }).format(num);
}

export function calculateWithdrawalBreakdown(diamonds, config = ECONOMY_CONFIG) {
  const safeDiamonds = Math.max(0, Math.floor(Number(diamonds || 0)));
  const baseRate = Number(config?.baseDiamondValueUSD ?? ECONOMY_CONFIG.baseDiamondValueUSD);
  const netRate = Number(config?.diamondToNetUSDRate ?? ECONOMY_CONFIG.diamondToNetUSDRate);
  const grossUSD = Number((safeDiamonds * baseRate).toFixed(2));
  const netPayoutUSD = Number((safeDiamonds * netRate).toFixed(2));
  const platformFeeUSD = Number((grossUSD - netPayoutUSD).toFixed(2));
  return {
    diamonds: safeDiamonds,
    grossUSD,
    platformFeeUSD,
    netPayoutUSD,
  };
}

export function calculateGiftEconomics(diamondCost, config = ECONOMY_CONFIG) {
  const diamonds = Math.max(0, Math.floor(Number(diamondCost || 0)));
  return calculateWithdrawalBreakdown(diamonds, config);
}

export const INTEREST_ICONS = {
  Viajes: '✈️',
  Música: '🎵',
  Café: '☕',
  Cine: '🎬',
  Fitness: '💪',
  Idiomas: '🗣️',
  Fotografía: '📸',
  Gastronomía: '🍷',
  Gaming: '🎮',
  Arte: '🎨',
  Lectura: '📚',
  Baile: '💃',
  Tecnología: '💻',
  Senderismo: '🏔️',
  Mascotas: '🐾',
  Emprendimiento: '🚀',
  Playa: '🏖️',
  Anime: '✨',
};

export function formatInterestWithIcon(interest) {
  const icon = INTEREST_ICONS[interest] || '✨';
  return `${icon} ${interest}`;
}

export function calculateAffinityScore(userA, userB) {
  if (!userA || !userB) return 85;
  let score = 76;
  const shared = getSharedInterests(userA, userB).length;
  score += Math.min(14, shared * 5);
  if (userA.lookingFor && userA.lookingFor === userB.lookingFor) {
    score += 5;
  }
  if (userA.country?.code && userA.country?.code === userB.country?.code) {
    score += 3;
  }
  const ageDiff = Math.abs(Number(userA.age || 24) - Number(userB.age || 24));
  if (ageDiff <= 5) score += 2;
  return Math.min(99, Math.max(75, score));
}

export function getSharedInterests(userA, userB) {
  const listA = Array.isArray(userA?.interests) ? userA.interests : [];
  const listB = Array.isArray(userB?.interests) ? userB.interests : [];
  const setB = new Set(listB);
  return listA.filter((item) => setB.has(item));
}

export function buildMatchId(uidA, uidB) {
  const a = String(uidA || '').trim();
  const b = String(uidB || '').trim();
  if (!a || !b) return '';
  return [a, b].sort().join('_');
}

export function formatMessageTime(ts, fallbackMs) {
  const ms = toMillis(ts) || fallbackMs;
  if (!ms) return 'Ahora';
  try {
    return new Intl.DateTimeFormat('es', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ms));
  } catch {
    return '';
  }
}

export function isMatchUnread(match, currentUid, optimisticReadMs = 0) {
  if (!match || !currentUid) return false;
  if (!match.lastSenderId || match.lastSenderId === currentUid) return false;
  const lastMsgMs = Math.max(
    toMillis(match.lastMessageAt),
    Number(match.lastMessageClientMs || 0)
  );
  const lastReadMs = Math.max(
    toMillis(match.lastReadBy?.[currentUid]),
    Number(match.lastReadByClientMs?.[currentUid] || 0),
    Number(optimisticReadMs || 0)
  );
  if (!lastMsgMs) return lastReadMs === 0;
  return lastMsgMs > lastReadMs;
}

/**
 * Determina si un usuario ya tiene permiso de enviar mensajes a un perfil que exige regalo previo.
 */
export function isGiftChatUnlocked(match, senderUid, targetUser) {
  if (!targetUser?.requireGiftToChat) return true;
  const targetUid = targetUser.uid || targetUser.id;
  if (!senderUid || !targetUid || senderUid === targetUid) return true;
  if (!match) return false;
  if (match.giftUnlockedBy?.[senderUid] === true) return true;
  // Si el propio creador ya envió mensaje al usuario en esta sala, la conversación queda abierta
  if (match.lastSenderId === targetUid) return true;
  return false;
}

export function optimizeCloudinaryUrl(url, width = 800) {
  if (typeof url !== 'string' || !url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) {
    return url;
  }
  const [prefix, rest] = url.split('/image/upload/');
  if (!rest || rest.startsWith('f_auto')) {
    return url;
  }
  return `${prefix}/image/upload/f_auto,q_auto:good,c_limit,w_${width}/${rest}`;
}

export function getDisplayAge(user, { bypassPrivacy = false } = {}) {
  if (!user) return null;
  if (!bypassPrivacy && user.hideAge) return null;
  const ageNum = Number(user.age);
  if (!ageNum || Number.isNaN(ageNum)) return null;
  return ageNum;
}

export function calculateDistanceKm(geoA, geoB) {
  const lat1 = Number(geoA?.lat);
  const lon1 = Number(geoA?.lng);
  const lat2 = Number(geoB?.lat);
  const lon2 = Number(geoB?.lng);
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2)
  ) {
    return null;
  }
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(1, Math.round(R * c));
}

export function formatUserDistanceLabel(targetUser, viewerUser, { bypassPrivacy = false } = {}) {
  if (!targetUser) return { text: 'Ubicación reservada', isHidden: true };
  if (!bypassPrivacy && targetUser.hideDistance) {
    return {
      text: targetUser.country?.name ? `${targetUser.country.name} · Distancia oculta` : 'Distancia oculta',
      shortText: 'Distancia oculta',
      isHidden: true,
    };
  }

  const km = calculateDistanceKm(viewerUser?.approxGeo, targetUser?.approxGeo);
  const city = typeof targetUser.city === 'string' ? targetUser.city.trim() : '';
  const countryName = targetUser.country?.name || '';

  if (km !== null) {
    const distPart = km <= 2 ? 'A menos de 2 km' : `A ${km} km`;
    const placePart = city || countryName;
    return {
      text: placePart ? `${placePart} · ${distPart}` : distPart,
      shortText: distPart,
      km,
      isHidden: false,
    };
  }

  const viewerCity = (viewerUser?.city || '').trim().toLowerCase();
  const targetCityLower = city.toLowerCase();
  const sameCountry =
    viewerUser?.country?.code && viewerUser.country.code === targetUser.country?.code;

  if (sameCountry && viewerCity && targetCityLower && viewerCity === targetCityLower) {
    return {
      text: `${city} · En tu misma ciudad`,
      shortText: 'En tu ciudad',
      isHidden: false,
    };
  }

  if (city && countryName) {
    return { text: `${city}, ${countryName}`, shortText: city, isHidden: false };
  }
  if (city || countryName) {
    return { text: city || countryName, shortText: city || countryName, isHidden: false };
  }
  return { text: 'Comunidad global', shortText: 'Global', isHidden: false };
}

function stableHashIndex(seed, length) {
  if (!length || length <= 1) return 0;
  let hash = 0;
  const str = String(seed || '');
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash % length;
}

export function getOrderedPhotos(user, viewerSeed = '', { respectSmart = true } = {}) {
  const clean = Array.isArray(user?.photos) ? user.photos.filter(Boolean) : [];
  if (clean.length === 0) return [];
  if (!respectSmart || !user?.smartPhotos || clean.length === 1) {
    return clean;
  }

  const exclusiveSet = new Set(
    Array.isArray(user?.exclusivePhotoUrls) ? user.exclusivePhotoUrls : []
  );
  const bestUrl = typeof user.smartBestPhotoUrl === 'string' ? user.smartBestPhotoUrl : '';
  if (bestUrl && clean.includes(bestUrl) && !exclusiveSet.has(bestUrl)) {
    return [bestUrl, ...clean.filter((url) => url !== bestUrl)];
  }

  const leadIdx = stableHashIndex(`${user.uid || user.id || ''}:${viewerSeed}`, clean.length);
  if (leadIdx === 0 || exclusiveSet.has(clean[leadIdx])) return clean;
  return [clean[leadIdx], ...clean.filter((_, i) => i !== leadIdx)];
}

export function getPrimaryPhoto(user, width = 600, options = {}) {
  const ordered = getOrderedPhotos(user, options.seed || '', {
    respectSmart: options.respectSmart !== false,
  });
  if (ordered.length > 0) {
    return optimizeCloudinaryUrl(ordered[0], width);
  }
  if (typeof user?.photo === 'string' && user.photo) {
    return optimizeCloudinaryUrl(user.photo, width);
  }
  const initial = (user?.name || 'U').charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ffe4ea"/><stop offset="50%" stop-color="#fef3c7"/><stop offset="100%" stop-color="#fce7f3"/></linearGradient></defs><rect width="400" height="500" fill="url(#bg)"/><circle cx="200" cy="210" r="82" fill="#ffffff" opacity="0.75"/><text x="200" y="236" text-anchor="middle" fill="#e11d54" font-family="Plus Jakarta Sans, system-ui, sans-serif" font-size="80" font-weight="800">${initial}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Ordena los regalos recibidos por un usuario del de mayor valor al menor (y por conteo como desempate).
 */
export function getSortedReceivedGifts(user, giftsCatalog = VIRTUAL_GIFTS) {
  const counts = user?.giftCounts;
  if (!counts || typeof counts !== 'object') return [];
  const catalog = Array.isArray(giftsCatalog) && giftsCatalog.length > 0 ? giftsCatalog : VIRTUAL_GIFTS;
  return catalog
    .map((gift) => ({
      ...gift,
      count: Math.max(0, Math.floor(Number(counts[gift.id] || 0))),
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => {
      if (b.price !== a.price) return b.price - a.price;
      return b.count - a.count;
    });
}

export function formatGiftBadgeCount(count) {
  const n = Math.max(0, Math.floor(Number(count || 0)));
  if (n >= 10000) {
    return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return String(n);
}

export function formatGiftDate(ts) {
  const ms = toMillis(ts);
  if (!ms) return 'Reciente';
  try {
    return new Intl.DateTimeFormat('es', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ms));
  } catch {
    return 'Reciente';
  }
}
