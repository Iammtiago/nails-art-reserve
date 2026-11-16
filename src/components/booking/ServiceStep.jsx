'use client';

import { ChevronRight, Clock, MessageCircle, Sparkles } from 'lucide-react';
import { formatDuration } from '@shared/format.js';
import { whatsappLink } from '@shared/whatsapp.js';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import { serviceIcon } from './booking-utils';

// Arrow keys move focus between options; Enter/Space chooses (choosing advances the wizard).
function handleRadioKeys(event) {
  const keys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'];
  if (!keys.includes(event.key)) return;
  const options = [...event.currentTarget.querySelectorAll('[role="radio"]')];
  const index = options.indexOf(document.activeElement);
  if (index < 0) return;
  event.preventDefault();
  let next = index;
  if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % options.length;
  if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index - 1 + options.length) % options.length;
  if (event.key === 'Home') next = 0;
  if (event.key === 'End') next = options.length - 1;
  options[next].focus();
}

function ServiceOption({ service, checked, focusable, onSelect }) {
  const Icon = serviceIcon(service);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      tabIndex={focusable ? 0 : -1}
      onClick={() => onSelect(service)}
      className={`group flex min-h-[76px] w-full items-center gap-3.5 rounded-2xl border p-3.5 text-left transition duration-200 hover:-translate-y-px hover:border-secondary hover:bg-surface hover:shadow-glass ${
        checked ? 'border-accent bg-surface shadow-glass ring-2 ring-accent/30' : 'border-line bg-surface/70'
      }`}
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-secondary-soft text-primary-ink" aria-hidden="true">
        <Icon className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-snug text-ink">{service.name}</span>
        <span className="mt-0.5 flex items-center gap-1 text-sm text-ink-2">
          <Clock aria-hidden="true" className="h-3.5 w-3.5" />
          {formatDuration(service.durationMinutes)}
        </span>
      </span>
      <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-ink-3 transition group-hover:translate-x-0.5 group-hover:text-primary-ink" />
    </button>
  );
}

export function ServiceStep({ services, selectedKey, onSelect, headingRef, phone }) {
  const list = services || [];
  const hasSelected = list.some((s) => s.key === selectedKey);

  return (
    <div>
      <h2 ref={headingRef} tabIndex={-1} id="step-service-title" className="section-title outline-none">
        Elige tu servicio
      </h2>
      <p className="mt-1 text-sm text-ink-2">Te mostraremos los días y las horas libres para ese servicio.</p>

      {list.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Aún no hay servicios disponibles"
          description="Escríbenos por WhatsApp y te ayudamos a agendar tu cita."
          action={
            phone ? (
              <Button variant="whatsapp" icon={MessageCircle} href={whatsappLink(phone)} target="_blank" rel="noopener noreferrer">
                Escribir por WhatsApp
              </Button>
            ) : null
          }
        />
      ) : (
        <div role="radiogroup" aria-labelledby="step-service-title" className="mt-5 grid gap-3 sm:grid-cols-2" onKeyDown={handleRadioKeys}>
          {list.map((service, index) => (
            <ServiceOption
              key={service.key}
              service={service}
              checked={service.key === selectedKey}
              focusable={hasSelected ? service.key === selectedKey : index === 0}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
