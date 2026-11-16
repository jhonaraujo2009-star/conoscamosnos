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
  Loader2,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import { COIN_PACKAGES, DIRECT_PAYMENT_METHODS } from '../../config/constants';
import { getUserCloudinaryFolder, uploadImageToCloudinary } from '../../services/cloudinaryService';
import {
  buildCheckoutUrl,
  simulateAutoPaymentConfirmation,
  submitManualPaymentRequest,
  subscribeMyPaymentRequests,
} from '../../services/monetizationService';
import { buildQrMatrix } from '../../utils/qrGenerator';
import { formatUSD } from '../../utils/formatters';

function DynamicQrCode({ payload }) {
  const matrix = useMemo(() => buildQrMatrix(payload, 21), [payload]);
  return (
    <div className="p-2.5 bg-white rounded-2xl inline-block shadow-md">
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
  const [selectedPkg, setSelectedPkg] = useState(COIN_PACKAGES[1]);
  const [activeTab, setActiveTab] = useState('auto'); // 'auto' | 'direct'
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
      onSuccess?.(`✅ ¡Webhook simulado! Se acreditaron +${res.coinsAdded} monedas a tu saldo.`);
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md max-h-[92vh] bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-brand-500 flex items-center justify-center text-white shadow">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Tienda de Monedas</h3>
              <p className="text-xs text-slate-400">
                Saldo actual: <span className="text-amber-300 font-bold">{userProfile?.coins || 0}</span> monedas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Package Selection */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
              1. Elige tu paquete de monedas
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {COIN_PACKAGES.map((pkg) => {
                const active = selectedPkg.id === pkg.id;
                return (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => setSelectedPkg(pkg)}
                    className={`relative p-3.5 rounded-2xl border text-left transition ${
                      active
                        ? 'bg-gradient-to-br from-amber-500/20 to-brand-500/20 border-amber-400 shadow-lg shadow-amber-500/10'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {pkg.badge && (
                      <span className="absolute -top-2 right-2 px-2 py-0.5 rounded-full bg-gradient-to-r from-brand-500 to-amber-500 text-[10px] font-extrabold text-white shadow">
                        {pkg.badge}
                      </span>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-amber-400" />
                      <span className="text-base font-extrabold text-white">{pkg.coins}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{pkg.bonusText}</p>
                    <p className="text-sm font-bold text-emerald-400 mt-2">{formatUSD(pkg.priceUSD)}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment Tabs */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
              2. Método de pago internacional o local
            </p>
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-slate-950 border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('auto')}
                className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  activeTab === 'auto'
                    ? 'bg-brand-500 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                Pago Automático
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('direct')}
                className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  activeTab === 'direct'
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Wallet className="w-3.5 h-3.5" />
                Billeteras Directas
              </button>
            </div>
          </div>

          {/* TAB 1: Automatic Checkout + Simulator */}
          {activeTab === 'auto' && (
            <div className="space-y-3.5">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Paquete seleccionado:</span>
                  <span className="font-bold text-white">
                    {selectedPkg.coins} Monedas ({formatUSD(selectedPkg.priceUSD)})
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900 text-[11px] text-slate-400 font-mono break-all">
                  custom_data: {JSON.stringify({ userId: userProfile.uid, packageId: selectedPkg.id })}
                </div>

                <a
                  href={lemonCheckout.url}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-bold flex items-center justify-center gap-2 hover:brightness-110 transition"
                >
                  <CreditCard className="w-4 h-4" />
                  Pagar con Tarjeta Visa / Mastercard (LemonSqueezy)
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <a
                  href={paypalCheckout.url}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 rounded-2xl bg-[#0070ba] text-white text-xs font-bold flex items-center justify-center gap-2 hover:brightness-110 transition"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Pagar con PayPal Checkout
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Webhook Simulator for immediate testing */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/35 space-y-2.5">
                <div className="flex items-center gap-2 text-amber-300 text-xs font-extrabold">
                  <Sparkles className="w-4 h-4" />
                  Simulador de Webhook / Confirmación Inmediata (Pruebas)
                </div>
                <p className="text-[11px] text-amber-100/80 leading-relaxed">
                  Simula la respuesta del webhook de LemonSqueezy / PayPal para acreditar{' '}
                  <strong>+{selectedPkg.coins} monedas</strong> al instante y probar regalos, Boost y DM VIP.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={simulating}
                    onClick={() => handleSimulateWebhook('lemonsqueezy')}
                    className="py-2.5 px-3 rounded-xl bg-amber-400 text-slate-950 text-xs font-extrabold hover:bg-amber-300 disabled:opacity-50 transition"
                  >
                    {simulating ? 'Acreditando...' : 'Simular Tarjeta'}
                  </button>
                  <button
                    type="button"
                    disabled={simulating}
                    onClick={() => handleSimulateWebhook('paypal')}
                    className="py-2.5 px-3 rounded-xl bg-slate-800 text-amber-300 border border-amber-400/40 text-xs font-extrabold hover:bg-slate-700 disabled:opacity-50 transition"
                  >
                    {simulating ? 'Acreditando...' : 'Simular PayPal'}
                  </button>
                </div>
              </div>
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
                      className={`p-2.5 rounded-2xl border text-left transition ${
                        active
                          ? 'bg-emerald-500/15 border-emerald-400 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <p className="text-xs font-bold leading-tight">{method.name}</p>
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-slate-900 text-[10px] text-emerald-300">
                        {method.badge}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Payment Instructions & QR */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Monto a transferir</span>
                  <span className="text-sm font-extrabold text-emerald-400">
                    {formatUSD(selectedPkg.priceUSD)} ({selectedMethod.currency})
                  </span>
                </div>

                <div className="flex flex-col items-center py-2">
                  <DynamicQrCode
                    payload={`${selectedMethod.qrPrefix}${selectedMethod.accountValue}&amount=${selectedPkg.priceUSD}`}
                  />
                  <span className="text-[10px] text-slate-500 mt-1.5">
                    QR de cobro para {selectedMethod.name}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {selectedMethod.accountLabel}
                  </span>
                  <div className="mt-1 flex items-center gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-xs font-mono text-white flex-1 break-all">
                      {selectedMethod.accountValue}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyAccount}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-semibold flex items-center gap-1 shrink-0"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {selectedMethod.extraInstructions}
                </p>
              </div>

              {/* Proof Submission Form */}
              <form onSubmit={handleSubmitDirect} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">
                    Número de referencia / Hash
                  </label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="Ej. 849201 o TxID"
                    required
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-sm focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">
                    Captura del comprobante (Cloudinary)
                  </label>
                  {proofUrl ? (
                    <div className="relative rounded-2xl overflow-hidden border border-emerald-500/40 bg-slate-950">
                      <img src={proofUrl} alt="Comprobante" className="w-full max-h-44 object-contain" />
                      <button
                        type="button"
                        onClick={() => setProofUrl('')}
                        className="absolute top-2 right-2 px-2.5 py-1 rounded-full bg-slate-950/90 text-xs text-rose-300"
                      >
                        Cambiar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={uploadingProof}
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-4 rounded-2xl border-2 border-dashed border-slate-700 hover:border-emerald-400 bg-slate-950/60 text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 transition"
                    >
                      {uploadingProof ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                          Subiendo captura...
                        </>
                      ) : (
                        <>
                          <ImagePlus className="w-4 h-4 text-emerald-400" />
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
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-extrabold text-sm hover:brightness-110 disabled:opacity-50 transition"
                >
                  {submittingDirect
                    ? 'Enviando solicitud...'
                    : `Enviar Comprobante (${selectedPkg.coins} monedas)`}
                </button>
              </form>

              {/* My recent manual requests */}
              {myRequests.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <p className="text-xs font-bold text-slate-400">Mis solicitudes recientes</p>
                  {myRequests.slice(0, 4).map((req) => (
                    <div
                      key={req.id}
                      className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <p className="font-bold text-white">
                          +{req.coinsToCredit} monedas • {formatUSD(req.amountUSD)}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {req.methodName} • Ref: {req.referenceNumber}
                        </p>
                      </div>
                      {req.status === 'pending' && (
                        <span className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-300 font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Pendiente
                        </span>
                      )}
                      {req.status === 'approved' && (
                        <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Aprobado
                        </span>
                      )}
                      {req.status === 'rejected' && (
                        <span className="px-2 py-1 rounded-full bg-rose-500/20 text-rose-300 font-bold flex items-center gap-1">
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
