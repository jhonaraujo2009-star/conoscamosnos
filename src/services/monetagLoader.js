import { AD_REWARD_CONFIG } from '../config/constants';

const CHANNEL_NAME = 'conoscamosnos_ad_reward';

export function createAdSessionToken() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ad_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeHttpUrl(raw) {
  const value = String(raw || '').trim();
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  return '';
}

export function buildIsolatedAdViewerUrl({
  token,
  purpose = 'like',
  targetName = 'este perfil',
  duration = AD_REWARD_CONFIG.adDurationSeconds,
  directLink = AD_REWARD_CONFIG.monetagDirectLink,
  embedded = true,
} = {}) {
  if (typeof window === 'undefined') return '/ad-viewer.html';
  const safeDuration = Math.max(5, Math.min(60, Math.floor(Number(duration) || 12)));
  const resolvedDirect =
    sanitizeHttpUrl(directLink) ||
    sanitizeHttpUrl(AD_REWARD_CONFIG.monetagDirectLink) ||
    sanitizeHttpUrl(AD_REWARD_CONFIG.adsterraDirectLink) ||
    sanitizeHttpUrl(AD_REWARD_CONFIG.customSponsorUrl);

  const params = new URLSearchParams({
    token: String(token || createAdSessionToken()),
    purpose: String(purpose || 'like'),
    target: String(targetName || 'este perfil').slice(0, 60),
    duration: String(safeDuration),
    zone: String(AD_REWARD_CONFIG.monetagZoneId || '311878'),
    src: String(AD_REWARD_CONFIG.monetagScriptSrc || 'https://quge5.com/88/tag.min.js'),
    embedded: embedded ? '1' : '0',
  });

  if (resolvedDirect) {
    params.set('direct', resolvedDirect);
  }

  return `${window.location.origin}/ad-viewer.html?${params.toString()}`;
}

/**
 * Inicia una sesión aislada de Monetag para anuncios recompensados.
 *
 * Por defecto usa modo embebido (`embedded: true`) dentro de `RewardedAdModal` con un iframe
 * hacia `/ad-viewer.html` para funcionar de forma confiable en Android APK (TWA), iOS Safari
 * y navegadores con bloqueo estricto de ventanas emergentes o redirecciones con COOP.
 */
export function openIsolatedAdViewer({
  purpose = 'like',
  targetName = 'este perfil',
  duration = AD_REWARD_CONFIG.adDurationSeconds,
  directLink = AD_REWARD_CONFIG.monetagDirectLink,
  embedded = true,
} = {}) {
  const token = createAdSessionToken();
  const safeDuration = Math.max(5, Math.min(60, Math.floor(Number(duration) || 12)));
  const resolvedDirect =
    sanitizeHttpUrl(directLink) ||
    sanitizeHttpUrl(AD_REWARD_CONFIG.monetagDirectLink) ||
    sanitizeHttpUrl(AD_REWARD_CONFIG.adsterraDirectLink) ||
    sanitizeHttpUrl(AD_REWARD_CONFIG.customSponsorUrl);

  const viewerUrl = buildIsolatedAdViewerUrl({
    token,
    purpose,
    targetName,
    duration: safeDuration,
    directLink: resolvedDirect,
    embedded,
  });

  if (embedded || typeof window === 'undefined') {
    return {
      mode: 'embedded',
      token,
      opened: true,
      url: viewerUrl,
      directLink: resolvedDirect,
      purpose,
      targetName,
      duration: safeDuration,
      startedAt: Date.now(),
      windowRef: null,
    };
  }

  let popup = null;
  try {
    popup = window.open(viewerUrl, `conoscamosnos_ad_${token.slice(0, 8)}`, 'noopener');
  } catch {
    popup = null;
  }

  if (popup) {
    return {
      mode: 'isolated_tab',
      token,
      opened: true,
      url: viewerUrl,
      directLink: resolvedDirect,
      purpose,
      targetName,
      duration: safeDuration,
      startedAt: Date.now(),
      windowRef: popup,
    };
  }

  // Fallback automático a reproductor embebido si el navegador bloquea pop-ups
  return {
    mode: 'embedded',
    token,
    opened: true,
    url: buildIsolatedAdViewerUrl({
      token,
      purpose,
      targetName,
      duration: safeDuration,
      directLink: resolvedDirect,
      embedded: true,
    }),
    directLink: resolvedDirect,
    purpose,
    targetName,
    duration: safeDuration,
    startedAt: Date.now(),
    windowRef: null,
  };
}

export function subscribeAdViewerSession(token, { onCompleted, onAborted } = {}) {
  if (!token || typeof window === 'undefined') return () => {};

  let settled = false;
  const finishComplete = (payload) => {
    if (settled) return;
    settled = true;
    onCompleted?.(payload || { token, via: 'event' });
  };
  const finishAbort = (payload) => {
    if (settled) return;
    settled = true;
    onAborted?.(payload || { token, via: 'event' });
  };

  const handlePayload = (data) => {
    if (!data || data.channel !== CHANNEL_NAME || data.token !== token) return;
    if (data.type === 'ad_completed') {
      finishComplete(data);
    } else if (data.type === 'ad_aborted') {
      finishAbort(data);
    }
  };

  const onMessage = (event) => {
    if (event.origin !== window.location.origin) return;
    handlePayload(event.data);
  };
  window.addEventListener('message', onMessage);

  let bc = null;
  if ('BroadcastChannel' in window) {
    try {
      bc = new BroadcastChannel(CHANNEL_NAME);
      bc.onmessage = (event) => handlePayload(event.data);
    } catch {
      bc = null;
    }
  }

  const storageKey = `conoscamosnos_ad_done_${token}`;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw) {
      handlePayload(JSON.parse(raw));
    }
  } catch {
    // noop
  }

  const onStorage = (event) => {
    if (event.key !== storageKey || !event.newValue) return;
    try {
      handlePayload(JSON.parse(event.newValue));
    } catch {
      // noop
    }
  };
  window.addEventListener('storage', onStorage);

  return () => {
    window.removeEventListener('message', onMessage);
    window.removeEventListener('storage', onStorage);
    if (bc) {
      try {
        bc.close();
      } catch {
        // noop
      }
    }
  };
}
