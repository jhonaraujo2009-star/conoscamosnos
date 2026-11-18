import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Coins,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Tv,
  X,
} from 'lucide-react';
import { AD_REWARD_CONFIG } from '../../config/constants';
import { openIsolatedAdViewer, subscribeAdViewerSession } from '../../services/monetagLoader';
import { getPrimaryPhoto, triggerHaptic } from '../../utils/formatters';

function playCompletionChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    [659.25, 880].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.11);
      gain.gain.setValueAtTime(0.0001, now + idx * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.05, now + idx * 0.11 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.11 + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.11);
      osc.stop(now + idx * 0.11 + 0.3);
    });
  } catch {
    // Silencioso si el navegador restringe AudioContext
  }
}

export default function RewardedAdModal({
  isOpen,
  purpose = 'reveal_like', // 'reveal_like' | 'unlock_chat'
  targetName = 'esta persona',
  targetUser = null,
  adSession = null, // { mode, token, opened, url, startedAt, windowRef }
  coinCost = AD_REWARD_CONFIG.unlockLikeCoins,
  onClose,
  onRewardEarned,
  onUseCoinsInstead,
}) {
  const duration = Math.max(5, Number(AD_REWARD_CONFIG.adDurationSeconds || 8));
  const [session, setSession] = useState(adSession);
  const [secondsLeft, setSecondsLeft] = useState(duration);
  const [adState, setAdState] = useState('waiting_open'); // 'waiting_open' | 'blocked' | 'watching' | 'aborted' | 'completed'
  const [sponsorClicked, setSponsorClicked] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const rewardedRef = useRef(false);
  const soundPlayedRef = useRef(false);
  const startedAtRef = useRef(0);
  const originalTitleRef = useRef('');

  useEffect(() => {
    if (!isOpen) return;
    rewardedRef.current = false;
    soundPlayedRef.current = false;
    setSponsorClicked(false);
    setClaiming(false);
    setSecondsLeft(duration);

    if (adSession) {
      startedAtRef.current = adSession.startedAt || Date.now();
      setSession(adSession);
      setAdState(adSession.opened ? 'watching' : 'blocked');
    } else {
      startedAtRef.current = 0;
      setSession(null);
      setAdState('blocked');
    }
  }, [isOpen, adSession, duration]);

  // Modo 1: Monetag Direct Link — seguimiento por tiempo real de reloj + verificación de cierre anticipado
  useEffect(() => {
    if (!isOpen || !session || session.mode !== 'direct_link' || adState !== 'watching') {
      return;
    }

    const evaluateDirectLinkProgress = () => {
      const elapsedSec = Math.floor((Date.now() - (startedAtRef.current || Date.now())) / 1000);
      if (elapsedSec >= duration) {
        setSecondsLeft(0);
        setAdState('completed');
        return true;
      }

      if (session.windowRef && session.windowRef.closed) {
        setAdState('aborted');
        return true;
      }

      setSecondsLeft(Math.max(1, duration - elapsedSec));
      return false;
    };

    evaluateDirectLinkProgress();
    const interval = setInterval(() => {
      if (evaluateDirectLinkProgress()) {
        clearInterval(interval);
      }
    }, 500);

    const onFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        evaluateDirectLinkProgress();
      }
    };
    document.addEventListener('visibilitychange', onFocusOrVisible);
    window.addEventListener('focus', onFocusOrVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
      window.removeEventListener('focus', onFocusOrVisible);
    };
  }, [isOpen, session, adState, duration]);

  // Modo 2 (respaldo): /ad-viewer.html vía eventos same-origin
  useEffect(() => {
    if (!isOpen || !session?.token || session.mode !== 'ad_viewer') return;

    const unsubscribe = subscribeAdViewerSession(session.token, {
      onStarted: (data) => {
        setAdState((prev) => (prev === 'completed' ? prev : 'watching'));
        if (typeof data.secondsLeft === 'number') {
          setSecondsLeft(data.secondsLeft);
        }
      },
      onTick: (data) => {
        setAdState('watching');
        if (typeof data.secondsLeft === 'number') {
          setSecondsLeft(Math.max(0, data.secondsLeft));
        }
      },
      onSponsorClicked: () => {
        startedAtRef.current = Date.now();
        setSponsorClicked(true);
      },
      onCompleted: () => {
        setSecondsLeft(0);
        setAdState('completed');
      },
      onAborted: () => {
        setAdState((prev) => (prev === 'completed' ? prev : 'aborted'));
      },
    });

    return () => unsubscribe();
  }, [isOpen, session?.token, session?.mode]);

  useEffect(() => {
    if (!isOpen || !sponsorClicked || adState === 'completed' || session?.mode !== 'ad_viewer') {
      return;
    }
    const onReturnFocus = () => {
      if (document.visibilityState !== 'visible') return;
      const elapsedSec = Math.floor((Date.now() - startedAtRef.current) / 1000);
      if (startedAtRef.current > 0 && elapsedSec >= duration - 1) {
        setSecondsLeft(0);
        setAdState('completed');
      }
    };
    document.addEventListener('visibilitychange', onReturnFocus);
    window.addEventListener('focus', onReturnFocus);
    return () => {
      document.removeEventListener('visibilitychange', onReturnFocus);
      window.removeEventListener('focus', onReturnFocus);
    };
  }, [isOpen, sponsorClicked, adState, duration, session?.mode]);

  // Título claro en la pestaña para confirmar al usuario cuándo puede cerrar el anuncio
  useEffect(() => {
    if (typeof document === 'undefined' || !isOpen) return;
    if (!originalTitleRef.current) {
      originalTitleRef.current = document.title;
    }

    if (adState === 'completed') {
      document.title = '✅ ¡Listo! Ya puedes cerrar el anuncio — Conoscamosnos';
    } else if (adState === 'watching') {
      document.title = `⏳ Viendo anuncio (${secondsLeft}s) — Conoscamosnos`;
    } else {
      document.title = originalTitleRef.current;
    }

    return () => {
      if (originalTitleRef.current) {
        document.title = originalTitleRef.current;
      }
    };
  }, [isOpen, adState, secondsLeft]);

  useEffect(() => {
    if (isOpen && adState === 'completed' && !soundPlayedRef.current) {
      soundPlayedRef.current = true;
      triggerHaptic([24, 55, 36]);
      playCompletionChime();
    }
  }, [isOpen, adState]);

  if (!isOpen) return null;

  const rewardReady = adState === 'completed';
  const progressPct = rewardReady
    ? 100
    : adState === 'watching'
    ? Math.min(99, Math.round(((duration - secondsLeft) / duration) * 100))
    : 0;
  const ringRadius = 46;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (progressPct / 100) * ringCircumference;

  const handleOpenAdTab = () => {
    const firstName = (targetUser?.name || targetName || 'esta persona').split(' ')[0];
    const nextSession = openIsolatedAdViewer({
      purpose,
      targetName: firstName,
      duration,
    });
    startedAtRef.current = nextSession.startedAt || Date.now();
    setSession(nextSession);
    setSecondsLeft(duration);
    setSponsorClicked(false);
    setAdState(nextSession.opened ? 'watching' : 'blocked');
  };

  const handleCloseModal = () => {
    try {
      if (session?.windowRef && !session.windowRef.closed) {
        session.windowRef.close();
      }
    } catch {
      // Ignorar si ya cerró o es de otro origen
    }
    onClose?.();
  };

  const handleClaimReward = async () => {
    if (!rewardReady || rewardedRef.current || claiming) return;
    rewardedRef.current = true;
    setClaiming(true);
    try {
      await onRewardEarned?.();
    } finally {
      setClaiming(false);
    }
  };

  const displayName = targetUser?.name || targetName;
  const firstName = (displayName || 'esta persona').split(' ')[0];
  const isChatPurpose = purpose === 'unlock_chat';
  const avatarSrc = targetUser ? getPrimaryPhoto(targetUser, 180) : '';

  const steps = [
    {
      label: adState === 'blocked' ? 'Falta abrir la página del anuncio' : 'Página del anuncio abierta',
      done: adState === 'watching' || rewardReady,
      active: adState === 'blocked' || adState === 'aborted',
    },
    {
      label: rewardReady
        ? `Tiempo completado (${duration}s)`
        : adState === 'aborted'
        ? 'Cerrado antes de completar los 8s'
        : `Viendo patrocinador (${secondsLeft}s)`,
      done: rewardReady,
      active: adState === 'watching',
    },
    {
      label: rewardReady
        ? '¡Ya puedes cerrar esa pestaña y entrar!'
        : 'Cierra el anuncio cuando diga ✓ Listo',
      done: rewardReady,
      active: false,
    },
  ];

  return (
    <div className="fixed inset-0 z-[75] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md bg-[#FAF7F9] text-zinc-900 border border-rose-200/70 rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-[0_24px_70px_-14px_rgba(15,23,42,0.28)] animate-sheet-up">
        {/* Cabecera Clara */}
        <div className="px-5 py-4 border-b border-rose-100 flex items-center justify-between gap-3 bg-gradient-to-r from-[#FFF4F6] via-white to-[#FFF9EE]">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                rewardReady
                  ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white'
                  : 'bg-gradient-to-br from-[#FF2E54] to-amber-400 text-white'
              }`}
            >
              {rewardReady ? (
                <CheckCircle2 className="w-5 h-5 stroke-[2.4]" />
              ) : (
                <Tv className="w-5 h-5 stroke-[2.2]" />
              )}
            </div>
            <div className="min-w-0">
              <p
                className={`text-[9.5px] font-black uppercase tracking-[0.14em] ${
                  rewardReady ? 'text-emerald-700' : 'text-[#E11D48]'
                }`}
              >
                {rewardReady ? 'Anuncio Verificado' : 'Publicidad en Nueva Pestaña'}
              </p>
              <h3 className="font-display text-sm sm:text-base font-black text-zinc-900 truncate">
                {isChatPurpose ? `Desbloqueando chat con ${firstName}` : 'Revelando tu Like secreto'}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCloseModal}
            className="px-3 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[11px] font-bold flex items-center gap-1 transition shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            {rewardReady ? 'Cerrar' : 'Cancelar'}
          </button>
        </div>

        {/* Cuerpo Blanco Luminoso */}
        <div className="p-5 space-y-4">
          <div
            className={`rounded-[26px] border p-5 space-y-4 transition-colors duration-300 shadow-card ${
              rewardReady
                ? 'bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/70 border-emerald-300'
                : adState === 'aborted' || adState === 'blocked'
                ? 'bg-gradient-to-br from-amber-50/90 via-white to-rose-50/70 border-amber-300'
                : 'bg-white border-zinc-200/85'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border ${
                  rewardReady
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : adState === 'aborted' || adState === 'blocked'
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-rose-50 border-rose-200 text-[#E11D48]'
                }`}
              >
                {rewardReady ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" /> 100% Verificado
                  </>
                ) : adState === 'aborted' || adState === 'blocked' ? (
                  <>
                    <AlertCircle className="w-3 h-3" /> Requiere abrir anuncio
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3" /> En curso
                  </>
                )}
              </span>

              <span className="text-[11px] font-black text-zinc-500 tabular-nums">
                {progressPct}%
              </span>
            </div>

            {/* Anillo Circular SVG */}
            <div className="flex flex-col items-center text-center space-y-3 py-1">
              <div className="relative w-28 h-28 flex items-center justify-center">
                <svg className="w-28 h-28 -rotate-90" viewBox="0 0 112 112">
                  <circle
                    cx="56"
                    cy="56"
                    r={ringRadius}
                    fill="none"
                    stroke="#f4f4f5"
                    strokeWidth="7"
                  />
                  <circle
                    cx="56"
                    cy="56"
                    r={ringRadius}
                    fill="none"
                    stroke={rewardReady ? '#10B981' : 'url(#lightAdRing)'}
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringOffset}
                    className="transition-all duration-500"
                  />
                  <defs>
                    <linearGradient id="lightAdRing" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#FF2E54" />
                      <stop offset="100%" stopColor="#F59E0B" />
                    </linearGradient>
                  </defs>
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {rewardReady ? (
                    <div className="w-16 h-16 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center">
                      <CheckCircle2 className="w-9 h-9 text-emerald-600" />
                    </div>
                  ) : adState === 'aborted' || adState === 'blocked' ? (
                    <AlertCircle className="w-9 h-9 text-amber-500" />
                  ) : avatarSrc ? (
                    <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-rose-200 shadow-sm">
                      <img
                        src={avatarSrc}
                        alt=""
                        className={`w-full h-full object-cover ${
                          isChatPurpose ? 'brightness-90' : 'blur-sm scale-110'
                        }`}
                      />
                      <span className="absolute inset-0 bg-black/45 flex items-center justify-center font-display text-lg font-black text-white tabular-nums">
                        {secondsLeft}s
                      </span>
                    </div>
                  ) : (
                    <span className="font-display text-2xl font-black text-zinc-900 tabular-nums">
                      {secondsLeft}s
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="font-serif-display text-lg font-bold text-zinc-900 leading-snug">
                  {rewardReady
                    ? '¡Listo! Ya viste el anuncio'
                    : adState === 'aborted'
                    ? 'Cerraste el anuncio antes de tiempo'
                    : adState === 'blocked'
                    ? 'Toca para abrir el anuncio'
                    : `Anuncio abierto — faltan ${secondsLeft}s`}
                </h4>

                <p className="text-xs text-zinc-600 leading-relaxed max-w-[300px] mx-auto">
                  {rewardReady
                    ? 'Ya cumpliste los 8 segundos verificados. Si todavía tienes abierta la pestaña del anuncio, ya puedes cerrarla y entrar.'
                    : adState === 'aborted'
                    ? `Debes mantener abierta la pestaña del anuncio durante ${duration}s para desbloquear gratis.`
                    : adState === 'blocked'
                    ? 'Tu navegador bloqueó la pestaña automática. Ábrela con el botón verde de abajo para contar los 8 segundos.'
                    : 'Mantén abierta la pestaña del anuncio; cuando terminen los 8s verás ✅ ¡Listo! en el título de esta pestaña y podrás cerrarlo.'}
                </p>
              </div>
            </div>

            {/* Rastreador en 3 pasos */}
            <div className="space-y-1.5 pt-2 border-t border-zinc-100">
              {steps.map((st, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[11px] font-bold border ${
                    st.done
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : st.active
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-zinc-50 border-zinc-200/70 text-zinc-500'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${
                      st.done
                        ? 'bg-emerald-500 text-white'
                        : st.active
                        ? 'bg-amber-400 text-zinc-950 animate-pulse'
                        : 'bg-zinc-200 text-zinc-600'
                    }`}
                  >
                    {st.done ? '✓' : idx + 1}
                  </span>
                  <span className="truncate">{st.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Principal */}
          <div className="space-y-2.5">
            {rewardReady ? (
              <button
                type="button"
                disabled={claiming}
                onClick={handleClaimReward}
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black text-sm shadow-lg shadow-emerald-500/25 hover:brightness-105 active:scale-[0.99] disabled:opacity-60 transition flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                {claiming
                  ? 'Abriendo acceso...'
                  : isChatPurpose
                  ? `Abrir chat gratis con ${firstName}`
                  : 'Ver quién te dio Like ahora'}
              </button>
            ) : adState === 'aborted' || adState === 'blocked' ? (
              <button
                type="button"
                onClick={handleOpenAdTab}
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black text-sm shadow-lg shadow-emerald-500/20 hover:brightness-105 active:scale-[0.99] transition flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Abrir pestaña del anuncio ({duration}s)
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenAdTab}
                className="w-full py-3.5 px-4 rounded-full bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-extrabold text-xs flex items-center justify-center gap-2 shadow-card transition"
              >
                <ShieldCheck className="w-4 h-4 text-[#FF2E54]" />
                <span>
                  Viendo anuncio ({secondsLeft}s) · Toca aquí si no lo ves abierto
                </span>
              </button>
            )}

            {!rewardReady && onUseCoinsInstead && (
              <button
                type="button"
                onClick={onUseCoinsInstead}
                className="w-full py-3 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-extrabold flex items-center justify-center gap-1.5 transition"
              >
                <Coins className="w-3.5 h-3.5 text-amber-600" />
                Omitir espera y usar {coinCost} monedas al instante
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
