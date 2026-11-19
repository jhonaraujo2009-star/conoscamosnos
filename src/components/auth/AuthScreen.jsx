import { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Crown,
  Download,
  Eye,
  EyeOff,
  Flame,
  Lock,
  Mail,
  User,
  X,
} from 'lucide-react';
import { isFirebaseConfigured } from '../../config/firebase';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { loginWithEmail, loginWithGoogle, registerWithEmail } from '../../services/authService';

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
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [mode, setMode] = useState('register'); // 'register' | 'login'
  const [vipSheetOpen, setVipSheetOpen] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [adultConfirmed, setAdultConfirmed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [installHint, setInstallHint] = useState('');
  const { isInstalled, canInstallNative, isIOS, promptInstall } = usePwaInstall();

  const openAuthModal = (targetMode = 'register') => {
    setMode(targetMode);
    setError('');
    setAuthModalOpen(true);
  };

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
        : 'En Android: abre en Google Chrome, toca menú (⋮) y elige «Instalar aplicación».'
    );
  };

  return (
    <div className="h-[100dvh] w-screen overflow-hidden relative bg-[#FFF6F1] text-[#1E1514]">
      {/* Única Fotografía Protagonista a Pantalla Completa */}
      <img
        src="/images/landing-hero.jpg"
        alt="Todo empezó en un Conoscamosnos"
        className="absolute inset-0 w-full h-full object-cover object-[50%_22%] sm:object-[50%_26%]"
      />

      {/* Bruma solar suave arriba para legibilidad de marca */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#FFF7F2]/60 via-[#FFF7F2]/20 to-transparent"
        aria-hidden="true"
      />

      {/* Velo pastel rosa-crema inferior sedoso */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[56%] sm:h-[52%]"
        style={{
          background:
            'linear-gradient(to top, #FFF6F1 0%, rgba(255,246,241,0.97) 34%, rgba(255,241,239,0.82) 56%, rgba(255,241,239,0.22) 78%, rgba(255,241,239,0) 100%)',
        }}
        aria-hidden="true"
      />

      {/* Barra Superior Flotante Minimal */}
      <header className="absolute top-0 inset-x-0 z-20">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 pt-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#E62E5C] via-[#F24B72] to-[#FF8A70] flex items-center justify-center shadow-md ring-2 ring-white/75 shrink-0">
              <Flame className="w-5 h-5 text-white fill-white" />
            </div>
            <span className="font-display text-lg font-black tracking-tight text-[#1E1514] drop-shadow-[0_1px_10px_rgba(255,255,255,0.85)] truncate">
              Conoscamosnos
            </span>
          </div>

          <button
            type="button"
            onClick={() => openAuthModal('login')}
            className="px-4 py-2 rounded-full bg-white/85 hover:bg-white backdrop-blur-md border border-white/80 text-[#1E1514] text-xs font-extrabold shadow-sm transition shrink-0"
          >
            Entrar
          </button>
        </div>
      </header>

      {/* Escenario Principal Inferior Ultra-Limpio */}
      <main className="relative z-10 h-full flex flex-col justify-end pb-7 sm:pb-10 px-5 sm:px-8">
        <div className="w-full max-w-md sm:max-w-[500px] mx-auto text-center space-y-5">
          {!isFirebaseConfigured && (
            <div className="p-3 rounded-2xl bg-amber-50/95 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center justify-center gap-2 shadow-sm">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>Configura Firebase en .env para activar el acceso.</span>
            </div>
          )}

          {error && !authModalOpen && (
            <div className="p-3 rounded-2xl bg-rose-50/95 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center justify-center gap-2 shadow-sm">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#D92D55]" />
              <span>{error}</span>
            </div>
          )}

          {/* Titular Editorial Magnético (5 palabras exactas) */}
          <h1 className="text-[#1E1514]">
            <span className="block font-display text-[28px] sm:text-[38px] font-extrabold tracking-[-0.03em] leading-[1.06]">
              Todo empezó en un
            </span>
            <span className="block font-editorial italic font-semibold text-[48px] sm:text-[66px] leading-[0.94] text-[#D92D55] tracking-[-0.015em]">
              Conoscamosnos.
            </span>
          </h1>

          {/* 2 Botones Principales Directos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 pt-1">
            <button
              type="button"
              onClick={() => openAuthModal('register')}
              className="py-4 px-6 rounded-full bg-gradient-to-r from-[#E62E5C] via-[#F24B72] to-[#FF6B78] text-white font-extrabold text-sm sm:text-[15px] shadow-[0_16px_36px_-10px_rgba(230,46,92,0.52)] hover:brightness-105 active:scale-[0.98] transition flex items-center justify-center gap-2"
            >
              <span>Crear cuenta</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={busy || !isFirebaseConfigured}
              className="py-4 px-5 rounded-full bg-white/95 hover:bg-white border border-[#EEDBD4] text-[#1E1514] font-bold text-sm sm:text-[15px] shadow-[0_10px_28px_-12px_rgba(68,38,32,0.18)] active:scale-[0.98] disabled:opacity-50 transition flex items-center justify-center gap-2.5"
            >
              <GoogleLogo />
              <span>Continuar con Google</span>
            </button>
          </div>

          {/* Micro-Barra Inferior Sutil */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => setVipSheetOpen(true)}
              className="px-3.5 py-1.5 rounded-full bg-[#FFF8EB]/95 hover:bg-[#FFF2DA] border border-[#EED7B4] text-[#8A5A1E] text-[11px] font-extrabold inline-flex items-center gap-1.5 shadow-sm transition"
            >
              <Crown className="w-3.5 h-3.5 text-[#C58A32]" />
              <span>Creador VIP · Retiros $ USD</span>
            </button>

            {!isInstalled && (
              <button
                type="button"
                onClick={handleInstallAndroid}
                className="px-3 py-1.5 rounded-full bg-[#EFFAF4]/95 hover:bg-[#E2F5EB] border border-[#C6E6D4] text-[#176843] text-[11px] font-extrabold inline-flex items-center gap-1 shadow-sm transition"
              >
                <Download className="w-3 h-3" />
                <span>App Android</span>
              </button>
            )}
          </div>

          {installHint && (
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#FFFDF9]/95 border border-[#EADCD3] text-[11px] font-medium text-[#5A4942] shadow-sm">
              <span>{installHint}</span>
              <button
                type="button"
                onClick={() => setInstallHint('')}
                className="p-0.5 text-[#8E7970] hover:text-[#1E1514]"
                aria-label="Ocultar aviso"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Sheet Modal Porcelana de Registro / Acceso */}
      {authModalOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#231716]/35 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-5"
          onClick={() => !busy && setAuthModalOpen(false)}
        >
          <div
            className="w-full sm:max-w-[420px] rounded-t-[34px] sm:rounded-[34px] bg-[#FFFDF9] border border-[#EFE0D7] p-6 sm:p-7 shadow-[0_28px_80px_-20px_rgba(40,20,18,0.32)] animate-sheet-up max-h-[92dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="font-editorial text-[30px] font-semibold text-[#1E1514] leading-none">
                {mode === 'register' ? 'Crea tu cuenta' : 'Bienvenido'}
              </h2>
              <button
                type="button"
                disabled={busy}
                onClick={() => setAuthModalOpen(false)}
                className="w-9 h-9 rounded-full bg-[#FAF2EC] hover:bg-[#F3E6DD] border border-[#EADBD0] text-[#5A4942] flex items-center justify-center transition disabled:opacity-50"
                aria-label="Cerrar ventana"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Pestañas minimalistas con subrayado */}
            <div className="grid grid-cols-2 border-b border-[#EFE3DA] mb-5">
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
                className={`-mb-px pb-3 text-xs sm:text-sm font-extrabold transition border-b-2 ${
                  mode === 'register'
                    ? 'border-[#D92D55] text-[#1E1514]'
                    : 'border-transparent text-[#8E7970] hover:text-[#1E1514]'
                }`}
              >
                Crear cuenta
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className={`-mb-px pb-3 text-xs sm:text-sm font-extrabold transition border-b-2 ${
                  mode === 'login'
                    ? 'border-[#D92D55] text-[#1E1514]'
                    : 'border-transparent text-[#8E7970] hover:text-[#1E1514]'
                }`}
              >
                Iniciar sesión
              </button>
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={busy || !isFirebaseConfigured}
              className="w-full py-3.5 rounded-full bg-[#FFFDF9] hover:bg-[#FFF7F0] border border-[#E6D7CE] text-[#1E1514] font-bold text-sm shadow-sm disabled:opacity-50 transition flex items-center justify-center gap-2.5"
            >
              <GoogleLogo />
              <span>Continuar con Google</span>
            </button>

            <div className="my-4 flex items-center gap-3 text-[11px] text-[#9A857C] font-semibold">
              <div className="h-px flex-1 bg-[#EFE3DA]" />
              <span>o con tu correo</span>
              <div className="h-px flex-1 bg-[#EFE3DA]" />
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#D92D55]" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === 'register' && (
                <div className="relative">
                  <User className="w-4 h-4 text-[#9E8B81] absolute left-4 top-3.5" />
                  <input
                    type="text"
                    placeholder="Tu nombre visible"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full pl-11 pr-4 py-3 rounded-2xl bg-[#FBF6F1] border border-[#E8DAD0] text-[#1E1514] placeholder:text-[#9E8B81] text-sm font-medium focus:outline-none focus:bg-white focus:border-[#D92D55] focus:ring-2 focus:ring-[#D92D55]/10 transition"
                  />
                </div>
              )}

              <div className="relative">
                <Mail className="w-4 h-4 text-[#9E8B81] absolute left-4 top-3.5" />
                <input
                  type="email"
                  placeholder="Correo electrónico"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3 rounded-2xl bg-[#FBF6F1] border border-[#E8DAD0] text-[#1E1514] placeholder:text-[#9E8B81] text-sm font-medium focus:outline-none focus:bg-white focus:border-[#D92D55] focus:ring-2 focus:ring-[#D92D55]/10 transition"
                />
              </div>

              <div className="relative">
                <Lock className="w-4 h-4 text-[#9E8B81] absolute left-4 top-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Contraseña (mín. 6 caracteres)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full pl-11 pr-11 py-3 rounded-2xl bg-[#FBF6F1] border border-[#E8DAD0] text-[#1E1514] placeholder:text-[#9E8B81] text-sm font-medium focus:outline-none focus:bg-white focus:border-[#D92D55] focus:ring-2 focus:ring-[#D92D55]/10 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-3 p-0.5 text-[#9E8B81] hover:text-[#1E1514] transition"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {mode === 'register' && (
                <label className="flex items-start gap-2.5 text-xs text-[#6A5951] cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={adultConfirmed}
                    onChange={(e) => setAdultConfirmed(e.target.checked)}
                    className="mt-0.5 rounded accent-[#D92D55]"
                  />
                  <span>Confirmo ser mayor de 18 años y acepto las normas de privacidad.</span>
                </label>
              )}

              <button
                type="submit"
                disabled={busy || !isFirebaseConfigured}
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#E62E5C] via-[#F24B72] to-[#FF6B78] text-white font-extrabold text-sm shadow-[0_14px_30px_-10px_rgba(230,46,92,0.5)] hover:brightness-105 active:scale-[0.99] disabled:opacity-50 transition flex items-center justify-center gap-2 mt-1"
              >
                {busy
                  ? 'Conectando...'
                  : mode === 'register'
                  ? 'Crear mi perfil gratis'
                  : 'Entrar a Conoscamosnos'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Sheet Modal Champagne-Pearl Programa Creador VIP */}
      {vipSheetOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#231716]/35 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-5"
          onClick={() => setVipSheetOpen(false)}
        >
          <div
            className="w-full sm:max-w-[390px] rounded-t-[32px] sm:rounded-[32px] bg-gradient-to-br from-[#FBF1E3] via-[#FFFDF9] to-[#FCEFF3] border border-[#EAD7C0] p-6 shadow-2xl animate-sheet-up space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-[0.18em] text-[#9A6B37]">
                <Crown className="w-3.5 h-3.5" />
                Programa Creador VIP
              </span>

              <button
                type="button"
                onClick={() => setVipSheetOpen(false)}
                className="w-8 h-8 rounded-full bg-white/80 hover:bg-white border border-[#EAD7C0] text-[#5A4942] flex items-center justify-center transition"
                aria-label="Cerrar Programa Creador VIP"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <h2 className="font-editorial text-[26px] font-semibold text-[#1E1514] leading-[1.1]">
                Tus regalos y diamantes, en dinero real.
              </h2>
              <p className="text-xs text-[#6A5951] leading-relaxed">
                Monetiza tu perfil de forma opcional (💎) y cobra en $ USD directo a:
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <span className="px-3 py-1.5 rounded-full bg-[#FFFDF9] border border-[#E6D6C7] text-[11px] font-extrabold text-[#2C211E]">
                Binance Pay (USDT)
              </span>
              <span className="px-3 py-1.5 rounded-full bg-[#FFFDF9] border border-[#E6D6C7] text-[11px] font-extrabold text-[#2C211E]">
                Zinli (USD)
              </span>
              <span className="px-3 py-1.5 rounded-full bg-[#FFFDF9] border border-[#E6D6C7] text-[11px] font-extrabold text-[#2C211E]">
                Pago Móvil
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setVipSheetOpen(false);
                openAuthModal('register');
              }}
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#E62E5C] via-[#F24B72] to-[#FF6B78] text-white font-extrabold text-sm shadow-[0_14px_30px_-10px_rgba(230,46,92,0.45)] hover:brightness-105 active:scale-[0.98] transition flex items-center justify-center gap-2"
            >
              <span>Empezar ahora</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
