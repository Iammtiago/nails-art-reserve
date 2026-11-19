'use client';

import { ArrowLeft, ArrowRight, CalendarX2, Info, MessageCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatDateLong, formatDuration, formatTimeRange, pluralize } from '@shared/format.js';
import { startOfMonth } from '@shared/time.js';
import { whatsappLink } from '@shared/whatsapp.js';
import { apiGet } from '@/lib/api';
import { useAsync, useInterval } from '@/lib/hooks';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { serviceIcon } from './booking-utils';
import { MonthCalendar } from './MonthCalendar';
import { TimeGrid } from './TimeGrid';

const REFRESH_MS = 30_000;

function TimesSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-12" />
      ))}
    </div>
  );
}

function TimesPanel({ state, date, time, onSelect }) {
  if (!date) return <p className="text-sm text-ink-2">Elige un día en el calendario para ver las horas.</p>;

  const data = state.data && state.data.date === date ? state.data : null;
  if (!data) {
    if (state.error && !state.loading) return <ErrorState error={state.error} onRetry={() => state.reload()} className="py-6" />;
    return (
      <div role="status">
        <span className="sr-only">Buscando horas disponibles…</span>
        <TimesSkeleton />
      </div>
    );
  }

  const free = data.slots.filter((s) => s.available).length;
  return (
    <div className="space-y-4">
      <p className="sr-only" role="status">
        {free ? `${pluralize(free, 'horario libre', 'horarios libres')} el ${formatDateLong(date)}.` : data.reasonLabel || 'No quedan horarios libres.'}
      </p>
      {!data.bookable || free === 0 ? (
        <p className="flex items-start gap-2.5 rounded-2xl bg-info-soft px-4 py-3 text-sm font-medium text-info">
          <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {data.reasonLabel || 'Ese día ya no quedan horarios libres.'} Prueba con otro día del calendario.
          </span>
        </p>
      ) : null}
      {data.slots.length ? <TimeGrid slots={data.slots} selectedTime={time?.time} onSelect={onSelect} /> : null}
    </div>
  );
}

export function DateTimeStep({ service, date, time, onDateChange, onTimeChange, onBack, onContinue, headingRef, phone }) {
  const toast = useToast();
  const [month, setMonth] = useState(date ? startOfMonth(date) : null);
  const ServiceIcon = serviceIcon(service);

  const days = useAsync((signal) => apiGet('/api/appointments/days', { service: service.key }, { signal }), [service.key]);
  const availability = useAsync(
    (signal) => (date ? apiGet('/api/appointments/availability', { date, service: service.key }, { signal }) : Promise.resolve(null)),
    [date, service.key],
  );
  const reloadAvailability = availability.reload;

  // Keep the chosen date valid; otherwise preselect the first day with free times (usually
  // today, or tomorrow once today's agenda is full or over). Also re-runs when the date is
  // cleared while this step stays open (hero quick-pick, same service again).
  const daysData = days.data;
  useEffect(() => {
    if (!daysData) return;
    const current = date ? daysData.days.find((d) => d.date === date) : null;
    if (current && current.status === 'available') {
      setMonth((m) => m || startOfMonth(date));
      return;
    }
    const first = daysData.days.find((d) => d.status === 'available');
    if ((first?.date ?? null) !== date) onDateChange(first ? first.date : null);
    setMonth(startOfMonth(first ? first.date : daysData.from));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysData, date]);

  // Someone else may book the chosen time while this step is open.
  const slotsData = availability.data;
  useEffect(() => {
    if (!time || !slotsData || slotsData.date !== date) return;
    const slot = slotsData.slots.find((s) => s.time === time.time);
    if (slot && slot.available) return;
    onTimeChange(null);
    toast.info('Ese horario se acaba de ocupar. Elige otro.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotsData]);

  useInterval(() => reloadAvailability({ silent: true }), REFRESH_MS, Boolean(date));

  useEffect(() => {
    if (!date) return undefined;
    const onFocus = () => reloadAvailability({ silent: true });
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [date, reloadAvailability]);

  const hasAvailable = Boolean(daysData?.days.some((d) => d.status === 'available'));

  let body;
  if (!daysData) {
    body = days.error ? (
      <ErrorState error={days.error} onRetry={() => days.reload()} className="min-h-[440px]" />
    ) : (
      <LoadingState label="Buscando días disponibles…" className="min-h-[440px]" />
    );
  } else if (!hasAvailable) {
    body = (
      <EmptyState
        icon={CalendarX2}
        title="No quedan días libres"
        description={`Por ahora no hay horarios para ${service.name.toLowerCase()} en las próximas semanas. Escríbenos y buscamos un espacio.`}
        action={
          phone ? (
            <Button variant="whatsapp" icon={MessageCircle} href={whatsappLink(phone)} target="_blank" rel="noopener noreferrer">
              Escribir por WhatsApp
            </Button>
          ) : null
        }
      />
    );
  } else {
    body = (
      <>
        <section className="mt-5" aria-label="Día de la cita">
          {month ? (
            <MonthCalendar
              days={daysData.days}
              from={daysData.from}
              to={daysData.to}
              today={daysData.now?.date}
              month={month}
              onMonthChange={setMonth}
              selected={date}
              onSelect={onDateChange}
            />
          ) : null}
        </section>
        <section className="mt-6 border-t border-line pt-5" aria-labelledby="times-title">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 id="times-title" className="font-display text-lg font-semibold">
              {date ? formatDateLong(date) : 'Elige un día'}
            </h3>
            {time ? <span className="text-sm font-semibold text-accent-ink">{formatTimeRange(time.time, time.endTime)}</span> : null}
          </div>
          <TimesPanel state={availability} date={date} time={time} onSelect={onTimeChange} />
        </section>
      </>
    );
  }

  return (
    <div>
      <h2 ref={headingRef} tabIndex={-1} className="section-title outline-none">
        Elige el día y la hora
      </h2>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <Badge tone="brand" className="py-1.5 text-[0.8rem]">
          <ServiceIcon aria-hidden="true" className="h-3.5 w-3.5" />
          {service.name} · {formatDuration(service.durationMinutes)}
        </Badge>
        <Button variant="ghost" size="sm" icon={ArrowLeft} className="min-h-[44px]" onClick={onBack}>
          Cambiar servicio
        </Button>
      </div>

      {body}

      <div className="sticky bottom-0 z-10 -mx-4 -mb-4 mt-6 rounded-b-[var(--radius-card)] border-t border-line bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md sm:static sm:mx-0 sm:mb-0 sm:flex sm:justify-end sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:pt-2 sm:backdrop-blur-none">
        <Button size="lg" block className="sm:w-auto sm:min-w-[220px]" iconRight={time ? ArrowRight : undefined} disabled={!time} onClick={onContinue}>
          {time ? 'Continuar' : 'Elige una hora'}
        </Button>
      </div>
    </div>
  );
}
