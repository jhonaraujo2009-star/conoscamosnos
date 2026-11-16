import { ECONOMY_CONFIG } from '../config/constants';

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

export function formatRelativeLastSeen(ts, isOnline) {
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

export function isUserActuallyOnline(user) {
  if (!user?.isOnline) return false;
  const lastMs = toMillis(user.lastSeen);
  if (!lastMs) return true;
  return Date.now() - lastMs < 5 * 60 * 1000;
}

export function formatUSD(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

export function calculateWithdrawalBreakdown(diamonds) {
  const safeDiamonds = Math.max(0, Math.floor(Number(diamonds || 0)));
  const grossUSD = Number((safeDiamonds * ECONOMY_CONFIG.baseDiamondValueUSD).toFixed(2));
  const netPayoutUSD = Number((safeDiamonds * ECONOMY_CONFIG.diamondToNetUSDRate).toFixed(2));
  const platformFeeUSD = Number((grossUSD - netPayoutUSD).toFixed(2));
  return {
    diamonds: safeDiamonds,
    grossUSD,
    platformFeeUSD,
    netPayoutUSD,
  };
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

export function isMatchUnread(match, currentUid) {
  if (!match || !currentUid) return false;
  if (!match.lastSenderId || match.lastSenderId === currentUid) return false;
  const lastMsgMs = toMillis(match.lastMessageAt);
  const lastReadMs = toMillis(match.lastReadBy?.[currentUid]);
  if (!lastMsgMs) return true;
  return lastMsgMs > lastReadMs;
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

export function getPrimaryPhoto(user, width = 600) {
  if (Array.isArray(user?.photos) && user.photos.length > 0 && user.photos[0]) {
    return optimizeCloudinaryUrl(user.photos[0], width);
  }
  if (typeof user?.photo === 'string' && user.photo) {
    return optimizeCloudinaryUrl(user.photo, width);
  }
  const initial = (user?.name || 'U').charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ffe4ea"/><stop offset="50%" stop-color="#fef3c7"/><stop offset="100%" stop-color="#fce7f3"/></linearGradient></defs><rect width="400" height="500" fill="url(#bg)"/><circle cx="200" cy="210" r="82" fill="#ffffff" opacity="0.75"/><text x="200" y="236" text-anchor="middle" fill="#e11d54" font-family="Plus Jakarta Sans, system-ui, sans-serif" font-size="80" font-weight="800">${initial}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
