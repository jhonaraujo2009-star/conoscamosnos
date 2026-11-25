import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Gem,
  Loader2,
  Play,
  ShieldCheck,
  Sparkles,
  Tv,
  X,
} from 'lucide-react';
import { resolveAccessPolicy } from '../../config/constants';
import { useAuth } from '../../contexts/AuthContext';
import {
  buildIsolatedAdViewerUrl,
  openIsolatedAdViewer,
  subscribeAdViewerSession,
} from '../../services/monetagLoader';
import { getPrimaryPhoto, triggerHaptic } from '../../utils/formatters';

function playCompletionChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    [587.33, 880].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0.001, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.08, now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.26);
    });
    setTimeout(() => ctx.close().catch(() => {}), 500);
  } catch {
    // Silencioso si el navegador restringe AudioContext
  }
}

export default function RewardedAdModal({
  isOpen,
  onClose,
  onRewardEarned,
  onUseDiamondsInstead,
  purpose = 'reveal_like',
  targetName = 'este perfil',
  targetUser = null,
  adSession = null,
  diamondCost = 0,
}) {
  const { economyConfig } = useAuth();
  const policy = resolveAccessPolicy(economyConfig);
  const duration = Math.max(5, Number(adSession?.duration || policy.adDurationSeconds || 12));

  const [session, setSession] = useState(adSession);
  const [adState, setAdState] = useState('watching'); // watching | ready | claiming
  const [secondsLeft, setSecondsLeft] = useState(duration);
  const [claimError, setClaimError] = useState('');

  const startedAtRef = useRef(Date.now());
  const chimePlayedRef = useRef(false);

  const firstName = String(targetName || targetUser?.name || 'este perfil').split(' ')[0];
  const avatarUrl = targetUser ? getPrimaryPhoto(targetUser) : '';

  useEffect(() => {
    if (!isOpen) {
      chimePlayedRef.current = false;
      return;
    }

    setClaimError('');
    chimePlayedRef.current = false;

    const activeSession =
      adSession?.token
        ? {
            ...adSession,
            url:
              adSession.url ||
              buildIsolatedAdViewerUrl({
                token: adSession.token,
                purpose,
                targetName: firstName,
                duration,
                directLink: policy.monetagDirectLink,
                embedded: true,
              }),
          }
        : openIsolatedAdViewer({
            purpose,
            targetName: firstName,
            duration,
            directLink: policy.monetagDirectLink,
            embedded: true,
          });

    startedAtRef.current = activeSession.startedAt || Date.now();
    setSession(activeSession);
    setAdState('watching');
    setSecondsLeft(duration);
  }, [isOpen, adSession, purpose, firstName, duration, policy.monetagDirectLink]);

  useEffect(() => {
    if (!isOpen || !session?.token || adState !== 'watching') return undefined;

    const markReady = () => {
      setSecondsLeft(0);
      setAdState('ready');
      if (!chimePlayedRef.current) {
        chimePlayedRef.current = true;
        triggerHaptic('success');
        playCompletionChime();
      }
    };

    const unsubscribe = subscribeAdViewerSession(session.token, {
      onCompleted: markReady,
      onAborted: () => {
        // En el reproductor embebido el temporizador sigue activo salvo cancelación explícita
      },
    });

    const tick = window.setInterval(() => {
      const elapsedSec = (Date.now() - startedAtRef.current) / 1000;
      const remaining = Math.max(0, Math.ceil(duration - elapsedSec));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        markReady();
      }
    }, 200);

    return () => {
      unsubscribe?.();
      window.clearInterval(tick);
    };
  }, [isOpen, session?.token, adState, duration]);

  if (!isOpen) return null;

  const viewerUrl =
    session?.url ||
    buildIsolatedAdViewerUrl({
      token: session?.token || 'fallback',
      purpose,
      targetName: firstName,
      duration,
      directLink: policy.monetagDirectLink,
      embedded: true,
    });

  const progress = Math.min(100, Math.max(0, ((duration - secondsLeft) / duration) * 100));

  const handleClaim = async () => {
    if (adState !== 'ready') return;
    setAdState('claiming');
    setClaimError('');
    try {
      await onRewardEarned?.({
        purpose,
        targetUser,
        durationSeconds: duration,
        token: session?.token || null,
      });
    } catch (err) {
      setAdState('ready');
      setClaimError(err?.message || 'No se pudo acreditar la recompensa. Intenta otra vez.');
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-zinc-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header elegante */}
        <div className="relative bg-gradient-to-br from-zinc-900 via-zinc-900 to-amber-950 px-5 py-4 text-white">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition"
            aria-label="Cerrar anuncio"
          >
            <X className="w-4 h-4 text-white" />
          </button>

          <div className="flex items-center gap-3 pr-8">
            <div className="w-11 h-11 rounded-2xl overflow-hidden bg-white/10 border border-white/20 shrink-0 flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt={firstName} className="w-full h-full object-cover" />
              ) : (
                <Tv className="w-5 h-5 text-amber-300" />
              )}
            </div>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-300">
                <Sparkles className="w-3 h-3" />
                Anuncio Recompensado
              </div>
              <h3 className="text-base font-bold text-white truncate">
                {purpose === 'unlock_chat'
                  ? `Desbloquear chat con ${firstName}`
                  : `Revelar Like de ${firstName}`}
              </h3>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-300">
            <span>
              {adState === 'ready' || adState === 'claiming'
                ? 'Anuncio completado correctamente'
                : `Tiempo restante: ${secondsLeft}s`}
            </span>
            <span className="font-bold text-amber-300 tabular-nums">{Math.round(progress)}%</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/15 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 via-rose-400 to-emerald-400 transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Visor embebido aislado del anuncio (funciona dentro de Android TWA / Safari / Chrome) */}
        <div className="p-4 space-y-3 bg-zinc-50">
          <div className="rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-950 shadow-sm">
            <iframe
              key={session?.token || 'embedded-ad'}
              title="Anuncio patrocinado Monetag"
              src={viewerUrl}
              className="w-full h-[270px] border-0 bg-zinc-950"
              allow="autoplay"
            />
          </div>

          {claimError && (
            <p className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-center">
              {claimError}
            </p>
          )}

          {adState === 'watching' ? (
            <div className="space-y-2">
              <div className="w-full py-3 rounded-2xl bg-zinc-200/80 text-zinc-600 font-semibold text-xs flex items-center justify-center gap-2">
                <Play className="w-3.5 h-3.5 fill-current" />
                Espera {secondsLeft}s para activar tu recompensa gratis
              </div>

              {session?.directLink && (
                <a
                  href={session.directLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 rounded-2xl bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Abrir página del patrocinador (opcional)
                </a>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={handleClaim}
              disabled={adState === 'claiming'}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-70"
            >
              {adState === 'claiming' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Acreditando acceso...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  ¡Reclamar recompensa y continuar!
                </>
              )}
            </button>
          )}

          {policy.enableDiamondCharges && typeof onUseDiamondsInstead === 'function' && diamondCost > 0 && (
            <button
              type="button"
              onClick={() => {
                onClose?.();
                onUseDiamondsInstead?.();
              }}
              className="w-full py-2 rounded-xl text-xs font-semibold text-amber-700 hover:bg-amber-50 flex items-center justify-center gap-1.5 transition"
            >
              <Gem className="w-3.5 h-3.5" />
              O desbloquear al instante por {diamondCost} Diamantes
            </button>
          )}

          <p className="text-[10px] text-zinc-400 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            Sesión protegida y verificada dentro de Conoscamosnos
          </p>
        </div>
      </div>
    </div>
  );
}
