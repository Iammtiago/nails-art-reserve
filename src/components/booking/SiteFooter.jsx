'use client';

import { MessageCircle } from 'lucide-react';
import { whatsappLink } from '@shared/whatsapp.js';
import { InstagramGlyph } from './InstagramGlyph';

const LINK = 'inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 font-medium text-ink-2 transition hover:text-primary-ink';

export function SiteFooter({ settings }) {
  const year = settings.now?.date ? settings.now.date.slice(0, 4) : '';
  return (
    <footer className="mt-14 flex flex-col items-center gap-2 border-t border-line py-6 text-sm sm:flex-row sm:justify-between">
      <nav aria-label="Contacto del salón" className="-mx-2 flex flex-wrap items-center justify-center gap-1">
        {settings.instagramUrl ? (
          <a href={settings.instagramUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
            <InstagramGlyph className="h-4 w-4" />
            Instagram
          </a>
        ) : null}
        {settings.phone ? (
          <a href={whatsappLink(settings.phone)} target="_blank" rel="noopener noreferrer" className={LINK}>
            <MessageCircle aria-hidden="true" className="h-4 w-4" />
            WhatsApp
          </a>
        ) : null}
      </nav>
      <p className="text-ink-3">
        © {year} {settings.businessName}
      </p>
    </footer>
  );
}
