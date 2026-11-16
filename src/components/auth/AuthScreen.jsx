import { useState } from 'react';
import {
  AlertCircle,
  Flame,
  Globe,
  Heart,
  Lock,
  Mail,
  MessageCircleHeart,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import { isFirebaseConfigured } from '../../config/firebase';
import { loginWithEmail, loginWithGoogle, registerWithEmail } from '../../services/authService';

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
  const [adultConfirmed, setAdultConfirmed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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

  return (
    <div className="h-[100dvh] w-screen overflow-y-auto bg-[#F4F4F6] flex items-center justify-center p-4 sm:p-6 relative">
      {/* Ambient soft decorative blobs */}
      <div className="absolute -top-32 -left-24 w-96 h-96 rounded-full bg-rose-200/50 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-24 w-96 h-96 rounded-full bg-amber-200/45 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white/90 border border-rose-100/90 rounded-[32px] p-6 sm:p-8 shadow-luxury backdrop-blur-2xl relative z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative mb-3.5">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-brand-500 via-rose-500 to-amber-400 flex items-center justify-center shadow-lg shadow-brand-500/25">
              <Heart className="w-8 h-8 text-white fill-white" />
            </div>
            <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center text-amber-500">
              <Sparkles className="w-3.5 h-3.5" />
            </span>
          </div>

          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Conoscamosnos
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1 max-w-xs">
            Conecta con personas reales, haz amigos y conversa en privado sin fronteras
          </p>

          {/* Value & Privacy Pills */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3.5">
            <span className="px-2.5 py-1 rounded-full bg-rose-50 border border-rose-100 text-[11px] font-bold text-brand-600 flex items-center gap-1">
              <MessageCircleHeart className="w-3 h-3" /> Chat 1-a-1 directo
            </span>
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-[11px] font-bold text-emerald-700 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> 100% Privado
            </span>
            <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-100 text-[11px] font-bold text-amber-700 flex items-center gap-1">
              <Globe className="w-3 h-3" /> Global
            </span>
          </div>
        </div>

        {!isFirebaseConfigured && (
          <div className="mb-5 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-amber-800">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              Configuración de Firebase requerida
            </div>
            <p className="leading-relaxed text-amber-800/90">
              Copia <code className="px-1.5 py-0.5 rounded bg-white border border-amber-200">.env.example</code> a{' '}
              <code className="px-1.5 py-0.5 rounded bg-white border border-amber-200">.env</code> y agrega tus credenciales de Firebase y Cloudinary.
            </p>
          </div>
        )}

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-slate-100/90 border border-slate-200/70 mb-5">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); }}
            className={`py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              mode === 'login'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setError(''); }}
            className={`py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              mode === 'register'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Crear Cuenta
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
              <input
                type="text"
                placeholder="Tu nombre o apodo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50/80 border border-slate-200 text-slate-900 placeholder:text-slate-400 text-sm font-medium focus:outline-none focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition"
              />
            </div>
          )}

          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
            <input
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50/80 border border-slate-200 text-slate-900 placeholder:text-slate-400 text-sm font-medium focus:outline-none focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition"
            />
          </div>

          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
            <input
              type="password"
              placeholder="Contraseña (mín. 6 caracteres)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50/80 border border-slate-200 text-slate-900 placeholder:text-slate-400 text-sm font-medium focus:outline-none focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition"
            />
          </div>

          {mode === 'register' && (
            <label className="flex items-start gap-2.5 text-xs text-slate-600 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={adultConfirmed}
                onChange={(e) => setAdultConfirmed(e.target.checked)}
                className="mt-0.5 rounded accent-brand-500"
              />
              <span>Confirmo que tengo 18 años o más y acepto las normas de respeto y privacidad.</span>
            </label>
          )}

          <button
            type="submit"
            disabled={busy || !isFirebaseConfigured}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-brand-500 via-rose-500 to-amber-500 text-white font-extrabold text-sm shadow-lg shadow-brand-500/25 hover:brightness-105 active:scale-[0.99] disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            <Flame className="w-4 h-4" />
            {busy
              ? 'Conectando...'
              : mode === 'register'
              ? 'Crear mi Perfil Independiente'
              : 'Entrar a Conoscamosnos'}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-slate-400 font-medium">
          <div className="h-px flex-1 bg-slate-200" />
          <span>o continúa rápido con</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy || !isFirebaseConfigured}
          className="w-full py-3 rounded-2xl bg-white border border-slate-200 text-slate-800 font-bold text-sm hover:bg-slate-50 hover:border-slate-300 shadow-sm disabled:opacity-50 transition flex items-center justify-center gap-2.5"
        >
          <Sparkles className="w-4 h-4 text-brand-500" />
          Continuar con Google
        </button>
      </div>
    </div>
  );
}
