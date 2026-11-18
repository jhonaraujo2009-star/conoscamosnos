import { AD_REWARD_CONFIG } from '../config/constants';

const CHANNEL_NAME = 'conoscamosnos_ad_reward';

export function createAdSessionToken() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ad_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Abre la publicidad en una pestaña independiente:
 * - Si existe Monetag Direct Link (https://uplcm.com/4/12295528), abre ese enlace directo al primer clic.
 * - Si no existe Direct Link, abre la página aislada /ad-viewer.html.
 * En ningún caso se inyecta el script de Monetag sobre la app principal.
 */
export function openIsolatedAdViewer({
  purpose = 'reveal_like',
  targetName = 'esta persona',
  duration = AD_REWARD_CONFIG.adDurationSeconds,
  directLink: customDirectLink,
} = {}) {
  const token = createAdSessionToken();
  const startedAt = Date.now();

  if (typeof window === 'undefined') {
    return { mode: 'direct_link', token, opened: false, url: '', startedAt, windowRef: null };
  }

  const resolvedDirect =
    customDirectLink !== undefined
      ? String(customDirectLink || '').trim()
      : String(
          AD_REWARD_CONFIG.monetagDirectLink ||
            AD_REWARD_CONFIG.adsterraDirectLink ||
            AD_REWARD_CONFIG.customSponsorUrl ||
            ''
        ).trim();

  if (/^https?:\/\//i.test(resolvedDirect)) {
    try {
      const adWin = window.open(resolvedDirect, '_blank');
      const opened = Boolean(adWin && !adWin.closed);
      if (opened && typeof adWin.focus === 'function') {
        adWin.focus();
      }
      return {
        mode: 'direct_link',
        token,
        opened,
        url: resolvedDirect,
        startedAt,
        windowRef: adWin || null,
      };
    } catch {
      return {
        mode: 'direct_link',
        token,
        opened: false,
        url: resolvedDirect,
        startedAt,
        windowRef: null,
      };
    }
  }

  const params = new URLSearchParams({
    token,
    dur: String(Math.max(5, Number(duration || 8))),
    purpose: purpose === 'unlock_chat' ? 'unlock_chat' : 'reveal_like',
    name: String(targetName || 'esta persona').slice(0, 40),
    zone: String(AD_REWARD_CONFIG.monetagZoneId || '311878'),
    src: String(AD_REWARD_CONFIG.monetagScriptSrc || 'https://quge5.com/88/tag.min.js'),
  });

  const url = `${window.location.origin}/ad-viewer.html?${params.toString()}`;

  try {
    const adWin = window.open(url, 'conoscamosnos_ad_viewer');
    const opened = Boolean(adWin && !adWin.closed);
    if (opened && typeof adWin.focus === 'function') {
      adWin.focus();
    }
    return {
      mode: 'ad_viewer',
      token,
      opened,
      url,
      startedAt,
      windowRef: adWin || null,
    };
  } catch {
    return {
      mode: 'ad_viewer',
      token,
      opened: false,
      url,
      startedAt,
      windowRef: null,
    };
  }
}

/**
 * Escucha eventos verificados provenientes de /ad-viewer.html para el modo script aislado.
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
