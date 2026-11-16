'use client';

import { Check } from 'lucide-react';

export const BOOKING_STEPS = [
  { id: 1, label: 'Servicio' },
  { id: 2, label: 'Fecha y hora' },
  { id: 3, label: 'Tus datos' },
  { id: 4, label: 'Ticket' },
];

export function Stepper({ step }) {
  return (
    <nav aria-label="Pasos de la reserva" className="mb-5">
      <ol className="grid grid-cols-4 gap-1.5 sm:gap-3">
        {BOOKING_STEPS.map((item) => {
          const done = item.id < step;
          const current = item.id === step;
          return (
            <li key={item.id} aria-current={current ? 'step' : undefined} className="flex min-w-0 flex-col items-center gap-1.5 text-center">
              <div className="flex w-full items-center">
                <span className={`h-0.5 flex-1 rounded-full ${item.id === 1 ? 'opacity-0' : done || current ? 'bg-accent' : 'bg-line'}`} aria-hidden="true" />
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold transition-colors duration-200 ${
                    current
                      ? 'bg-primary text-primary-on shadow-lift'
                      : done
                        ? 'bg-accent text-accent-on'
                        : 'border border-line bg-surface/80 text-ink-3'
                  }`}
                  aria-hidden="true"
                >
                  {done ? <Check className="h-4 w-4" /> : item.id}
                </span>
                <span
                  className={`h-0.5 flex-1 rounded-full ${item.id === BOOKING_STEPS.length ? 'opacity-0' : done ? 'bg-accent' : 'bg-line'}`}
                  aria-hidden="true"
                />
              </div>
              <span className={`text-[0.72rem] font-semibold leading-tight sm:text-xs ${current ? 'text-ink' : done ? 'text-ink-2' : 'text-ink-3'}`}>
                <span className="sr-only">
                  Paso {item.id} de {BOOKING_STEPS.length}:{' '}
                </span>
                {item.label}
                {done ? <span className="sr-only"> (completado)</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
