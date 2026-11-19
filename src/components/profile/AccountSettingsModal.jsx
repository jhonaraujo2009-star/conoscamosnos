import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  ChevronRight,
  Crown,
  Eye,
  EyeOff,
  Gem,
  Landmark,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MapPin,
  ShieldCheck,
  Wand2,
  Zap,
} from 'lucide-react';
import { WITHDRAWAL_PAYOUT_METHODS } from '../../config/constants';
import { useAuth } from '../../contexts/AuthContext';
import { logoutUser } from '../../services/authService';
import {
  disablePushNotifications,
  enablePushNotifications,
  getBrowserPushStatus,
} from '../../services/pushNotificationService';
import {
  saveUserPayoutAccount,
  subscribeUserPayoutAccount,
  updateUserProfile,
} from '../../services/userService';
import {
  createDebouncedAutoSaver,
  createSectionSignature,
  validatePayoutAccountDraft,
} from '../../utils/autoSaveHelpers';
import {
  calculateWithdrawalBreakdown,
  formatTimeRemaining,
  formatUSD,
  getSpendableDiamonds,
  isBoostActive,
  isProActive,
} from '../../utils/formatters';
import LuxuryModalHeader from '../layout/LuxuryModalHeader';

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
  onOpenDiamondStore,
  onOpenWithdrawals,
  onOpenBoost,
  onOpenSafetyCenter,
  onOpenGiftNotifications,
  onOpenAdmin,
  onSuccess,
  onError,
}) {
  const { economyConfig, isSuperAdmin } = useAuth();
  const [busySetting, setBusySetting] = useState('');
  const [locatingGps, setLocatingGps] = useState(false);
  const [savedPayout, setSavedPayout] = useState(null);
  const [payoutMethodId, setPayoutMethodId] = useState(WITHDRAWAL_PAYOUT_METHODS[0].id);
  const [payoutAccountValue, setPayoutAccountValue] = useState('');
  const [payoutHolderName, setPayoutHolderName] = useState('');
  const [payoutSaveStatus, setPayoutSaveStatus] = useState({ state: 'idle', message: '' });

  const uidRef = useRef(userProfile?.uid);
  const onErrorRef = useRef(onError);
  uidRef.current = userProfile?.uid;
  onErrorRef.current = onError;

  const payoutDraftRef = useRef({
    methodId: WITHDRAWAL_PAYOUT_METHODS[0].id,
    accountValue: '',
    holderName: '',
  });
  const lastRemotePayoutSigRef = useRef('');
  const lastSavedPayoutSigRef = useRef('');
  const payoutSaverRef = useRef(null);

  if (!payoutSaverRef.current) {
    payoutSaverRef.current = createDebouncedAutoSaver({
      delayMs: 650,
      onSave: async (payload) => {
        const uid = uidRef.current;
        if (!uid) return;
        const sig = createSectionSignature(payload);
        if (sig === lastSavedPayoutSigRef.current) {
          setPayoutSaveStatus({ state: 'saved', message: '' });
          return;
        }
        setPayoutSaveStatus({ state: 'saving', message: '' });
        try {
          await saveUserPayoutAccount(uid, payload);
          lastSavedPayoutSigRef.current = sig;
          setPayoutSaveStatus({ state: 'saved', message: '' });
        } catch (err) {
          const msg = err?.message || 'No se pudo guardar tu cuenta de cobro.';
          setPayoutSaveStatus({ state: 'error', message: msg });
          onErrorRef.current?.(msg);
        }
      },
    });
  }

  useEffect(() => {
    if (!isOpen || !userProfile?.uid || currentAuthUid !== userProfile.uid) {
      return;
    }
    const unsub = subscribeUserPayoutAccount(userProfile.uid, (data) => {
      setSavedPayout(data);
      const remoteDraft = {
        methodId: data?.methodId || WITHDRAWAL_PAYOUT_METHODS[0].id,
        methodName:
          (WITHDRAWAL_PAYOUT_METHODS.find((m) => m.id === data?.methodId) ||
            WITHDRAWAL_PAYOUT_METHODS[0]).name,
        accountValue: String(data?.accountValue || '').trim(),
        holderName: String(data?.holderName || '').trim(),
      };
      const remoteSig = createSectionSignature(remoteDraft);
      if (remoteSig !== lastRemotePayoutSigRef.current) {
        lastRemotePayoutSigRef.current = remoteSig;
        if (
          !payoutSaverRef.current?.isBusyOrPending() &&
          remoteSig !== lastSavedPayoutSigRef.current
        ) {
          lastSavedPayoutSigRef.current = remoteSig;
          payoutDraftRef.current = {
            methodId: remoteDraft.methodId,
            accountValue: remoteDraft.accountValue,
            holderName: remoteDraft.holderName,
          };
          setPayoutMethodId(remoteDraft.methodId);
          setPayoutAccountValue(remoteDraft.accountValue);
          setPayoutHolderName(remoteDraft.holderName);
          setPayoutSaveStatus({ state: data?.accountValue ? 'saved' : 'idle', message: '' });
        }
      }
    });
    return () => {
      payoutSaverRef.current?.flush();
      unsub();
    };
  }, [isOpen, userProfile?.uid, currentAuthUid]);

  // Seguridad estricta: solo el dueño autenticado de este uid puede abrir su configuración privada
  if (!isOpen || !userProfile?.uid || currentAuthUid !== userProfile.uid) {
    return null;
  }

  const activePayoutMethod =
    WITHDRAWAL_PAYOUT_METHODS.find((m) => m.id === payoutMethodId) || WITHDRAWAL_PAYOUT_METHODS[0];

  const schedulePayoutSave = (patch, { immediate = false } = {}) => {
    const nextDraft = {
      ...payoutDraftRef.current,
      ...patch,
    };
    payoutDraftRef.current = nextDraft;

    const methodObj =
      WITHDRAWAL_PAYOUT_METHODS.find((m) => m.id === nextDraft.methodId) ||
      WITHDRAWAL_PAYOUT_METHODS[0];

    const check = validatePayoutAccountDraft({
      methodId: methodObj.id,
      methodName: methodObj.name,
      accountValue: nextDraft.accountValue,
      holderName: nextDraft.holderName,
    });

    if (!check.valid) {
      payoutSaverRef.current?.cancel();
      setPayoutSaveStatus(
        String(nextDraft.accountValue || '').trim().length > 0
          ? { state: 'hint', message: check.reason }
          : { state: 'idle', message: '' }
      );
      return;
    }

    const sig = createSectionSignature(check.payload);
    if (sig === lastSavedPayoutSigRef.current) {
      payoutSaverRef.current?.cancel();
      setPayoutSaveStatus({ state: 'saved', message: '' });
      return;
    }

    setPayoutSaveStatus({ state: immediate ? 'saving' : 'pending', message: '' });
    payoutSaverRef.current?.schedule(check.payload, { immediate });
  };

  const handleModalClose = () => {
    payoutSaverRef.current?.flush();
    onClose?.();
  };

  const boosted = isBoostActive(userProfile);
  const proActive = isProActive(userProfile);
  const spendableDiamonds = getSpendableDiamonds(userProfile);
  const diamonds = Number(userProfile.earningsDiamonds || 0);
  const { netPayoutUSD } = calculateWithdrawalBreakdown(diamonds, economyConfig);
  const isDiscoverable = userProfile.discoverable !== false;
  const pushStatus = getBrowserPushStatus();
  const pushEnabled = Boolean(
    userProfile.pushNotificationsEnabled && pushStatus.permission === 'granted'
  );

  const handleTogglePushNotifications = async () => {
    if (busySetting === 'pushNotifications') return;
    setBusySetting('pushNotifications');
    try {
      if (pushEnabled) {
        await disablePushNotifications(userProfile.uid);
        onSuccess?.('🔕 Notificaciones Push desactivadas en este perfil.');
      } else {
        await enablePushNotifications(userProfile.uid);
        onSuccess?.(
          '🔔 ¡Notificaciones Push Web (FCM) activadas! Recibirás alertas de Regalos, Matches y Mensajes.'
        );
      }
    } catch (err) {
      onError?.(err.message || 'No se pudieron activar las notificaciones Push.');
    } finally {
      setBusySetting('');
    }
  };

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
        requireGiftToChat: nextValue
          ? '👑 Solo recibirás chats nuevos de quienes te envíen un regalo.'
          : 'Chat abierto: ahora todos pueden escribirte.',
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

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md max-h-[92dvh] bg-[#FAF7F9] rounded-t-[32px] sm:rounded-[32px] flex flex-col overflow-hidden shadow-2xl animate-sheet-up">
        <LuxuryModalHeader
          icon={Lock}
          iconClassName="bg-gradient-to-br from-emerald-400 to-teal-500 text-zinc-950 shadow-lg shadow-emerald-500/20"
          eyebrow="Bóveda y Seguridad Privada"
          title="Ajustes de Cuenta"
          subtitle={`Solo visible para ti (${userProfile.name})`}
          onClose={handleModalClose}
          closeLabel="Cerrar"
        />

        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4 bg-[#FAF7F9]">
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

          {/* 2. Billetera Privada: Diamantes + Conoscamosnos PRO + Ganancias + Boost */}
          <section className="space-y-2">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 px-1">
              Mis Diamantes, Membresía PRO y Ganancias
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  handleModalClose();
                  onOpenDiamondStore?.('buy');
                }}
                className="p-4 rounded-3xl bg-white border border-sky-200/80 shadow-card text-left hover:border-sky-400 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-sky-700 flex items-center gap-1.5">
                    <Gem className="w-4 h-4 text-sky-500" /> Diamantes
                  </span>
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </div>
                <p className="font-display text-2xl font-black text-zinc-900 mt-1.5 tabular-nums">
                  {spendableDiamonds} 💎
                </p>
                <p className="text-[10px] font-bold text-zinc-500 mt-0.5">
                  Chats, Likes, Boost y Regalos
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleModalClose();
                  onOpenDiamondStore?.('pro');
                }}
                className="p-4 rounded-3xl bg-gradient-to-br from-rose-50 via-white to-amber-50 border border-rose-200/80 shadow-card text-left hover:border-[#FF2E54] transition"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#FF2E54] flex items-center gap-1.5">
                    <Crown className="w-4 h-4 text-amber-500" /> PRO VIP
                  </span>
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </div>
                <p className="font-display text-lg font-black text-zinc-900 mt-1.5 truncate">
                  {proActive ? 'PRO Activo' : 'Hazte PRO'}
                </p>
                <p className="text-[10px] font-bold text-rose-700 mt-0.5 truncate">
                  {proActive
                    ? `Quedan ${formatTimeRemaining(userProfile.proExpiresAt)}`
                    : 'Chats y Likes ilimitados'}
                </p>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                handleModalClose();
                onOpenWithdrawals?.();
              }}
              className="w-full p-4 rounded-3xl bg-white border border-emerald-200/80 shadow-card flex items-center justify-between text-left hover:border-emerald-400 transition"
            >
              <div>
                <span className="text-xs font-extrabold text-emerald-700 flex items-center gap-1.5">
                  <Gem className="w-4 h-4 text-emerald-500" /> Ganancias por Regalos ({diamonds} 💎)
                </span>
                <p className="text-[11px] font-extrabold text-emerald-600 mt-0.5">
                  ≈ {formatUSD(netPayoutUSD)} USD retirables en Binance, Zinli o Pago Móvil
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-emerald-600 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => {
                handleModalClose();
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

          {/* 2.5 Cuenta Privada de Cobro (Binance Pay, Zinli, Pago Móvil) */}
          <section className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
                Cuenta de Cobro para Retiros ($ USD)
              </p>
              {savedPayout?.accountValue && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9.5px] font-extrabold inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Configurada
                </span>
              )}
            </div>

            <div
              onBlurCapture={() => payoutSaverRef.current?.flush()}
              className="bg-white rounded-3xl p-4 shadow-card border border-zinc-200/70 space-y-3"
            >
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Landmark className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-zinc-900">
                    Dónde recibes tus pagos de la plataforma
                  </p>
                  <p className="text-[11px] text-zinc-500 leading-snug mt-0.5">
                    Configura tu <strong>Binance Pay</strong>, <strong>Zinli (USD)</strong> o <strong>Pago Móvil</strong>. Se guarda y pre-carga automáticamente al retirar tus Diamantes.
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="text-[11px] font-bold text-zinc-600 block mb-1">
                    Método de cobro
                  </label>
                  <select
                    value={payoutMethodId}
                    onChange={(e) => {
                      const nextMethodId = e.target.value;
                      setPayoutMethodId(nextMethodId);
                      schedulePayoutSave({ methodId: nextMethodId }, { immediate: true });
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-900 transition"
                  >
                    {WITHDRAWAL_PAYOUT_METHODS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-600 block mb-1">
                    Binance ID, correo Zinli o Pago Móvil
                  </label>
                  <input
                    type="text"
                    value={payoutAccountValue}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPayoutAccountValue(val);
                      schedulePayoutSave({ accountValue: val }, { immediate: false });
                    }}
                    placeholder={activePayoutMethod.placeholder}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-900 transition"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-600 block mb-1">
                    Nombre del titular (opcional)
                  </label>
                  <input
                    type="text"
                    value={payoutHolderName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPayoutHolderName(val);
                      schedulePayoutSave({ holderName: val }, { immediate: false });
                    }}
                    placeholder="Ej. María Pérez"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-900 transition"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                <span className="text-[10px] font-semibold text-zinc-400 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-600 shrink-0" />
                  Bóveda privada · Invisible a otros usuarios
                </span>
                {payoutSaveStatus.state === 'saving' || payoutSaveStatus.state === 'pending' ? (
                  <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-extrabold inline-flex items-center gap-1 shrink-0">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Guardando...
                  </span>
                ) : payoutSaveStatus.state === 'error' ? (
                  <span className="px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-extrabold inline-flex items-center gap-1 shrink-0">
                    <AlertCircle className="w-3 h-3" />
                    {payoutSaveStatus.message || 'Error al guardar'}
                  </span>
                ) : payoutSaveStatus.state === 'hint' ? (
                  <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold shrink-0">
                    Mín. 4 caracteres para guardar
                  </span>
                ) : payoutSaveStatus.state === 'saved' ? (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-extrabold inline-flex items-center gap-1 shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                    Guardado automático
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-500 text-[10px] font-bold shrink-0">
                    Auto-guardado
                  </span>
                )}
              </div>
            </div>
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
                  handleModalClose();
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
                  handleModalClose();
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
                icon={Bell}
                title="Notificaciones Push Web (FCM)"
                description="Recibe alertas en tu navegador cuando te envíen un Regalo, un Match o un mensaje nuevo aunque cierres la PWA."
                checked={pushEnabled}
                busy={busySetting === 'pushNotifications'}
                accent="bg-sky-50 text-sky-600"
                onToggle={handleTogglePushNotifications}
              />
              <SettingsSwitchRow
                icon={Crown}
                title="Solo recibir chat si envían un regalo"
                description="Opcional: monetiza tus conversaciones exigiendo cualquier regalo virtual para escribirte."
                checked={Boolean(userProfile.requireGiftToChat)}
                busy={busySetting === 'requireGiftToChat'}
                accent="bg-amber-50 text-amber-600"
                onToggle={() => handleToggleSetting('requireGiftToChat', !userProfile.requireGiftToChat)}
              />
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

          {/* 5. Panel Super Admin (visible si role === 'SUPER_ADMIN'/'admin' o cuenta verificada Super Admin) */}
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => {
                handleModalClose();
                onOpenAdmin?.();
              }}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#171026] to-[#261229] border border-amber-300/35 text-amber-200 text-xs font-extrabold flex items-center justify-between shadow-md hover:brightness-110 transition"
            >
              <span className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" /> Abrir Dashboard Super Admin
              </span>
              <span>/admin-dashboard →</span>
            </button>
          )}

          {/* 6. Cerrar sesión */}
          <button
            type="button"
            onClick={() => {
              handleModalClose();
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
