'use client';

import { AlertCircle, ImageUp, RotateCcw, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { Button } from '@/components/ui/Button';
import { ConfigCard } from './ConfigCard';
import { DEFAULT_LOGO } from './configModel';
import { LOGO_ACCEPT, LogoError, dataUrlKilobytes, processLogoFile } from './logoImage';

function logoSourceLabel(logoUrl) {
  if (!logoUrl || logoUrl === DEFAULT_LOGO) return 'Logo original del salón';
  if (logoUrl.startsWith('data:')) return `Imagen subida · ${dataUrlKilobytes(logoUrl)} KB`;
  if (logoUrl.startsWith('https://')) return 'Imagen desde un enlace externo';
  return 'Imagen del sitio';
}

export function LogoSection({ logoUrl, businessName, error, onChange, delay }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState('');

  async function handleFile(event) {
    const file = event.target.files?.[0];
    // Reset so choosing the same file again still fires onChange.
    event.target.value = '';
    if (!file) return;
    setUploadError('');
    setBusy(true);
    try {
      const { dataUrl } = await processLogoFile(file);
      onChange(dataUrl);
    } catch (err) {
      setUploadError(err instanceof LogoError ? err.message : 'No pudimos procesar la imagen. Prueba con otro archivo.');
    } finally {
      setBusy(false);
    }
  }

  function restoreOriginal() {
    setUploadError('');
    onChange(DEFAULT_LOGO);
  }

  const message = uploadError || error;
  const isOriginal = !logoUrl || logoUrl === DEFAULT_LOGO;

  return (
    <ConfigCard id="logo" icon={ImageUp} title="Logo" description="Aparece en la cabecera, el panel y el ticket de cada cita." delay={delay}>
      <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:text-left">
        <div className="rounded-full bg-secondary-soft p-2">
          <BrandLogo src={logoUrl || DEFAULT_LOGO} name={businessName || 'Nails Art'} size={96} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold leading-tight text-ink">{businessName || 'Nails Art'}</p>
          <p className="mt-0.5 text-sm text-ink-3">{logoSourceLabel(logoUrl)}</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <input
              ref={inputRef}
              type="file"
              accept={LOGO_ACCEPT}
              onChange={handleFile}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
            />
            <Button variant="soft" icon={Upload} loading={busy} onClick={() => inputRef.current?.click()}>
              {busy ? 'Procesando…' : 'Subir logo'}
            </Button>
            <Button variant="ghost" icon={RotateCcw} disabled={isOriginal || busy} onClick={restoreOriginal}>
              Usar logo original
            </Button>
          </div>
        </div>
      </div>
      {message ? (
        <p className="field-error mt-4" role="alert" data-config-alert="" tabIndex={-1}>
          <AlertCircle aria-hidden="true" className="mt-px h-4 w-4 shrink-0" />
          {message}
        </p>
      ) : (
        <p className="field-hint mt-4 text-center sm:text-left">PNG, JPG o WebP. Se ajusta a 512 px.</p>
      )}
    </ConfigCard>
  );
}
