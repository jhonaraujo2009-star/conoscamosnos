import { useState } from 'react';
import { Flame, Globe, Heart, Lock, Mail, Sparkles, User, AlertCircle } from 'lucide-react';
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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-32 -left-24 w-80 h-80 rounded-full bg-brand-600/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-24 w-80 h-80 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative z-10">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 via-pink-500 to-amber-400 flex items-center justify-center shadow-lg shadow-brand-500/30 mb-3">
            <Heart className="w-8 h-8 text-white fill-white" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-white via-rose-200 to-amber-200 bg-clip-text text-transparent">
            Conoscamosnos
          </h1>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-brand-400" />
            Citas, amistad, idiomas y regalos en tiempo real
          </p>
        </div>

        {!isFirebaseConfigured && (
          <div className="mb-5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-amber-200 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Configuración de Firebase requerida
            </div>
            <p className="leading-relaxed text-amber-100/90">
              Copia <code className="px-1 py-0.5 rounded bg-slate-950">.env.example</code> a{' '}
              <code className="px-1 py-0.5 rounded bg-slate-950">.env</code> y agrega tus credenciales de Firebase y Cloudinary para habilitar registro, Firestore y subida de fotos.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-slate-950/80 border border-slate-800 mb-5">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); }}
            className={`py-2 rounded-xl text-sm font-semibold transition ${
              mode === 'login'
                ? 'bg-gradient-to-r from-brand-500 to-pink-500 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setError(''); }}
            className={`py-2 rounded-xl text-sm font-semibold transition ${
              mode === 'register'
                ? 'bg-gradient-to-r from-brand-500 to-pink-500 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Crear Cuenta
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                placeholder="Tu nombre o apodo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-sm focus:outline-none focus:border-brand-500"
              />
            </div>
          )}

          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-sm focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="password"
              placeholder="Contraseña (mín. 6 caracteres)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-sm focus:outline-none focus:border-brand-500"
            />
          </div>

          {mode === 'register' && (
            <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={adultConfirmed}
                onChange={(e) => setAdultConfirmed(e.target.checked)}
                className="mt-0.5 rounded accent-brand-500"
              />
              <span>Confirmo que tengo 18 años o más y acepto las normas de la comunidad.</span>
            </label>
          )}

          <button
            type="submit"
            disabled={busy || !isFirebaseConfigured}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-brand-500 via-pink-500 to-amber-500 text-white font-bold text-sm shadow-lg shadow-brand-500/25 hover:opacity-95 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            <Flame className="w-4 h-4" />
            {busy
              ? 'Procesando...'
              : mode === 'register'
              ? 'Comenzar mi Perfil'
              : 'Entrar a Conoscamosnos'}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-slate-500">
          <div className="h-px flex-1 bg-slate-800" />
          <span>o continúa con</span>
          <div className="h-px flex-1 bg-slate-800" />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy || !isFirebaseConfigured}
          className="w-full py-3 rounded-2xl bg-white text-slate-900 font-bold text-sm hover:bg-slate-100 disabled:opacity-50 transition flex items-center justify-center gap-2.5"
        >
          <Sparkles className="w-4 h-4 text-brand-500" />
          Continuar con Google
        </button>
      </div>
    </div>
  );
}
