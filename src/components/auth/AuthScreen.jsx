import { useState } from 'react';
import {
  AlertCircle,
  Crown,
  Download,
  Eye,
  EyeOff,
  Flame,
  Gem,
  Globe,
  Lock,
  Mail,
  MessageCircleHeart,
  ShieldCheck,
  Smartphone,
  Sparkles,
  User,
} from 'lucide-react';
import { isFirebaseConfigured } from '../../config/firebase';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { loginWithEmail, loginWithGoogle, registerWithEmail } from '../../services/authService';

function GoogleLogo() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
      <path
        fill="#EA4335"
        d="M12 5.04c1.64 0 3.12.56 4.28 1.66l3.2-3.2C17.53 1.72 14.98.68 12 .68 7.56.68 3.74 3.22 1.88 6.95l3.73 2.9C6.49 7.21 9.02 5.04 12 5.04z"
      />
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.78-.07-1.53-.2-2.27H12v4.3h6.45c-.28 1.49-1.12 2.75-2.38 3.6l3.7 2.87c2.16-1.99 3.72-4.93 3.72-8.5z"
      />
      <path
        fill="#FBBC05"
        d="M5.61 14.15A7.01 7.01 0 0 1 5.24 12c0-.75.13-1.48.37-2.15l-3.73-2.9A11.3 11.3 0 0 0 .68 12c0 1.83.44 3.56 1.2 5.05l3.73-2.9z"
      />
      <path
        fill="#34A853"
        d="M12 23.32c3.24 0 5.96-1.07 7.95-2.91l-3.7-2.87c-1.07.72-2.44 1.15-4.25 1.15-2.98 0-5.51-2.17-6.39-5.05l-3.73 2.9c1.86 3.73 5.68 6.78 10.12 6.78z"
      />
    </svg>
  );
}

function mapAuthError(err) {
  const code = err?.code || '';
  if (code.includes('email-already-in-use')) return 'Este correo ya está registrado. Inicia sesión.';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
    return 'Correo o contraseña incorrectos.';
  }
  if (code.includes('weak-password')) return 'La contraseña debe tener al menos 6 caracteres.';
  if (code.includes('popup-closed-by-user')) return 'Se cerró la ventana de Google antes de completar el ingreso.';
  return err?.message || 'Ocurrió un error al autenticar.';
}

export default function AuthScreen() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [adultConfirmed, setAdultConfirmed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [installHint, setInstallHint] = useState('');
  const { isInstalled, canInstallNative, isIOS, promptInstall } = usePwaInstall();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (mode === 'register' && !adultConfirmed) {
      setError('Debes confirmar que eres mayor de 18 años.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'register') {
        if (!name.trim()) throw new Error('Ingresa tu nombre para continuar.');
        await registerWithEmail({ email, password, name });
      } else {
        await loginWithEmail({ email, password });
      }
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setBusy(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleInstallAndroid = async () => {
    if (canInstallNative) {
      const res = await promptInstall();
      if (res?.status === 'accepted') {
        setInstallHint('¡Listo! La app se está instalando en tu dispositivo.');
      } else {
        setInstallHint('Si cerraste el aviso, abre el menú (⋮) de Chrome → «Instalar aplicación».');
      }
      return;
    }

    if (isIOS) {
      setInstallHint((prev) =>
        prev ? '' : 'En iPhone/iPad: abre en Safari, toca Compartir (↑) y selecciona «Agregar a pantalla de inicio».'
      );
      return;
    }

    setInstallHint((prev) =>
      prev
        ? ''
        : 'Para instalar en Android: abre esta web en Google Chrome, toca el menú (⋮) arriba a la derecha y elige «Instalar aplicación».'
    );
  };

  return (
    <div className="h-[100dvh] w-screen overflow-y-auto bg-luxury-mesh flex items-start sm:items-center justify-center p-4 sm:p-6 relative">
      <div className="w-full max-w-md my-auto bg-white/95 border border-zinc-200/80 rounded-[32px] p-6 sm:p-8 shadow-luxury backdrop-blur-xl relative z-10 animate-sheet-up">
        {/* Brand Hero */}
        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-16 h-16 rounded-[22px] bg-gradient-to-br from-[#FF2E54] via-rose-500 to-amber-400 flex items-center justify-center shadow-lg shadow-[#FF2E54]/30 mb-3.5 ring-4 ring-rose-100/80">
            <Flame className="w-8 h-8 text-white fill-white" />
          </div>

          <h1 className="font-display text-3xl font-black tracking-tight text-zinc-900">
            Conoscamosnos
          </h1>
          <p className="text-xs sm:text-sm font-medium text-zinc-500 mt-1 max-w-[290px] leading-relaxed">
            Conexiones románticas reales, diseño elegante y privacidad total 1-a-1.
          </p>

          {/* Trust & Value Pills */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3.5">
            <span className="px-2.5 py-1 rounded-full bg-rose-50 border border-rose-100 text-[11px] font-bold text-[#FF2E54] flex items-center gap-1">
              <MessageCircleHeart className="w-3 h-3" /> Chats 1-a-1
            </span>
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-[11px] font-bold text-emerald-700 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> 100% Privado
            </span>
            <span className="px-2.5 py-1 rounded-full bg-zinc-100 border border-zinc-200/80 text-[11px] font-bold text-zinc-700 flex items-center gap-1">
              <Globe className="w-3 h-3 text-zinc-500" /> Global
            </span>
          </div>
        </div>

        {/* Luxury VIP Creator Monetization Highlight Banner */}
        <div className="mb-5 relative overflow-hidden rounded-[24px] p-4 bg-gradient-to-br from-[#190913] via-[#280B1C] to-[#120A14] border border-amber-300/30 shadow-lg text-white">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-amber-400/15 blur-2xl pointer-events-none" />
          <div className="absolute -left-6 -bottom-6 w-20 h-20 rounded-full bg-[#FF2E54]/20 blur-2xl pointer-events-none" />
          <div className="relative flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-300 via-amber-400 to-rose-500 text-zinc-950 flex items-center justify-center shrink-0 shadow-md">
              <Crown className="w-5 h-5 stroke-[2.3]" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/35 text-amber-200 text-[9.5px] font-black uppercase tracking-wider inline-flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> Programa Creador VIP
                </span>
                <span className="text-[10px] font-bold text-emerald-300 inline-flex items-center gap-0.5">
                  <Gem className="w-3 h-3 text-sky-300" /> Retiros en $ USD
                </span>
              </div>
              <p className="font-display text-[13px] font-extrabold text-white leading-snug">
                Convierte los regalos y diamantes que recibas en dinero real
              </p>
              <p className="text-[11px] text-rose-100/80 leading-relaxed">
                Monetiza tu perfil de forma opcional y cobra tus ganancias directo a <strong>Binance Pay</strong> o <strong>PayPal</strong>.
              </p>
            </div>
          </div>
        </div>

        {!isFirebaseConfigured && (
          <div className="mb-5 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-amber-800">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              Configuración de Firebase requerida
            </div>
            <p className="leading-relaxed text-amber-800/90">
              Agrega tus credenciales de Firebase y Cloudinary en <code className="px-1.5 py-0.5 rounded bg-white border border-amber-200">.env</code> para activar el acceso.
            </p>
          </div>
        )}

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-zinc-100 border border-zinc-200/60 mb-5">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); }}
            className={`py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
              mode === 'login'
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setError(''); }}
            className={`py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
              mode === 'register'
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Crear Cuenta
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#FF2E54]" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'register' && (
            <div className="relative">
              <User className="w-4 h-4 text-zinc-400 absolute left-4 top-3.5" />
              <input
                type="text"
                placeholder="Tu nombre visible"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 text-sm font-medium focus:outline-none focus:bg-white focus:border-zinc-900 transition"
              />
            </div>
          )}

          <div className="relative">
            <Mail className="w-4 h-4 text-zinc-400 absolute left-4 top-3.5" />
            <input
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full pl-11 pr-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 text-sm font-medium focus:outline-none focus:bg-white focus:border-zinc-900 transition"
            />
          </div>

          <div className="relative">
            <Lock className="w-4 h-4 text-zinc-400 absolute left-4 top-3.5" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Contraseña (mín. 6 caracteres)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full pl-11 pr-11 py-3 rounded-2xl bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 text-sm font-medium focus:outline-none focus:bg-white focus:border-zinc-900 transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3.5 top-3 p-0.5 text-zinc-400 hover:text-zinc-700"
              aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {mode === 'register' && (
            <label className="flex items-start gap-2.5 text-xs text-zinc-600 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={adultConfirmed}
                onChange={(e) => setAdultConfirmed(e.target.checked)}
                className="mt-0.5 rounded accent-[#FF2E54]"
              />
              <span>Confirmo ser mayor de 18 años y acepto las normas de respeto y privacidad.</span>
            </label>
          )}

          <button
            type="submit"
            disabled={busy || !isFirebaseConfigured}
            className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#FF2E54] to-[#FF5E7E] text-white font-extrabold text-sm shadow-lg shadow-[#FF2E54]/25 hover:brightness-105 active:scale-[0.99] disabled:opacity-50 transition flex items-center justify-center gap-2 mt-1"
          >
            {busy
              ? 'Conectando...'
              : mode === 'register'
              ? 'Crear mi Perfil Independiente'
              : 'Entrar a Conoscamosnos'}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-zinc-400 font-medium">
          <div className="h-px flex-1 bg-zinc-200" />
          <span>o continúa con</span>
          <div className="h-px flex-1 bg-zinc-200" />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy || !isFirebaseConfigured}
          className="w-full py-3 rounded-full bg-white border border-zinc-200 text-zinc-800 font-bold text-sm hover:bg-zinc-50 hover:border-zinc-300 shadow-sm disabled:opacity-50 transition flex items-center justify-center gap-2.5"
        >
          <GoogleLogo />
          Continuar con Google
        </button>

        {!isInstalled && (
          <div className="mt-3.5 space-y-2">
            <button
              type="button"
              onClick={handleInstallAndroid}
              className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/90 text-emerald-900 font-extrabold text-xs hover:brightness-95 transition flex items-center justify-between gap-2"
            >
              <span className="flex items-center gap-2 min-w-0">
                <Smartphone className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="truncate">
                  {canInstallNative ? 'Descargar App para Android ahora' : 'Descargar App para Android'}
                </span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black shrink-0 inline-flex items-center gap-1">
                <Download className="w-3 h-3" /> App
              </span>
            </button>

            {installHint && (
              <p className="text-[11px] text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 leading-relaxed">
                {installHint}
              </p>
            )}
          </div>
        )}

        <p className="text-[11px] text-center text-zinc-400 mt-5 leading-relaxed">
          Cada perfil es independiente y tus conversaciones privadas son visibles únicamente para ti y tu contacto.
        </p>
      </div>
    </div>
  );
}
