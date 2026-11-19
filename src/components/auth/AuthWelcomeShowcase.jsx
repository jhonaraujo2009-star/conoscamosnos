import { useState } from 'react';
import {
  BadgeCheck,
  Crown,
  Gem,
  Globe,
  Heart,
  MessageCircleHeart,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react';

const STORY_VIGNETTES = [
  {
    id: 'romance',
    tabLabel: '💘 Citas reales',
    name: 'Valentina, 26',
    initials: 'V',
    location: '🇨🇴 Medellín',
    statusPill: '¡Match mutuo!',
    quote: '¿Team café en la tarde o caminar sin rumbo hablando de todo? ☕✨',
    chips: ['Chat 1-a-1 privado', '🌹 +10 💎'],
    avatarGradient: 'from-[#FFD2DF] via-[#FFE4D4] to-[#FCE5F3]',
    avatarBorder: 'border-[#F7BECE]',
    avatarText: 'text-[#B43354]',
    auraTop: 'bg-[#FFD6E2]/60',
    auraBottom: 'bg-[#FFE6C9]/60',
    pillTone: 'bg-[#FFF0F4] border-[#F8CCD8] text-[#C83558]',
    floatChipTone: 'bg-gradient-to-r from-[#FF4F72] to-[#FF7B6B] text-white',
  },
  {
    id: 'today',
    tabLabel: '☕ Plan de hoy',
    name: 'Mateo, 29',
    initials: 'M',
    location: '🇻🇪 Caracas',
    statusPill: 'En línea ahora',
    quote: 'Libre hoy para un café rico, buena música y conocer gente auténtica 🌷',
    chips: ['Perfil verificado', '☕ +25 💎'],
    avatarGradient: 'from-[#FFE4C2] via-[#FFF0D6] to-[#FFDCD4]',
    avatarBorder: 'border-[#F3CE9F]',
    avatarText: 'text-[#9C5718]',
    auraTop: 'bg-[#FFE5BF]/65',
    auraBottom: 'bg-[#FFD9D9]/55',
    pillTone: 'bg-[#FFF6E7] border-[#F3D8A8] text-[#8D5012]',
    floatChipTone: 'bg-gradient-to-r from-[#F59E0B] to-[#F47264] text-white',
  },
  {
    id: 'global',
    tabLabel: '🌍 Global',
    name: 'Camila, 25',
    initials: 'C',
    location: '🇪🇸 Madrid',
    statusPill: 'Modo Pasaporte',
    quote: 'Amo viajar, practicar idiomas y coleccionar charlas que duren horas ✈️',
    chips: ['Sin ruido ni spam', '💎 VIP'],
    avatarGradient: 'from-[#D8ECFF] via-[#ECE4FF] to-[#FFE3EE]',
    avatarBorder: 'border-[#C5DDF7]',
    avatarText: 'text-[#31558B]',
    auraTop: 'bg-[#DCEEFF]/70',
    auraBottom: 'bg-[#E9DCFF]/60',
    pillTone: 'bg-[#EFF6FF] border-[#C9E0FA] text-[#22518A]',
    floatChipTone: 'bg-gradient-to-r from-[#4B87F5] to-[#8C6CF6] text-white',
  },
];

export default function AuthWelcomeShowcase({ mobileCtaSlot = null }) {
  const [activeStoryIdx, setActiveStoryIdx] = useState(0);
  const story = STORY_VIGNETTES[activeStoryIdx] || STORY_VIGNETTES[0];

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* 1. Hero Editorial Pastel */}
      <div className="space-y-3.5 text-center lg:text-left">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 border border-[#F2DCD6] text-[#B8415A] text-[11px] font-extrabold shadow-sm backdrop-blur-sm">
          <Sparkles className="w-3.5 h-3.5 text-[#F05A78]" />
          <span>Conexiones reales · 100% privado 1-a-1</span>
        </div>

        <h1 className="font-display text-[30px] sm:text-4xl xl:text-[44px] font-black tracking-[-0.03em] leading-[1.12] text-[#2B201E]">
          Todo empezó en un{' '}
          <span className="relative inline-block pb-1">
            <span className="font-serif-display italic font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#E63961] via-[#F25C78] to-[#E68A5C]">
              Conoscamosnos.
            </span>
            <svg
              aria-hidden="true"
              viewBox="0 0 220 14"
              fill="none"
              className="pointer-events-none absolute -bottom-0.5 left-0 w-full h-3"
              preserveAspectRatio="none"
            >
              <path
                d="M3 10.5C58 3.2 146 2.8 217 9.2"
                stroke="url(#conoscamosnosUnderline)"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="conoscamosnosUnderline" x1="3" y1="8" x2="217" y2="8" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#FF5277" stopOpacity="0.85" />
                  <stop offset="0.55" stopColor="#F89B73" stopOpacity="0.85" />
                  <stop offset="1" stopColor="#F5B971" stopOpacity="0.7" />
                </linearGradient>
              </defs>
            </svg>
          </span>
        </h1>

        <p className="text-[13px] sm:text-[15px] text-[#6A5A53] leading-relaxed max-w-xl mx-auto lg:mx-0 font-medium">
          Donde un primer saludo sincero se convierte en tu próxima historia favorita. Perfiles verificados, conversaciones 1-a-1 y un espacio cálido pensado para conectar sin ruido.
        </p>
      </div>

      {/* 2. Viñeta Interactiva Pastel: "Así se siente conectar aquí" */}
      <div className="relative overflow-hidden rounded-[28px] bg-white/85 backdrop-blur-xl border border-[#F2E2D8] p-4 sm:p-5 shadow-[0_18px_42px_-20px_rgba(196,112,126,0.22)]">
        <div
          className={`pointer-events-none absolute -right-10 -top-10 w-36 h-36 rounded-full blur-2xl transition-colors duration-500 ${story.auraTop}`}
        />
        <div
          className={`pointer-events-none absolute -left-8 -bottom-10 w-32 h-32 rounded-full blur-2xl transition-colors duration-500 ${story.auraBottom}`}
        />

        <div className="relative space-y-3.5">
          {/* Cabecera + Tabs de ambiente */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10.5px] font-black uppercase tracking-[0.14em] text-[#8E7970] flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-[#F05A78] fill-[#F05A78]/20" />
              Así se siente conectar aquí
            </span>

            <div
              role="tablist"
              aria-label="Ejemplos de conexión en Conoscamosnos"
              className="inline-flex flex-wrap items-center gap-1 p-1 rounded-2xl bg-[#FAF2EC] border border-[#EEDFD5]"
            >
              {STORY_VIGNETTES.map((item, idx) => {
                const selected = idx === activeStoryIdx;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveStoryIdx(idx)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition ${
                      selected
                        ? 'bg-white text-[#2B201E] shadow-sm border border-[#EFE0D7]'
                        : 'text-[#7A675F] hover:text-[#2B201E]'
                    }`}
                  >
                    {item.tabLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tarjeta de perfil viva + burbuja de saludo */}
          <div className="rounded-[22px] bg-[#FFFDFB]/95 border border-[#F3E5DC] p-3.5 sm:p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {/* Medallón retrato pastel sin dependencias externas */}
                <div className="relative shrink-0">
                  <div
                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br ${story.avatarGradient} border ${story.avatarBorder} flex items-center justify-center shadow-sm overflow-hidden`}
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 48 48"
                      className="w-10 h-10 opacity-30 absolute -bottom-1"
                    >
                      <circle cx="24" cy="17" r="8" fill="currentColor" className={story.avatarText} />
                      <path
                        d="M9 44c0-8.284 6.716-14 15-14s15 5.716 15 14"
                        fill="currentColor"
                        className={story.avatarText}
                      />
                    </svg>
                    <span className={`relative font-display text-lg sm:text-xl font-black ${story.avatarText}`}>
                      {story.initials}
                    </span>
                  </div>
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white"
                    aria-hidden="true"
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-display text-sm sm:text-base font-black text-[#2B201E] truncate">
                      {story.name}
                    </p>
                    <BadgeCheck className="w-4 h-4 text-sky-500 fill-sky-500 stroke-white shrink-0" />
                  </div>
                  <p className="text-[11.5px] font-semibold text-[#7A675F] truncate">
                    {story.location}
                  </p>
                </div>
              </div>

              <span
                className={`animate-soft-float px-2.5 py-1 rounded-full text-[10.5px] font-black shadow-sm shrink-0 ${story.floatChipTone}`}
              >
                {story.statusPill}
              </span>
            </div>

            {/* Burbuja de primer mensaje */}
            <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-md bg-gradient-to-r from-[#FFF4F6] via-[#FFF9F3] to-[#FFFDFB] border border-[#F5E0DD] text-xs sm:text-[13px] font-semibold text-[#3B2C28] leading-snug">
              “{story.quote}”
            </div>

            {/* Pills flotantes suaves de interacción */}
            <div className="flex flex-wrap items-center gap-1.5">
              {story.chips.map((chip) => (
                <span
                  key={chip}
                  className={`px-2.5 py-1 rounded-full border text-[10.5px] font-extrabold ${story.pillTone}`}
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Slot móvil: CTA principal al alcance del pulgar justo debajo del hero/viñeta */}
      {mobileCtaSlot && <div className="lg:hidden">{mobileCtaSlot}</div>}

      {/* 3. Tarjeta Rediseñada Programa Creador VIP (100% Pastel Claro Amigable) */}
      <div className="relative overflow-hidden rounded-[28px] p-4 sm:p-5 bg-gradient-to-br from-[#FFF8EC] via-[#FFFDF9] to-[#FFF1F5] border border-[#F1DEC7] shadow-[0_14px_34px_-18px_rgba(186,120,90,0.22)]">
        <div className="pointer-events-none absolute -right-8 -top-8 w-28 h-28 rounded-full bg-[#FFE8C8]/65 blur-2xl" />
        <div className="pointer-events-none absolute -left-8 -bottom-8 w-24 h-24 rounded-full bg-[#FFD9E3]/55 blur-2xl" />

        <div className="relative flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#FFE8C8] via-[#FFE0DA] to-[#FFD6E2] border border-[#F3CFA9] text-[#B84B39] flex items-center justify-center shrink-0 shadow-sm">
            <Crown className="w-5 h-5 stroke-[2.2]" />
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-[#FCEBD2] border border-[#EED0A7] text-[#8B521A] text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> Programa Creador VIP
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#E7F7F0] border border-[#BCE6D3] text-[#146C43] text-[10px] font-black inline-flex items-center gap-1">
                <Gem className="w-3 h-3 text-sky-600" /> Retiros en $ USD
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#F4EEFF] border border-[#DDD0FA] text-[#5B3FA6] text-[10px] font-extrabold">
                100% Opcional
              </span>
            </div>

            <p className="font-display text-[14.5px] sm:text-base font-black text-[#2B201E] leading-snug">
              Convierte los regalos y diamantes que recibas en dinero real
            </p>

            <p className="text-[11.5px] sm:text-xs text-[#6B5A53] leading-relaxed">
              Monetiza tu perfil solo si tú quieres: recibe regalos virtuales y desbloqueos VIP en Diamantes (💎) y cobra tus ganancias directo a tu cuenta:
            </p>

            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="px-2.5 py-1 rounded-full bg-[#FFF6DF] border border-[#F0DC9E] text-[#7A5600] text-[10.5px] font-extrabold inline-flex items-center gap-1">
                <Wallet className="w-3 h-3" /> Binance Pay (USDT)
              </span>
              <span className="px-2.5 py-1 rounded-full bg-[#F4EEFF] border border-[#DCD0FA] text-[#51369A] text-[10.5px] font-extrabold">
                Zinli (USD)
              </span>
              <span className="px-2.5 py-1 rounded-full bg-[#EAF6FF] border border-[#C5E2FA] text-[#175B8A] text-[10.5px] font-extrabold">
                Pago Móvil
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Pills de confianza suaves */}
      <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
        <span className="px-3 py-1.5 rounded-full bg-white/80 border border-[#EFE0D7] text-[11px] font-bold text-[#6A4E55] inline-flex items-center gap-1.5 shadow-sm">
          <MessageCircleHeart className="w-3.5 h-3.5 text-[#E63961]" /> Chats 1-a-1 privados
        </span>
        <span className="px-3 py-1.5 rounded-full bg-white/80 border border-[#EFE0D7] text-[11px] font-bold text-[#256D4E] inline-flex items-center gap-1.5 shadow-sm">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Perfiles con Check Azul
        </span>
        <span className="px-3 py-1.5 rounded-full bg-white/80 border border-[#EFE0D7] text-[11px] font-bold text-[#3B5B78] inline-flex items-center gap-1.5 shadow-sm">
          <Globe className="w-3.5 h-3.5 text-sky-600" /> Comunidad Global
        </span>
      </div>
    </div>
  );
}
