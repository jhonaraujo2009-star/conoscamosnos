import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export default function NotificationBanner({ toast, onDismiss }) {
  if (!toast) return null;

  const styles = {
    success: 'bg-white/95 border-emerald-200 text-slate-800 shadow-[0_12px_32px_-4px_rgba(16,185,129,0.18)]',
    error: 'bg-white/95 border-rose-200 text-slate-800 shadow-[0_12px_32px_-4px_rgba(244,63,110,0.2)]',
    info: 'bg-white/95 border-amber-200 text-slate-800 shadow-soft',
  };

  const iconColors = {
    success: 'text-emerald-500 bg-emerald-50',
    error: 'text-rose-500 bg-rose-50',
    info: 'text-amber-500 bg-amber-50',
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
        className={`flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-xl ${
          styles[toast.type] || styles.info
        }`}
      >
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${iconColors[toast.type] || iconColors.info}`}>
          <Icon className="w-4 h-4" />
        </div>
        <p className="text-xs sm:text-sm font-semibold flex-1 leading-snug text-slate-800">{toast.message}</p>
        <button
          onClick={onDismiss}
          className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition"
          aria-label="Cerrar notificación"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
