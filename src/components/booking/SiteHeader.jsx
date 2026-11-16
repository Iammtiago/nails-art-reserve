'use client';

import { CalendarHeart, CalendarX2, Phone } from 'lucide-react';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { telLink } from './landing-utils';

// Mobile: three icon-over-label actions (fit a 360 px screen). From sm: regular pill buttons.
const ACTION =
  'inline-flex min-h-[44px] min-w-[56px] flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 text-[0.68rem] font-semibold transition sm:flex-row sm:gap-2 sm:px-3.5 sm:text-sm';

export function SiteHeader({ settings, onCancelClick }) {
  const tel = telLink(settings.phone);
  return (
    <header className="sticky top-0 z-40 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-6 sm:pt-3">
      <div className="glass glass-strong mx-auto flex max-w-6xl items-center justify-between gap-2 rounded-2xl py-1.5 pl-2 pr-1.5 sm:rounded-3xl sm:py-2 sm:pl-3 sm:pr-2">
        <a href="#inicio" className="flex min-h-[44px] min-w-0 items-center gap-2.5 rounded-xl pr-1" aria-label={`${settings.businessName}, ir al inicio`}>
          <BrandLogo src={settings.logoUrl} name={settings.businessName} size={38} />
          <span className="hidden truncate font-display text-lg font-semibold leading-tight text-ink min-[400px]:block">{settings.businessName}</span>
        </a>

        <nav aria-label="Acciones rápidas" className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          <a href="#reservar" className={`${ACTION} bg-primary text-primary-on shadow-lift hover:brightness-110`}>
            <CalendarHeart aria-hidden="true" className="h-[18px] w-[18px]" />
            Agendar
          </a>
          <button type="button" onClick={onCancelClick} className={`${ACTION} text-primary-ink hover:bg-primary-soft`}>
            <CalendarX2 aria-hidden="true" className="h-[18px] w-[18px]" />
            Cancelar
          </button>
          {tel ? (
            <a href={tel} className={`${ACTION} text-primary-ink hover:bg-primary-soft`}>
              <Phone aria-hidden="true" className="h-[18px] w-[18px]" />
              Llamar
            </a>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
