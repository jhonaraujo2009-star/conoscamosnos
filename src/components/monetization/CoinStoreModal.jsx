import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coins,
  Copy,
  Download,
  ExternalLink,
  Gem,
  ImagePlus,
  Info,
  Loader2,
  QrCode,
  Sparkles,
  Wallet,
  XCircle,
} from 'lucide-react';
import {
  DIAMOND_PACKAGES,
  DIAMOND_TO_COIN_PRESETS,
  ECONOMY_CONFIG,
  ENABLE_DEMO_PAYMENTS,
  resolveAccessPolicy,
  resolveDirectPaymentMethods,
} from '../../config/constants';
import { useAuth } from '../../contexts/AuthContext';
import { getUserCloudinaryFolder, uploadImageToCloudinary } from '../../services/cloudinaryService';
import {
  createNowPaymentsCheckout,
  simulateAutoPaymentConfirmation,
  submitManualPaymentRequest,
  subscribeMyPaymentRequests,
} from '../../services/monetizationService';
import { convertPurchasedDiamondsToCoins } from '../../services/withdrawalService';
import { buildQrMatrix } from '../../utils/qrGenerator';
import { formatUSD } from '../../utils/formatters';
import LuxuryModalHeader from '../layout/LuxuryModalHeader';

function DynamicQrCode({ payload }) {
  const matrix = useMemo(() => buildQrMatrix(payload, 21), [payload]);
  return (
    <div className="p-3 bg-white rounded-2xl inline-block border border-zinc-200 shadow-sm">
      <svg width="112" height="112" viewBox="0 0 21 21" shapeRendering="crispEdges">
        <rect width="21" height="21" fill="#ffffff" />
        {matrix.map((row, rIdx) =>
          row.map((cell, cIdx) =>
            cell ? (
              <rect key={`${rIdx}-${cIdx}`} x={cIdx} y={rIdx} width="1" height="1" fill="#18181b" />
            ) : null
          )
        )}
      </svg>
    </div>
  );
}

export default function CoinStoreModal({ isOpen, onClose, userProfile, onSuccess, onError }) {
  const { economyConfig, isSuperAdmin } = useAuth();
  const livePackages =
    Array.isArray(economyConfig?.coinPackages) && economyConfig.coinPackages.length > 0
      ? economyConfig.coinPackages
      : DIAMOND_PACKAGES;
  const liveEconomy = economyConfig || ECONOMY_CONFIG;
  const policy = resolveAccessPolicy(liveEconomy);
  const coinsPerDiamond = policy.coinsPerDiamond;

  const liveDirectMethods = useMemo(
    () => resolveDirectPaymentMethods(economyConfig),
    [economyConfig]
  );
  const activeDirectNames = liveDirectMethods
    .map((m) => m.name.replace(/\s*\(.*\)$/, ''))
    .join(' / ');

  const purchasedDiamonds = Number(userProfile?.diamonds || 0);
  const currentCoins = Number(userProfile?.coins || 0);

  const [storeSection, setStoreSection] = useState('buy'); // 'buy' | 'swap'
  const [selectedPkgId, setSelectedPkgId] = useState(livePackages[1]?.id || livePackages[0].id);
  const selectedPkg = livePackages.find((p) => p.id === selectedPkgId) || livePackages[0];
  const selectedPkgUnits = Number(selectedPkg.diamonds ?? selectedPkg.coins ?? 0);

  const [activeTab, setActiveTab] = useState('auto'); // 'auto' | 'direct'
  const [rulesOpen, setRulesOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(Boolean(liveDirectMethods[0]?.qrImageUrl));
  const [simulating, setSimulating] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  const [selectedMethodId, setSelectedMethodId] = useState(liveDirectMethods[0]?.id || 'zinli');
  const selectedMethod =
    liveDirectMethods.find((m) => m.id === selectedMethodId) || liveDirectMethods[0] || null;
  const [referenceNumber, setReferenceNumber] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);
  const [submittingDirect, setSubmittingDirect] = useState(false);
  const [copied, setCopied] = useState(false);
  const [myRequests, setMyRequests] = useState([]);
  const fileInputRef = useRef(null);

  const [swapDiamonds, setSwapDiamonds] = useState(Math.max(10, Math.min(25, purchasedDiamonds || 10)));
  const [swappingCoins, setSwappingCoins] = useState(false);

  useEffect(() => {
    if (liveDirectMethods.length > 0 && !liveDirectMethods.some((m) => m.id === selectedMethodId)) {
      setSelectedMethodId(liveDirectMethods[0].id);
      setQrOpen(Boolean(liveDirectMethods[0]?.qrImageUrl));
    }
  }, [liveDirectMethods, selectedMethodId]);

  useEffect(() => {
    if (!isOpen || !userProfile?.uid) return;
    setSwapDiamonds(purchasedDiamonds >= 10 ? Math.min(25, purchasedDiamonds) : Math.max(1, purchasedDiamonds || 10));
    const unsub = subscribeMyPaymentRequests(userProfile.uid, setMyRequests);
    return () => unsub();
  }, [isOpen, userProfile?.uid]);

  if (!isOpen) return null;

  const handleNowPaymentsCheckout = async () => {
    if (creatingInvoice) return;
    setCreatingInvoice(true);
    try {
      const res = await createNowPaymentsCheckout({ pkg: selectedPkg, creditTarget: 'diamonds' });
      window.open(res.invoiceUrl, '_blank', 'noopener,noreferrer');
      onSuccess?.(
        `⚡ Factura NowPayments abierta por ${formatUSD(selectedPkg.priceUSD)}. Tus +${selectedPkgUnits} 💎 se acreditarán automáticamente al confirmarse.`
      );
    } catch (err) {
      onError?.(err.message || 'No se pudo abrir la pasarela NowPayments.');
    } finally {
      setCreatingInvoice(false);
    }
  };

  const handleSimulateWebhook = async (provider) => {
    setSimulating(true);
    try {
      const res = await simulateAutoPaymentConfirmation({
        userId: userProfile.uid,
        userName: userProfile.name,
        pkg: selectedPkg,
        provider,
        creditTarget: 'diamonds',
      });
      onSuccess?.(`✅ ¡Recarga acreditada! Se sumaron +${res.diamondsAdded} 💎 a tu billetera.`);
    } catch (err) {
      onError?.(err.message || 'No se pudo simular el pago.');
    } finally {
      setSimulating(false);
    }
  };

  const handleUploadProof = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingProof(true);
    try {
      const { url } = await uploadImageToCloudinary(file, {
        folder: getUserCloudinaryFolder(userProfile, 'payment-proofs'),
        tags: ['payment_proof', `user_${userProfile.uid}`],
        compression: { maxDimension: 1600, targetMaxBytes: 420 * 1024 },
      });
      setProofUrl(url);
      onSuccess?.('Comprobante subido correctamente.');
    } catch (err) {
      onError?.(err.message || 'Error subiendo comprobante a Cloudinary.');
    } finally {
      setUploadingProof(false);
    }
  };

  const handleCopyAccount = async () => {
    try {
      await navigator.clipboard.writeText(selectedMethod.accountValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      onError?.('No se pudo copiar automáticamente.');
    }
  };

  const handleSubmitDirect = async (e) => {
    e.preventDefault();
    setSubmittingDirect(true);
    try {
      await submitManualPaymentRequest({
        user: userProfile,
        pkg: selectedPkg,
        method: selectedMethod,
        referenceNumber,
        proofUrl,
        creditTarget: 'diamonds',
      });
      setReferenceNumber('');
      setProofUrl('');
      onSuccess?.('Solicitud enviada al equipo de auditoría. Recibirás tus Diamantes (💎) al aprobarse.');
    } catch (err) {
      onError?.(err.message || 'Error al registrar la solicitud.');
    } finally {
      setSubmittingDirect(false);
    }
  };

  const handleSwapDiamondsToCoins = async (e) => {
    e.preventDefault();
    if (!userProfile?.uid || swappingCoins) return;
    setSwappingCoins(true);
    try {
      const res = await convertPurchasedDiamondsToCoins({
        userId: userProfile.uid,
        amountDiamonds: swapDiamonds,
      });
      onSuccess?.(
        `🪙 ¡Canje exitoso! Convertiste ${res.convertedDiamonds} 💎 en +${res.coinsAdded} Monedas para chats y mensajes.`
      );
    } catch (err) {
      onError?.(err.message || 'No se pudo completar el intercambio.');
    } finally {
      setSwappingCoins(false);
    }
  };

  const cleanSwapAmount = Math.max(0, Math.floor(Number(swapDiamonds || 0)));
  const previewSwappedCoins = cleanSwapAmount * coinsPerDiamond;
  const canSwap = purchasedDiamonds >= 1 && cleanSwapAmount >= 1 && cleanSwapAmount <= purchasedDiamonds;

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md max-h-[92dvh] bg-[#FAF7F9] rounded-t-[32px] sm:rounded-[32px] flex flex-col overflow-hidden shadow-2xl animate-sheet-up">
        <LuxuryModalHeader
          icon={Gem}
          iconClassName="bg-gradient-to-br from-sky-400 via-indigo-400 to-rose-400 text-white shadow-lg shadow-sky-500/20"
          eyebrow="Billetera VIP"
          title="Tienda de Diamantes y Monedas"
          subtitle={
            <span className="inline-flex items-center gap-2.5 flex-wrap">
              <span>
                Diamantes: <strong className="text-sky-300 tabular-nums">{purchasedDiamonds} 💎</strong>
              </span>
              <span className="text-white/30">·</span>
              <span>
                Monedas: <strong className="text-amber-300 tabular-nums">{currentCoins} 🪙</strong>
              </span>
            </span>
          }
          onClose={onClose}
          closeLabel="Cerrar tienda"
        />

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 sm:p-5 space-y-4 bg-[#FAF7F9]">
          {/* Switcher Superior: Comprar Diamantes vs Cambiar Diamantes a Monedas */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-zinc-200/75 border border-zinc-200">
            <button
              type="button"
              onClick={() => setStoreSection('buy')}
              className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                storeSection === 'buy'
                  ? 'bg-white text-sky-700 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Gem className="w-3.5 h-3.5 text-sky-500" />
              Comprar Diamantes 💎
            </button>
            <button
              type="button"
              onClick={() => setStoreSection('swap')}
              className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                storeSection === 'swap'
                  ? 'bg-white text-amber-700 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-amber-500" />
              Cambiar 💎 → 🪙
            </button>
          </div>

          {storeSection === 'swap' ? (
            /* ==================== CAMBIAR DIAMANTES COMPRADOS -> MONEDAS ==================== */
            <div className="space-y-4">
              <div className="p-4 rounded-3xl bg-gradient-to-br from-sky-50 via-white to-amber-50/70 border border-sky-200/80 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-700">
                    Tasa oficial de intercambio
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-200 text-amber-900 text-xs font-black">
                    1 💎 = {coinsPerDiamond} 🪙
                  </span>
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Los <strong className="text-sky-700">Diamantes (💎)</strong> comprados sirven para enviar regalos o cambiarlos aquí por{' '}
                  <strong className="text-amber-700">Monedas (🪙)</strong>. Las monedas sirven exclusivamente para desbloquear chats, enviar mensajes sin Match, ver Likes y activar Boost VIP.
                </p>
              </div>

              <form
                onSubmit={handleSwapDiamondsToCoins}
                className="p-4 rounded-3xl bg-white border border-zinc-200/85 shadow-sm space-y-3.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-zinc-600">
                    Disponibles para cambiar:{' '}
                    <strong className="text-sky-700">{purchasedDiamonds} 💎</strong>
                  </span>
                  {purchasedDiamonds > 0 && (
                    <button
                      type="button"
                      onClick={() => setSwapDiamonds(purchasedDiamonds)}
                      className="px-2.5 py-0.5 rounded-full bg-sky-50 hover:bg-sky-100 border border-sky-200 text-[10.5px] font-extrabold text-sky-700"
                    >
                      Todo ({purchasedDiamonds} 💎)
                    </button>
                  )}
                </div>

                {/* Tabla rápida de equivalencias */}
                <div className="grid grid-cols-3 gap-1.5">
                  {DIAMOND_TO_COIN_PRESETS.slice(0, 3).map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setSwapDiamonds(amt)}
                      className={`p-2 rounded-2xl border text-center transition ${
                        Number(swapDiamonds) === amt
                          ? 'bg-amber-50 border-amber-400 text-amber-900 shadow-sm'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:border-zinc-300'
                      }`}
                    >
                      <p className="text-xs font-black text-sky-700">{amt} 💎</p>
                      <p className="text-[10.5px] font-extrabold text-amber-700">
                        = {amt * coinsPerDiamond} 🪙
                      </p>
                    </button>
                  ))}
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-700 block mb-1">
                    Cantidad de Diamantes a convertir en Monedas
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={Math.max(1, purchasedDiamonds)}
                    value={swapDiamonds}
                    onChange={(e) => setSwapDiamonds(Number(e.target.value))}
                    disabled={purchasedDiamonds < 1}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-black text-zinc-900 focus:outline-none focus:bg-white focus:border-amber-500 disabled:opacity-50"
                  />
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50/85 border border-amber-200 text-xs flex items-center justify-between font-black text-amber-950">
                  <span>Recibirás al instante:</span>
                  <span className="text-base text-amber-700 tabular-nums">
                    +{previewSwappedCoins} 🪙
                  </span>
                </div>

                {purchasedDiamonds < 1 ? (
                  <button
                    type="button"
                    onClick={() => setStoreSection('buy')}
                    className="w-full py-3.5 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-black text-sm shadow-md hover:brightness-105 transition flex items-center justify-center gap-2"
                  >
                    <Gem className="w-4 h-4" />
                    Comprar Diamantes primero
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!canSwap || swappingCoins}
                    className="w-full py-3.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-sm shadow-md hover:brightness-105 disabled:opacity-40 transition flex items-center justify-center gap-2"
                  >
                    <Coins className="w-4 h-4" />
                    {swappingCoins
                      ? 'Convirtiendo...'
                      : `Cambiar ${cleanSwapAmount} 💎 por +${previewSwappedCoins} 🪙`}
                  </button>
                )}
              </form>
            </div>
          ) : (
            /* ==================== COMPRAR DIAMANTES VIA PASARELAS ==================== */
            <>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-500">
                    1. Elige tu paquete de Diamantes (💎)
                  </p>
                  <button
                    type="button"
                    onClick={() => setRulesOpen((v) => !v)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#FF2E54] hover:underline"
                  >
                    <Info className="w-3.5 h-3.5" />
                    Cómo funciona
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform ${rulesOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                </div>

                {rulesOpen && (
                  <div className="p-3.5 rounded-2xl bg-white border border-rose-200/70 shadow-sm space-y-1.5 text-[11px] text-zinc-600 leading-relaxed">
                    <p>
                      <strong className="text-sky-700">• Diamantes (💎):</strong> se compran aquí y sirven para{' '}
                      <strong>enviar regalos</strong> (el receptor acumula ganancias retirables en $ USD) o para{' '}
                      <strong>cambiarlos a Monedas (1 💎 = {coinsPerDiamond} 🪙)</strong>.
                    </p>
                    <p>
                      <strong className="text-amber-700">• Monedas (🪙):</strong> se usan exclusivamente para desbloquear chats, enviar mensajes sin Match, ver Likes y activar Boost VIP.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  {livePackages.map((pkg) => {
                    const active = selectedPkg.id === pkg.id;
                    const units = Number(pkg.diamonds ?? pkg.coins ?? 0);
                    const perDiamond = units > 0 ? (pkg.priceUSD / units).toFixed(3) : '0.000';
                    const swapEquiv = units * coinsPerDiamond;
                    return (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => setSelectedPkgId(pkg.id)}
                        className={`relative p-3.5 rounded-[22px] border text-left transition ${
                          active
                            ? 'bg-gradient-to-br from-[#F0F9FF] via-white to-[#FFF1F4] border-[#FF2E54] shadow-[0_10px_24px_-10px_rgba(255,46,84,0.3)] ring-1 ring-[#FF2E54]/30'
                            : 'bg-white border-zinc-200/85 hover:border-sky-200 shadow-sm'
                        }`}
                      >
                        {pkg.badge && (
                          <span className="absolute -top-2 right-2.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-[#FF2E54] to-amber-500 text-[9.5px] font-black text-white shadow">
                            {pkg.badge}
                          </span>
                        )}
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5">
                            <Gem className="w-4 h-4 text-sky-500" />
                            <span className="font-display text-lg font-black text-zinc-900 tabular-nums">
                              {units} 💎
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-zinc-400">${perDiamond}/💎</span>
                        </div>
                        <p className="text-[10.5px] text-zinc-500 mt-0.5 truncate">{pkg.bonusText}</p>
                        <p className="text-[10px] font-bold text-amber-700 mt-1">
                          Canjeable: {swapEquiv} 🪙
                        </p>
                        <p className="font-display text-base font-black text-emerald-600 mt-1.5 tabular-nums">
                          {formatUSD(pkg.priceUSD)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selector de Método */}
              <div className="space-y-2.5">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-500">
                  2. Método de pago
                </p>
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-zinc-200/70 border border-zinc-200">
                  <button
                    type="button"
                    onClick={() => setActiveTab('auto')}
                    className={`py-2.5 px-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                      activeTab === 'auto'
                        ? 'bg-white text-zinc-900 shadow-sm'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#FF2E54]" />
                    Pago Automático
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('direct')}
                    className={`py-2.5 px-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                      activeTab === 'direct'
                        ? 'bg-white text-zinc-900 shadow-sm'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                    Transferencia Directa
                  </button>
                </div>
              </div>

              {/* TAB 1: Pago Automático (NowPayments) */}
              {activeTab === 'auto' && (
                <div className="space-y-3">
                  <div className="p-4 rounded-3xl bg-white border border-zinc-200/85 shadow-sm space-y-3">
                    <div className="flex items-center justify-between text-xs pb-2 border-b border-zinc-100">
                      <span className="text-zinc-500 font-semibold">Resumen de orden:</span>
                      <span className="font-black text-zinc-900">
                        +{selectedPkgUnits} 💎 · {formatUSD(selectedPkg.priceUSD)}
                      </span>
                    </div>

                    {Number(selectedPkg.priceUSD) < 12 && (
                      <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200/90 text-[11px] text-amber-900 space-y-1 leading-relaxed">
                        <p className="font-extrabold flex items-center gap-1.5 text-amber-800">
                          <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          Mínimo de red en NowPayments
                        </p>
                        <p>
                          Si pagas en <strong>USDT TRC20</strong> (TRON), NowPayments exige aprox.{' '}
                          <strong>$11.50 USD</strong> mínimo por comisiones de red. Para paquetes menores a $12, usa{' '}
                          <strong>USDT BEP20 (BSC) / Polygon</strong> en NowPayments o paga sin mínimo por{' '}
                          <strong>{activeDirectNames || 'Transferencia Directa'}</strong>.
                        </p>
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={creatingInvoice}
                      onClick={handleNowPaymentsCheckout}
                      className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 border border-emerald-400/35 text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 hover:brightness-110 shadow-lg disabled:opacity-50 transition"
                    >
                      {creatingInvoice ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                          Creando factura segura...
                        </>
                      ) : (
                        <>
                          <Wallet className="w-4 h-4 text-emerald-400" />
                          Comprar +{selectedPkgUnits} 💎 con NowPayments
                          <ExternalLink className="w-3.5 h-3.5 text-emerald-300" />
                        </>
                      )}
                    </button>

                    <p className="text-[10.5px] text-center text-zinc-400 font-medium">
                      🔒 Acreditación automática al instante en tu saldo de Diamantes cuando NowPayments confirma la red.
                    </p>
                  </div>

                  {(isSuperAdmin || ENABLE_DEMO_PAYMENTS) && (
                    <div className="p-4 rounded-3xl bg-amber-50/90 border border-amber-200 space-y-2.5">
                      <div className="flex items-center gap-2 text-amber-800 text-xs font-extrabold">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                        Recarga Instantánea Admin / Prueba
                      </div>
                      <button
                        type="button"
                        disabled={simulating}
                        onClick={() => handleSimulateWebhook('nowpayments')}
                        className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-extrabold shadow-sm hover:brightness-105 disabled:opacity-50 transition"
                      >
                        {simulating ? 'Acreditando...' : `Simular Compra (+${selectedPkgUnits} 💎)`}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Transferencia Directa */}
              {activeTab === 'direct' && (
                <div className="space-y-3.5">
                  {liveDirectMethods.length === 0 || !selectedMethod ? (
                    <div className="p-6 rounded-3xl bg-white border border-zinc-200/85 text-center text-xs text-zinc-500">
                      Los métodos de transferencia directa están pausados temporalmente. Usa Pago Automático o intenta más tarde.
                    </div>
                  ) : (
                    <>
                      <div
                        className={`grid gap-2 ${
                          liveDirectMethods.length <= 2
                            ? 'grid-cols-2'
                            : 'grid-cols-1 sm:grid-cols-3'
                        }`}
                      >
                        {liveDirectMethods.map((method) => {
                          const active = selectedMethod.id === method.id;
                          return (
                            <button
                              key={method.id}
                              type="button"
                              onClick={() => {
                                setSelectedMethodId(method.id);
                                setQrOpen(Boolean(method.qrImageUrl));
                                setCopied(false);
                              }}
                              className={`p-3 rounded-2xl border text-left transition ${
                                active
                                  ? 'bg-emerald-50 border-emerald-400 text-zinc-900 shadow-sm'
                                  : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'
                              }`}
                            >
                              <p className="text-xs font-extrabold leading-tight">{method.name}</p>
                              <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-emerald-100/90 text-[9.5px] font-bold text-emerald-800">
                                {method.badge}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="p-4 rounded-3xl bg-white border border-zinc-200/85 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-zinc-500 font-semibold">Monto exacto a enviar</span>
                          <span className="font-display text-base font-black text-emerald-600">
                            {formatUSD(selectedPkg.priceUSD)} ({selectedMethod.currency})
                          </span>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-zinc-600">
                              {selectedMethod.accountLabel}
                            </span>
                            <button
                              type="button"
                              onClick={() => setQrOpen((v) => !v)}
                              className="inline-flex items-center gap-1 text-[11px] font-extrabold text-zinc-700 hover:text-zinc-900"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              {qrOpen ? 'Ocultar QR' : 'Ver código QR'}
                            </button>
                          </div>
                          <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-zinc-50 border border-zinc-200">
                            <span className="text-xs font-mono font-bold text-zinc-800 flex-1 break-all">
                              {selectedMethod.accountValue}
                            </span>
                            <button
                              type="button"
                              onClick={handleCopyAccount}
                              className="px-3 py-1.5 rounded-xl bg-white border border-zinc-200 text-zinc-800 hover:bg-zinc-100 text-xs font-extrabold flex items-center gap-1 shrink-0 shadow-sm transition"
                            >
                              {copied ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                              {copied ? 'Copiado' : 'Copiar'}
                            </button>
                          </div>
                        </div>

                        {qrOpen && (
                          <div className="flex flex-col items-center py-2.5 border-t border-zinc-100">
                            {selectedMethod.qrImageUrl ? (
                              <>
                                <div className="p-2.5 bg-white rounded-2xl border border-zinc-200 shadow-sm">
                                  <img
                                    src={selectedMethod.qrImageUrl}
                                    alt={`QR oficial de ${selectedMethod.name}`}
                                    className="w-52 max-h-80 object-contain rounded-xl"
                                  />
                                </div>
                                <a
                                  href={selectedMethod.qrImageUrl}
                                  download={`${selectedMethod.id}-qr.png`}
                                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[11px] font-bold transition"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  Guardar imagen QR
                                </a>
                              </>
                            ) : (
                              <DynamicQrCode
                                payload={`${selectedMethod.qrPrefix}${selectedMethod.accountValue}&amount=${selectedPkg.priceUSD}`}
                              />
                            )}
                            <span className="text-[10px] font-semibold text-zinc-400 mt-1.5">
                              {selectedMethod.qrImageUrl
                                ? `QR oficial de ${selectedMethod.name}`
                                : `QR de cobro para ${selectedMethod.name}`}
                            </span>
                          </div>
                        )}

                        <p className="text-[11px] text-zinc-500 leading-relaxed">
                          {selectedMethod.extraInstructions}
                        </p>
                      </div>

                      <form
                        onSubmit={handleSubmitDirect}
                        className="space-y-3 bg-white p-4 rounded-3xl border border-zinc-200/85 shadow-sm"
                      >
                        <div>
                          <label className="text-xs font-bold text-zinc-700 block mb-1">
                            Número de referencia / Hash
                          </label>
                          <input
                            type="text"
                            value={referenceNumber}
                            onChange={(e) => setReferenceNumber(e.target.value)}
                            placeholder="Ej. 849201 o TxID"
                            required
                            className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm text-zinc-900 focus:outline-none focus:bg-white focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-zinc-700 block mb-1">
                            Captura del comprobante
                          </label>
                          {proofUrl ? (
                            <div className="relative rounded-2xl overflow-hidden border border-emerald-300 bg-zinc-50">
                              <img src={proofUrl} alt="Comprobante" className="w-full max-h-40 object-contain" />
                              <button
                                type="button"
                                onClick={() => setProofUrl('')}
                                className="absolute top-2 right-2 px-2.5 py-1 rounded-full bg-white/95 border border-rose-200 text-xs font-bold text-rose-600 shadow"
                              >
                                Cambiar
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={uploadingProof}
                              onClick={() => fileInputRef.current?.click()}
                              className="w-full py-4 rounded-2xl border-2 border-dashed border-zinc-300 hover:border-emerald-500 bg-zinc-50 text-zinc-600 text-xs font-bold flex items-center justify-center gap-2 transition"
                            >
                              {uploadingProof ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                                  Subiendo captura...
                                </>
                              ) : (
                                <>
                                  <ImagePlus className="w-4 h-4 text-emerald-600" />
                                  Adjuntar captura de pantalla
                                </>
                              )}
                            </button>
                          )}
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleUploadProof}
                            className="hidden"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={submittingDirect || uploadingProof}
                          className="w-full py-3.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black text-sm shadow-md hover:brightness-105 disabled:opacity-50 transition"
                        >
                          {submittingDirect
                            ? 'Enviando solicitud...'
                            : `Enviar Comprobante (+${selectedPkgUnits} 💎)`}
                        </button>
                      </form>
                    </>
                  )}

                  {myRequests.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <p className="text-[11px] font-extrabold text-zinc-500 uppercase tracking-wider">
                        Mis solicitudes recientes
                      </p>
                      {myRequests.slice(0, 4).map((req) => {
                        const units = req.diamondsToCredit || req.coinsToCredit || 0;
                        const icon = req.creditTarget === 'coins' ? '🪙' : '💎';
                        return (
                          <div
                            key={req.id}
                            className="p-3 rounded-2xl bg-white border border-zinc-200/80 flex items-center justify-between gap-2 text-xs shadow-sm"
                          >
                            <div>
                              <p className="font-extrabold text-zinc-900">
                                +{units} {icon} · {formatUSD(req.amountUSD)}
                              </p>
                              <p className="text-[11px] text-zinc-500">
                                {req.methodName} · Ref: {req.referenceNumber}
                              </p>
                            </div>
                            {req.status === 'pending' && (
                              <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-bold flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Pendiente
                              </span>
                            )}
                            {req.status === 'approved' && (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Aprobado
                              </span>
                            )}
                            {req.status === 'rejected' && (
                              <span className="px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-bold flex items-center gap-1">
                                <XCircle className="w-3 h-3" /> Rechazado
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
