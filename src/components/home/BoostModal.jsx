import { useState } from 'react';
import { Clock, Coins, Crown, Sparkles, Zap } from 'lucide-react';
import { BOOST_PLANS } from '../../config/constants';
import { activateCountryBoost } from '../../services/monetizationService';
import { formatTimeRemaining, isBoostActive } from '../../utils/formatters';
import LuxuryModalHeader from '../layout/LuxuryModalHeader';

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
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md max-h-[92dvh] bg-[#FAF7F9] rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl animate-sheet-up flex flex-col">
        <LuxuryModalHeader
          icon={Zap}
          iconClassName="bg-gradient-to-br from-fuchsia-500 via-purple-500 to-[#FF2E54] text-white shadow-lg shadow-purple-500/30"
          eyebrow="Visibilidad Destacada"
          title={`Boost VIP en ${userProfile?.country?.flag || ''} ${userProfile?.country?.name || 'Tu país'}`}
          subtitle="Aparece primero en Swipe y Explorar"
          onClose={onClose}
        />

        <div className="p-5 overflow-y-auto no-scrollbar">

        <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-white border border-amber-200/80 shadow-card mb-4">
          <span className="text-xs font-bold text-zinc-600">Tu saldo disponible</span>
          <span className="text-sm font-extrabold text-amber-700 flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-amber-500" />
            {userProfile?.coins || 0} monedas
          </span>
        </div>

        {currentlyBoosted && (
          <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
            <span className="text-emerald-800 font-bold flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-amber-500" />
              Boost VIP activo
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
                className="p-4 rounded-3xl bg-white border border-zinc-200/85 hover:border-purple-300 shadow-card transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-extrabold text-zinc-900">{plan.title}</h4>
                      <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-extrabold">
                        {plan.badge}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600 mt-1">{plan.subtitle}</p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={Boolean(loadingPlanId)}
                  onClick={() => handleActivate(plan)}
                  className={`mt-3 w-full py-3 rounded-full text-xs font-extrabold flex items-center justify-center gap-2 transition shadow-sm ${
                    enough
                      ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                      : 'bg-white border border-zinc-300 text-zinc-900 hover:bg-zinc-100'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-purple-400" />
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
    </div>
  );
}
