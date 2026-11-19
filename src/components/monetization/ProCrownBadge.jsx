function RoyalCrownSvg({ className = 'w-4 h-4', idSuffix = 'swipe' }) {
  const gradId = `proGoldGrad-${idSuffix}`;
  const glintId = `proGoldGlint-${idSuffix}`;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="2" y1="3" x2="22" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF8DB" />
          <stop offset="48%" stopColor="#F5C451" />
          <stop offset="100%" stopColor="#C98A1C" />
        </linearGradient>
        <linearGradient id={glintId} x1="12" y1="1.5" x2="12" y2="6.5" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#FDE68A" />
        </linearGradient>
      </defs>

      {/* Destello sutil superior en forma de estrella de 4 puntas */}
      <path
        d="M12 1.6L12.65 3.15L14.2 3.8L12.65 4.45L12 6L11.35 4.45L9.8 3.8L11.35 3.15L12 1.6Z"
        fill={`url(#${glintId})`}
      />

      {/* Cuerpo principal de la corona real */}
      <path
        d="M3.2 16.8L2.2 8.2L7.4 12.1L12 6.8L16.6 12.1L21.8 8.2L20.8 16.8H3.2Z"
        fill={`url(#${gradId})`}
        stroke="#FFF6CE"
        strokeWidth="0.65"
        strokeLinejoin="round"
      />

      {/* Bisel interior luminoso */}
      <path
        d="M4.6 15.6L4.1 10.7L7.5 13.3L12 8.6L16.5 13.3L19.9 10.7L19.4 15.6H4.6Z"
        fill="#FFFBEB"
        fillOpacity="0.18"
      />

      {/* Base de la corona */}
      <rect
        x="3.2"
        y="18.1"
        width="17.6"
        height="2.1"
        rx="1.05"
        fill={`url(#${gradId})`}
        stroke="#FFF6CE"
        strokeWidth="0.45"
      />

      {/* Joyas sutiles en puntas laterales */}
      <circle cx="2.2" cy="7.9" r="0.95" fill="#FFF8DB" />
      <circle cx="21.8" cy="7.9" r="0.95" fill="#FFF8DB" />
    </svg>
  );
}

/**
 * Emblema de lujo Obsidian-Velvet & Champagne-Gold para usuarios con Membresía PRO.
 * - `swipe`: cápsula horizontal elegante diseñada para la esquina derecha de las tarjetas Swipe.
 * - `compact`: píldora compacta dorada para cabecera de perfil y modal público.
 */
export default function ProCrownBadge({ variant = 'swipe', className = '' }) {
  if (variant === 'compact') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#1A120C] via-[#2B1D12] to-[#1A120C] border border-amber-300/55 shadow-[0_4px_14px_-4px_rgba(245,196,81,0.45)] shrink-0 select-none ${className}`}
        title="Membresía PRO"
      >
        <RoyalCrownSvg className="w-3 h-3 shrink-0" idSuffix="compact" />
        <span className="font-display text-[10px] font-black uppercase tracking-[0.14em] bg-gradient-to-r from-[#FFF7D6] via-[#F7CC66] to-[#E2A530] bg-clip-text text-transparent">
          PRO
        </span>
      </span>
    );
  }

  return (
    <div
      className={`relative overflow-hidden inline-flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full bg-gradient-to-r from-[#120D0A]/90 via-[#22170E]/90 to-[#120D0A]/90 backdrop-blur-md border border-amber-300/55 ring-1 ring-inset ring-amber-100/15 shadow-[0_10px_28px_-6px_rgba(0,0,0,0.72),0_0_20px_-4px_rgba(245,197,86,0.42)] pointer-events-none select-none ${className}`}
      aria-label="Membresía PRO"
    >
      <span className="pro-crown-sheen absolute inset-0 pointer-events-none" />

      <span className="relative z-10 w-7 h-7 rounded-full bg-gradient-to-br from-[#352414] via-[#1C120B] to-[#0E0907] border border-amber-300/60 shadow-inner flex items-center justify-center shrink-0">
        <RoyalCrownSvg
          className="w-4 h-4 drop-shadow-[0_1px_5px_rgba(245,196,81,0.65)]"
          idSuffix="swipe"
        />
      </span>

      <span className="relative z-10 flex flex-col leading-none text-left">
        <span className="text-[7.5px] font-bold uppercase tracking-[0.22em] text-amber-200/85">
          Membresía
        </span>
        <span className="font-display text-[12px] font-black uppercase tracking-[0.18em] bg-gradient-to-r from-[#FFF7D6] via-[#F7CC66] to-[#DC9A28] bg-clip-text text-transparent mt-0.5">
          PRO
        </span>
      </span>
    </div>
  );
}
