import { Check, Copy } from 'lucide-react';

const ACCENT_TOP_LINE = {
  none: '',
  crimson: 'from-rose-300 via-[#FF2E54] to-amber-300',
  amber: 'from-amber-300 via-orange-300 to-rose-300',
  emerald: 'from-emerald-300 via-teal-300 to-sky-300',
  sky: 'from-sky-300 via-indigo-300 to-rose-300',
};

const ACCENT_SURFACE = {
  none: 'bg-[#FFFDF8] border-[#E8DEC9]',
  crimson: 'bg-gradient-to-br from-[#FFFDF9] via-[#FFFBF5] to-[#FDF1EE] border-[#EED3CC]',
  amber: 'bg-gradient-to-br from-[#FFFDF9] via-[#FFFBF2] to-[#FAF0DC] border-[#E8D5B2]',
  emerald: 'bg-gradient-to-br from-[#FFFDF9] via-[#FCFDF8] to-[#EEF7F1] border-[#CBE3D4]',
  sky: 'bg-gradient-to-br from-[#FFFDF9] via-[#FBFDFD] to-[#EEF5FA] border-[#CADEEF]',
};

/**
 * Tarjeta editorial crema luminosa con borde arena cálido y acento superior opcional.
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
      className={`relative overflow-hidden rounded-[26px] border shadow-[0_12px_30px_-18px_rgba(115,86,52,0.16)] ${surface} ${className}`}
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
 * Botón reutilizable de copia con retroalimentación visual inmediata en paleta crema.
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
          : 'bg-[#F4ECDD] hover:bg-[#EAE0CE] border-[#E2D5BE] text-[#4B3E33] hover:text-[#2C241E]'
      }`}
    >
      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
      <span>{isCopied ? 'Copiado' : label}</span>
    </button>
  );
}

/**
 * Estado vacío editorial claro crema unificado para pestañas del panel Super Admin.
 */
export function AdminEmptyState({ icon: Icon, title, description }) {
  return (
    <AdminSectionCard className="p-10 text-center space-y-2.5">
      {Icon && (
        <div className="w-12 h-12 mx-auto rounded-2xl bg-[#FDF1EE] border border-[#EED3CC] text-[#FF2E54] flex items-center justify-center">
          <Icon className="w-6 h-6" />
        </div>
      )}
      <p className="font-display text-sm font-black text-[#2C241E]">{title}</p>
      {description && (
        <p className="text-xs text-[#857566] max-w-xs mx-auto leading-relaxed">{description}</p>
      )}
    </AdminSectionCard>
  );
}
