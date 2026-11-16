export const CLOUDINARY_CONFIG = {
  cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '',
  uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '',
  maxFileSizeBytes: 15 * 1024 * 1024, // 15 MB entrada (se comprime a ~250-350 KB antes de subir)
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
};

export const isCloudinaryConfigured = Boolean(
  CLOUDINARY_CONFIG.cloudName &&
  CLOUDINARY_CONFIG.uploadPreset &&
  !CLOUDINARY_CONFIG.cloudName.startsWith('tu_') &&
  !CLOUDINARY_CONFIG.uploadPreset.startsWith('tu_')
);
