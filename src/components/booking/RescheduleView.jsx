'use client';

// The client moves one of her appointments: same calendar and time grid as booking, with her
// own current time shown as free (the server leaves it out with `exclude`). Code and QR stay.

import { ArrowLeft, CalendarClock, CalendarX2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatDateLong, formatTimeRange } from '@shared/format.js';
import { startOfMonth } from '@shared/time.js';
import { ApiError, apiGet, apiPatch, errorMessage } from '@/lib/api';
import { useAsync } from '@/lib/hooks';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { MonthCalendar } from './MonthCalendar';
import { TimeGrid } from './TimeGrid';

function TimesSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-12" />
      ))}
    </div>
  );
}

/** Her current slot is not offered again: it would not be a change. */
function withoutCurrent(slots, item, date) {
  return slots.map((s) => (date === item.date && s.time === item.timeSlot ? { ...s, available: false } : s));
}

export function RescheduleView({ item, phone, onBack, onDone, onGone }) {
  const toast = useToast();
  const [date, setDate] = useState(null);
  const [time, setTime] = useState(null);
  const [month, setMonth] = useState(null);
  const [saving, setSaving] = useState(false);
  const query = { service: item.serviceKey, exclude: item.id };

  const days = useAsync((signal) => apiGet('/api/appointments/days', query, { signal }), [item.id, item.serviceKey]);
  const availability = useAsync(
    (signal) => (date ? apiGet('/api/appointments/availability', { ...query, date }, { signal }) : Promise.resolve(null)),
    [date, item.id, item.serviceKey],
  );

  // Start on her current day when it still has other free times, else on the first free day.
  const daysData = days.data;
  useEffect(() => {
    if (!daysData || date) return;
    const current = daysData.days.find((d) => d.date === item.date && d.status === 'available');
    const first = current || daysData.days.find((d) => d.status === 'available');
    setDate(first ? first.date : null);
    setMonth(startOfMonth(first ? first.date : daysData.from));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysData]);

  const pickDate = (next) => {
    setDate(next);
    setTime(null);
  };

  async function save() {
    if (!time || saving) return;
    setSaving(true);
    try {
      const { appointment } = await apiPatch(`/api/appointments/${item.id}/reschedule`, { phone, date, timeSlot: time.time });
      // formatTimeRange already ends in «a. m.»/«p. m.»: no extra period.
      toast.success(`Listo: tu cita quedó para el ${formatDateLong(appointment.date).toLowerCase()}, ${formatTimeRange(appointment.timeSlot, appointment.endTime)}`);
      onDone(appointment);
    } catch (error) {
      toast.error(errorMessage(error));
      if (error instanceof ApiError && (error.code === 'NOT_ACTIVE' || error.code === 'ALREADY_STARTED' || error.status === 404)) onGone(item);
      else if (error instanceof ApiError && error.code === 'SLOT_TAKEN') {
        setTime(null);
        availability.reload({ silent: true });
      }
    } finally {
      setSaving(false);
    }
  }

  const slotsData = availability.data && availability.data.date === date ? availability.data : null;
  const slots = slotsData ? withoutCurrent(slotsData.slots, item, date) : [];
  const free = slots.filter((s) => s.available).length;

  let body;
  if (!daysData) {
    body = days.error ? <ErrorState error={days.error} onRetry={() => days.reload()} className="py-8" /> : <LoadingState label="Buscando días disponibles…" className="py-8" />;
  } else if (!daysData.days.some((d) => d.status === 'available')) {
    body = <EmptyState icon={CalendarX2} title="No quedan días libres" description="Por ahora no hay otros horarios para este servicio. Escríbenos y buscamos un espacio." className="py-6" />;
  } else {
    body = (
      <>
        {month ? (
          <MonthCalendar
            days={daysData.days}
            from={daysData.from}
            to={daysData.to}
            today={daysData.now?.date}
            month={month}
            onMonthChange={setMonth}
            selected={date}
            onSelect={pickDate}
          />
        ) : null}
        <section className="mt-5 border-t border-line pt-4" aria-labelledby="reschedule-times">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 id="reschedule-times" className="font-display text-lg font-semibold text-accent-ink">
              {date ? formatDateLong(date) : 'Elige un día'}
            </h3>
            {time ? <span className="text-sm font-semibold text-accent-ink">{formatTimeRange(time.time, time.endTime)}</span> : null}
          </div>
          {!date ? null : !slotsData ? (
            availability.error ? (
              <ErrorState error={availability.error} onRetry={() => availability.reload()} className="py-6" />
            ) : (
              <TimesSkeleton />
            )
          ) : free === 0 ? (
            <p className="rounded-2xl bg-info-soft px-4 py-3 text-sm font-medium text-info">{slotsData.reasonLabel || 'Ese día no quedan otros horarios libres.'} Prueba con otro día.</p>
          ) : (
            <TimeGrid slots={slots} selectedTime={time?.time} onSelect={setTime} />
          )}
        </section>
      </>
    );
  }

  return (
    <div>
      <Button variant="ghost" size="sm" icon={ArrowLeft} className="-ml-2 min-h-[44px]" onClick={onBack} disabled={saving}>
        Volver a mis citas
      </Button>
      <div className="mt-2 rounded-2xl bg-secondary-soft/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Tu cita ahora</p>
        <p className="mt-1 font-semibold text-ink">{item.serviceName}</p>
        <p className="text-sm font-semibold text-accent-ink">
          {formatDateLong(item.date)} · {formatTimeRange(item.timeSlot, item.endTime)}
        </p>
        <p className="mt-1 text-xs text-ink-2">Tu ticket y tu clave siguen sirviendo; solo cambian el día y la hora.</p>
      </div>
      <div className="mt-4">{body}</div>
      <div className="sticky bottom-0 -mx-1 mt-5 bg-surface/95 px-1 pb-1 pt-3 backdrop-blur-md">
        <Button block size="lg" icon={CalendarClock} loading={saving} disabled={!time} onClick={save}>
          {time ? `Cambiar a ${formatTimeRange(time.time, time.endTime)}` : 'Elige la nueva hora'}
        </Button>
      </div>
    </div>
  );
}
