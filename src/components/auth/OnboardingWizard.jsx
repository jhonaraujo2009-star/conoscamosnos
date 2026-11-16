import { useState } from 'react';
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
      onSuccess?.('¡Perfil completado! Bienvenido a Conoscamosnos.');
    } catch (err) {
      onError?.(err.message || 'No se pudo guardar tu perfil.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Completa tu Perfil</h2>
              <p className="text-xs text-slate-400">Paso {step} de 3</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 w-7 rounded-full transition ${
                  s <= step ? 'bg-brand-500' : 'bg-slate-800'
                }`}
              />
            ))}
          </div>
        </div>

        <form onSubmit={handleFinish} className="space-y-4">
          {step === 1 && (
            <div className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Nombre</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-sm focus:outline-none focus:border-brand-500"
                  placeholder="Tu nombre visible"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">
                    Edad (+{MIN_AGE})
                  </label>
                  <input
                    type="number"
                    min={MIN_AGE}
                    max={99}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-sm focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Género</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-sm focus:outline-none focus:border-brand-500"
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
                <label className="text-xs font-semibold text-slate-400 block mb-1.5">
                  Me interesa conectar con
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {INTERESTED_IN_OPTIONS.map((opt) => (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => setInterestedIn(opt)}
                      className={`py-2 px-2 rounded-xl text-xs font-semibold border transition ${
                        interestedIn === opt
                          ? 'bg-brand-500/20 border-brand-500 text-brand-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
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
            <div className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">País</label>
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-sm focus:outline-none focus:border-brand-500"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Ciudad</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ej. Bogotá, Caracas, Madrid, CDMX..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-sm focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1.5">
                  ¿Qué estás buscando?
                </label>
                <div className="space-y-2">
                  {LOOKING_FOR_OPTIONS.map((opt) => (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => setLookingFor(opt)}
                      className={`w-full py-2.5 px-3.5 rounded-2xl text-left text-sm font-medium border flex items-center justify-between transition ${
                        lookingFor === opt
                          ? 'bg-brand-500/20 border-brand-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <span>{opt}</span>
                      {lookingFor === opt && <Check className="w-4 h-4 text-brand-400" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 max-h-[68vh] overflow-y-auto pr-1">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Biografía</label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={280}
                  placeholder="Cuéntale al mundo sobre ti, tus gustos o qué idiomas hablas..."
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-sm focus:outline-none focus:border-brand-500 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1.5">
                  Intereses ({interests.length}/10 — mínimo 2)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {INTERESTS_CATALOG.map((item) => {
                    const active = interests.includes(item);
                    return (
                      <button
                        type="button"
                        key={item}
                        onClick={() => toggleInterest(item)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                          active
                            ? 'bg-brand-500 text-white border-brand-400'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
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
                className="px-4 py-3 rounded-2xl bg-slate-800 text-slate-200 text-sm font-semibold hover:bg-slate-700 transition flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" />
                Atrás
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-brand-500 to-pink-500 text-white text-sm font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-brand-500/20"
              >
                Siguiente
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-brand-500 via-pink-500 to-amber-500 text-white text-sm font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-brand-500/25 disabled:opacity-60"
              >
                <Sparkles className="w-4 h-4" />
                {saving ? 'Guardando...' : 'Finalizar y Explorar'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
