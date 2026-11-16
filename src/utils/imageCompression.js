const DEFAULT_OPTIONS = {
  maxDimension: 1440, // Mantiene nitidez HD/Retina en móviles y reduce drásticamente el peso
  targetMaxBytes: 320 * 1024, // Objetivo ~320 KB por foto
  initialQuality: 0.86,
  minQuality: 0.74,
  qualityStep: 0.04,
};

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close?.(),
      };
    } catch {
      // Fallback para navegadores sin opción imageOrientation
    }
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        source: img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        cleanup: () => URL.revokeObjectURL(objectUrl),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo leer la imagen para optimizarla.'));
    };
    img.src = objectUrl;
  });
}

/**
 * Comprime y redimensiona imágenes en el cliente usando WebP (con fallback JPEG)
 * con suavizado de alta calidad y control adaptativo para reducir almacenamiento y tráfico
 * manteniendo máxima definición visual.
 */
export async function compressImageForUpload(file, customOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...customOptions };

  // Mantener GIFs animados sin re-codificar para no perder animación
  if (file.type === 'image/gif') {
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      savingsPercent: 0,
    };
  }

  const decoded = await decodeImage(file);
  try {
    const { source, width, height } = decoded;
    const scale = Math.min(1, opts.maxDimension / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, targetWidth, targetHeight);

    let outputType = 'image/webp';
    let bestBlob = await canvasToBlob(canvas, outputType, opts.initialQuality);

    // Fallback a JPEG si el navegador no soporta codificación WebP
    if (!bestBlob || bestBlob.type !== 'image/webp') {
      outputType = 'image/jpeg';
      bestBlob = await canvasToBlob(canvas, outputType, opts.initialQuality);
    }

    if (!bestBlob) {
      return {
        file,
        originalSize: file.size,
        compressedSize: file.size,
        savingsPercent: 0,
      };
    }

    let currentQuality = opts.initialQuality;
    while (bestBlob.size > opts.targetMaxBytes && currentQuality - opts.qualityStep >= opts.minQuality) {
      currentQuality = Number((currentQuality - opts.qualityStep).toFixed(2));
      const candidate = await canvasToBlob(canvas, outputType, currentQuality);
      if (candidate && candidate.size < bestBlob.size) {
        bestBlob = candidate;
      } else {
        break;
      }
    }

    // Si la imagen original ya pesaba menos y no superaba la dimensión máxima, conservar original
    if (bestBlob.size >= file.size && scale === 1) {
      return {
        file,
        originalSize: file.size,
        compressedSize: file.size,
        savingsPercent: 0,
      };
    }

    const baseName = (file.name || 'photo').replace(/\.[^/.]+$/, '');
    const ext = outputType === 'image/webp' ? 'webp' : 'jpg';
    const optimizedFile = new File([bestBlob], `${baseName}.${ext}`, {
      type: outputType,
      lastModified: Date.now(),
    });

    const savingsPercent = Math.max(
      0,
      Math.round(((file.size - optimizedFile.size) / file.size) * 100)
    );

    return {
      file: optimizedFile,
      originalSize: file.size,
      compressedSize: optimizedFile.size,
      width: targetWidth,
      height: targetHeight,
      savingsPercent,
    };
  } finally {
    decoded.cleanup();
  }
}
