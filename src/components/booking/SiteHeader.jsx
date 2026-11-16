'use client';

import { CalendarX2 } from 'lucide-react';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { Button } from '@/components/ui/Button';
import { InstagramGlyph } from './InstagramGlyph';
import { instagramHandle } from './booking-utils';

export function SiteHeader({ settings, onCancelClick }) {
  const handle = instagramHandle(settings.instagramUrl);
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-5 sm:pt-8">
      <div className="flex min-w-0 items-center gap-3">
        <BrandLogo src={settings.logoUrl} name={settings.businessName} size={56} />
        <div className="min-w-0">
          <p className="break-words font-display text-xl font-semibold leading-tight text-ink">{settings.businessName}</p>
          {handle ? (
            <a
              href={settings.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="-my-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg text-sm font-medium text-ink-2 transition hover:text-primary-ink"
            >
              <InstagramGlyph className="h-4 w-4" />
              {handle}
              <span className="sr-only"> en Instagram (se abre en otra pestaña)</span>
            </a>
          ) : null}
        </div>
      </div>
      <Button variant="secondary" size="sm" icon={CalendarX2} className="min-h-[44px]" onClick={onCancelClick}>
        Cancelar cita
      </Button>
    </header>
  );
}
