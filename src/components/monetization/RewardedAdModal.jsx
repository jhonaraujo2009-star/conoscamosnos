import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Coins,
  Crown,
  ExternalLink,
  Gem,
  PauseCircle,
  Play,
  ShieldCheck,
  Sparkles,
  Tv,
  X,
} from 'lucide-react';
import { AD_REWARD_CONFIG } from '../../config/constants';
import { triggerMonetagZoneTag } from '../../services/monetagLoader';

const SPONSOR_SLIDES = [
  {
    eyebrow: 'EXPERIENCIA PATROCINADA',
    title: 'Conoscamosnos Creador VIP',
    body: '¿Sabías que puedes recibir regalos virtuales y convertir tus Diamantes en dinero real por Binance Pay o Zinli?',
    badge: 'Retiros desde $3.00 USD',
  },
  {
    eyebrow: 'ACCESO GRATUITO CON ANUNCIO',
    title: 'Desbloqueo verificado sin costo',
    body: 'Los anuncios breves mantienen el acceso gratuito para toda la comunidad y respaldan las recompensas de creadores.',
    badge: '100% Seguro · Sin spam',
  },
];

export default function RewardedAdModal({
  isOpen,
  purpose = 'reveal_like', // 'reveal_like' | 'unlock_chat'
  targetName = 'esta persona',
  coinCost = AD_REWARD_CONFIG.unlockLikeCoins,
  onClose,
  onRewardEarned,
  onUseCoinsInstead,
}) {
  const duration = AD_REWARD_CONFIG.adDurationSeconds;
  const provider = AD_REWARD_CONFIG.provider;

  const [secondsLeft, setSecondsLeft] = useState(duration);
  const [paused, setPaused] = useState(false);
  const [rewardReady, setRewardReady] = useState(false);
  const [sdkState, setSdkState] = useState('running'); // 'running' | 'external_opened' | 'sdk_waiting' | 'completed' | 'dismissed'
  const [claiming, setClaiming] = useState(false);

  const slideIdx = purpose === 'unlock_chat' ? 1 : 0;
  const slide = SPONSOR_SLIDES[slideIdx];
  const rewardedRef = useRef(false);

  // Reiniciar cada vez que abre
  useEffect(() => {
    if (!isOpen) return;
    rewardedRef.current = false;
    setSecondsLeft(duration);
    setPaused(false);
    setRewardReady(false);
    setClaiming(false);
    setSdkState('running');

    // Integración nativa Monetag Tag (zona 311878) bajo demanda solo al ver anuncio gratis
    if (provider === 'monetag') {
      triggerMonetagZoneTag();
    }

    // Integración nativa Google H5 Games Ad Placement API (AdSense / Ad Manager Rewarded)
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

  // Pausar cuenta regresiva si la pestaña pierde foco (anti-trampa)
  useEffect(() => {
    if (!isOpen) return;
    const handleVisibility = () => {
      // Si el proveedor abrió un enlace externo patrocinado (Adsterra/Monetag), no penalizar cambio de pestaña
      if (sdkState === 'external_opened' || provider === 'monetag') return;
      setPaused(document.visibilityState !== 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isOpen, sdkState]);

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
  const externalAdUrl =
    provider === 'adsterra'
      ? AD_REWARD_CONFIG.adsterraDirectLink
      : provider === 'custom_url'
      ? AD_REWARD_CONFIG.customSponsorUrl
      : '';

  const handleOpenSponsorLink = () => {
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

  const headline =
    purpose === 'unlock_chat'
      ? `Desbloqueando chat gratis con ${targetName}`
      : 'Revelando quién te dio Like';

  return (
    <div className="fixed inset-0 z-[75] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md bg-[#120911] text-white border border-amber-300/20 rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.65)] animate-sheet-up">
        {/* Top Bar */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3 bg-gradient-to-r from-[#1A0A16] to-[#120911]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-amber-300 via-amber-400 to-rose-500 text-zinc-950 flex items-center justify-center shrink-0 shadow">
              <Tv className="w-4 h-4 stroke-[2.4]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                Anuncio Recompensado
              </p>
              <h3 className="text-xs sm:text-sm font-extrabold text-white truncate">{headline}</h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white text-[11px] font-bold flex items-center gap-1 transition shrink-0"
            title="Cerrar anuncio"
          >
            <X className="w-3.5 h-3.5" />
            {rewardReady ? 'Cerrar' : 'Salir'}
          </button>
        </div>

        {/* Ad Stage */}
        <div className="p-5 space-y-4">
          <div className="relative rounded-3xl overflow-hidden border border-amber-300/25 bg-gradient-to-br from-[#240B1E] via-[#170917] to-[#0D0A14] p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="px-2.5 py-1 rounded-full bg-amber-400/15 border border-amber-300/30 text-amber-200 text-[10px] font-extrabold tracking-wider uppercase flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-300" />
                {slide.eyebrow}
              </span>

              {!rewardReady ? (
                <span className="px-2.5 py-1 rounded-full bg-black/50 border border-white/15 text-xs font-black text-white tabular-nums">
                  {paused ? 'En pausa' : `${secondsLeft}s`}
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-extrabold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Completado
                </span>
              )}
            </div>

            {/* Visual Stage */}
            <div className="py-3 text-center space-y-2.5">
              <div className="w-16 h-16 mx-auto rounded-[22px] bg-gradient-to-br from-amber-300 via-[#FF2E54] to-fuchsia-600 p-[2px] shadow-lg shadow-rose-500/25">
                <div className="w-full h-full rounded-[20px] bg-[#160A14] flex items-center justify-center">
                  {rewardReady ? (
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  ) : paused ? (
                    <PauseCircle className="w-8 h-8 text-amber-300" />
                  ) : (
                    <Crown className="w-8 h-8 text-amber-300" />
                  )}
                </div>
              </div>

              <h4 className="font-display text-lg font-black text-white leading-tight">
                {rewardReady ? '¡Recompensa lista para reclamar!' : slide.title}
              </h4>
              <p className="text-xs text-zinc-300 leading-relaxed max-w-[290px] mx-auto">
                {sdkState === 'dismissed'
                  ? 'Cerraste el anuncio antes de terminar. Espera unos segundos o usa monedas para desbloquear al instante.'
                  : paused
                  ? 'Mantén esta ventana abierta unos segundos para completar tu recompensa gratuita.'
                  : slide.body}
              </p>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-[11px] font-bold text-amber-200">
                <Gem className="w-3.5 h-3.5 text-sky-400" />
                {slide.badge}
              </div>
            </div>

            {/* Enlace patrocinado real cuando el dueño configure Adsterra / Custom URL */}
            {externalAdUrl && !rewardReady && (
              <button
                type="button"
                onClick={handleOpenSponsorLink}
                className="w-full py-2.5 px-4 rounded-2xl bg-amber-400/15 border border-amber-300/35 text-amber-200 text-xs font-extrabold flex items-center justify-center gap-1.5 hover:bg-amber-400/25 transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Visitar patrocinador oficial
              </button>
            )}

            {/* Barra de progreso suave */}
            <div className="space-y-1.5">
              <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    rewardReady
                      ? 'bg-gradient-to-r from-emerald-400 to-teal-300'
                      : 'bg-gradient-to-r from-[#FF2E54] via-amber-400 to-yellow-300'
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  Anuncio verificado
                </span>
                <span>{progressPct}%</span>
              </div>
            </div>
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
                  ? 'Desbloqueando...'
                  : purpose === 'unlock_chat'
                  ? `Abrir chat gratis con ${targetName}`
                  : 'Ver quién me dio Like ahora'}
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="w-full py-3.5 rounded-full bg-white/10 text-zinc-300 font-extrabold text-xs flex items-center justify-center gap-2 cursor-not-allowed"
              >
                <Play className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                {paused
                  ? 'Reanuda esta pantalla para continuar...'
                  : `Espera ${secondsLeft}s para desbloquear gratis...`}
              </button>
            )}

            {!rewardReady && onUseCoinsInstead && (
              <button
                type="button"
                onClick={onUseCoinsInstead}
                className="w-full py-3 rounded-full bg-white/5 hover:bg-white/10 border border-amber-300/25 text-amber-200 text-xs font-extrabold flex items-center justify-center gap-1.5 transition"
              >
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                Omitir anuncio y usar {coinCost} monedas al instante
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
