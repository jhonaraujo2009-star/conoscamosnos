import { useState } from 'react';
import { Clock, Coins, Crown, Sparkles, X, Zap } from 'lucide-react';
import { BOOST_PLANS } from '../../config/constants';
import { activateCountryBoost } from '../../services/monetizationService';
import { formatTimeRemaining, isBoostActive } from '../../utils/formatters';

export default function BoostModal({
  isOpen,
  onClose,
  userProfile,
  onOpenCoinStore,
  onSuccess,
  onError,
}) {
  const [loadingPlanId, setLoadingPlanId] = useState(null);

  if (!isOpen) return null;

  const currentlyBoosted = isBoostActive(userProfile);

  const handleActivate = async (plan) => {
    if ((userProfile?.coins || 0) < plan.costCoins) {
      onError?.(`Necesitas ${plan.costCoins} monedas. Recarga en la tienda.`);
      onClose();
      onOpenCoinStore();
      return;
    }

    setLoadingPlanId(plan.id);
    try {
      await activateCountryBoost({
        userId: userProfile.uid,
        plan,
      });
      onSuccess?.(`⚡ ¡Boost VIP activado por ${plan.durationHours === 24 ? '24 horas' : '7 días'}!`);
      onClose();
    } catch (err) {
      onError?.(err.message || 'Error al activar el Boost VIP.');
    } finally {
      setLoadingPlanId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/25">
              <Zap className="w-5 h-5 fill-slate-950" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">
                Boost VIP en {userProfile?.country?.flag} {userProfile?.country?.name}
              </h3>
              <p className="text-xs text-slate-400">
                Multiplica tus vistas, likes y regalos recibidos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 mb-4">
          <span className="text-xs text-slate-400">Tu saldo actual</span>
          <span className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-amber-400" />
            {userProfile?.coins || 0} monedas
          </span>
        </div>

        {currentlyBoosted && (
          <div className="mb-4 p-3 rounded-2xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-between text-xs">
            <span className="text-amber-200 font-semibold flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-amber-400" />
              Boost VIP activo (se extenderá si agregas más tiempo)
            </span>
            <span className="font-bold text-amber-300 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatTimeRemaining(userProfile.boostExpiresAt)}
            </span>
          </div>
        )}

        <div className="space-y-3">
          {BOOST_PLANS.map((plan) => {
            const enough = (userProfile?.coins || 0) >= plan.costCoins;
            const isLoading = loadingPlanId === plan.id;
            return (
              <div
                key={plan.id}
                className="p-4 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 hover:border-amber-500/50 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">{plan.title}</h4>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                        {plan.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{plan.subtitle}</p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={Boolean(loadingPlanId)}
                  onClick={() => handleActivate(plan)}
                  className={`mt-3 w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
                    enough
                      ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 hover:brightness-110'
                      : 'bg-slate-800 text-amber-300 hover:bg-slate-700'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  {isLoading
                    ? 'Activando...'
                    : enough
                    ? `Activar por ${plan.costCoins} monedas`
                    : `Recargar monedas (${plan.costCoins} requeridas)`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
