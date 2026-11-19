import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CalendarDays,
  Check,
  Eraser,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { formatUSD, toMillis } from '../../utils/formatters';

const COLLECTIONS_META = [
  { id: 'paymentRequests', label: 'Recargas Manuales', shortLabel: 'recargas', defaultChecked: true },
  { id: 'paymentTransactions', label: 'Pagos Automáticos / API', shortLabel: 'API', defaultChecked: true },
  { id: 'adImpressions', label: 'Ingresos por Anuncios', shortLabel: 'ads', defaultChecked: true },
  { id: 'withdrawalRequests', label: 'Retiros a Creadores', shortLabel: 'retiros', defaultChecked: true },
  { id: 'giftTransactions', label: 'Regalos y Fotos VIP', shortLabel: 'regalos', defaultChecked: false },
  { id: 'storeActivations', label: 'Activaciones PRO y Boost', shortLabel: 'planes', defaultChecked: false },
];

const DEFAULT_SELECTED_MAP = COLLECTIONS_META.reduce((acc, item) => {
  acc[item.id] = item.defaultChecked;
  return acc;
}, {});

function getRecordTimestampMs(colName, item) {
  if (colName === 'paymentRequests') {
    return toMillis(item?.reviewedAt) || toMillis(item?.createdAt);
  }
  if (colName === 'withdrawalRequests') {
    return toMillis(item?.paidAt) || toMillis(item?.createdAt);
  }
  return toMillis(item?.createdAt);
}

function getRecordRevenueUSD(colName, item) {
  if (colName === 'paymentRequests') {
    return item?.status === 'approved' ? Number(item?.amountUSD || 0) : 0;
  }
  if (colName === 'paymentTransactions') {
    return item?.status === 'completed' ? Number(item?.amountUSD || 0) : 0;
  }
  if (colName === 'adImpressions') {
    return Number(item?.estimatedRevenueUSD || 0);
  }
  return 0;
}

function toLocalDayKey(ms) {
  if (!ms || !Number.isFinite(ms)) return '';
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayKeyToRange(dayKey) {
  const parts = String(dayKey || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [y, m, d] = parts;
  return {
    startMs: new Date(y, m - 1, d, 0, 0, 0, 0).getTime(),
    endMs: new Date(y, m - 1, d, 23, 59, 59, 999).getTime(),
  };
}

function shiftLocalDayKey(offsetDays) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return toLocalDayKey(d.getTime());
}

function formatDayLabel(dayKey, todayKey, yesterdayKey) {
  const parts = String(dayKey || '').split('-').map(Number);
  if (parts.length !== 3) return dayKey;
  const [y, m, d] = parts;
  const dateObj = new Date(y, m - 1, d);
  const formatted = new Intl.DateTimeFormat('es', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(dateObj);
  if (dayKey === todayKey) return `Hoy · ${formatted}`;
  if (dayKey === yesterdayKey) return `Ayer · ${formatted}`;
  return formatted;
}

export default function AdminRevenueCleanupModal({
  open,
  onClose,
  paymentRequests = [],
  paymentTxs = [],
  adImpressions = [],
  withdrawals = [],
  giftTxs = [],
  storeActivations = [],
  onConfirmPurge,
  busy = false,
}) {
  const todayKey = useMemo(() => toLocalDayKey(Date.now()), [open]);
  const yesterdayKey = useMemo(() => shiftLocalDayKey(-1), [open]);

  const [mode, setMode] = useState('days'); // 'days' | 'range' | 'all'
  const [selectedMap, setSelectedMap] = useState(DEFAULT_SELECTED_MAP);
  const [selectedDays, setSelectedDays] = useState([]);
  const [fromDate, setFromDate] = useState(todayKey);
  const [toDate, setToDate] = useState(todayKey);
  const [confirmAllChecked, setConfirmAllChecked] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode('days');
    setSelectedMap(DEFAULT_SELECTED_MAP);
    setSelectedDays([]);
    setFromDate(todayKey);
    setToDate(todayKey);
    setConfirmAllChecked(false);
  }, [open, todayKey]);

  const datasetByCol = useMemo(
    () => ({
      paymentRequests,
      paymentTransactions: paymentTxs,
      adImpressions,
      withdrawalRequests: withdrawals,
      giftTransactions: giftTxs,
      storeActivations,
    }),
    [paymentRequests, paymentTxs, adImpressions, withdrawals, giftTxs, storeActivations]
  );

  const selectedCollections = useMemo(
    () => COLLECTIONS_META.filter((c) => selectedMap[c.id]).map((c) => c.id),
    [selectedMap]
  );

  const dayBuckets = useMemo(() => {
    const map = {};
    selectedCollections.forEach((colId) => {
      const list = datasetByCol[colId] || [];
      list.forEach((item) => {
        const ts = getRecordTimestampMs(colId, item);
        const dayKey = toLocalDayKey(ts);
        if (!dayKey) return;
        if (!map[dayKey]) {
          map[dayKey] = {
            dayKey,
            totalCount: 0,
            revenueUSD: 0,
            countsByCol: {},
          };
        }
        map[dayKey].totalCount += 1;
        map[dayKey].revenueUSD += getRecordRevenueUSD(colId, item);
        map[dayKey].countsByCol[colId] = (map[dayKey].countsByCol[colId] || 0) + 1;
      });
    });

    return Object.values(map).sort((a, b) => b.dayKey.localeCompare(a.dayKey));
  }, [selectedCollections, datasetByCol]);

  const computedRanges = useMemo(() => {
    if (mode === 'days') {
      return selectedDays.map(dayKeyToRange).filter(Boolean);
    }
    if (mode === 'range') {
      if (!fromDate && !toDate) return [];
      const a = fromDate || toDate;
      const b = toDate || fromDate;
      const startKey = a <= b ? a : b;
      const endKey = a <= b ? b : a;
      const rStart = dayKeyToRange(startKey);
      const rEnd = dayKeyToRange(endKey);
      if (!rStart || !rEnd) return [];
      return [{ startMs: rStart.startMs, endMs: rEnd.endMs }];
    }
    return [];
  }, [mode, selectedDays, fromDate, toDate]);

  const previewSummary = useMemo(() => {
    let matchedCount = 0;
    let matchedRevenueUSD = 0;

    if (selectedCollections.length === 0) {
      return { matchedCount: 0, matchedRevenueUSD: 0 };
    }

    if (mode !== 'all' && computedRanges.length === 0) {
      return { matchedCount: 0, matchedRevenueUSD: 0 };
    }

    selectedCollections.forEach((colId) => {
      const list = datasetByCol[colId] || [];
      list.forEach((item) => {
        if (mode === 'all') {
          matchedCount += 1;
          matchedRevenueUSD += getRecordRevenueUSD(colId, item);
          return;
        }
        const ts = getRecordTimestampMs(colId, item);
        if (ts > 0 && computedRanges.some((r) => ts >= r.startMs && ts <= r.endMs)) {
          matchedCount += 1;
          matchedRevenueUSD += getRecordRevenueUSD(colId, item);
        }
      });
    });

    return { matchedCount, matchedRevenueUSD };
  }, [mode, selectedCollections, datasetByCol, computedRanges]);

  if (!open) return null;

  const toggleCollection = (colId) => {
    setSelectedMap((prev) => ({ ...prev, [colId]: !prev[colId] }));
  };

  const toggleDay = (dayKey) => {
    setSelectedDays((prev) =>
      prev.includes(dayKey) ? prev.filter((d) => d !== dayKey) : [...prev, dayKey]
    );
  };

  const monthStartKey = `${todayKey.slice(0, 7)}-01`;
  const canSubmit =
    !busy &&
    selectedCollections.length > 0 &&
    previewSummary.matchedCount > 0 &&
    (mode !== 'all' || confirmAllChecked);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    await onConfirmPurge?.({
      mode: mode === 'all' ? 'all' : 'ranges',
      ranges: mode === 'all' ? [] : computedRanges,
      collections: selectedCollections,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[85] bg-[#2B221B]/45 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={() => !busy && onClose?.()}
    >
      <div
        className="w-full max-w-2xl rounded-[30px] bg-[#FFFDF8] border border-[#E8DEC9] shadow-[0_24px_60px_-16px_rgba(92,68,38,0.28)] overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera Crema */}
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-[#FFF7E8] via-[#FFFDF8] to-[#FDF0EA] border-b border-[#EFE5D4] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#FAE8CF] border border-[#E9CFA7] text-[#9A5B13] flex items-center justify-center shrink-0">
              <Eraser className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-base sm:text-lg font-black text-[#2C241E] truncate">
                Limpiar Ingresos y Días de Prueba
              </h3>
              <p className="text-[11px] text-[#7D6C5D] truncate">
                Borra días de pruebas específicos o reinicia métricas financieras al instante.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => onClose?.()}
            className="p-2 rounded-full bg-[#F4ECDD] hover:bg-[#EAE0CE] border border-[#E2D5BE] text-[#5C4E41] transition shrink-0 disabled:opacity-50"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 max-h-[82dvh] overflow-y-auto">
          {/* Selector de Modo */}
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[#F4ECDD] border border-[#E5D9C3]">
            {[
              { id: 'days', label: 'Elegir días', icon: CalendarDays },
              { id: 'range', label: 'Rango de fechas', icon: Calendar },
              { id: 'all', label: 'Limpiar todo', icon: Trash2 },
            ].map((tab) => {
              const TabIcon = tab.icon;
              const active = mode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMode(tab.id)}
                  className={`py-2 px-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition ${
                    active
                      ? tab.id === 'all'
                        ? 'bg-gradient-to-r from-[#FF2E54] to-rose-500 text-white shadow-sm'
                        : 'bg-[#FFFDF8] text-[#2C241E] border border-[#E5D9C3] shadow-sm'
                      : 'text-[#6E6053] hover:text-[#2C241E]'
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Categorías incluidas */}
          <div className="space-y-2">
            <p className="text-[10.5px] font-black uppercase tracking-wider text-[#7D6C5D]">
              1. Qué registros deseas limpiar
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {COLLECTIONS_META.map((col) => {
                const checked = Boolean(selectedMap[col.id]);
                const totalInCol = (datasetByCol[col.id] || []).length;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => toggleCollection(col.id)}
                    className={`px-3 py-2.5 rounded-2xl border text-left flex items-center justify-between gap-2 transition ${
                      checked
                        ? 'bg-[#FFF9ED] border-[#DFB985] shadow-sm'
                        : 'bg-[#F8F3E9] border-[#E7DEC9] opacity-75 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition ${
                          checked
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'bg-white border-[#D6C7B2]'
                        }`}
                      >
                        {checked && <Check className="w-3 h-3" />}
                      </span>
                      <span className="text-xs font-extrabold text-[#2C241E] truncate">
                        {col.label}
                      </span>
                    </div>
                    <span className="text-[10.5px] font-black text-[#7D6C5D] bg-white/80 border border-[#E6DAC5] px-2 py-0.5 rounded-full tabular-nums shrink-0">
                      {totalInCol}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* MODO 1: ELEGIR DÍAS ESPECÍFICOS */}
          {mode === 'days' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10.5px] font-black uppercase tracking-wider text-[#7D6C5D]">
                  2. Selecciona los días con registros ({dayBuckets.length})
                </p>
                {dayBuckets.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedDays(dayBuckets.map((b) => b.dayKey))}
                      className="px-2.5 py-1 rounded-full bg-[#F4ECDD] hover:bg-[#EAE0CE] border border-[#E2D5BE] text-[10.5px] font-bold text-[#4B3E33] transition"
                    >
                      Seleccionar todos
                    </button>
                    {selectedDays.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedDays([])}
                        className="px-2.5 py-1 rounded-full bg-white hover:bg-[#FAF4E8] border border-[#E2D5BE] text-[10.5px] font-bold text-[#7D6C5D] transition"
                      >
                        Desmarcar
                      </button>
                    )}
                  </div>
                )}
              </div>

              {dayBuckets.length === 0 ? (
                <div className="p-6 rounded-2xl bg-[#F8F3E9] border border-[#E7DEC9] text-center text-xs text-[#7D6C5D]">
                  No hay registros en las categorías seleccionadas.
                </div>
              ) : (
                <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                  {dayBuckets.map((bucket) => {
                    const checked = selectedDays.includes(bucket.dayKey);
                    const breakdown = COLLECTIONS_META.filter(
                      (c) => bucket.countsByCol[c.id] > 0
                    )
                      .map((c) => `${bucket.countsByCol[c.id]} ${c.shortLabel}`)
                      .join(' · ');

                    return (
                      <button
                        key={bucket.dayKey}
                        type="button"
                        onClick={() => toggleDay(bucket.dayKey)}
                        className={`w-full px-3.5 py-2.5 rounded-2xl border flex items-center justify-between gap-3 text-left transition ${
                          checked
                            ? 'bg-rose-50/90 border-rose-300 shadow-sm'
                            : 'bg-[#FAF5EB] hover:bg-[#FFFDF8] border-[#E7DEC9]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                              checked
                                ? 'bg-[#FF2E54] border-[#FF2E54] text-white'
                                : 'bg-white border-[#D6C7B2]'
                            }`}
                          >
                            {checked && <Check className="w-3 h-3" />}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-[#2C241E] capitalize truncate">
                              {formatDayLabel(bucket.dayKey, todayKey, yesterdayKey)}
                            </p>
                            <p className="text-[10.5px] text-[#7D6C5D] truncate">{breakdown}</p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-black text-emerald-700 tabular-nums block">
                            {formatUSD(bucket.revenueUSD)}
                          </span>
                          <span className="text-[10px] font-bold text-[#7D6C5D] tabular-nums">
                            {bucket.totalCount} reg.
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* MODO 2: RANGO DE FECHAS */}
          {mode === 'range' && (
            <div className="space-y-3 p-4 rounded-2xl bg-[#FAF5EB] border border-[#E7DEC9]">
              <p className="text-[10.5px] font-black uppercase tracking-wider text-[#7D6C5D]">
                2. Elige el rango de fechas a eliminar
              </p>

              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'Solo hoy', from: todayKey, to: todayKey },
                  { label: 'Últimos 3 días', from: shiftLocalDayKey(-2), to: todayKey },
                  { label: 'Últimos 7 días', from: shiftLocalDayKey(-6), to: todayKey },
                  { label: 'Este mes', from: monthStartKey, to: todayKey },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setFromDate(preset.from);
                      setToDate(preset.to);
                    }}
                    className={`px-3 py-1 rounded-full text-[11px] font-extrabold border transition ${
                      fromDate === preset.from && toDate === preset.to
                        ? 'bg-[#F4E6D0] border-[#D9BA8C] text-[#3B2E24]'
                        : 'bg-white border-[#E5D9C3] text-[#6E6053] hover:text-[#2C241E]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#6E6053] block mb-1">
                    Desde (día inicial)
                  </label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#E2D5BE] text-xs font-bold text-[#2C241E] focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#6E6053] block mb-1">
                    Hasta (día final)
                  </label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#E2D5BE] text-xs font-bold text-[#2C241E] focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* MODO 3: LIMPIAR TODO EL HISTORIAL DE PRUEBAS */}
          {mode === 'all' && (
            <div className="p-4 rounded-2xl bg-rose-50/85 border border-rose-200 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-[#FF2E54] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-black text-rose-900">
                    Reinicio total de categorías marcadas
                  </p>
                  <p className="text-[11px] text-rose-800/90 mt-0.5 leading-relaxed">
                    Esto eliminará todo el historial de prueba dentro de las categorías seleccionadas para dejar el contador de ingresos en $0.00. Esta acción no se puede deshacer.
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer p-2.5 rounded-xl bg-white border border-rose-200">
                <input
                  type="checkbox"
                  checked={confirmAllChecked}
                  onChange={(e) => setConfirmAllChecked(e.target.checked)}
                  className="w-4 h-4 accent-[#FF2E54] rounded"
                />
                <span className="text-[11px] font-extrabold text-[#2C241E]">
                  Confirmo que quiero borrar todos los registros de las categorías marcadas
                </span>
              </label>
            </div>
          )}

          {/* Resumen en vivo de impacto */}
          <div className="p-3.5 rounded-2xl bg-[#F6EFE2] border border-[#E5D7C0] space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-black text-[#2C241E] tabular-nums">
                {previewSummary.matchedCount} registros a eliminar
              </span>
              <span className="font-black text-[#FF2E54] tabular-nums">
                -{formatUSD(previewSummary.matchedRevenueUSD)} USD en ingresos
              </span>
            </div>
            <p className="text-[10.5px] text-[#6E6053] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              Solo se borran registros financieros o de prueba. Ninguna cuenta ni perfil de usuario será eliminado.
            </p>
          </div>

          {/* Botones finales */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => onClose?.()}
              className="py-3 rounded-2xl bg-[#F4ECDD] hover:bg-[#EAE0CE] border border-[#E2D5BE] text-[#4B3E33] text-xs font-black transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="py-3 rounded-2xl bg-gradient-to-r from-[#FF2E54] to-rose-500 text-white text-xs font-black shadow-md shadow-rose-200 hover:brightness-105 disabled:opacity-45 disabled:shadow-none transition flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              {busy ? 'Limpiando registros...' : 'Confirmar limpieza'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
