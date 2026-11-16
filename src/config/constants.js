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
    id: 'zinli_wally',
    name: 'Zinli / Wally Tech (USD)',
    currency: 'USD',
    badge: 'LATAM Sin Comisiones',
    accountLabel: 'Correo / Usuario Billetera USD',
    accountValue: import.meta.env.VITE_ZINLI_EMAIL || 'pagos@conoscamosnos.app',
    extraInstructions: 'Transferencia en USD desde Zinli o Wally Tech. Indica tu nombre de usuario en la nota.',
    qrPrefix: 'wallet://usd?to=',
  },
  {
    id: 'meru_ach',
    name: 'Meru / Transferencia ACH',
    currency: 'USD',
    badge: 'EE.UU. & Global',
    accountLabel: 'Cuenta USD / Routing ACH',
    accountValue: import.meta.env.VITE_MERU_ACCOUNT || 'MERU-USD-8849201 | Routing: 021000021',
    extraInstructions: 'Envía vía transferencia ACH o usuario Meru en USD. El saldo se acredita tras validar el comprobante.',
    qrPrefix: 'ach://account?id=',
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
  { id: 'zinli', name: 'Zinli (USD)', placeholder: 'Tu correo registrado en Zinli' },
  { id: 'wally', name: 'Wally Tech (USD)', placeholder: 'Tu número o correo Wally Tech' },
  { id: 'meru_ach', name: 'Meru / Cuenta ACH (USD)', placeholder: 'Usuario Meru o Banco + Número de Cuenta + Routing' },
  { id: 'paypal', name: 'PayPal (USD)', placeholder: 'Tu correo de PayPal' },
  { id: 'pago_movil', name: 'Pago Móvil (Local)', placeholder: 'Banco + Teléfono + Cédula/Documento' },
];

export const CHECKOUT_CONFIG = {
  lemonSqueezyBaseUrl: import.meta.env.VITE_LEMONSQUEEZY_CHECKOUT_BASE || 'https://conoscamosnos.lemonsqueezy.com/checkout/buy',
  paypalBaseUrl: import.meta.env.VITE_PAYPAL_CHECKOUT_BASE || 'https://www.paypal.com/paypalme/conoscamosnos',
};

export const LOOKING_FOR_OPTIONS = [
  'Hacer Amigos',
  'Citas',
  'Chatear / Idiomas',
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
