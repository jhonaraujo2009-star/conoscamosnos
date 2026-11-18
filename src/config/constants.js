export const DIAMOND_PACKAGES = [
  {
    id: 'pack_100',
    diamonds: 100,
    coins: 100,
    priceUSD: 1.99,
    label: 'Inicio',
    badge: null,
    bonusText: 'Para regalar 💎 o cambiar a monedas',
  },
  {
    id: 'pack_550',
    diamonds: 550,
    coins: 550,
    priceUSD: 7.99,
    label: 'Popular',
    badge: '+10% Bonus',
    bonusText: 'Regalos VIP y desbloqueos directos',
  },
  {
    id: 'pack_1200',
    diamonds: 1200,
    coins: 1200,
    priceUSD: 14.99,
    label: 'VIP Pro',
    badge: 'Más Vendido',
    bonusText: 'Ahorra 25% por cada diamante',
  },
  {
    id: 'pack_3000',
    diamonds: 3000,
    coins: 3000,
    priceUSD: 29.99,
    label: 'Elite Global',
    badge: 'Mejor Valor',
    bonusText: 'Máximo poder en regalos, chats y Boost',
  },
];

export const COIN_PACKAGES = DIAMOND_PACKAGES;

export const DIAMOND_TO_COIN_PRESETS = [10, 25, 50, 100, 250];

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
  coinsPerDiamond: 2, // Tasa sugerida: 1 💎 comprado = 2 🪙 para chatear/desbloquear
  baseDiamondValueUSD: 0.01,
  creatorShareRatio: 0.6,
  platformFeeRatio: 0.4,
  diamondToNetUSDRate: 0.006, // $0.006 USD netos retirables por cada diamante ganado
  minWithdrawalDiamonds: 500, // 500 diamantes ganados = $3.00 USD netos mínimos
};

export function resolveDirectPaymentMethods(economyConfig = null) {
  const defaultBinanceId = import.meta.env.VITE_BINANCE_PAY_ID || '';
  const defaultZinliEmail = import.meta.env.VITE_ZINLI_EMAIL || 'jhonaraujo2009@gmail.com';
  const defaultPagoMovil =
    import.meta.env.VITE_PAGO_MOVIL_INFO ||
    '0412-0496690 | V-23493744 | Banco de Venezuela (0102)';

  const liveChannels = economyConfig?.paymentChannels || {};
  const binanceId = String(liveChannels.binancePayId ?? defaultBinanceId).trim();
  const enableBinance =
    liveChannels.enableBinancePay !== undefined
      ? Boolean(liveChannels.enableBinancePay && binanceId)
      : Boolean(binanceId);
  const enableZinli = liveChannels.enableZinli !== undefined ? Boolean(liveChannels.enableZinli) : true;
  const zinliEmail = String(liveChannels.zinliEmail ?? defaultZinliEmail).trim() || defaultZinliEmail;
  const enablePagoMovil =
    liveChannels.enablePagoMovil !== undefined ? Boolean(liveChannels.enablePagoMovil) : true;
  const pagoMovilInfo =
    String(liveChannels.pagoMovilInfo ?? defaultPagoMovil).trim() || defaultPagoMovil;

  return [
    enableBinance && binanceId
      ? {
          id: 'binance_pay',
          name: 'Binance Pay (USDT)',
          currency: 'USDT',
          badge: 'Instantáneo Global',
          accountLabel: 'Binance Pay ID / Correo',
          accountValue: binanceId,
          extraInstructions:
            'Envía exactamente el monto equivalente en USDT (1 USDT = 1 USD) sin comisiones de red usando Binance Pay.',
          qrPrefix: 'binance://pay?id=',
        }
      : null,
    enableZinli
      ? {
          id: 'zinli',
          name: 'Zinli (USD)',
          currency: 'USD',
          badge: 'USD Directo',
          accountLabel: 'Correo registrado en Zinli',
          accountValue: zinliEmail,
          extraInstructions:
            'Abre tu app Zinli, toca Enviar dinero en USD a este correo (o escanea el QR oficial) y adjunta tu captura con el número de referencia.',
          qrPrefix: 'zinli://pay?to=',
          qrImageUrl: import.meta.env.VITE_ZINLI_QR_URL || '/zinli-qr.png',
        }
      : null,
    enablePagoMovil
      ? {
          id: 'pago_movil',
          name: 'Pago Móvil (Venezuela)',
          currency: 'VES',
          badge: 'Banco de Venezuela',
          accountLabel: 'Teléfono · Cédula · Banco',
          accountValue: pagoMovilInfo,
          extraInstructions:
            'Calcula el monto en Bolívares a la tasa BCV del día y adjunta los últimos dígitos de referencia + captura del Pago Móvil.',
          qrPrefix: 'pagomovil://pay?data=',
        }
      : null,
  ].filter(Boolean);
}

export const DIRECT_PAYMENT_METHODS = resolveDirectPaymentMethods();

export const WITHDRAWAL_PAYOUT_METHODS = [
  { id: 'binance_pay', name: 'Binance Pay (USDT)', placeholder: 'Tu Binance Pay ID o correo de Binance' },
  { id: 'zinli', name: 'Zinli (USD)', placeholder: 'Tu correo o teléfono registrado en Zinli' },
  { id: 'pago_movil', name: 'Pago Móvil (Local)', placeholder: 'Banco + Teléfono + Cédula/Documento' },
];

export const ENABLE_DEMO_PAYMENTS = import.meta.env.VITE_ENABLE_DEMO_PAYMENTS === 'true';

/**
 * Configuración base del sistema de Publicidad Recompensada (Rewarded Ads) vs. Monedas:
 * El Super Admin puede anular estos valores en tiempo real desde appConfig/economy.
 */
export const AD_REWARD_CONFIG = {
  provider: import.meta.env.VITE_AD_PROVIDER || 'monetag',
  adDurationSeconds: Math.max(5, Number(import.meta.env.VITE_AD_DURATION_SECONDS || 12)),
  adsenseClient: import.meta.env.VITE_ADSENSE_CLIENT || '',
  monetagZoneId: import.meta.env.VITE_MONETAG_ZONE_ID || '311878',
  monetagScriptSrc: import.meta.env.VITE_MONETAG_SCRIPT_SRC || 'https://quge5.com/88/tag.min.js',
  monetagDirectLink: import.meta.env.VITE_MONETAG_DIRECT_LINK || 'https://uplcm.com/4/12295528',
  adsterraDirectLink: import.meta.env.VITE_ADSTERRA_DIRECT_LINK || '',
  customSponsorUrl: import.meta.env.VITE_CUSTOM_SPONSOR_URL || '',
  unlockMode: 'hybrid',
  enableCoinCharges: true,
  enableRewardedAds: true,
  unlockLikeCoins: 10,
  unlockAllLikesCoins: 30,
  unlockLikeChatCoins: 10,
  estimatedAdCpmUSD: 5,
};

export const ACCESS_MODE_OPTIONS = [
  {
    id: 'free',
    label: 'Modo Libre (Gratis)',
    shortLabel: 'Libre',
    description: 'Sin cobrar monedas ni mostrar anuncios al chatear o ver Likes. Ideal para atraer y retener público nuevo.',
    enableCoinCharges: false,
    enableRewardedAds: false,
  },
  {
    id: 'ads_only',
    label: 'Solo Anuncios',
    shortLabel: 'Solo Ads',
    description: 'Gratis para tus usuarios sin gastar monedas: desbloquean viendo 1 anuncio Monetag.',
    enableCoinCharges: false,
    enableRewardedAds: true,
  },
  {
    id: 'coins_only',
    label: 'Solo Monedas',
    shortLabel: 'Solo Monedas',
    description: 'Desactiva anuncios; para chatear sin Match o descubrir Likes deben usar monedas.',
    enableCoinCharges: true,
    enableRewardedAds: false,
  },
  {
    id: 'hybrid',
    label: 'Monedas o Anuncio',
    shortLabel: 'Híbrido',
    description: 'Cada usuario elige: esperar 1 anuncio gratis o pagar con monedas al instante.',
    enableCoinCharges: true,
    enableRewardedAds: true,
  },
];

export function deriveUnlockMode(enableCoins, enableAds) {
  if (!enableCoins && !enableAds) return 'free';
  if (!enableCoins && enableAds) return 'ads_only';
  if (enableCoins && !enableAds) return 'coins_only';
  return 'hybrid';
}

export function resolveAccessPolicy(economyConfig = null) {
  const hasExplicitMode = ['free', 'ads_only', 'coins_only', 'hybrid'].includes(
    economyConfig?.unlockMode
  );

  let enableCoinCharges;
  let enableRewardedAds;
  if (
    typeof economyConfig?.enableCoinCharges === 'boolean' ||
    typeof economyConfig?.enableRewardedAds === 'boolean'
  ) {
    enableCoinCharges =
      typeof economyConfig?.enableCoinCharges === 'boolean'
        ? economyConfig.enableCoinCharges
        : true;
    enableRewardedAds =
      typeof economyConfig?.enableRewardedAds === 'boolean'
        ? economyConfig.enableRewardedAds
        : true;
  } else if (hasExplicitMode) {
    enableCoinCharges =
      economyConfig.unlockMode === 'coins_only' || economyConfig.unlockMode === 'hybrid';
    enableRewardedAds =
      economyConfig.unlockMode === 'ads_only' || economyConfig.unlockMode === 'hybrid';
  } else {
    enableCoinCharges = AD_REWARD_CONFIG.enableCoinCharges;
    enableRewardedAds = AD_REWARD_CONFIG.enableRewardedAds;
  }

  const unlockMode = hasExplicitMode
    ? economyConfig.unlockMode
    : deriveUnlockMode(enableCoinCharges, enableRewardedAds);

  const effectiveCoins = unlockMode === 'coins_only' || unlockMode === 'hybrid';
  const effectiveAds = unlockMode === 'ads_only' || unlockMode === 'hybrid';

  const adDurationSeconds = Math.max(
    5,
    Math.min(
      60,
      Math.floor(Number(economyConfig?.adDurationSeconds ?? AD_REWARD_CONFIG.adDurationSeconds ?? 12))
    )
  );
  const monetagDirectLink = String(
    economyConfig?.monetagDirectLink ?? AD_REWARD_CONFIG.monetagDirectLink ?? ''
  ).trim();
  const unlockLikeCoins = Math.max(
    1,
    Math.floor(Number(economyConfig?.unlockLikeCoins ?? AD_REWARD_CONFIG.unlockLikeCoins ?? 10))
  );
  const unlockAllLikesCoins = Math.max(
    1,
    Math.floor(
      Number(economyConfig?.unlockAllLikesCoins ?? AD_REWARD_CONFIG.unlockAllLikesCoins ?? 30)
    )
  );
  const unlockLikeChatCoins = Math.max(
    1,
    Math.floor(
      Number(economyConfig?.unlockLikeChatCoins ?? AD_REWARD_CONFIG.unlockLikeChatCoins ?? 10)
    )
  );
  const estimatedAdCpmUSD = Math.max(
    0.1,
    Number(economyConfig?.estimatedAdCpmUSD ?? AD_REWARD_CONFIG.estimatedAdCpmUSD ?? 5)
  );
  const coinsPerDiamond = Math.max(
    1,
    Math.min(100, Math.floor(Number(economyConfig?.coinsPerDiamond ?? ECONOMY_CONFIG.coinsPerDiamond ?? 2)))
  );

  return {
    unlockMode,
    isFreeMode: unlockMode === 'free',
    enableCoinCharges: effectiveCoins,
    enableRewardedAds: effectiveAds,
    adDurationSeconds,
    monetagDirectLink,
    unlockLikeCoins,
    unlockAllLikesCoins,
    unlockLikeChatCoins,
    coinsPerDiamond,
    estimatedAdCpmUSD,
    estimatedRevenuePerAdUSD: Number(Math.max(0.0005, estimatedAdCpmUSD / 1000).toFixed(4)),
  };
}

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
