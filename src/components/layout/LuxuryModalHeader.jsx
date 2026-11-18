import { X } from 'lucide-react';

/**
 * Cabecera editorial unificada Obsidian Velvet & Champagne Gold para modales de la plataforma.
 */
export default function LuxuryModalHeader({
  icon: Icon,
  iconClassName = 'bg-gradient-to-br from-amber-300 via-amber-400 to-[#FF2E54] text-zinc-950 shadow-lg shadow-[#FF2E54]/20',
  eyebrow = '',
  title,
  subtitle = null,
  onClose,
  closeLabel = 'Cerrar',
  children = null,
}) {
  return (
    <div className="relative overflow-hidden px-5 py-4 sm:py-5 bg-gradient-to-br from-[#170712] via-[#260B1C] to-[#110810] text-white border-b border-amber-300/15 shrink-0">
      <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-amber-400/15 blur-2xl pointer-events-none" />
      <div className="absolute -left-8 -bottom-8 w-28 h-28 rounded-full bg-[#FF2E54]/20 blur-2xl pointer-events-none" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          {Icon && (
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${iconClassName}`}
            >
              <Icon className="w-5 h-5 stroke-[2.3]" />
            </div>
          )}

          <div className="min-w-0">
            {eyebrow && (
              <p className="text-[9.5px] font-black uppercase tracking-[0.16em] text-amber-300/95 mb-0.5 truncate">
                {eyebrow}
              </p>
            )}
            <h3 className="font-display text-base sm:text-[17px] font-black tracking-tight text-white truncate">
              {title}
            </h3>
            {subtitle && (
              <div className="text-[11px] font-medium text-rose-100/75 truncate mt-0.5">
                {subtitle}
              </div>
            )}
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-zinc-200 hover:text-white transition shrink-0"
            aria-label={closeLabel}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {children && <div className="relative mt-3.5">{children}</div>}
    </div>
  );
}
