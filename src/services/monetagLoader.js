import { AD_REWARD_CONFIG } from '../config/constants';

const CHANNEL_NAME = 'conoscamosnos_ad_reward';

export function createAdSessionToken() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ad_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Abre la pestaña aislada de publicidad (/ad-viewer.html) donde vive el script de Monetag.
 * Así Monetag NUNCA inyecta listeners globales sobre la app principal ni redirige clics posteriores.
 */
export function openIsolatedAdViewer({
  purpose = 'reveal_like',
  targetName = 'esta persona',
  duration = AD_REWARD_CONFIG.adDurationSeconds,
} = {}) {
  const token = createAdSessionToken();
  if (typeof window === 'undefined') {
    return { token, opened: false, url: '' };
  }

  const params = new URLSearchParams({
    token,
    dur: String(Math.max(5, Number(duration || 8))),
    purpose: purpose === 'unlock_chat' ? 'unlock_chat' : 'reveal_like',
    name: String(targetName || 'esta persona').slice(0, 40),
    zone: String(AD_REWARD_CONFIG.monetagZoneId || '311878'),
    src: String(AD_REWARD_CONFIG.monetagScriptSrc || 'https://quge5.com/88/tag.min.js'),
  });

  if (AD_REWARD_CONFIG.monetagDirectLink) {
    params.set('direct', AD_REWARD_CONFIG.monetagDirectLink);
  }

  const url = `${window.location.origin}/ad-viewer.html?${params.toString()}`;

  try {
    const adWin = window.open(url, 'conoscamosnos_ad_viewer');
    const opened = Boolean(adWin && !adWin.closed);
    if (opened && typeof adWin.focus === 'function') {
      adWin.focus();
    }
    return { token, opened, url, windowRef: adWin || null };
  } catch {
    return { token, opened: false, url, windowRef: null };
  }
}

/**
 * Escucha eventos verificados provenientes únicamente de /ad-viewer.html para un token dado.
 */
export function subscribeAdViewerSession(token, handlers = {}) {
  if (!token || typeof window === 'undefined') {
    return () => {};
  }

  const handlePayload = (data) => {
    if (!data || data.token !== token) return;
    if (data.type === 'AD_VIEW_STARTED') handlers.onStarted?.(data);
    if (data.type === 'AD_VIEW_TICK') handlers.onTick?.(data);
    if (data.type === 'AD_SPONSOR_CLICKED') handlers.onSponsorClicked?.(data);
    if (data.type === 'AD_VIEW_COMPLETED') handlers.onCompleted?.(data);
    if (data.type === 'AD_VIEW_ABORTED') handlers.onAborted?.(data);
  };

  const onMessage = (event) => {
    if (event.origin !== window.location.origin) return;
    handlePayload(event.data);
  };
  window.addEventListener('message', onMessage);

  let channel = null;
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => handlePayload(event.data);
  }

  const storageKey = `conoscamosnos_ad_evt_${token}`;
  const onStorage = (event) => {
    if (event.key !== storageKey || !event.newValue) return;
    try {
      handlePayload(JSON.parse(event.newValue));
    } catch {
      // Ignorar lectura corrupta
    }
  };
  window.addEventListener('storage', onStorage);

  return () => {
    window.removeEventListener('message', onMessage);
    window.removeEventListener('storage', onStorage);
    if (channel) {
      try {
        channel.close();
      } catch {
        // Ignorar
      }
    }
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Ignorar
    }
  };
}
