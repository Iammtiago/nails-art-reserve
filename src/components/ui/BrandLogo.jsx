/* eslint-disable @next/next/no-img-element */
// The logo can be a local path, an https URL or a base64 data URL (set in Configuración),
// so a plain <img> is used instead of next/image.

export function BrandLogo({ src, name = 'Nails Art', size = 48, className = '' }) {
  return (
    <img
      src={src || '/logo.png'}
      alt={`Logo de ${name}`}
      width={size}
      height={size}
      className={`shrink-0 rounded-full object-cover shadow-glass ring-2 ring-white/80 ${className}`}
      style={{ width: size, height: size }}
      decoding="async"
    />
  );
}
