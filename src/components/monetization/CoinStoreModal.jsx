import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coins,
  Copy,
  CreditCard,
  ExternalLink,
  ImagePlus,
  Info,
  Loader2,
  QrCode,
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
  createNowPaymentsCheckout,
  simulateAutoPaymentConfirmation,
  submitManualPaymentRequest,
  subscribeMyPaymentRequests,
} from '../../services/monetizationService';
import { buildQrMatrix } from '../../utils/qrGenerator';
import { calculateGiftEconomics, formatUSD } from '../../utils/formatters';

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
  const { economyConfig } = useAuth();
  const livePackages =
    Array.isArray(economyConfig?.coinPackages) && economyConfig.coinPackages.length > 0
      ? economyConfig.coinPackages
      : COIN_PACKAGES;
  const liveEconomy = economyConfig || ECONOMY_CONFIG;

  const [selectedPkgId, setSelectedPkgId] = useState(livePackages[1]?.id || livePackages[0].id);
  const selectedPkg = livePackages.find((p) => p.id === selectedPkgId) || livePackages[0];
  const [activeTab, setActiveTab] = useState('auto'); // 'auto' | 'direct'
  const [rulesOpen, setRulesOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);

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

  const handleNowPaymentsCheckout = async () => {
    if (creatingInvoice) return;
    setCreatingInvoice(true);
    try {
      const res = await createNowPaymentsCheckout({ pkg: selectedPkg });
      window.open(res.invoiceUrl, '_blank', 'noopener,noreferrer');
      onSuccess?.(
        `⚡ Factura NowPayments abierta por ${formatUSD(selectedPkg.priceUSD)}. Tus +${selectedPkg.coins} monedas se acreditarán automáticamente al confirmarse.`
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
    <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md max-h-[92dvh] bg-white rounded-t-[32px] sm:rounded-[32px] flex flex-col overflow-hidden shadow-2xl animate-sheet-up">
        {/* Header Premium */}
        <div className="px-5 py-4 border-b border-zinc-200/80 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-300 via-amber-400 to-[#FF2E54] flex items-center justify-center text-white shadow-md shadow-amber-500/20">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-black text-zinc-900">Billetera de Monedas</h3>
              <p className="text-xs text-zinc-500">
                Saldo disponible:{' '}
                <span className="text-amber-600 font-black tabular-nums">
                  {userProfile?.coins || 0} 🪙
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-zinc-100 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 transition"
            aria-label="Cerrar tienda"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 sm:p-5 space-y-4 bg-[#FAF8FA]">
          {/* Selector de Paquete */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-500">
                1. Elige tu recarga
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
                  <strong className="text-zinc-900">• Monedas (🪙):</strong> sirven para revelar Likes al instante, activar Boost VIP o enviar regalos.
                </p>
                <p>
                  <strong className="text-zinc-900">• Regalos → Diamantes (💎):</strong> cada 1 🪙 regalada entrega{' '}
                  <strong>{liveEconomy.diamondsPerCoin} 💎</strong> retirables en USD (
                  <strong>${liveEconomy.diamondToNetUSDRate.toFixed(3)} USD/💎</strong>, mínimo{' '}
                  {liveEconomy.minWithdrawalDiamonds} 💎).
                </p>
              </div>
            )}

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
                    className={`relative p-3.5 rounded-[22px] border text-left transition ${
                      active
                        ? 'bg-gradient-to-br from-[#FFF9F2] via-white to-[#FFF1F4] border-[#FF2E54] shadow-[0_10px_24px_-10px_rgba(255,46,84,0.3)] ring-1 ring-[#FF2E54]/30'
                        : 'bg-white border-zinc-200/85 hover:border-rose-200 shadow-sm'
                    }`}
                  >
                    {pkg.badge && (
                      <span className="absolute -top-2 right-2.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-[#FF2E54] to-amber-500 text-[9.5px] font-black text-white shadow">
                        {pkg.badge}
                      </span>
                    )}
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        <Coins className="w-4 h-4 text-amber-500" />
                        <span className="font-display text-lg font-black text-zinc-900 tabular-nums">
                          {pkg.coins}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-zinc-400">${perCoin}/u</span>
                    </div>
                    <p className="text-[10.5px] text-zinc-500 mt-0.5 truncate">{pkg.bonusText}</p>
                    <p className="text-[10px] font-bold text-sky-700 mt-1">
                      Vale {giftReturn.diamonds} 💎 al regalar
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

          {/* TAB 1: Pago Automático (NowPayments / Tarjeta / PayPal) */}
          {activeTab === 'auto' && (
            <div className="space-y-3">
              <div className="p-4 rounded-3xl bg-white border border-zinc-200/85 shadow-sm space-y-3">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-zinc-100">
                  <span className="text-zinc-500 font-semibold">Resumen de orden:</span>
                  <span className="font-black text-zinc-900">
                    +{selectedPkg.coins} 🪙 · {formatUSD(selectedPkg.priceUSD)}
                  </span>
                </div>

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
                      Pagar con Cripto / USDT (NowPayments)
                      <ExternalLink className="w-3.5 h-3.5 text-emerald-300" />
                    </>
                  )}
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={lemonCheckout.url}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2.5 px-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 text-indigo-800 text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Tarjeta Visa/MC
                  </a>

                  <a
                    href={paypalCheckout.url}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2.5 px-3 rounded-2xl bg-sky-50 hover:bg-sky-100 border border-sky-200/80 text-sky-800 text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    PayPal
                  </a>
                </div>

                <p className="text-[10.5px] text-center text-zinc-400 font-medium">
                  🔒 Acreditación automática al instante cuando NowPayments confirma la red.
                </p>
              </div>

              {(isSuperAdminRole(userProfile?.role) || ENABLE_DEMO_PAYMENTS) && (
                <div className="p-4 rounded-3xl bg-amber-50/90 border border-amber-200 space-y-2.5">
                  <div className="flex items-center gap-2 text-amber-800 text-xs font-extrabold">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    Recarga Instantánea Admin / Prueba
                  </div>
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

          {/* TAB 2: Transferencia Directa */}
          {activeTab === 'direct' && (
            <div className="space-y-3.5">
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
                  <div className="flex flex-col items-center py-2 border-t border-zinc-100">
                    <DynamicQrCode
                      payload={`${selectedMethod.qrPrefix}${selectedMethod.accountValue}&amount=${selectedPkg.priceUSD}`}
                    />
                    <span className="text-[10px] font-semibold text-zinc-400 mt-1.5">
                      QR de cobro para {selectedMethod.name}
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
                    : `Enviar Comprobante (+${selectedPkg.coins} 🪙)`}
                </button>
              </form>

              {myRequests.length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className="text-[11px] font-extrabold text-zinc-500 uppercase tracking-wider">
                    Mis solicitudes recientes
                  </p>
                  {myRequests.slice(0, 4).map((req) => (
                    <div
                      key={req.id}
                      className="p-3 rounded-2xl bg-white border border-zinc-200/80 flex items-center justify-between gap-2 text-xs shadow-sm"
                    >
                      <div>
                        <p className="font-extrabold text-zinc-900">
                          +{req.coinsToCredit} 🪙 · {formatUSD(req.amountUSD)}
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
