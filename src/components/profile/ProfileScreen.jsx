import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  Bell,
  Briefcase,
  CheckCircle2,
  Crown,
  Eye,
  Flame,
  Gem,
  Gift,
  GraduationCap,
  Heart,
  Home,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Quote,
  Ruler,
  Settings,
  ShieldCheck,
  Sparkles,
  Unlock,
  X,
} from 'lucide-react';
import {
  COUNTRIES,
  ECONOMY_CONFIG,
  EXCLUSIVE_PHOTO_DEFAULT_COST,
  GENDERS,
  INTERESTED_IN_OPTIONS,
  INTERESTS_CATALOG,
  LIFESTYLE_OPTIONS,
  LOOKING_FOR_OPTIONS,
  MAX_EXCLUSIVE_PHOTOS,
  MAX_PHOTOS,
  MIN_AGE,
  resolveAccessPolicy,
} from '../../config/constants';
import { useAuth } from '../../contexts/AuthContext';
import { getUserCloudinaryFolder, uploadImageToCloudinary } from '../../services/cloudinaryService';
import {
  requestBlueCheckVerification,
  subscribeUserReports,
  updateUserProfile,
} from '../../services/userService';
import {
  createDebouncedAutoSaver,
  createSectionSignature,
  validateProfileDraft,
} from '../../utils/autoSaveHelpers';
import {
  calculateProfileCompletion,
  calculateWithdrawalBreakdown,
  formatTimeRemaining,
  formatUSD,
  getPrimaryPhoto,
  getSpendableDiamonds,
  isProActive,
  isProfileVerified,
  optimizeCloudinaryUrl,
} from '../../utils/formatters';
import GiftShowcaseCard from '../monetization/GiftShowcaseCard';
import ProCrownBadge from '../monetization/ProCrownBadge';
import AccountSettingsModal from './AccountSettingsModal';
import PhotoUploader from './PhotoUploader';

const PROMPT_SUGGESTIONS = [
  'Mi domingo perfecto incluye un buen café y...',
  'Algo que pocos saben de mí es que...',
  'Lo que más valoro en una conexión real es...',
  'Mi destino soñado para viajar juntos es...',
];

export default function ProfileScreen({
  userProfile,
  currentAuthUid,
  receivedLikes = [],
  receivedGifts = [],
  unreadGiftsCount = 0,
  onPreviewOwnProfile,
  onOpenDiamondStore,
  onOpenWithdrawals,
  onOpenBoost,
  onOpenSafetyCenter,
  onOpenGiftNotifications,
  onOpenAdmin,
  onSuccess,
  onError,
}) {
  const { economyConfig } = useAuth();
  const liveEconomy = economyConfig || ECONOMY_CONFIG;
  const accessPolicy = useMemo(() => resolveAccessPolicy(liveEconomy), [liveEconomy]);
  const exclusiveCostDiamonds = accessPolicy.unlockExclusivePhotoDiamonds || EXCLUSIVE_PHOTO_DEFAULT_COST;

  const [editorOpen, setEditorOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [myReportsCount, setMyReportsCount] = useState(0);
  const [promptSheetIdx, setPromptSheetIdx] = useState(null);
  const [promptDraft, setPromptDraft] = useState('');
  const [promptSaveStatus, setPromptSaveStatus] = useState({ state: 'idle', message: '' });
  const [profileSaveStatus, setProfileSaveStatus] = useState({ state: 'idle', message: '' });
  const [togglingGiftGate, setTogglingGiftGate] = useState(false);
  const [requestingCheck, setRequestingCheck] = useState(false);
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
  const [exclusivePhotoUrls, setExclusivePhotoUrls] = useState(
    userProfile?.exclusivePhotoUrls || []
  );
  const [prompts, setPrompts] = useState(userProfile?.prompts || ['', '']);
  const [togglingExclusiveUrl, setTogglingExclusiveUrl] = useState('');

  const userProfileRef = useRef(userProfile);
  const onErrorRef = useRef(onError);
  userProfileRef.current = userProfile;
  onErrorRef.current = onError;

  const editorDraftRef = useRef({
    name: userProfile?.name || '',
    age: userProfile?.age || 18,
    gender: userProfile?.gender || GENDERS[0],
    interestedIn: userProfile?.interestedIn || 'Todos',
    countryCode: userProfile?.country?.code || COUNTRIES[0].code,
    city: userProfile?.city || '',
    lookingFor: userProfile?.lookingFor || LOOKING_FOR_OPTIONS[0],
    bio: userProfile?.bio || '',
    height: userProfile?.height || '',
    job: userProfile?.job || '',
    education: userProfile?.education || '',
    lifestyle: userProfile?.lifestyle || '',
    interests: userProfile?.interests || [],
    photos: userProfile?.photos || [],
    exclusivePhotoUrls: userProfile?.exclusivePhotoUrls || [],
    prompts: userProfile?.prompts || ['', ''],
  });
  const lastSavedProfileSigRef = useRef('');
  const lastSavedPromptSigRef = useRef('');

  const promptSaverRef = useRef(null);
  if (!promptSaverRef.current) {
    promptSaverRef.current = createDebouncedAutoSaver({
      delayMs: 550,
      onSave: async ({ idx, text }) => {
        const uid = userProfileRef.current?.uid;
        if (!uid || idx === null || idx === undefined) return;
        const cleanText = String(text || '').trim();
        const existingPrompts = Array.isArray(userProfileRef.current?.prompts)
          ? [...userProfileRef.current.prompts]
          : [...(editorDraftRef.current.prompts || ['', ''])];
        while (existingPrompts.length < 2) existingPrompts.push('');
        existingPrompts[idx] = cleanText;

        const sig = createSectionSignature(existingPrompts);
        if (sig === lastSavedPromptSigRef.current) {
          setPromptSaveStatus({ state: 'saved', message: '' });
          return;
        }

        setPromptSaveStatus({ state: 'saving', message: '' });
        try {
          await updateUserProfile(uid, { prompts: existingPrompts });
          lastSavedPromptSigRef.current = sig;
          editorDraftRef.current.prompts = existingPrompts;
          setPrompts(existingPrompts);
          setPromptSaveStatus({ state: 'saved', message: '' });
        } catch (err) {
          const msg = err?.message || 'No se pudo guardar la frase.';
          setPromptSaveStatus({ state: 'error', message: msg });
          onErrorRef.current?.(msg);
        }
      },
    });
  }

  const profileSaverRef = useRef(null);
  if (!profileSaverRef.current) {
    profileSaverRef.current = createDebouncedAutoSaver({
      delayMs: 650,
      onSave: async ({ sig, updates }) => {
        const uid = userProfileRef.current?.uid;
        if (!uid) return;
        if (sig === lastSavedProfileSigRef.current) {
          setProfileSaveStatus({ state: 'saved', message: '' });
          return;
        }
        setProfileSaveStatus({ state: 'saving', message: '' });
        try {
          await updateUserProfile(uid, updates);
          lastSavedProfileSigRef.current = sig;
          setProfileSaveStatus({ state: 'saved', message: '' });
        } catch (err) {
          const msg = err?.message || 'No se pudo actualizar tu perfil.';
          setProfileSaveStatus({ state: 'error', message: msg });
          onErrorRef.current?.(msg);
        }
      },
    });
  }

  useEffect(() => {
    if (!userProfile?.uid) return;
    if (!editorOpen && profileSaverRef.current?.isBusyOrPending()) return;
    const hydrated = {
      name: userProfile.name || '',
      age: userProfile.age || 18,
      gender: userProfile.gender || GENDERS[0],
      interestedIn: userProfile.interestedIn || 'Todos',
      countryCode: userProfile.country?.code || COUNTRIES[0].code,
      city: userProfile.city || '',
      lookingFor: userProfile.lookingFor || LOOKING_FOR_OPTIONS[0],
      bio: userProfile.bio || '',
      height: userProfile.height || '',
      job: userProfile.job || '',
      education: userProfile.education || '',
      lifestyle: userProfile.lifestyle || '',
      interests: userProfile.interests || [],
      photos: userProfile.photos || [],
      exclusivePhotoUrls: userProfile.exclusivePhotoUrls || [],
      prompts:
        Array.isArray(userProfile.prompts) && userProfile.prompts.length >= 2
          ? userProfile.prompts.slice(0, 2)
          : [userProfile.prompts?.[0] || '', userProfile.prompts?.[1] || ''],
    };
    editorDraftRef.current = hydrated;
    setName(hydrated.name);
    setAge(hydrated.age);
    setGender(hydrated.gender);
    setInterestedIn(hydrated.interestedIn);
    setCountryCode(hydrated.countryCode);
    setCity(hydrated.city);
    setLookingFor(hydrated.lookingFor);
    setBio(hydrated.bio);
    setHeight(hydrated.height);
    setJob(hydrated.job);
    setEducation(hydrated.education);
    setLifestyle(hydrated.lifestyle);
    setInterests(hydrated.interests);
    setPhotos(hydrated.photos);
    setExclusivePhotoUrls(hydrated.exclusivePhotoUrls);
    setPrompts(hydrated.prompts);

    const check = validateProfileDraft(hydrated, MIN_AGE);
    lastSavedProfileSigRef.current = check.valid ? createSectionSignature(check.payload) : '';
    if (editorOpen) {
      setProfileSaveStatus({ state: 'idle', message: '' });
    }
  }, [userProfile?.uid, editorOpen]);

  useEffect(() => {
    return () => {
      promptSaverRef.current?.flush();
      profileSaverRef.current?.flush();
    };
  }, []);

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

  useEffect(() => {
    if (!userProfile?.uid || !userProfile?.smartPhotos) return;
    if (bestPhotoUrl && bestPhotoUrl !== userProfile?.smartBestPhotoUrl) {
      updateUserProfile(userProfile.uid, { smartBestPhotoUrl: bestPhotoUrl }).catch(() => {});
    }
  }, [userProfile?.uid, userProfile?.smartPhotos, bestPhotoUrl, userProfile?.smartBestPhotoUrl]);

  useEffect(() => {
    setEditorOpen(false);
    setSettingsOpen(false);
  }, [currentAuthUid, userProfile?.uid]);

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

  const updateEditorField = (patch, { immediate = false } = {}) => {
    const nextDraft = {
      ...editorDraftRef.current,
      ...patch,
    };
    editorDraftRef.current = nextDraft;

    if ('name' in patch) setName(patch.name);
    if ('age' in patch) setAge(patch.age);
    if ('gender' in patch) setGender(patch.gender);
    if ('interestedIn' in patch) setInterestedIn(patch.interestedIn);
    if ('countryCode' in patch) setCountryCode(patch.countryCode);
    if ('city' in patch) setCity(patch.city);
    if ('lookingFor' in patch) setLookingFor(patch.lookingFor);
    if ('bio' in patch) setBio(patch.bio);
    if ('height' in patch) setHeight(patch.height);
    if ('job' in patch) setJob(patch.job);
    if ('education' in patch) setEducation(patch.education);
    if ('lifestyle' in patch) setLifestyle(patch.lifestyle);
    if ('interests' in patch) setInterests(patch.interests);
    if ('photos' in patch) setPhotos(patch.photos);
    if ('exclusivePhotoUrls' in patch) setExclusivePhotoUrls(patch.exclusivePhotoUrls);
    if ('prompts' in patch) setPrompts(patch.prompts);

    const check = validateProfileDraft(nextDraft, MIN_AGE);
    if (!check.valid) {
      profileSaverRef.current?.cancel();
      setProfileSaveStatus({ state: 'error', message: check.reason });
      return;
    }

    const sig = createSectionSignature(check.payload);
    if (sig === lastSavedProfileSigRef.current) {
      profileSaverRef.current?.cancel();
      setProfileSaveStatus({ state: 'saved', message: '' });
      return;
    }

    const { countryCode: chosenCode, ...restPayload } = check.payload;
    const country = COUNTRIES.find((c) => c.code === chosenCode) || COUNTRIES[0];
    setProfileSaveStatus({ state: immediate ? 'saving' : 'pending', message: '' });
    profileSaverRef.current?.schedule(
      { sig, updates: { ...restPayload, country } },
      { immediate }
    );
  };

  const toggleInterest = (item) => {
    const prev = Array.isArray(editorDraftRef.current.interests)
      ? editorDraftRef.current.interests
      : [];
    const next = prev.includes(item)
      ? prev.filter((x) => x !== item)
      : [...prev, item].slice(0, 10);
    updateEditorField({ interests: next }, { immediate: true });
  };

  const openQuickPrompt = (slotIdx) => {
    const existing = userProfile?.prompts?.[slotIdx] || prompts[slotIdx] || '';
    const basePrompts = Array.isArray(userProfile?.prompts)
      ? [...userProfile.prompts]
      : [...(prompts || ['', ''])];
    while (basePrompts.length < 2) basePrompts.push('');
    basePrompts[slotIdx] = String(existing).trim();
    lastSavedPromptSigRef.current = createSectionSignature(basePrompts);
    setPromptDraft(existing);
    setPromptSaveStatus({ state: 'idle', message: '' });
    setPromptSheetIdx(slotIdx);
  };

  const handleQuickPromptChange = (nextText, { immediate = false } = {}) => {
    setPromptDraft(nextText);
    if (promptSheetIdx === null) return;
    const basePrompts = Array.isArray(userProfileRef.current?.prompts)
      ? [...userProfileRef.current.prompts]
      : [...(editorDraftRef.current.prompts || ['', ''])];
    while (basePrompts.length < 2) basePrompts.push('');
    basePrompts[promptSheetIdx] = String(nextText || '').trim();
    const sig = createSectionSignature(basePrompts);
    if (sig === lastSavedPromptSigRef.current) {
      promptSaverRef.current?.cancel();
      setPromptSaveStatus({ state: 'saved', message: '' });
      return;
    }
    setPromptSaveStatus({ state: immediate ? 'saving' : 'pending', message: '' });
    promptSaverRef.current?.schedule({ idx: promptSheetIdx, text: nextText }, { immediate });
  };

  const closePromptSheet = () => {
    promptSaverRef.current?.flush();
    setPromptSheetIdx(null);
  };

  const closeEditor = () => {
    profileSaverRef.current?.flush();
    setEditorOpen(false);
  };

  const handleQuickToggleExclusive = async (e, url, idx) => {
    e.stopPropagation();
    if (!isOwnerSession || idx === 0 || !url || togglingExclusiveUrl) return;
    const currentList = Array.isArray(userProfile?.exclusivePhotoUrls)
      ? userProfile.exclusivePhotoUrls
      : [];
    const isCurrentlyExclusive = currentList.includes(url);
    if (!isCurrentlyExclusive && currentList.length >= MAX_EXCLUSIVE_PHOTOS) {
      onError?.(
        `Puedes marcar máximo ${MAX_EXCLUSIVE_PHOTOS} fotos de tu galería como Exclusivas VIP (${exclusiveCostDiamonds} 💎).`
      );
      return;
    }
    const nextList = isCurrentlyExclusive
      ? currentList.filter((u) => u !== url)
      : [...currentList, url];

    setTogglingExclusiveUrl(url);
    try {
      setExclusivePhotoUrls(nextList);
      await updateUserProfile(userProfile.uid, {
        photos: userPhotos,
        exclusivePhotoUrls: nextList,
      });
      onSuccess?.(
        isCurrentlyExclusive
          ? 'Foto cambiada a pública en tu galería.'
          : `🔒 Foto marcada como Exclusiva VIP (Desbloqueable por ${exclusiveCostDiamonds} 💎 para ti o gratis con PRO).`
      );
    } catch (err) {
      onError?.(err.message || 'No se pudo actualizar la foto exclusiva.');
    } finally {
      setTogglingExclusiveUrl('');
    }
  };

  const userPhotos = Array.isArray(userProfile?.photos) ? userProfile.photos.filter(Boolean) : [];
  const missingPhotosCount = Math.max(0, MAX_PHOTOS - userPhotos.length);
  const filledPromptsCount = Array.isArray(userProfile?.prompts)
    ? userProfile.prompts.filter((p) => typeof p === 'string' && p.trim().length > 0).length
    : 0;
  const missingPromptsCount = Math.max(0, 2 - filledPromptsCount);

  const verified = isProfileVerified(userProfile);
  const proActive = isProActive(userProfile);
  const completion = calculateProfileCompletion(userProfile);
  const isOwnerSession = Boolean(
    currentAuthUid && userProfile?.uid && currentAuthUid === userProfile.uid
  );
  const giftGateActive = Boolean(userProfile?.requireGiftToChat);
  const userPurchasedDiamonds = getSpendableDiamonds(userProfile);
  const userDiamonds = Number(userProfile?.earningsDiamonds || 0);
  const { netPayoutUSD } = calculateWithdrawalBreakdown(userDiamonds, liveEconomy);

  const handleToggleGiftGate = async () => {
    if (!isOwnerSession || togglingGiftGate) return;
    const nextVal = !giftGateActive;
    setTogglingGiftGate(true);
    try {
      await updateUserProfile(userProfile.uid, { requireGiftToChat: nextVal });
      onSuccess?.(
        nextVal
          ? '👑 Modo Creador activado: solo recibirás chats nuevos de quienes te envíen un regalo.'
          : 'Chat abierto: ahora cualquier persona puede iniciar conversación contigo.'
      );
    } catch (err) {
      onError?.(err.message || 'No se pudo actualizar esta opción.');
    } finally {
      setTogglingGiftGate(false);
    }
  };

  const handleRequestBlueCheck = async () => {
    if (!isOwnerSession || requestingCheck || verified || userProfile?.verificationStatus === 'pending') {
      return;
    }
    setRequestingCheck(true);
    try {
      await requestBlueCheckVerification(userProfile.uid);
      onSuccess?.('☑️ Solicitud de Check Azul enviada al equipo de Super Admin.');
    } catch (err) {
      onError?.(err.message || 'No se pudo enviar la solicitud de verificación.');
    } finally {
      setRequestingCheck(false);
    }
  };

  const quickChips = [
    {
      label: userProfile?.city ? `${userProfile.country?.flag || '📍'} ${userProfile.city}` : 'Agregar ciudad',
      icon: Home,
      missing: !userProfile?.city?.trim(),
    },
    {
      label: userProfile?.height ? userProfile.height : 'Estatura',
      icon: Ruler,
      missing: !userProfile?.height?.trim(),
    },
    {
      label: userProfile?.job ? userProfile.job : 'Profesión',
      icon: Briefcase,
      missing: !userProfile?.job?.trim(),
    },
    {
      label: userProfile?.education ? userProfile.education : 'Educación',
      icon: GraduationCap,
      missing: !userProfile?.education?.trim(),
    },
    {
      label: userProfile?.lifestyle ? userProfile.lifestyle : 'Estilo de vida',
      icon: Sparkles,
      missing: !userProfile?.lifestyle?.trim(),
    },
    {
      label: userProfile?.lookingFor || 'Intención',
      icon: Flame,
      missing: !userProfile?.lookingFor,
      highlight: Boolean(userProfile?.lookingFor),
    },
  ];

  const privacyPills = [
    userProfile?.discoverable === false ? 'Perfil pausado' : null,
    userProfile?.hideAge ? 'Edad oculta' : null,
    userProfile?.hideDistance ? 'Distancia oculta' : null,
    userProfile?.hideOnlineStatus ? 'En línea oculto' : null,
  ].filter(Boolean);

  return (
    <div className="min-h-full bg-gradient-to-b from-[#FBF7F9] via-[#F5F3F6] to-[#F0EEF2] text-zinc-900 flex flex-col justify-between p-4 pb-8 space-y-4">
      <div className="space-y-4 pt-safe">
        {/* 1. TARJETA HERO DE IDENTIDAD Y ECONOMÍA */}
        <header className="relative overflow-hidden rounded-[28px] bg-white/95 border border-white shadow-[0_14px_40px_-14px_rgba(15,23,42,0.12)] p-4 sm:p-5 space-y-4">
          <div className="absolute -right-10 -top-10 w-36 h-36 rounded-full bg-rose-100/70 blur-3xl pointer-events-none" />
          <div className="absolute -left-10 bottom-0 w-28 h-28 rounded-full bg-amber-100/60 blur-3xl pointer-events-none" />

          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <button
                type="button"
                onClick={onPreviewOwnProfile}
                className="relative group shrink-0 rounded-[22px] p-[2px] bg-gradient-to-br from-[#FF2E54]/45 via-rose-300/40 to-amber-400/50 shadow-sm hover:scale-[1.02] transition"
                title="Ver vista previa pública"
              >
                <img
                  src={getPrimaryPhoto(userProfile, 240, { seed: userProfile?.uid })}
                  alt={userProfile?.name}
                  className="w-[68px] h-[68px] rounded-[20px] object-cover bg-zinc-100"
                />
                <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-zinc-900 text-white border-2 border-white flex items-center justify-center shadow-sm">
                  <Eye className="w-3 h-3" />
                </span>
              </button>

              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-1.5">
                  <h1 className="font-display text-xl sm:text-2xl font-black text-zinc-900 truncate tracking-tight">
                    {userProfile?.name}
                    {userProfile?.age ? `, ${userProfile.age}` : ''}
                  </h1>
                  <BadgeCheck
                    className={`w-5 h-5 shrink-0 ${
                      verified
                        ? 'text-sky-500 fill-sky-500 stroke-white'
                        : 'text-zinc-300 fill-zinc-200 stroke-white'
                    }`}
                    title={verified ? 'Perfil Verificado' : 'Perfil sin verificar'}
                  />
                  {proActive && <ProCrownBadge variant="compact" />}
                </div>

                <p className="text-[11px] font-bold text-zinc-500 truncate">
                  {userProfile?.country?.flag || '🌎'}{' '}
                  {userProfile?.city
                    ? `${userProfile.city}, ${userProfile.country?.name || ''}`
                    : userProfile?.country?.name || 'Global'}
                  {userProfile?.lookingFor ? ` · ${userProfile.lookingFor}` : ''}
                </p>

                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={onPreviewOwnProfile}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-100 hover:bg-zinc-200/80 text-zinc-700 text-[10px] font-extrabold transition"
                  >
                    <Eye className="w-3 h-3 text-zinc-500" />
                    Cómo te ven
                  </button>

                  {isOwnerSession && !verified && (
                    <button
                      type="button"
                      disabled={requestingCheck || userProfile?.verificationStatus === 'pending'}
                      onClick={handleRequestBlueCheck}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold border transition ${
                        userProfile?.verificationStatus === 'pending'
                          ? 'bg-amber-50 border-amber-200 text-amber-800'
                          : 'bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100'
                      }`}
                    >
                      <BadgeCheck className="w-3 h-3" />
                      {userProfile?.verificationStatus === 'pending'
                        ? 'Check en revisión'
                        : requestingCheck
                        ? 'Enviando...'
                        : 'Solicitar Check Azul'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onOpenGiftNotifications}
                className="relative w-10 h-10 rounded-2xl bg-rose-50/80 text-[#FF2E54] border border-rose-200/70 shadow-sm flex items-center justify-center hover:bg-rose-100/80 transition"
                title="Notificaciones privadas de regalos"
              >
                <Bell className="w-[18px] h-[18px]" />
                {unreadGiftsCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF2E54] text-white text-[10px] font-black flex items-center justify-center shadow ring-2 ring-white">
                    {unreadGiftsCount > 99 ? '99+' : unreadGiftsCount}
                  </span>
                )}
              </button>

              {isOwnerSession && (
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="w-10 h-10 rounded-2xl bg-zinc-900 text-white shadow-sm flex items-center justify-center hover:bg-zinc-800 active:scale-95 transition"
                  title="Ajustes privados, cobros y privacidad"
                >
                  <Settings className="w-[18px] h-[18px]" />
                </button>
              )}
            </div>
          </div>

          {privacyPills.length > 0 && (
            <div className="relative flex flex-wrap gap-1.5">
              {privacyPills.map((pill) => (
                <span
                  key={pill}
                  className="px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200/70 text-[#BE123C] text-[10px] font-bold"
                >
                  {pill}
                </span>
              ))}
            </div>
          )}

          {/* Accesos Rápidos de Billetera (Diamantes 💎, Conoscamosnos PRO 👑 y Ganancias) */}
          {isOwnerSession && (
            <div className="relative space-y-2 pt-2 border-t border-zinc-100">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onOpenDiamondStore?.('buy')}
                  className="p-2.5 rounded-2xl bg-gradient-to-br from-sky-50/90 to-white border border-sky-200/75 text-left hover:border-sky-300 active:scale-[0.99] transition flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                      <Gem className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-sky-700">
                        Diamantes
                      </p>
                      <p className="font-display text-sm font-black text-zinc-900 tabular-nums leading-tight">
                        {userPurchasedDiamonds} 💎
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-white border border-sky-200 text-[9.5px] font-extrabold text-sky-700 shrink-0">
                    Recargar
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenDiamondStore?.('pro')}
                  className="p-2.5 rounded-2xl bg-gradient-to-br from-rose-50/95 via-white to-amber-50/90 border border-rose-200/80 text-left hover:border-[#FF2E54] active:scale-[0.99] transition flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FF2E54] to-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Crown className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#FF2E54]">
                        Membresía PRO
                      </p>
                      <p className="font-display text-xs font-black text-zinc-900 truncate leading-tight">
                        {proActive
                          ? `Activo (${formatTimeRemaining(userProfile.proExpiresAt)})`
                          : 'Todo Ilimitado'}
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-white border border-rose-200 text-[9.5px] font-extrabold text-[#FF2E54] shrink-0">
                    {proActive ? 'Ver' : 'Obtener'}
                  </span>
                </button>
              </div>

              <button
                type="button"
                onClick={onOpenWithdrawals}
                className="w-full p-2.5 rounded-2xl bg-gradient-to-br from-emerald-50/80 via-white to-sky-50/60 border border-emerald-200/80 text-left hover:border-emerald-300 active:scale-[0.99] transition flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Gift className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                      Ganancias (Regalos y Álbum VIP)
                    </p>
                    <p className="font-display text-sm font-black text-zinc-900 tabular-nums leading-tight">
                      {userDiamonds} 💎 <span className="text-emerald-600 text-[10.5px]">(≈ {formatUSD(netPayoutUSD)})</span>
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-white border border-emerald-200 text-[10px] font-extrabold text-emerald-700 shrink-0">
                  Retirar USD →
                </span>
              </button>
            </div>
          )}
        </header>

        {/* 2. BARRA INFORMATIVA DE COMPLETITUD DE PERFIL (SOLO LECTURA, NO CLICKEABLE) */}
        <div
          aria-label={`Completitud del perfil ${completion.percent}%`}
          className="w-full rounded-[24px] bg-white/90 border border-zinc-200/75 px-4 py-3.5 shadow-[0_4px_20px_-8px_rgba(15,23,42,0.06)] space-y-2.5 select-none"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {completion.percent < 100 ? (
                <div className="w-7 h-7 rounded-xl bg-rose-50 border border-rose-200/80 text-[#FF2E54] flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
              ) : (
                <div className="w-7 h-7 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-zinc-900 truncate">
                  {completion.percent < 100 ? 'Nivel de tu perfil' : 'Perfil completo al máximo'}
                </p>
                <p className="text-[10.5px] font-medium text-zinc-500 truncate">
                  {completion.missingItems.length > 0
                    ? `Por completar: ${completion.missingItems.slice(0, 3).join(', ')}${
                        completion.missingItems.length > 3
                          ? ` (+${completion.missingItems.length - 3})`
                          : ''
                      }`
                    : 'Tu tarjeta luce impecable en Descubrir'}
                </p>
              </div>
            </div>

            <span
              className={`px-2.5 py-1 rounded-full text-[11px] font-black tabular-nums shrink-0 ${
                completion.percent === 100
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                  : 'bg-rose-50 text-[#FF2E54] border border-rose-200/80'
              }`}
            >
              {completion.percent}%
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-zinc-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                completion.percent === 100
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  : 'bg-gradient-to-r from-[#FF2E54] via-rose-400 to-amber-400'
              }`}
              style={{ width: `${Math.max(4, completion.percent)}%` }}
            />
          </div>
        </div>

        {/* 3. CÁPSULAS DE ATRIBUTOS RÁPIDOS ("SOBRE MÍ") */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-display text-sm font-black uppercase tracking-wider text-zinc-500">
              Sobre mí
            </h2>
            <button
              type="button"
              onClick={() => setEditorOpen(true)}
              className="text-[11px] font-extrabold text-[#FF2E54] hover:underline"
            >
              Editar datos →
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickChips.map((chip, idx) => {
              const Icon = chip.icon;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setEditorOpen(true)}
                  className={`rounded-full px-3.5 py-2 text-xs font-bold inline-flex items-center gap-1.5 transition ${
                    chip.highlight
                      ? 'bg-zinc-900 text-white shadow-sm hover:bg-zinc-800'
                      : chip.missing
                      ? 'bg-white/75 border border-dashed border-zinc-300 text-zinc-500 hover:border-[#FF2E54]/50 hover:text-zinc-800'
                      : 'bg-white border border-zinc-200/85 text-zinc-800 shadow-sm hover:border-zinc-300'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      chip.highlight
                        ? 'text-[#FF2E54]'
                        : chip.missing
                        ? 'text-zinc-400'
                        : 'text-[#FF2E54]'
                    }`}
                  />
                  <span className="max-w-[150px] truncate">{chip.label}</span>
                  {chip.missing && <Plus className="w-3 h-3 text-zinc-400" />}
                </button>
              );
            })}
          </div>
        </section>

        {/* 4. GALERÍA EDITORIAL (6 SLOTS EN BENTO 3x2) */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="font-display text-base font-black text-zinc-900">Mi Galería</h2>
              {missingPhotosCount > 0 ? (
                <p className="text-[11px] font-bold text-[#FF2E54]">
                  Agrega {missingPhotosCount} {missingPhotosCount === 1 ? 'foto más' : 'fotos más'} para destacar
                </p>
              ) : (
                <p className="text-[11px] font-bold text-emerald-600">
                  ✓ Galería completa ({userPhotos.length}/{MAX_PHOTOS} fotos)
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setEditorOpen(true)}
              className="px-3.5 py-1.5 rounded-full bg-white border border-zinc-200/90 text-zinc-800 text-[11px] font-extrabold shadow-sm hover:bg-zinc-50 active:scale-95 transition flex items-center gap-1"
            >
              <Pencil className="w-3 h-3" />
              Gestionar
            </button>
          </div>

          <div className="bg-white/95 border border-zinc-200/75 rounded-[28px] p-3.5 shadow-[0_8px_28px_-10px_rgba(15,23,42,0.08)] space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: MAX_PHOTOS }).map((_, idx) => {
                const url = userPhotos[idx];
                if (url) {
                  const likeCount = Number(photoLikeCounts[url] || 0);
                  const isTop = Boolean(userProfile?.smartPhotos && bestPhotoUrl === url);
                  const isExclusive =
                    idx > 0 &&
                    Array.isArray(userProfile?.exclusivePhotoUrls) &&
                    userProfile.exclusivePhotoUrls.includes(url);
                  return (
                    <div
                      key={idx}
                      onClick={() => setEditorOpen(true)}
                      className={`aspect-[3/4] rounded-2xl overflow-hidden bg-zinc-100 relative group border cursor-pointer ${
                        isExclusive ? 'border-[#FF2E54] ring-2 ring-rose-200' : 'border-zinc-200/60'
                      }`}
                    >
                      <img
                        src={optimizeCloudinaryUrl(url, 320)}
                        alt={`Foto ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition duration-300"
                      />
                      <div className="absolute inset-x-0 bottom-0 h-11 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
                      {isExclusive ? (
                        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-[#FF2E54] to-amber-500 text-[8.5px] font-black text-white leading-none shadow inline-flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" /> VIP {exclusiveCostDiamonds} 💎
                        </span>
                      ) : isTop ? (
                        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-[#FF2E54] to-amber-500 text-[9px] font-black text-white leading-none shadow">
                          TOP
                        </span>
                      ) : idx === 0 ? (
                        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-zinc-900/80 text-[9px] font-extrabold text-white leading-none">
                          Principal
                        </span>
                      ) : null}

                      {isOwnerSession && idx > 0 && (
                        <button
                          type="button"
                          disabled={togglingExclusiveUrl === url}
                          onClick={(e) => handleQuickToggleExclusive(e, url, idx)}
                          className={`absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-full text-[8.5px] font-black inline-flex items-center gap-0.5 shadow transition ${
                            isExclusive
                              ? 'bg-[#FF2E54] text-white'
                              : 'bg-white/95 text-zinc-900 hover:bg-rose-50 hover:text-[#FF2E54]'
                          }`}
                          title={
                            isExclusive
                              ? 'Quitar de Fotos Exclusivas VIP'
                              : `Marcar como Foto Exclusiva VIP (+${exclusiveCostDiamonds} 💎 para ti)`
                          }
                        >
                          {isExclusive ? (
                            <>
                              <Lock className="w-2.5 h-2.5" /> Exclusiva
                            </>
                          ) : (
                            <>
                              <Unlock className="w-2.5 h-2.5 text-[#FF2E54]" /> Hacer VIP
                            </>
                          )}
                        </button>
                      )}

                      {likeCount > 0 && (
                        <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-black/65 backdrop-blur-sm text-[9px] font-extrabold text-white leading-none flex items-center gap-0.5">
                          <Heart className="w-2.5 h-2.5 fill-[#FF2E54] text-[#FF2E54]" />
                          {likeCount}
                        </span>
                      )}
                    </div>
                  );
                }
                const isNextSlot = idx === userPhotos.length;
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={uploadingQuickPhoto}
                    onClick={() => quickFileInputRef.current?.click()}
                    className={`aspect-[3/4] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition ${
                      isNextSlot
                        ? 'border-[#FF2E54]/45 bg-rose-50/50 hover:bg-rose-50 text-[#FF2E54]'
                        : 'border-zinc-200 bg-zinc-50/70 hover:bg-zinc-100 text-zinc-400'
                    }`}
                  >
                    {uploadingQuickPhoto && isNextSlot ? (
                      <Loader2 className="w-5 h-5 animate-spin text-[#FF2E54]" />
                    ) : (
                      <>
                        <Plus className="w-4 h-4 stroke-[2.4]" />
                        <span className="text-[10px] font-bold">
                          {isNextSlot ? 'Subir foto' : `Foto ${idx + 1}`}
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
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

        {/* 5. SECCIÓN "MIS FRASES" CON DISEÑO EDITORIAL */}
        <section className="space-y-2.5">
          <div className="px-1">
            <h2 className="font-display text-base font-black text-zinc-900">Mis Frases</h2>
            {missingPromptsCount > 0 ? (
              <p className="text-[11px] font-bold text-[#FF2E54]">
                Agrega {missingPromptsCount} {missingPromptsCount === 1 ? 'frase personal' : 'frases personales'} para romper el hielo
              </p>
            ) : (
              <p className="text-[11px] font-bold text-emerald-600">
                ✓ Tus 2 frases están activas en tu perfil
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[0, 1].map((slotIdx) => {
              const phraseText = userProfile?.prompts?.[slotIdx] || prompts[slotIdx];
              const filled = Boolean(phraseText?.trim());
              return (
                <button
                  key={slotIdx}
                  type="button"
                  onClick={() => openQuickPrompt(slotIdx)}
                  className={`relative rounded-[24px] p-4 flex flex-col justify-between text-left min-h-[154px] border transition ${
                    filled
                      ? 'bg-white border-zinc-200/80 shadow-[0_8px_24px_-10px_rgba(15,23,42,0.08)] hover:border-rose-200'
                      : 'bg-white/75 border-dashed border-zinc-300 hover:bg-white hover:border-[#FF2E54]/45'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-[#FF2E54] text-[10px] font-extrabold uppercase tracking-wider">
                      <Quote className="w-2.5 h-2.5" />
                      Frase {slotIdx + 1}
                    </span>
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition ${
                        filled
                          ? 'bg-zinc-100 text-zinc-700'
                          : 'bg-zinc-900 text-white'
                      }`}
                    >
                      {filled ? <Pencil className="w-3 h-3" /> : <Plus className="w-3.5 h-3.5" />}
                    </span>
                  </div>

                  <p
                    className={`text-xs leading-relaxed line-clamp-3 my-2 ${
                      filled ? 'font-bold text-zinc-900' : 'font-semibold text-zinc-400 italic'
                    }`}
                  >
                    {filled
                      ? `“${phraseText}”`
                      : slotIdx === 0
                      ? '“Mi plan ideal de fin de semana es...”'
                      : '“Algo que debes saber sobre mí es...”'}
                  </p>

                  <span className="text-[10.5px] font-extrabold text-zinc-400">
                    {filled ? 'Toca para editar' : 'Toca para responder'}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 6. VITRINA PÚBLICA DE REGALOS RECIBIDOS */}
        <GiftShowcaseCard
          user={userProfile}
          title="Mi vitrina de regalos"
          emptyText="Cuando alguien te envíe diamantes o regalos, aparecerán ordenados del mayor al menor."
          headerAction={
            <button
              type="button"
              onClick={onOpenGiftNotifications}
              className="text-[11px] font-extrabold text-[#FF2E54] hover:underline whitespace-nowrap"
            >
              Quién me regaló →
            </button>
          }
        />

        {/* 6.5 OPCIÓN DE MONETIZACIÓN OPCIONAL (COLORES ARMONIZADOS CHAMPAGNE & ROSE-GOLD) */}
        {isOwnerSession && (
          <section
            className={`relative overflow-hidden rounded-[26px] p-4 sm:p-5 border transition-all ${
              giftGateActive
                ? 'bg-gradient-to-br from-[#FFF9F2] via-white to-[#FFF0F4] border-[#FF2E54]/35 shadow-[0_14px_34px_-12px_rgba(255,46,84,0.16)]'
                : 'bg-gradient-to-br from-[#FFFDF9] via-white to-[#FFF7F9] border-amber-200/75 shadow-[0_8px_28px_-10px_rgba(15,23,42,0.07)]'
            }`}
          >
            <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-amber-200/25 blur-2xl pointer-events-none" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border transition ${
                    giftGateActive
                      ? 'bg-gradient-to-br from-[#FF2E54] to-amber-500 text-white border-transparent shadow-md shadow-rose-500/20'
                      : 'bg-gradient-to-br from-amber-50 to-rose-50 text-amber-700 border-amber-200/80'
                  }`}
                >
                  <Crown className="w-5 h-5 stroke-[2.2]" />
                </div>

                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-xs sm:text-sm font-black text-zinc-900 leading-tight">
                      Solo recibir chat si envían un regalo
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200/80 text-[9.5px] font-extrabold uppercase tracking-wider text-amber-800">
                      Opcional
                    </span>
                  </div>

                  <p className="text-[11px] text-zinc-600 leading-relaxed">
                    Monetiza tu tiempo: quienes quieran iniciar un chat nuevo contigo deberán enviarte cualquier regalo con Diamantes (desde 🌹 10 💎 retirables).
                  </p>

                  <div className="pt-0.5 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-extrabold border ${
                        giftGateActive
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-zinc-100 border-zinc-200/80 text-zinc-600'
                      }`}
                    >
                      <Gift className="w-3 h-3" />
                      {giftGateActive ? 'Monetización de chat activa' : 'Chat libre (sin regalo)'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={giftGateActive}
                disabled={togglingGiftGate}
                onClick={handleToggleGiftGate}
                className={`relative w-12 h-7 rounded-full shrink-0 transition-all duration-200 mt-0.5 ${
                  giftGateActive
                    ? 'bg-gradient-to-r from-[#FF2E54] to-amber-500 shadow-sm shadow-rose-500/25'
                    : 'bg-zinc-300/90'
                } disabled:opacity-50`}
                title="Activar o desactivar chat exclusivo con regalo"
              >
                <span
                  className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                    giftGateActive ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </section>
        )}

        {/* 7. BOTÓN DE EDICIÓN COMPLETA DE PERFIL */}
        <button
          type="button"
          onClick={() => setEditorOpen(true)}
          className="w-full py-3.5 rounded-full bg-zinc-900 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-zinc-900/15 hover:bg-zinc-800 active:scale-[0.99] transition"
        >
          <Pencil className="w-4 h-4" />
          Editar perfil público (fotos, bio e intereses)
        </button>
      </div>

      {/* Sheet rápido para editar "Mis frases" con auto-guardado */}
      {promptSheetIdx !== null && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-white rounded-t-[32px] sm:rounded-[32px] p-6 space-y-4 shadow-2xl animate-sheet-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-rose-50 border border-rose-200/80 text-[#FF2E54] flex items-center justify-center">
                  <Quote className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display text-base font-black text-zinc-900">
                    Frase personal #{promptSheetIdx + 1}
                  </h3>
                  <p className="text-[11px] font-medium text-zinc-500">
                    Destaca en tu perfil y rompe el hielo
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closePromptSheet}
                className="p-2 rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              rows={3}
              maxLength={140}
              value={promptDraft}
              onChange={(e) => handleQuickPromptChange(e.target.value, { immediate: false })}
              onBlur={() => promptSaverRef.current?.flush()}
              placeholder="Escribe algo auténtico que llame la atención..."
              className="w-full px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-200 text-sm font-semibold text-zinc-900 focus:outline-none focus:bg-white focus:border-[#FF2E54] focus:ring-4 focus:ring-rose-500/10 resize-none transition"
            />

            <div className="space-y-1.5">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400">
                Ideas rápidas (toca para aplicar al instante)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PROMPT_SUGGESTIONS.map((sugg, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleQuickPromptChange(sugg, { immediate: true })}
                    className="px-3 py-1.5 rounded-full bg-zinc-100 hover:bg-rose-50 hover:text-[#FF2E54] text-zinc-700 text-[11px] font-bold text-left transition"
                  >
                    {sugg}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              {promptSaveStatus.state === 'saving' || promptSaveStatus.state === 'pending' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-extrabold">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Guardando...
                </span>
              ) : promptSaveStatus.state === 'error' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-extrabold">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {promptSaveStatus.message || 'Error al guardar'}
                </span>
              ) : promptSaveStatus.state === 'saved' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-extrabold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Guardado automáticamente
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-zinc-400">
                  Auto-guardado en vivo
                </span>
              )}

              <button
                type="button"
                onClick={closePromptSheet}
                className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#FF2E54] to-rose-500 text-white text-xs sm:text-sm font-extrabold shadow-md shadow-[#FF2E54]/20 hover:brightness-105 transition"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Completo de Edición de Perfil Público */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md max-h-[92dvh] bg-white rounded-t-[32px] sm:rounded-[32px] flex flex-col overflow-hidden shadow-2xl animate-sheet-up">
            <div className="px-5 py-4 border-b border-zinc-200/80 flex items-center justify-between gap-2 bg-white">
              <div className="min-w-0">
                <h3 className="font-display text-base font-black text-zinc-900">
                  Editar Perfil Público
                </h3>
                <p className="text-[11px] font-semibold text-zinc-500">
                  Completitud actual: {completion.percent}%
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {profileSaveStatus.state === 'saving' || profileSaveStatus.state === 'pending' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-extrabold">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Guardando...
                  </span>
                ) : profileSaveStatus.state === 'error' ? (
                  <span
                    title={profileSaveStatus.message}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-extrabold max-w-[140px] truncate"
                  >
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span className="truncate">{profileSaveStatus.message}</span>
                  </span>
                ) : profileSaveStatus.state === 'saved' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-extrabold">
                    <CheckCircle2 className="w-3 h-3" />
                    Guardado
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={closeEditor}
                  className="p-2 rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition"
                  aria-label="Cerrar editor"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-5 bg-[#FAF8FA]">
              <div onBlurCapture={() => profileSaverRef.current?.flush()} className="space-y-4">
                <div className="p-4 rounded-3xl bg-white border border-zinc-200/80 shadow-sm">
                  <PhotoUploader
                    photos={photos}
                    onChange={(nextPhotos) =>
                      updateEditorField({ photos: nextPhotos }, { immediate: true })
                    }
                    exclusivePhotoUrls={exclusivePhotoUrls}
                    onExclusiveChange={(nextExclusive) =>
                      updateEditorField({ exclusivePhotoUrls: nextExclusive }, { immediate: true })
                    }
                    exclusiveCostDiamonds={exclusiveCostDiamonds}
                    onError={onError}
                    smartPhotos={Boolean(userProfile?.smartPhotos)}
                    photoLikeCounts={photoLikeCounts}
                    bestPhotoUrl={bestPhotoUrl}
                  />
                </div>

                {isOwnerSession && (
                  <button
                    type="button"
                    onClick={() => {
                      closeEditor();
                      setSettingsOpen(true);
                    }}
                    className="w-full p-3.5 rounded-2xl bg-white border border-zinc-200/80 hover:border-rose-200 flex items-center justify-between gap-3 text-left shadow-sm transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-rose-50 text-[#FF2E54] flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-[18px] h-[18px]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-zinc-900">
                          Smart Photos, Privacidad y GPS
                        </p>
                        <p className="text-[11px] text-zinc-500 truncate">
                          Configura visibilidad, edad y cobros en Ajustes Privados
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-extrabold text-[#FF2E54] shrink-0">
                      Abrir →
                    </span>
                  </button>
                )}

                <div className="p-4 rounded-3xl bg-white border border-zinc-200/80 shadow-sm space-y-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-zinc-600 block mb-1">Nombre</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => updateEditorField({ name: e.target.value })}
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold text-zinc-900 focus:outline-none focus:bg-white focus:border-[#FF2E54]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-zinc-600 block mb-1">Edad</label>
                      <input
                        type="number"
                        min={MIN_AGE}
                        max={99}
                        value={age}
                        onChange={(e) => updateEditorField({ age: e.target.value })}
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold text-zinc-900 focus:outline-none focus:bg-white focus:border-[#FF2E54]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-zinc-600 block mb-1">Género</label>
                      <select
                        value={gender}
                        onChange={(e) =>
                          updateEditorField({ gender: e.target.value }, { immediate: true })
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold text-zinc-900 focus:outline-none focus:bg-white focus:border-[#FF2E54]"
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
                        onChange={(e) =>
                          updateEditorField({ interestedIn: e.target.value }, { immediate: true })
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold text-zinc-900 focus:outline-none focus:bg-white focus:border-[#FF2E54]"
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
                        onChange={(e) =>
                          updateEditorField({ countryCode: e.target.value }, { immediate: true })
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold text-zinc-900 focus:outline-none focus:bg-white focus:border-[#FF2E54]"
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
                        onChange={(e) => updateEditorField({ city: e.target.value })}
                        placeholder="Ej. Caracas, Bogotá..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold text-zinc-900 focus:outline-none focus:bg-white focus:border-[#FF2E54]"
                      />
                    </div>
                  </div>
                </div>

                {/* Qué buscas */}
                <div className="p-4 rounded-3xl bg-white border border-zinc-200/80 shadow-sm space-y-2.5">
                  <label className="text-xs font-bold text-zinc-700 block">
                    ¿Qué estás buscando? (Te muestra en Explorar)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {LOOKING_FOR_OPTIONS.map((opt) => (
                      <button
                        type="button"
                        key={opt}
                        onClick={() => updateEditorField({ lookingFor: opt }, { immediate: true })}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold border text-left transition ${
                          lookingFor === opt
                            ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
                            : 'bg-zinc-50 text-zinc-700 border-zinc-200/70 hover:bg-zinc-100'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Atributos adicionales */}
                <div className="p-4 rounded-3xl bg-white border border-zinc-200/80 shadow-sm space-y-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-zinc-600 block mb-1">Estatura</label>
                      <input
                        type="text"
                        value={height}
                        onChange={(e) => updateEditorField({ height: e.target.value })}
                        placeholder="Ej. 1.75 m"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold text-zinc-900 focus:outline-none focus:bg-white focus:border-[#FF2E54]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-zinc-600 block mb-1">Empleo / Profesión</label>
                      <input
                        type="text"
                        value={job}
                        onChange={(e) => updateEditorField({ job: e.target.value })}
                        placeholder="Ej. Diseñador, Médico"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold text-zinc-900 focus:outline-none focus:bg-white focus:border-[#FF2E54]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-zinc-600 block mb-1">Educación</label>
                      <input
                        type="text"
                        value={education}
                        onChange={(e) => updateEditorField({ education: e.target.value })}
                        placeholder="Ej. Universitaria"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold text-zinc-900 focus:outline-none focus:bg-white focus:border-[#FF2E54]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-zinc-600 block mb-1">Estilo de vida</label>
                      <select
                        value={lifestyle}
                        onChange={(e) =>
                          updateEditorField({ lifestyle: e.target.value }, { immediate: true })
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold text-zinc-900 focus:outline-none focus:bg-white focus:border-[#FF2E54]"
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
                      onChange={(e) => updateEditorField({ bio: e.target.value })}
                      placeholder="Cuéntale a la comunidad quién eres..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold text-zinc-900 focus:outline-none focus:bg-white focus:border-[#FF2E54] resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-600 block">Mis 2 Frases</label>
                    <input
                      type="text"
                      placeholder="Frase 1: Mi plan ideal de fin de semana es..."
                      value={prompts[0] || ''}
                      onChange={(e) =>
                        updateEditorField({
                          prompts: [e.target.value, editorDraftRef.current.prompts?.[1] || ''],
                        })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold text-zinc-900 focus:outline-none focus:bg-white focus:border-[#FF2E54]"
                    />
                    <input
                      type="text"
                      placeholder="Frase 2: Algo que debes saber sobre mí es..."
                      value={prompts[1] || ''}
                      onChange={(e) =>
                        updateEditorField({
                          prompts: [editorDraftRef.current.prompts?.[0] || '', e.target.value],
                        })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold text-zinc-900 focus:outline-none focus:bg-white focus:border-[#FF2E54]"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-3xl bg-white border border-zinc-200/80 shadow-sm space-y-2.5">
                  <label className="text-xs font-bold text-zinc-700 block">
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
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                            active
                              ? 'bg-gradient-to-r from-[#FF2E54] to-rose-500 text-white shadow-sm'
                              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                          }`}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="text-[11px] font-semibold text-zinc-500">
                    {profileSaveStatus.state === 'error'
                      ? profileSaveStatus.message
                      : 'Todos tus cambios se guardan automáticamente'}
                  </span>
                  <button
                    type="button"
                    onClick={closeEditor}
                    className="px-6 py-3 rounded-full bg-zinc-900 text-white text-xs sm:text-sm font-extrabold shadow-lg hover:bg-zinc-800 transition shrink-0"
                  >
                    Listo
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isOwnerSession && (
        <AccountSettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          userProfile={userProfile}
          currentAuthUid={currentAuthUid}
          myReportsCount={myReportsCount}
          unreadGiftsCount={unreadGiftsCount}
          receivedGiftsCount={receivedGifts.length}
          onOpenDiamondStore={onOpenDiamondStore}
          onOpenWithdrawals={onOpenWithdrawals}
          onOpenBoost={onOpenBoost}
          onOpenSafetyCenter={onOpenSafetyCenter}
          onOpenGiftNotifications={onOpenGiftNotifications}
          onOpenAdmin={onOpenAdmin}
          onSuccess={onSuccess}
          onError={onError}
        />
      )}
    </div>
  );
}
