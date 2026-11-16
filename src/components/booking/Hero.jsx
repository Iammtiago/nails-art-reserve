'use client';

import { Clock } from 'lucide-react';
import { useMemo } from 'react';
import { summarizeWorkingHours } from './booking-utils';

export function Hero({ settings }) {
  const hours = useMemo(() => summarizeWorkingHours(settings.workingHours), [settings.workingHours]);
  return (
    <section className="pb-6 pt-8 sm:pb-8 sm:pt-12" aria-labelledby="hero-title">
      <p className="eyebrow">Reserva en línea</p>
      <h1 id="hero-title" className="mt-2 text-balance font-display text-[2rem] font-semibold leading-[1.1] sm:text-5xl">
        Agenda tu cita en {settings.businessName}
      </h1>
      <p className="mt-3 max-w-xl text-base text-ink-2 sm:text-lg">Elige tu servicio, el día y la hora. Recibirás un ticket con código QR.</p>
      {hours.length ? (
        <div className="mt-5 flex items-start gap-2.5 text-sm text-ink-2">
          <Clock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" />
          <div>
            <p className="sr-only">Horario de atención</p>
            <ul className="space-y-1">
              {hours.map((row) => (
                <li key={row.key}>
                  <span className="font-semibold text-ink">{row.days}</span>
                  <span aria-hidden="true"> · </span>
                  <span className="sr-only">: </span>
                  {row.closed ? (
                    <span className="text-ink-3">Cerrado</span>
                  ) : (
                    row.ranges.map((range, index) => (
                      <span key={range}>
                        {index > 0 ? ' y ' : null}
                        <span className="whitespace-nowrap">{range}</span>
                      </span>
                    ))
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}
