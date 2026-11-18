import { useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  CheckCircle2,
  Coins,
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
  VIRTUAL_GIFTS,
  deriveUnlockMode,
} from '../../config/constants';
import { AdminCopyButton, AdminSectionCard } from './AdminPrimitives';

const PRESET_ICONS = {
  free: Unlock,
  ads_only: Tv,
  coins_only: Coins,
  hybrid: Sparkles,
};

const EXCHANGE_RATE_PRESETS = [
  { rate: 1, title: '1:1 Conservador', hint: 'Mismo valor por unidad' },
  { rate: 2, title: '1:2 Sugerido', hint: 'Balance óptimo retención / caja' },
  { rate: 3, title: '1:3 Impulso', hint: 'Atractivo para chatear mucho' },
  { rate: 5, title: '1:5 Promo', hint: 'Máxima conversión a chats' },
];

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
  coinsPerDiamond,
  onCoinsPerDiamondChange,
  savingExchange,
  onSaveExchangeConfig,
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
  const cleanExchangeRate = Math.max(1, Math.min(100, Math.floor(Number(coinsPerDiamond || 2))));
  const chatUnlockCoins = Math.max(1, Number(accessDraft?.unlockLikeChatCoins || 10));

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
      {/* 1. Control Global de Monetización, Anuncios y Modo Libre */}
      <AdminSectionCard accent="emerald" className="lg:col-span-2 p-5 sm:p-6">
        <form onSubmit={onSaveAccessConfig} className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg sm:text-xl font-black text-zinc-900 flex items-center gap-2">
                <Unlock className="w-5 h-5 text-emerald-600" />
                Control Global de Cobros, Anuncios y Retención
              </h2>
              <p className="text-xs text-zinc-600 mt-1 leading-relaxed max-w-2xl">
                Las <strong className="text-amber-700">Monedas (🪙)</strong> son solo para chats y desbloqueos. Activa <strong className="text-emerald-700">Modo Libre</strong> al iniciar para retener público nuevo y cambia a <strong className="text-sky-700">Solo Anuncios</strong> o <strong className="text-rose-700">Monedas + Ads</strong> en 1 clic.
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
              label="Cobrar con Monedas (Chats sin Match / Likes)"
              description="Si está apagado, no se pedirán monedas al público para escribir sin Match o revelar Likes."
              checked={accessDraft.enableCoinCharges}
              onToggle={() => handleToggleSwitch('enableCoinCharges')}
              accentClass="bg-amber-500"
            />
            <AdminToggleSwitch
              label="Habilitar Anuncios Monetag Recompensados"
              description="Si está apagado, nunca se abrirá el anuncio ni se exigirá espera publicitaria para desbloquear."
              checked={accessDraft.enableRewardedAds}
              onToggle={() => handleToggleSwitch('enableRewardedAds')}
              accentClass="bg-emerald-500"
            />
          </div>

          {/* Parámetros de Anuncios y Tarifas en vivo */}
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
                Chat Directo (🪙)
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
                className="w-full px-3 py-2 rounded-xl bg-amber-50/70 border border-amber-200 text-sm font-black text-amber-800 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-zinc-600 block mb-1">
                Ver 1 Like (🪙)
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
                className="w-full px-3 py-2 rounded-xl bg-amber-50/70 border border-amber-200 text-sm font-black text-amber-800 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-zinc-600 block mb-1">
                Ver Todos Likes (🪙)
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
                className="w-full px-3 py-2 rounded-xl bg-amber-50/70 border border-amber-200 text-sm font-black text-amber-800 focus:outline-none focus:border-amber-400"
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
                className="w-full px-3 py-2 rounded-xl bg-sky-50/70 border border-sky-200 text-sm font-black text-sky-800 focus:outline-none focus:border-sky-400"
              />
            </div>

            <div className="col-span-2 sm:col-span-3 lg:col-span-1 flex items-end">
              <div className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-[10.5px] text-zinc-600">
                Recomendado: <strong className="text-emerald-700">10–12s</strong> en móviles.
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

      {/* 2. NUEVA: Tabla de Intercambio y Aproximación Sugerida (💎 -> 🪙 y Retiros USD) */}
      <AdminSectionCard accent="crimson" className="lg:col-span-2 p-5 sm:p-6">
        <form onSubmit={onSaveExchangeConfig} className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg sm:text-xl font-black text-zinc-900 flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-[#FF2E54]" />
                Tabla de Intercambio y Aproximación Sugerida (💎 ↔ 🪙 / USD)
              </h2>
              <p className="text-xs text-zinc-600 mt-1 leading-relaxed max-w-3xl">
                Quien compra <strong className="text-sky-700">Diamantes (💎)</strong> puede enviar regalos o cambiarlos por <strong className="text-amber-700">Monedas (🪙)</strong> para chatear. Quien recibe regalos suma <strong className="text-emerald-700">Diamantes Ganados</strong> y los retira a USD ({creatorSharePct}% neto) o los convierte a monedas con esta misma tasa.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-rose-100 border border-rose-200 text-rose-800 text-[11px] font-black shrink-0">
              1 💎 = {cleanExchangeRate} 🪙 en vivo
            </span>
          </div>

          {/* Controles de Tasa Editable + Presets Sugeridos */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
            <div className="lg:col-span-4 p-4 rounded-2xl bg-gradient-to-br from-rose-50 via-white to-amber-50 border border-rose-200 space-y-2">
              <label className="text-[11px] font-black uppercase tracking-wider text-rose-700 block">
                Tasa Editable: Monedas por 1 💎
              </label>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-2 rounded-xl bg-sky-100 border border-sky-200 text-xs font-black text-sky-800 shrink-0">
                  1 💎 =
                </span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={coinsPerDiamond}
                  onChange={(e) => onCoinsPerDiamondChange(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-rose-200 text-base font-black text-zinc-900 focus:outline-none focus:border-[#FF2E54]"
                />
                <span className="px-2.5 py-2 rounded-xl bg-amber-100 border border-amber-200 text-xs font-black text-amber-800 shrink-0">
                  🪙
                </span>
              </div>
              <p className="text-[11px] text-zinc-600">
                Con <strong>{cleanExchangeRate} 🪙/💎</strong>, desbloquear 1 chat directo ({chatUnlockCoins} 🪙) equivale a <strong>{Math.ceil(chatUnlockCoins / cleanExchangeRate)} 💎</strong>.
              </p>
            </div>

            <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {EXCHANGE_RATE_PRESETS.map((preset) => {
                const isSelected = Number(coinsPerDiamond) === preset.rate;
                return (
                  <button
                    key={preset.rate}
                    type="button"
                    onClick={() => onCoinsPerDiamondChange(String(preset.rate))}
                    className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                      isSelected
                        ? 'bg-gradient-to-br from-rose-50 to-amber-50 border-rose-400 shadow-sm ring-2 ring-rose-200'
                        : 'bg-zinc-50/80 border-zinc-200 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-black text-zinc-900">{preset.title}</span>
                      {preset.rate === 2 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-black">
                          Top
                        </span>
                      )}
                    </div>
                    <p className="text-lg font-display font-black text-[#FF2E54] mt-1">
                      1 💎 → {preset.rate} 🪙
                    </p>
                    <p className="text-[10.5px] text-zinc-500 mt-1 leading-tight">{preset.hint}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tabla de Aproximación Financiera en Tiempo Real */}
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
            <table className="w-full text-left border-collapse min-w-[680px]">
              <thead>
                <tr className="bg-gradient-to-r from-rose-50/90 via-amber-50/70 to-sky-50/90 border-b border-zinc-200 text-[10.5px] font-black uppercase tracking-wider text-zinc-700">
                  <th className="py-3 px-4">Paquete</th>
                  <th className="py-3 px-3">Compra (💎)</th>
                  <th className="py-3 px-3">Precio USD</th>
                  <th className="py-3 px-3">Costo / 💎</th>
                  <th className="py-3 px-3">Cambio a Monedas ({cleanExchangeRate}x)</th>
                  <th className="py-3 px-3">Pago Máx. Creador ({creatorSharePct}%)</th>
                  <th className="py-3 px-4 text-right">Margen Plataforma</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs">
                {packagesDraft.map((pkg) => {
                  const units = Math.max(0, Number(pkg.diamonds ?? pkg.coins ?? 0));
                  const price = Number(pkg.priceUSD || 0);
                  const costPerDiamond = units > 0 ? price / units : 0;
                  const coinsEquivalent = units * cleanExchangeRate;
                  const chatsApprox = Math.floor(coinsEquivalent / chatUnlockCoins);
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
                        <span className="font-black text-amber-700 tabular-nums">
                          {coinsEquivalent.toLocaleString('es-ES')} 🪙
                        </span>
                        <span className="block text-[10px] text-zinc-500">
                          ~{chatsApprox} chats directos
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
                  {gift.icon} {gift.price} 💎 → <strong className="text-emerald-700">${(gift.price * previewNetDiamondRate).toFixed(2)}</strong> netos / {gift.price * cleanExchangeRate} 🪙
                </span>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={savingExchange}
            className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#FF2E54] via-rose-500 to-amber-500 text-white font-black text-sm shadow-md shadow-rose-200 hover:brightness-105 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {savingExchange ? 'Guardando tasa de intercambio...' : 'Guardar Tasa de Intercambio Sugerida'}
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
              Activa o edita en tiempo real tus cuentas de cobro directo para compra de Diamantes y verifica NowPayments en el servidor.
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
