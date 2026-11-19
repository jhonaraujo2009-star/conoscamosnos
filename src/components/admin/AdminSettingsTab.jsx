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
  Zap,
} from 'lucide-react';
import {
  ACCESS_MODE_OPTIONS,
  AD_REWARD_CONFIG,
  BOOST_PLANS,
  PRO_PLANS,
  VIRTUAL_GIFTS,
  deriveUnlockMode,
} from '../../config/constants';
import { formatDiamondRateUSD, formatUSD } from '../../utils/formatters';
import { AdminCopyButton, AdminSectionCard } from './AdminPrimitives';

const PRESET_ICONS = {
  free: Unlock,
  ads_only: Tv,
  diamonds_only: Gem,
  hybrid: Sparkles,
};

function AdminToggleSwitch({ label, description, checked, onToggle, accentClass = 'bg-emerald-500' }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#FFFDF8] border border-[#E5D9C3] shadow-sm">
      <div className="min-w-0">
        <p className="text-xs font-extrabold text-[#2C241E]">{label}</p>
        <p className="text-[11px] text-[#857566] leading-snug mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={Boolean(checked)}
        onClick={onToggle}
        className={`relative w-12 h-7 rounded-full shrink-0 transition-colors ${
          checked ? accentClass : 'bg-[#DFD2BC]'
        }`}
      >
        <span
          className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-[#FFFDF8] shadow transition-transform ${
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
  boostPlansDraft = BOOST_PLANS,
  onBoostPlansDraftChange,
  giftsDraft = VIRTUAL_GIFTS,
  onGiftsDraftChange,
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

  const safeCreatorPct = Math.max(5, Math.min(95, Number(creatorSharePct || 60)));
  const previewNetDiamondRate = Number(
    (Number(baseDiamondPrice || 0) * (safeCreatorPct / 100)).toFixed(4)
  );
  const platformFeePct = Math.max(0, Math.min(95, 100 - safeCreatorPct));
  const chatUnlockDiamonds = Math.max(1, Number(accessDraft?.unlockChatDiamonds || 2));
  const likeUnlockDiamonds = Math.max(1, Number(accessDraft?.unlockLikeDiamonds || 2));
  const safeProPlans =
    Array.isArray(proPlansDraft) && proPlansDraft.length > 0 ? proPlansDraft : PRO_PLANS;
  const safeBoostPlans =
    Array.isArray(boostPlansDraft) && boostPlansDraft.length > 0 ? boostPlansDraft : BOOST_PLANS;
  const safeGifts =
    Array.isArray(giftsDraft) && giftsDraft.length > 0 ? giftsDraft : VIRTUAL_GIFTS;
  const minW = Math.max(100, Math.floor(Number(minWithdrawDiamonds || 500)));
  const minWGrossUSD = minW * Number(baseDiamondPrice || 0.01);
  const minWCreatorUSD = minW * previewNetDiamondRate;
  const minWPlatformUSD = Math.max(0, minWGrossUSD - minWCreatorUSD);

  const handleSelectPreset = (preset) => {
    onAccessDraftChange((prev) => ({
      ...prev,
      unlockMode: preset.id,
      enableDiamondCharges: preset.enableDiamondCharges,
      enableRewardedAds: preset.enableRewardedAds,
    }));
  };

  const handleToggleSwitch = (field) => {
    onAccessDraftChange((prev) => {
      const nextDiamonds =
        field === 'enableDiamondCharges' ? !prev.enableDiamondCharges : prev.enableDiamondCharges;
      const nextAds =
        field === 'enableRewardedAds' ? !prev.enableRewardedAds : prev.enableRewardedAds;
      return {
        ...prev,
        enableDiamondCharges: nextDiamonds,
        enableRewardedAds: nextAds,
        unlockMode: deriveUnlockMode(nextDiamonds, nextAds),
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
              <h2 className="font-display text-lg sm:text-xl font-black text-[#2C241E] flex items-center gap-2">
                <Unlock className="w-5 h-5 text-emerald-600" />
                Control Global de Cobros (💎), Anuncios y Retención
              </h2>
              <p className="text-xs text-[#5C4E41] mt-1 leading-relaxed max-w-2xl">
                Economía única 100% en <strong className="text-sky-700">Diamantes (💎)</strong>. Activa <strong className="text-emerald-700">Modo Libre</strong> para retener público nuevo o cambia a <strong className="text-sky-700">Solo Anuncios</strong> / <strong className="text-rose-700">Diamantes + Ads</strong> en 1 clic. Los miembros <strong className="text-[#FF2E54]">Conoscamosnos PRO</strong> tienen chats, Likes y Fotos VIP ilimitados sin anuncios.
              </p>
            </div>

            <span
              className={`px-3 py-1 rounded-full text-[11px] font-black border shrink-0 ${
                accessDraft.unlockMode === 'free'
                  ? 'bg-emerald-100 border-emerald-200 text-emerald-800'
                  : accessDraft.unlockMode === 'ads_only'
                  ? 'bg-sky-100 border-sky-200 text-sky-800'
                  : accessDraft.unlockMode === 'diamonds_only'
                  ? 'bg-amber-100 border-amber-200 text-amber-800'
                  : 'bg-rose-100 border-rose-200 text-rose-800'
              }`}
            >
              {ACCESS_MODE_OPTIONS.find((m) => m.id === accessDraft.unlockMode)?.label || 'Híbrido'}
            </span>
          </div>

          {/* 4 Presets Rápidos Pastel Crema */}
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
                      ? 'bg-gradient-to-br from-emerald-50 via-[#FFFDF8] to-sky-50 border-emerald-400 shadow-md ring-2 ring-emerald-200/70'
                      : 'bg-[#FAF4E8] border-[#E5D9C3] hover:bg-[#FFFDF8] hover:border-[#D5C3A5]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        selected
                          ? 'bg-emerald-500 text-white'
                          : 'bg-[#FFFDF8] border border-[#E5D9C3] text-[#5C4E41]'
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
                  <p className="text-xs font-black text-[#2C241E]">{opt.label}</p>
                  <p className="text-[11px] text-[#857566] mt-1 leading-snug">{opt.description}</p>
                </button>
              );
            })}
          </div>

          {/* Interruptores independientes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <AdminToggleSwitch
              label="Cobrar con Diamantes (💎) por Chats sin Match / Likes"
              description="Si está apagado, no se pedirán Diamantes al público para escribir sin Match o revelar Likes."
              checked={accessDraft.enableDiamondCharges}
              onToggle={() => handleToggleSwitch('enableDiamondCharges')}
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
              <label className="text-[11px] font-bold text-[#5C4E41] block mb-1">
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
              <label className="text-[11px] font-bold text-[#5C4E41] block mb-1">
                Chat Directo (💎)
              </label>
              <input
                type="number"
                min="1"
                max="500"
                required
                value={accessDraft.unlockChatDiamonds}
                onChange={(e) =>
                  onAccessDraftChange((p) => ({ ...p, unlockChatDiamonds: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-xl bg-sky-50/70 border border-sky-200 text-sm font-black text-sky-800 focus:outline-none focus:border-sky-400"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#5C4E41] block mb-1">
                Ver 1 Like / Foto (💎)
              </label>
              <input
                type="number"
                min="1"
                max="500"
                required
                value={accessDraft.unlockLikeDiamonds}
                onChange={(e) =>
                  onAccessDraftChange((p) => ({ ...p, unlockLikeDiamonds: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-xl bg-sky-50/70 border border-sky-200 text-sm font-black text-sky-800 focus:outline-none focus:border-sky-400"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#5C4E41] block mb-1">
                Ver Todos Likes (💎)
              </label>
              <input
                type="number"
                min="1"
                max="2000"
                required
                value={accessDraft.unlockAllLikesDiamonds}
                onChange={(e) =>
                  onAccessDraftChange((p) => ({ ...p, unlockAllLikesDiamonds: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-xl bg-sky-50/70 border border-sky-200 text-sm font-black text-sky-800 focus:outline-none focus:border-sky-400"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#5C4E41] block mb-1">
                Foto VIP (💎)
              </label>
              <input
                type="number"
                min="1"
                max="500"
                required
                value={accessDraft.unlockExclusivePhotoDiamonds}
                onChange={(e) =>
                  onAccessDraftChange((p) => ({
                    ...p,
                    unlockExclusivePhotoDiamonds: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 rounded-xl bg-rose-50/70 border border-rose-200 text-sm font-black text-rose-800 focus:outline-none focus:border-rose-400"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#5C4E41] block mb-1">
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
                className="w-full px-3 py-2 rounded-xl bg-[#FAF0DC]/80 border border-[#E6CE9E] text-sm font-black text-amber-800 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-[#5C4E41] block mb-1">
              Monetag Direct Link / SmartLink activo (https://...)
            </label>
            <input
              type="url"
              value={accessDraft.monetagDirectLink}
              onChange={(e) =>
                onAccessDraftChange((p) => ({ ...p, monetagDirectLink: e.target.value }))
              }
              placeholder={AD_REWARD_CONFIG.monetagDirectLink}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FBF7EE] border border-[#E5D9C3] text-xs font-mono text-[#2C241E] placeholder:text-[#9A8B7A] focus:outline-none focus:border-emerald-400 focus:bg-[#FFFDF9]"
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

      {/* 2. Membresía Conoscamosnos PRO y Tabla de Rentabilidad en Diamantes (💎 / USD) */}
      <AdminSectionCard accent="crimson" className="lg:col-span-2 p-5 sm:p-6">
        <form onSubmit={onSaveProPlansConfig} className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg sm:text-xl font-black text-[#2C241E] flex items-center gap-2">
                <Crown className="w-5 h-5 text-[#FF2E54]" />
                Membresía Conoscamosnos PRO y Tabla de Aproximación (💎 / USD)
              </h2>
              <p className="text-xs text-[#5C4E41] mt-1 leading-relaxed max-w-3xl">
                Configura los precios oficiales de <strong className="text-[#FF2E54]">Conoscamosnos PRO</strong> (solo pago real en USD vía pasarela o transferencia verificada). Quien activa PRO obtiene chats directos ilimitados sin Match, ve todos sus Likes y qué foto le gustó, Modo Pasaporte por país, filtros Check Azul/Online y Cero Anuncios.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-rose-100 border border-rose-200 text-rose-800 text-[11px] font-black shrink-0">
              Solo Pago Real (USD)
            </span>
          </div>

          {/* Planes Editables Conoscamosnos PRO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {safeProPlans.map((plan, idx) => (
              <div
                key={plan.id}
                className="p-4 rounded-2xl bg-gradient-to-br from-[#FDF1EE] via-[#FFFDF8] to-[#FAF0DC] border border-[#EED3CC] space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-black text-[#2C241E] flex items-center gap-1.5">
                      <Crown className="w-3.5 h-3.5 text-[#FF2E54]" />
                      {plan.shortLabel || plan.title}
                    </p>
                    <p className="text-[10.5px] text-[#857566]">{plan.subtitle}</p>
                  </div>
                  {plan.badge && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[9.5px] font-black shrink-0">
                      {plan.badge}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-[#5C4E41] block mb-0.5">
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
                      className="w-full px-2.5 py-1.5 rounded-xl bg-[#FFFDF9] border border-rose-200 text-xs font-black text-[#2C241E]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[#5C4E41] block mb-0.5">
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
                      className="w-full px-2.5 py-1.5 rounded-xl bg-[#FFFDF9] border border-emerald-200 text-xs font-black text-emerald-700"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Planes Editables Boost VIP */}
          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-wider text-purple-700 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-purple-600" />
              Planes Boost VIP (Destacados del País)
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {safeBoostPlans.map((plan, idx) => (
                <div
                  key={plan.id}
                  className="p-4 rounded-2xl bg-gradient-to-br from-purple-50/80 via-[#FFFDF8] to-sky-50/70 border border-purple-200 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-black text-[#2C241E]">{plan.title}</p>
                    {plan.badge && (
                      <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[9.5px] font-black shrink-0">
                        {plan.badge}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-[#5C4E41] block mb-0.5">
                        Duración (horas)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="720"
                        value={plan.durationHours}
                        onChange={(e) => {
                          const next = [...safeBoostPlans];
                          next[idx] = { ...next[idx], durationHours: Number(e.target.value) };
                          onBoostPlansDraftChange?.(next);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-[#FFFDF9] border border-purple-200 text-xs font-black text-[#2C241E]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[#5C4E41] block mb-0.5">
                        Costo en 💎
                      </label>
                      <input
                        type="number"
                        min="10"
                        max="10000"
                        value={plan.costDiamonds ?? plan.costCoins ?? 50}
                        onChange={(e) => {
                          const next = [...safeBoostPlans];
                          next[idx] = { ...next[idx], costDiamonds: Number(e.target.value) };
                          onBoostPlansDraftChange?.(next);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-[#FFFDF9] border border-sky-200 text-xs font-black text-sky-700"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabla de Aproximación Financiera en Tiempo Real (Sistema Único 💎) */}
          <div className="overflow-x-auto rounded-2xl border border-[#E5D9C3] bg-[#FFFDF8]">
            <table className="w-full text-left border-collapse min-w-[680px]">
              <thead>
                <tr className="bg-gradient-to-r from-[#FDF1EE] via-[#FAF0DC] to-[#EEF5FA] border-b border-[#E5D9C3] text-[10.5px] font-black uppercase tracking-wider text-[#4B3E33]">
                  <th className="py-3 px-4">Paquete</th>
                  <th className="py-3 px-3">Compra (💎)</th>
                  <th className="py-3 px-3">Precio USD</th>
                  <th className="py-3 px-3">Costo / 💎</th>
                  <th className="py-3 px-3">Alcance en Chats y Likes</th>
                  <th className="py-3 px-3">Pago Máx. Creador ({safeCreatorPct}%)</th>
                  <th className="py-3 px-4 text-right">Margen Plataforma</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE6D6] text-xs">
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
                    <tr key={pkg.id} className="hover:bg-[#FAF4E8] transition">
                      <td className="py-3 px-4 font-extrabold text-[#2C241E]">
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
                      <td className="py-3 px-3 font-black text-[#2C241E] tabular-nums">
                        ${price.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 font-mono text-[#5C4E41] tabular-nums">
                        ${costPerDiamond.toFixed(4)}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-black text-[#3B2E24] tabular-nums">
                          ~{chatsApprox} chats ({chatUnlockDiamonds} 💎 c/u)
                        </span>
                        <span className="block text-[10px] text-[#857566]">
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

          {/* Precios Editables de Regalos Virtuales (💎) */}
          <div className="p-4 rounded-2xl bg-[#FAF4E8] border border-[#E5D9C3] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#3B2E24]">
                Catálogo de Regalos Virtuales (Editables en 💎)
              </span>
              <span className="text-[10.5px] font-bold text-emerald-700">
                Se sincroniza en vivo con Chat y Perfil ({safeCreatorPct}% al creador)
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {safeGifts.map((gift, idx) => (
                <div
                  key={gift.id}
                  className="p-3 rounded-2xl bg-[#FFFDF8] border border-[#E5D9C3] space-y-1.5 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xl leading-none">{gift.icon}</span>
                    <span className="text-[11px] font-black text-[#2C241E] truncate">
                      {gift.name}
                    </span>
                  </div>
                  <label className="text-[9.5px] font-bold text-[#857566] block">
                    Precio (💎)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50000"
                    required
                    value={gift.price}
                    onChange={(e) => {
                      const next = [...safeGifts];
                      next[idx] = { ...next[idx], price: Number(e.target.value) };
                      onGiftsDraftChange?.(next);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-sky-50/70 border border-sky-200 text-xs font-black text-sky-800 focus:outline-none focus:border-sky-400"
                  />
                  <p className="text-[10px] font-bold text-emerald-700 tabular-nums">
                    Creador: {formatUSD(Number(gift.price || 0) * previewNetDiamondRate)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={savingProPlans}
            className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#FF2E54] via-rose-500 to-amber-500 text-white font-black text-sm shadow-md shadow-rose-200 hover:brightness-105 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {savingProPlans ? 'Guardando cambios...' : 'Guardar Planes PRO, Boost y Regalos en Vivo'}
          </button>
        </form>
      </AdminSectionCard>

      {/* 3. Economía, % de Retiro del Usuario y Paquetes (appConfig/economy) */}
      <AdminSectionCard accent="sky" className="p-5 sm:p-6">
        <form onSubmit={onSaveEconomyConfig} className="space-y-5">
          <div>
            <h2 className="font-display text-lg font-black text-[#2C241E] flex items-center gap-2">
              <Gem className="w-5 h-5 text-sky-600" />
              Economía, % de Retiro y Paquetes (💎)
            </h2>
            <p className="text-xs text-[#5C4E41] mt-1">
              Ajusta el porcentaje que retira el usuario creador en dinero real, el retiro mínimo y los paquetes de Diamantes en tiempo real.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-bold text-[#5C4E41] block mb-1">
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
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FBF7EE] border border-[#E5D9C3] text-sm font-black text-[#2C241E] focus:outline-none focus:border-sky-400 focus:bg-[#FFFDF9]"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#5C4E41] block mb-1">
                % Retiro Usuario (Creador)
              </label>
              <input
                type="number"
                min="5"
                max="95"
                required
                value={creatorSharePct}
                onChange={(e) => onCreatorSharePctChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-sky-50/70 border border-sky-200 text-sm font-black text-sky-900 focus:outline-none focus:border-sky-400 focus:bg-[#FFFDF9]"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#5C4E41] block mb-1">
                Retiro Mín. (💎)
              </label>
              <input
                type="number"
                min="100"
                step="50"
                required
                value={minWithdrawDiamonds}
                onChange={(e) => onMinWithdrawDiamondsChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FBF7EE] border border-[#E5D9C3] text-sm font-black text-[#2C241E] focus:outline-none focus:border-sky-400 focus:bg-[#FFFDF9]"
              />
            </div>
          </div>

          {/* Control rápido e interactivo del % de Retiro Usuario vs Comisión Plataforma */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#EEF5FA] via-[#FFFDF8] to-[#EEF7F1] border border-[#CADEEF] space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[#2C241E] font-bold">
                Reparto de retiros: <strong className="text-emerald-700">{safeCreatorPct}% Usuario</strong> · <strong className="text-indigo-700">{platformFeePct}% Plataforma</strong>
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#FFFDF8] border border-[#CADEEF] text-[11px] font-black text-[#2C241E] tabular-nums">
                {formatDiamondRateUSD(previewNetDiamondRate)} / 💎 neto
              </span>
            </div>

            <input
              type="range"
              min="5"
              max="95"
              step="1"
              value={safeCreatorPct}
              onChange={(e) => onCreatorSharePctChange(e.target.value)}
              className="w-full accent-sky-600 cursor-pointer"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {[50, 60, 70, 75, 80].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => onCreatorSharePctChange(String(pct))}
                    className={`px-2.5 py-1 rounded-full text-[10.5px] font-black border transition ${
                      safeCreatorPct === pct
                        ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                        : 'bg-[#FFFDF8] text-[#4B3E33] border-[#E2D5BE] hover:border-sky-300'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-[#5C4E41] font-semibold tabular-nums">
                Mín. ({minW} 💎): Creador cobra <strong className="text-emerald-700">{formatUSD(minWCreatorUSD)}</strong> · App <strong className="text-indigo-700">{formatUSD(minWPlatformUSD)}</strong>
              </span>
            </div>
          </div>

          <div className="space-y-2.5">
            <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#857566]">
              Paquetes de Diamantes en Tienda (💎)
            </p>
            <div className="space-y-2">
              {packagesDraft.map((pkg, idx) => {
                const units = Number(pkg.diamonds ?? pkg.coins ?? 0);
                const perDiamond = units > 0 ? (Number(pkg.priceUSD || 0) / units).toFixed(4) : '0.0000';
                return (
                  <div
                    key={pkg.id}
                    className="grid grid-cols-12 gap-2 items-center p-3 rounded-2xl bg-[#FAF4E8] border border-[#E5D9C3]"
                  >
                    <div className="col-span-4 min-w-0">
                      <p className="text-xs font-extrabold text-[#2C241E] truncate">{pkg.label}</p>
                      <p className="text-[10px] font-mono text-[#857566]">${perDiamond} / 💎</p>
                    </div>
                    <div className="col-span-4">
                      <label className="text-[9.5px] text-[#857566] font-bold block mb-0.5">Diamantes (💎)</label>
                      <input
                        type="number"
                        min="10"
                        value={units}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const next = [...packagesDraft];
                          const { coins: _omitCoins, ...rest } = next[idx];
                          next[idx] = { ...rest, diamonds: val };
                          onPackagesDraftChange(next);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#FFFDF9] border border-sky-200 text-xs font-black text-sky-700 focus:outline-none focus:border-sky-400"
                      />
                    </div>
                    <div className="col-span-4">
                      <label className="text-[9.5px] text-[#857566] font-bold block mb-0.5">Precio (USD)</label>
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
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#FFFDF9] border border-emerald-200 text-xs font-black text-emerald-700 focus:outline-none focus:border-emerald-400"
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
            {savingConfig ? 'Guardando cambios...' : 'Guardar % de Retiro y Paquetes'}
          </button>
        </form>
      </AdminSectionCard>

      {/* 4. Canales de Pago Editables & Pasarela IPN */}
      <AdminSectionCard accent="amber" className="p-5 sm:p-6">
        <form onSubmit={onSaveChannelsConfig} className="space-y-4">
          <div>
            <h2 className="font-display text-lg font-black text-[#2C241E] flex items-center gap-2">
              <Webhook className="w-5 h-5 text-amber-600" />
              Canales de Cobro y Pasarela IPN
            </h2>
            <p className="text-xs text-[#5C4E41] mt-1 leading-relaxed">
              Activa o edita en tiempo real tus cuentas de cobro directo para compra de Diamantes o Conoscamosnos PRO y verifica NowPayments en el servidor.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#FAF4E8] border border-[#E5D9C3] space-y-2">
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
                    : 'bg-[#F4ECDD] border-[#E2D5BE] text-[#5C4E41]'
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
              <code className="text-xs font-mono text-[#2C241E] break-all flex-1">
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
            <div className="p-3.5 rounded-2xl bg-[#FFFDF8] border border-[#E5D9C3] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-[#2C241E] flex items-center gap-2">
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
                      : 'bg-[#F4ECDD] border-[#E2D5BE] text-[#857566]'
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
                className="w-full px-3 py-2 rounded-xl bg-[#FBF7EE] border border-[#E5D9C3] text-xs font-mono text-[#2C241E] focus:outline-none focus:border-amber-400 focus:bg-[#FFFDF9]"
              />
            </div>

            {/* Pago Móvil */}
            <div className="p-3.5 rounded-2xl bg-[#FFFDF8] border border-[#E5D9C3] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-[#2C241E] flex items-center gap-2">
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
                      : 'bg-[#F4ECDD] border-[#E2D5BE] text-[#857566]'
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
                className="w-full px-3 py-2 rounded-xl bg-[#FBF7EE] border border-[#E5D9C3] text-xs font-mono text-[#2C241E] focus:outline-none focus:border-amber-400 focus:bg-[#FFFDF9]"
              />
            </div>

            {/* Binance Pay Directo */}
            <div className="p-3.5 rounded-2xl bg-[#FFFDF8] border border-[#E5D9C3] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-[#2C241E] flex items-center gap-2">
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
                      : 'bg-[#F4ECDD] border-[#E2D5BE] text-[#857566]'
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
                className="w-full px-3 py-2 rounded-xl bg-[#FBF7EE] border border-[#E5D9C3] text-xs font-mono text-[#2C241E] placeholder:text-[#9A8B7A] focus:outline-none focus:border-amber-400 focus:bg-[#FFFDF9]"
              />
            </div>

            {/* Estado vivo de Ads */}
            <div className="p-3.5 rounded-2xl bg-[#EEF5FA] border border-[#CADEEF] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Tv className="w-4 h-4 text-sky-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-[#2C241E] truncate">
                    Anuncios Monetag ({accessDraft.adDurationSeconds}s)
                  </p>
                  <p className="text-[10.5px] font-mono text-[#857566] truncate">
                    {accessDraft.monetagDirectLink || 'Fallback /ad-viewer.html'}
                  </p>
                </div>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black inline-flex items-center gap-1 shrink-0 border ${
                  accessDraft.enableRewardedAds
                    ? 'bg-sky-100 border-sky-200 text-sky-800'
                    : 'bg-[#F4ECDD] border-[#E2D5BE] text-[#857566]'
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
