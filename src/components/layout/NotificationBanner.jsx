import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export default function NotificationBanner({ toast, onDismiss }) {
  if (!toast) return null;

  const styles = {
    success: 'bg-white/95 border-emerald-200 text-zinc-900 shadow-luxury',
    error: 'bg-white/95 border-rose-200 text-zinc-900 shadow-luxury',
    info: 'bg-white/95 border-zinc-200 text-zinc-900 shadow-luxury',
  };

  const iconColors = {
    success: 'text-emerald-600 bg-emerald-50',
    error: 'text-[#FF2E54] bg-rose-50',
    info: 'text-amber-600 bg-amber-50',
  };

  const Icon =
    toast.type === 'success'
      ? CheckCircle2
      : toast.type === 'error'
      ? AlertTriangle
      : Info;

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[95] w-[calc(100%-2rem)] max-w-md pointer-events-auto pt-safe">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-xl animate-sheet-up ${
          styles[toast.type] || styles.info
        }`}
      >
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${iconColors[toast.type] || iconColors.info}`}>
          <Icon className="w-4 h-4" />
        </div>
        <p className="text-xs sm:text-sm font-bold flex-1 leading-snug text-zinc-900">{toast.message}</p>
        <button
          onClick={onDismiss}
          className="text-zinc-400 hover:text-zinc-700 p-1 rounded-full hover:bg-zinc-100 transition"
          aria-label="Cerrar notificación"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
