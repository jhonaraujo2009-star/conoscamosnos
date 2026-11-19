import { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Download,
  Eye,
  EyeOff,
  Flame,
  Lock,
  Mail,
  Smartphone,
  User,
} from 'lucide-react';
import { isFirebaseConfigured } from '../../config/firebase';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { loginWithEmail, loginWithGoogle, registerWithEmail } from '../../services/authService';
import AuthWelcomeShowcase from './AuthWelcomeShowcase';

function GoogleLogo() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
  if (
    code.includes('invalid-credential') ||
    code.includes('wrong-password') ||
    code.includes('user-not-found')
  ) {
    return 'Correo o contraseña incorrectos.';
  }
  if (code.includes('weak-password')) return 'La contraseña debe tener al menos 6 caracteres.';
  if (code.includes('popup-closed-by-user')) {
    return 'Se cerró la ventana de Google antes de completar el ingreso.';
  }
  return err?.message || 'Ocurrió un error al autenticar.';
}

export default function AuthScreen() {
  const [mode, setMode] = useState('register'); // 'register' | 'login'
  const [mobileView, setMobileView] = useState('welcome'); // 'welcome' | 'auth'
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
        prev
          ? ''
          : 'En iPhone/iPad: abre en Safari, toca Compartir (↑) y selecciona «Agregar a pantalla de inicio».'
      );
      return;
    }

    setInstallHint((prev) =>
      prev
        ? ''
        : 'Para instalar en Android: abre esta web en Google Chrome, toca el menú (⋮) arriba a la derecha y elige «Instalar aplicación».'
    );
  };

  const openMobileAuth = (targetMode) => {
    setMode(targetMode);
    setMobileView('auth');
    setError('');
  };

  const mobileWelcomeCtaSlot = (
    <div className="rounded-[26px] bg-white/90 backdrop-blur-xl border border-[#F1E1D9] p-4 space-y-2.5 shadow-[0_14px_34px_-18px_rgba(190,115,128,0.22)]">
      {!isFirebaseConfigured && (
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-amber-800">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            Configuración de Firebase requerida
          </div>
          <p className="text-[11px] leading-snug text-amber-800/90">
            Agrega tus credenciales de Firebase en <code className="px-1 py-0.5 rounded bg-white border border-amber-200">.env</code>.
          </p>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-[#FF2E54]" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="button"
        onClick={() => openMobileAuth('register')}
        className="w-full py-3.5 px-5 rounded-full bg-gradient-to-r from-[#FF3B66] via-[#FF5A79] to-[#FF7B6B] text-white font-extrabold text-sm shadow-lg shadow-[#FF3B66]/25 hover:brightness-105 active:scale-[0.99] transition flex items-center justify-center gap-2"
      >
        <span>Crear mi cuenta gratis</span>
        <ArrowRight className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={busy || !isFirebaseConfigured}
        className="w-full py-3 px-4 rounded-full bg-[#FFFDFB] hover:bg-[#FFF7F3] border border-[#EAD9D0] text-[#3B2C28] font-bold text-sm shadow-sm disabled:opacity-50 transition flex items-center justify-center gap-2.5"
      >
        <GoogleLogo />
        <span>Continuar con Google</span>
      </button>

      <p className="text-center text-xs text-[#6B5A53] pt-0.5">
        ¿Ya tienes cuenta?{' '}
        <button
          type="button"
          onClick={() => openMobileAuth('login')}
          className="font-black text-[#E63961] hover:underline"
        >
          Iniciar sesión
        </button>
      </p>
    </div>
  );

  return (
    <div className="h-[100dvh] w-screen overflow-y-auto overflow-x-hidden bg-welcome-pastel text-[#2B201E] relative">
      {/* Cabecera ligera pastel */}
      <header className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-2 flex items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          {mobileView === 'auth' ? (
            <button
              type="button"
              onClick={() => {
                setMobileView('welcome');
                setError('');
              }}
              className="lg:hidden px-3 py-1.5 rounded-full bg-white/90 hover:bg-white border border-[#EEDCD4] text-[#4E3B35] text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver</span>
            </button>
          ) : null}

          <div
            className={`${
              mobileView === 'auth' ? 'hidden lg:flex' : 'flex'
            } items-center gap-2.5 min-w-0`}
          >
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#FF3B66] via-[#FF5E7E] to-[#FF9B6A] flex items-center justify-center shadow-md shadow-[#FF3B66]/20 ring-2 ring-white/80 shrink-0">
              <Flame className="w-5 h-5 text-white fill-white" />
            </div>
            <span className="font-display text-base sm:text-lg font-black tracking-tight text-[#2B201E] truncate">
              Conoscamosnos
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isInstalled && (
            <button
              type="button"
              onClick={handleInstallAndroid}
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#EAF7F0] hover:bg-[#DFF3E8] border border-[#BDE5CF] text-[#176843] text-xs font-extrabold transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Instalar App</span>
            </button>
          )}

          {/* Switch rápido móvil */}
          <button
            type="button"
            onClick={() => {
              if (mobileView === 'welcome') {
                openMobileAuth('login');
              } else {
                setMode((m) => (m === 'register' ? 'login' : 'register'));
                setError('');
              }
            }}
            className="lg:hidden px-3.5 py-1.5 rounded-full bg-white/90 hover:bg-white border border-[#EEDCD4] text-[#4E3B35] text-xs font-extrabold shadow-sm transition"
          >
            {mobileView === 'welcome'
              ? 'Iniciar sesión'
              : mode === 'register'
              ? '¿Ya tienes cuenta?'
              : 'Crear cuenta'}
          </button>

          {/* Switch rápido escritorio */}
          <button
            type="button"
            onClick={() => {
              setMode((m) => (m === 'register' ? 'login' : 'register'));
              setError('');
            }}
            className="hidden lg:inline-flex px-4 py-2 rounded-full bg-white/85 hover:bg-white border border-[#EEDCD4] text-[#4E3B35] text-xs font-extrabold shadow-sm transition"
          >
            {mode === 'register' ? '¿Ya tienes cuenta? Entrar' : 'Crear cuenta nueva'}
          </button>
        </div>
      </header>

      {/* Contenido Principal Responsive */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-12 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 lg:gap-10 lg:items-center">
          {/* Columna Izquierda: Bienvenida Editorial & Programa Creador VIP Pastel */}
          <div
            className={`${
              mobileView === 'welcome' ? 'block' : 'hidden lg:block'
            } lg:col-span-7`}
          >
            <AuthWelcomeShowcase mobileCtaSlot={mobileWelcomeCtaSlot} />
          </div>

          {/* Columna Derecha: Tarjeta Porcelana Luminosa de Acceso */}
          <div
            className={`${
              mobileView === 'auth' ? 'block' : 'hidden lg:block'
            } lg:col-span-5`}
          >
            <div className="bg-white/90 backdrop-blur-2xl border border-[#F1E1D9] rounded-[34px] p-6 sm:p-7 shadow-[0_24px_60px_-20px_rgba(190,115,128,0.22)] animate-sheet-up">
              {/* Encabezado cálido de acceso */}
              <div className="text-center sm:text-left mb-5 space-y-1">
                <h2 className="font-display text-xl sm:text-2xl font-black tracking-tight text-[#2B201E]">
                  {mode === 'register'
                    ? 'Crea tu perfil en 1 minuto'
                    : 'Qué alegría verte de nuevo'}
                </h2>
                <p className="text-xs sm:text-[13px] text-[#7A675F] font-medium">
                  {mode === 'register'
                    ? 'Gratis, privado y listo para conectar hoy.'
                    : 'Ingresa para continuar tus conversaciones.'}
                </p>
              </div>

              {!isFirebaseConfigured && (
                <div className="mb-4 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-amber-800">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                    Configuración de Firebase requerida
                  </div>
                  <p className="leading-relaxed text-amber-800/90">
                    Agrega tus credenciales de Firebase y Cloudinary en{' '}
                    <code className="px-1.5 py-0.5 rounded bg-white border border-amber-200">.env</code>{' '}
                    para activar el acceso.
                  </p>
                </div>
              )}

              {/* Selector de Modo */}
              <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-[#F7EFEA] border border-[#EDE0D8] mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError('');
                  }}
                  className={`py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
                    mode === 'register'
                      ? 'bg-white text-[#2B201E] shadow-sm'
                      : 'text-[#7A675F] hover:text-[#2B201E]'
                  }`}
                >
                  Crear Cuenta
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                  }}
                  className={`py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
                    mode === 'login'
                      ? 'bg-white text-[#2B201E] shadow-sm'
                      : 'text-[#7A675F] hover:text-[#2B201E]'
                  }`}
                >
                  Iniciar Sesión
                </button>
              </div>

              {/* Acceso en 1 clic con Google */}
              <button
                type="button"
                onClick={handleGoogle}
                disabled={busy || !isFirebaseConfigured}
                className="w-full py-3 rounded-full bg-[#FFFDFB] hover:bg-[#FFF7F3] border border-[#EAD9D0] text-[#3B2C28] font-bold text-sm shadow-sm disabled:opacity-50 transition flex items-center justify-center gap-2.5"
              >
                <GoogleLogo />
                <span>Continuar con Google</span>
              </button>

              <div className="my-4 flex items-center gap-3 text-[11px] text-[#9A857C] font-semibold">
                <div className="h-px flex-1 bg-[#EFE1DA]" />
                <span>o usa tu correo</span>
                <div className="h-px flex-1 bg-[#EFE1DA]" />
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
                    <User className="w-4 h-4 text-[#A48E84] absolute left-4 top-3.5" />
                    <input
                      type="text"
                      placeholder="Tu nombre visible"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="w-full pl-11 pr-4 py-3 rounded-2xl bg-[#FCF7F3] border border-[#EBDCD3] text-[#2B201E] placeholder:text-[#9F8B82] text-sm font-medium focus:outline-none focus:bg-white focus:border-[#F0627F] focus:ring-2 focus:ring-rose-100 transition"
                    />
                  </div>
                )}

                <div className="relative">
                  <Mail className="w-4 h-4 text-[#A48E84] absolute left-4 top-3.5" />
                  <input
                    type="email"
                    placeholder="Correo electrónico"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-11 pr-4 py-3 rounded-2xl bg-[#FCF7F3] border border-[#EBDCD3] text-[#2B201E] placeholder:text-[#9F8B82] text-sm font-medium focus:outline-none focus:bg-white focus:border-[#F0627F] focus:ring-2 focus:ring-rose-100 transition"
                  />
                </div>

                <div className="relative">
                  <Lock className="w-4 h-4 text-[#A48E84] absolute left-4 top-3.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Contraseña (mín. 6 caracteres)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full pl-11 pr-11 py-3 rounded-2xl bg-[#FCF7F3] border border-[#EBDCD3] text-[#2B201E] placeholder:text-[#9F8B82] text-sm font-medium focus:outline-none focus:bg-white focus:border-[#F0627F] focus:ring-2 focus:ring-rose-100 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 top-3 p-0.5 text-[#9A857C] hover:text-[#2B201E] transition"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {mode === 'register' && (
                  <label className="flex items-start gap-2.5 text-xs text-[#6B5A53] cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={adultConfirmed}
                      onChange={(e) => setAdultConfirmed(e.target.checked)}
                      className="mt-0.5 rounded accent-[#FF3B66]"
                    />
                    <span>
                      Confirmo ser mayor de 18 años y acepto las normas de respeto y privacidad.
                    </span>
                  </label>
                )}

                <button
                  type="submit"
                  disabled={busy || !isFirebaseConfigured}
                  className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#FF3B66] via-[#FF5A79] to-[#FF7B6B] text-white font-extrabold text-sm shadow-lg shadow-[#FF3B66]/25 hover:brightness-105 active:scale-[0.99] disabled:opacity-50 transition flex items-center justify-center gap-2 mt-1"
                >
                  {busy
                    ? 'Conectando...'
                    : mode === 'register'
                    ? 'Crear mi perfil gratis'
                    : 'Entrar a Conoscamosnos'}
                </button>
              </form>

              {!isInstalled && (
                <div className="mt-4 space-y-2">
                  <button
                    type="button"
                    onClick={handleInstallAndroid}
                    className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-[#ECF9F2] to-[#E6F6F5] border border-[#BDE5CF] text-[#176843] font-extrabold text-xs hover:brightness-95 transition flex items-center justify-between gap-2"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Smartphone className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="truncate">
                        {canInstallNative
                          ? 'Descargar App para Android ahora'
                          : 'Descargar App para Android'}
                      </span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black shrink-0 inline-flex items-center gap-1">
                      <Download className="w-3 h-3" /> App
                    </span>
                  </button>

                  {installHint && (
                    <p className="text-[11px] text-[#5C4E41] bg-[#FAF4EE] border border-[#EBDCD3] rounded-xl px-3 py-2 leading-relaxed">
                      {installHint}
                    </p>
                  )}
                </div>
              )}

              <p className="text-[11px] text-center text-[#8E7970] mt-4 leading-relaxed">
                Cada perfil es independiente y tus conversaciones privadas son visibles únicamente para ti y tu contacto.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
