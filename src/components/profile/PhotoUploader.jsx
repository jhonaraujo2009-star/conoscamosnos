import { useRef, useState } from 'react';
import { Camera, Gem, Heart, Loader2, Lock, Sparkles, Star, Trash2, Unlock } from 'lucide-react';
import {
  EXCLUSIVE_PHOTO_DEFAULT_COST,
  MAX_EXCLUSIVE_PHOTOS,
  MAX_PHOTOS,
} from '../../config/constants';
import { isCloudinaryConfigured } from '../../config/cloudinary';
import { useAuth } from '../../contexts/AuthContext';
import { getUserCloudinaryFolder, uploadImageToCloudinary } from '../../services/cloudinaryService';
import { optimizeCloudinaryUrl } from '../../utils/formatters';

export default function PhotoUploader({
  photos = [],
  onChange,
  exclusivePhotoUrls = [],
  onExclusiveChange,
  exclusiveCostDiamonds = EXCLUSIVE_PHOTO_DEFAULT_COST,
  onError,
  smartPhotos = false,
  photoLikeCounts = {},
  bestPhotoUrl = '',
}) {
  const { userProfile } = useAuth();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const safeExclusive = Array.isArray(exclusivePhotoUrls) ? exclusivePhotoUrls : [];

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
    const removedUrl = photos[index];
    const nextPhotos = photos.filter((_, i) => i !== index);
    onChange(nextPhotos);
    if (onExclusiveChange && removedUrl) {
      const primaryNext = nextPhotos[0] || '';
      onExclusiveChange(
        safeExclusive.filter((u) => u !== removedUrl && u !== primaryNext)
      );
    }
  };

  const handleSetPrimary = (index) => {
    if (index === 0) return;
    const next = [...photos];
    const [chosen] = next.splice(index, 1);
    next.unshift(chosen);
    onChange(next);
    if (onExclusiveChange && chosen) {
      onExclusiveChange(safeExclusive.filter((u) => u !== chosen));
    }
  };

  const handleToggleExclusive = (url, index) => {
    if (!onExclusiveChange || index === 0 || !url) return;
    const isCurrentlyExclusive = safeExclusive.includes(url);
    if (isCurrentlyExclusive) {
      onExclusiveChange(safeExclusive.filter((u) => u !== url));
      return;
    }
    if (safeExclusive.length >= MAX_EXCLUSIVE_PHOTOS) {
      onError?.(
        `Puedes marcar máximo ${MAX_EXCLUSIVE_PHOTOS} fotos de tu galería como Exclusivas VIP (${exclusiveCostDiamonds} 💎).`
      );
      return;
    }
    onExclusiveChange([...safeExclusive, url]);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-500">
          Galería ({photos.length}/{MAX_PHOTOS} fotos)
        </span>
        {onExclusiveChange && (
          <span className="text-[11px] font-extrabold text-[#FF2E54] inline-flex items-center gap-1">
            <Gem className="w-3 h-3" />
            Álbum VIP: {safeExclusive.length}/{MAX_EXCLUSIVE_PHOTOS} fotos ({exclusiveCostDiamonds} 💎 c/u)
          </span>
        )}
        {!isCloudinaryConfigured && (
          <span className="text-[11px] font-bold text-amber-600">
            Configura Cloudinary en .env
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {Array.from({ length: MAX_PHOTOS }).map((_, idx) => {
          const url = photos[idx];
          if (url) {
            const isExclusive = idx > 0 && safeExclusive.includes(url);
            return (
              <div
                key={`${url}-${idx}`}
                className={`relative aspect-[3/4] rounded-2xl overflow-hidden bg-zinc-100 border shadow-sm group ${
                  isExclusive ? 'border-[#FF2E54] ring-2 ring-rose-200' : 'border-zinc-200'
                }`}
              >
                <img
                  src={optimizeCloudinaryUrl(url, 400)}
                  alt={`Foto ${idx + 1}`}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                {idx === 0 && !smartPhotos && (
                  <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full bg-zinc-900/90 text-[10px] font-extrabold text-white shadow">
                    Principal
                  </span>
                )}
                {isExclusive && (
                  <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-[#FF2E54] to-amber-500 text-[9.5px] font-black text-white shadow inline-flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> {exclusiveCostDiamonds} 💎
                  </span>
                )}
                {!isExclusive && smartPhotos && bestPhotoUrl === url && (
                  <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-[#FF2E54] to-amber-500 text-[10px] font-extrabold text-white shadow flex items-center gap-0.5">
                    <Sparkles className="w-2.5 h-2.5" /> Top
                  </span>
                )}
                {Number(photoLikeCounts[url] || 0) > 0 && (
                  <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-full bg-black/70 text-[10px] font-extrabold text-white flex items-center gap-1">
                    <Heart className="w-2.5 h-2.5 fill-[#FF2E54] text-[#FF2E54]" />
                    {photoLikeCounts[url]}
                  </span>
                )}
                <div className="absolute bottom-1.5 right-1.5 flex gap-1">
                  {idx !== 0 && onExclusiveChange && (
                    <button
                      type="button"
                      onClick={() => handleToggleExclusive(url, idx)}
                      className={`p-1.5 rounded-full shadow transition ${
                        isExclusive
                          ? 'bg-[#FF2E54] text-white'
                          : 'bg-white/95 text-rose-600 hover:bg-rose-500 hover:text-white'
                      }`}
                      title={
                        isExclusive
                          ? 'Quitar de Fotos Exclusivas VIP'
                          : `Marcar como Foto Exclusiva VIP (${exclusiveCostDiamonds} 💎 para ti)`
                      }
                    >
                      {isExclusive ? (
                        <Lock className="w-3.5 h-3.5" />
                      ) : (
                        <Unlock className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                  {idx !== 0 && (
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(idx)}
                      className="p-1.5 rounded-full bg-white/95 text-amber-500 hover:bg-amber-500 hover:text-white shadow transition"
                      title="Hacer foto principal"
                    >
                      <Star className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    className="p-1.5 rounded-full bg-white/95 text-[#FF2E54] hover:bg-[#FF2E54] hover:text-white shadow transition"
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
                  ? 'border-[#FF2E54]/60 bg-rose-50/40 hover:bg-rose-50 text-[#FF2E54] cursor-pointer'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-400 cursor-default'
              }`}
            >
              {isNextSlot && uploading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin text-[#FF2E54]" />
                  <span className="text-xs font-extrabold">{progress}%</span>
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

      {onExclusiveChange && photos.length > 1 && (
        <p className="text-[11px] text-zinc-500 leading-snug">
          💡 Toca el candado en las fotos #2 a #6 para marcarlas como <strong>Exclusivas VIP ({exclusiveCostDiamonds} 💎 o Gratis con PRO)</strong>. Cada vez que alguien desbloquee tu foto con Diamantes, recibes los <strong>+{exclusiveCostDiamonds} 💎</strong> en tus ganancias retirables.
        </p>
      )}

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
