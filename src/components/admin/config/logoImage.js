// Turns an uploaded image into a compact data URL for settings.logoUrl:
// fits it inside 512×512 (keeping the aspect ratio) and exports WebP, or PNG as a fallback.

import { LIMITS } from '@shared/constants.js';

export const LOGO_ACCEPT = 'image/png,image/jpeg,image/webp';
const LOGO_TYPES = LOGO_ACCEPT.split(',');
const LOGO_MAX_BYTES = 8 * 1024 * 1024;
const LOGO_MAX_SIDE = 512;

export class LogoError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LogoError';
  }
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();
    image.decoding = 'async';
    image.onload = () => resolve({ image, release: () => URL.revokeObjectURL(url) });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new LogoError('No pudimos leer esa imagen. Prueba con otro archivo.'));
    };
    image.src = url;
  });
}

/** @returns {Promise<{ dataUrl: string, width: number, height: number }>} */
export async function processLogoFile(file) {
  if (!file) throw new LogoError('Elige una imagen para el logo.');
  if (!LOGO_TYPES.includes(file.type)) throw new LogoError('Sube una imagen PNG, JPG o WebP.');
  if (file.size > LOGO_MAX_BYTES) throw new LogoError('La imagen pesa más de 8 MB. Elige una más liviana.');

  const { image, release } = await loadImage(file);
  try {
    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;
    if (!sourceWidth || !sourceHeight) throw new LogoError('No pudimos leer esa imagen. Prueba con otro archivo.');

    const scale = Math.min(1, LOGO_MAX_SIDE / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new LogoError('Tu navegador no pudo procesar la imagen. Prueba con otro navegador.');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, width, height);

    let dataUrl = canvas.toDataURL('image/webp', 0.9);
    if (!dataUrl.startsWith('data:image/webp')) dataUrl = canvas.toDataURL('image/png');
    if (dataUrl.length > LIMITS.logoDataUrlMaxChars) {
      throw new LogoError('El logo sigue pesando demasiado después de ajustarlo. Prueba con una imagen más simple.');
    }
    return { dataUrl, width, height };
  } finally {
    release();
  }
}

/** Approximate decoded size of a base64 data URL, in KB. */
export function dataUrlKilobytes(dataUrl) {
  const comma = dataUrl.indexOf(',');
  const base64Length = comma >= 0 ? dataUrl.length - comma - 1 : dataUrl.length;
  return Math.max(1, Math.round((base64Length * 3) / 4 / 1024));
}
