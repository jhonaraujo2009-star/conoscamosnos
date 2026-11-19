import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Crown,
  ExternalLink,
  Gem,
  Gift,
  Globe,
  Heart,
  History,
  ImagePlus,
  Info,
  Loader2,
  MessageCircle,
  QrCode,
  Sparkles,
  Star,
  Tv,
  Wallet,
  Zap,
} from 'lucide-react';
import {
  DIAMOND_PACKAGES,
  ECONOMY_CONFIG,
  ENABLE_DEMO_PAYMENTS,
  PRO_PLANS,
  resolveAccessPolicy,
  resolveDirectPaymentMethods,
} from '../../config/constants';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeSentGiftTransactions } from '../../services/chatService';
import { getUserCloudinaryFolder, uploadImageToCloudinary } from '../../services/cloudinaryService';
import {
  createNowPaymentsCheckout,
  simulateAutoPaymentConfirmation,
  submitManualPaymentRequest,
  subscribeMyPaymentRequests,
  subscribeMyPaymentTransactions,
  subscribeMyStoreActivations,
} from '../../services/monetizationService';
import { buildQrMatrix } from '../../utils/qrGenerator';
import {
  formatGiftDate,
  formatTimeRemaining,
  formatUSD,
  getSpendableDiamonds,
  isProActive,
  toMillis,
} from '../../utils/formatters';
import LuxuryModalHeader from '../layout/LuxuryModalHeader';

const PRO_BENEFITS = [
  {
    icon: MessageCircle,
    title: 'Mensajes directos ilimitados sin Match',
    desc: 'Escríbele en privado a cualquier persona sin pagar diamantes por cada chat.',
  },
  {
    icon: Heart,
    title: 'Mira quién dio Like a tu foto y Álbumes VIP gratis',
    desc: 'Toda tu pestaña Likes y Fotos Exclusivas VIP desbloqueadas al instante.',
  },
  {
    icon: Star,
    title: '20 Super Likes semanales (vs 2 gratis)',
    desc: 'Destácate primero en la pestaña Likes de quienes te encantan (visibles gratis para ellos).',
  },
  {
    icon: Globe,
    title: 'Modo Pasaporte Global + Filtros VIP',
    desc: 'Viaja a cualquier país específico y filtra por perfiles con Check Azul u Online.',
  },
  {
    icon: Tv,
    title: 'Cero Anuncios + Rewind Ilimitado + Insignia PRO',
    desc: 'Navegación limpia sin esperas publicitarias, retrocede swipes y destaca con corona PRO.',
  },
];

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

export default function DiamondStoreModal({
  isOpen,
  initialSection = 'buy',
  onClose,
  userProfile,
  onSuccess,
  onError,
}) {
  const { economyConfig, isSuperAdmin } = useAuth();
  const livePackages =
    Array.isArray(economyConfig?.diamondPackages) && economyConfig.diamondPackages.length > 0
      ? economyConfig.diamondPackages
      : Array.isArray(economyConfig?.coinPackages) && economyConfig.coinPackages.length > 0
      ? economyConfig.coinPackages
      : DIAMOND_PACKAGES;
  const liveEconomy = economyConfig || ECONOMY_CONFIG;
  const policy = resolveAccessPolicy(liveEconomy);
  const liveProPlans =
    Array.isArray(policy.proPlans) && policy.proPlans.length > 0 ? policy.proPlans : PRO_PLANS;

  const liveDirectMethods = useMemo(
    () => resolveDirectPaymentMethods(economyConfig),
    [economyConfig]
  );
  const activeDirectNames = liveDirectMethods
    .map((m) => m.name.replace(/\s*\(.*\)$/, ''))
    .join(' / ');

  const spendableDiamonds = getSpendableDiamonds(userProfile);
  const proActive = isProActive(userProfile);

  const [storeSection, setStoreSection] = useState(
    initialSection === 'pro' ? 'pro' : initialSection === 'history' ? 'history' : 'buy'
  ); // 'buy' | 'pro' | 'history'
  const [selectedPkgId, setSelectedPkgId] = useState(livePackages[1]?.id || livePackages[0].id);
  const selectedPkg = livePackages.find((p) => p.id === selectedPkgId) || livePackages[0];
  const selectedPkgUnits = Number(selectedPkg.diamonds ?? selectedPkg.coins ?? 0);

  const [selectedProId, setSelectedProId] = useState(
    liveProPlans[1]?.id || liveProPlans[0]?.id || 'pro_monthly'
  );
  const selectedProPlan =
    liveProPlans.find((p) => p.id === selectedProId) || liveProPlans[0] || PRO_PLANS[0];

  const [activeTab, setActiveTab] = useState('auto'); // 'auto' | 'direct'
  const [rulesOpen, setRulesOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(Boolean(liveDirectMethods[0]?.qrImageUrl));
  const [simulating, setSimulating] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [generatedInvoice, setGeneratedInvoice] = useState(null);

  const [selectedMethodId, setSelectedMethodId] = useState(liveDirectMethods[0]?.id || 'zinli');
  const selectedMethod =
    liveDirectMethods.find((m) => m.id === selectedMethodId) || liveDirectMethods[0] || null;
  const [referenceNumber, setReferenceNumber] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);
  const [submittingDirect, setSubmittingDirect] = useState(false);
  const [copied, setCopied] = useState(false);
  const [myRequests, setMyRequests] = useState([]);
  const [myPaymentTxs, setMyPaymentTxs] = useState([]);
  const [myActivations, setMyActivations] = useState([]);
  const [mySentGifts, setMySentGifts] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setStoreSection(
        initialSection === 'pro' ? 'pro' : initialSection === 'history' ? 'history' : 'buy'
      );
      setGeneratedInvoice(null);
    }
  }, [isOpen, initialSection]);

  useEffect(() => {
    setGeneratedInvoice(null);
  }, [storeSection, selectedPkgId, selectedProId]);

  useEffect(() => {
    if (liveDirectMethods.length > 0 && !liveDirectMethods.some((m) => m.id === selectedMethodId)) {
      setSelectedMethodId(liveDirectMethods[0].id);
      setQrOpen(Boolean(liveDirectMethods[0]?.qrImageUrl));
    }
  }, [liveDirectMethods, selectedMethodId]);

  useEffect(() => {
    if (!isOpen || !userProfile?.uid) return;
    const unsubReqs = subscribeMyPaymentRequests(userProfile.uid, setMyRequests);
    const unsubTxs = subscribeMyPaymentTransactions(userProfile.uid, setMyPaymentTxs);
    const unsubActs = subscribeMyStoreActivations(userProfile.uid, setMyActivations);
    const unsubGifts = subscribeSentGiftTransactions(userProfile.uid, setMySentGifts);
    return () => {
      unsubReqs();
      unsubTxs();
      unsubActs();
      unsubGifts();
    };
  }, [isOpen, userProfile?.uid]);

  const timelineEvents = useMemo(() => {
    const items = [];

    myPaymentTxs.forEach((tx) => {
      const units = Number(tx.diamondsCredited ?? tx.coinsCredited ?? 0);
      const isProTx = tx.creditField === 'pro';
      items.push({
        id: `tx_${tx.id}`,
        ms: toMillis(tx.createdAt),
        createdAt: tx.createdAt,
        icon: isProTx ? 'crown' : 'gem',
        title: isProTx
          ? `Conoscamosnos PRO (${tx.proDurationDays || 7}d)`
          : 'Recarga automática NowPayments',
        subtitle: `${formatUSD(tx.amountUSD)} · ${tx.provider || 'pasarela'}`,
        badgeText: isProTx ? 'PRO Activo' : `+${units} 💎`,
        badgeClass: 'bg-emerald-100 text-emerald-800',
      });
    });

    myRequests.forEach((r) => {
      const isProReq = r.creditTarget === 'pro';
      const units = Number(r.diamondsToCredit || r.coinsToCredit || 0);
      const statusLabel =
        r.status === 'approved' ? 'Aprobado' : r.status === 'rejected' ? 'Rechazado' : 'En revisión';
      items.push({
        id: `req_${r.id}`,
        ms: toMillis(r.createdAt),
        createdAt: r.createdAt,
        icon: isProReq ? 'crown' : 'wallet',
        title: isProReq
          ? `Solicitud PRO (${r.proDurationDays || 7}d)`
          : `Recarga directa (+${units} 💎)`,
        subtitle: `${r.methodName || 'Transferencia'} · ${formatUSD(r.amountUSD)} · ${statusLabel}`,
        badgeText:
          r.status === 'approved'
            ? isProReq
              ? 'PRO'
              : `+${units} 💎`
            : statusLabel,
        badgeClass:
          r.status === 'approved'
            ? 'bg-emerald-100 text-emerald-800'
            : r.status === 'rejected'
            ? 'bg-rose-100 text-rose-800'
            : 'bg-amber-100 text-amber-800',
      });
    });

    myActivations.forEach((act) => {
      const spent = Number(act.diamondsSpent || 0);
      const labels = {
        pro: `Activación Conoscamosnos PRO (${act.durationDays || 7} días)`,
        boost: `Activación Boost VIP (${act.durationHours || 24}h)`,
        unlock_chat: 'Chat directo desbloqueado',
        unlock_like: 'Like secreto revelado',
        unlock_all_likes: `Revelados ${act.unlockedCount || ''} Likes`,
      };
      items.push({
        id: `act_${act.id}`,
        ms: toMillis(act.createdAt),
        createdAt: act.createdAt,
        icon:
          act.kind === 'pro'
            ? 'crown'
            : act.kind === 'boost'
            ? 'zap'
            : act.kind === 'unlock_chat'
            ? 'message'
            : 'heart',
        title: labels[act.kind] || 'Consumo en Tienda',
        subtitle: act.kind === 'pro' || act.kind === 'boost' ? `Plan ${act.planId}` : 'Consumo inmediato',
        badgeText: `-${spent} 💎`,
        badgeClass: 'bg-sky-100 text-sky-800',
      });
    });

    mySentGifts.forEach((g) => {
      const cost = Number(g.diamondsCost ?? g.coinsCost ?? g.diamondsCredited ?? 0);
      const isPhoto = g.giftId === 'exclusive_photo';
      items.push({
        id: `gift_${g.id}`,
        ms: toMillis(g.createdAt),
        createdAt: g.createdAt,
        icon: isPhoto ? 'camera' : 'gift',
        title: isPhoto
          ? `Foto Exclusiva VIP de ${g.receiverName || 'Creador'}`
          : `${g.giftIcon || '🎁'} ${g.giftName || 'Regalo'} a ${g.receiverName || 'Usuario'}`,
        subtitle: isPhoto ? 'Álbum Exclusivo VIP desbloqueado' : 'Regalo virtual enviado',
        badgeText: `-${cost} 💎`,
        badgeClass: 'bg-rose-100 text-rose-800',
      });
    });

    return items.sort((a, b) => b.ms - a.ms).slice(0, 40);
  }, [myPaymentTxs, myRequests, myActivations, mySentGifts]);

  if (!isOpen) return null;

  const isProGatewayCheckout = storeSection === 'pro';
  const activeCheckoutItem = isProGatewayCheckout ? selectedProPlan : selectedPkg;
  const activeCreditTarget = isProGatewayCheckout ? 'pro' : 'diamonds';

  const handleNowPaymentsCheckout = async () => {
    if (creatingInvoice) return;
    setCreatingInvoice(true);
    try {
      const res = await createNowPaymentsCheckout({
        pkg: activeCheckoutItem,
        creditTarget: activeCreditTarget,
      });
      setGeneratedInvoice({
        url: res.invoiceUrl,
        amountUSD: activeCheckoutItem.priceUSD,
        label: isProGatewayCheckout ? selectedProPlan.shortLabel : `+${selectedPkgUnits} 💎`,
        target: activeCreditTarget,
      });

      const popup = window.open(res.invoiceUrl, '_blank', 'noopener,noreferrer');
      if (!popup || popup.closed) {
        window.location.assign(res.invoiceUrl);
      }

      onSuccess?.(
        isProGatewayCheckout
          ? `👑 Factura NowPayments generada por ${formatUSD(selectedProPlan.priceUSD)}. Tu membresía ${selectedProPlan.shortLabel} se activará al confirmarse el pago.`
          : `⚡ Factura NowPayments generada por ${formatUSD(selectedPkg.priceUSD)}. Tus +${selectedPkgUnits} 💎 se acreditarán automáticamente.`
      );
    } catch (err) {
      onError?.(err.message || 'No se pudo abrir la pasarela NowPayments.');
    } finally {
      setCreatingInvoice(false);
    }
  };

  const handleSimulateWebhook = async (provider) => {
    if (isProGatewayCheckout) {
      onError?.('La Membresía PRO solo se puede activar mediante pago real verificado.');
      return;
    }
    setSimulating(true);
    try {
      const res = await simulateAutoPaymentConfirmation({
        userId: userProfile.uid,
        userName: userProfile.name,
        pkg: activeCheckoutItem,
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
        pkg: activeCheckoutItem,
        method: selectedMethod,
        referenceNumber,
        proofUrl,
        creditTarget: activeCreditTarget,
      });
      setReferenceNumber('');
      setProofUrl('');
      onSuccess?.(
        isProGatewayCheckout
          ? `Solicitud enviada. Tu membresía ${selectedProPlan.shortLabel} se activará al aprobarse el comprobante.`
          : 'Solicitud enviada al equipo de auditoría. Recibirás tus Diamantes (💎) al aprobarse.'
      );
    } catch (err) {
      onError?.(err.message || 'Error al registrar la solicitud.');
    } finally {
      setSubmittingDirect(false);
    }
  };

  const renderGatewayPaymentBlock = () => (
    <div className="space-y-3.5">
      {/* Selector de Canal: Automático vs Transferencia Directa */}
      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-zinc-200/70 border border-zinc-200">
        <button
          type="button"
          onClick={() => setActiveTab('auto')}
          className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
            activeTab === 'auto'
              ? 'bg-white text-zinc-900 shadow-sm'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-sky-600" />
          Automático (USDT)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('direct')}
          className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
            activeTab === 'direct'
              ? 'bg-white text-zinc-900 shadow-sm'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <Wallet className="w-3.5 h-3.5 text-[#FF2E54]" />
          {activeDirectNames || 'Transferencia'}
        </button>
      </div>

      {activeTab === 'auto' ? (
        <div className="rounded-[24px] p-4 bg-white border border-zinc-200/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-black text-zinc-900">Pasarela Cripto NowPayments</p>
              <p className="text-[11px] text-zinc-500">
                Acreditación automática 24/7 vía Webhook IPN
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black">
              Instantáneo
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-sky-50/70 border border-sky-200/80 flex items-center justify-between">
            <div>
              <p className="text-[10.5px] font-bold text-sky-800">
                {isProGatewayCheckout
                  ? selectedProPlan.title
                  : `Paquete ${selectedPkg.label}`}
              </p>
              <p className="font-display text-lg font-black text-zinc-900 tabular-nums">
                {isProGatewayCheckout
                  ? `👑 ${selectedProPlan.durationDays} Días PRO`
                  : `+${selectedPkgUnits} 💎`}
              </p>
            </div>
            <span className="font-display text-xl font-black text-emerald-700 tabular-nums">
              {formatUSD(activeCheckoutItem.priceUSD)}
            </span>
          </div>

          <button
            type="button"
            disabled={creatingInvoice}
            onClick={handleNowPaymentsCheckout}
            className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#FF2E54] via-rose-500 to-amber-500 text-white font-black text-xs sm:text-sm shadow-lg shadow-[#FF2E54]/20 hover:brightness-105 active:scale-[0.99] disabled:opacity-60 transition flex items-center justify-center gap-2"
          >
            {creatingInvoice ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generando factura segura...
              </>
            ) : (
              <>
                <ExternalLink className="w-4 h-4" />
                Pagar {formatUSD(activeCheckoutItem.priceUSD)} con NowPayments
              </>
            )}
          </button>

          {generatedInvoice?.url && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2">
              <p className="text-[11px] font-bold text-emerald-900">
                Factura lista ({generatedInvoice.label} · {formatUSD(generatedInvoice.amountUSD)}). Si no se abrió automáticamente:
              </p>
              <a
                href={generatedInvoice.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir factura en NowPayments →
              </a>
            </div>
          )}

          {!isProGatewayCheckout && (ENABLE_DEMO_PAYMENTS || isSuperAdmin) && (
            <button
              type="button"
              disabled={simulating}
              onClick={() => handleSimulateWebhook('nowpayments')}
              className="w-full py-2.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[11px] font-extrabold transition"
            >
              {simulating
                ? 'Simulando IPN...'
                : `⚡ Simular pago confirmado +${selectedPkgUnits} 💎 (Admin)`}
            </button>
          )}
        </div>
      ) : selectedMethod ? (
        <form
          onSubmit={handleSubmitDirect}
          className="rounded-[24px] p-4 bg-white border border-zinc-200/80 shadow-sm space-y-3.5"
        >
          {/* Selector de método directo */}
          <div className="flex flex-wrap gap-1.5">
            {liveDirectMethods.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setSelectedMethodId(m.id);
                  setQrOpen(Boolean(m.qrImageUrl));
                }}
                className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold border transition ${
                  selectedMethod.id === m.id
                    ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
                    : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>

          <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500">
                {selectedMethod.accountLabel}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-[#FF2E54] text-[10px] font-black">
                Monto: {formatUSD(activeCheckoutItem.priceUSD)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-mono font-bold text-zinc-900 break-all">
                {selectedMethod.accountValue}
              </p>
              <button
                type="button"
                onClick={handleCopyAccount}
                className="px-2.5 py-1.5 rounded-xl bg-white border border-zinc-200 text-zinc-800 text-[11px] font-extrabold inline-flex items-center gap-1 shrink-0 hover:bg-zinc-100"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" /> Copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Copiar
                  </>
                )}
              </button>
            </div>

            <p className="text-[11px] text-zinc-500 leading-relaxed">
              {selectedMethod.extraInstructions}
            </p>

            <button
              type="button"
              onClick={() => setQrOpen((v) => !v)}
              className="text-[11px] font-extrabold text-[#FF2E54] inline-flex items-center gap-1 pt-0.5"
            >
              <QrCode className="w-3.5 h-3.5" />
              {qrOpen ? 'Ocultar código QR' : 'Mostrar código QR de pago'}
            </button>

            {qrOpen && (
              <div className="pt-2 flex flex-col items-center justify-center gap-2">
                {selectedMethod.qrImageUrl ? (
                  <img
                    src={selectedMethod.qrImageUrl}
                    alt={`QR ${selectedMethod.name}`}
                    className="w-40 h-40 object-contain rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm"
                  />
                ) : (
                  <DynamicQrCode
                    payload={`${selectedMethod.qrPrefix}${selectedMethod.accountValue}`}
                  />
                )}
              </div>
            )}
          </div>

          <div className="space-y-2.5">
            <div>
              <label className="text-[11px] font-extrabold text-zinc-700 block mb-1">
                Número de referencia / comprobante
              </label>
              <input
                type="text"
                required
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="Ej. últimos 6-8 dígitos o ID de transacción"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-semibold text-zinc-900 focus:outline-none focus:bg-white focus:border-[#FF2E54]"
              />
            </div>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleUploadProof}
                className="hidden"
              />
              <button
                type="button"
                disabled={uploadingProof}
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 px-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 hover:bg-zinc-100 text-xs font-bold text-zinc-700 flex items-center justify-center gap-2 transition"
              >
                {uploadingProof ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#FF2E54]" />
                    Subiendo captura...
                  </>
                ) : proofUrl ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Captura adjunta (Toca para cambiar)
                  </>
                ) : (
                  <>
                    <ImagePlus className="w-4 h-4 text-[#FF2E54]" />
                    Subir captura del pago
                  </>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submittingDirect || uploadingProof}
            className="w-full py-3.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-black text-xs sm:text-sm shadow-md disabled:opacity-50 transition"
          >
            {submittingDirect
              ? 'Enviando comprobante...'
              : isProGatewayCheckout
              ? `Notificar pago de ${selectedProPlan.shortLabel} (${formatUSD(selectedProPlan.priceUSD)})`
              : `Notificar pago por +${selectedPkgUnits} 💎 (${formatUSD(selectedPkg.priceUSD)})`}
          </button>
        </form>
      ) : null}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md max-h-[92dvh] bg-[#FAF7F9] rounded-t-[32px] sm:rounded-[32px] flex flex-col overflow-hidden shadow-2xl animate-sheet-up">
        <LuxuryModalHeader
          icon={storeSection === 'pro' ? Crown : Gem}
          iconClassName={
            storeSection === 'pro'
              ? 'bg-gradient-to-br from-amber-400 via-[#FF2E54] to-rose-500 text-white shadow-lg shadow-rose-500/25'
              : 'bg-gradient-to-br from-sky-400 via-indigo-400 to-rose-400 text-white shadow-lg shadow-sky-500/20'
          }
          eyebrow={proActive ? '👑 Miembro Conoscamosnos PRO' : 'Tienda Oficial VIP'}
          title={storeSection === 'pro' ? 'Conoscamosnos PRO' : 'Tienda de Diamantes'}
          subtitle={
            <span className="inline-flex items-center gap-2 flex-wrap">
              <span>
                Saldo disponible:{' '}
                <strong className="text-sky-300 tabular-nums">{spendableDiamonds} 💎</strong>
              </span>
              {proActive && (
                <>
                  <span className="text-white/30">·</span>
                  <span className="text-amber-300 font-extrabold">
                    PRO ({formatTimeRemaining(userProfile.proExpiresAt)})
                  </span>
                </>
              )}
            </span>
          }
          onClose={onClose}
        />

        <div className="flex-1 overflow-y-auto no-scrollbar p-4 sm:p-5 space-y-4 bg-[#FAF7F9]">
          {/* Selector Principal: Diamantes 💎 vs Conoscamosnos PRO 👑 vs Historial */}
          <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-zinc-200/75 border border-zinc-200">
            <button
              type="button"
              onClick={() => setStoreSection('buy')}
              className={`py-2.5 px-2 rounded-xl text-[11px] font-extrabold flex items-center justify-center gap-1 transition ${
                storeSection === 'buy'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Gem className="w-3.5 h-3.5 text-sky-500 shrink-0" />
              <span className="truncate">Diamantes</span>
            </button>

            <button
              type="button"
              onClick={() => setStoreSection('pro')}
              className={`py-2.5 px-2 rounded-xl text-[11px] font-extrabold flex items-center justify-center gap-1 transition ${
                storeSection === 'pro'
                  ? 'bg-gradient-to-r from-[#FF2E54] to-amber-500 text-white shadow-sm'
                  : 'text-zinc-700 hover:text-zinc-900'
              }`}
            >
              <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">PRO VIP</span>
            </button>

            <button
              type="button"
              onClick={() => setStoreSection('history')}
              className={`py-2.5 px-2 rounded-xl text-[11px] font-extrabold flex items-center justify-center gap-1 transition ${
                storeSection === 'history'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <History className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span className="truncate">Historial</span>
            </button>
          </div>

          {storeSection === 'buy' ? (
            <>
              {/* Explicación de Sistema Único en Diamantes */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-50 via-white to-rose-50 border border-sky-200/80 flex items-center justify-between gap-2">
                <div className="text-[11px] text-zinc-700 leading-snug">
                  <strong className="text-zinc-900">Todo con 💎 Diamantes:</strong> úsalos para{' '}
                  <strong className="text-[#FF2E54]">chatear directo ({policy.unlockChatDiamonds} 💎)</strong>,{' '}
                  <strong className="text-amber-700">ver Likes ({policy.unlockLikeDiamonds} 💎)</strong>, fotos VIP, enviar{' '}
                  <strong className="text-sky-700">Regalos</strong> o activar{' '}
                  <strong className="text-purple-700">Boost VIP</strong>.
                </div>
                <button
                  type="button"
                  onClick={() => setRulesOpen((v) => !v)}
                  className="px-2.5 py-1 rounded-full bg-white border border-zinc-200 text-zinc-700 text-[10.5px] font-extrabold inline-flex items-center gap-1 shrink-0"
                >
                  <Info className="w-3 h-3 text-sky-500" />
                  Info
                  <ChevronDown className={`w-3 h-3 transition ${rulesOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {rulesOpen && (
                <div className="p-3.5 rounded-2xl bg-white border border-zinc-200/80 text-[11px] text-zinc-600 space-y-1.5 leading-relaxed">
                  <p>
                    • <strong>Saldo único en Diamantes (💎):</strong> todo funciona directamente con tus Diamantes sin conversiones raras ni otros saldos.
                  </p>
                  <p>
                    • <strong>Regalos, Álbum VIP y Retiros Reales:</strong> cuando envías un regalo o desbloqueas una foto exclusiva, la otra persona acumula <strong>Diamantes Ganados</strong> que puede retirar a USD reales.
                  </p>
                </div>
              )}

              {/* Paquetes de Diamantes */}
              <div className="grid grid-cols-2 gap-2.5">
                {livePackages.map((pkg) => {
                  const units = Number(pkg.diamonds ?? pkg.coins ?? 0);
                  const selected = selectedPkg.id === pkg.id;
                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => setSelectedPkgId(pkg.id)}
                      className={`relative p-3.5 rounded-[22px] border text-left transition ${
                        selected
                          ? 'bg-gradient-to-br from-sky-50 via-white to-rose-50 border-sky-400 shadow-md ring-2 ring-sky-200/80'
                          : 'bg-white border-zinc-200/80 hover:border-sky-200'
                      }`}
                    >
                      {pkg.badge && (
                        <span className="inline-block mb-1.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-[#FF2E54] to-amber-500 text-white text-[9.5px] font-black uppercase">
                          {pkg.badge}
                        </span>
                      )}
                      <div className="flex items-baseline justify-between gap-1">
                        <p className="font-display text-lg font-black text-zinc-900 tabular-nums">
                          {units} 💎
                        </p>
                        <span className="text-xs font-black text-emerald-700 tabular-nums">
                          {formatUSD(pkg.priceUSD)}
                        </span>
                      </div>
                      <p className="text-[11px] font-extrabold text-zinc-700 mt-0.5">{pkg.label}</p>
                      {pkg.bonusText && (
                        <p className="text-[10px] text-zinc-500 mt-0.5 leading-tight line-clamp-2">
                          {pkg.bonusText}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>

              {renderGatewayPaymentBlock()}
            </>
          ) : storeSection === 'pro' ? (
            /* SECCIÓN 2: MEMBRESÍA CONOSCAMOSNOS PRO */
            <div className="space-y-4">
              {proActive && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-50 via-white to-amber-50 border border-emerald-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-500 shrink-0" />
                    <div>
                      <p className="text-xs font-black text-emerald-900">
                        Membresía Conoscamosnos PRO Activa
                      </p>
                      <p className="text-[10.5px] text-emerald-700">
                        Si activas otro plan, los días se suman automáticamente a tu vigencia actual.
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10.5px] font-black shrink-0">
                    {formatTimeRemaining(userProfile.proExpiresAt)}
                  </span>
                </div>
              )}

              {/* Lista de Beneficios PRO */}
              <div className="rounded-[24px] p-4 bg-gradient-to-br from-rose-50/90 via-white to-amber-50/80 border border-rose-200/80 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-black uppercase tracking-wider text-[#FF2E54] flex items-center gap-1">
                    <Crown className="w-3.5 h-3.5" /> Beneficios Conoscamosnos PRO
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[9.5px] font-black">
                    Todo Ilimitado
                  </span>
                </div>

                <div className="space-y-2">
                  {PRO_BENEFITS.map((b, idx) => {
                    const Icon = b.icon;
                    return (
                      <div key={idx} className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-xl bg-white border border-rose-200/80 text-[#FF2E54] flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-zinc-900">{b.title}</p>
                          <p className="text-[10.5px] text-zinc-600 leading-snug">{b.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Selección de Plan PRO (Semanal vs Mensual · Solo Pago Real) */}
              <div className="grid grid-cols-2 gap-2.5">
                {liveProPlans.map((plan) => {
                  const selected = selectedProPlan.id === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelectedProId(plan.id)}
                      className={`p-3.5 rounded-[22px] border text-left transition flex flex-col justify-between ${
                        selected
                          ? 'bg-gradient-to-br from-rose-50 via-white to-amber-50 border-[#FF2E54] shadow-md ring-2 ring-rose-200'
                          : 'bg-white border-zinc-200 hover:border-rose-200'
                      }`}
                    >
                      <div>
                        {plan.badge && (
                          <span className="inline-block mb-1.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-[#FF2E54] to-amber-500 text-white text-[9px] font-black uppercase">
                            {plan.badge}
                          </span>
                        )}
                        <p className="text-xs font-black text-zinc-900">
                          {plan.shortLabel || plan.title}
                        </p>
                        <p className="text-[10.5px] text-zinc-500 mt-0.5">
                          {plan.durationDays} días de acceso total
                        </p>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-zinc-100 flex items-baseline justify-between gap-1">
                        <span className="font-display text-base font-black text-emerald-700 tabular-nums">
                          {formatUSD(plan.priceUSD)}
                        </span>
                        <span className="text-[10px] font-extrabold uppercase tracking-wide text-amber-700">
                          Pago único
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="p-3 rounded-2xl bg-amber-50/90 border border-amber-200/80 text-[11px] text-amber-950 font-semibold leading-snug">
                Pago verificado obligatorio: tu Membresía PRO se activa únicamente al confirmarse el pago en pasarela (NowPayments) o tras aprobación de tu comprobante en Tesorería.
              </div>

              {renderGatewayPaymentBlock()}
            </div>
          ) : (
            /* SECCIÓN 3: HISTORIAL DE MOVIMIENTOS DE DIAMANTES */
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-white border border-zinc-200/80 shadow-xs flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-black text-zinc-900 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-indigo-500" />
                    Historial de tus Diamantes (💎)
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Recargas, suscripciones PRO, Boost VIP, regalos y Fotos VIP
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-800 text-xs font-black tabular-nums shrink-0">
                  {spendableDiamonds} 💎
                </span>
              </div>

              {timelineEvents.length === 0 ? (
                <div className="bg-white rounded-3xl p-8 text-center border border-zinc-200/80 shadow-xs space-y-2">
                  <div className="w-11 h-11 mx-auto rounded-2xl bg-sky-50 text-sky-500 flex items-center justify-center">
                    <Gem className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-extrabold text-zinc-900">Aún no tienes movimientos</p>
                  <p className="text-xs text-zinc-500 max-w-[240px] mx-auto">
                    Tus recargas, activaciones PRO, Boost VIP y regalos aparecerán aquí automáticamente.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {timelineEvents.map((item) => {
                    const IconComp =
                      item.icon === 'crown'
                        ? Crown
                        : item.icon === 'zap'
                        ? Zap
                        : item.icon === 'gift'
                        ? Gift
                        : item.icon === 'camera'
                        ? Camera
                        : item.icon === 'wallet'
                        ? Wallet
                        : item.icon === 'message'
                        ? MessageCircle
                        : item.icon === 'heart'
                        ? Heart
                        : Gem;
                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-2xl bg-white border border-zinc-200/80 shadow-xs flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-zinc-50 border border-zinc-200/80 text-zinc-700 flex items-center justify-center shrink-0">
                            <IconComp className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-extrabold text-zinc-900 truncate">
                              {item.title}
                            </p>
                            <p className="text-[10.5px] text-zinc-500 truncate">
                              {item.subtitle} · {formatGiftDate(item.createdAt)}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-black shrink-0 tabular-nums ${item.badgeClass}`}
                        >
                          {item.badgeText}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Historial rápido de solicitudes pendientes/recientes debajo de compra */}
          {storeSection !== 'history' && myRequests.length > 0 && (
            <div className="rounded-[24px] p-4 bg-white border border-zinc-200/80 shadow-sm space-y-2.5">
              <p className="text-xs font-black text-zinc-900 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                Tus comprobantes recientes
              </p>
              <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
                {myRequests.slice(0, 5).map((r) => {
                  const isProReq = r.creditTarget === 'pro';
                  const units = r.diamondsToCredit || r.coinsToCredit || 0;
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/70 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-extrabold text-zinc-900 truncate">
                          {isProReq
                            ? `👑 ${r.packageLabel || 'Conoscamosnos PRO'}`
                            : `+${units} 💎`}{' '}
                          · {formatUSD(r.amountUSD)}
                        </p>
                        <p className="text-[10.5px] text-zinc-500 truncate">
                          {r.methodName} · Ref: {r.referenceNumber}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                          r.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : r.status === 'rejected'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {r.status === 'approved'
                          ? 'Aprobado'
                          : r.status === 'rejected'
                          ? 'Rechazado'
                          : 'En revisión'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
