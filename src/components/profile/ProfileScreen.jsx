import { useState } from 'react';
import {
  ArrowDownToLine,
  Coins,
  Flame,
  Gem,
  Gift,
  LogOut,
  Save,
  ShieldCheck,
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
      onSuccess?.('Perfil actualizado correctamente.');
    } catch (err) {
      onError?.(err.message || 'No se pudo actualizar tu perfil.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header Profile Card */}
      <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 flex items-center gap-3.5">
        <img
          src={getPrimaryPhoto(userProfile)}
          alt={userProfile?.name}
          className="w-20 h-20 rounded-2xl object-cover border-2 border-brand-500/60 shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="text-lg font-extrabold text-white truncate">
              {userProfile?.name}, {userProfile?.age}
            </h2>
            {userProfile?.role === 'admin' && (
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold">
                ADMIN
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 truncate">
            {userProfile?.country?.flag} {userProfile?.city}, {userProfile?.country?.name}
          </p>
          <div className="flex items-center gap-3 mt-2 text-xs font-bold">
            <span className="text-rose-400 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5" /> {userProfile?.likesCount || 0}
            </span>
            <span className="text-amber-300 flex items-center gap-1">
              <Gift className="w-3.5 h-3.5" /> {userProfile?.giftsReceivedCount || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Monetization & Withdrawals Hub */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={onOpenCoinStore}
          className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/20 to-brand-500/15 border border-amber-400/40 text-left hover:brightness-110 transition"
        >
          <div className="flex items-center justify-between">
            <Coins className="w-5 h-5 text-amber-400" />
            <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-extrabold">
              Recargar
            </span>
          </div>
          <p className="text-xl font-extrabold text-white mt-2">{userProfile?.coins || 0}</p>
          <p className="text-[11px] text-amber-200/90">Monedas disponibles</p>
        </button>

        <button
          type="button"
          onClick={onOpenWithdrawals}
          className="p-3.5 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/15 border border-cyan-400/40 text-left hover:brightness-110 transition"
        >
          <div className="flex items-center justify-between">
            <Gem className="w-5 h-5 text-cyan-400" />
            <span className="px-2 py-0.5 rounded-full bg-emerald-400 text-slate-950 text-[10px] font-extrabold flex items-center gap-0.5">
              <ArrowDownToLine className="w-2.5 h-2.5" /> Retirar
            </span>
          </div>
          <p className="text-xl font-extrabold text-white mt-2">
            {userProfile?.earningsDiamonds || 0}
          </p>
          <p className="text-[11px] text-emerald-300 font-semibold">
            Ganancias: {formatUSD(earningsPreview.netPayoutUSD)}
          </p>
        </button>
      </div>

      {/* Boost & Admin Shortcuts */}
      <button
        type="button"
        onClick={onOpenBoost}
        className="w-full p-3.5 rounded-2xl bg-slate-900 border border-amber-500/35 flex items-center justify-between hover:border-amber-400 transition"
      >
        <div className="flex items-center gap-3 text-left">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <Zap className="w-5 h-5 fill-amber-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Boost VIP en {userProfile?.country?.name}</p>
            <p className="text-[11px] text-slate-400">
              {boosted
                ? `Activo • Expira en ${formatTimeRemaining(userProfile.boostExpiresAt)}`
                : 'Destácate en el carrusel superior desde 100 monedas'}
            </p>
          </div>
        </div>
        <span className="text-xs font-extrabold text-amber-300">
          {boosted ? 'Extender' : 'Activar'}
        </span>
      </button>

      {userProfile?.role === 'admin' && (
        <button
          type="button"
          onClick={onOpenAdmin}
          className="w-full p-3.5 rounded-2xl bg-indigo-500/15 border border-indigo-400/50 flex items-center justify-between hover:bg-indigo-500/25 transition"
        >
          <div className="flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/25 text-indigo-300 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Panel de Super Admin</p>
              <p className="text-[11px] text-indigo-200">
                Auditar recargas y pagar retiros de ganancias
              </p>
            </div>
          </div>
          <span className="text-xs font-extrabold text-indigo-300">Abrir →</span>
        </button>
      )}

      {/* Profile Editor */}
      <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-white">Mi Información</h3>
          <button
            type="button"
            onClick={() => {
              if (!editing) {
                setName(userProfile?.name || '');
                setAge(userProfile?.age || 18);
                setGender(userProfile?.gender || GENDERS[0]);
                setInterestedIn(userProfile?.interestedIn || 'Todos');
                setCountryCode(userProfile?.country?.code || COUNTRIES[0].code);
                setCity(userProfile?.city || '');
                setLookingFor(userProfile?.lookingFor || LOOKING_FOR_OPTIONS[0]);
                setBio(userProfile?.bio || '');
                setInterests(userProfile?.interests || []);
                setPhotos(userProfile?.photos || []);
              }
              setEditing((v) => !v);
            }}
            className="px-3 py-1 rounded-full bg-slate-800 text-xs font-bold text-brand-300 hover:bg-slate-700"
          >
            {editing ? 'Cancelar' : 'Editar perfil'}
          </button>
        </div>

        {!editing ? (
          <div className="space-y-3 text-xs">
            <p className="text-slate-300 leading-relaxed">
              {userProfile?.bio || 'Sin biografía.'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(userProfile?.interests || []).map((i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-full bg-slate-950 border border-slate-800 text-slate-300"
                >
                  {i}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-3.5">
            <PhotoUploader photos={photos} onChange={setPhotos} onError={onError} />

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">Nombre</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">Edad</label>
                <input
                  type="number"
                  min={MIN_AGE}
                  max={99}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">Género</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                >
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">Interés</label>
                <select
                  value={interestedIn}
                  onChange={(e) => setInterestedIn(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                >
                  {INTERESTED_IN_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">País</label>
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">Ciudad</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 font-semibold block mb-1">Buscando</label>
              <select
                value={lookingFor}
                onChange={(e) => setLookingFor(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs"
              >
                {LOOKING_FOR_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 font-semibold block mb-1">Biografía</label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs resize-none"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 font-semibold block mb-1.5">
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
                      className={`px-2.5 py-1 rounded-full text-[11px] border ${
                        active
                          ? 'bg-brand-500 text-white border-brand-400'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
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
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-brand-500 to-pink-500 text-white text-xs font-extrabold flex items-center justify-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </form>
        )}
      </div>

      {/* Sign out */}
      <button
        type="button"
        onClick={() => logoutUser(userProfile?.uid)}
        className="w-full py-3 rounded-2xl bg-slate-900 border border-slate-800 text-rose-400 text-xs font-bold flex items-center justify-center gap-2 hover:bg-rose-500/10 transition"
      >
        <LogOut className="w-4 h-4" />
        Cerrar Sesión
      </button>
    </div>
  );
}
