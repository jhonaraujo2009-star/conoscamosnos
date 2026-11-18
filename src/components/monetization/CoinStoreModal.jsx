import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  CreditCard,
  ExternalLink,
  ImagePlus,
  Info,
  Loader2,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import {
  COIN_PACKAGES,
  DIRECT_PAYMENT_METHODS,
  ECONOMY_CONFIG,
  ENABLE_DEMO_PAYMENTS,
} from '../../config/constants';
import { isSuperAdminRole, useAuth } from '../../contexts/AuthContext';
import { getUserCloudinaryFolder, uploadImageToCloudinary } from '../../services/cloudinaryService';
import {
  buildCheckoutUrl,
  simulateAutoPaymentConfirmation,
  submitManualPaymentRequest,
  subscribeMyPaymentRequests,
} from '../../services/monetizationService';
import { buildQrMatrix } from '../../utils/qrGenerator';
import { calculateGiftEconomics, formatUSD } from '../../utils/formatters';

function DynamicQrCode({ payload }) {
  const matrix = useMemo(() => buildQrMatrix(payload, 21), [payload]);
  return (
    <div className="p-3 bg-white rounded-2xl inline-block border border-slate-200 shadow-sm">
      <svg width="112" height="112" viewBox="0 0 21 21" shapeRendering="crispEdges">
        <rect width="21" height="21" fill="#ffffff" />
        {matrix.map((row, rIdx) =>
          row.map((cell, cIdx) =>
            cell ? (
              <rect key={`${rIdx}-${cIdx}`} x={cIdx} y={rIdx} width="1" height="1" fill="#0f172a" />
            ) : null
          )
        )}
      </svg>
    </div>
  );
}

export default function CoinStoreModal({ isOpen, onClose, userProfile, onSuccess, onError }) {
  const { economyConfig } = useAuth();
  const livePackages =
    Array.isArray(economyConfig?.coinPackages) && economyConfig.coinPackages.length > 0
      ? economyConfig.coinPackages
      : COIN_PACKAGES;
  const liveEconomy = economyConfig || ECONOMY_CONFIG;

  const [selectedPkgId, setSelectedPkgId] = useState(livePackages[1]?.id || livePackages[0].id);
  const selectedPkg = livePackages.find((p) => p.id === selectedPkgId) || livePackages[0];
  const [activeTab, setActiveTab] = useState('direct'); // 'direct' | 'auto'
  const [simulating, setSimulating] = useState(false);

  // Direct wallets state
  const [selectedMethod, setSelectedMethod] = useState(DIRECT_PAYMENT_METHODS[0]);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);
  const [submittingDirect, setSubmittingDirect] = useState(false);
  const [copied, setCopied] = useState(false);
  const [myRequests, setMyRequests] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !userProfile?.uid) return;
    const unsub = subscribeMyPaymentRequests(userProfile.uid, setMyRequests);
    return () => unsub();
  }, [isOpen, userProfile?.uid]);

  if (!isOpen) return null;

  const lemonCheckout = buildCheckoutUrl('lemonsqueezy', userProfile.uid, selectedPkg);
  const paypalCheckout = buildCheckoutUrl('paypal', userProfile.uid, selectedPkg);

  const handleSimulateWebhook = async (provider) => {
    setSimulating(true);
    try {
      const res = await simulateAutoPaymentConfirmation({
        userId: userProfile.uid,
        userName: userProfile.name,
        pkg: selectedPkg,
        provider,
      });
      onSuccess?.(`✅ ¡Recarga acreditada! Se sumaron +${res.coinsAdded} monedas a tu saldo.`);
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
      });
      setReferenceNumber('');
      setProofUrl('');
      onSuccess?.('Solicitud enviada al equipo de auditoría. Recibirás tus monedas al aprobarse.');
    } catch (err) {
      onError?.(err.message || 'Error al registrar la solicitud.');
    } finally {
      setSubmittingDirect(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md max-h-[92dvh] bg-white rounded-t-[32px] sm:rounded-[32px] flex flex-col overflow-hidden shadow-2xl animate-sheet-up">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-200/80 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-[#FF2E54] flex items-center justify-center text-white shadow-md">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-extrabold text-zinc-900">Tienda de Monedas</h3>
              <p className="text-xs text-zinc-500">
                Saldo actual: <span className="text-amber-600 font-extrabold">{userProfile?.coins || 0}</span> monedas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-zinc-100 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-5 bg-[#F4F4F6]">
          {/* Package Selection */}
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2.5">
              1. Elige tu paquete de monedas
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {livePackages.map((pkg) => {
                const active = selectedPkg.id === pkg.id;
                const perCoin = (pkg.priceUSD / pkg.coins).toFixed(3);
                const giftReturn = calculateGiftEconomics(pkg.coins, liveEconomy);
                return (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => setSelectedPkgId(pkg.id)}
                    className={`relative p-3.5 rounded-2xl border text-left transition ${
                      active
                        ? 'bg-gradient-to-br from-amber-50 to-rose-50 border-amber-400 shadow-md ring-1 ring-amber-300'
                        : 'bg-white border-slate-200/90 hover:border-amber-300 shadow-sm'
                    }`}
                  >
                    {pkg.badge && (
                      <span className="absolute -top-2 right-2 px-2 py-0.5 rounded-full bg-gradient-to-r from-brand-500 to-amber-500 text-[10px] font-extrabold text-white shadow">
                        {pkg.badge}
                      </span>
                    )}
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        <Coins className="w-4 h-4 text-amber-500" />
                        <span className="font-display text-base font-extrabold text-slate-900">{pkg.coins}</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">${perCoin}/🪙</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{pkg.bonusText}</p>
                    <p className="text-[10px] font-bold text-sky-700 mt-0.5">
                      Al regalar: {giftReturn.diamonds} 💎 ({formatUSD(giftReturn.netPayoutUSD)})
                    </p>
                    <p className="text-sm font-extrabold text-emerald-600 mt-1.5">{formatUSD(pkg.priceUSD)}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reglas claras de Monedas, Regalos y Diamantes */}
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-card space-y-2 text-[11px] text-slate-600">
            <div className="flex items-center gap-1.5 font-extrabold text-slate-900 text-xs">
              <Info className="w-4 h-4 text-[#FF2E54] shrink-0" />
              Reglas claras: Monedas, Regalos y Diamantes ($ USD)
            </div>
            <ul className="space-y-1 leading-relaxed list-disc pl-4">
              <li>
                <strong>Monedas (🪙):</strong> Se compran en USD/USDT para enviar regalos y Boost VIP (saldo interno no retirable por el comprador).
              </li>
              <li>
                <strong>Regalos → Diamantes (💎):</strong> Cada <strong>1 🪙 regalada</strong> entrega{' '}
                <strong>{ECONOMY_CONFIG.diamondsPerCoin} 💎</strong> a la persona que lo recibe (ej. Rosa 10 🪙 = 10 💎 · Diamante Real 500 🪙 = 500 💎).
              </li>
              <li>
                <strong>Retiro en $ USD (Binance USDT):</strong> Quien recibe regalos puede retirar sus diamantes a{' '}
                <strong>${ECONOMY_CONFIG.diamondToNetUSDRate.toFixed(3)} USD/💎</strong> (60% creador · 40% plataforma), desde{' '}
                <strong>{ECONOMY_CONFIG.minWithdrawalDiamonds} 💎 = {formatUSD(ECONOMY_CONFIG.minWithdrawalDiamonds * ECONOMY_CONFIG.diamondToNetUSDRate)}</strong>.
              </li>
            </ul>
          </div>

          {/* Payment Tabs */}
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2.5">
              2. Método de pago internacional o local
            </p>
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-slate-200/70 border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab('direct')}
                className={`py-2 px-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                  activeTab === 'direct'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                Binance / Billeteras
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('auto')}
                className={`py-2 px-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                  activeTab === 'auto'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5 text-brand-500" />
                Tarjeta / Demo
              </button>
            </div>
          </div>

          {/* TAB 1: Automatic Checkout + Simulator */}
          {activeTab === 'auto' && (
            <div className="space-y-3.5">
              <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-card space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Paquete seleccionado:</span>
                  <span className="font-extrabold text-slate-900">
                    {selectedPkg.coins} Monedas ({formatUSD(selectedPkg.priceUSD)})
                  </span>
                </div>

                <a
                  href={lemonCheckout.url}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-extrabold flex items-center justify-center gap-2 hover:brightness-105 shadow-sm transition"
                >
                  <CreditCard className="w-4 h-4" />
                  Pagar con Tarjeta Visa / Mastercard
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <a
                  href={paypalCheckout.url}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 rounded-2xl bg-[#0070ba] text-white text-xs font-extrabold flex items-center justify-center gap-2 hover:brightness-105 shadow-sm transition"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Pagar con PayPal Checkout
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Webhook Simulator: restringido a Super Admin o entorno explícito de pruebas */}
              {(isSuperAdminRole(userProfile?.role) || ENABLE_DEMO_PAYMENTS) && (
                <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 space-y-2.5">
                  <div className="flex items-center gap-2 text-amber-800 text-xs font-extrabold">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    Recarga Instantánea de Prueba (Solo Admin / Demo)
                  </div>
                  <p className="text-[11px] text-amber-900/80 leading-relaxed font-medium">
                    Acredita <strong>+{selectedPkg.coins} monedas</strong> al instante a tu cuenta para auditar regalos, Boost VIP y funciones premium.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={simulating}
                      onClick={() => handleSimulateWebhook('lemonsqueezy')}
                      className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-extrabold shadow-sm hover:brightness-105 disabled:opacity-50 transition"
                    >
                      {simulating ? 'Acreditando...' : 'Simular Tarjeta'}
                    </button>
                    <button
                      type="button"
                      disabled={simulating}
                      onClick={() => handleSimulateWebhook('paypal')}
                      className="py-2.5 px-3 rounded-xl bg-white text-amber-800 border border-amber-300 text-xs font-extrabold hover:bg-amber-100/60 disabled:opacity-50 transition"
                    >
                      {simulating ? 'Acreditando...' : 'Simular PayPal'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Direct Global & Local Wallets */}
          {activeTab === 'direct' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {DIRECT_PAYMENT_METHODS.map((method) => {
                  const active = selectedMethod.id === method.id;
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setSelectedMethod(method)}
                      className={`p-3 rounded-2xl border text-left transition ${
                        active
                          ? 'bg-emerald-50 border-emerald-400 text-slate-900 shadow-sm'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <p className="text-xs font-extrabold leading-tight">{method.name}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-800">
                        {method.badge}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Payment Instructions & QR */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-semibold">Monto a transferir</span>
                  <span className="text-sm font-extrabold text-emerald-600">
                    {formatUSD(selectedPkg.priceUSD)} ({selectedMethod.currency})
                  </span>
                </div>

                <div className="flex flex-col items-center py-2">
                  <DynamicQrCode
                    payload={`${selectedMethod.qrPrefix}${selectedMethod.accountValue}&amount=${selectedPkg.priceUSD}`}
                  />
                  <span className="text-[10px] font-semibold text-slate-400 mt-1.5">
                    QR de cobro para {selectedMethod.name}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] font-bold text-slate-600">
                    {selectedMethod.accountLabel}
                  </span>
                  <div className="mt-1 flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-xs font-mono font-semibold text-slate-800 flex-1 break-all">
                      {selectedMethod.accountValue}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyAccount}
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold flex items-center gap-1 shrink-0 shadow-sm"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {selectedMethod.extraInstructions}
                </p>
              </div>

              {/* Proof Submission Form */}
              <form onSubmit={handleSubmitDirect} className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-card">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Número de referencia / Hash
                  </label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="Ej. 849201 o TxID"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Captura del comprobante
                  </label>
                  {proofUrl ? (
                    <div className="relative rounded-2xl overflow-hidden border border-emerald-300 bg-slate-50">
                      <img src={proofUrl} alt="Comprobante" className="w-full max-h-44 object-contain" />
                      <button
                        type="button"
                        onClick={() => setProofUrl('')}
                        className="absolute top-2 right-2 px-2.5 py-1 rounded-full bg-white/90 border border-rose-200 text-xs font-bold text-rose-600 shadow"
                      >
                        Cambiar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={uploadingProof}
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-4 rounded-2xl border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 text-slate-600 text-xs font-bold flex items-center justify-center gap-2 transition"
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
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-extrabold text-sm shadow-md hover:brightness-105 disabled:opacity-50 transition"
                >
                  {submittingDirect
                    ? 'Enviando solicitud...'
                    : `Enviar Comprobante (${selectedPkg.coins} monedas)`}
                </button>
              </form>

              {/* My recent manual requests */}
              {myRequests.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                    Mis solicitudes recientes
                  </p>
                  {myRequests.slice(0, 4).map((req) => (
                    <div
                      key={req.id}
                      className="p-3 rounded-2xl bg-white border border-slate-200 flex items-center justify-between gap-2 text-xs shadow-sm"
                    >
                      <div>
                        <p className="font-extrabold text-slate-900">
                          +{req.coinsToCredit} monedas • {formatUSD(req.amountUSD)}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {req.methodName} • Ref: {req.referenceNumber}
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
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
