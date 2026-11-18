export const COIN_PACKAGES = [
  {
    id: 'pack_100',
    coins: 100,
    priceUSD: 1.99,
    label: 'Inicio',
    badge: null,
    bonusText: 'Ideal para regalos y likes VIP',
  },
  {
    id: 'pack_550',
    coins: 550,
    priceUSD: 7.99,
    label: 'Popular',
    badge: '+10% Bonus',
    bonusText: 'Incluye 50 monedas extra',
  },
  {
    id: 'pack_1200',
    coins: 1200,
    priceUSD: 14.99,
    label: 'VIP Pro',
    badge: 'Más Vendido',
    bonusText: 'Ahorra 25% por moneda',
  },
  {
    id: 'pack_3000',
    coins: 3000,
    priceUSD: 29.99,
    label: 'Elite Global',
    badge: 'Mejor Valor',
    bonusText: 'Máximo poder en regalos y Boosts',
  },
];

export const BOOST_PLANS = [
  {
    id: 'boost_24h',
    durationHours: 24,
    costCoins: 100,
    title: 'Boost Express 24h',
    subtitle: 'Aparece en el Carrusel VIP de tu país durante 24 horas.',
    badge: 'Rápido',
  },
  {
    id: 'boost_7d',
    durationHours: 24 * 7,
    costCoins: 500,
    title: 'Boost VIP Semanal (7 días)',
    subtitle: '7 días continuos en Destacados VIP locales y globales.',
    badge: 'Ahorras 28%',
  },
];

export const VIP_DM_COST = 50;
export const MAX_PHOTOS = 6;
export const MIN_AGE = 18;

export const VIRTUAL_GIFTS = [
  {
    id: 'rose',
    name: 'Rosa',
    icon: '🌹',
    price: 10,
    accent: 'from-rose-50 to-pink-50 border-rose-200 hover:border-rose-400',
    tagline: 'Un detalle romántico clásico',
  },
  {
    id: 'coffee',
    name: 'Café',
    icon: '☕',
    price: 25,
    accent: 'from-amber-50 to-orange-50 border-amber-200 hover:border-amber-400',
    tagline: 'Rompe el hielo con energía',
  },
  {
    id: 'teddy',
    name: 'Peluche',
    icon: '🧸',
    price: 50,
    accent: 'from-yellow-50 to-amber-50 border-yellow-200 hover:border-yellow-400',
    tagline: 'Ternura para alegrar el día',
  },
  {
    id: 'champagne',
    name: 'Champaña',
    icon: '🍾',
    price: 150,
    accent: 'from-emerald-50 to-teal-50 border-emerald-200 hover:border-emerald-400',
    tagline: '¡Brindemos por esta conexión!',
  },
  {
    id: 'diamond',
    name: 'Diamante Real',
    icon: '💎',
    price: 500,
    accent: 'from-sky-50 via-indigo-50 to-purple-50 border-indigo-200 hover:border-indigo-400',
    tagline: 'El regalo legendario de élite',
  },
];

/**
 * Modelo económico de ingresos de empresa y retiros de creadores:
 * - El comprador paga a la empresa en dinero real (USD / USDT / Local) al adquirir monedas.
 * - Al recibir regalos, el destinatario acumula 1 Diamante por cada moneda del regalo.
 * - Valor base de referencia por diamante = $0.01 USD.
 * - Reparto: 60% neto para el usuario creador ($0.006 USD/diamante), 40% para la empresa
 *   (cubre comisiones de pasarelas, servidores y ganancia de la plataforma).
 */
export const ECONOMY_CONFIG = {
  diamondsPerCoin: 1,
  baseDiamondValueUSD: 0.01,
  creatorShareRatio: 0.6,
  platformFeeRatio: 0.4,
  diamondToNetUSDRate: 0.006, // $0.006 USD netos retirables por cada diamante
  minWithdrawalDiamonds: 500, // 500 diamantes = $3.00 USD netos mínimos
};

export const DIRECT_PAYMENT_METHODS = [
  {
    id: 'binance_pay',
    name: 'Binance Pay (USDT Global)',
    currency: 'USDT',
    badge: 'Instantáneo Global',
    accountLabel: 'Binance Pay ID / Correo',
    accountValue: import.meta.env.VITE_BINANCE_PAY_ID || '384920194',
    extraInstructions: 'Envía exactamente el monto equivalente en USDT (1 USDT = 1 USD) sin comisiones de red usando Binance Pay.',
    qrPrefix: 'binance://pay?id=',
  },
  {
    id: 'zinli',
    name: 'Zinli (USD)',
    currency: 'USD',
    badge: 'LATAM Sin Comisiones',
    accountLabel: 'Correo / Teléfono registrado en Zinli',
    accountValue: import.meta.env.VITE_ZINLI_EMAIL || 'pagos@conoscamosnos.app',
    extraInstructions: 'Abre tu app Zinli, toca Enviar dinero en USD a este correo y adjunta la captura con tu número de referencia.',
    qrPrefix: 'zinli://pay?to=',
  },
  {
    id: 'pago_movil',
    name: 'Pago Móvil (Local)',
    currency: 'VES / Local',
    badge: 'Local Directo',
    accountLabel: 'Datos Pago Móvil',
    accountValue: import.meta.env.VITE_PAGO_MOVIL_INFO || '0414-0000000 | V-12345678 | Banesco (0134)',
    extraInstructions: 'Calcula el monto a la tasa oficial del día y adjunta los últimos 6 dígitos de referencia + captura.',
    qrPrefix: 'pagomovil://pay?data=',
  },
];

export const WITHDRAWAL_PAYOUT_METHODS = [
  { id: 'binance_pay', name: 'Binance Pay (USDT)', placeholder: 'Tu Binance Pay ID o correo de Binance' },
  { id: 'zinli', name: 'Zinli (USD)', placeholder: 'Tu correo o teléfono registrado en Zinli' },
  { id: 'pago_movil', name: 'Pago Móvil (Local)', placeholder: 'Banco + Teléfono + Cédula/Documento' },
];

export const CHECKOUT_CONFIG = {
  lemonSqueezyBaseUrl: import.meta.env.VITE_LEMONSQUEEZY_CHECKOUT_BASE || '',
};

export const ENABLE_DEMO_PAYMENTS = import.meta.env.VITE_ENABLE_DEMO_PAYMENTS === 'true';

/**
 * Configuración del sistema de Publicidad Recompensada (Rewarded Ads) vs. Monedas:
 * - provider: 'adsense_h5' | 'monetag' | 'adsterra' | 'custom_url' | 'preview'
 * - Permite desbloquear Likes y enviar mensajes gratis viendo publicidad, generando ingresos a la plataforma.
 */
export const AD_REWARD_CONFIG = {
  provider: import.meta.env.VITE_AD_PROVIDER || 'monetag',
  adDurationSeconds: Math.max(5, Number(import.meta.env.VITE_AD_DURATION_SECONDS || 8)),
  adsenseClient: import.meta.env.VITE_ADSENSE_CLIENT || '',
  monetagZoneId: import.meta.env.VITE_MONETAG_ZONE_ID || '311878',
  monetagScriptSrc: import.meta.env.VITE_MONETAG_SCRIPT_SRC || 'https://quge5.com/88/tag.min.js',
  adsterraDirectLink: import.meta.env.VITE_ADSTERRA_DIRECT_LINK || '',
  customSponsorUrl: import.meta.env.VITE_CUSTOM_SPONSOR_URL || '',
  unlockLikeCoins: 10,
  unlockAllLikesCoins: 30,
  unlockLikeChatCoins: 10,
};

export const LOOKING_FOR_OPTIONS = [
  'Nada serio',
  'Pareja estable',
  'Compromiso serio',
  'Estoy libre hoy',
  'Hacer Amigos',
  'Chatear / Idiomas',
];

export const INTENTION_MOODS = {
  Todos: {
    key: 'Todos',
    label: 'Romance',
    emoji: '💘',
    themeColor: '#1A0710',
    backdropStyle:
      'radial-gradient(ellipse 85% 45% at 50% 0%, rgba(255, 46, 84, 0.24), transparent 70%), radial-gradient(ellipse 75% 40% at 50% 100%, rgba(244, 63, 94, 0.16), transparent 70%), linear-gradient(170deg, #1A0710 0%, #2D0B1C 48%, #10040A 100%)',
    navBg: '#16060E',
    navBorder: 'rgba(255, 46, 84, 0.22)',
    pillActive:
      'bg-gradient-to-r from-[#FF2E54] to-rose-500 text-white border-rose-300/40 shadow-[0_4px_14px_rgba(255,46,84,0.35)]',
    heartButton:
      'from-[#FF2E54] to-[#FF6584] shadow-[0_10px_28px_rgba(255,46,84,0.48)]',
    cardRing: 'ring-rose-300/20',
    accentText: 'text-rose-300',
    progressGrad: 'from-[#FF2E54] to-amber-400',
  },
  'Nada serio': {
    key: 'Nada serio',
    label: 'Nada serio',
    emoji: '🍭',
    themeColor: '#1F0718',
    backdropStyle:
      'radial-gradient(ellipse 85% 45% at 50% 0%, rgba(236, 72, 153, 0.28), transparent 70%), radial-gradient(ellipse 75% 40% at 50% 100%, rgba(255, 46, 84, 0.18), transparent 70%), linear-gradient(170deg, #1F0718 0%, #3E0B2D 48%, #13040E 100%)',
    navBg: '#190613',
    navBorder: 'rgba(236, 72, 153, 0.25)',
    pillActive:
      'bg-gradient-to-r from-fuchsia-500 to-[#FF2E54] text-white border-fuchsia-300/40 shadow-[0_4px_14px_rgba(236,72,153,0.35)]',
    heartButton:
      'from-fuchsia-500 to-[#FF2E54] shadow-[0_10px_28px_rgba(236,72,153,0.45)]',
    cardRing: 'ring-fuchsia-300/25',
    accentText: 'text-fuchsia-300',
    progressGrad: 'from-fuchsia-500 to-[#FF2E54]',
  },
  'Pareja estable': {
    key: 'Pareja estable',
    label: 'Pareja estable',
    emoji: '🌷',
    themeColor: '#1D0812',
    backdropStyle:
      'radial-gradient(ellipse 85% 45% at 50% 0%, rgba(251, 113, 133, 0.26), transparent 70%), radial-gradient(ellipse 75% 40% at 50% 100%, rgba(251, 191, 36, 0.14), transparent 70%), linear-gradient(170deg, #1D0812 0%, #3B0E22 48%, #13050C 100%)',
    navBg: '#180610',
    navBorder: 'rgba(251, 113, 133, 0.24)',
    pillActive:
      'bg-gradient-to-r from-rose-500 to-pink-500 text-white border-rose-300/45 shadow-[0_4px_14px_rgba(244,63,94,0.35)]',
    heartButton:
      'from-[#FF2E54] to-amber-500 shadow-[0_10px_28px_rgba(244,63,94,0.45)]',
    cardRing: 'ring-rose-200/25',
    accentText: 'text-rose-300',
    progressGrad: 'from-rose-500 to-amber-300',
  },
  'Compromiso serio': {
    key: 'Compromiso serio',
    label: 'Compromiso serio',
    emoji: '💍',
    themeColor: '#180915',
    backdropStyle:
      'radial-gradient(ellipse 85% 45% at 50% 0%, rgba(245, 158, 11, 0.18), transparent 68%), radial-gradient(ellipse 75% 40% at 50% 100%, rgba(236, 72, 153, 0.18), transparent 70%), linear-gradient(170deg, #180915 0%, #2F1129 48%, #10050E 100%)',
    navBg: '#150712',
    navBorder: 'rgba(245, 158, 11, 0.24)',
    pillActive:
      'bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 text-white border-amber-300/45 shadow-[0_4px_14px_rgba(245,158,11,0.3)]',
    heartButton:
      'from-pink-500 via-[#FF2E54] to-amber-400 shadow-[0_10px_28px_rgba(245,158,11,0.38)]',
    cardRing: 'ring-amber-300/25',
    accentText: 'text-amber-300',
    progressGrad: 'from-pink-500 to-amber-400',
  },
  'Estoy libre hoy': {
    key: 'Estoy libre hoy',
    label: 'Libre hoy',
    emoji: '🌙',
    themeColor: '#0A0D20',
    backdropStyle:
      'radial-gradient(ellipse 85% 45% at 50% 0%, rgba(139, 92, 246, 0.28), transparent 70%), radial-gradient(ellipse 75% 40% at 50% 100%, rgba(56, 189, 248, 0.16), transparent 70%), linear-gradient(170deg, #0A0D20 0%, #1C1948 48%, #070815 100%)',
    navBg: '#090B1A',
    navBorder: 'rgba(139, 92, 246, 0.25)',
    pillActive:
      'bg-gradient-to-r from-violet-500 to-indigo-500 text-white border-violet-300/45 shadow-[0_4px_14px_rgba(139,92,246,0.38)]',
    heartButton:
      'from-violet-500 to-[#FF2E54] shadow-[0_10px_28px_rgba(139,92,246,0.45)]',
    cardRing: 'ring-violet-300/25',
    accentText: 'text-violet-300',
    progressGrad: 'from-violet-500 to-sky-400',
  },
  'Hacer Amigos': {
    key: 'Hacer Amigos',
    label: 'Hacer Amigos',
    emoji: '🤝',
    themeColor: '#071616',
    backdropStyle:
      'radial-gradient(ellipse 85% 45% at 50% 0%, rgba(16, 185, 129, 0.22), transparent 70%), radial-gradient(ellipse 75% 40% at 50% 100%, rgba(20, 184, 166, 0.14), transparent 70%), linear-gradient(170deg, #071616 0%, #0E2B2A 48%, #040D0E 100%)',
    navBg: '#061212',
    navBorder: 'rgba(16, 185, 129, 0.22)',
    pillActive:
      'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-emerald-300/45 shadow-[0_4px_14px_rgba(16,185,129,0.35)]',
    heartButton:
      'from-emerald-500 to-teal-400 shadow-[0_10px_28px_rgba(16,185,129,0.4)]',
    cardRing: 'ring-emerald-300/20',
    accentText: 'text-emerald-300',
    progressGrad: 'from-emerald-400 to-teal-400',
  },
  'Chatear / Idiomas': {
    key: 'Chatear / Idiomas',
    label: 'Idiomas',
    emoji: '🗣️',
    themeColor: '#07131E',
    backdropStyle:
      'radial-gradient(ellipse 85% 45% at 50% 0%, rgba(56, 189, 248, 0.24), transparent 70%), radial-gradient(ellipse 75% 40% at 50% 100%, rgba(99, 102, 241, 0.16), transparent 70%), linear-gradient(170deg, #07131E 0%, #0F263E 48%, #040B13 100%)',
    navBg: '#061019',
    navBorder: 'rgba(56, 189, 248, 0.22)',
    pillActive:
      'bg-gradient-to-r from-sky-500 to-indigo-500 text-white border-sky-300/45 shadow-[0_4px_14px_rgba(56,189,248,0.35)]',
    heartButton:
      'from-sky-500 to-indigo-500 shadow-[0_10px_28px_rgba(56,189,248,0.4)]',
    cardRing: 'ring-sky-300/20',
    accentText: 'text-sky-300',
    progressGrad: 'from-sky-400 to-indigo-400',
  },
};

export function getIntentionMood(intention) {
  if (!intention) return INTENTION_MOODS.Todos;
  if (intention === 'Citas') return INTENTION_MOODS['Pareja estable'];
  return INTENTION_MOODS[intention] || INTENTION_MOODS.Todos;
}

export const LIFESTYLE_OPTIONS = [
  'Estilo de vida activo',
  'Viajero frecuente',
  'Tranquilo y hogareño',
  'Nocturno y social',
  'Emprendedor / Enfoque',
];

export const GENDERS = [
  'Mujer',
  'Hombre',
  'No binario',
];

export const INTERESTED_IN_OPTIONS = [
  'Mujeres',
  'Hombres',
  'Todos',
];

export const COUNTRIES = [
  { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
  { code: 'VE', name: 'Venezuela', flag: '🇻🇪' },
  { code: 'MX', name: 'México', flag: '🇲🇽' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'ES', name: 'España', flag: '🇪🇸' },
  { code: 'US', name: 'Estados Unidos', flag: '🇺🇸' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱' },
  { code: 'PE', name: 'Perú', flag: '🇵🇪' },
  { code: 'EC', name: 'Ecuador', flag: '🇪🇨' },
  { code: 'PA', name: 'Panamá', flag: '🇵🇦' },
  { code: 'DO', name: 'República Dominicana', flag: '🇩🇴' },
  { code: 'BR', name: 'Brasil', flag: '🇧🇷' },
  { code: 'CR', name: 'Costa Rica', flag: '🇨🇷' },
  { code: 'UY', name: 'Uruguay', flag: '🇺🇾' },
  { code: 'BO', name: 'Bolivia', flag: '🇧🇴' },
  { code: 'PY', name: 'Paraguay', flag: '🇵🇾' },
  { code: 'GT', name: 'Guatemala', flag: '🇬🇹' },
  { code: 'CA', name: 'Canadá', flag: '🇨🇦' },
  { code: 'FR', name: 'Francia', flag: '🇫🇷' },
  { code: 'IT', name: 'Italia', flag: '🇮🇹' },
  { code: 'DE', name: 'Alemania', flag: '🇩🇪' },
  { code: 'GB', name: 'Reino Unido', flag: '🇬🇧' },
];

export const INTERESTS_CATALOG = [
  'Viajes',
  'Música',
  'Café',
  'Cine',
  'Fitness',
  'Idiomas',
  'Fotografía',
  'Gastronomía',
  'Gaming',
  'Arte',
  'Lectura',
  'Baile',
  'Tecnología',
  'Senderismo',
  'Mascotas',
  'Emprendimiento',
  'Playa',
  'Anime',
];

export const REPORT_REASONS = [
  'Perfil falso o suplantación',
  'Contenido inapropiado o explícito',
  'Acoso o lenguaje ofensivo',
  'Estafa o spam comercial',
  'Menor de edad sospechado',
];
