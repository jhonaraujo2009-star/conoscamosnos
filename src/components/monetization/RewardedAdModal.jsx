import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Coins,
  ExternalLink,
  PauseCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Tv,
  X,
} from 'lucide-react';
import { AD_REWARD_CONFIG } from '../../config/constants';
import { triggerMonetagZoneTag } from '../../services/monetagLoader';
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
      gain.gain.exponentialRampToValueAtTime(0.06, now + idx * 0.11 + 0.02);
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
  coinCost = AD_REWARD_CONFIG.unlockLikeCoins,
  onClose,
  onRewardEarned,
  onUseCoinsInstead,
}) {
  const duration = Math.max(3, Number(AD_REWARD_CONFIG.adDurationSeconds || 8));
  const provider = AD_REWARD_CONFIG.provider;

  const [secondsLeft, setSecondsLeft] = useState(duration);
  const [paused, setPaused] = useState(false);
  const [rewardReady, setRewardReady] = useState(false);
  const [sdkState, setSdkState] = useState('running'); // 'running' | 'external_opened' | 'sdk_waiting' | 'completed' | 'dismissed'
  const [claiming, setClaiming] = useState(false);

  const rewardedRef = useRef(false);
  const completedFeedbackDoneRef = useRef(false);
  const originalTitleRef = useRef('');

  // Inicializar cada vez que abre
  useEffect(() => {
    if (!isOpen) return;
    rewardedRef.current = false;
    completedFeedbackDoneRef.current = false;
    setSecondsLeft(duration);
    setPaused(false);
    setRewardReady(false);
    setClaiming(false);
    setSdkState('running');

    if (provider === 'monetag') {
      triggerMonetagZoneTag();
    }

    if (provider === 'adsense_h5' && typeof window !== 'undefined' && typeof window.adBreak === 'function') {
      setSdkState('sdk_waiting');
      try {
        window.adBreak({
          type: 'reward',
          name: `conoscamosnos_${purpose}`,
          beforeReward: (showAdFn) => {
            showAdFn();
          },
          adViewed: () => {
            setSecondsLeft(0);
            setRewardReady(true);
            setSdkState('completed');
          },
          adDismissed: () => {
            setSdkState('dismissed');
          },
        });
      } catch {
        setSdkState('running');
      }
    }
  }, [isOpen, duration, provider, purpose]);

  // Avisar en el título de la pestaña para que el usuario sepa exactamente cuándo cerrar el anuncio
  useEffect(() => {
    if (typeof document === 'undefined' || !isOpen) return;
    if (!originalTitleRef.current) {
      originalTitleRef.current = document.title;
    }

    if (rewardReady) {
      document.title = '✅ ¡Listo! Ya puedes cerrar el anuncio — Conoscamosnos';
    } else if (paused) {
      document.title = `⏸️ Regresa para continuar (${secondsLeft}s) — Conoscamosnos`;
    } else {
      document.title = `⏳ Quedan ${secondsLeft}s — Conoscamosnos`;
    }

    return () => {
      if (originalTitleRef.current) {
        document.title = originalTitleRef.current;
      }
    };
  }, [isOpen, rewardReady, paused, secondsLeft]);

  useEffect(() => {
    if (!isOpen && typeof document !== 'undefined' && originalTitleRef.current) {
      document.title = originalTitleRef.current;
      originalTitleRef.current = '';
    }
  }, [isOpen]);

  // Vibración + tono suave una sola vez al completarse el tiempo del anuncio
  useEffect(() => {
    if (isOpen && rewardReady && !completedFeedbackDoneRef.current) {
      completedFeedbackDoneRef.current = true;
      triggerHaptic([24, 55, 36]);
      playCompletionChime();
    }
  }, [isOpen, rewardReady]);

  // Pausar solo cuando el usuario está fuera con un proveedor que no abre pestaña externa
  useEffect(() => {
    if (!isOpen) return;
    const handleVisibility = () => {
      if (sdkState === 'external_opened' || provider === 'monetag') return;
      setPaused(document.visibilityState !== 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isOpen, sdkState, provider]);

  // Contador regresivo verificado
  useEffect(() => {
    if (!isOpen || rewardReady || paused || sdkState === 'sdk_waiting' || sdkState === 'dismissed') {
      return;
    }
    if (secondsLeft <= 0) {
      setRewardReady(true);
      setSdkState('completed');
      return;
    }
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setRewardReady(true);
          setSdkState('completed');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, secondsLeft, rewardReady, paused, sdkState]);

  if (!isOpen) return null;

  const progressPct = Math.min(100, Math.round(((duration - secondsLeft) / duration) * 100));
  const ringRadius = 46;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (progressPct / 100) * ringCircumference;

  const externalAdUrl =
    provider === 'adsterra'
      ? AD_REWARD_CONFIG.adsterraDirectLink
      : provider === 'custom_url'
      ? AD_REWARD_CONFIG.customSponsorUrl
      : '';

  const handleOpenSponsorLink = () => {
    if (provider === 'monetag') {
      triggerMonetagZoneTag();
      return;
    }
    if (!externalAdUrl) return;
    setSdkState('external_opened');
    window.open(externalAdUrl, '_blank', 'noopener,noreferrer');
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
      label: 'Patrocinador abierto',
      done: true,
    },
    {
      label: rewardReady ? `Tiempo verificado (${duration}s)` : `Verificando anuncio (${secondsLeft}s)`,
      done: rewardReady,
      active: !rewardReady,
    },
    {
      label: rewardReady ? '¡Ya puedes cerrar el anuncio y entrar!' : 'Cerrar pestaña externa al terminar',
      done: rewardReady,
      active: false,
    },
  ];

  return (
    <div className="fixed inset-0 z-[75] bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md bg-[#0E0913] text-white border border-amber-300/20 rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-[0_28px_90px_rgba(0,0,0,0.8)] animate-sheet-up">
        {/* Top Header */}
        <div className="relative px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3 bg-gradient-to-r from-[#1D0A16] via-[#260D1E] to-[#120915]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-300 via-amber-400 to-[#FF2E54] text-zinc-950 flex items-center justify-center shrink-0 shadow-md">
              {rewardReady ? (
                <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
              ) : (
                <Tv className="w-5 h-5 stroke-[2.3]" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[9.5px] font-black uppercase tracking-[0.16em] text-amber-300">
                {rewardReady ? 'Verificación Completada' : 'Anuncio Patrocinado'}
              </p>
              <h3 className="font-display text-sm sm:text-base font-black text-white truncate">
                {isChatPurpose ? `Desbloqueando chat con ${firstName}` : 'Revelando tu Like secreto'}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-zinc-200 hover:text-white text-[11px] font-bold flex items-center gap-1 transition shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            {rewardReady ? 'Cerrar' : 'Salir'}
          </button>
        </div>

        {/* Stage Central */}
        <div className="p-5 space-y-4">
          <div
            className={`relative rounded-[26px] overflow-hidden border p-5 space-y-4 transition-colors duration-500 ${
              rewardReady
                ? 'bg-gradient-to-br from-[#0F271E] via-[#111E1B] to-[#0D1116] border-emerald-400/40'
                : 'bg-gradient-to-br from-[#1C0B17] via-[#150A15] to-[#0E0A14] border-amber-300/20'
            }`}
          >
            {/* Estado superior */}
            <div className="flex items-center justify-between gap-2">
              <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border ${
                  rewardReady
                    ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                    : 'bg-amber-400/15 border-amber-300/30 text-amber-200'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                {rewardReady ? '100% Verificado' : 'Conteo en vivo'}
              </span>

              <span className="text-[11px] font-extrabold text-zinc-300 tabular-nums">
                {progressPct}%
              </span>
            </div>

            {/* Anillo Circular de Progreso SVG */}
            <div className="flex flex-col items-center text-center space-y-3 py-1">
              <div className="relative w-28 h-28 flex items-center justify-center">
                <svg className="w-28 h-28 -rotate-90" viewBox="0 0 112 112">
                  <circle
                    cx="56"
                    cy="56"
                    r={ringRadius}
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="7"
                  />
                  <circle
                    cx="56"
                    cy="56"
                    r={ringRadius}
                    fill="none"
                    stroke={rewardReady ? '#34D399' : 'url(#adRingGrad)'}
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringOffset}
                    className="transition-all duration-700"
                  />
                  <defs>
                    <linearGradient id="adRingGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#FF2E54" />
                      <stop offset="100%" stopColor="#FBBF24" />
                    </linearGradient>
                  </defs>
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {rewardReady ? (
                    <div className="w-16 h-16 rounded-full bg-emerald-400/20 border border-emerald-300/40 flex items-center justify-center">
                      <CheckCircle2 className="w-9 h-9 text-emerald-300" />
                    </div>
                  ) : paused ? (
                    <PauseCircle className="w-9 h-9 text-amber-300" />
                  ) : avatarSrc ? (
                    <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-white/20">
                      <img
                        src={avatarSrc}
                        alt=""
                        className={`w-full h-full object-cover ${
                          isChatPurpose ? 'brightness-75' : 'blur-sm scale-110 brightness-75'
                        }`}
                      />
                      <span className="absolute inset-0 bg-black/45 flex items-center justify-center font-display text-xl font-black text-white tabular-nums">
                        {secondsLeft}s
                      </span>
                    </div>
                  ) : (
                    <span className="font-display text-2xl font-black text-white tabular-nums">
                      {secondsLeft}s
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="font-serif-display text-lg font-bold text-white leading-snug">
                  {rewardReady
                    ? '¡Listo! Ya puedes cerrar el anuncio'
                    : sdkState === 'dismissed'
                    ? 'Anuncio cerrado antes de tiempo'
                    : paused
                    ? 'Regresa a esta ventana para reanudar'
                    : `Mantén abierto el anuncio ${secondsLeft}s más`}
                </h4>

                <p className="text-xs text-zinc-300 leading-relaxed max-w-[300px] mx-auto">
                  {rewardReady
                    ? 'Tu acceso gratuito ya fue validado. Si tienes otra pestaña del patrocinador abierta, ya puedes cerrarla y entrar.'
                    : 'Cuando la cuenta regresiva llegue a 0s verás ✅ en esta pantalla y en el título de la pestaña para confirmar que ya terminaste.'}
                </p>
              </div>
            </div>

            {/* Rastreador visual de 3 pasos */}
            <div className="space-y-1.5 pt-2 border-t border-white/10">
              {steps.map((st, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[11px] font-bold border ${
                    st.done
                      ? 'bg-emerald-500/15 border-emerald-400/25 text-emerald-200'
                      : st.active
                      ? 'bg-amber-400/10 border-amber-300/25 text-amber-200'
                      : 'bg-white/[0.03] border-white/[0.06] text-zinc-400'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${
                      st.done
                        ? 'bg-emerald-400 text-zinc-950'
                        : st.active
                        ? 'bg-amber-300 text-zinc-950 animate-pulse'
                        : 'bg-white/10 text-zinc-400'
                    }`}
                  >
                    {st.done ? '✓' : idx + 1}
                  </span>
                  <span className="truncate">{st.label}</span>
                </div>
              ))}
            </div>

            {/* Reintento manual si el bloqueador de pop-ups frenó el anuncio */}
            {!rewardReady && (provider === 'monetag' || Boolean(externalAdUrl)) && (
              <button
                type="button"
                onClick={handleOpenSponsorLink}
                className="w-full py-2.5 px-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-zinc-200 text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition"
              >
                {provider === 'monetag' ? (
                  <RefreshCw className="w-3.5 h-3.5 text-amber-300" />
                ) : (
                  <ExternalLink className="w-3.5 h-3.5 text-amber-300" />
                )}
                {provider === 'monetag'
                  ? '¿No abrió la pestaña del anuncio? Toca aquí'
                  : 'Abrir patrocinador oficial'}
              </button>
            )}
          </div>

          {/* CTA Principal */}
          <div className="space-y-2.5">
            {rewardReady ? (
              <button
                type="button"
                disabled={claiming}
                onClick={handleClaimReward}
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 text-zinc-950 font-black text-sm shadow-lg shadow-emerald-500/25 hover:brightness-105 active:scale-[0.99] disabled:opacity-60 transition flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                {claiming
                  ? 'Abriendo acceso...'
                  : isChatPurpose
                  ? `Abrir chat gratis con ${firstName}`
                  : 'Ver quién te dio Like ahora'}
              </button>
            ) : (
              <div className="w-full py-3.5 px-4 rounded-full bg-white/[0.06] border border-white/10 text-zinc-300 font-extrabold text-xs flex items-center justify-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-300" />
                <span>
                  {paused
                    ? 'Vuelve a la pantalla para terminar...'
                    : `Verificando... espera ${secondsLeft}s para desbloquear`}
                </span>
              </div>
            )}

            {!rewardReady && onUseCoinsInstead && (
              <button
                type="button"
                onClick={onUseCoinsInstead}
                className="w-full py-3 rounded-full bg-white/[0.04] hover:bg-white/[0.1] border border-amber-300/25 text-amber-200 text-xs font-extrabold flex items-center justify-center gap-1.5 transition"
              >
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                Omitir espera y usar {coinCost} monedas al instante
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
