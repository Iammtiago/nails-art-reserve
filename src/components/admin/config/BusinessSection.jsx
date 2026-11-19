'use client';

import { ExternalLink, MessageCircle, Store } from 'lucide-react';
import { LIMITS } from '@shared/constants.js';
import { formatPhone, normalizePhone } from '@shared/phone.js';
import { whatsappLink } from '@shared/whatsapp.js';
import { Field, Input } from '@/components/ui/Field';
import { ConfigCard } from './ConfigCard';

// lucide-react has no brand icons: small inline Instagram glyph.
function InstagramGlyph({ className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function BusinessSection({ businessName, phone, instagramUrl, errors, onChange, delay }) {
  const normalized = normalizePhone(String(phone ?? '').trim());
  const showPreview = Boolean(normalized) && !errors.phone;

  return (
    <ConfigCard
      id="negocio"
      icon={Store}
      title="Negocio"
      description="Así te presentas en la página de reservas, el ticket y los mensajes."
      delay={delay}
    >
      <div className="space-y-4">
        <Field label="Nombre del negocio" required error={errors.businessName}>
          {(p) => (
            <Input
              {...p}
              value={businessName}
              onChange={(event) => onChange('businessName', event.target.value)}
              maxLength={LIMITS.businessNameMax}
              autoComplete="organization"
              placeholder="Nails Art"
            />
          )}
        </Field>

        <div>
          <Field
            id="cfg-telefono"
            label="WhatsApp que recibe las confirmaciones"
            required
            error={errors.phone}
            hint={showPreview ? undefined : 'Acepta 0414 123 4567 o +58 414 123 4567.'}
          >
            {(p) => (
              <Input
                {...p}
                aria-describedby={[p['aria-describedby'], showPreview ? 'cfg-telefono-preview' : null].filter(Boolean).join(' ') || undefined}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => onChange('phone', event.target.value)}
                maxLength={25}
                placeholder="0414 123 4567"
              />
            )}
          </Field>
          {showPreview ? (
            <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 text-sm">
              <p id="cfg-telefono-preview" className="text-ink-2">
                Se guardará como <span className="font-semibold text-ink">{formatPhone(normalized)}</span>
              </p>
              <a
                href={whatsappLink(normalized)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center gap-1.5 font-semibold text-primary-ink underline-offset-4 hover:underline"
              >
                <MessageCircle aria-hidden="true" className="h-4 w-4" />
                Probar enlace
                <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                <span className="sr-only">(se abre en otra pestaña)</span>
              </a>
            </div>
          ) : null}
        </div>

        <Field label="Instagram" error={errors.instagramUrl} hint="Ejemplo: https://www.instagram.com/nailsart.sc">
          {(p) => (
            <div className="relative">
              <InstagramGlyph className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-3" />
              <Input
                {...p}
                type="url"
                inputMode="url"
                autoComplete="url"
                autoCapitalize="none"
                spellCheck={false}
                value={instagramUrl}
                onChange={(event) => onChange('instagramUrl', event.target.value)}
                maxLength={200}
                placeholder="https://www.instagram.com/tu-negocio"
                className="pl-11"
              />
            </div>
          )}
        </Field>
      </div>
    </ConfigCard>
  );
}
