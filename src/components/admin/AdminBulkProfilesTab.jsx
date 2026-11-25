import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgeCheck,
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  Globe2,
  Heart,
  ImagePlus,
  Loader2,
  MapPin,
  Power,
  RefreshCw,
  Shuffle,
  Sparkles,
  Trash2,
  UploadCloud,
  Users,
  X,
} from 'lucide-react';
import { COUNTRIES, LOOKING_FOR_OPTIONS, MIN_AGE } from '../../config/constants';
import { useAuth } from '../../contexts/AuthContext';
import {
  createAdminBulkProfiles,
  deleteAdminBulkProfiles,
  setAdminBulkProfileVisibility,
  updateAdminBulkSettings,
} from '../../services/adminService';
import { uploadImageToCloudinary } from '../../services/cloudinaryService';
import {
  generateBulkProfileDrafts,
  generateSingleProfileDraft,
  resolveCountryAndCity,
} from '../../utils/bulkProfileGenerator';

const UPLOAD_CONCURRENCY = 4;
const SERVER_BATCH_SIZE = 50;

function makeQueueId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function AdminBulkProfilesTab({ users = [], onSuccess, onError }) {
  const { userProfile, economyConfig } = useAuth();
  const fileInputRef = useRef(null);
  const queueRef = useRef([]);

  const showBulkProfiles = economyConfig?.showAdminBulkProfiles !== false;
  const enableAutoLikes = economyConfig?.enableBulkAutoLikes !== false;
  const [savingToggleKey, setSavingToggleKey] = useState(null);
  const [togglingBulkUid, setTogglingBulkUid] = useState(null);

  // Configuración del generador automático
  const [countryCode, setCountryCode] = useState('CO');
  const [genderMode, setGenderMode] = useState('Mujer'); // 'Mujer' | 'Hombre' | 'Mixto'
  const [minAge, setMinAge] = useState(19);
  const [maxAge, setMaxAge] = useState(32);
  const [lookingFor, setLookingFor] = useState('RANDOM');
  const [verifiedRatio, setVerifiedRatio] = useState(35);
  const [onlineRatio, setOnlineRatio] = useState(50);
  const [allowPaidMessages, setAllowPaidMessages] = useState(false);
  const [messagePriceDiamonds, setMessagePriceDiamonds] = useState(25);

  const [queue, setQueue] = useState([]); // { id, file, previewUrl, photoUrl, draft, status, error }
  const [showAllQueue, setShowAllQueue] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Estado de publicación masiva
  const [publishing, setPublishing] = useState(false);
  const [progress, setProgress] = useState({ phase: '', done: 0, total: 0 });
  const [lastCreatedCount, setLastCreatedCount] = useState(0);

  // Edición puntual de 1 tarjeta en cola
  const [editingItemId, setEditingItemId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  // Gestión de perfiles masivos ya guardados
  const [bulkCountryFilter, setBulkCountryFilter] = useState('ALL');
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  queueRef.current = queue;

  // Limpiar ObjectURLs al desmontar
  useEffect(() => {
    return () => {
      queueRef.current.forEach((item) => {
        if (item?.previewUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, []);

  const generatorOptions = useMemo(
    () => ({
      countryCode,
      genderMode,
      minAge: Math.max(MIN_AGE, Number(minAge) || MIN_AGE),
      maxAge: Math.max(Math.max(MIN_AGE, Number(minAge) || MIN_AGE), Number(maxAge) || 34),
      lookingFor,
      verifiedRatio,
      onlineRatio,
      allowPaidMessages,
      messagePriceDiamonds,
    }),
    [
      countryCode,
      genderMode,
      minAge,
      maxAge,
      lookingFor,
      verifiedRatio,
      onlineRatio,
      allowPaidMessages,
      messagePriceDiamonds,
    ]
  );

  const handleFilesAdded = (fileList) => {
    const rawFiles = Array.from(fileList || []).filter((f) =>
      String(f?.type || '').startsWith('image/')
    );
    if (rawFiles.length === 0) {
      onError?.('Selecciona al menos una imagen válida (JPG, PNG, WEBP).');
      return;
    }

    const existingNames = new Set(queueRef.current.map((item) => item.draft?.name).filter(Boolean));
    const drafts = generateBulkProfileDrafts(rawFiles.length, generatorOptions);

    // Asegurar unicidad adicional contra los nombres que ya estaban en cola
    const added = rawFiles.map((file, idx) => {
      let draft = drafts[idx];
      if (existingNames.has(draft.name)) {
        draft = generateSingleProfileDraft({ ...generatorOptions, usedNames: existingNames });
      } else {
        existingNames.add(draft.name);
      }
      return {
        id: makeQueueId(),
        file,
        previewUrl: URL.createObjectURL(file),
        photoUrl: '',
        draft,
        status: 'pending',
        error: '',
      };
    });

    setQueue((prev) => [...prev, ...added]);
    setLastCreatedCount(0);
  };

  const handleRemoveItem = (id) => {
    setQueue((prev) => {
      const target = prev.find((it) => it.id === id);
      if (target?.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((it) => it.id !== id);
    });
  };

  const handleClearQueue = () => {
    if (publishing) return;
    queue.forEach((it) => {
      if (it?.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(it.previewUrl);
      }
    });
    setQueue([]);
    setShowAllQueue(false);
  };

  const handleRegenerateAllDrafts = () => {
    if (publishing || queue.length === 0) return;
    const freshDrafts = generateBulkProfileDrafts(queue.length, generatorOptions);
    setQueue((prev) =>
      prev.map((item, idx) =>
        item.status === 'saved' ? item : { ...item, draft: freshDrafts[idx], status: 'pending', error: '' }
      )
    );
    onSuccess?.('Datos aleatorios regenerados para toda la cola.');
  };

  const handleRerollSingle = (id) => {
    if (publishing) return;
    const usedNames = new Set(
      queue.filter((it) => it.id !== id).map((it) => it.draft?.name).filter(Boolean)
    );
    const fresh = generateSingleProfileDraft({ ...generatorOptions, usedNames });
    setQueue((prev) =>
      prev.map((it) => (it.id === id ? { ...it, draft: fresh, error: '' } : it))
    );
  };

  const openEditor = (item) => {
    setEditingItemId(item.id);
    setEditDraft({
      name: item.draft.name,
      age: item.draft.age,
      gender: item.draft.gender,
      countryCode: item.draft.country?.code || 'CO',
      city: item.draft.city || '',
      lookingFor: item.draft.lookingFor || LOOKING_FOR_OPTIONS[0],
      bio: item.draft.bio || '',
      isVerified: Boolean(item.draft.isVerified),
      isOnline: Boolean(item.draft.isOnline),
    });
  };

  const saveEditor = () => {
    if (!editingItemId || !editDraft) return;
    const pickedCountry =
      COUNTRIES.find((c) => c.code === editDraft.countryCode) || COUNTRIES[0];
    setQueue((prev) =>
      prev.map((item) => {
        if (item.id !== editingItemId) return item;
        const countryChanged = item.draft.country?.code !== pickedCountry.code;
        const loc = countryChanged
          ? resolveCountryAndCity(pickedCountry.code)
          : {
              country: {
                code: pickedCountry.code,
                name: pickedCountry.name,
                flag: pickedCountry.flag,
              },
              city: editDraft.city.trim() || item.draft.city,
              approxGeo: item.draft.approxGeo,
            };
        return {
          ...item,
          draft: {
            ...item.draft,
            name: String(editDraft.name || 'Usuario').trim().slice(0, 45) || 'Usuario',
            age: Math.max(MIN_AGE, Math.min(75, Math.floor(Number(editDraft.age) || 24))),
            gender: editDraft.gender,
            country: loc.country,
            city: editDraft.city.trim() || loc.city,
            approxGeo: loc.approxGeo,
            lookingFor: editDraft.lookingFor,
            bio: String(editDraft.bio || '').trim().slice(0, 500),
            isVerified: Boolean(editDraft.isVerified),
            isOnline: Boolean(editDraft.isOnline),
          },
        };
      })
    );
    setEditingItemId(null);
    setEditDraft(null);
  };

  const handlePublishBatch = async () => {
    const targets = queue.filter((it) => it.status !== 'saved');
    if (targets.length === 0 || publishing) return;

    setPublishing(true);
    setLastCreatedCount(0);
    const batchId = `bulk_${Date.now()}`;
    setProgress({ phase: 'uploading', done: 0, total: targets.length });

    try {
      const resultsMap = new Map();
      let cursor = 0;
      let uploadedDone = 0;

      const worker = async () => {
        while (cursor < targets.length) {
          const item = targets[cursor];
          cursor += 1;
          try {
            let finalUrl = item.photoUrl;
            if (!finalUrl) {
              setQueue((prev) =>
                prev.map((q) => (q.id === item.id ? { ...q, status: 'uploading', error: '' } : q))
              );
              const uploaded = await uploadImageToCloudinary(item.file, {
                folder: 'conoscamosnos/bulk_profiles',
                compression: { maxWidth: 1080, quality: 0.85 },
                tags: ['admin_bulk', batchId],
              });
              finalUrl = uploaded.url;
            }
            resultsMap.set(item.id, { ok: true, photoUrl: finalUrl });
          } catch (err) {
            resultsMap.set(item.id, {
              ok: false,
              error: err?.message || 'Error subiendo foto a Cloudinary',
            });
          } finally {
            uploadedDone += 1;
            setProgress({ phase: 'uploading', done: uploadedDone, total: targets.length });
          }
        }
      };

      const workerCount = Math.min(UPLOAD_CONCURRENCY, targets.length);
      await Promise.all(Array.from({ length: workerCount }, () => worker()));

      // Separar exitosas y fallidas
      const readyItems = [];
      setQueue((prev) =>
        prev.map((q) => {
          const r = resultsMap.get(q.id);
          if (!r) return q;
          if (!r.ok) {
            return { ...q, status: 'error', error: r.error };
          }
          const updated = { ...q, photoUrl: r.photoUrl, status: 'uploaded', error: '' };
          readyItems.push(updated);
          return updated;
        })
      );

      if (readyItems.length === 0) {
        throw new Error('Ninguna foto se pudo subir a la nube. Revisa tu conexión e intenta otra vez.');
      }

      // Guardar perfiles en Firestore vía Admin SDK en lotes de 50
      setProgress({ phase: 'saving', done: 0, total: readyItems.length });
      let totalSaved = 0;
      const savedIdsSet = new Set();

      for (let i = 0; i < readyItems.length; i += SERVER_BATCH_SIZE) {
        const chunk = readyItems.slice(i, i + SERVER_BATCH_SIZE);
        const payload = chunk.map((item) => ({
          ...item.draft,
          photoUrl: item.photoUrl,
        }));
        const res = await createAdminBulkProfiles({ profiles: payload, batchId });
        totalSaved += Number(res?.createdCount || chunk.length);
        chunk.forEach((c) => savedIdsSet.add(c.id));
        setProgress({
          phase: 'saving',
          done: Math.min(readyItems.length, i + chunk.length),
          total: readyItems.length,
        });
      }

      setQueue((prev) => {
        prev.forEach((it) => {
          if (savedIdsSet.has(it.id) && it.previewUrl?.startsWith('blob:')) {
            URL.revokeObjectURL(it.previewUrl);
          }
        });
        return prev.filter((it) => !savedIdsSet.has(it.id));
      });

      setLastCreatedCount(totalSaved);
      onSuccess?.(
        `🎉 ¡Listo! Se crearon ${totalSaved} perfiles nuevos automáticamente con sus fotos y ya están activos en Descubrir.`
      );
    } catch (err) {
      onError?.(err?.message || 'Error procesando el lote de perfiles.');
    } finally {
      setPublishing(false);
      setProgress({ phase: '', done: 0, total: 0 });
    }
  };

  // Lista de perfiles generados masivamente existentes en Firestore
  const bulkUsers = useMemo(
    () => users.filter((u) => u?.createdByAdminBulk === true),
    [users]
  );

  const filteredBulkUsers = useMemo(() => {
    if (bulkCountryFilter === 'ALL') return bulkUsers;
    return bulkUsers.filter((u) => u?.country?.code === bulkCountryFilter);
  }, [bulkUsers, bulkCountryFilter]);

  const handleDeleteSingleBulk = async (uid, name) => {
    if (deletingBulk || !uid) return;
    setDeletingBulk(true);
    try {
      await deleteAdminBulkProfiles({ uids: [uid] });
      onSuccess?.(`Perfil "${name || uid}" eliminado.`);
    } catch (err) {
      onError?.(err?.message || 'No se pudo eliminar ese perfil.');
    } finally {
      setDeletingBulk(false);
    }
  };

  const handleDeleteAllBulk = async () => {
    if (deletingBulk) return;
    setDeletingBulk(true);
    try {
      const res = await deleteAdminBulkProfiles({ mode: 'all_bulk' });
      setConfirmDeleteAll(false);
      onSuccess?.(`Se eliminaron ${res?.deletedCount || 0} perfiles generados masivamente.`);
    } catch (err) {
      onError?.(err?.message || 'No se pudieron eliminar los perfiles masivos.');
    } finally {
      setDeletingBulk(false);
    }
  };

  const handleToggleGlobalBulkVisibility = async () => {
    if (savingToggleKey || !userProfile?.uid) return;
    const nextVal = !showBulkProfiles;
    setSavingToggleKey('visibility');
    try {
      await updateAdminBulkSettings({
        adminId: userProfile.uid,
        showAdminBulkProfiles: nextVal,
      });
      onSuccess?.(
        nextVal
          ? 'Perfiles masivos HABILITADOS en Descubrir y Explorar.'
          : 'Perfiles masivos INHABILITADOS en Descubrir y Explorar (se mantienen visibles en Chats y Mis Matches).'
      );
    } catch (err) {
      onError?.(err?.message || 'No se pudo cambiar la visibilidad global.');
    } finally {
      setSavingToggleKey(null);
    }
  };

  const handleToggleAutoLikes = async () => {
    if (savingToggleKey || !userProfile?.uid) return;
    const nextVal = !enableAutoLikes;
    setSavingToggleKey('autolikes');
    try {
      await updateAdminBulkSettings({
        adminId: userProfile.uid,
        enableBulkAutoLikes: nextVal,
      });
      onSuccess?.(
        nextVal
          ? 'Auto-Likes de bienvenida ACTIVADOS (máx. 2 Likes a nuevos registros).'
          : 'Auto-Likes de bienvenida PAUSADOS.'
      );
    } catch (err) {
      onError?.(err?.message || 'No se pudo actualizar los auto-likes.');
    } finally {
      setSavingToggleKey(null);
    }
  };

  const handleToggleSingleBulkVisibility = async (user) => {
    if (!user?.uid || togglingBulkUid || deletingBulk) return;
    const nextHidden = !user.isBulkHidden;
    setTogglingBulkUid(user.uid);
    try {
      await setAdminBulkProfileVisibility({
        uids: [user.uid],
        hidden: nextHidden,
      });
      onSuccess?.(
        nextHidden
          ? `Perfil "${user.name || 'Usuario'}" ocultado de Descubrir y Explorar.`
          : `Perfil "${user.name || 'Usuario'}" visible nuevamente en Descubrir y Explorar.`
      );
    } catch (err) {
      onError?.(err?.message || 'No se pudo actualizar la visibilidad del perfil.');
    } finally {
      setTogglingBulkUid(null);
    }
  };

  const pendingCount = queue.filter((it) => it.status !== 'saved').length;
  const displayedQueue = showAllQueue ? queue : queue.slice(0, 24);

  return (
    <div className="space-y-6">
      {/* Cabecera / Banner Hero */}
      <section className="rounded-[28px] bg-gradient-to-br from-[#231B16] via-[#34261E] to-[#1D1510] border border-[#5B4535] p-5 sm:p-6 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/15 border border-amber-300/30 text-amber-300 text-[10px] font-black uppercase tracking-[0.14em]">
              <Sparkles className="w-3 h-3" /> Generador Masivo Inteligente
            </span>
            <h2 className="font-display text-xl sm:text-2xl font-black tracking-tight">
              Crear perfiles desde 100+ fotos de golpe
            </h2>
            <p className="text-xs sm:text-sm text-amber-100/80 max-w-2xl leading-relaxed">
              Arrastra o selecciona decenas de fotos a la vez. El sistema asignará automáticamente nombre realista, edad, país, ciudad con coordenadas, descripción, intereses y frases personales para cada foto.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="px-3.5 py-2 rounded-2xl bg-white/10 border border-white/15 text-center">
              <p className="text-[10px] text-amber-200/80 font-bold uppercase">En cola</p>
              <p className="text-lg font-black tabular-nums">{pendingCount}</p>
            </div>
            <div className="px-3.5 py-2 rounded-2xl bg-white/10 border border-white/15 text-center">
              <p className="text-[10px] text-amber-200/80 font-bold uppercase">Creados hoy/total</p>
              <p className="text-lg font-black tabular-nums">{bulkUsers.length}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Control maestro en vivo: Habilitar/Inhabilitar visibilidad + Auto-Likes de bienvenida */}
      <section className="rounded-[26px] bg-[#FFFDF9] border border-[#E8DEC8] p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Power className="w-4 h-4 text-[#FF2E54]" />
          <h3 className="font-display text-sm sm:text-base font-black text-[#2C241E]">
            Control en vivo de visibilidad y Auto-Likes
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div className="rounded-2xl border border-[#EAE0CA] bg-[#FBF7EE] p-4 flex items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-black text-[#2C241E]">
                  Mostrar perfiles en Descubrir y Explorar
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    showBulkProfiles
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-zinc-200 text-zinc-700'
                  }`}
                >
                  {showBulkProfiles ? 'Habilitado' : 'Inhabilitado'}
                </span>
              </div>
              <p className="text-[11px] text-[#7D6C5B] leading-relaxed">
                Si lo inhabilitas, dejan de mostrarse en Descubrir y Explorar de inmediato, pero siguen apareciendo en Chats y Mis Matches ya existentes.
              </p>
            </div>
            <button
              type="button"
              disabled={savingToggleKey === 'visibility'}
              onClick={handleToggleGlobalBulkVisibility}
              aria-label="Habilitar o inhabilitar perfiles en Descubrir y Explorar"
              className={`shrink-0 w-12 h-7 rounded-full p-1 transition flex items-center ${
                showBulkProfiles ? 'bg-emerald-500 justify-end' : 'bg-zinc-300 justify-start'
              } disabled:opacity-60`}
            >
              <span className="w-5 h-5 rounded-full bg-white shadow flex items-center justify-center">
                {savingToggleKey === 'visibility' && (
                  <Loader2 className="w-3 h-3 animate-spin text-zinc-600" />
                )}
              </span>
            </button>
          </div>

          <div className="rounded-2xl border border-[#EAE0CA] bg-[#FBF7EE] p-4 flex items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-black text-[#2C241E] flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5 text-[#FF2E54] fill-[#FF2E54]" />
                  Auto-Likes a usuarios nuevos
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    enableAutoLikes
                      ? 'bg-rose-100 text-[#FF2E54]'
                      : 'bg-zinc-200 text-zinc-700'
                  }`}
                >
                  {enableAutoLikes ? 'Activo' : 'Pausado'}
                </span>
              </div>
              <p className="text-[11px] text-[#7D6C5B] leading-relaxed">
                Al registrarse un usuario nuevo, recibe automáticamente máximo 2 Likes en su foto principal: 1.º entre min 5–10 y 2.º entre min 15–30.
              </p>
            </div>
            <button
              type="button"
              disabled={savingToggleKey === 'autolikes'}
              onClick={handleToggleAutoLikes}
              aria-label="Activar o pausar Auto-Likes de bienvenida"
              className={`shrink-0 w-12 h-7 rounded-full p-1 transition flex items-center ${
                enableAutoLikes ? 'bg-[#FF2E54] justify-end' : 'bg-zinc-300 justify-start'
              } disabled:opacity-60`}
            >
              <span className="w-5 h-5 rounded-full bg-white shadow flex items-center justify-center">
                {savingToggleKey === 'autolikes' && (
                  <Loader2 className="w-3 h-3 animate-spin text-zinc-600" />
                )}
              </span>
            </button>
          </div>
        </div>
      </section>

      {lastCreatedCount > 0 && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3 text-emerald-900 shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-xs sm:text-sm font-bold">
            Se publicaron <strong>{lastCreatedCount} perfiles</strong> nuevos exitosamente en Firestore y ya son visibles para todos los usuarios.
          </p>
        </div>
      )}

      {/* Parámetros aleatorios para el lote */}
      <section className="rounded-[26px] bg-[#FFFDF9] border border-[#E8DEC8] p-5 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-[#FF2E54]" />
            <h3 className="font-display text-sm sm:text-base font-black text-[#2C241E]">
              1. Reglas de generación automática por país
            </h3>
          </div>
          {queue.length > 0 && (
            <button
              type="button"
              disabled={publishing}
              onClick={handleRegenerateAllDrafts}
              className="px-3.5 py-1.5 rounded-full bg-[#F7F1E5] hover:bg-[#EFE5D1] border border-[#E2D5BE] text-[#3B2E24] text-xs font-extrabold flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Regenerar datos de la cola ({queue.length})
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <label className="space-y-1 text-xs font-bold text-[#5C4E41]">
            <span>País destino</span>
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              disabled={publishing}
              className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#E2D5BE] text-[#2C241E] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-300"
            >
              <option value="RANDOM">🌎 Aleatorio (Multi-país)</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-xs font-bold text-[#5C4E41]">
            <span>Género de las fotos</span>
            <select
              value={genderMode}
              onChange={(e) => setGenderMode(e.target.value)}
              disabled={publishing}
              className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#E2D5BE] text-[#2C241E] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-300"
            >
              <option value="Mujer">Mujeres</option>
              <option value="Hombre">Hombres</option>
              <option value="Mixto">Mixto (Aleatorio)</option>
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-xs font-bold text-[#5C4E41]">
              <span>Edad mínima</span>
              <input
                type="number"
                min={MIN_AGE}
                max={60}
                value={minAge}
                disabled={publishing}
                onChange={(e) => setMinAge(Math.max(MIN_AGE, Math.min(60, Number(e.target.value) || MIN_AGE)))}
                className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#E2D5BE] text-[#2C241E] text-xs font-semibold"
              />
            </label>
            <label className="space-y-1 text-xs font-bold text-[#5C4E41]">
              <span>Edad máxima</span>
              <input
                type="number"
                min={MIN_AGE}
                max={65}
                value={maxAge}
                disabled={publishing}
                onChange={(e) => setMaxAge(Math.max(MIN_AGE, Math.min(65, Number(e.target.value) || 34)))}
                className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#E2D5BE] text-[#2C241E] text-xs font-semibold"
              />
            </label>
          </div>

          <label className="space-y-1 text-xs font-bold text-[#5C4E41]">
            <span>Intención / ¿Qué buscan?</span>
            <select
              value={lookingFor}
              onChange={(e) => setLookingFor(e.target.value)}
              disabled={publishing}
              className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#E2D5BE] text-[#2C241E] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-300"
            >
              <option value="RANDOM">🎲 Aleatoria</option>
              {LOOKING_FOR_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
          <label className="p-3 rounded-2xl bg-[#FBF7EE] border border-[#EAE0CA] space-y-1.5 text-xs font-bold text-[#5C4E41]">
            <div className="flex items-center justify-between">
              <span>% con Check Azul</span>
              <span className="text-sky-700 font-black">{verifiedRatio}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={verifiedRatio}
              disabled={publishing}
              onChange={(e) => setVerifiedRatio(Number(e.target.value))}
              className="w-full accent-sky-600"
            />
          </label>

          <label className="p-3 rounded-2xl bg-[#FBF7EE] border border-[#EAE0CA] space-y-1.5 text-xs font-bold text-[#5C4E41]">
            <div className="flex items-center justify-between">
              <span>% Estado En Línea</span>
              <span className="text-emerald-700 font-black">{onlineRatio}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={onlineRatio}
              disabled={publishing}
              onChange={(e) => setOnlineRatio(Number(e.target.value))}
              className="w-full accent-emerald-600"
            />
          </label>

          <div className="p-3 rounded-2xl bg-[#FBF7EE] border border-[#EAE0CA] flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[#2C241E]">Permitir Mensajes VIP (💎)</p>
              <p className="text-[10px] text-[#7D6C5B]">Activa mensajes pagados sin match</p>
            </div>
            <div className="flex items-center gap-2">
              {allowPaidMessages && (
                <input
                  type="number"
                  min={5}
                  max={500}
                  value={messagePriceDiamonds}
                  disabled={publishing}
                  onChange={(e) => setMessagePriceDiamonds(Number(e.target.value) || 25)}
                  className="w-16 px-2 py-1 rounded-lg bg-white border border-[#E2D5BE] text-xs font-bold text-center"
                />
              )}
              <button
                type="button"
                disabled={publishing}
                onClick={() => setAllowPaidMessages((p) => !p)}
                className={`w-11 h-6 rounded-full p-0.5 transition ${
                  allowPaidMessages ? 'bg-[#FF2E54]' : 'bg-zinc-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    allowPaidMessages ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Dropzone multi-foto */}
      <section className="rounded-[26px] bg-[#FFFDF9] border border-[#E8DEC8] p-5 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ImagePlus className="w-4 h-4 text-[#FF2E54]" />
            <h3 className="font-display text-sm sm:text-base font-black text-[#2C241E]">
              2. Selecciona o arrastra tus fotos (ej. 50 o 100+ a la vez)
            </h3>
          </div>
          {queue.length > 0 && (
            <button
              type="button"
              disabled={publishing}
              onClick={handleClearQueue}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 disabled:opacity-50"
            >
              Limpiar cola
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) {
              handleFilesAdded(e.target.files);
              e.target.value = '';
            }
          }}
        />

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (!publishing && e.dataTransfer?.files?.length) {
              handleFilesAdded(e.dataTransfer.files);
            }
          }}
          onClick={() => !publishing && fileInputRef.current?.click()}
          className={`rounded-3xl border-2 border-dashed p-7 text-center cursor-pointer transition ${
            isDragging
              ? 'border-[#FF2E54] bg-rose-50/70'
              : 'border-[#DFD1B4] bg-[#FBF7EE] hover:border-[#FF2E54]/60 hover:bg-rose-50/30'
          }`}
        >
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#FF2E54] to-amber-500 text-white flex items-center justify-center shadow-md mb-3">
            <UploadCloud className="w-7 h-7" />
          </div>
          <p className="font-display text-sm sm:text-base font-black text-[#2C241E]">
            Toca aquí o arrastra 1, 20 o 100+ fotos de golpe
          </p>
          <p className="text-xs text-[#7D6C5B] mt-1">
            Cada foto creará 1 perfil completo automáticamente con nombre, edad, ciudad, país y descripción aleatoria.
          </p>
        </div>

        {/* Barra de progreso */}
        {publishing && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-amber-900">
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#FF2E54]" />
                {progress.phase === 'uploading'
                  ? `Subiendo fotos comprimidas a la nube (${progress.done}/${progress.total})...`
                  : `Creando perfiles en Firestore (${progress.done}/${progress.total})...`}
              </span>
              <span className="tabular-nums">
                {progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-amber-200/70 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#FF2E54] to-amber-500 transition-all duration-200"
                style={{
                  width: `${
                    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0
                  }%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Previsualización de la cola */}
        {queue.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <p className="text-xs font-bold text-[#5C4E41]">
                Mostrando {displayedQueue.length} de {queue.length} perfiles listos para crear
              </p>
              <button
                type="button"
                disabled={publishing || pendingCount === 0}
                onClick={handlePublishBatch}
                className="px-5 py-3 rounded-full bg-gradient-to-r from-[#FF2E54] via-rose-500 to-amber-500 text-white text-xs sm:text-sm font-black shadow-lg hover:brightness-105 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 transition"
              >
                {publishing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Publicando lote...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Crear {pendingCount} perfiles automáticamente
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {displayedQueue.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-2xl border p-2.5 bg-white flex flex-col gap-2 shadow-sm ${
                    item.status === 'error' ? 'border-red-300 bg-red-50/40' : 'border-[#E8DEC8]'
                  }`}
                >
                  <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-zinc-100">
                    <img
                      src={item.previewUrl}
                      alt={item.draft.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2 flex items-center gap-1">
                      <span className="px-2 py-0.5 rounded-full bg-black/65 text-white text-[10px] font-bold">
                        {item.draft.country?.flag} {item.draft.country?.code}
                      </span>
                      {item.draft.isVerified && (
                        <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center shadow">
                          <BadgeCheck className="w-3.5 h-3.5 text-sky-500 fill-sky-500 stroke-white" />
                        </span>
                      )}
                    </div>
                    {!publishing && (
                      <div className="absolute top-2 right-2 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleRerollSingle(item.id)}
                          title="Generar otros datos aleatorios"
                          className="w-7 h-7 rounded-full bg-black/65 hover:bg-black/85 text-white flex items-center justify-center transition"
                        >
                          <Shuffle className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditor(item)}
                          title="Editar nombre / país / bio"
                          className="w-7 h-7 rounded-full bg-black/65 hover:bg-black/85 text-white flex items-center justify-center transition"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          title="Quitar foto"
                          className="w-7 h-7 rounded-full bg-rose-600/85 hover:bg-rose-700 text-white flex items-center justify-center transition"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 px-0.5">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-black text-zinc-900 truncate">
                        {item.draft.name}, {item.draft.age}
                      </p>
                      <span className="text-[10px] font-bold text-[#7D6C5B] shrink-0">
                        {item.draft.gender}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3 shrink-0 text-rose-500" />
                      {item.draft.city}, {item.draft.country?.name}
                    </p>
                    <p className="text-[11px] text-zinc-600 line-clamp-2 leading-snug">
                      {item.draft.bio}
                    </p>
                    {item.error && (
                      <p className="text-[10px] font-bold text-red-600">{item.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {queue.length > 24 && (
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setShowAllQueue((prev) => !prev)}
                  className="px-4 py-2 rounded-full bg-[#F7F1E5] hover:bg-[#EFE5D1] border border-[#E2D5BE] text-xs font-bold text-[#3B2E24] transition"
                >
                  {showAllQueue
                    ? 'Ver menos tarjetas'
                    : `Mostrar todos los ${queue.length} perfiles en cola`}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Inventario de perfiles creados masivamente */}
      <section className="rounded-[26px] bg-[#FFFDF9] border border-[#E8DEC8] p-5 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#FF2E54]" />
            <div>
              <h3 className="font-display text-sm sm:text-base font-black text-[#2C241E]">
                Perfiles creados masivamente ({bulkUsers.length})
              </h3>
              <p className="text-[11px] text-[#7D6C5B]">
                Solo lista los generados por este cargador. Nunca afecta cuentas reales de usuarios.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={bulkCountryFilter}
              onChange={(e) => setBulkCountryFilter(e.target.value)}
              className="px-3 py-1.5 rounded-full bg-white border border-[#E2D5BE] text-xs font-bold text-[#2C241E]"
            >
              <option value="ALL">Todos los países ({bulkUsers.length})</option>
              {COUNTRIES.map((c) => {
                const count = bulkUsers.filter((u) => u?.country?.code === c.code).length;
                if (count === 0) return null;
                return (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name} ({count})
                  </option>
                );
              })}
            </select>

            {bulkUsers.length > 0 && (
              <button
                type="button"
                disabled={deletingBulk}
                onClick={() => setConfirmDeleteAll(true)}
                className="px-3.5 py-1.5 rounded-full bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-extrabold flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar todos los generados
              </button>
            )}
          </div>
        </div>

        {filteredBulkUsers.length === 0 ? (
          <div className="p-6 rounded-2xl bg-[#FBF7EE] border border-[#EAE0CA] text-center text-xs text-[#7D6C5B]">
            Aún no hay perfiles generados masivamente en este filtro.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
            {filteredBulkUsers.slice(0, 36).map((u) => (
              <div
                key={u.uid}
                className="relative rounded-2xl overflow-hidden border border-[#E8DEC8] bg-white shadow-sm group"
              >
                <div className="aspect-[3/4] bg-zinc-200 relative">
                  <img
                    src={u.photos?.[0]}
                    alt={u.name}
                    loading="lazy"
                    className={`w-full h-full object-cover ${u.isBulkHidden ? 'opacity-50 grayscale-[40%]' : ''}`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1">
                    <button
                      type="button"
                      disabled={togglingBulkUid === u.uid || deletingBulk}
                      onClick={() => handleToggleSingleBulkVisibility(u)}
                      title={u.isBulkHidden ? 'Mostrar en Descubrir/Explorar' : 'Ocultar de Descubrir/Explorar'}
                      className={`px-2 py-0.5 rounded-full text-[9px] font-black flex items-center gap-1 transition ${
                        u.isBulkHidden
                          ? 'bg-zinc-900/90 text-amber-300 border border-amber-300/40'
                          : 'bg-black/60 hover:bg-black/80 text-white'
                      }`}
                    >
                      {togglingBulkUid === u.uid ? (
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      ) : u.isBulkHidden ? (
                        <EyeOff className="w-2.5 h-2.5" />
                      ) : (
                        <Eye className="w-2.5 h-2.5" />
                      )}
                      {u.isBulkHidden ? 'Oculto' : 'Visible'}
                    </button>
                    <button
                      type="button"
                      disabled={deletingBulk || togglingBulkUid === u.uid}
                      onClick={() => handleDeleteSingleBulk(u.uid, u.name)}
                      title="Eliminar este perfil generado"
                      className="w-6 h-6 rounded-full bg-black/60 hover:bg-rose-600 text-white flex items-center justify-center transition"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="absolute bottom-1.5 inset-x-2 text-white">
                    <p className="text-[11px] font-black truncate">
                      {u.name}, {u.age}
                    </p>
                    <p className="text-[10px] text-white/80 truncate">
                      {u.country?.flag} {u.city || u.country?.name}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modal edición individual en cola */}
      {editDraft && (
        <div
          onClick={() => setEditingItemId(null)}
          className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-display text-base font-black text-zinc-900">
                Editar perfil antes de publicar
              </h4>
              <button
                type="button"
                onClick={() => setEditingItemId(null)}
                className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <label className="space-y-1 font-bold text-zinc-700">
                <span>Nombre</span>
                <input
                  type="text"
                  value={editDraft.name}
                  onChange={(e) => setEditDraft((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 font-semibold"
                />
              </label>
              <label className="space-y-1 font-bold text-zinc-700">
                <span>Edad</span>
                <input
                  type="number"
                  min={MIN_AGE}
                  max={75}
                  value={editDraft.age}
                  onChange={(e) => setEditDraft((p) => ({ ...p, age: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 font-semibold"
                />
              </label>
              <label className="space-y-1 font-bold text-zinc-700">
                <span>País</span>
                <select
                  value={editDraft.countryCode}
                  onChange={(e) => setEditDraft((p) => ({ ...p, countryCode: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 font-semibold"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 font-bold text-zinc-700">
                <span>Ciudad</span>
                <input
                  type="text"
                  value={editDraft.city}
                  onChange={(e) => setEditDraft((p) => ({ ...p, city: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 font-semibold"
                />
              </label>
              <label className="space-y-1 font-bold text-zinc-700">
                <span>Género</span>
                <select
                  value={editDraft.gender}
                  onChange={(e) => setEditDraft((p) => ({ ...p, gender: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 font-semibold"
                >
                  <option value="Mujer">Mujer</option>
                  <option value="Hombre">Hombre</option>
                </select>
              </label>
              <label className="space-y-1 font-bold text-zinc-700">
                <span>¿Qué busca?</span>
                <select
                  value={editDraft.lookingFor}
                  onChange={(e) => setEditDraft((p) => ({ ...p, lookingFor: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 font-semibold"
                >
                  {LOOKING_FOR_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block space-y-1 text-xs font-bold text-zinc-700">
              <span>Descripción (Bio)</span>
              <textarea
                rows={3}
                value={editDraft.bio}
                onChange={(e) => setEditDraft((p) => ({ ...p, bio: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs font-medium"
              />
            </label>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditingItemId(null)}
                className="px-4 py-2 rounded-full bg-zinc-100 text-zinc-700 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveEditor}
                className="px-5 py-2 rounded-full bg-[#FF2E54] text-white text-xs font-black"
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminación masiva */}
      {confirmDeleteAll && (
        <div
          onClick={() => !deletingBulk && setConfirmDeleteAll(false)}
          className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4"
          >
            <h4 className="font-display text-base font-black text-zinc-900">
              ¿Eliminar los {bulkUsers.length} perfiles generados?
            </h4>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Esta acción borrará únicamente los perfiles creados con este cargador masivo (`createdByAdminBulk`). Todas las cuentas reales de usuarios permanecerán intactas.
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={deletingBulk}
                onClick={() => setConfirmDeleteAll(false)}
                className="py-2.5 rounded-full bg-zinc-100 text-zinc-800 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingBulk}
                onClick={handleDeleteAllBulk}
                className="py-2.5 rounded-full bg-rose-600 text-white text-xs font-black flex items-center justify-center gap-1.5"
              >
                {deletingBulk ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
