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

const STEP_META = [
  { num: 1, title: 'Tu identidad', subtitle: 'Paso 1 de 3 • Cuéntanos quién eres' },
  { num: 2, title: 'Ubicación y meta', subtitle: 'Paso 2 de 3 • Qué buscas en la comunidad' },
  { num: 3, title: 'Fotos y gustos', subtitle: 'Paso 3 de 3 • Destaca con fotos reales' },
];

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
      onSuccess?.('¡Perfil listo! Ya puedes deslizar y chatear en privado.');
    } catch (err) {
      onError?.(err.message || 'No se pudo guardar tu perfil.');
    } finally {
      setSaving(false);
    }
  };

  const meta = STEP_META[step - 1];

  return (
    <div className="min-h-full bg-luxury-mesh flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white border border-zinc-200/80 rounded-[32px] p-6 sm:p-7 shadow-luxury animate-sheet-up">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-50 text-[#FF2E54] flex items-center justify-center border border-rose-100">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-extrabold text-zinc-900">{meta.title}</h2>
              <p className="text-xs font-medium text-zinc-500">{meta.subtitle}</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-2 w-6 rounded-full transition-all ${
                  s <= step ? 'bg-[#FF2E54]' : 'bg-zinc-200'
                }`}
              />
            ))}
          </div>
        </div>

        <form onSubmit={handleFinish} className="space-y-4">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-zinc-700 block mb-1.5">¿Cómo te llamas?</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-200 text-zinc-900 text-sm font-semibold focus:outline-none focus:bg-white focus:border-zinc-900 transition"
                  placeholder="Tu nombre o apodo visible"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-zinc-700 block mb-1.5">
                    Edad (+{MIN_AGE})
                  </label>
                  <input
                    type="number"
                    min={MIN_AGE}
                    max={99}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-200 text-zinc-900 text-sm font-semibold focus:outline-none focus:bg-white focus:border-zinc-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-700 block mb-1.5">Soy</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-200 text-zinc-900 text-sm font-semibold focus:outline-none focus:bg-white focus:border-zinc-900"
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
                <label className="text-xs font-bold text-zinc-700 block mb-2">
                  Me interesa conocer
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {INTERESTED_IN_OPTIONS.map((opt) => (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => setInterestedIn(opt)}
                      className={`py-2.5 px-3 rounded-2xl text-xs font-extrabold border transition ${
                        interestedIn === opt
                          ? 'bg-zinc-900 border-zinc-900 text-white shadow-sm'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
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
                <label className="text-xs font-bold text-zinc-700 block mb-1.5">País</label>
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-200 text-zinc-900 text-sm font-semibold focus:outline-none focus:bg-white focus:border-zinc-900"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-700 block mb-1.5">Ciudad</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-[#FF2E54] absolute left-4 top-3.5" />
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ej. Bogotá, Caracas, Madrid, CDMX..."
                    className="w-full pl-11 pr-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-200 text-zinc-900 text-sm font-semibold focus:outline-none focus:bg-white focus:border-zinc-900"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-700 block mb-2">
                  ¿Qué tipo de conexión buscas?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {LOOKING_FOR_OPTIONS.map((opt) => (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => setLookingFor(opt)}
                      className={`py-2.5 px-3 rounded-2xl text-left text-xs font-extrabold border flex items-center justify-between gap-1 transition ${
                        lookingFor === opt
                          ? 'bg-zinc-900 border-zinc-900 text-white shadow-sm'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                      }`}
                    >
                      <span className="truncate">{opt}</span>
                      {lookingFor === opt && <Check className="w-3.5 h-3.5 text-[#FF2E54] shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 max-h-[64vh] overflow-y-auto no-scrollbar pr-0.5">
              <div>
                <label className="text-xs font-bold text-zinc-700 block mb-1.5">Sobre ti (Biografía)</label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={280}
                  placeholder="Cuéntale a la comunidad sobre ti, tus planes favoritos o idiomas..."
                  className="w-full px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-200 text-zinc-900 text-sm font-medium focus:outline-none focus:bg-white focus:border-zinc-900 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-700 block mb-2">
                  Tus Intereses ({interests.length}/10 — mínimo 2)
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
                            ? 'bg-zinc-900 text-white border-zinc-900'
                            : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-zinc-400'
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

          <div className="flex items-center gap-2.5 pt-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="px-4 py-3.5 rounded-full bg-zinc-100 text-zinc-700 text-sm font-bold hover:bg-zinc-200 transition flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                Atrás
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex-1 py-3.5 rounded-full bg-zinc-900 text-white text-sm font-extrabold flex items-center justify-center gap-1.5 shadow-md hover:bg-zinc-800 transition"
              >
                Continuar
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-3.5 rounded-full bg-gradient-to-r from-[#FF2E54] to-[#FF5E7E] text-white text-sm font-extrabold flex items-center justify-center gap-1.5 shadow-lg shadow-[#FF2E54]/25 disabled:opacity-60 transition"
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
