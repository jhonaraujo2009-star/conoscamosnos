import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Crown,
  Gem,
  Save,
  ShieldCheck,
  Sparkles,
  Tv,
  Unlock,
  Wallet,
  Webhook,
} from 'lucide-react';
import {
  ACCESS_MODE_OPTIONS,
  AD_REWARD_CONFIG,
  PRO_PLANS,
  VIRTUAL_GIFTS,
  deriveUnlockMode,
} from '../../config/constants';
import { AdminCopyButton, AdminSectionCard } from './AdminPrimitives';

const PRESET_ICONS = {
  free: Unlock,
  ads_only: Tv,
  coins_only: Gem,
  hybrid: Sparkles,
};

function AdminToggleSwitch({ label, description, checked, onToggle, accentClass = 'bg-emerald-500' }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-white border border-zinc-200/85 shadow-xs">
      <div className="min-w-0">
        <p className="text-xs font-extrabold text-zinc-900">{label}</p>
        <p className="text-[11px] text-zinc-500 leading-snug mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={Boolean(checked)}
        onClick={onToggle}
        className={`relative w-12 h-7 rounded-full shrink-0 transition-colors ${
          checked ? accentClass : 'bg-zinc-200'
        }`}
      >
        <span
          className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

export default function AdminSettingsTab({
  baseDiamondPrice,
  onBaseDiamondPriceChange,
  creatorSharePct,
  onCreatorSharePctChange,
  minWithdrawDiamonds,
  onMinWithdrawDiamondsChange,
  proPlansDraft = PRO_PLANS,
  onProPlansDraftChange,
  savingProPlans,
  onSaveProPlansConfig,
  packagesDraft,
  onPackagesDraftChange,
  savingConfig,
  onSaveEconomyConfig,
  accessDraft,
  onAccessDraftChange,
  savingAccess,
  onSaveAccessConfig,
  channelsDraft,
  onChannelsDraftChange,
  savingChannels,
  onSaveChannelsConfig,
  webhookEndpointUrl,
  copiedKey,
  onCopyWebhook,
}) {
  const [gatewayHealth, setGatewayHealth] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/webhooks/payments')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.configured) {
          setGatewayHealth(data.configured);
        }
      })
      .catch(() => {
        if (!cancelled) setGatewayHealth(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const previewNetDiamondRate = Number(
    (Number(baseDiamondPrice || 0) * (Number(creatorSharePct || 60) / 100)).toFixed(4)
  );
  const platformFeePct = Math.max(5, Math.min(90, 100 - Number(creatorSharePct || 60)));
  const chatUnlockDiamonds = Math.max(1, Number(accessDraft?.unlockLikeChatCoins || 2));
  const likeUnlockDiamonds = Math.max(1, Number(accessDraft?.unlockLikeCoins || 2));
  const safeProPlans =
    Array.isArray(proPlansDraft) && proPlansDraft.length > 0 ? proPlansDraft : PRO_PLANS;

  const handleSelectPreset = (preset) => {
    onAccessDraftChange((prev) => ({
      ...prev,
      unlockMode: preset.id,
      enableCoinCharges: preset.enableCoinCharges,
      enableRewardedAds: preset.enableRewardedAds,
    }));
  };

  const handleToggleSwitch = (field) => {
    onAccessDraftChange((prev) => {
      const nextCoins = field === 'enableCoinCharges' ? !prev.enableCoinCharges : prev.enableCoinCharges;
      const nextAds = field === 'enableRewardedAds' ? !prev.enableRewardedAds : prev.enableRewardedAds;
      return {
        ...prev,
        enableCoinCharges: nextCoins,
        enableRewardedAds: nextAds,
        unlockMode: deriveUnlockMode(nextCoins, nextAds),
      };
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Control Global de Monetización en Diamantes (💎), Anuncios y Modo Libre */}
      <AdminSectionCard accent="emerald" className="lg:col-span-2 p-5 sm:p-6">
        <form onSubmit={onSaveAccessConfig} className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg sm:text-xl font-black text-zinc-900 flex items-center gap-2">
                <Unlock className="w-5 h-5 text-emerald-600" />
                Control Global de Cobros (💎), Anuncios y Retención
              </h2>
              <p className="text-xs text-zinc-600 mt-1 leading-relaxed max-w-2xl">
                Economía unificada en <strong className="text-sky-700">Diamantes (💎)</strong> sin monedas aparte. Activa <strong className="text-emerald-700">Modo Libre</strong> para retener público nuevo o cambia a <strong className="text-sky-700">Solo Anuncios</strong> / <strong className="text-rose-700">Diamantes + Ads</strong> en 1 clic. Los miembros <strong className="text-[#FF2E54]">Conoscamosnos PRO</strong> tienen chats y Likes ilimitados sin anuncios.
              </p>
            </div>

            <span
              className={`px-3 py-1 rounded-full text-[11px] font-black border shrink-0 ${
                accessDraft.unlockMode === 'free'
                  ? 'bg-emerald-100 border-emerald-200 text-emerald-800'
                  : accessDraft.unlockMode === 'ads_only'
                  ? 'bg-sky-100 border-sky-200 text-sky-800'
                  : accessDraft.unlockMode === 'coins_only'
                  ? 'bg-amber-100 border-amber-200 text-amber-800'
                  : 'bg-rose-100 border-rose-200 text-rose-800'
              }`}
            >
              {ACCESS_MODE_OPTIONS.find((m) => m.id === accessDraft.unlockMode)?.label || 'Híbrido'}
            </span>
          </div>

          {/* 4 Presets Rápidos Pastel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {ACCESS_MODE_OPTIONS.map((opt) => {
              const Icon = PRESET_ICONS[opt.id] || Sparkles;
              const selected = accessDraft.unlockMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectPreset(opt)}
                  className={`p-4 rounded-2xl border text-left transition ${
                    selected
                      ? 'bg-gradient-to-br from-emerald-50 via-white to-sky-50 border-emerald-400 shadow-md ring-2 ring-emerald-200/70'
                      : 'bg-zinc-50/70 border-zinc-200 hover:bg-white hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        selected ? 'bg-emerald-500 text-white' : 'bg-white border border-zinc-200 text-zinc-600'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    {selected && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9.5px] font-black uppercase">
                        Activo
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-black text-zinc-900">{opt.label}</p>
                  <p className="text-[11px] text-zinc-500 mt-1 leading-snug">{opt.description}</p>
                </button>
              );
            })}
          </div>

          {/* Interruptores independientes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <AdminToggleSwitch
              label="Cobrar con Diamantes (💎) por Chats sin Match / Likes"
              description="Si está apagado, no se pedirán Diamantes al público para escribir sin Match o revelar Likes."
              checked={accessDraft.enableCoinCharges}
              onToggle={() => handleToggleSwitch('enableCoinCharges')}
              accentClass="bg-sky-500"
            />
            <AdminToggleSwitch
              label="Habilitar Anuncios Monetag Recompensados"
              description="Si está apagado, nunca se abrirá el anuncio ni se exigirá espera publicitaria para desbloquear."
              checked={accessDraft.enableRewardedAds}
              onToggle={() => handleToggleSwitch('enableRewardedAds')}
              accentClass="bg-emerald-500"
            />
          </div>

          {/* Parámetros de Anuncios y Tarifas en Diamantes (💎) en vivo */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="text-[11px] font-bold text-zinc-600 block mb-1">
                Duración Ad (seg)
              </label>
              <input
                type="number"
                min="5"
                max="60"
                required
                value={accessDraft.adDurationSeconds}
                onChange={(e) =>
                  onAccessDraftChange((p) => ({ ...p, adDurationSeconds: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-xl bg-emerald-50/70 border border-emerald-200 text-sm font-black text-emerald-800 focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-zinc-600 block mb-1">
                Chat Directo (💎)
              </label>
              <input
                type="number"
                min="1"
                max="500"
                required
                value={accessDraft.unlockLikeChatCoins}
                onChange={(e) =>
                  onAccessDraftChange((p) => ({ ...p, unlockLikeChatCoins: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-xl bg-sky-50/70 border border-sky-200 text-sm font-black text-sky-800 focus:outline-none focus:border-sky-400"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-zinc-600 block mb-1">
                Ver 1 Like / Foto (💎)
              </label>
              <input
                type="number"
                min="1"
                max="500"
                required
                value={accessDraft.unlockLikeCoins}
                onChange={(e) =>
                  onAccessDraftChange((p) => ({ ...p, unlockLikeCoins: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-xl bg-sky-50/70 border border-sky-200 text-sm font-black text-sky-800 focus:outline-none focus:border-sky-400"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-zinc-600 block mb-1">
                Ver Todos Likes (💎)
              </label>
              <input
                type="number"
                min="1"
                max="2000"
                required
                value={accessDraft.unlockAllLikesCoins}
                onChange={(e) =>
                  onAccessDraftChange((p) => ({ ...p, unlockAllLikesCoins: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-xl bg-sky-50/70 border border-sky-200 text-sm font-black text-sky-800 focus:outline-none focus:border-sky-400"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-zinc-600 block mb-1">
                CPM Est. ($/1k Ads)
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="100"
                required
                value={accessDraft.estimatedAdCpmUSD}
                onChange={(e) =>
                  onAccessDraftChange((p) => ({ ...p, estimatedAdCpmUSD: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-xl bg-amber-50/70 border border-amber-200 text-sm font-black text-amber-800 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="col-span-2 sm:col-span-3 lg:col-span-1 flex items-end">
              <div className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-[10.5px] text-zinc-600">
                Sugerido: <strong className="text-sky-700">1–2 💎</strong> por acción.
              </div>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-zinc-600 block mb-1">
              Monetag Direct Link / SmartLink activo (https://...)
            </label>
            <input
              type="url"
              value={accessDraft.monetagDirectLink}
              onChange={(e) =>
                onAccessDraftChange((p) => ({ ...p, monetagDirectLink: e.target.value }))
              }
              placeholder={AD_REWARD_CONFIG.monetagDirectLink}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-mono text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-emerald-400 focus:bg-white"
            />
          </div>

          <button
            type="submit"
            disabled={savingAccess}
            className="w-full py-3.5 rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 text-white font-black text-sm shadow-md shadow-emerald-200 hover:brightness-105 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {savingAccess ? 'Aplicando en toda la app...' : 'Guardar y Aplicar Política Global en Vivo'}
          </button>
        </form>
      </AdminSectionCard>

      {/* 2. NUEVA: Membresía Conoscamosnos PRO y Tabla de Rentabilidad en Diamantes (💎 / USD) */}
      <AdminSectionCard accent="crimson" className="lg:col-span-2 p-5 sm:p-6">
        <form onSubmit={onSaveProPlansConfig} className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg sm:text-xl font-black text-zinc-900 flex items-center gap-2">
                <Crown className="w-5 h-5 text-[#FF2E54]" />
                Membresía Conoscamosnos PRO y Tabla de Aproximación (💎 / USD)
              </h2>
              <p className="text-xs text-zinc-600 mt-1 leading-relaxed max-w-3xl">
                Configura los precios de <strong className="text-[#FF2E54]">Conoscamosnos PRO</strong> (en USD directo o en Diamantes <strong className="text-sky-700">💎</strong>). Quien activa PRO obtiene chats directos ilimitados sin Match, ve todos sus Likes y qué foto le gustó, Modo Pasaporte por país, filtros Check Azul/Online y Cero Anuncios.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-rose-100 border border-rose-200 text-rose-800 text-[11px] font-black shrink-0">
              Moneda Única: 💎 Diamantes
            </span>
          </div>

          {/* Planes Editables Conoscamosnos PRO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {safeProPlans.map((plan, idx) => (
              <div
                key={plan.id}
                className="p-4 rounded-2xl bg-gradient-to-br from-rose-50/90 via-white to-amber-50/75 border border-rose-200 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-black text-zinc-900 flex items-center gap-1.5">
                      <Crown className="w-3.5 h-3.5 text-[#FF2E54]" />
                      {plan.shortLabel || plan.title}
                    </p>
                    <p className="text-[10.5px] text-zinc-500">{plan.subtitle}</p>
                  </div>
                  {plan.badge && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[9.5px] font-black shrink-0">
                      {plan.badge}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-600 block mb-0.5">
                      Duración (días)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={plan.durationDays}
                      onChange={(e) => {
                        const next = [...safeProPlans];
                        next[idx] = { ...next[idx], durationDays: Number(e.target.value) };
                        onProPlansDraftChange?.(next);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-rose-200 text-xs font-black text-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-600 block mb-0.5">
                      Costo en 💎
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="50000"
                      value={plan.priceDiamonds}
                      onChange={(e) => {
                        const next = [...safeProPlans];
                        next[idx] = { ...next[idx], priceDiamonds: Number(e.target.value) };
                        onProPlansDraftChange?.(next);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-sky-200 text-xs font-black text-sky-700"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-600 block mb-0.5">
                      Precio USD
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.99"
                      max="500"
                      value={plan.priceUSD}
                      onChange={(e) => {
                        const next = [...safeProPlans];
                        next[idx] = { ...next[idx], priceUSD: Number(e.target.value) };
                        onProPlansDraftChange?.(next);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-emerald-200 text-xs font-black text-emerald-700"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Tabla de Aproximación Financiera en Tiempo Real (Moneda Única 💎) */}
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
            <table className="w-full text-left border-collapse min-w-[680px]">
              <thead>
                <tr className="bg-gradient-to-r from-rose-50/90 via-amber-50/70 to-sky-50/90 border-b border-zinc-200 text-[10.5px] font-black uppercase tracking-wider text-zinc-700">
                  <th className="py-3 px-4">Paquete</th>
                  <th className="py-3 px-3">Compra (💎)</th>
                  <th className="py-3 px-3">Precio USD</th>
                  <th className="py-3 px-3">Costo / 💎</th>
                  <th className="py-3 px-3">Alcance en Chats y Likes</th>
                  <th className="py-3 px-3">Pago Máx. Creador ({creatorSharePct}%)</th>
                  <th className="py-3 px-4 text-right">Margen Plataforma</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs">
                {packagesDraft.map((pkg) => {
                  const units = Math.max(0, Number(pkg.diamonds ?? pkg.coins ?? 0));
                  const price = Number(pkg.priceUSD || 0);
                  const costPerDiamond = units > 0 ? price / units : 0;
                  const chatsApprox = Math.floor(units / chatUnlockDiamonds);
                  const likesApprox = Math.floor(units / likeUnlockDiamonds);
                  const maxCreatorUSD = units * previewNetDiamondRate;
                  const platformNetUSD = price - maxCreatorUSD;
                  const marginPct = price > 0 ? Math.round((platformNetUSD / price) * 100) : 0;
                  const healthyMargin = platformNetUSD >= 0;

                  return (
                    <tr key={pkg.id} className="hover:bg-rose-50/30 transition">
                      <td className="py-3 px-4 font-extrabold text-zinc-900">
                        <div className="flex items-center gap-2">
                          <span>{pkg.label}</span>
                          {pkg.badge && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[9.5px] font-black">
                              {pkg.badge}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-black text-sky-700 tabular-nums">
                        {units.toLocaleString('es-ES')} 💎
                      </td>
                      <td className="py-3 px-3 font-black text-zinc-900 tabular-nums">
                        ${price.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 font-mono text-zinc-600 tabular-nums">
                        ${costPerDiamond.toFixed(4)}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-black text-zinc-800 tabular-nums">
                          ~{chatsApprox} chats ({chatUnlockDiamonds} 💎 c/u)
                        </span>
                        <span className="block text-[10px] text-zinc-500">
                          o ~{likesApprox} Likes ({likeUnlockDiamonds} 💎 c/u)
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-indigo-700 tabular-nums">
                        ${maxCreatorUSD.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                            healthyMargin
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {healthyMargin ? '+' : ''}${platformNetUSD.toFixed(2)} ({marginPct}%)
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Aproximación rápida por regalo */}
          <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span className="font-extrabold text-zinc-700">Equivalencia de Regalos al Creador:</span>
            <div className="flex flex-wrap items-center gap-2">
              {VIRTUAL_GIFTS.map((gift) => (
                <span
                  key={gift.id}
                  className="px-2.5 py-1 rounded-full bg-white border border-zinc-200 text-zinc-700 font-bold tabular-nums"
                >
                  {gift.icon} {gift.price} 💎 → <strong className="text-emerald-700">${(gift.price * previewNetDiamondRate).toFixed(2)}</strong> netos al creador
                </span>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={savingProPlans}
            className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#FF2E54] via-rose-500 to-amber-500 text-white font-black text-sm shadow-md shadow-rose-200 hover:brightness-105 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {savingProPlans ? 'Guardando planes PRO...' : 'Guardar Planes Conoscamosnos PRO en Vivo'}
          </button>
        </form>
      </AdminSectionCard>

      {/* 3. Economía y Precios (appConfig/economy) */}
      <AdminSectionCard accent="sky" className="p-5 sm:p-6">
        <form onSubmit={onSaveEconomyConfig} className="space-y-5">
          <div>
            <h2 className="font-display text-lg font-black text-zinc-900 flex items-center gap-2">
              <Gem className="w-5 h-5 text-sky-600" />
              Economía y Paquetes de Diamantes (Tiempo Real)
            </h2>
            <p className="text-xs text-zinc-600 mt-1">
              Los cambios se guardan en <code className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-mono">appConfig/economy</code> y actualizan la tienda y los retiros al instante.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-bold text-zinc-600 block mb-1">
                Base por 💎 (USD)
              </label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                max="5"
                required
                value={baseDiamondPrice}
                onChange={(e) => onBaseDiamondPriceChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-black text-zinc-900 focus:outline-none focus:border-sky-400 focus:bg-white"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-zinc-600 block mb-1">
                % Neto Creador
              </label>
              <input
                type="number"
                min="10"
                max="95"
                required
                value={creatorSharePct}
                onChange={(e) => onCreatorSharePctChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-black text-zinc-900 focus:outline-none focus:border-sky-400 focus:bg-white"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-zinc-600 block mb-1">
                Retiro Mín. (💎)
              </label>
              <input
                type="number"
                min="100"
                step="50"
                required
                value={minWithdrawDiamonds}
                onChange={(e) => onMinWithdrawDiamondsChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-black text-zinc-900 focus:outline-none focus:border-sky-400 focus:bg-white"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200 text-xs flex flex-wrap items-center justify-between gap-2">
            <span className="text-sky-900 font-semibold">
              Creador recibe: <strong className="text-zinc-950">${previewNetDiamondRate} USD / 💎</strong>
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-white border border-sky-200 text-[10.5px] font-extrabold text-sky-800">
              Comisión plataforma: {platformFeePct}%
            </span>
          </div>

          <div className="space-y-2.5">
            <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-zinc-500">
              Paquetes de Diamantes en Tienda (💎)
            </p>
            <div className="space-y-2">
              {packagesDraft.map((pkg, idx) => {
                const units = Number(pkg.diamonds ?? pkg.coins ?? 0);
                const perDiamond = units > 0 ? (Number(pkg.priceUSD || 0) / units).toFixed(4) : '0.0000';
                return (
                  <div
                    key={pkg.id}
                    className="grid grid-cols-12 gap-2 items-center p-3 rounded-2xl bg-zinc-50 border border-zinc-200"
                  >
                    <div className="col-span-4 min-w-0">
                      <p className="text-xs font-extrabold text-zinc-900 truncate">{pkg.label}</p>
                      <p className="text-[10px] font-mono text-zinc-500">${perDiamond} / 💎</p>
                    </div>
                    <div className="col-span-4">
                      <label className="text-[9.5px] text-zinc-500 font-bold block mb-0.5">Diamantes (💎)</label>
                      <input
                        type="number"
                        min="10"
                        value={units}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const next = [...packagesDraft];
                          next[idx] = { ...next[idx], diamonds: val, coins: val };
                          onPackagesDraftChange(next);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-sky-200 text-xs font-black text-sky-700 focus:outline-none focus:border-sky-400"
                      />
                    </div>
                    <div className="col-span-4">
                      <label className="text-[9.5px] text-zinc-500 font-bold block mb-0.5">Precio (USD)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.5"
                        value={pkg.priceUSD}
                        onChange={(e) => {
                          const next = [...packagesDraft];
                          next[idx] = { ...next[idx], priceUSD: Number(e.target.value) };
                          onPackagesDraftChange(next);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-emerald-200 text-xs font-black text-emerald-700 focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={savingConfig}
            className="w-full py-3.5 rounded-full bg-gradient-to-r from-sky-500 via-cyan-500 to-emerald-500 text-white font-black text-sm shadow-md shadow-sky-200 hover:brightness-105 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {savingConfig ? 'Guardando cambios...' : 'Guardar Paquetes y Economía'}
          </button>
        </form>
      </AdminSectionCard>

      {/* 4. Canales de Pago Editables & Pasarela IPN */}
      <AdminSectionCard accent="amber" className="p-5 sm:p-6">
        <form onSubmit={onSaveChannelsConfig} className="space-y-4">
          <div>
            <h2 className="font-display text-lg font-black text-zinc-900 flex items-center gap-2">
              <Webhook className="w-5 h-5 text-amber-600" />
              Canales de Cobro y Pasarela IPN
            </h2>
            <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
              Activa o edita en tiempo real tus cuentas de cobro directo para compra de Diamantes o Conoscamosnos PRO y verifica NowPayments en el servidor.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                Endpoint POST NowPayments IPN
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[9.5px] font-black border ${
                  gatewayHealth?.ready
                    ? 'bg-emerald-100 border-emerald-200 text-emerald-800'
                    : gatewayHealth
                    ? 'bg-amber-100 border-amber-200 text-amber-800'
                    : 'bg-zinc-100 border-zinc-200 text-zinc-600'
                }`}
              >
                {gatewayHealth?.ready
                  ? 'API + Webhook Listos'
                  : gatewayHealth
                  ? 'Faltan env vars en servidor'
                  : 'Verificando servidor...'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono text-zinc-900 break-all flex-1">
                {webhookEndpointUrl}
              </code>
              <AdminCopyButton
                copyKey="webhook_url"
                copiedKey={copiedKey}
                onCopy={onCopyWebhook}
              />
            </div>
          </div>

          {/* Cuentas editables en tiempo real */}
          <div className="space-y-3">
            {/* Zinli */}
            <div className="p-3.5 rounded-2xl bg-white border border-zinc-200 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-zinc-900 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-amber-600" />
                  Zinli (USD · QR oficial)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onChannelsDraftChange((c) => ({ ...c, enableZinli: !c.enableZinli }))
                  }
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                    channelsDraft.enableZinli
                      ? 'bg-emerald-100 border-emerald-200 text-emerald-800'
                      : 'bg-zinc-100 border-zinc-200 text-zinc-500'
                  }`}
                >
                  {channelsDraft.enableZinli ? 'Activo' : 'Pausado'}
                </button>
              </div>
              <input
                type="text"
                value={channelsDraft.zinliEmail}
                onChange={(e) =>
                  onChannelsDraftChange((c) => ({ ...c, zinliEmail: e.target.value }))
                }
                placeholder="correo@zinli.com"
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-mono text-zinc-900 focus:outline-none focus:border-amber-400 focus:bg-white"
              />
            </div>

            {/* Pago Móvil */}
            <div className="p-3.5 rounded-2xl bg-white border border-zinc-200 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-zinc-900 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-amber-600" />
                  Pago Móvil (Venezuela)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onChannelsDraftChange((c) => ({ ...c, enablePagoMovil: !c.enablePagoMovil }))
                  }
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                    channelsDraft.enablePagoMovil
                      ? 'bg-emerald-100 border-emerald-200 text-emerald-800'
                      : 'bg-zinc-100 border-zinc-200 text-zinc-500'
                  }`}
                >
                  {channelsDraft.enablePagoMovil ? 'Activo' : 'Pausado'}
                </button>
              </div>
              <input
                type="text"
                value={channelsDraft.pagoMovilInfo}
                onChange={(e) =>
                  onChannelsDraftChange((c) => ({ ...c, pagoMovilInfo: e.target.value }))
                }
                placeholder="Teléfono | Cédula | Banco"
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-mono text-zinc-900 focus:outline-none focus:border-amber-400 focus:bg-white"
              />
            </div>

            {/* Binance Pay Directo */}
            <div className="p-3.5 rounded-2xl bg-white border border-zinc-200 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-zinc-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Binance Pay Directo (USDT)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onChannelsDraftChange((c) => ({
                      ...c,
                      enableBinancePay: !c.enableBinancePay,
                    }))
                  }
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                    channelsDraft.enableBinancePay && channelsDraft.binancePayId.trim()
                      ? 'bg-emerald-100 border-emerald-200 text-emerald-800'
                      : 'bg-zinc-100 border-zinc-200 text-zinc-500'
                  }`}
                >
                  {channelsDraft.enableBinancePay && channelsDraft.binancePayId.trim()
                    ? 'Activo'
                    : 'Oculto'}
                </button>
              </div>
              <input
                type="text"
                value={channelsDraft.binancePayId}
                onChange={(e) =>
                  onChannelsDraftChange((c) => ({ ...c, binancePayId: e.target.value }))
                }
                placeholder="Tu Binance Pay ID o correo Binance (opcional)"
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-mono text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-amber-400 focus:bg-white"
              />
            </div>

            {/* Estado vivo de Ads */}
            <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Tv className="w-4 h-4 text-sky-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-zinc-900 truncate">
                    Anuncios Monetag ({accessDraft.adDurationSeconds}s)
                  </p>
                  <p className="text-[10.5px] font-mono text-zinc-500 truncate">
                    {accessDraft.monetagDirectLink || 'Fallback /ad-viewer.html'}
                  </p>
                </div>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black inline-flex items-center gap-1 shrink-0 border ${
                  accessDraft.enableRewardedAds
                    ? 'bg-sky-100 border-sky-200 text-sky-800'
                    : 'bg-zinc-100 border-zinc-200 text-zinc-500'
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
                {accessDraft.enableRewardedAds ? 'Activo' : 'Desactivado'}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={savingChannels}
            className="w-full py-3.5 rounded-full bg-gradient-to-r from-amber-500 via-orange-400 to-rose-400 text-white font-black text-sm shadow-md shadow-amber-200 hover:brightness-105 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {savingChannels ? 'Guardando canales...' : 'Guardar Canales de Cobro'}
          </button>
        </form>
      </AdminSectionCard>
    </div>
  );
}
