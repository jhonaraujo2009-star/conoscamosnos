import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export default function NotificationBanner({ toast, onDismiss }) {
  if (!toast) return null;

  const styles = {
    success: 'bg-emerald-950/95 border-emerald-500/50 text-emerald-100',
    error: 'bg-rose-950/95 border-rose-500/50 text-rose-100',
    info: 'bg-slate-900/95 border-amber-500/50 text-slate-100',
  };

  const Icon =
    toast.type === 'success'
      ? CheckCircle2
      : toast.type === 'error'
      ? AlertTriangle
      : Info;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[90] w-[calc(100%-2rem)] max-w-md pointer-events-auto">
      <div
        className={`flex items-start gap-3 px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-md ${
          styles[toast.type] || styles.info
        }`}
      >
        <Icon className="w-5 h-5 shrink-0 mt-0.5" />
        <p className="text-sm font-medium flex-1 leading-snug">{toast.message}</p>
        <button
          onClick={onDismiss}
          className="text-white/70 hover:text-white p-0.5"
          aria-label="Cerrar notificación"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
