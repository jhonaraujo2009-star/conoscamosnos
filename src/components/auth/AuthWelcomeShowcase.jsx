import { useState } from 'react';
import { BadgeCheck, Crown, Gem, Heart } from 'lucide-react';

const EDITORIAL_STORIES = [
  {
    id: 'story_01',
    indexLabel: '01',
    location: 'Medellín · Hace 2 min',
    pair: 'Valentina & Mateo',
    quote: '«¿Un café hoy a las 5? Me encantó tu perfil.»',
    tag: 'Match real',
  },
  {
    id: 'story_02',
    indexLabel: '02',
    location: 'Caracas · En línea ahora',
    pair: 'Sofía & Diego',
    quote: '«Empezamos hablando de viajes y ya vamos por nuestra tercera cita.»',
    tag: 'Chat 1-a-1',
  },
  {
    id: 'story_03',
    indexLabel: '03',
    location: 'Madrid · Comunidad Global',
    pair: 'Camila & Andrés',
    quote: '«Por fin un espacio tranquilo, cuidado y con gente real.»',
    tag: 'Verificados',
  },
];

export default function AuthWelcomeShowcase({ mobileCtaSlot = null }) {
  const [activeStoryIdx, setActiveStoryIdx] = useState(0);
  const story = EDITORIAL_STORIES[activeStoryIdx] || EDITORIAL_STORIES[0];

  return (
    <div className="space-y-6 sm:space-y-7">
      {/* A. Titular Editorial Escultórico */}
      <div className="space-y-3 text-center lg:text-left">
        <div className="inline-flex items-center justify-center lg:justify-start gap-2.5 text-[10.5px] sm:text-[11px] font-bold uppercase tracking-[0.22em] text-[#8E6F64]">
          <span className="h-px w-6 bg-[#C93254]/50" aria-hidden="true" />
          <span>Conexiones reales · Privado 1-a-1</span>
        </div>

        <h1 className="text-[#1F1715]">
          <span className="block font-display text-[32px] sm:text-[42px] xl:text-[50px] font-extrabold tracking-[-0.035em] leading-[1.04]">
            Todo empezó en un
          </span>
          <span className="block font-editorial italic font-semibold text-[44px] sm:text-[58px] xl:text-[66px] leading-[0.96] text-[#C93254] tracking-[-0.015em] mt-0.5">
            Conoscamosnos.
          </span>
        </h1>

        <p className="text-[13.5px] sm:text-[15px] text-[#6A5951] leading-relaxed max-w-lg mx-auto lg:mx-0 font-medium">
          Citas con intención, conversaciones privadas 1-a-1 y perfiles verificados en un espacio cálido creado para conectar de verdad.
        </p>
      </div>

      {/* B. Escenario Fotográfico Editorial Enmarcado en Porcelana */}
      <div className="rounded-[30px] p-1.5 bg-[#FFFDF9] border border-[#E9DCD1] shadow-[0_24px_60px_-24px_rgba(68,38,32,0.20)]">
        <div className="relative rounded-[24px] overflow-hidden aspect-[4/3] sm:aspect-[16/10] bg-[#F2E5D9]">
          <img
            src="/images/hero-couple.jpg"
            alt="Pareja disfrutando una conversación real en Conoscamosnos"
            className="w-full h-full object-cover object-center"
          />

          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1F1715]/55 via-[#1F1715]/10 to-transparent"
            aria-hidden="true"
          />

          {/* Barra superior flotante sobre la fotografía */}
          <div className="absolute top-3 inset-x-3 sm:top-4 sm:inset-x-4 flex items-center justify-between gap-2">
            <span className="px-3 py-1.5 rounded-full bg-[#FFFDF9]/90 backdrop-blur-md border border-white/70 text-[#1F1715] text-[10.5px] sm:text-[11px] font-bold inline-flex items-center gap-2 shadow-sm truncate">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="truncate">{story.location}</span>
            </span>

            <div
              role="tablist"
              aria-label="Historias de Conoscamosnos"
              className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-[#FFFDF9]/90 backdrop-blur-md border border-white/70 shadow-sm shrink-0"
            >
              {EDITORIAL_STORIES.map((item, idx) => {
                const selected = idx === activeStoryIdx;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveStoryIdx(idx)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wider transition ${
                      selected
                        ? 'bg-[#C93254] text-white shadow-sm'
                        : 'text-[#6A5951] hover:text-[#1F1715]'
                    }`}
                  >
                    {item.indexLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Susurro inferior en porcelana con retratos editoriales reales */}
          <div className="absolute bottom-3 inset-x-3 sm:bottom-4 sm:inset-x-4 bg-[#FFFDF9]/95 backdrop-blur-xl border border-white/80 rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex -space-x-2.5 shrink-0">
                <img
                  src="/images/portrait-her.jpg"
                  alt="Retrato de perfil verificado"
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-[#FFFDF9]"
                />
                <img
                  src="/images/portrait-him.jpg"
                  alt="Retrato de perfil verificado"
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-[#FFFDF9]"
                />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-extrabold text-[#1F1715] truncate">{story.pair}</p>
                  <BadgeCheck className="w-3.5 h-3.5 text-sky-500 fill-sky-500 stroke-white shrink-0" />
                  <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-[#FBF2EC] text-[#8E6F64] text-[9.5px] font-bold shrink-0">
                    {story.tag}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs font-medium text-[#5A4942] truncate">
                  {story.quote}
                </p>
              </div>
            </div>

            <div className="w-8 h-8 rounded-full bg-[#FCECEF] text-[#C93254] flex items-center justify-center shrink-0">
              <Heart className="w-4 h-4 fill-[#C93254]/20" />
            </div>
          </div>
        </div>
      </div>

      {/* C. Slot móvil directo en el lienzo crema */}
      {mobileCtaSlot && <div className="lg:hidden">{mobileCtaSlot}</div>}

      {/* D. Tarjeta Champagne Pearl — Programa Creador VIP */}
      <div className="relative overflow-hidden rounded-[28px] p-5 sm:p-6 bg-gradient-to-br from-[#FBF1E4] via-[#FFFDF9] to-[#F9ECEF] border border-[#E7D5C0] shadow-[0_20px_48px_-24px_rgba(128,84,54,0.20)]">
        <div
          className="pointer-events-none absolute inset-0 rounded-[28px] ring-1 ring-inset ring-white/60"
          aria-hidden="true"
        />

        <div className="relative space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-[0.18em] text-[#9A6B37]">
              <Crown className="w-3.5 h-3.5" />
              Programa Creador VIP
            </span>

            <span className="px-2.5 py-1 rounded-full bg-[#EDF8F2] border border-[#C6E6D4] text-[#176843] text-[10.5px] font-extrabold inline-flex items-center gap-1">
              <Gem className="w-3 h-3 text-sky-600" />
              Retiros en $ USD
            </span>
          </div>

          <h2 className="font-editorial text-[24px] sm:text-[27px] font-semibold text-[#1F1715] leading-[1.12]">
            Convierte los regalos y diamantes que recibas en dinero real.
          </h2>

          <p className="text-xs sm:text-[13px] text-[#6A5951] leading-relaxed">
            Monetiza tu perfil de forma 100% opcional recibiendo detalles y contenido exclusivo en 💎 Diamantes, y retira tus ganancias directamente cuando quieras.
          </p>

          <div className="pt-3.5 mt-1 border-t border-[#EBDCCB] flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#948074]">
              Cobros directos vía
            </span>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-2.5 py-1 rounded-full bg-[#FFFDF9] border border-[#E6D6C7] text-[10.5px] font-extrabold text-[#2C211E]">
                Binance Pay (USDT)
              </span>
              <span className="px-2.5 py-1 rounded-full bg-[#FFFDF9] border border-[#E6D6C7] text-[10.5px] font-extrabold text-[#2C211E]">
                Zinli (USD)
              </span>
              <span className="px-2.5 py-1 rounded-full bg-[#FFFDF9] border border-[#E6D6C7] text-[10.5px] font-extrabold text-[#2C211E]">
                Pago Móvil
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* E. Fila tipográfica mínima de confianza */}
      <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-3 gap-y-1 text-[11.5px] font-semibold text-[#846E63]">
        <span>Perfiles verificados</span>
        <span aria-hidden="true">·</span>
        <span>Privacidad 1-a-1</span>
        <span aria-hidden="true">·</span>
        <span>Comunidad global</span>
      </div>
    </div>
  );
}
