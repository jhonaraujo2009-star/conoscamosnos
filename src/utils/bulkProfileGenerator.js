import {
  COUNTRIES,
  INTERESTS_CATALOG,
  LIFESTYLE_OPTIONS,
  LOOKING_FOR_OPTIONS,
  MIN_AGE,
} from '../config/constants.js';

export const COUNTRY_CITIES = {
  CO: [
    { city: 'Bogotá', lat: 4.711, lng: -74.0721 },
    { city: 'Medellín', lat: 6.2476, lng: -75.5658 },
    { city: 'Cali', lat: 3.4516, lng: -76.532 },
    { city: 'Barranquilla', lat: 10.9639, lng: -74.7964 },
    { city: 'Cartagena', lat: 10.391, lng: -75.4794 },
  ],
  VE: [
    { city: 'Caracas', lat: 10.4806, lng: -66.9036 },
    { city: 'Valencia', lat: 10.162, lng: -68.0077 },
    { city: 'Maracaibo', lat: 10.6427, lng: -71.6125 },
    { city: 'Barquisimeto', lat: 10.0678, lng: -69.3474 },
    { city: 'Lechería', lat: 10.1897, lng: -64.6956 },
  ],
  MX: [
    { city: 'Ciudad de México', lat: 19.4326, lng: -99.1332 },
    { city: 'Guadalajara', lat: 20.6597, lng: -103.3496 },
    { city: 'Monterrey', lat: 25.6866, lng: -100.3161 },
    { city: 'Cancún', lat: 21.1619, lng: -86.8515 },
    { city: 'Mérida', lat: 20.9674, lng: -89.5926 },
  ],
  AR: [
    { city: 'Buenos Aires', lat: -34.6037, lng: -58.3816 },
    { city: 'Córdoba', lat: -31.4201, lng: -64.1888 },
    { city: 'Rosario', lat: -32.9442, lng: -60.6505 },
    { city: 'Mendoza', lat: -32.8895, lng: -68.8458 },
  ],
  ES: [
    { city: 'Madrid', lat: 40.4168, lng: -3.7038 },
    { city: 'Barcelona', lat: 41.3874, lng: 2.1686 },
    { city: 'Valencia', lat: 39.4699, lng: -0.3763 },
    { city: 'Sevilla', lat: 37.3891, lng: -5.9845 },
    { city: 'Málaga', lat: 36.7213, lng: -4.4214 },
  ],
  US: [
    { city: 'Miami', lat: 25.7617, lng: -80.1918 },
    { city: 'Nueva York', lat: 40.7128, lng: -74.006 },
    { city: 'Los Ángeles', lat: 34.0522, lng: -118.2437 },
    { city: 'Houston', lat: 29.7604, lng: -95.3698 },
    { city: 'Orlando', lat: 28.5383, lng: -81.3792 },
  ],
  CL: [
    { city: 'Santiago', lat: -33.4489, lng: -70.6693 },
    { city: 'Viña del Mar', lat: -33.0245, lng: -71.5518 },
    { city: 'Concepción', lat: -36.8201, lng: -73.0444 },
  ],
  PE: [
    { city: 'Lima', lat: -12.0464, lng: -77.0428 },
    { city: 'Arequipa', lat: -16.409, lng: -71.5375 },
    { city: 'Cusco', lat: -13.5319, lng: -71.9675 },
  ],
  EC: [
    { city: 'Quito', lat: -0.1807, lng: -78.4678 },
    { city: 'Guayaquil', lat: -2.1894, lng: -79.8891 },
    { city: 'Cuenca', lat: -2.9001, lng: -79.0059 },
  ],
  PA: [
    { city: 'Ciudad de Panamá', lat: 8.9824, lng: -79.5199 },
    { city: 'Boquete', lat: 8.7802, lng: -82.4414 },
    { city: 'Colón', lat: 9.3545, lng: -79.9001 },
  ],
  DO: [
    { city: 'Santo Domingo', lat: 18.4861, lng: -69.9312 },
    { city: 'Punta Cana', lat: 18.5601, lng: -68.3725 },
    { city: 'Santiago', lat: 19.4517, lng: -70.697 },
  ],
  BR: [
    { city: 'São Paulo', lat: -23.5505, lng: -46.6333 },
    { city: 'Río de Janeiro', lat: -22.9068, lng: -43.1729 },
    { city: 'Florianópolis', lat: -27.5954, lng: -48.548 },
  ],
  CR: [
    { city: 'San José', lat: 9.9281, lng: -84.0907 },
    { city: 'Tamarindo', lat: 10.2993, lng: -85.8371 },
    { city: 'Escazú', lat: 9.9189, lng: -84.1399 },
  ],
  UY: [
    { city: 'Montevideo', lat: -34.9011, lng: -56.1645 },
    { city: 'Punta del Este', lat: -34.9632, lng: -54.9438 },
  ],
  BO: [
    { city: 'Santa Cruz', lat: -17.7833, lng: -63.1821 },
    { city: 'La Paz', lat: -16.4897, lng: -68.1193 },
    { city: 'Cochabamba', lat: -17.3935, lng: -66.157 },
  ],
  PY: [
    { city: 'Asunción', lat: -25.2637, lng: -57.5759 },
    { city: 'Encarnación', lat: -27.3306, lng: -55.8667 },
  ],
  GT: [
    { city: 'Ciudad de Guatemala', lat: 14.6349, lng: -90.5069 },
    { city: 'Antigua Guatemala', lat: 14.5586, lng: -90.7295 },
  ],
  CA: [
    { city: 'Toronto', lat: 43.6532, lng: -79.3832 },
    { city: 'Montreal', lat: 45.5017, lng: -73.5673 },
    { city: 'Vancouver', lat: 49.2827, lng: -123.1207 },
  ],
  FR: [
    { city: 'París', lat: 48.8566, lng: 2.3522 },
    { city: 'Niza', lat: 43.7102, lng: 7.262 },
    { city: 'Lyon', lat: 45.764, lng: 4.8357 },
  ],
  IT: [
    { city: 'Milán', lat: 45.4642, lng: 9.19 },
    { city: 'Roma', lat: 41.9028, lng: 12.4964 },
    { city: 'Florencia', lat: 43.7696, lng: 11.2558 },
  ],
  DE: [
    { city: 'Berlín', lat: 52.52, lng: 13.405 },
    { city: 'Múnich', lat: 48.1351, lng: 11.582 },
    { city: 'Hamburgo', lat: 53.5511, lng: 9.9937 },
  ],
  GB: [
    { city: 'Londres', lat: 51.5072, lng: -0.1276 },
    { city: 'Mánchester', lat: 53.4808, lng: -2.2426 },
    { city: 'Edimburgo', lat: 55.9533, lng: -3.1883 },
  ],
};

const FEMALE_FIRST_NAMES = [
  'Valentina', 'Camila', 'Sofía', 'Isabella', 'Luciana', 'Mariana', 'Antonella',
  'Valeria', 'Daniela', 'Gabriela', 'Victoria', 'Martina', 'Paula', 'Natalia',
  'Andrea', 'Salomé', 'Juliana', 'Samantha', 'Alejandra', 'Carolina', 'Elena',
  'Renata', 'Emilia', 'Bianca', 'Nicole', 'Oriana', 'Génesis', 'Verónica',
  'Fernanda', 'Mía', 'Catalina', 'Laura', 'Sara', 'Emma', 'Zoe', 'Jimena',
  'Regina', 'Aitana', 'Julieta', 'Chiara', 'Brianna', 'Miranda', 'Alessia', 'Giselle',
];

const MALE_FIRST_NAMES = [
  'Mateo', 'Sebastián', 'Santiago', 'Diego', 'Alejandro', 'Nicolás', 'Gabriel',
  'Daniel', 'Samuel', 'Emiliano', 'Leonardo', 'Lucas', 'Julián', 'Tomás',
  'Adrián', 'Andrés', 'Carlos', 'Miguel', 'David', 'Rafael', 'Javier',
  'Rodrigo', 'Fernando', 'Pablo', 'Iván', 'Bruno', 'Marcos', 'Thiago',
  'Martín', 'Eduardo', 'Esteban', 'Joaquín', 'Mauricio', 'Ángel', 'Manuel',
  'Cristian', 'Federico', 'Enzo', 'Alan', 'Oliver', 'Liam', 'Dante', 'Gael', 'Hugo',
];

const SURNAME_INITIALS = [
  'M.', 'R.', 'G.', 'V.', 'L.', 'C.', 'S.', 'D.', 'P.', 'A.', 'F.', 'T.', 'H.', 'N.', 'B.',
];

const BIO_OPENERS = [
  'Amante del buen café, las escapadas espontáneas y las charlas hasta tarde.',
  'Siempre con buena vibra, playlists nuevas y ganas de conocer gente auténtica.',
  'Entre trabajo creativo, gimnasio y buscar el mejor rincón gastronómico de la ciudad.',
  'Cero dramas, mucha risa y planes improvisados de fin de semana.',
  'Me encanta viajar ligero, fotografiar atardeceres y probar comida nueva.',
  'Fan de los conciertos en vivo, caminar al aire libre y una copa de vino.',
  'Curiosa por naturaleza; me conquistan el sentido del humor y la honestidad.',
  'Disfruto la playa, las series buenas y conversar con alguien que tenga temas interesantes.',
  'Buscando conexión real, risas genuinas y alguien con quien compartir buenos planes.',
  'Mente abierta, energía positiva y siempre lista para una nueva aventura.',
  'Apasionado por la música, el deporte y descubrir cafeterías escondidas.',
  'Con los pies en la tierra pero siempre planeando el próximo viaje.',
];

const BIO_CLOSERS = [
  'Si coincidimos, empieza tú con un plan diferente 😉',
  'No muerdo, así que saluda sin pena.',
  'Suma puntos si te gusta improvisar un café o sushi.',
  'Valoro el respeto, la puntualidad y la buena conversación.',
  'Cuéntame qué lugar me recomiendas conocer pronto.',
  'Swipe derecho solo si de verdad respondes mensajes 👀',
  'La vida es más divertida cuando se comparte en buena compañía.',
  'Aquí para sumar momentos bonitos, sin complicaciones.',
  'Me encantan las personas directas y con sentido del humor.',
  '¿Team playa o team montaña? Defiéndete en el chat.',
];

const OCCUPATIONS = [
  'Diseño & Marketing', 'Arquitectura', 'Fotografía', 'Emprendimiento',
  'Medicina & Salud', 'Finanzas', 'Comunicación', 'Tecnología',
  'Gastronomía', 'Turismo', 'Derecho', 'Moda y Estilo',
  'Música & Producción', 'Educación', 'Nutrición y Fitness', 'Publicidad',
];

const PROMPT_SLOT_1 = [
  'Una cita ideal conmigo empieza con un buen café o tapas y termina riendo sin ver el reloj.',
  'Lo primero que noto en alguien es su mirada, su energía al hablar y el sentido del humor.',
  'Mi plan perfecto de domingo es desayunar rico, salir a caminar y ver una buena película.',
  'Nunca digo que no a una escapada improvisada a la playa o a probar un restaurante nuevo.',
  'Mi mayor vicio sano es armar playlists para cada momento del día.',
  'Si te animas a escribirme, dime tu película favorita o el lugar al que volverías mil veces.',
];

const PROMPT_SLOT_2 = [
  'Algo que no negocio es la autenticidad, la buena vibra y el respeto mutuo.',
  'Busco a alguien con quien sea fácil ser uno mismo desde la primera conversación.',
  'Me encanta la gente apasionada por lo que hace y que disfruta los pequeños detalles.',
  'Un dato curioso sobre mí: siempre descubro los mejores sitios escondidos de la ciudad.',
  'Prometo conversaciones interesantes, cero respuestas cortantes y buena compañía.',
  'La mejor forma de ganarte mi atención es tener iniciativa y sentido del humor.',
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function pickUniqueSubset(arr, minCount, maxCount) {
  const pool = [...arr];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const count = randomInt(minCount, Math.min(maxCount, pool.length));
  return pool.slice(0, count);
}

function generateUniqueName(gender, usedNames) {
  const firstPool = gender === 'Hombre' ? MALE_FIRST_NAMES : FEMALE_FIRST_NAMES;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const first = pickRandom(firstPool);
    const candidate = attempt < 6 && !usedNames.has(first)
      ? first
      : `${first} ${pickRandom(SURNAME_INITIALS)}`;
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate);
      return candidate;
    }
  }
  const fallback = `${pickRandom(firstPool)} ${randomInt(10, 99)}`;
  usedNames.add(fallback);
  return fallback;
}

export function resolveCountryAndCity(countryCode = 'RANDOM') {
  const cleanCode = String(countryCode || 'RANDOM').trim().toUpperCase();
  const country =
    cleanCode !== 'RANDOM'
      ? COUNTRIES.find((c) => c.code === cleanCode) || pickRandom(COUNTRIES)
      : pickRandom(COUNTRIES);

  const cityList = COUNTRY_CITIES[country.code] || [{ city: country.name, lat: 4.711, lng: -74.0721 }];
  const picked = pickRandom(cityList);
  const latJitter = (Math.random() - 0.5) * 0.06;
  const lngJitter = (Math.random() - 0.5) * 0.06;

  return {
    country: { code: country.code, name: country.name, flag: country.flag },
    city: picked.city,
    approxGeo: {
      lat: Number((picked.lat + latJitter).toFixed(5)),
      lng: Number((picked.lng + lngJitter).toFixed(5)),
    },
  };
}

/**
 * Genera 1 borrador de perfil aleatorio listo para asociar a una foto subida.
 */
export function generateSingleProfileDraft({
  countryCode = 'RANDOM',
  genderMode = 'Mujer', // 'Mujer' | 'Hombre' | 'Mixto'
  minAge = 19,
  maxAge = 34,
  lookingFor = 'RANDOM',
  verifiedRatio = 35,
  onlineRatio = 45,
  allowPaidMessages = false,
  messagePriceDiamonds = 25,
  usedNames = new Set(),
} = {}) {
  const safeMinAge = Math.max(MIN_AGE, Math.min(60, Math.floor(Number(minAge) || 19)));
  const safeMaxAge = Math.max(safeMinAge, Math.min(65, Math.floor(Number(maxAge) || 34)));

  const resolvedGender =
    genderMode === 'Mixto'
      ? Math.random() < 0.5
        ? 'Mujer'
        : 'Hombre'
      : genderMode === 'Hombre'
      ? 'Hombre'
      : 'Mujer';

  const interestedIn =
    resolvedGender === 'Mujer'
      ? Math.random() < 0.85
        ? 'Hombres'
        : 'Todos'
      : Math.random() < 0.85
      ? 'Mujeres'
      : 'Todos';

  const name = generateUniqueName(resolvedGender, usedNames);
  const age = randomInt(safeMinAge, safeMaxAge);
  const { country, city, approxGeo } = resolveCountryAndCity(countryCode);
  const resolvedLookingFor =
    lookingFor && lookingFor !== 'RANDOM' && LOOKING_FOR_OPTIONS.includes(lookingFor)
      ? lookingFor
      : pickRandom(LOOKING_FOR_OPTIONS);

  const interests = pickUniqueSubset(INTERESTS_CATALOG, 3, 5);
  const job = pickRandom(OCCUPATIONS);
  const lifestyle = pickRandom(LIFESTYLE_OPTIONS);
  const opener = pickRandom(BIO_OPENERS);
  const closer = pickRandom(BIO_CLOSERS);
  const bio = `${opener} En ${city}. ${closer}`;

  const prompts = [pickRandom(PROMPT_SLOT_1), pickRandom(PROMPT_SLOT_2)];
  const isVerified = Math.random() * 100 < Math.max(0, Math.min(100, Number(verifiedRatio) || 0));
  const isOnline = Math.random() * 100 < Math.max(0, Math.min(100, Number(onlineRatio) || 0));

  return {
    name,
    age,
    gender: resolvedGender,
    interestedIn,
    country,
    city,
    approxGeo,
    job,
    lifestyle,
    bio,
    lookingFor: resolvedLookingFor,
    interests,
    prompts,
    isVerified,
    isOnline,
    allowPaidMessages: Boolean(allowPaidMessages),
    messagePriceDiamonds: Math.max(5, Math.min(500, Math.floor(Number(messagePriceDiamonds) || 25))),
  };
}

/**
 * Genera múltiples borradores aleatorios sin colisiones de nombre para lotes de 100+ fotos.
 */
export function generateBulkProfileDrafts(count, options = {}) {
  const safeCount = Math.max(0, Math.min(500, Math.floor(Number(count) || 0)));
  const usedNames = new Set();
  const list = [];
  for (let i = 0; i < safeCount; i += 1) {
    list.push(generateSingleProfileDraft({ ...options, usedNames, index: i }));
  }
  return list;
}

/**
 * Indica si un perfil generado masivamente desde Super Admin debe ocultarse de Descubrir y Explorar.
 * No afecta Chats ni Matches existentes.
 */
export function isBulkProfileHiddenFromDiscovery(user, showAdminBulkProfiles = true) {
  if (!user || user.createdByAdminBulk !== true) return false;
  return showAdminBulkProfiles === false || user.isBulkHidden === true;
}
