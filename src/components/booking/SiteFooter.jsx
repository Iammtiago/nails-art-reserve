'use client';

import { MessageCircle, Phone } from 'lucide-react';
import { formatPhone } from '@shared/phone.js';
import { whatsappLink } from '@shared/whatsapp.js';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { InstagramGlyph } from './InstagramGlyph';
import { instagramHandle } from './booking-utils';
import { telLink } from './landing-utils';

const LINK = 'inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 font-medium text-ink-2 transition hover:text-primary-ink';

export function SiteFooter({ settings }) {
  const year = settings.now?.date ? settings.now.date.slice(0, 4) : '';
  const handle = instagramHandle(settings.instagramUrl);
  const tel = telLink(settings.phone);
  return (
    <footer className="px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-10 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 border-t border-line pt-8 text-sm sm:flex-row sm:justify-between">
        <div className="flex items-center gap-3">
          <BrandLogo src={settings.logoUrl} name={settings.businessName} size={40} />
          <div>
            <p className="font-display text-lg font-semibold leading-tight text-ink">{settings.businessName}</p>
            <p className="text-xs text-ink-3">
              © {year} · Reservas en línea
            </p>
          </div>
        </div>
        <nav aria-label="Contacto del salón" className="-mx-2 flex flex-wrap items-center justify-center gap-1">
          {handle ? (
            <a href={settings.instagramUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
              <InstagramGlyph className="h-4 w-4" />
              {handle}
              <span className="sr-only"> en Instagram (se abre en otra pestaña)</span>
            </a>
          ) : null}
          {settings.phone ? (
            <a href={whatsappLink(settings.phone)} target="_blank" rel="noopener noreferrer" className={LINK}>
              <MessageCircle aria-hidden="true" className="h-4 w-4" />
              WhatsApp
              <span className="sr-only"> (se abre en otra pestaña)</span>
            </a>
          ) : null}
          {tel ? (
            <a href={tel} className={LINK}>
              <Phone aria-hidden="true" className="h-4 w-4" />
              {formatPhone(settings.phone)}
            </a>
          ) : null}
        </nav>
      </div>
    </footer>
  );
}
