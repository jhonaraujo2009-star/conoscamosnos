import { useRef, useState } from 'react';
import { Camera, Loader2, Star, Trash2 } from 'lucide-react';
import { MAX_PHOTOS } from '../../config/constants';
import { isCloudinaryConfigured } from '../../config/cloudinary';
import { useAuth } from '../../contexts/AuthContext';
import { getUserCloudinaryFolder, uploadImageToCloudinary } from '../../services/cloudinaryService';
import { optimizeCloudinaryUrl } from '../../utils/formatters';

export default function PhotoUploader({ photos = [], onChange, onError }) {
  const { userProfile } = useAuth();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (photos.length >= MAX_PHOTOS) {
      onError?.(`Máximo ${MAX_PHOTOS} fotos permitidas.`);
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      const { url } = await uploadImageToCloudinary(
        file,
        {
          folder: getUserCloudinaryFolder(userProfile, 'profiles'),
          tags: ['profile', userProfile?.uid ? `user_${userProfile.uid}` : 'guest'],
        },
        setProgress
      );
      onChange([...photos, url]);
    } catch (err) {
      onError?.(err.message || 'No se pudo subir la foto.');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleRemove = (index) => {
    onChange(photos.filter((_, i) => i !== index));
  };

  const handleSetPrimary = (index) => {
    if (index === 0) return;
    const next = [...photos];
    const [chosen] = next.splice(index, 1);
    next.unshift(chosen);
    onChange(next);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
          Galería ({photos.length}/{MAX_PHOTOS} fotos)
        </span>
        {!isCloudinaryConfigured && (
          <span className="text-[11px] font-semibold text-amber-600">
            Configura Cloudinary en .env
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {Array.from({ length: MAX_PHOTOS }).map((_, idx) => {
          const url = photos[idx];
          if (url) {
            return (
              <div
                key={`${url}-${idx}`}
                className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-sm group"
              >
                <img
                  src={optimizeCloudinaryUrl(url, 400)}
                  alt={`Foto ${idx + 1}`}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                {idx === 0 && (
                  <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full bg-brand-500 text-[10px] font-extrabold text-white shadow">
                    Principal
                  </span>
                )}
                <div className="absolute bottom-1.5 right-1.5 flex gap-1">
                  {idx !== 0 && (
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(idx)}
                      className="p-1.5 rounded-full bg-white/90 text-amber-500 hover:bg-amber-500 hover:text-white shadow transition"
                      title="Hacer principal"
                    >
                      <Star className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    className="p-1.5 rounded-full bg-white/90 text-rose-500 hover:bg-rose-500 hover:text-white shadow transition"
                    title="Eliminar foto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          }

          const isNextSlot = idx === photos.length;
          return (
            <button
              key={`slot-${idx}`}
              type="button"
              disabled={!isNextSlot || uploading}
              onClick={() => isNextSlot && inputRef.current?.click()}
              className={`aspect-[3/4] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition ${
                isNextSlot
                  ? 'border-brand-300 bg-rose-50/50 hover:bg-rose-50 text-brand-600 cursor-pointer'
                  : 'border-slate-200 bg-slate-50/70 text-slate-400 cursor-default'
              }`}
            >
              {isNextSlot && uploading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
                  <span className="text-xs font-bold">{progress}%</span>
                </>
              ) : (
                <>
                  <Camera className="w-5 h-5" />
                  <span className="text-[11px] font-bold">
                    {isNextSlot ? 'Subir foto' : `Foto ${idx + 1}`}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
