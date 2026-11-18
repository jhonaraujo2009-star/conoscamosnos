import { Check, Copy } from 'lucide-react';

const ACCENT_TOP_LINE = {
  none: '',
  crimson: 'from-rose-300 via-[#FF2E54] to-amber-300',
  amber: 'from-amber-300 via-orange-300 to-rose-300',
  emerald: 'from-emerald-300 via-teal-300 to-sky-300',
  sky: 'from-sky-300 via-indigo-300 to-rose-300',
};

const ACCENT_SURFACE = {
  none: 'bg-white/95 border-zinc-200/80',
  crimson: 'bg-gradient-to-br from-white via-white to-rose-50/80 border-rose-200/85',
  amber: 'bg-gradient-to-br from-white via-white to-amber-50/80 border-amber-200/85',
  emerald: 'bg-gradient-to-br from-white via-white to-emerald-50/80 border-emerald-200/85',
  sky: 'bg-gradient-to-br from-white via-white to-sky-50/80 border-sky-200/85',
};

/**
 * Tarjeta editorial pastel luminosa con borde suave y acento superior opcional.
 */
export function AdminSectionCard({
  accent = 'none',
  className = '',
  children,
}) {
  const topGlow = ACCENT_TOP_LINE[accent] || '';
  const surface = ACCENT_SURFACE[accent] || ACCENT_SURFACE.none;
  return (
    <section
      className={`relative overflow-hidden rounded-[26px] border shadow-[0_14px_34px_-18px_rgba(15,23,42,0.14)] ${surface} ${className}`}
    >
      {topGlow && (
        <div
          className={`pointer-events-none absolute inset-x-6 top-0 h-[3px] rounded-b-full bg-gradient-to-r ${topGlow}`}
        />
      )}
      {children}
    </section>
  );
}

/**
 * Botón reutilizable de copia con retroalimentación visual inmediata.
 */
export function AdminCopyButton({ copyKey, copiedKey, onCopy, label = 'Copiar' }) {
  const isCopied = Boolean(copiedKey && copiedKey === copyKey);
  return (
    <button
      type="button"
      onClick={onCopy}
      className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-extrabold inline-flex items-center gap-1 shrink-0 transition ${
        isCopied
          ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
          : 'bg-zinc-100 hover:bg-zinc-200/80 border-zinc-200 text-zinc-700 hover:text-zinc-900'
      }`}
    >
      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
      <span>{isCopied ? 'Copiado' : label}</span>
    </button>
  );
}

/**
 * Estado vacío editorial claro unificado para pestañas del panel Super Admin.
 */
export function AdminEmptyState({ icon: Icon, title, description }) {
  return (
    <AdminSectionCard className="p-10 text-center space-y-2.5">
      {Icon && (
        <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-50 border border-rose-200/70 text-[#FF2E54] flex items-center justify-center">
          <Icon className="w-6 h-6" />
        </div>
      )}
      <p className="font-display text-sm font-black text-zinc-900">{title}</p>
      {description && (
        <p className="text-xs text-zinc-500 max-w-xs mx-auto leading-relaxed">{description}</p>
      )}
    </AdminSectionCard>
  );
}
