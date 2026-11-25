/**
 * Helpers puros (sin dependencias) para la bandeja de Mensajes:
 * solicitudes prioritarias pagadas con diamantes, chats eliminados "para mí",
 * contador de no leídos y hora relativa de la lista.
 */

export const PAID_MESSAGE_MIN_PRICE = 1;
export const PAID_MESSAGE_MAX_PRICE = 5000;
export const PAID_MESSAGE_DEFAULT_PRICE = 25;
export const PAID_MESSAGE_PRICE_PRESETS = [10, 25, 50, 100];
export const PAID_MESSAGE_MAX_LENGTH = 300;

function toMs(ts) {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  const parsed = Date.parse(ts);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Devuelve un precio entero válido (1 – 5,000 💎) o el valor por defecto. */
export function clampPaidMessagePrice(raw, fallback = PAID_MESSAGE_DEFAULT_PRICE) {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < PAID_MESSAGE_MIN_PRICE) return fallback;
  return Math.min(PAID_MESSAGE_MAX_PRICE, n);
}

/** Datos de la solicitud prioritaria (mensaje pagado sin match) o null si no aplica. */
export function getPaidRequest(match) {
  if (!match || match.isPaidRequest !== true) return null;
  return {
    status: match.paidRequestStatus || 'pending',
    by: match.paidRequestBy || '',
    diamonds: Math.max(0, Math.floor(Number(match.paidRequestDiamonds || 0))),
    message: String(match.paidRequestMessage || match.lastMessage || ''),
  };
}

/** Solicitud pagada que ESTA persona recibió y aún no responde. */
export function isIncomingPendingPaidRequest(match, uid) {
  const req = getPaidRequest(match);
  return Boolean(req && req.status === 'pending' && req.by && req.by !== uid);
}

/** Solicitud pagada que ESTA persona envió y aún espera respuesta. */
export function isOutgoingPendingPaidRequest(match, uid) {
  const req = getPaidRequest(match);
  return Boolean(req && req.status === 'pending' && req.by === uid);
}

export function isRejectedPaidRequest(match) {
  const req = getPaidRequest(match);
  return Boolean(req && req.status === 'rejected');
}

/** Momento (ms) en que el usuario eliminó la conversación "solo para él", 0 si nunca. */
export function getClearedAtMs(match, uid) {
  if (!match || !uid) return 0;
  const ms = Number(match.deletedAtBy?.[uid] || 0);
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Un chat eliminado queda oculto hasta que llegue un mensaje posterior a la eliminación.
 */
export function isConversationHiddenForUser(match, uid) {
  const clearedAt = getClearedAtMs(match, uid);
  if (!clearedAt) return false;
  const lastActivity = Math.max(toMs(match?.lastMessageAt), Number(match?.lastMessageClientMs || 0));
  return lastActivity <= clearedAt;
}

/** Número de mensajes sin leer; si el hilo es antiguo (sin contador) cae a 1 cuando está marcado como no leído. */
export function getUnreadCountForUser(match, uid, legacyUnread = false) {
  const counted = Math.floor(Number(match?.unreadCount?.[uid]));
  if (Number.isFinite(counted) && counted > 0) return counted;
  return legacyUnread ? 1 : 0;
}

/** Hora para la lista: "10:45 AM" hoy, "Ayer", día de la semana (<7 d) o "12/11". */
export function formatChatListTime(ms, now = Date.now()) {
  if (!ms) return '';
  const date = new Date(ms);
  const today = new Date(now);
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(today) - startOfDay(date)) / 86400000);

  try {
    if (dayDiff <= 0) {
      return new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(date);
    }
    if (dayDiff === 1) return 'Ayer';
    if (dayDiff < 7) {
      const label = new Intl.DateTimeFormat('es', { weekday: 'short' }).format(date);
      return label.replace('.', '').replace(/^\w/, (c) => c.toUpperCase());
    }
    return new Intl.DateTimeFormat('es', { day: '2-digit', month: '2-digit' }).format(date);
  } catch {
    return '';
  }
}

export function getMatchActivityMs(match) {
  return Math.max(toMs(match?.lastMessageAt), Number(match?.lastMessageClientMs || 0));
}

export function isMatchHiddenForUser(match, uid) {
  if (!match || !uid) return false;
  return Boolean(match.hiddenBy?.[uid]);
}
