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
    <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md bg-white border border-amber-100 rounded-t-[32px] sm:rounded-[32px] p-6 shadow-luxury">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-md shadow-amber-500/25">
              <Zap className="w-5 h-5 fill-white" />
            </div>
            <div>
              <h3 className="font-display text-base font-extrabold text-slate-900">
                Boost VIP en {userProfile?.country?.flag} {userProfile?.country?.name}
              </h3>
              <p className="text-xs text-slate-500">
                Multiplica tus visitas, likes y mensajes recibidos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 mb-4">
          <span className="text-xs font-semibold text-amber-900">Tu saldo disponible</span>
          <span className="text-sm font-extrabold text-amber-800 flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-amber-500" />
            {userProfile?.coins || 0} monedas
          </span>
        </div>

        {currentlyBoosted && (
          <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
            <span className="text-emerald-800 font-bold flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-amber-500" />
              Boost VIP activo (se sumará el tiempo)
            </span>
            <span className="font-extrabold text-emerald-700 flex items-center gap-1">
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
                className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 hover:border-amber-400 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-extrabold text-slate-900">{plan.title}</h4>
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold">
                        {plan.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{plan.subtitle}</p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={Boolean(loadingPlanId)}
                  onClick={() => handleActivate(plan)}
                  className={`mt-3 w-full py-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition shadow-sm ${
                    enough
                      ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white hover:brightness-105'
                      : 'bg-white border border-amber-300 text-amber-700 hover:bg-amber-50'
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
