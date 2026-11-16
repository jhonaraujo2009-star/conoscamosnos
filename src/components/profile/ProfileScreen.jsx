import { useEffect, useState } from 'react';
import {
  ArrowDownToLine,
  Coins,
  Eye,
  Flame,
  Gem,
  Gift,
  LogOut,
  Mail,
  MapPin,
  Save,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  COUNTRIES,
  GENDERS,
  INTERESTED_IN_OPTIONS,
  INTERESTS_CATALOG,
  LOOKING_FOR_OPTIONS,
  MIN_AGE,
} from '../../config/constants';
import { logoutUser } from '../../services/authService';
import { updateUserProfile } from '../../services/userService';
import {
  calculateWithdrawalBreakdown,
  formatTimeRemaining,
  formatUSD,
  getPrimaryPhoto,
  isBoostActive,
} from '../../utils/formatters';
import PhotoUploader from './PhotoUploader';

export default function ProfileScreen({
  userProfile,
  onPreviewOwnProfile,
  onOpenCoinStore,
  onOpenWithdrawals,
  onOpenBoost,
  onOpenAdmin,
  onSuccess,
  onError,
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(userProfile?.name || '');
  const [age, setAge] = useState(userProfile?.age || 18);
  const [gender, setGender] = useState(userProfile?.gender || GENDERS[0]);
  const [interestedIn, setInterestedIn] = useState(userProfile?.interestedIn || 'Todos');
  const [countryCode, setCountryCode] = useState(userProfile?.country?.code || COUNTRIES[0].code);
  const [city, setCity] = useState(userProfile?.city || '');
  const [lookingFor, setLookingFor] = useState(userProfile?.lookingFor || LOOKING_FOR_OPTIONS[0]);
  const [bio, setBio] = useState(userProfile?.bio || '');
  const [interests, setInterests] = useState(userProfile?.interests || []);
  const [photos, setPhotos] = useState(userProfile?.photos || []);

  // Sincronizar datos si cambia el perfil activo
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
    setInterests(userProfile.interests || []);
    setPhotos(userProfile.photos || []);
    setEditing(false);
  }, [userProfile?.uid]);

  const boosted = isBoostActive(userProfile);
  const earningsPreview = calculateWithdrawalBreakdown(userProfile?.earningsDiamonds || 0);

  const toggleInterest = (item) => {
    setInterests((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item].slice(0, 10)
    );
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
        interests,
        photos,
      });
      setEditing(false);
      onSuccess?.('Tu perfil independiente se actualizó correctamente.');
    } catch (err) {
      onError?.(err.message || 'No se pudo actualizar tu perfil.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header Profile Hero Card */}
      <div className="p-5 rounded-3xl bg-white border border-rose-100/90 shadow-card space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <img
              src={getPrimaryPhoto(userProfile)}
              alt={userProfile?.name}
              className="w-20 h-20 rounded-3xl object-cover border-2 border-rose-200 shadow-md"
            />
            <span className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-extrabold ring-2 ring-white">
              Activo
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="font-display text-xl font-extrabold text-slate-900 truncate">
                {userProfile?.name}, {userProfile?.age}
              </h2>
              {userProfile?.role === 'admin' && (
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-extrabold">
                  ADMIN
                </span>
              )}
            </div>

            <p className="text-xs font-medium text-slate-500 truncate flex items-center gap-1 mt-0.5">
              <span>{userProfile?.country?.flag}</span>
              <MapPin className="w-3.5 h-3.5 text-brand-500 shrink-0" />
              <span className="truncate">
                {userProfile?.city ? `${userProfile.city}, ` : ''}
                {userProfile?.country?.name}
              </span>
            </p>

            {userProfile?.email && (
              <p className="text-[11px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                <Mail className="w-3 h-3 shrink-0" />
                <span className="truncate">{userProfile.email}</span>
              </p>
            )}

            <div className="flex items-center gap-3 mt-2 text-xs font-extrabold">
              <span className="text-rose-500 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 fill-rose-500" /> {userProfile?.likesCount || 0} Likes
              </span>
              <span className="text-amber-600 flex items-center gap-1">
                <Gift className="w-3.5 h-3.5" /> {userProfile?.giftsReceivedCount || 0} Regalos
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={onPreviewOwnProfile}
            className="py-2.5 px-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-slate-100 transition"
          >
            <Eye className="w-4 h-4 text-brand-500" />
            Vista previa
          </button>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="py-2.5 px-3 rounded-2xl bg-rose-50 border border-rose-200/80 text-brand-600 text-xs font-extrabold flex items-center justify-center gap-1.5 hover:bg-rose-100/70 transition"
          >
            <Sparkles className="w-4 h-4" />
            {editing ? 'Cancelar edición' : 'Editar mi perfil'}
          </button>
        </div>
      </div>

      {/* Monetization & Withdrawals Hub */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onOpenCoinStore}
          className="p-4 rounded-3xl bg-gradient-to-br from-amber-50 via-white to-rose-50 border border-amber-200/90 text-left shadow-card hover:shadow-md transition"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <Coins className="w-5 h-5" />
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-extrabold shadow-sm">
              + Recargar
            </span>
          </div>
          <p className="font-display text-2xl font-extrabold text-slate-900 mt-2.5">
            {userProfile?.coins || 0}
          </p>
          <p className="text-[11px] font-bold text-slate-500">Monedas disponibles</p>
        </button>

        <button
          type="button"
          onClick={onOpenWithdrawals}
          className="p-4 rounded-3xl bg-gradient-to-br from-sky-50 via-white to-emerald-50 border border-sky-200/90 text-left shadow-card hover:shadow-md transition"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center">
              <Gem className="w-5 h-5" />
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-extrabold flex items-center gap-0.5 shadow-sm">
              <ArrowDownToLine className="w-2.5 h-2.5" /> Retirar
            </span>
          </div>
          <p className="font-display text-2xl font-extrabold text-slate-900 mt-2.5">
            {userProfile?.earningsDiamonds || 0}
          </p>
          <p className="text-[11px] font-extrabold text-emerald-600">
            Retirable: {formatUSD(earningsPreview.netPayoutUSD)}
          </p>
        </button>
      </div>

      {/* Boost & Admin Shortcuts */}
      <button
        type="button"
        onClick={onOpenBoost}
        className="w-full p-4 rounded-3xl bg-white border border-amber-200/90 shadow-card flex items-center justify-between hover:border-amber-400 transition"
      >
        <div className="flex items-center gap-3 text-left">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-500 flex items-center justify-center">
            <Zap className="w-5 h-5 fill-amber-400" />
          </div>
          <div>
            <p className="text-sm font-extrabold text-slate-900">
              Boost VIP en {userProfile?.country?.name}
            </p>
            <p className="text-xs text-slate-500">
              {boosted
                ? `Activo • Expira en ${formatTimeRemaining(userProfile.boostExpiresAt)}`
                : 'Destácate en el carrusel superior de tu país'}
            </p>
          </div>
        </div>
        <span className="px-3 py-1.5 rounded-xl bg-amber-100 text-xs font-extrabold text-amber-800">
          {boosted ? 'Extender' : 'Activar'}
        </span>
      </button>

      {userProfile?.role === 'admin' && (
        <button
          type="button"
          onClick={onOpenAdmin}
          className="w-full p-4 rounded-3xl bg-indigo-50/80 border border-indigo-200 flex items-center justify-between hover:bg-indigo-100/70 transition shadow-sm"
        >
          <div className="flex items-center gap-3 text-left">
            <div className="w-11 h-11 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-slate-900">Panel de Super Admin</p>
              <p className="text-xs text-indigo-700">
                Auditar recargas y pagar retiros de ganancias
              </p>
            </div>
          </div>
          <span className="text-xs font-extrabold text-indigo-700">Abrir →</span>
        </button>
      )}

      {/* Profile Information / Editor */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-extrabold text-slate-900">
            Información de mi Perfil
          </h3>
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs font-extrabold text-brand-600 hover:underline"
            >
              Modificar
            </button>
          )}
        </div>

        {!editing ? (
          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                Biografía
              </p>
              <p className="text-slate-700 font-medium leading-relaxed">
                {userProfile?.bio || 'Sin biografía.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/60">
                <p className="text-[10px] font-extrabold uppercase text-slate-400">Buscando</p>
                <p className="text-xs font-bold text-slate-800 mt-0.5">{userProfile?.lookingFor}</p>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/60">
                <p className="text-[10px] font-extrabold uppercase text-slate-400">Conectar con</p>
                <p className="text-xs font-bold text-slate-800 mt-0.5">{userProfile?.interestedIn}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {(userProfile?.interests || []).map((i) => (
                <span
                  key={i}
                  className="px-3 py-1 rounded-full bg-rose-50 border border-rose-100 text-brand-700 font-bold"
                >
                  {i}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <PhotoUploader photos={photos} onChange={setPhotos} onError={onError} />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-600 font-bold block mb-1">Nombre</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:bg-white focus:border-brand-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-600 font-bold block mb-1">Edad</label>
                <input
                  type="number"
                  min={MIN_AGE}
                  max={99}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:bg-white focus:border-brand-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-600 font-bold block mb-1">Género</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900"
                >
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-600 font-bold block mb-1">Me interesa</label>
                <select
                  value={interestedIn}
                  onChange={(e) => setInterestedIn(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900"
                >
                  {INTERESTED_IN_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-600 font-bold block mb-1">País</label>
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-600 font-bold block mb-1">Ciudad</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-600 font-bold block mb-1">Buscando</label>
              <select
                value={lookingFor}
                onChange={(e) => setLookingFor(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900"
              >
                {LOOKING_FOR_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-600 font-bold block mb-1">Biografía</label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 resize-none"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-600 font-bold block mb-1.5">
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
                      className={`px-3 py-1 rounded-full text-[11px] font-bold border transition ${
                        active
                          ? 'bg-brand-500 text-white border-brand-500'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
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
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-brand-500 to-rose-500 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-md shadow-brand-500/20"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </form>
        )}
      </div>

      {/* Sign out / Switch Account */}
      <button
        type="button"
        onClick={() => logoutUser(userProfile?.uid)}
        className="w-full py-3.5 rounded-2xl bg-white border border-rose-200 text-rose-600 text-xs font-extrabold flex items-center justify-center gap-2 hover:bg-rose-50 shadow-sm transition"
      >
        <LogOut className="w-4 h-4" />
        Cerrar Sesión / Cambiar de Cuenta
      </button>
    </div>
  );
}
