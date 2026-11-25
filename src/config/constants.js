export const DIAMOND_PACKAGES = [
  {
    id: 'pack_100',
    diamonds: 100,
    priceUSD: 1.99,
    label: 'Inicio',
    badge: null,
    bonusText: 'Para chats directos, Likes y regalos 💎',
  },
  {
    id: 'pack_550',
    diamonds: 550,
    priceUSD: 7.99,
    label: 'Popular',
    badge: '+10% Bonus',
    bonusText: 'Ideal para regalos, chats, Likes y Boost',
  },
  {
    id: 'pack_1200',
    diamonds: 1200,
    priceUSD: 14.99,
    label: 'VIP Pro',
    badge: 'Más Vendido',
    bonusText: 'Ahorra 25% en regalos, chats, Likes y Boost',
  },
  {
    id: 'pack_3000',
    diamonds: 3000,
    priceUSD: 29.99,
    label: 'Elite Global',
    badge: 'Mejor Valor',
    bonusText: 'Máximo poder en regalos, PRO, chats y Boost',
  },
];

export const PRO_PLANS = [
  {
    id: 'pro_weekly',
    title: 'Conoscamosnos PRO · 7 Días',
    shortLabel: 'PRO Semanal',
    durationDays: 7,
    priceUSD: 4.99,
    priceDiamonds: 250,
    badge: 'Acceso Total',
    subtitle:
      '7 días con mensajes directos ilimitados sin Match, ver quién dio Like a tus fotos, Modo Pasaporte y Cero Anuncios.',
  },
  {
    id: 'pro_monthly',
    title: 'Conoscamosnos PRO · 30 Días',
    shortLabel: 'PRO Mensual',
    durationDays: 30,
    priceUSD: 12.99,
    priceDiamonds: 600,
    badge: 'Más Popular · -35%',
    subtitle:
      '30 días VIP con chats ilimitados, todos tus Likes y fotos revelados, Pasaporte global, filtros Check Azul/Online e insignia PRO.',
  },
];

export const BOOST_PLANS = [
  {
    id: 'boost_24h',
    durationHours: 24,
    costDiamonds: 50,
    title: 'Boost Express 24h',
    subtitle: 'Aparece primero en el Carrusel VIP de tu país durante 24 horas.',
    badge: 'Rápido',
  },
  {
    id: 'boost_7d',
    durationHours: 24 * 7,
    costDiamonds: 200,
    title: 'Boost VIP Semanal (7 días)',
    subtitle: '7 días continuos en Destacados VIP locales y globales.',
    badge: 'Ahorras 42%',
  },
];

export const MAX_PHOTOS = 6;
export const MAX_EXCLUSIVE_PHOTOS = 2;
export const EXCLUSIVE_PHOTO_DEFAULT_COST = 15;
export const MIN_AGE = 18;
export const SUPER_LIKE_WEEKLY_LIMIT_FREE = 2;
export const SUPER_LIKE_WEEKLY_LIMIT_PRO = 20;
export const DAILY_LIKE_LIMIT_FREE = 25;
export const DAILY_LIKE_LIMIT_PRO = 100;

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
 * Modelo de economía única en Diamantes (💎):
 * - El usuario adquiere Diamantes disponibles (diamonds) para chats sin Match, Likes, Fotos VIP, Boost, PRO y Regalos.
 * - Al recibir Regalos o desbloqueos de Fotos Exclusivas VIP, el creador acumula 1:1 en Diamantes Ganados (earningsDiamonds).
 * - Valor base de referencia por diamante = $0.01 USD (editable en Admin).
 * - Reparto editable desde Super Admin: por defecto 60% neto para el creador ($0.006 USD/💎), 40% para la plataforma.
 */
export const ECONOMY_CONFIG = {
  baseDiamondValueUSD: 0.01,
  creatorShareRatio: 0.6,
  platformFeeRatio: 0.4,
  diamondToNetUSDRate: 0.006, // $0.006 USD netos retirables por cada diamante ganado
  minWithdrawalDiamonds: 500, // 500 diamantes ganados = $3.00 USD netos mínimos
};

const VITE_ENV = (typeof import.meta !== 'undefined' && import.meta.env) || {};

export function resolveDirectPaymentMethods(economyConfig = null) {
  const defaultBinanceId = VITE_ENV.VITE_BINANCE_PAY_ID || '';
  const defaultZinliEmail = VITE_ENV.VITE_ZINLI_EMAIL || 'jhonaraujo2009@gmail.com';
  const defaultPagoMovil =
    VITE_ENV.VITE_PAGO_MOVIL_INFO ||
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
          qrImageUrl: VITE_ENV.VITE_ZINLI_QR_URL || '/zinli-qr.png',
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

export const ENABLE_DEMO_PAYMENTS = VITE_ENV.VITE_ENABLE_DEMO_PAYMENTS === 'true';

/**
 * Configuración base del sistema de Publicidad Recompensada (Rewarded Ads) vs. Diamantes (💎):
 * El Super Admin puede anular estos valores en tiempo real desde appConfig/economy.
 */
export const AD_REWARD_CONFIG = {
  provider: VITE_ENV.VITE_AD_PROVIDER || 'monetag',
  adDurationSeconds: Math.max(5, Number(VITE_ENV.VITE_AD_DURATION_SECONDS || 12)),
  adsenseClient: VITE_ENV.VITE_ADSENSE_CLIENT || '',
  monetagZoneId: VITE_ENV.VITE_MONETAG_ZONE_ID || '311878',
  monetagScriptSrc: VITE_ENV.VITE_MONETAG_SCRIPT_SRC || 'https://quge5.com/88/tag.min.js',
  monetagDirectLink: VITE_ENV.VITE_MONETAG_DIRECT_LINK || 'https://uplcm.com/4/12295528',
  adsterraDirectLink: VITE_ENV.VITE_ADSTERRA_DIRECT_LINK || '',
  customSponsorUrl: VITE_ENV.VITE_CUSTOM_SPONSOR_URL || '',
  unlockMode: 'hybrid',
  enableDiamondCharges: true,
  enableRewardedAds: true,
  unlockLikeDiamonds: 2,
  unlockAllLikesDiamonds: 10,
  unlockChatDiamonds: 2,
  unlockExclusivePhotoDiamonds: 15,
  estimatedAdCpmUSD: 5,
};

export const ACCESS_MODE_OPTIONS = [
  {
    id: 'free',
    label: 'Modo Libre (Gratis)',
    shortLabel: 'Libre',
    description: 'Sin cobrar diamantes ni mostrar anuncios al chatear o ver Likes. Ideal para atraer y retener público nuevo.',
    enableDiamondCharges: false,
    enableRewardedAds: false,
  },
  {
    id: 'ads_only',
    label: 'Solo Anuncios',
    shortLabel: 'Solo Ads',
    description: 'Gratis para tus usuarios sin gastar diamantes: desbloquean viendo 1 anuncio Monetag.',
    enableDiamondCharges: false,
    enableRewardedAds: true,
  },
  {
    id: 'diamonds_only',
    label: 'Solo Diamantes (💎)',
    shortLabel: 'Solo 💎',
    description: 'Desactiva anuncios; para chatear sin Match o descubrir Likes usan Diamantes o membresía PRO.',
    enableDiamondCharges: true,
    enableRewardedAds: false,
  },
  {
    id: 'hybrid',
    label: 'Diamantes (💎) o Anuncio',
    shortLabel: 'Híbrido',
    description: 'Cada usuario elige: esperar 1 anuncio gratis, pagar con Diamantes al instante o hacerse PRO.',
    enableDiamondCharges: true,
    enableRewardedAds: true,
  },
];

export function deriveUnlockMode(enableDiamonds, enableAds) {
  if (!enableDiamonds && !enableAds) return 'free';
  if (!enableDiamonds && enableAds) return 'ads_only';
  if (enableDiamonds && !enableAds) return 'diamonds_only';
  return 'hybrid';
}

export function resolveAccessPolicy(economyConfig = null) {
  const rawMode =
    economyConfig?.unlockMode === 'coins_only' ? 'diamonds_only' : economyConfig?.unlockMode;
  const hasExplicitMode = ['free', 'ads_only', 'diamonds_only', 'hybrid'].includes(rawMode);

  const hasExplicitDiamondFlag = typeof economyConfig?.enableDiamondCharges === 'boolean';
  const hasLegacyCoinFlag = typeof economyConfig?.enableCoinCharges === 'boolean';

  let enableDiamondCharges;
  let enableRewardedAds;
  if (
    hasExplicitDiamondFlag ||
    hasLegacyCoinFlag ||
    typeof economyConfig?.enableRewardedAds === 'boolean'
  ) {
    enableDiamondCharges = hasExplicitDiamondFlag
      ? economyConfig.enableDiamondCharges
      : hasLegacyCoinFlag
      ? economyConfig.enableCoinCharges
      : true;
    enableRewardedAds =
      typeof economyConfig?.enableRewardedAds === 'boolean'
        ? economyConfig.enableRewardedAds
        : true;
  } else if (hasExplicitMode) {
    enableDiamondCharges = rawMode === 'diamonds_only' || rawMode === 'hybrid';
    enableRewardedAds = rawMode === 'ads_only' || rawMode === 'hybrid';
  } else {
    enableDiamondCharges = AD_REWARD_CONFIG.enableDiamondCharges;
    enableRewardedAds = AD_REWARD_CONFIG.enableRewardedAds;
  }

  const unlockMode = hasExplicitMode
    ? rawMode
    : deriveUnlockMode(enableDiamondCharges, enableRewardedAds);

  const effectiveDiamonds = unlockMode === 'diamonds_only' || unlockMode === 'hybrid';
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
  const unlockLikeDiamonds = Math.max(
    1,
    Math.floor(
      Number(
        economyConfig?.unlockLikeDiamonds ??
          economyConfig?.unlockLikeCoins ??
          AD_REWARD_CONFIG.unlockLikeDiamonds ??
          2
      )
    )
  );
  const unlockAllLikesDiamonds = Math.max(
    1,
    Math.floor(
      Number(
        economyConfig?.unlockAllLikesDiamonds ??
          economyConfig?.unlockAllLikesCoins ??
          AD_REWARD_CONFIG.unlockAllLikesDiamonds ??
          10
      )
    )
  );
  const unlockChatDiamonds = Math.max(
    1,
    Math.floor(
      Number(
        economyConfig?.unlockChatDiamonds ??
          economyConfig?.unlockLikeChatCoins ??
          AD_REWARD_CONFIG.unlockChatDiamonds ??
          2
      )
    )
  );
  const unlockExclusivePhotoDiamonds = Math.max(
    1,
    Math.floor(
      Number(
        economyConfig?.unlockExclusivePhotoDiamonds ??
          AD_REWARD_CONFIG.unlockExclusivePhotoDiamonds ??
          15
      )
    )
  );
  const estimatedAdCpmUSD = Math.max(
    0.1,
    Number(economyConfig?.estimatedAdCpmUSD ?? AD_REWARD_CONFIG.estimatedAdCpmUSD ?? 5)
  );
  const proPlans =
    Array.isArray(economyConfig?.proPlans) && economyConfig.proPlans.length > 0
      ? economyConfig.proPlans
      : PRO_PLANS;
  const boostPlans =
    Array.isArray(economyConfig?.boostPlans) && economyConfig.boostPlans.length > 0
      ? economyConfig.boostPlans
      : BOOST_PLANS;
  const virtualGifts = resolveVirtualGifts(economyConfig);

  return {
    unlockMode,
    isFreeMode: unlockMode === 'free',
    enableDiamondCharges: effectiveDiamonds,
    enableRewardedAds: effectiveAds,
    adDurationSeconds,
    monetagDirectLink,
    unlockLikeDiamonds,
    unlockAllLikesDiamonds,
    unlockChatDiamonds,
    unlockExclusivePhotoDiamonds,
    proPlans,
    boostPlans,
    virtualGifts,
    estimatedAdCpmUSD,
    estimatedRevenuePerAdUSD: Number(Math.max(0.0005, estimatedAdCpmUSD / 1000).toFixed(4)),
  };
}

export function resolveVirtualGifts(economyConfig = null) {
  const customList = Array.isArray(economyConfig?.virtualGifts)
    ? economyConfig.virtualGifts
    : [];
  const customById = {};
  customList.forEach((g) => {
    if (g?.id) customById[g.id] = g;
  });

  return VIRTUAL_GIFTS.map((base) => {
    const override = customById[base.id];
    if (!override) return base;
    const rawPrice = Number(override.price);
    const cleanPrice =
      Number.isFinite(rawPrice) && rawPrice >= 1
        ? Math.max(1, Math.min(50000, Math.floor(rawPrice)))
        : base.price;
    return {
      ...base,
      price: cleanPrice,
    };
  });
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
