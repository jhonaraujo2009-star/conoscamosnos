import { AD_REWARD_CONFIG } from '../config/constants';

/**
 * Activa el tag oficial de Monetag (<script src="https://quge5.com/88/tag.min.js" data-zone="311878" async data-cfasync="false">)
 * ÚNICAMENTE bajo demanda cuando el usuario elige ver publicidad gratis en lugar de pagar 10 monedas.
 * Quienes pagan con monedas (o el Super Admin) no cargan anuncios invasivos.
 */
let lastTriggeredAt = 0;

export function triggerMonetagZoneTag({
  scriptSrc = AD_REWARD_CONFIG.monetagScriptSrc,
  zoneId = AD_REWARD_CONFIG.monetagZoneId,
} = {}) {
  if (typeof document === 'undefined' || !scriptSrc || !zoneId) {
    return false;
  }

  const now = Date.now();
  if (now - lastTriggeredAt < 2500) {
    return true;
  }
  lastTriggeredAt = now;

  try {
    const previous = document.querySelectorAll('script[data-conoscamosnos-monetag="true"]');
    previous.forEach((node) => node.remove());

    const script = document.createElement('script');
    script.src = scriptSrc;
    script.async = true;
    script.setAttribute('data-zone', String(zoneId));
    script.setAttribute('data-cfasync', 'false');
    script.setAttribute('data-conoscamosnos-monetag', 'true');

    const target = document.head || document.body;
    if (!target) return false;
    target.appendChild(script);
    return true;
  } catch {
    return false;
  }
}
