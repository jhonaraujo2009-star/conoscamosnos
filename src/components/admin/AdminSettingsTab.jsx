import { CheckCircle2, Gem, Save, ShieldCheck, Tv, Wallet, Webhook } from 'lucide-react';
import { AD_REWARD_CONFIG, DIRECT_PAYMENT_METHODS } from '../../config/constants';
import { AdminCopyButton, AdminSectionCard } from './AdminPrimitives';

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
  webhookEndpointUrl,
  copiedKey,
  onCopyWebhook,
}) {
  const previewNetDiamondRate = Number(
    (Number(baseDiamondPrice || 0) * (Number(creatorSharePct || 60) / 100)).toFixed(4)
  );
  const platformFeePct = Math.max(5, Math.min(90, 100 - Number(creatorSharePct || 60)));
  const hasNowPaymentsPublicKey = Boolean(import.meta.env.VITE_NOWPAYMENTS_PUBLIC_KEY);
  const hasBinanceId = DIRECT_PAYMENT_METHODS.some((m) => m.id === 'binance_pay');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

      {/* Canales de Pago & Webhook */}
      <AdminSectionCard accent="amber" className="p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="font-display text-lg font-black text-white flex items-center gap-2">
            <Webhook className="w-5 h-5 text-amber-400" />
            Canales Activos y Pasarela IPN
          </h2>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            Estado en vivo de tus métodos de cobro y URL oficial de verificación criptográfica.
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-black/45 border border-white/10 space-y-2">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
            Endpoint POST NowPayments IPN
          </span>
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

        <div className="space-y-2.5">
          <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-zinc-400">
            Cuentas y Proveedores en Producción
          </p>

          <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-white truncate">NowPayments (Cripto IPN)</p>
                <p className="text-[10.5px] text-zinc-400 truncate">
                  Firma HMAC-SHA512 + generación de facturas
                </p>
              </div>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                hasNowPaymentsPublicKey
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-amber-400/20 text-amber-200'
              }`}
            >
              {hasNowPaymentsPublicKey ? 'Activo' : 'Configurar'}
            </span>
          </div>

          {DIRECT_PAYMENT_METHODS.map((m) => (
            <div
              key={m.id}
              className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Wallet className="w-4 h-4 text-amber-300 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-white truncate">
                    {m.name} {m.qrImageUrl ? '· QR oficial' : ''}
                  </p>
                  <p className="text-[10.5px] font-mono text-zinc-400 truncate">
                    {m.accountValue}
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black inline-flex items-center gap-1 shrink-0">
                <CheckCircle2 className="w-3 h-3" /> Activo
              </span>
            </div>
          ))}

          {!hasBinanceId && (
            <div className="p-3.5 rounded-2xl bg-black/30 border border-dashed border-white/15 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-zinc-300">Binance Pay Directo</p>
                <p className="text-[10.5px] text-zinc-500">
                  Oculto hasta configurar VITE_BINANCE_PAY_ID real
                </p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-white/[0.06] text-zinc-400 text-[10px] font-bold shrink-0">
                Oculto
              </span>
            </div>
          )}

          <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Tv className="w-4 h-4 text-sky-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-white truncate">
                  Anuncios Recompensados ({AD_REWARD_CONFIG.provider})
                </p>
                <p className="text-[10.5px] text-zinc-400 truncate">
                  Zona {AD_REWARD_CONFIG.monetagZoneId || 'N/A'} · {AD_REWARD_CONFIG.adDurationSeconds}s · Desbloqueo {AD_REWARD_CONFIG.unlockLikeCoins} 🪙
                </p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-black shrink-0">
              Activo
            </span>
          </div>
        </div>
      </AdminSectionCard>
    </div>
  );
}
