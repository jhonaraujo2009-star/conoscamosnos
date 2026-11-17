import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Coins,
  Eye,
  EyeOff,
  Flame,
  Gem,
  GraduationCap,
  Heart,
  Home,
  Loader2,
  LogOut,
  MapPin,
  Plus,
  Ruler,
  Save,
  Settings,
  ShieldCheck,
  Sparkles,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import {
  COUNTRIES,
  GENDERS,
  INTERESTED_IN_OPTIONS,
  INTERESTS_CATALOG,
  LIFESTYLE_OPTIONS,
  LOOKING_FOR_OPTIONS,
  MAX_PHOTOS,
  MIN_AGE,
} from '../../config/constants';
import { logoutUser } from '../../services/authService';
import { getUserCloudinaryFolder, uploadImageToCloudinary } from '../../services/cloudinaryService';
import { subscribeUserReports, updateUserProfile } from '../../services/userService';
import {
  calculateProfileCompletion,
  getPrimaryPhoto,
  isBoostActive,
  isProfileVerified,
  optimizeCloudinaryUrl,
} from '../../utils/formatters';
import PhotoUploader from './PhotoUploader';

const PROMPT_SUGGESTIONS = [
  'Mi domingo perfecto incluye un buen café y...',
  'Algo que pocos saben de mí es que...',
  'Lo que más valoro en una conexión real es...',
  'Mi destino soñado para viajar juntos es...',
];

function PrivacyToggleRow({ icon: Icon, title, description, checked, busy, onToggle, accent }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-zinc-100 last:border-b-0">
      <div className="flex items-start gap-2.5 min-w-0">
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
            checked ? accent || 'bg-rose-50 text-[#FF2E54]' : 'bg-zinc-100 text-zinc-500'
          }`}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-zinc-900">{title}</p>
          <p className="text-[11px] text-zinc-500 leading-snug mt-0.5">{description}</p>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={Boolean(checked)}
        disabled={busy}
        onClick={onToggle}
        className={`relative w-11 h-6 rounded-full shrink-0 transition-colors duration-200 ${
          checked ? 'bg-[#FF2E54]' : 'bg-zinc-300'
        } disabled:opacity-50`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

function VisibilitySettingsBlock({
  userProfile,
  busySetting,
  onToggleSetting,
  locatingGps,
  onUpdateApproxGps,
  onClearApproxGps,
}) {
  const isDiscoverable = userProfile?.discoverable !== false;
  return (
    <div className="space-y-1">
      <PrivacyToggleRow
        icon={Wand2}
        title="Smart Photos"
        description="Prueba y destaca automáticamente la foto que recibe más Likes para conseguir más matches."
        checked={Boolean(userProfile?.smartPhotos)}
        busy={busySetting === 'smartPhotos'}
        accent="bg-amber-50 text-amber-600"
        onToggle={() => onToggleSetting('smartPhotos', !userProfile?.smartPhotos)}
      />
      <PrivacyToggleRow
        icon={EyeOff}
        title="Ocultar mi edad"
        description="Tu edad numérica no aparecerá en tarjetas, Explorar, Likes ni chats."
        checked={Boolean(userProfile?.hideAge)}
        busy={busySetting === 'hideAge'}
        onToggle={() => onToggleSetting('hideAge', !userProfile?.hideAge)}
      />
      <PrivacyToggleRow
        icon={MapPin}
        title="Ocultar mi distancia"
        description="Oculta los kilómetros y tu ciudad exacta en tu perfil público."
        checked={Boolean(userProfile?.hideDistance)}
        busy={busySetting === 'hideDistance'}
        onToggle={() => onToggleSetting('hideDistance', !userProfile?.hideDistance)}
      />
      <PrivacyToggleRow
        icon={ShieldCheck}
        title="Ocultar estado en línea"
        description="No muestra el punto verde ni la hora de tu última conexión."
        checked={Boolean(userProfile?.hideOnlineStatus)}
        busy={busySetting === 'hideOnlineStatus'}
        onToggle={() => onToggleSetting('hideOnlineStatus', !userProfile?.hideOnlineStatus)}
      />
      <PrivacyToggleRow
        icon={Eye}
        title="Mostrarme en Descubrir (Swipe y Explorar)"
        description="Desactívalo si deseas pausar tu perfil temporalmente sin perder tus chats."
        checked={isDiscoverable}
        busy={busySetting === 'discoverable'}
        accent="bg-emerald-50 text-emerald-600"
        onToggle={() => onToggleSetting('discoverable', !isDiscoverable)}
      />

      <div className="pt-2.5 flex items-center justify-between gap-2 border-t border-zinc-100">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold text-zinc-800">Distancia aproximada (GPS)</p>
          <p className="text-[10px] text-zinc-500">
            {userProfile?.approxGeo
              ? 'Coordenadas aproximadas (~1 km) activas para distancia real'
              : 'Usa tu ciudad/país como referencia o activa GPS aproximado'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {userProfile?.approxGeo && (
            <button
              type="button"
              disabled={locatingGps}
              onClick={onClearApproxGps}
              className="px-2.5 py-1.5 rounded-full bg-zinc-100 text-zinc-700 text-[11px] font-bold hover:bg-zinc-200"
            >
              Quitar
            </button>
          )}
          <button
            type="button"
            disabled={locatingGps}
            onClick={onUpdateApproxGps}
            className="px-3 py-1.5 rounded-full bg-zinc-900 text-white text-[11px] font-extrabold hover:bg-zinc-800 disabled:opacity-50"
          >
            {locatingGps ? 'Ubicando...' : userProfile?.approxGeo ? 'Actualizar' : 'Activar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProfileScreen({
  userProfile,
  receivedLikes = [],
  onPreviewOwnProfile,
  onOpenCoinStore,
  onOpenWithdrawals,
  onOpenBoost,
  onOpenSafetyCenter,
  onOpenAdmin,
  onSuccess,
  onError,
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [myReportsCount, setMyReportsCount] = useState(0);
  const [busySetting, setBusySetting] = useState('');
  const [locatingGps, setLocatingGps] = useState(false);
  const [promptSheetIdx, setPromptSheetIdx] = useState(null);
  const [promptDraft, setPromptDraft] = useState('');
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingQuickPhoto, setUploadingQuickPhoto] = useState(false);
  const quickFileInputRef = useRef(null);

  const [name, setName] = useState(userProfile?.name || '');
  const [age, setAge] = useState(userProfile?.age || 18);
  const [gender, setGender] = useState(userProfile?.gender || GENDERS[0]);
  const [interestedIn, setInterestedIn] = useState(userProfile?.interestedIn || 'Todos');
  const [countryCode, setCountryCode] = useState(userProfile?.country?.code || COUNTRIES[0].code);
  const [city, setCity] = useState(userProfile?.city || '');
  const [lookingFor, setLookingFor] = useState(userProfile?.lookingFor || LOOKING_FOR_OPTIONS[0]);
  const [bio, setBio] = useState(userProfile?.bio || '');
  const [height, setHeight] = useState(userProfile?.height || '');
  const [job, setJob] = useState(userProfile?.job || '');
  const [education, setEducation] = useState(userProfile?.education || '');
  const [lifestyle, setLifestyle] = useState(userProfile?.lifestyle || '');
  const [interests, setInterests] = useState(userProfile?.interests || []);
  const [photos, setPhotos] = useState(userProfile?.photos || []);
  const [prompts, setPrompts] = useState(userProfile?.prompts || ['', '']);

  useEffect(() => {
    if (!userProfile?.uid) return;
    setName(userProfile.name || '');
    setAge(userProfile.age || 18);
    setGender(userProfile.gender || GENDERS[0]);
    setInterestedIn(userProfile.interestedIn || 'Todos');
    setCountryCode(userProfile.country?.code || COUNTRIES[0].code);
    setCity(userProfile.city || '');
    setLookingFor(userProfile.lookingFor || LOOKING_FOR_OPTIONS[0]);
    setBio(userProfile.bio || '');
    setHeight(userProfile.height || '');
    setJob(userProfile.job || '');
    setEducation(userProfile.education || '');
    setLifestyle(userProfile.lifestyle || '');
    setInterests(userProfile.interests || []);
    setPhotos(userProfile.photos || []);
    setPrompts(
      Array.isArray(userProfile.prompts) && userProfile.prompts.length >= 2
        ? userProfile.prompts.slice(0, 2)
        : [userProfile.prompts?.[0] || '', userProfile.prompts?.[1] || '']
    );
  }, [userProfile?.uid, editorOpen]);

  // Calcular rendimiento real de cada foto según Likes recibidos
  const { photoLikeCounts, bestPhotoUrl } = useMemo(() => {
    const counts = {};
    const uploaded = Array.isArray(userProfile?.photos) ? userProfile.photos.filter(Boolean) : [];
    receivedLikes.forEach((like) => {
      if (like.likedPhotoUrl && uploaded.includes(like.likedPhotoUrl)) {
        counts[like.likedPhotoUrl] = (counts[like.likedPhotoUrl] || 0) + 1;
      }
    });
    let topUrl = uploaded[0] || '';
    let maxLikes = -1;
    uploaded.forEach((url) => {
      const c = counts[url] || 0;
      if (c > maxLikes) {
        maxLikes = c;
        topUrl = url;
      }
    });
    return {
      photoLikeCounts: counts,
      bestPhotoUrl: maxLikes > 0 ? topUrl : '',
    };
  }, [receivedLikes, userProfile?.photos]);

  // Sincronizar automáticamente la mejor foto si Smart Photos está activado
  useEffect(() => {
    if (!userProfile?.uid || !userProfile?.smartPhotos) return;
    if (bestPhotoUrl && bestPhotoUrl !== userProfile?.smartBestPhotoUrl) {
      updateUserProfile(userProfile.uid, { smartBestPhotoUrl: bestPhotoUrl }).catch(() => {});
    }
  }, [userProfile?.uid, userProfile?.smartPhotos, bestPhotoUrl, userProfile?.smartBestPhotoUrl]);

  const handleToggleSetting = async (field, nextValue) => {
    if (!userProfile?.uid || busySetting) return;
    setBusySetting(field);
    try {
      const payload = { [field]: nextValue };
      if (field === 'smartPhotos' && nextValue && bestPhotoUrl) {
        payload.smartBestPhotoUrl = bestPhotoUrl;
      }
      await updateUserProfile(userProfile.uid, payload);
      const messages = {
        smartPhotos: nextValue ? 'Smart Photos activado.' : 'Smart Photos desactivado.',
        hideAge: nextValue ? 'Tu edad ahora está oculta.' : 'Tu edad ahora es visible.',
        hideDistance: nextValue ? 'Tu distancia y ciudad ahora están ocultas.' : 'Tu ubicación ahora es visible.',
        hideOnlineStatus: nextValue ? 'Estado en línea ocultado.' : 'Estado en línea visible.',
        discoverable: nextValue ? 'Tu perfil vuelve a mostrarse en Descubrir.' : 'Perfil pausado de Descubrir.',
      };
      onSuccess?.(messages[field] || 'Ajuste actualizado.');
    } catch (err) {
      onError?.(err.message || 'No se pudo actualizar el ajuste.');
    } finally {
      setBusySetting('');
    }
  };

  const handleUpdateApproxGps = () => {
    if (!navigator?.geolocation) {
      onError?.('Tu navegador no admite geolocalización.');
      return;
    }
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          // Redondear a 2 decimales (~1.1 km) para calcular distancia sin revelar ubicación exacta
          const approxGeo = {
            lat: Math.round(pos.coords.latitude * 100) / 100,
            lng: Math.round(pos.coords.longitude * 100) / 100,
          };
          await updateUserProfile(userProfile.uid, { approxGeo });
          onSuccess?.('Distancia aproximada actualizada con privacidad (~1 km).');
        } catch (err) {
          onError?.(err.message || 'No se pudo guardar tu ubicación aproximada.');
        } finally {
          setLocatingGps(false);
        }
      },
      () => {
        setLocatingGps(false);
        onError?.('No otorgaste permiso de ubicación.');
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const handleClearApproxGps = async () => {
    if (!userProfile?.uid) return;
    setLocatingGps(true);
    try {
      await updateUserProfile(userProfile.uid, { approxGeo: null });
      onSuccess?.('Coordenadas eliminadas. Ahora se usa solo tu ciudad/país.');
    } catch (err) {
      onError?.(err.message || 'No se pudo quitar la ubicación.');
    } finally {
      setLocatingGps(false);
    }
  };

  useEffect(() => {
    if (!userProfile?.uid) {
      setMyReportsCount(0);
      return;
    }
    const unsub = subscribeUserReports(
      userProfile.uid,
      (list) => setMyReportsCount(list.length),
      () => setMyReportsCount(0)
    );
    return () => unsub();
  }, [userProfile?.uid]);

  const handleQuickPhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const currentPhotos = Array.isArray(userProfile?.photos) ? userProfile.photos : [];
    if (currentPhotos.length >= MAX_PHOTOS) {
      onError?.(`Máximo ${MAX_PHOTOS} fotos permitidas.`);
      return;
    }

    setUploadingQuickPhoto(true);
    try {
      const { url } = await uploadImageToCloudinary(file, {
        folder: getUserCloudinaryFolder(userProfile, 'profiles'),
        tags: ['profile', `user_${userProfile.uid}`],
      });
      const updated = [...currentPhotos, url];
      setPhotos(updated);
      await updateUserProfile(userProfile.uid, { photos: updated });
      onSuccess?.('Foto agregada a tu perfil.');
    } catch (err) {
      onError?.(err.message || 'No se pudo subir la foto.');
    } finally {
      setUploadingQuickPhoto(false);
    }
  };

  const toggleInterest = (item) => {
    setInterests((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item].slice(0, 10)
    );
  };

  const openQuickPrompt = (slotIdx) => {
    const existing = userProfile?.prompts?.[slotIdx] || prompts[slotIdx] || '';
    setPromptDraft(existing);
    setPromptSheetIdx(slotIdx);
  };

  const handleSaveQuickPrompt = async (e) => {
    e.preventDefault();
    if (promptSheetIdx === null) return;
    setSavingPrompt(true);
    try {
      const nextPrompts = [
        userProfile?.prompts?.[0] ?? prompts[0] ?? '',
        userProfile?.prompts?.[1] ?? prompts[1] ?? '',
      ];
      nextPrompts[promptSheetIdx] = promptDraft.trim();
      setPrompts(nextPrompts);
      await updateUserProfile(userProfile.uid, { prompts: nextPrompts });
      setPromptSheetIdx(null);
      onSuccess?.('Frase guardada en tu perfil.');
    } catch (err) {
      onError?.(err.message || 'No se pudo guardar la frase.');
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const country = COUNTRIES.find((c) => c.code === countryCode) || COUNTRIES[0];
      await updateUserProfile(userProfile.uid, {
        name,
        age,
        gender,
        interestedIn,
        country,
        city,
        lookingFor,
        bio,
        height,
        job,
        education,
        lifestyle,
        interests,
        photos,
        prompts,
      });
      setEditorOpen(false);
      onSuccess?.('Perfil actualizado correctamente.');
    } catch (err) {
      onError?.(err.message || 'No se pudo actualizar tu perfil.');
    } finally {
      setSaving(false);
    }
  };

  const userPhotos = Array.isArray(userProfile?.photos) ? userProfile.photos.filter(Boolean) : [];
  const missingPhotosCount = Math.max(0, MAX_PHOTOS - userPhotos.length);
  const filledPromptsCount = Array.isArray(userProfile?.prompts)
    ? userProfile.prompts.filter((p) => typeof p === 'string' && p.trim().length > 0).length
    : 0;
  const missingPromptsCount = Math.max(0, 2 - filledPromptsCount);

  const boosted = isBoostActive(userProfile);
  const verified = isProfileVerified(userProfile);
  const completion = calculateProfileCompletion(userProfile);

  // Chips 100% dinámicos conectados a los campos reales del usuario
  const quickChips = [
    {
      label: userProfile?.city ? `${userProfile.country?.flag || '📍'} ${userProfile.city}` : 'Vivo en +',
      icon: Home,
      missing: !userProfile?.city?.trim(),
    },
    {
      label: userProfile?.height ? userProfile.height : 'Estatura +',
      icon: Ruler,
      missing: !userProfile?.height?.trim(),
    },
    {
      label: userProfile?.job ? userProfile.job : 'Empleo +',
      icon: Briefcase,
      missing: !userProfile?.job?.trim(),
    },
    {
      label: userProfile?.education ? userProfile.education : 'Educación +',
      icon: GraduationCap,
      missing: !userProfile?.education?.trim(),
    },
    {
      label: userProfile?.lifestyle ? userProfile.lifestyle : 'Estilo de vida +',
      icon: Sparkles,
      missing: !userProfile?.lifestyle?.trim(),
    },
    {
      label: userProfile?.lookingFor || 'Intención +',
      icon: Flame,
      missing: !userProfile?.lookingFor,
      highlight: Boolean(userProfile?.lookingFor),
    },
  ];

  return (
    <div className="min-h-full bg-[#F4F4F6] text-zinc-900 flex flex-col justify-between p-4 space-y-4">
      <div className="space-y-4 pt-safe">
        {/* 1. CABECERA DE USUARIO */}
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <img
              src={getPrimaryPhoto(userProfile, 200, { seed: userProfile?.uid })}
              alt={userProfile?.name}
              onClick={onPreviewOwnProfile}
              className="w-16 h-16 rounded-2xl object-cover bg-zinc-200 shrink-0 cursor-pointer shadow-sm"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-2xl font-extrabold text-zinc-900 truncate">
                  {userProfile?.name}
                  {userProfile?.age ? `, ${userProfile.age}` : ''}
                </h1>
                <BadgeCheck
                  className={`w-5 h-5 shrink-0 ${
                    verified
                      ? 'text-sky-500 fill-sky-500 stroke-white'
                      : 'text-zinc-400 fill-zinc-300 stroke-white'
                  }`}
                  title={verified ? 'Perfil Verificado' : 'Agrega foto y bio para verificar'}
                />
              </div>
              <button
                type="button"
                onClick={onPreviewOwnProfile}
                className="text-xs font-bold text-zinc-500 hover:text-zinc-900 flex items-center gap-0.5 mt-0.5"
              >
                <span>Vista previa (como te ven)</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              {(userProfile?.discoverable === false ||
                userProfile?.hideAge ||
                userProfile?.hideDistance ||
                userProfile?.hideOnlineStatus) && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {userProfile?.discoverable === false && (
                    <span className="px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-700 text-[10px] font-bold">
                      Pausado
                    </span>
                  )}
                  {userProfile?.hideAge && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-[#FF2E54] text-[10px] font-bold">
                      Edad oculta
                    </span>
                  )}
                  {userProfile?.hideDistance && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-[#FF2E54] text-[10px] font-bold">
                      Distancia oculta
                    </span>
                  )}
                  {userProfile?.hideOnlineStatus && (
                    <span className="px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-700 text-[10px] font-bold">
                      En línea oculto
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenWithdrawals}
              className="w-10 h-10 rounded-full bg-zinc-200/80 text-zinc-800 flex items-center justify-center hover:bg-zinc-300/80 transition"
              title="Mis Diamantes y Retiros USD"
            >
              <Gem className="w-5 h-5 text-sky-600" />
            </button>

            <button
              type="button"
              onClick={() => setEditorOpen(true)}
              className="w-10 h-10 rounded-full bg-zinc-200/80 text-zinc-800 flex items-center justify-center hover:bg-zinc-300/80 transition"
              title="Ajustes y Editar Perfil"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* 2. BARRA DINÁMICA DE COMPLETITUD DE PERFIL */}
        <button
          type="button"
          onClick={() => setEditorOpen(true)}
          className="w-full bg-white rounded-3xl px-4 py-3.5 shadow-sm hover:bg-zinc-50 transition text-left space-y-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {completion.percent < 100 ? (
                <span className="w-5 h-5 rounded-full bg-[#FF2E54] text-white text-xs font-black flex items-center justify-center">
                  !
                </span>
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              )}
              <span className="text-sm font-extrabold text-zinc-900">
                {completion.percent < 100
                  ? `Completa tu perfil (${completion.percent}%)`
                  : 'Perfil completo al 100%'}
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="w-full h-1.5 rounded-full bg-zinc-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                completion.percent === 100
                  ? 'bg-emerald-500'
                  : 'bg-gradient-to-r from-[#FF2E54] to-amber-400'
              }`}
              style={{ width: `${completion.percent}%` }}
            />
          </div>
        </button>

        {/* 3. CHIPS / PÍLDORAS DE ATRIBUTOS RÁPIDOS (100% REALES) */}
        <div className="flex flex-wrap gap-2">
          {quickChips.map((chip, idx) => {
            const Icon = chip.icon;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setEditorOpen(true)}
                className={`relative rounded-full px-3.5 py-2 text-xs font-bold inline-flex items-center gap-1.5 transition ${
                  chip.highlight
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-200/80 hover:bg-zinc-300/70 text-zinc-800'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${chip.highlight ? 'text-[#FF2E54]' : 'text-zinc-600'}`} />
                <span className="max-w-[140px] truncate">{chip.label}</span>
                {chip.missing && (
                  <span className="w-2 h-2 rounded-full bg-[#FF2E54] ml-0.5 shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* 4. SECCIÓN "MIS FOTOS" DINÁMICA */}
        <section className="space-y-2">
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-extrabold text-zinc-900">Mis fotos</h2>
              {missingPhotosCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#FF2E54] text-white text-[10px] font-black flex items-center justify-center">
                  !
                </span>
              )}
            </div>
            {missingPhotosCount > 0 ? (
              <p className="text-xs font-bold text-[#FF2E54]">
                Agrega {missingPhotosCount} {missingPhotosCount === 1 ? 'foto más' : 'fotos más'}
              </p>
            ) : (
              <p className="text-xs font-bold text-emerald-600">
                ✓ Galería completa ({userPhotos.length}/{MAX_PHOTOS})
              </p>
            )}
          </div>

          <div className="bg-white rounded-3xl p-4 shadow-sm space-y-3">
            <div className="grid grid-cols-6 gap-1 rounded-2xl overflow-hidden">
              {Array.from({ length: 6 }).map((_, idx) => {
                const url = userPhotos[idx];
                if (url) {
                  const likeCount = Number(photoLikeCounts[url] || 0);
                  const isTop = Boolean(userProfile?.smartPhotos && bestPhotoUrl === url);
                  return (
                    <div
                      key={idx}
                      onClick={() => setEditorOpen(true)}
                      className="aspect-[3/4] bg-zinc-100 relative cursor-pointer"
                    >
                      <img
                        src={optimizeCloudinaryUrl(url, 240)}
                        alt={`Foto ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {isTop && (
                        <span className="absolute top-1 left-1 px-1 py-0.5 rounded bg-gradient-to-r from-[#FF2E54] to-amber-500 text-[8px] font-black text-white leading-none shadow">
                          TOP
                        </span>
                      )}
                      {likeCount > 0 && (
                        <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/70 text-[8px] font-extrabold text-white leading-none">
                          ♥{likeCount}
                        </span>
                      )}
                    </div>
                  );
                }
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={uploadingQuickPhoto}
                    onClick={() => quickFileInputRef.current?.click()}
                    className="aspect-[3/4] bg-zinc-100 hover:bg-zinc-200/80 flex items-center justify-center text-zinc-500 transition"
                  >
                    {uploadingQuickPhoto && idx === userPhotos.length ? (
                      <Loader2 className="w-4 h-4 animate-spin text-zinc-700" />
                    ) : (
                      <Plus className="w-4 h-4 stroke-[2.5]" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3 pt-0.5">
              <p className="text-xs font-medium text-zinc-500 leading-snug">
                Recibe hasta el doble de Likes con 6 fotos.
              </p>
              <button
                type="button"
                onClick={() => setEditorOpen(true)}
                className="bg-zinc-900 text-white rounded-full px-5 py-2 text-xs font-bold shrink-0 active:scale-95 transition-transform"
              >
                Editar
              </button>
            </div>
          </div>

          <input
            ref={quickFileInputRef}
            type="file"
            accept="image/*"
            onChange={handleQuickPhotoUpload}
            className="hidden"
          />
        </section>

        {/* 5. SECCIÓN "MIS FRASES" DINÁMICA */}
        <section className="space-y-2">
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-extrabold text-zinc-900">Mis frases</h2>
              {missingPromptsCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#FF2E54] text-white text-[10px] font-black flex items-center justify-center">
                  !
                </span>
              )}
            </div>
            {missingPromptsCount > 0 ? (
              <p className="text-xs font-bold text-[#FF2E54]">
                Agregar {missingPromptsCount} {missingPromptsCount === 1 ? 'frase' : 'frases'}
              </p>
            ) : (
              <p className="text-xs font-bold text-emerald-600">✓ Tus 2 frases están activas</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[0, 1].map((slotIdx) => {
              const phraseText = userProfile?.prompts?.[slotIdx] || prompts[slotIdx];
              return (
                <button
                  key={slotIdx}
                  type="button"
                  onClick={() => openQuickPrompt(slotIdx)}
                  className="relative aspect-square bg-white rounded-3xl p-4 shadow-sm flex flex-col justify-between text-left hover:bg-zinc-50/80 transition"
                >
                  <span className="absolute -top-1.5 -right-1.5 w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center shadow-md">
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                  </span>

                  <p className="text-xs font-extrabold text-zinc-400 uppercase tracking-wide">
                    Frase {slotIdx + 1}
                  </p>

                  <p className="text-xs font-bold text-zinc-800 line-clamp-3">
                    {phraseText
                      ? `“${phraseText}”`
                      : slotIdx === 0
                      ? 'Mi plan ideal de fin de semana es...'
                      : 'Algo que debes saber sobre mí es...'}
                  </p>

                  <span className="text-[11px] font-semibold text-zinc-400">
                    {phraseText ? 'Editar frase' : 'Toca para responder'}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 5.5 SMART PHOTOS Y CONTROL DE VISIBILIDAD (INDEPENDIENTE POR USUARIO) */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-zinc-900">
              Smart Photos y Visibilidad
            </h2>
            {userProfile?.smartPhotos && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold">
                Smart activo
              </span>
            )}
          </div>
          <div className="bg-white rounded-3xl px-4 py-2 shadow-sm">
            <VisibilitySettingsBlock
              userProfile={userProfile}
              busySetting={busySetting}
              onToggleSetting={handleToggleSetting}
              locatingGps={locatingGps}
              onUpdateApproxGps={handleUpdateApproxGps}
              onClearApproxGps={handleClearApproxGps}
            />
          </div>
        </section>
      </div>

      {/* 6. BANNERS FLOTANTES DE MONETIZACIÓN (100% CONECTADOS A SALDOS REALES) */}
      <div className="space-y-2.5 pt-2">
        <button
          type="button"
          onClick={onOpenCoinStore}
          className="w-full bg-gradient-to-r from-amber-200 to-yellow-300 rounded-full px-5 py-3 shadow-sm flex items-center justify-between text-left active:scale-[0.99] transition-transform"
        >
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 fill-zinc-900 text-zinc-900" />
              <span className="text-sm font-black tracking-tight text-zinc-900">
                Conoscamosnos
              </span>
              <span className="px-1.5 py-0.5 rounded bg-amber-400/80 text-[9px] font-black text-zinc-900 uppercase">
                GOLD
              </span>
            </div>
            <p className="text-[11px] font-bold text-zinc-800 truncate mt-0.5">
              Descubre quién te dio Like. Y haz match más rápido.
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-zinc-900 shrink-0 stroke-[2.5]" />
        </button>

        <div className="bg-white rounded-full px-3 py-2.5 shadow-md grid grid-cols-3 divide-x divide-zinc-200 items-center text-center">
          <button
            type="button"
            onClick={onOpenCoinStore}
            className="flex items-center justify-center gap-1.5 px-1 py-0.5"
          >
            <Coins className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-[11px] font-extrabold text-zinc-800 truncate">
              {userProfile?.coins || 0} Monedas
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenBoost}
            className="flex items-center justify-center gap-1.5 px-1 py-0.5"
          >
            <Zap className="w-4 h-4 text-[#A855F7] fill-[#A855F7] shrink-0" />
            <span className="text-[11px] font-extrabold text-zinc-800 truncate">
              {boosted ? 'Boost Activo' : 'Boost VIP'}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenWithdrawals}
            className="flex items-center justify-center gap-1.5 px-1 py-0.5"
          >
            <Gem className="w-4 h-4 text-sky-500 shrink-0" />
            <span className="text-[11px] font-extrabold text-zinc-800 truncate">
              {userProfile?.earningsDiamonds || 0} 💎
            </span>
          </button>
        </div>

        {/* Acceso directo privado a Bloqueados y Reportes del usuario actual */}
        {onOpenSafetyCenter && (
          <button
            type="button"
            onClick={() => onOpenSafetyCenter('blocked')}
            className="w-full bg-white rounded-3xl px-4 py-3.5 shadow-sm hover:bg-zinc-50 transition flex items-center justify-between gap-3 text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 text-[#FF2E54] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-zinc-900">Bloqueados y Mis Reportes</p>
                <p className="text-[11px] font-semibold text-zinc-500 truncate">
                  {(userProfile?.blockedUsers || []).length} bloqueados · {myReportsCount}{' '}
                  {myReportsCount === 1 ? 'reporte enviado' : 'reportes enviados'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
          </button>
        )}

        {/* Botón directo para cambiar de perfil / cerrar sesión */}
        <button
          type="button"
          onClick={() => logoutUser(userProfile?.uid)}
          className="w-full py-3 rounded-full bg-white text-zinc-600 hover:text-[#FF2E54] text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition"
        >
          <LogOut className="w-3.5 h-3.5" />
          Cerrar sesión ({userProfile?.email})
        </button>
      </div>

      {/* Sheet rápido e intuitivo para editar "Mis frases" con ideas */}
      {promptSheetIdx !== null && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={handleSaveQuickPrompt}
            className="w-full max-w-md bg-white rounded-t-[32px] sm:rounded-[32px] p-6 space-y-4 shadow-2xl animate-sheet-up"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-extrabold text-zinc-900">
                Frase personal #{promptSheetIdx + 1}
              </h3>
              <button
                type="button"
                onClick={() => setPromptSheetIdx(null)}
                className="p-2 rounded-full bg-zinc-100 text-zinc-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              rows={3}
              maxLength={140}
              value={promptDraft}
              onChange={(e) => setPromptDraft(e.target.value)}
              placeholder="Escribe algo auténtico que llame la atención..."
              className="w-full px-4 py-3 rounded-2xl bg-zinc-100 text-sm font-semibold text-zinc-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900 resize-none"
            />

            <div className="space-y-1.5">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400">
                Ideas rápidas (toca para usar)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PROMPT_SUGGESTIONS.map((sugg, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPromptDraft(sugg)}
                    className="px-3 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[11px] font-bold text-left transition"
                  >
                    {sugg}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={savingPrompt}
              className="w-full py-3.5 rounded-full bg-zinc-900 text-white text-xs font-extrabold flex items-center justify-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              {savingPrompt ? 'Guardando...' : 'Guardar frase'}
            </button>
          </form>
        </div>
      )}

      {/* Modal Completo de Edición de Perfil, Atributos y Cuenta */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md max-h-[92dvh] bg-white rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-zinc-900">Editar Perfil y Ajustes</h3>
                <p className="text-[11px] font-semibold text-zinc-500">
                  Completado al {completion.percent}%
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="p-2 rounded-full bg-zinc-100 text-zinc-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Accesos rápidos a Monedas, Retiros y Admin */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setEditorOpen(false);
                    onOpenCoinStore?.();
                  }}
                  className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-left"
                >
                  <div className="flex items-center gap-1.5 text-amber-700 text-xs font-extrabold">
                    <Coins className="w-4 h-4" /> Monedas
                  </div>
                  <p className="text-lg font-black text-zinc-900 mt-1">{userProfile?.coins || 0}</p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditorOpen(false);
                    onOpenWithdrawals?.();
                  }}
                  className="p-3 rounded-2xl bg-sky-50 border border-sky-200 text-left"
                >
                  <div className="flex items-center gap-1.5 text-sky-700 text-xs font-extrabold">
                    <Gem className="w-4 h-4" /> Diamantes / Retiro
                  </div>
                  <p className="text-lg font-black text-zinc-900 mt-1">
                    {userProfile?.earningsDiamonds || 0} 💎
                  </p>
                </button>
              </div>

              {onOpenSafetyCenter && (
                <button
                  type="button"
                  onClick={() => {
                    setEditorOpen(false);
                    onOpenSafetyCenter('blocked');
                  }}
                  className="w-full py-3 px-4 rounded-2xl bg-rose-50 border border-rose-200 text-[#FF2E54] text-xs font-extrabold flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" /> Bloqueados y Mis Reportes
                  </span>
                  <span>Ver historial →</span>
                </button>
              )}

              {userProfile?.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => {
                    setEditorOpen(false);
                    onOpenAdmin?.();
                  }}
                  className="w-full py-3 px-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-extrabold flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" /> Panel Super Admin
                  </span>
                  <span>Abrir →</span>
                </button>
              )}

              <form onSubmit={handleSave} className="space-y-4">
                <PhotoUploader
                  photos={photos}
                  onChange={setPhotos}
                  onError={onError}
                  smartPhotos={Boolean(userProfile?.smartPhotos)}
                  photoLikeCounts={photoLikeCounts}
                  bestPhotoUrl={bestPhotoUrl}
                />

                <div className="p-4 rounded-2xl bg-[#F4F4F6] border border-zinc-200/80 space-y-2">
                  <p className="text-xs font-extrabold text-zinc-900">
                    Smart Photos y Visibilidad
                  </p>
                  <VisibilitySettingsBlock
                    userProfile={userProfile}
                    busySetting={busySetting}
                    onToggleSetting={handleToggleSetting}
                    locatingGps={locatingGps}
                    onUpdateApproxGps={handleUpdateApproxGps}
                    onClearApproxGps={handleClearApproxGps}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-zinc-600 block mb-1">Nombre</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 text-xs font-bold text-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-600 block mb-1">Edad</label>
                    <input
                      type="number"
                      min={MIN_AGE}
                      max={99}
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 text-xs font-bold text-zinc-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-zinc-600 block mb-1">Género</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 text-xs font-bold text-zinc-900"
                    >
                      {GENDERS.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-600 block mb-1">Me interesa</label>
                    <select
                      value={interestedIn}
                      onChange={(e) => setInterestedIn(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 text-xs font-bold text-zinc-900"
                    >
                      {INTERESTED_IN_OPTIONS.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-zinc-600 block mb-1">País</label>
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 text-xs font-bold text-zinc-900"
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-600 block mb-1">Ciudad (Vivo en)</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Ej. Caracas, Bogotá..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 text-xs font-bold text-zinc-900"
                    />
                  </div>
                </div>

                {/* Qué buscas — sincronizado directamente con Explorar */}
                <div>
                  <label className="text-xs font-bold text-zinc-600 block mb-1.5">
                    ¿Qué estás buscando? (Te muestra en Explorar)
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {LOOKING_FOR_OPTIONS.map((opt) => (
                      <button
                        type="button"
                        key={opt}
                        onClick={() => setLookingFor(opt)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border text-left transition ${
                          lookingFor === opt
                            ? 'bg-zinc-900 text-white border-zinc-900'
                            : 'bg-zinc-100 text-zinc-700 border-transparent hover:bg-zinc-200'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Atributos adicionales reales (Estatura, Empleo, Educación, Estilo de vida) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-zinc-600 block mb-1">Estatura</label>
                    <input
                      type="text"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      placeholder="Ej. 1.75 m"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 text-xs font-bold text-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-600 block mb-1">Empleo / Profesión</label>
                    <input
                      type="text"
                      value={job}
                      onChange={(e) => setJob(e.target.value)}
                      placeholder="Ej. Diseñador, Médico"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 text-xs font-bold text-zinc-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-zinc-600 block mb-1">Educación</label>
                    <input
                      type="text"
                      value={education}
                      onChange={(e) => setEducation(e.target.value)}
                      placeholder="Ej. Universitaria"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 text-xs font-bold text-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-600 block mb-1">Estilo de vida</label>
                    <select
                      value={lifestyle}
                      onChange={(e) => setLifestyle(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 text-xs font-bold text-zinc-900"
                    >
                      <option value="">Seleccionar...</option>
                      {LIFESTYLE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-600 block mb-1">Biografía</label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Cuéntale a la comunidad quién eres..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 text-xs font-bold text-zinc-900 resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-600 block">Mis 2 Frases</label>
                  <input
                    type="text"
                    placeholder="Frase 1: Mi plan ideal de fin de semana es..."
                    value={prompts[0] || ''}
                    onChange={(e) => setPrompts([e.target.value, prompts[1] || ''])}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 text-xs font-bold text-zinc-900"
                  />
                  <input
                    type="text"
                    placeholder="Frase 2: Algo que debes saber sobre mí es..."
                    value={prompts[1] || ''}
                    onChange={(e) => setPrompts([prompts[0] || '', e.target.value])}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 text-xs font-bold text-zinc-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-600 block mb-1.5">
                    Intereses ({interests.length}/10)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {INTERESTS_CATALOG.map((item) => {
                      const active = interests.includes(item);
                      return (
                        <button
                          type="button"
                          key={item}
                          onClick={() => toggleInterest(item)}
                          className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                            active
                              ? 'bg-zinc-900 text-white'
                              : 'bg-zinc-100 text-zinc-600'
                          }`}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3.5 rounded-full bg-zinc-900 text-white text-xs font-extrabold flex items-center justify-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </form>

              <button
                type="button"
                onClick={() => logoutUser(userProfile?.uid)}
                className="w-full py-3.5 rounded-full bg-rose-50 text-[#FF2E54] text-xs font-extrabold flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Cerrar Sesión ({userProfile?.email})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
