import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, MapPin, Sparkles, UserCheck } from 'lucide-react';
import {
  COUNTRIES,
  GENDERS,
  INTERESTED_IN_OPTIONS,
  INTERESTS_CATALOG,
  LOOKING_FOR_OPTIONS,
  MIN_AGE,
} from '../../config/constants';
import { completeOnboarding } from '../../services/userService';
import PhotoUploader from '../profile/PhotoUploader';

export default function OnboardingWizard({ userProfile, onError, onSuccess }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(userProfile?.name || '');
  const [age, setAge] = useState(userProfile?.age || 22);
  const [gender, setGender] = useState(userProfile?.gender || GENDERS[0]);
  const [interestedIn, setInterestedIn] = useState(
    userProfile?.interestedIn || INTERESTED_IN_OPTIONS[2]
  );
  const [countryCode, setCountryCode] = useState(userProfile?.country?.code || COUNTRIES[0].code);
  const [city, setCity] = useState(userProfile?.city || '');
  const [lookingFor, setLookingFor] = useState(userProfile?.lookingFor || LOOKING_FOR_OPTIONS[1]);
  const [bio, setBio] = useState(userProfile?.bio || '');
  const [interests, setInterests] = useState(userProfile?.interests || []);
  const [photos, setPhotos] = useState(userProfile?.photos || []);

  useEffect(() => {
    if (!userProfile?.uid) return;
    setName(userProfile.name && userProfile.name !== 'Nuevo Usuario' ? userProfile.name : '');
    setAge(userProfile.age || 22);
    setGender(userProfile.gender || GENDERS[0]);
    setInterestedIn(userProfile.interestedIn || INTERESTED_IN_OPTIONS[2]);
    setCountryCode(userProfile.country?.code || COUNTRIES[0].code);
    setCity(userProfile.city || '');
    setLookingFor(userProfile.lookingFor || LOOKING_FOR_OPTIONS[1]);
    setBio(userProfile.bio || '');
    setInterests(userProfile.interests || []);
    setPhotos(userProfile.photos || []);
  }, [userProfile?.uid]);

  const toggleInterest = (item) => {
    setInterests((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item].slice(0, 10)
    );
  };

  const handleNext = () => {
    if (step === 1) {
      if (!name.trim()) return onError?.('Ingresa tu nombre.');
      if (Number(age) < MIN_AGE) return onError?.(`Debes ser mayor de ${MIN_AGE} años.`);
    }
    if (step === 2) {
      if (!city.trim()) return onError?.('Ingresa tu ciudad.');
    }
    setStep((s) => Math.min(3, s + 1));
  };

  const handleFinish = async (e) => {
    e.preventDefault();
    if (!bio.trim()) {
      return onError?.('Escribe una breve biografía para presentarte.');
    }
    if (interests.length < 2) {
      return onError?.('Elige al menos 2 intereses.');
    }

    const country = COUNTRIES.find((c) => c.code === countryCode) || COUNTRIES[0];
    setSaving(true);
    try {
      await completeOnboarding(userProfile.uid, {
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
      onSuccess?.('¡Perfil creado! Ya puedes explorar y chatear en privado.');
    } catch (err) {
      onError?.(err.message || 'No se pudo guardar tu perfil.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-luxury-mesh flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white/95 border border-rose-100 rounded-[32px] p-6 sm:p-7 shadow-luxury backdrop-blur-xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-50 to-rose-100 text-brand-600 flex items-center justify-center border border-rose-200/60 shadow-sm">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-extrabold text-slate-900">Personaliza tu Perfil</h2>
              <p className="text-xs font-medium text-slate-500">Paso {step} de 3 • Perfil independiente</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-2 w-7 rounded-full transition-all ${
                  s <= step ? 'bg-gradient-to-r from-brand-500 to-rose-500' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>

        <form onSubmit={handleFinish} className="space-y-4">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">¿Cómo te llamas?</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium focus:outline-none focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                  placeholder="Tu nombre o apodo visible"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Edad (+{MIN_AGE})
                  </label>
                  <input
                    type="number"
                    min={MIN_AGE}
                    max={99}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium focus:outline-none focus:bg-white focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">Soy</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium focus:outline-none focus:bg-white focus:border-brand-500"
                  >
                    {GENDERS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-2">
                  Me interesa conocer
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {INTERESTED_IN_OPTIONS.map((opt) => (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => setInterestedIn(opt)}
                      className={`py-2.5 px-3 rounded-2xl text-xs font-bold border transition ${
                        interestedIn === opt
                          ? 'bg-brand-50 border-brand-500 text-brand-700 shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">País</label>
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium focus:outline-none focus:bg-white focus:border-brand-500"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Ciudad</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-brand-500 absolute left-4 top-3.5" />
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ej. Bogotá, Caracas, Madrid, CDMX..."
                    className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium focus:outline-none focus:bg-white focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-2">
                  ¿Qué tipo de conexión buscas?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {LOOKING_FOR_OPTIONS.map((opt) => (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => setLookingFor(opt)}
                      className={`py-2.5 px-3 rounded-2xl text-left text-xs font-bold border flex items-center justify-between gap-1 transition ${
                        lookingFor === opt
                          ? 'bg-brand-50 border-brand-500 text-brand-700 shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span className="truncate">{opt}</span>
                      {lookingFor === opt && <Check className="w-3.5 h-3.5 text-brand-600 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 max-h-[66vh] overflow-y-auto pr-1">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Sobre ti (Biografía)</label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={280}
                  placeholder="Cuéntale a la comunidad sobre ti, tus planes favoritos o idiomas..."
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium focus:outline-none focus:bg-white focus:border-brand-500 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-2">
                  Tus Intereses ({interests.length}/10 — elige al menos 2)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {INTERESTS_CATALOG.map((item) => {
                    const active = interests.includes(item);
                    return (
                      <button
                        type="button"
                        key={item}
                        onClick={() => toggleInterest(item)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                          active
                            ? 'bg-gradient-to-r from-brand-500 to-rose-500 text-white border-transparent shadow-sm'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-brand-300'
                        }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>

              <PhotoUploader photos={photos} onChange={setPhotos} onError={onError} />
            </div>
          )}

          <div className="flex items-center gap-2.5 pt-3">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="px-4 py-3.5 rounded-2xl bg-slate-100 text-slate-700 text-sm font-bold hover:bg-slate-200 transition flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                Atrás
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-brand-500 to-rose-500 text-white text-sm font-extrabold flex items-center justify-center gap-1.5 shadow-lg shadow-brand-500/20 hover:brightness-105 transition"
              >
                Continuar
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-brand-500 via-rose-500 to-amber-500 text-white text-sm font-extrabold flex items-center justify-center gap-1.5 shadow-lg shadow-brand-500/25 disabled:opacity-60 transition"
              >
                <Sparkles className="w-4 h-4" />
                {saving ? 'Guardando...' : 'Comenzar a Conectar'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
