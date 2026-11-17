import { useState } from 'react';
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  Coins,
  Download,
  Eye,
  EyeOff,
  Gem,
  Lock,
  LogOut,
  Mail,
  MapPin,
  ShieldCheck,
  Smartphone,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { logoutUser } from '../../services/authService';
import { updateUserProfile } from '../../services/userService';
import { calculateWithdrawalBreakdown, formatUSD, isBoostActive } from '../../utils/formatters';

function SettingsSwitchRow({ icon: Icon, title, description, checked, busy, onToggle, accent }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-zinc-100 last:border-b-0">
      <div className="flex items-start gap-2.5 min-w-0">
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
            checked ? accent || 'bg-rose-50 text-[#FF2E54]' : 'bg-zinc-100 text-zinc-500'
          }`}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-zinc-900">{title}</p>
          <p className="text-[11px] text-zinc-500 leading-snug mt-0.5">{description}</p>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={Boolean(checked)}
        disabled={busy}
        onClick={onToggle}
        className={`relative w-11 h-6 rounded-full shrink-0 transition-colors duration-200 ${
          checked ? 'bg-[#FF2E54]' : 'bg-zinc-300'
        } disabled:opacity-50`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

export default function AccountSettingsModal({
  isOpen,
  onClose,
  userProfile,
  currentAuthUid,
  myReportsCount = 0,
  unreadGiftsCount = 0,
  receivedGiftsCount = 0,
  onOpenCoinStore,
  onOpenWithdrawals,
  onOpenBoost,
  onOpenSafetyCenter,
  onOpenGiftNotifications,
  onOpenAdmin,
  onSuccess,
  onError,
}) {
  const [busySetting, setBusySetting] = useState('');
  const [locatingGps, setLocatingGps] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const { isInstalled, canInstallNative, isIOS, promptInstall } = usePwaInstall();

  // Seguridad estricta: solo el dueño autenticado de este uid puede abrir su configuración privada
  if (!isOpen || !userProfile?.uid || currentAuthUid !== userProfile.uid) {
    return null;
  }

  const boosted = isBoostActive(userProfile);
  const diamonds = Number(userProfile.earningsDiamonds || 0);
  const { netPayoutUSD } = calculateWithdrawalBreakdown(diamonds);
  const isDiscoverable = userProfile.discoverable !== false;

  const handleToggleSetting = async (field, nextValue) => {
    if (busySetting) return;
    setBusySetting(field);
    try {
      await updateUserProfile(userProfile.uid, { [field]: nextValue });
      const labels = {
        smartPhotos: nextValue ? 'Smart Photos activado.' : 'Smart Photos desactivado.',
        hideAge: nextValue ? 'Tu edad ahora está oculta.' : 'Tu edad ahora es visible.',
        hideDistance: nextValue ? 'Tu distancia y ciudad están ocultas.' : 'Tu ubicación es visible.',
        hideOnlineStatus: nextValue ? 'Estado en línea ocultado.' : 'Estado en línea visible.',
        discoverable: nextValue ? 'Perfil visible en Descubrir.' : 'Perfil pausado de Descubrir.',
      };
      onSuccess?.(labels[field] || 'Ajuste guardado.');
    } catch (err) {
      onError?.(err.message || 'No se pudo actualizar el ajuste.');
    } finally {
      setBusySetting('');
    }
  };

  const handleUpdateApproxGps = () => {
    if (!navigator?.geolocation) {
      onError?.('Tu navegador no admite geolocalización.');
      return;
    }
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const approxGeo = {
            lat: Math.round(pos.coords.latitude * 100) / 100,
            lng: Math.round(pos.coords.longitude * 100) / 100,
          };
          await updateUserProfile(userProfile.uid, { approxGeo });
          onSuccess?.('Distancia aproximada (~1 km) actualizada.');
        } catch (err) {
          onError?.(err.message || 'No se pudo guardar tu ubicación aproximada.');
        } finally {
          setLocatingGps(false);
        }
      },
      () => {
        setLocatingGps(false);
        onError?.('No otorgaste permiso de ubicación.');
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const handleClearApproxGps = async () => {
    setLocatingGps(true);
    try {
      await updateUserProfile(userProfile.uid, { approxGeo: null });
      onSuccess?.('Coordenadas eliminadas.');
    } catch (err) {
      onError?.(err.message || 'No se pudo quitar la ubicación.');
    } finally {
      setLocatingGps(false);
    }
  };

  const handleAndroidInstall = async () => {
    if (canInstallNative) {
      const res = await promptInstall();
      if (res.status === 'accepted') {
        onSuccess?.('¡Conoscamosnos se instaló en tu dispositivo!');
        return;
      }
      if (res.status === 'dismissed') return;
    }
    setShowInstallGuide((v) => !v);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md max-h-[92dvh] bg-white rounded-t-[32px] sm:rounded-[32px] flex flex-col overflow-hidden shadow-2xl animate-sheet-up">
        {/* Cabecera Privada */}
        <div className="px-5 py-4 border-b border-zinc-200/80 flex items-center justify-between bg-white">
          <div className="min-w-0">
            <h3 className="font-display text-base font-extrabold text-zinc-900 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
              Ajustes Privados de Cuenta
            </h3>
            <p className="text-[11px] font-semibold text-zinc-500 truncate mt-0.5">
              Solo tú ({userProfile.name}) puedes ver y administrar esta sección
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4 bg-[#F4F4F6]">
          {/* 1. Correo y Credenciales Privadas */}
          <section className="bg-white rounded-3xl p-4 shadow-card space-y-2">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
              Tu Correo y Cuenta Única
            </p>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-zinc-100 text-zinc-700 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-zinc-900 truncate">
                    {userProfile.email || 'Correo no registrado'}
                  </p>
                  <p className="text-[11px] font-mono text-zinc-400 truncate">
                    ID: {userProfile.uid}
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-extrabold shrink-0">
                Privado
              </span>
            </div>
          </section>

          {/* 2. Billetera Privada: Monedas + Diamantes + Boost */}
          <section className="space-y-2">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 px-1">
              Mis Monedas, Diamantes y Ganancias
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCoinStore?.();
                }}
                className="p-4 rounded-3xl bg-white border border-amber-200/80 shadow-card text-left hover:border-amber-400 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-amber-700 flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-amber-500" /> Monedas
                  </span>
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </div>
                <p className="font-display text-2xl font-black text-zinc-900 mt-1.5">
                  {userProfile.coins || 0}
                </p>
                <p className="text-[10px] font-bold text-zinc-500 mt-0.5">
                  Para regalar o Boost → Recargar
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenWithdrawals?.();
                }}
                className="p-4 rounded-3xl bg-white border border-sky-200/80 shadow-card text-left hover:border-sky-400 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-sky-700 flex items-center gap-1.5">
                    <Gem className="w-4 h-4 text-sky-500" /> Diamantes
                  </span>
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </div>
                <p className="font-display text-2xl font-black text-zinc-900 mt-1.5">
                  {diamonds} 💎
                </p>
                <p className="text-[10px] font-extrabold text-emerald-600 mt-0.5">
                  ≈ {formatUSD(netPayoutUSD)} · Vender / Retirar
                </p>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenBoost?.();
              }}
              className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-purple-50 to-fuchsia-50 border border-purple-200/80 flex items-center justify-between text-left hover:brightness-95 transition"
            >
              <div className="flex items-center gap-2.5">
                <Zap className="w-5 h-5 text-purple-600 fill-purple-600" />
                <div>
                  <p className="text-xs font-extrabold text-purple-900">
                    {boosted ? 'Boost VIP Activo ahora' : 'Activar Boost VIP'}
                  </p>
                  <p className="text-[11px] text-purple-700/80">
                    Destaca primero en tu país y global
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-purple-500" />
            </button>
          </section>

          {/* 3. Notificaciones de Regalos y Centro de Bloqueados / Reportados */}
          <section className="space-y-2">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 px-1">
              Actividad Privada y Seguridad
            </p>
            <div className="bg-white rounded-3xl divide-y divide-zinc-100 shadow-card overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenGiftNotifications?.();
                }}
                className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-zinc-50 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-zinc-900">
                      Notificaciones de regalos recibidos
                    </p>
                    <p className="text-[11px] text-zinc-500 truncate">
                      {receivedGiftsCount} {receivedGiftsCount === 1 ? 'regalo recibido' : 'regalos recibidos'} (ver quién te regaló)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {unreadGiftsCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-[#FF2E54] text-white text-[10px] font-black">
                      {unreadGiftsCount}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSafetyCenter?.('blocked');
                }}
                className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-zinc-50 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-2xl bg-rose-50 text-[#FF2E54] flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-zinc-900">
                      Personas Bloqueadas y Mis Reportes
                    </p>
                    <p className="text-[11px] text-zinc-500 truncate">
                      {(userProfile.blockedUsers || []).length} bloqueados · {myReportsCount}{' '}
                      {myReportsCount === 1 ? 'reporte enviado' : 'reportes enviados'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
              </button>
            </div>
          </section>

          {/* 4. Smart Photos y Control de Visibilidad */}
          <section className="space-y-2">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 px-1">
              Smart Photos y Visibilidad
            </p>
            <div className="bg-white rounded-3xl px-4 py-2 shadow-card">
              <SettingsSwitchRow
                icon={Wand2}
                title="Smart Photos"
                description="Destaca automáticamente tu foto con más Likes."
                checked={Boolean(userProfile.smartPhotos)}
                busy={busySetting === 'smartPhotos'}
                accent="bg-amber-50 text-amber-600"
                onToggle={() => handleToggleSetting('smartPhotos', !userProfile.smartPhotos)}
              />
              <SettingsSwitchRow
                icon={EyeOff}
                title="Ocultar mi edad"
                description="No muestra tu edad en tarjetas ni chats."
                checked={Boolean(userProfile.hideAge)}
                busy={busySetting === 'hideAge'}
                onToggle={() => handleToggleSetting('hideAge', !userProfile.hideAge)}
              />
              <SettingsSwitchRow
                icon={MapPin}
                title="Ocultar mi distancia"
                description="Oculta los kilómetros y tu ciudad exacta."
                checked={Boolean(userProfile.hideDistance)}
                busy={busySetting === 'hideDistance'}
                onToggle={() => handleToggleSetting('hideDistance', !userProfile.hideDistance)}
              />
              <SettingsSwitchRow
                icon={ShieldCheck}
                title="Ocultar estado en línea"
                description="No muestra punto verde ni última conexión."
                checked={Boolean(userProfile.hideOnlineStatus)}
                busy={busySetting === 'hideOnlineStatus'}
                onToggle={() => handleToggleSetting('hideOnlineStatus', !userProfile.hideOnlineStatus)}
              />
              <SettingsSwitchRow
                icon={Eye}
                title="Mostrarme en Descubrir"
                description="Desactívalo para pausar tu perfil sin perder tus chats."
                checked={isDiscoverable}
                busy={busySetting === 'discoverable'}
                accent="bg-emerald-50 text-emerald-600"
                onToggle={() => handleToggleSetting('discoverable', !isDiscoverable)}
              />

              <div className="pt-2.5 flex items-center justify-between gap-2 border-t border-zinc-100">
                <div className="min-w-0">
                  <p className="text-[11px] font-extrabold text-zinc-800">Distancia GPS aproximada</p>
                  <p className="text-[10px] text-zinc-500">
                    {userProfile.approxGeo
                      ? 'Activa (~1 km de margen)'
                      : 'Usa ciudad/país o activa GPS aprox.'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {userProfile.approxGeo && (
                    <button
                      type="button"
                      disabled={locatingGps}
                      onClick={handleClearApproxGps}
                      className="px-2.5 py-1.5 rounded-full bg-zinc-100 text-zinc-700 text-[11px] font-bold hover:bg-zinc-200"
                    >
                      Quitar
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={locatingGps}
                    onClick={handleUpdateApproxGps}
                    className="px-3 py-1.5 rounded-full bg-zinc-900 text-white text-[11px] font-extrabold hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {locatingGps ? 'Ubicando...' : userProfile.approxGeo ? 'Actualizar' : 'Activar'}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* 5. Descargar / Instalar App para Android */}
          <section className="bg-white rounded-3xl p-4 shadow-card space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-zinc-900">App para Android</p>
                  <p className="text-[11px] text-zinc-500 truncate">
                    {isInstalled
                      ? 'Instalada en este dispositivo'
                      : 'Instálala directo en tu teléfono sin Play Store'}
                  </p>
                </div>
              </div>

              {isInstalled ? (
                <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-extrabold flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Instalada
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleAndroidInstall}
                  className="px-3.5 py-2 rounded-full bg-zinc-900 text-white text-[11px] font-extrabold flex items-center gap-1.5 hover:bg-zinc-800 shrink-0 active:scale-95 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  {canInstallNative ? 'Instalar' : 'Cómo instalar'}
                </button>
              )}
            </div>

            {showInstallGuide && !isInstalled && (
              <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/80 text-[11px] text-zinc-700 leading-relaxed space-y-1">
                {isIOS ? (
                  <p>
                    En Safari (iPhone/iPad): toca el botón <strong>Compartir</strong> y elige{' '}
                    <strong>“Agregar a pantalla de inicio”</strong>.
                  </p>
                ) : (
                  <p>
                    En <strong>Google Chrome Android</strong>: abre el menú superior <strong>⋮</strong> y selecciona{' '}
                    <strong>“Instalar aplicación”</strong> o <strong>“Agregar a pantalla principal”</strong> (funciona vía HTTPS en tu dominio desplegado).
                  </p>
                )}
              </div>
            )}
          </section>

          {/* 6. Panel Super Admin (únicamente si role === 'admin') */}
          {userProfile.role === 'admin' && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAdmin?.();
              }}
              className="w-full py-3.5 px-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-extrabold flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" /> Panel Super Admin
              </span>
              <span>Abrir →</span>
            </button>
          )}

          {/* 7. Cerrar sesión */}
          <button
            type="button"
            onClick={() => {
              onClose();
              logoutUser(userProfile.uid);
            }}
            className="w-full py-3.5 rounded-full bg-white border border-rose-200 text-[#FF2E54] text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm hover:bg-rose-50 transition"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión ({userProfile.email})
          </button>
        </div>
      </div>
    </div>
  );
}
