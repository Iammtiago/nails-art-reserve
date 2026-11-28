'use client';

import { CalendarPlus, Lock } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ManualAppointmentModal, RescheduleModal, TimeBlockModal } from '@/components/admin/calendar/AgendaModals';
import { Button } from '@/components/ui/Button';
import { ApiError, apiGet } from '@/lib/api';
import { useAsync, useInterval } from '@/lib/hooks';
import { useAdmin } from '@/components/admin/AdminContext';
import { AppointmentDetailModal } from '@/components/admin/appointments/AppointmentDetailModal';
import { useAppointmentActions } from '@/components/admin/appointments/useAppointmentActions';
import { CalendarStats } from '@/components/admin/calendar/CalendarStats';
import { CalendarToolbar } from '@/components/admin/calendar/CalendarToolbar';
import { DayPanel } from '@/components/admin/calendar/DayPanel';
import { CalendarLegend, MonthGrid } from '@/components/admin/calendar/MonthGrid';
import { WeekAgenda } from '@/components/admin/calendar/WeekAgenda';
import { WeekTimeGrid } from '@/components/admin/calendar/WeekTimeGrid';
import { calendarRange, groupByDate, periodLabel, shiftAnchor, summarizeDays } from '@/components/admin/calendar/calendarUtils';
import { PageHeader } from '@/components/ui/Controls';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState, LoadingState } from '@/components/ui/States';

const REFRESH_MS = 60_000;
const EMPTY = [];

export default function CalendarioPage() {
  const { settings, reloadSettings, handleError } = useAdmin();
  const handleErrorRef = useRef(handleError);
  handleErrorRef.current = handleError;

  // Week first (Tiago, 2026-11-16): it shows the hours, which is what the salon plans with.
  const [view, setView] = useState('week');
  const [anchor, setAnchor] = useState(null);
  const [openDate, setOpenDate] = useState(null);
  // Half hour tapped in the week grid (null from the day header, month or agenda).
  const [openTime, setOpenTime] = useState(null);
  const openDayAt = useCallback((date, time = null) => {
    setOpenDate(date);
    setOpenTime(time);
  }, []);
  const [selected, setSelected] = useState(null);
  // { type: 'appointment' | 'block', date } — only one form open at a time, never on top of the day panel.
  const [form, setForm] = useState(null);
  // Appointment being moved; the detail and the day panel close first so only one dialog is open.
  // The day it was moved from opens again afterwards, to keep working on that day.
  const [moving, setMoving] = useState(null);
  const openDateRef = useRef(null);
  openDateRef.current = openDate;
  const returnDayRef = useRef(null);
  const startReschedule = useCallback((appointment) => {
    returnDayRef.current = openDateRef.current;
    setSelected(null);
    setOpenDate(null);
    setMoving(appointment);
  }, []);
  const endReschedule = useCallback(() => {
    setMoving(null);
    const day = returnDayRef.current;
    returnDayRef.current = null;
    if (day) {
      setOpenTime(null);
      setOpenDate(day);
    }
  }, []);

  // "Today" comes from the server: settings.now, or /api/settings if the shell has not loaded it.
  const settingsToday = settings?.now?.date || null;
  const bootstrap = useAsync(
    (signal) => (settingsToday ? Promise.resolve(settingsToday) : apiGet('/api/settings', null, { signal }).then((r) => r.settings.now.date)),
    [Boolean(settingsToday)],
  );

  const base = anchor || settingsToday || bootstrap.data || null;
  const range = useMemo(() => (base ? calendarRange(view, base) : null), [view, base]);

  const { data, error, loading, reload } = useAsync(
    (signal) => (range ? apiGet('/api/admin/calendar', { from: range.from, to: range.to }, { signal }) : Promise.resolve(null)),
    [range?.from, range?.to],
  );
  const fresh = Boolean(data && range && data.from === range.from && data.to === range.to);
  const today = data?.now?.date || settingsToday || bootstrap.data || null;

  useInterval(() => reload({ silent: true }), REFRESH_MS, fresh);

  // An expired session while loading goes back to the login.
  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) handleErrorRef.current(error);
  }, [error]);

  const days = fresh ? data.days : EMPTY;
  const appointments = fresh ? data.appointments : EMPTY;
  const workingHours = (fresh && data.workingHours) || settings?.workingHours || EMPTY;
  const monthKey = base ? base.slice(0, 7) : '';

  const stats = useMemo(() => {
    if (!fresh) return null;
    const visible = view === 'month' ? days.filter((d) => d.date.slice(0, 7) === monthKey) : days;
    return summarizeDays(visible);
  }, [fresh, view, days, monthKey]);

  const byDate = useMemo(() => groupByDate(appointments), [appointments]);
  const openDay = fresh && openDate ? days.find((d) => d.date === openDate) || null : null;

  const handleAppointmentChanged = useCallback(
    (updated, id) => {
      setSelected((current) => {
        if (!current || current.id !== id) return current;
        return updated ? { ...current, ...updated } : null;
      });
      reload({ silent: true });
    },
    [reload],
  );
  const actions = useAppointmentActions(handleAppointmentChanged);

  const openForm = (type, date, time = null) => {
    setOpenDate(null);
    const valid = date && today && date >= today;
    setForm({ type, date: valid ? date : today, time: valid ? time : null });
  };

  const go = (step) => {
    if (base) setAnchor(shiftAnchor(view, base, step));
  };
  const goToday = () => {
    if (today) setAnchor(today);
  };
  const retry = () => {
    if (!base && bootstrap.error) {
      reloadSettings();
      bootstrap.reload();
      return;
    }
    reload();
  };

  let content;
  if (fresh) {
    content =
      view === 'month' ? (
        <>
          <MonthGrid days={days} monthKey={monthKey} today={today} onOpenDay={openDayAt} />
          <CalendarLegend />
        </>
      ) : (
        <>
          <WeekTimeGrid
            days={days}
            appointments={appointments}
            workingHours={workingHours}
            now={data.now}
            today={today}
            onOpenDay={openDayAt}
            onOpenAppointment={setSelected}
          />
          <WeekAgenda
            days={days}
            appointments={appointments}
            workingHours={workingHours}
            today={today}
            onOpenDay={openDayAt}
            onOpenAppointment={setSelected}
          />
        </>
      );
  } else if (error || (!base && bootstrap.error)) {
    content = <ErrorState error={error || bootstrap.error} onRetry={retry} />;
  } else {
    content = <LoadingState label="Cargando el calendario…" />;
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title="Calendario"
        description="Tu semana de un vistazo. Agenda citas a mano u ocupa horarios para ti."
        actions={<CalendarToolbar view={view} onViewChange={setView} onPrev={() => go(-1)} onNext={() => go(1)} onToday={goToday} disabled={!base} />}
      />
      <div className="-mt-1 mb-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <Button icon={CalendarPlus} onClick={() => openForm('appointment')} disabled={!today}>
          Nueva cita
        </Button>
        <Button variant="secondary" icon={Lock} onClick={() => openForm('block')} disabled={!today}>
          Ocupar horario
        </Button>
      </div>
      <CalendarStats stats={stats} view={view} />
      <section aria-labelledby="calendario-periodo" className="glass enter p-2 sm:p-4 lg:p-5" style={{ animationDelay: '160ms' }}>
        <div className="mb-3 flex min-h-[32px] items-center justify-between gap-3 px-1 pt-1 sm:pt-0">
          <h2 id="calendario-periodo" aria-live="polite" className="font-display text-lg font-semibold sm:text-xl">
            {base ? periodLabel(view, base) : 'Calendario'}
          </h2>
          {loading && fresh ? <Spinner className="h-5 w-5 text-accent-ink" label="Actualizando el calendario" /> : null}
        </div>
        {content}
      </section>

      {openDay ? (
        <DayPanel
          key={openDay.date}
          day={openDay}
          appointments={byDate.get(openDay.date) || EMPTY}
          workingHours={workingHours}
          isToday={openDay.date === today}
          today={today}
          time={openTime}
          onClose={() => setOpenDate(null)}
          onOpenAppointment={setSelected}
          onReschedule={startReschedule}
          onChanged={() => reload({ silent: true })}
          onNewAppointment={() => openForm('appointment', openDay.date, openTime)}
          onBlockTime={() => openForm('block', openDay.date, openTime)}
        />
      ) : null}

      <ManualAppointmentModal
        open={form?.type === 'appointment'}
        initialDate={form?.date}
        initialTime={form?.time}
        onClose={() => setForm(null)}
        onCreated={() => reload({ silent: true })}
      />
      <TimeBlockModal open={form?.type === 'block'} initialDate={form?.date} initialTime={form?.time} onClose={() => setForm(null)} onCreated={() => reload({ silent: true })} />

      {selected ? (
        <AppointmentDetailModal
          appointment={selected}
          onClose={() => setSelected(null)}
          today={today}
          timezone={settings?.timezone}
          businessName={settings?.businessName || 'Nails Art'}
          busyAction={actions.busyFor(selected.id)}
          disabled={Boolean(actions.busy)}
          onComplete={actions.complete}
          onCancel={actions.cancel}
          onReschedule={startReschedule}
          onReopen={actions.reopen}
          onPurged={(a) => handleAppointmentChanged(null, a.id)}
        />
      ) : null}
      <RescheduleModal appointment={moving} onClose={endReschedule} onDone={() => reload({ silent: true })} />

    </div>
  );
}
