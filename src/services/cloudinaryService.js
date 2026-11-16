import { CLOUDINARY_CONFIG, isCloudinaryConfigured } from '../config/cloudinary';
import { compressImageForUpload } from '../utils/imageCompression';

/**
 * Construye la ruta de carpeta exclusiva para cada usuario en Cloudinary.
 * Ej: conoscamosnos/users/<uid>/profiles
 */
export function buildUserBaseFolder(uid) {
  return `conoscamosnos/users/${uid || 'anonymous'}`;
}

export function getUserCloudinaryFolder(userOrUid, subfolder = 'profiles') {
  const baseFolder =
    typeof userOrUid === 'string'
      ? buildUserBaseFolder(userOrUid)
      : userOrUid?.cloudinaryFolder || buildUserBaseFolder(userOrUid?.uid || userOrUid?.id);

  return subfolder ? `${baseFolder}/${subfolder}` : baseFolder;
}

/**
 * Optimiza y comprime la imagen en el cliente (WebP alta nitidez, ~150-320 KB)
 * y la sube a Cloudinary en la carpeta exclusiva del usuario.
 */
export async function uploadImageToCloudinary(file, folderOrOptions = 'conoscamosnos/profiles', onProgress) {
  if (!isCloudinaryConfigured) {
    throw new Error(
      'Cloudinary no está configurado. Define VITE_CLOUDINARY_CLOUD_NAME y VITE_CLOUDINARY_UPLOAD_PRESET en tu archivo .env.'
    );
  }

  if (!file) {
    throw new Error('No se seleccionó ningún archivo.');
  }

  if (!CLOUDINARY_CONFIG.allowedMimeTypes.includes(file.type)) {
    throw new Error('Formato no permitido. Usa JPG, PNG, WEBP o GIF.');
  }

  if (file.size > CLOUDINARY_CONFIG.maxFileSizeBytes) {
    throw new Error('La imagen supera el límite de 15 MB.');
  }

  const compressionOptions =
    typeof folderOrOptions === 'object' && folderOrOptions?.compression
      ? folderOrOptions.compression
      : {};

  const compressed = await compressImageForUpload(file, compressionOptions);
  const fileToUpload = compressed.file;

  const folder =
    typeof folderOrOptions === 'string'
      ? folderOrOptions
      : folderOrOptions?.folder || 'conoscamosnos/profiles';
  const tags =
    typeof folderOrOptions === 'object' && Array.isArray(folderOrOptions?.tags)
      ? folderOrOptions.tags.join(',')
      : '';

  return new Promise((resolve, reject) => {
    const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`;
    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
    formData.append('folder', folder);
    if (tags) {
      formData.append('tags', tags);
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && typeof onProgress === 'function') {
        const pct = Math.round((event.loaded / event.total) * 100);
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && res.secure_url) {
          resolve({
            url: res.secure_url,
            publicId: res.public_id,
            compression: {
              originalSize: compressed.originalSize,
              compressedSize: compressed.compressedSize,
              savingsPercent: compressed.savingsPercent,
            },
          });
        } else {
          reject(new Error(res?.error?.message || 'Error al subir la imagen a Cloudinary.'));
        }
      } catch {
        reject(new Error('Respuesta inválida de Cloudinary.'));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Error de red al conectar con Cloudinary.'));
    };

    xhr.send(formData);
  });
}
