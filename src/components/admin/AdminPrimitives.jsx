import { Check, Copy } from 'lucide-react';

const ACCENT_TOP_LINE = {
  none: '',
  crimson: 'from-transparent via-[#FF2E54]/70 to-transparent',
  amber: 'from-transparent via-amber-400/70 to-transparent',
  emerald: 'from-transparent via-emerald-400/70 to-transparent',
  sky: 'from-transparent via-sky-400/70 to-transparent',
};

/**
 * Superficie ejecutiva Obsidian Velvet con sutil borde perlado y línea de acento superior opcional.
 */
export function AdminSectionCard({
  accent = 'none',
  className = '',
  children,
}) {
  const topGlow = ACCENT_TOP_LINE[accent] || '';
  return (
    <section
      className={`relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#16101F]/95 via-[#110C18]/95 to-[#0C0912]/95 border border-white/[0.08] shadow-[0_18px_42px_-20px_rgba(0,0,0,0.85)] ${className}`}
    >
      {topGlow && (
        <div
          className={`pointer-events-none absolute inset-x-6 top-0 h-[1.5px] bg-gradient-to-r ${topGlow}`}
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
          ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
          : 'bg-white/[0.06] hover:bg-white/[0.12] border-white/10 text-zinc-200 hover:text-white'
      }`}
    >
      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
      <span>{isCopied ? 'Copiado' : label}</span>
    </button>
  );
}

/**
 * Estado vacío editorial unificado para pestañas del panel Super Admin.
 */
export function AdminEmptyState({ icon: Icon, title, description }) {
  return (
    <AdminSectionCard className="p-10 text-center space-y-2.5">
      {Icon && (
        <div className="w-12 h-12 mx-auto rounded-2xl bg-white/[0.05] border border-white/10 text-zinc-400 flex items-center justify-center">
          <Icon className="w-6 h-6" />
        </div>
      )}
      <p className="font-display text-sm font-black text-white">{title}</p>
      {description && (
        <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">{description}</p>
      )}
    </AdminSectionCard>
  );
}
