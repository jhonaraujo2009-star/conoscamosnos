import { useEffect, useRef, useState } from 'react';
import { Bell, Gem, Gift, Lock, MessageCircle, ShieldCheck, X } from 'lucide-react';
import { getUserById } from '../../services/userService';
import {
  calculateWithdrawalBreakdown,
  formatGiftDate,
  formatUSD,
  getPrimaryPhoto,
} from '../../utils/formatters';

export default function GiftNotificationsModal({
  isOpen,
  onClose,
  userProfile,
  receivedGifts = [],
  onSelectProfile,
  onStartChat,
  onOpenWithdrawals,
}) {
  const [senderMap, setSenderMap] = useState({});
  const fetchedSenderIdsRef = useRef(new Set());

  useEffect(() => {
    setSenderMap({});
    fetchedSenderIdsRef.current = new Set();
  }, [userProfile?.uid]);

  useEffect(() => {
    if (!isOpen || !userProfile?.uid || receivedGifts.length === 0) return;

    const missingIds = Array.from(
      new Set(
        receivedGifts
          .map((g) => g.senderId)
          .filter((id) => Boolean(id) && !fetchedSenderIdsRef.current.has(id))
      )
    ).slice(0, 30);

    if (missingIds.length === 0) return;
    missingIds.forEach((id) => fetchedSenderIdsRef.current.add(id));

    let cancelled = false;
    Promise.all(
      missingIds.map(async (uid) => {
        try {
          const u = await getUserById(uid);
          return [uid, u];
        } catch {
          return [uid, null];
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      setSenderMap((prev) => {
        const next = { ...prev };
        entries.forEach(([uid, u]) => {
          if (u) next[uid] = u;
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, userProfile?.uid, receivedGifts]);

  if (!isOpen || !userProfile?.uid) return null;

  // Filtro adicional defensivo: mostrar estrictamente regalos donde este perfil es el receptor
  const ownReceived = receivedGifts.filter((g) => g.receiverId === userProfile.uid);

  return (
    <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md max-h-[92dvh] bg-white rounded-t-[32px] sm:rounded-[32px] flex flex-col overflow-hidden shadow-2xl animate-sheet-up">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-200/80 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-[#FF2E54] text-white flex items-center justify-center shrink-0 shadow-sm">
              <Bell className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-base font-extrabold text-zinc-900 truncate">
                Quién te envió regalos
              </h3>
              <p className="text-[11px] font-semibold text-zinc-500 truncate flex items-center gap-1">
                <Lock className="w-3 h-3 text-emerald-600 shrink-0" />
                Notificaciones privadas de {userProfile.name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feed */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3 bg-[#F4F4F6]">
          <div className="p-3 rounded-2xl bg-white border border-zinc-200/80 text-[11px] text-zinc-600 flex items-start gap-2 leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              Solo <strong className="text-zinc-900">tú</strong> puedes ver quién te envió cada Diamante o regalo. Los totales en tu perfil son anónimos para los demás.
            </span>
          </div>

          {ownReceived.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center shadow-card space-y-2.5">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center">
                <Gift className="w-6 h-6" />
              </div>
              <p className="text-sm font-extrabold text-zinc-900">Aún sin regalos recibidos</p>
              <p className="text-xs text-zinc-500 max-w-[240px] mx-auto leading-relaxed">
                Cuando alguien te envíe un Diamante, Rosa o detalle especial, verás aquí su notificación y cuánto sumó a tus ganancias.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {ownReceived.map((tx) => {
                const sender = senderMap[tx.senderId];
                const senderName = sender?.name || tx.senderName || 'Usuario';
                const diamonds = Number(tx.diamondsCredited || tx.coinsCost || 0);
                const { netPayoutUSD } = calculateWithdrawalBreakdown(diamonds);

                return (
                  <div
                    key={tx.id}
                    className="p-3.5 rounded-2xl bg-white border border-zinc-200/80 shadow-card space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2.5">
                      <div
                        onClick={() => sender && onSelectProfile?.(sender)}
                        className={`flex items-center gap-2.5 min-w-0 flex-1 ${
                          sender && onSelectProfile ? 'cursor-pointer' : ''
                        }`}
                      >
                        <img
                          src={getPrimaryPhoto(sender || { name: senderName }, 140)}
                          alt={senderName}
                          className="w-11 h-11 rounded-2xl object-cover bg-zinc-100 border border-zinc-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-extrabold text-zinc-900 truncate">
                            {senderName}
                          </p>
                          <p className="text-[11px] font-semibold text-zinc-500 truncate">
                            Te envió <strong className="text-zinc-800">{tx.giftName}</strong> ·{' '}
                            {formatGiftDate(tx.createdAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end shrink-0">
                        <span className="text-2xl leading-none">{tx.giftIcon}</span>
                        <span className="text-[11px] font-black text-sky-600 flex items-center gap-0.5 mt-1">
                          +{diamonds} <Gem className="w-3 h-3" />
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-zinc-100">
                      <span className="text-[11px] font-extrabold text-emerald-600">
                        Valor retirable: +{formatUSD(netPayoutUSD)} USD
                      </span>

                      {sender && onStartChat && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onStartChat(sender);
                          }}
                          className="px-3 py-1.5 rounded-full bg-zinc-900 text-white text-[11px] font-extrabold flex items-center gap-1 hover:bg-zinc-800 transition"
                        >
                          <MessageCircle className="w-3 h-3" /> Agradecer
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="p-4 border-t border-zinc-200/80 bg-white">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenWithdrawals?.();
            }}
            className="w-full py-3.5 rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-md active:scale-[0.99] transition"
          >
            <Gem className="w-4 h-4" />
            Vender o retirar mis ganancias ({userProfile.earningsDiamonds || 0} 💎)
          </button>
        </div>
      </div>
    </div>
  );
}
