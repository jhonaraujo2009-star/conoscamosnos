import { useEffect, useState } from 'react';
import {
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
  deriveUnlockMode,
} from '../../config/constants';
import { AdminCopyButton, AdminSectionCard } from './AdminPrimitives';

const PRESET_ICONS = {
  free: Unlock,
  ads_only: Tv,
  coins_only: Coins,
  hybrid: Sparkles,
};

function AdminToggleSwitch({ label, description, checked, onToggle, accentClass = 'bg-emerald-400' }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
      <div className="min-w-0">
        <p className="text-xs font-extrabold text-white">{label}</p>
        <p className="text-[11px] text-zinc-400 leading-snug mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={Boolean(checked)}
        onClick={onToggle}
        className={`relative w-12 h-7 rounded-full shrink-0 transition-colors ${
          checked ? accentClass : 'bg-white/15'
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
      {/* Control Global de Monetización, Anuncios y Modo Libre */}
      <AdminSectionCard accent="emerald" className="lg:col-span-2 p-5 sm:p-6">
        <form onSubmit={onSaveAccessConfig} className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg sm:text-xl font-black text-white flex items-center gap-2">
                <Unlock className="w-5 h-5 text-emerald-400" />
                Control Global de Cobros, Anuncios y Retención
              </h2>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed max-w-2xl">
                Activa o desactiva globalmente el cobro con monedas o los anuncios para enviar mensajes sin Match y ver Likes. Úsalo en <strong className="text-emerald-300">Modo Libre</strong> al iniciar para retener público nuevo y luego activa <strong className="text-white">Solo Anuncios</strong> o <strong className="text-amber-300">Monedas + Ads</strong> en 1 clic.
              </p>
            </div>

            <span
              className={`px-3 py-1 rounded-full text-[11px] font-black border shrink-0 ${
                accessDraft.unlockMode === 'free'
                  ? 'bg-emerald-500/20 border-emerald-400/35 text-emerald-300'
                  : accessDraft.unlockMode === 'ads_only'
                  ? 'bg-sky-500/20 border-sky-400/35 text-sky-300'
                  : accessDraft.unlockMode === 'coins_only'
                  ? 'bg-amber-400/20 border-amber-300/35 text-amber-200'
                  : 'bg-rose-500/20 border-rose-400/35 text-rose-200'
              }`}
            >
              {ACCESS_MODE_OPTIONS.find((m) => m.id === accessDraft.unlockMode)?.label || 'Híbrido'}
            </span>
          </div>

          {/* 4 Presets Rápidos */}
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
                      ? 'bg-gradient-to-br from-emerald-500/20 via-white/[0.08] to-sky-500/10 border-emerald-400 shadow-lg shadow-emerald-500/10'
                      : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.07]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        selected ? 'bg-emerald-400 text-zinc-950' : 'bg-white/10 text-zinc-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    {selected && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-400/25 text-emerald-200 text-[9.5px] font-black uppercase">
                        Seleccionado
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-black text-white">{opt.label}</p>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-snug">{opt.description}</p>
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
              accentClass="bg-amber-400"
            />
            <AdminToggleSwitch
              label="Habilitar Anuncios Monetag Recompensados"
              description="Si está apagado, nunca se abrirá el anuncio ni se exigirá espera publicitaria para desbloquear."
              checked={accessDraft.enableRewardedAds}
              onToggle={() => handleToggleSwitch('enableRewardedAds')}
              accentClass="bg-emerald-400"
            />
          </div>

          {/* Parámetros de Anuncios y Tarifas en vivo */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="text-[11px] font-bold text-zinc-300 block mb-1">
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
                className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/15 text-sm font-black text-emerald-300 focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-zinc-300 block mb-1">
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
                className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/15 text-sm font-black text-amber-300 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-zinc-300 block mb-1">
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
                className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/15 text-sm font-black text-amber-300 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-zinc-300 block mb-1">
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
                className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/15 text-sm font-black text-amber-300 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-zinc-300 block mb-1">
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
                className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/15 text-sm font-black text-sky-300 focus:outline-none focus:border-sky-400"
              />
            </div>

            <div className="col-span-2 sm:col-span-3 lg:col-span-1 flex items-end">
              <div className="w-full px-3 py-2 rounded-xl bg-black/35 border border-white/10 text-[10.5px] text-zinc-400">
                Recomendado: <strong className="text-emerald-300">10–12s</strong> para carga en datos móviles.
              </div>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-zinc-300 block mb-1">
              Monetag Direct Link / SmartLink activo (https://...)
            </label>
            <input
              type="url"
              value={accessDraft.monetagDirectLink}
              onChange={(e) =>
                onAccessDraftChange((p) => ({ ...p, monetagDirectLink: e.target.value }))
              }
              placeholder={AD_REWARD_CONFIG.monetagDirectLink}
              className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-xs font-mono text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-400"
            />
          </div>

          <button
            type="submit"
            disabled={savingAccess}
            className="w-full py-3.5 rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-sky-400 text-zinc-950 font-black text-sm shadow-lg shadow-emerald-500/20 hover:brightness-110 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {savingAccess ? 'Aplicando en toda la app...' : 'Guardar y Aplicar Política Global en Vivo'}
          </button>
        </form>
      </AdminSectionCard>

      {/* Economía y Precios (appConfig/economy) */}
      <AdminSectionCard accent="sky" className="p-5 sm:p-6">
        <form onSubmit={onSaveEconomyConfig} className="space-y-5">
          <div>
            <h2 className="font-display text-lg font-black text-white flex items-center gap-2">
              <Gem className="w-5 h-5 text-sky-400" />
              Economía y Paquetes (Tiempo Real)
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Los cambios se guardan en <code className="text-sky-300">appConfig/economy</code> y se aplican al instante en tienda y retiros.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-bold text-zinc-300 block mb-1">
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
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.05] border border-white/15 text-sm font-black text-white focus:outline-none focus:border-sky-400"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-zinc-300 block mb-1">
                % Neto Creador
              </label>
              <input
                type="number"
                min="10"
                max="95"
                required
                value={creatorSharePct}
                onChange={(e) => onCreatorSharePctChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.05] border border-white/15 text-sm font-black text-white focus:outline-none focus:border-sky-400"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-zinc-300 block mb-1">
                Retiro Mín. (💎)
              </label>
              <input
                type="number"
                min="100"
                step="50"
                required
                value={minWithdrawDiamonds}
                onChange={(e) => onMinWithdrawDiamondsChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.05] border border-white/15 text-sm font-black text-white focus:outline-none focus:border-sky-400"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-400/25 text-xs flex flex-wrap items-center justify-between gap-2">
            <span className="text-sky-200 font-semibold">
              Creador: <strong className="text-white">${previewNetDiamondRate} USD / 💎</strong>
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-[10.5px] font-extrabold text-zinc-200">
              Comisión plataforma: {platformFeePct}%
            </span>
          </div>

          <div className="space-y-2.5">
            <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-zinc-400">
              Paquetes de Monedas en Tienda
            </p>
            <div className="space-y-2">
              {packagesDraft.map((pkg, idx) => {
                const perCoin = pkg.coins > 0 ? (Number(pkg.priceUSD || 0) / Number(pkg.coins)).toFixed(3) : '0.000';
                return (
                  <div
                    key={pkg.id}
                    className="grid grid-cols-12 gap-2 items-center p-3 rounded-2xl bg-white/[0.04] border border-white/[0.08]"
                  >
                    <div className="col-span-4 min-w-0">
                      <p className="text-xs font-extrabold text-white truncate">{pkg.label}</p>
                      <p className="text-[10px] font-mono text-zinc-400">${perCoin} / moneda</p>
                    </div>
                    <div className="col-span-4">
                      <label className="text-[9.5px] text-zinc-400 block mb-0.5">Monedas</label>
                      <input
                        type="number"
                        min="10"
                        value={pkg.coins}
                        onChange={(e) => {
                          const next = [...packagesDraft];
                          next[idx] = { ...next[idx], coins: Number(e.target.value) };
                          onPackagesDraftChange(next);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs font-black text-amber-300"
                      />
                    </div>
                    <div className="col-span-4">
                      <label className="text-[9.5px] text-zinc-400 block mb-0.5">Precio (USD)</label>
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
                        className="w-full px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs font-black text-emerald-300"
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
            className="w-full py-3.5 rounded-full bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-400 text-zinc-950 font-black text-sm shadow-lg shadow-sky-500/20 hover:brightness-110 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {savingConfig ? 'Guardando cambios...' : 'Guardar Configuración Económica'}
          </button>
        </form>
      </AdminSectionCard>

      {/* Canales de Pago Editables & Pasarela IPN */}
      <AdminSectionCard accent="amber" className="p-5 sm:p-6">
        <form onSubmit={onSaveChannelsConfig} className="space-y-4">
          <div>
            <h2 className="font-display text-lg font-black text-white flex items-center gap-2">
              <Webhook className="w-5 h-5 text-amber-400" />
              Canales de Cobro y Pasarela IPN
            </h2>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Activa o edita en tiempo real tus cuentas de cobro directo y verifica la salud real de NowPayments en el servidor.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-black/45 border border-white/10 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
                Endpoint POST NowPayments IPN
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[9.5px] font-black ${
                  gatewayHealth?.ready
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : gatewayHealth
                    ? 'bg-amber-400/20 text-amber-200'
                    : 'bg-white/10 text-zinc-300'
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
              <code className="text-xs font-mono text-white break-all flex-1">
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
            <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-white flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-amber-300" />
                  Zinli (USD · QR oficial)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onChannelsDraftChange((c) => ({ ...c, enableZinli: !c.enableZinli }))
                  }
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                    channelsDraft.enableZinli
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-white/10 text-zinc-400'
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
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs font-mono text-white"
              />
            </div>

            {/* Pago Móvil */}
            <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-white flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-amber-300" />
                  Pago Móvil (Venezuela)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onChannelsDraftChange((c) => ({ ...c, enablePagoMovil: !c.enablePagoMovil }))
                  }
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                    channelsDraft.enablePagoMovil
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-white/10 text-zinc-400'
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
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs font-mono text-white"
              />
            </div>

            {/* Binance Pay Directo */}
            <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
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
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                    channelsDraft.enableBinancePay && channelsDraft.binancePayId.trim()
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-white/10 text-zinc-400'
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
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs font-mono text-white placeholder:text-zinc-500"
              />
            </div>

            {/* Estado vivo de Ads */}
            <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Tv className="w-4 h-4 text-sky-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-white truncate">
                    Anuncios Monetag ({accessDraft.adDurationSeconds}s)
                  </p>
                  <p className="text-[10.5px] font-mono text-zinc-400 truncate">
                    {accessDraft.monetagDirectLink || 'Fallback /ad-viewer.html'}
                  </p>
                </div>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black inline-flex items-center gap-1 shrink-0 ${
                  accessDraft.enableRewardedAds
                    ? 'bg-sky-500/20 text-sky-300'
                    : 'bg-white/10 text-zinc-400'
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
            className="w-full py-3.5 rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 text-zinc-950 font-black text-sm shadow-lg shadow-amber-500/20 hover:brightness-110 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {savingChannels ? 'Guardando canales...' : 'Guardar Canales de Cobro'}
          </button>
        </form>
      </AdminSectionCard>
    </div>
  );
}
