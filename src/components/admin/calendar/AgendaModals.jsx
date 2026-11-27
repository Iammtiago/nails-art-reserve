'use client';

// «Nueva cita» (manual booking from the panel), «Reagendar» and «Ocupar horario» (time the salon keeps).
// All read the day's occupation to suggest free times; the server re-checks everything.

import { CalendarClock, CalendarPlus, Lock } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { APPOINTMENT_STATUS, LIMITS, TICK_MINUTES } from '@shared/constants.js';
import { formatDateLong, formatDuration, formatTime } from '@shared/format.js';
import { formatPhone } from '@shared/phone.js';
import { candidateStarts, getDayConfig, ticksFor } from '@shared/schedule.js';
import { adminAppointmentSchema, adminRescheduleSchema, fieldErrorsFor, timeBlockSchema } from '@shared/schemas.js';
import { guessMeridiem, partsToTime, toMinutes, toTime } from '@shared/time.js';
import { ApiError, apiGet, apiPatch, apiPost } from '@/lib/api';
import { useAsync } from '@/lib/hooks';
import { TicketDownloadButton, TicketQr } from '@/components/admin/TicketDownload';
import { useAdmin } from '@/components/admin/AdminContext';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

/**
 * Ticks already taken on `date` (confirmed and attended appointments plus time blocks).
 * `excludeId` leaves out the appointment being rescheduled, so its own time counts as free.
 */
function useOccupied(date, excludeId = null) {
  const state = useAsync(
    (signal) => (date ? apiGet('/api/admin/calendar', { from: date, to: date }, { signal }) : Promise.resolve(null)),
    [date],
  );
  const occupied = useMemo(() => {
    const set = new Set();
    for (const a of state.data?.appointments || []) {
      if (a.status === 'cancelled' || a.id === excludeId) continue;
      for (const t of ticksFor(toMinutes(a.timeSlot), toMinutes(a.endTime) - toMinutes(a.timeSlot))) set.add(t);
    }
    return set;
  }, [state.data, excludeId]);
  return { occupied, now: state.data?.now || null, loading: state.loading };
}

function isFree(occupied, startMinutes, duration) {
  return ticksFor(startMinutes, duration).every((t) => !occupied.has(t));
}

function notPast(now, date, startMinutes) {
  return !now || date > now.date || (date === now.date && startMinutes >= now.minutes);
}

function SlotChips({ slots, value, onPick }) {
  if (!slots.length) return <p className="rounded-xl bg-primary-soft/60 px-3 py-2.5 text-sm text-ink-2">No quedan horas libres en el horario de ese día. Escribe otra hora abajo.</p>;
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Horas libres">
      {slots.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onPick(t)}
          aria-pressed={value === t}
          className={`min-h-[44px] rounded-xl border px-3 text-sm font-semibold transition ${
            value === t ? 'border-primary bg-primary text-primary-on' : 'border-line bg-surface/80 text-ink hover:border-secondary'
          }`}
        >
          {formatTime(t)}
        </button>
      ))}
    </div>
  );
}

/** 'HH:mm' -> { hour: '5', minute: '30', meridiem: 'pm' } for the two typed fields. */
function toParts(time) {
  const minutes = toMinutes(time);
  const h = Math.floor(minutes / 60);
  return { hour: String(h % 12 || 12), minute: String(minutes % 60).padStart(2, '0'), meridiem: h < 12 ? 'am' : 'pm' };
}

const MERIDIEMS = [
  { value: 'am', label: 'a. m.' },
  { value: 'pm', label: 'p. m.' },
];

const digits = (value) => value.replace(/\D/g, '').slice(0, 2);

/**
 * «Otra hora»: hour and minutes typed in two boxes with a «:» between them, plus a. m. / p. m.
 * No colon to type, so the phone's number pad is enough (5 : 30, 6 : 45).
 * Reports 'HH:mm' through onChange, or '' while the fields are not a valid time.
 */
function TypedTime({ value, onChange, error, hint }) {
  const initial = value ? toParts(value) : { hour: '', minute: '', meridiem: 'pm' };
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);
  const [meridiem, setMeridiem] = useState(initial.meridiem);
  const [picked, setPicked] = useState(false);
  const minuteRef = useRef(null);
  const hourId = useId();
  const minuteId = useId();
  const hintId = useId();
  const errorId = useId();

  // Show the format error only once both boxes have something (or the minutes are wrong).
  const parsed = partsToTime(hour, minute, meridiem, TICK_MINUTES);
  const typedError = minute || hour.length === 2 ? parsed.error : null;
  const shownError = typedError || error;

  // A chip picked above replaces what was typed.
  useEffect(() => {
    if (value && value !== parsed.time) {
      const next = toParts(value);
      setHour(next.hour);
      setMinute(next.minute);
      setMeridiem(next.meridiem);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const report = (h, m, half) => onChange(partsToTime(h, m, half, TICK_MINUTES).time);

  const box =
    'block min-h-[52px] w-full min-w-0 rounded-xl border border-line bg-surface/90 px-2 text-center text-xl font-semibold tabular-nums text-ink shadow-sm outline-none transition placeholder:font-normal placeholder:text-ink-3 focus:border-accent focus:shadow-focus aria-[invalid=true]:border-danger';

  return (
    <div className="mt-3">
      <p className="field-label">O escribe la hora (también fuera del horario)</p>
      <div className="flex flex-wrap items-center gap-2 min-[380px]:flex-nowrap">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <label htmlFor={hourId} className="sr-only">
            Hora
          </label>
          <input
            id={hourId}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            placeholder="5"
            maxLength={2}
            value={hour}
            aria-invalid={shownError ? 'true' : undefined}
            aria-describedby={`${hintId}${shownError ? ` ${errorId}` : ''}`}
            onChange={(e) => {
              const next = digits(e.target.value);
              const half = picked || !next ? meridiem : guessMeridiem(next);
              setHour(next);
              setMeridiem(half);
              report(next, minute, half);
              // 2 to 9 cannot start a two-digit hour: jump to the minutes.
              if (next.length === 2 || (next.length === 1 && Number(next) >= 2)) minuteRef.current?.focus();
            }}
            className={box}
          />
          <span aria-hidden="true" className="font-display text-2xl font-semibold text-ink-2">
            :
          </span>
          <label htmlFor={minuteId} className="sr-only">
            Minutos
          </label>
          <input
            id={minuteId}
            ref={minuteRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            placeholder="30"
            maxLength={2}
            value={minute}
            aria-invalid={shownError ? 'true' : undefined}
            aria-describedby={`${hintId}${shownError ? ` ${errorId}` : ''}`}
            onChange={(e) => {
              const next = digits(e.target.value);
              setMinute(next);
              report(hour, next, meridiem);
            }}
            onBlur={() => {
              // «0» or «5» typed alone means :00 / :05.
              if (minute.length === 1) {
                const next = minute.padStart(2, '0');
                setMinute(next);
                report(hour, next, meridiem);
              }
            }}
            className={box}
          />
        </div>
        <div role="group" aria-label="Mañana o tarde" className="flex w-full shrink-0 rounded-xl border border-line bg-surface/80 p-1 min-[380px]:w-auto">
          {MERIDIEMS.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={meridiem === m.value}
              onClick={() => {
                setPicked(true);
                setMeridiem(m.value);
                report(hour, minute, m.value);
              }}
              className={`min-h-[44px] flex-1 rounded-lg px-3 text-sm font-semibold transition min-[380px]:flex-none ${
                meridiem === m.value ? 'bg-primary text-primary-on' : 'text-ink-2 hover:text-ink'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {hint ? (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      ) : (
        <span id={hintId} hidden />
      )}
      {shownError ? (
        <p id={errorId} className="field-error" role="alert">
          {shownError}
        </p>
      ) : null}
    </div>
  );
}

// ---------- Nueva cita ----------

function ManualForm({ initialDate, initialTime = null, initialClient = null, onDone, onCancel }) {
  const { settings, handleError } = useAdmin();
  const services = (settings?.services || []).filter((s) => s.isActive !== false);
  const [form, setForm] = useState({
    serviceKey: services[0]?.key || '',
    date: initialDate,
    timeSlot: initialTime || '',
    // Chosen from Clientes: her name and phone come filled in.
    clientName: initialClient?.name || '',
    clientPhone: initialClient?.phone ? formatPhone(initialClient.phone) : '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const { occupied, now } = useOccupied(form.date);
  const service = services.find((s) => s.key === form.serviceKey);
  const duration = service?.durationMinutes || 60;

  const slots = useMemo(() => {
    const day = getDayConfig(settings?.workingHours, form.date);
    return candidateStarts(day, duration)
      .filter((m) => notPast(now, form.date, m) && isFree(occupied, m, duration))
      .map(toTime);
  }, [settings?.workingHours, form.date, duration, occupied, now]);

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const chosen = form.timeSlot ? toMinutes(form.timeSlot) : null;
  const clash = chosen !== null && !isFree(occupied, chosen, duration);

  async function submit(event) {
    event.preventDefault();
    const local = fieldErrorsFor(adminAppointmentSchema, form);
    if (!form.timeSlot) local.timeSlot = 'Elige la hora.';
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setSaving(true);
    try {
      const { appointment } = await apiPost('/api/admin/appointments', form);
      onDone(appointment);
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors()).some((k) => k in form)) setErrors(error.fieldErrors());
      else if (error instanceof ApiError && (error.status === 409 || error.status === 422)) setErrors({ timeSlot: error.message });
      else handleError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre de la clienta" error={errors.clientName}>
          {(p) => <Input {...p} value={form.clientName} onChange={(e) => set('clientName', e.target.value)} autoComplete="off" placeholder="Nombre y apellido" />}
        </Field>
        <Field label="Teléfono" hint="Con él podrá ver o cancelar su cita." error={errors.clientPhone}>
          {(p) => <Input {...p} type="tel" inputMode="tel" value={form.clientPhone} onChange={(e) => set('clientPhone', e.target.value)} autoComplete="off" placeholder="0414 123 4567" />}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Servicio" error={errors.serviceKey}>
          {(p) => (
            <Select {...p} value={form.serviceKey} onChange={(e) => set('serviceKey', e.target.value)}>
              {services.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name} · {formatDuration(s.durationMinutes)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Fecha" error={errors.date}>
          {(p) => <Input {...p} type="date" value={form.date} min={now?.date} onChange={(e) => set('date', e.target.value)} />}
        </Field>
      </div>
      <div>
        <p className="field-label">Hora</p>
        <SlotChips slots={slots} value={form.timeSlot} onPick={(t) => set('timeSlot', t)} />
        <TypedTime
          value={form.timeSlot}
          onChange={(t) => set('timeSlot', t)}
          error={errors.timeSlot || (clash ? 'Esa hora choca con otra cita u horario ocupado.' : undefined)}
          hint={chosen !== null ? `De ${formatTime(form.timeSlot)} a ${formatTime(toTime(chosen + duration))}: ese rato queda ocupado.` : 'Por ejemplo 5 : 30 o 6 : 45.'}
        />
      </div>
      <div className="sticky bottom-0 -mx-1 flex flex-col-reverse gap-2 bg-transparent px-1 pt-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" icon={CalendarPlus} loading={saving} disabled={clash}>
          Agendar cita
        </Button>
      </div>
    </form>
  );
}

function ManualDone({ appointment, onClose }) {
  return (
    <div className="space-y-4 text-center">
      <div>
        <p className="font-display text-xl font-semibold">Cita agendada</p>
        <p className="mt-1 text-sm text-ink-2">
          {appointment.clientName} · {appointment.serviceName} · {formatDateLong(appointment.date)}, {formatTime(appointment.timeSlot)}
        </p>
      </div>
      {appointment.qrDataUrl ? (
        <div className="flex justify-center">
          <TicketQr ticket={appointment} />
        </div>
      ) : null}
      <p className="code-text rounded-2xl bg-secondary py-3 text-2xl font-bold text-secondary-on">{appointment.bookingCode}</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <TicketDownloadButton ticket={appointment} />
        <Button variant="ghost" onClick={onClose}>
          Listo
        </Button>
      </div>
    </div>
  );
}

export function ManualAppointmentModal({ open, initialDate, initialTime = null, initialClient = null, onClose, onCreated }) {
  const [done, setDone] = useState(null);
  useEffect(() => {
    if (!open) setDone(null);
  }, [open]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={done ? 'Listo' : initialClient ? `Nueva cita para ${initialClient.name}` : 'Nueva cita'}
      description={done ? undefined : 'Para citas por teléfono, WhatsApp o en persona. Puedes usar cualquier día y hora libre.'}
      size="lg"
      placement="top"
    >
      {open && !done ? (
        <ManualForm
          initialDate={initialDate}
          initialTime={initialTime}
          initialClient={initialClient}
          onCancel={onClose}
          onDone={(appointment) => {
            setDone(appointment);
            onCreated?.(appointment);
          }}
        />
      ) : null}
      {open && done ? <ManualDone appointment={done} onClose={onClose} /> : null}
    </Modal>
  );
}

// ---------- Reagendar ----------

function RescheduleForm({ appointment, onDone, onCancel }) {
  const { settings, handleError } = useAdmin();
  const toast = useToast();
  // A past appointment (missed, or attended by mistake) starts on today: the past cannot be booked.
  const [form, setForm] = useState(() => {
    const today = settings?.now?.date;
    return { date: today && appointment.date < today ? today : appointment.date, timeSlot: '' };
  });
  const attended = appointment.status === APPOINTMENT_STATUS.COMPLETED;
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const { occupied, now } = useOccupied(form.date, appointment.id);
  const duration = appointment.durationMinutes || toMinutes(appointment.endTime) - toMinutes(appointment.timeSlot);

  // The panel's settings may be from yesterday (left open overnight): the server's «now» wins.
  useEffect(() => {
    if (now?.date && form.date < now.date) setForm((current) => ({ ...current, date: now.date, timeSlot: '' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now?.date]);

  const slots = useMemo(() => {
    const day = getDayConfig(settings?.workingHours, form.date);
    return candidateStarts(day, duration)
      .filter((m) => notPast(now, form.date, m) && isFree(occupied, m, duration))
      .map(toTime)
      .filter((t) => !(form.date === appointment.date && t === appointment.timeSlot));
  }, [settings?.workingHours, form.date, duration, occupied, now, appointment.date, appointment.timeSlot]);

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const chosen = form.timeSlot ? toMinutes(form.timeSlot) : null;
  const clash = chosen !== null && !isFree(occupied, chosen, duration);
  const unchanged = form.date === appointment.date && form.timeSlot === appointment.timeSlot;

  async function submit(event) {
    event.preventDefault();
    const local = fieldErrorsFor(adminRescheduleSchema, form);
    if (!form.timeSlot) local.timeSlot = 'Elige la nueva hora.';
    else if (unchanged) local.timeSlot = 'Esa ya es la hora de la cita. Elige otra.';
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setSaving(true);
    try {
      const { appointment: updated } = await apiPatch(`/api/admin/appointments/${appointment.id}/reschedule`, form);
      // formatTime already ends in «a. m.»/«p. m.»: no extra period.
      toast.success(`Cita reagendada: ${formatDateLong(updated.date).toLowerCase()}, ${formatTime(updated.timeSlot)}`);
      onDone(updated);
    } catch (error) {
      const gone = error instanceof ApiError && (error.status === 404 || error.code === 'NOT_ACTIVE');
      if (error instanceof ApiError && Object.keys(error.fieldErrors()).some((k) => k in form)) setErrors(error.fieldErrors());
      else if (!gone && error instanceof ApiError && (error.status === 409 || error.status === 422)) setErrors({ timeSlot: error.message });
      else {
        handleError(error);
        if (gone) onDone(null);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="rounded-2xl bg-secondary-soft/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Ahora está agendada</p>
        <p className="mt-1 font-semibold text-accent-ink">
          {formatDateLong(appointment.date, { withYear: true })} · {formatTime(appointment.timeSlot)} – {formatTime(appointment.endTime)}
        </p>
        <p className="mt-1 text-sm text-ink-2">
          {appointment.clientName} · {appointment.serviceName} · {formatDuration(duration)}
        </p>
        {attended ? (
          <p className="mt-2 rounded-xl bg-warning-soft px-3 py-2 text-xs font-medium text-warning">
            Está marcada como atendida. Al reagendarla vuelve a quedar pendiente.
          </p>
        ) : null}
      </div>
      <Field label="Nueva fecha" error={errors.date}>
        {(p) => <Input {...p} type="date" value={form.date} min={now?.date} onChange={(e) => set('date', e.target.value)} />}
      </Field>
      <div>
        <p className="field-label">Nueva hora</p>
        <SlotChips slots={slots} value={form.timeSlot} onPick={(t) => set('timeSlot', t)} />
        <TypedTime
          value={form.timeSlot}
          onChange={(t) => set('timeSlot', t)}
          error={errors.timeSlot || (clash ? 'Esa hora choca con otra cita u horario ocupado.' : undefined)}
          hint={chosen !== null ? `De ${formatTime(form.timeSlot)} a ${formatTime(toTime(chosen + duration))}. El horario anterior queda libre.` : 'Por ejemplo 5 : 30 o 6 : 45.'}
        />
      </div>
      <p className="text-xs text-ink-3">El código y el QR de la clienta no cambian. Avísale la nueva hora por WhatsApp.</p>
      <div className="sticky bottom-0 -mx-1 flex flex-col-reverse gap-2 bg-transparent px-1 pt-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>
          Volver
        </Button>
        <Button type="submit" icon={CalendarClock} loading={saving} disabled={clash || unchanged}>
          Reagendar cita
        </Button>
      </div>
    </form>
  );
}

/** Moves a confirmed appointment to another date or time. onDone(updated | null, id). */
export function RescheduleModal({ appointment, onClose, onDone }) {
  return (
    <Modal
      open={Boolean(appointment)}
      onClose={onClose}
      title="Reagendar cita"
      description="Elige la nueva fecha y hora: cualquier día desde hoy, aunque esté lejos, y cualquier hora libre."
      size="lg"
      placement="top"
    >
      {appointment ? (
        <RescheduleForm
          key={appointment.id}
          appointment={appointment}
          onCancel={onClose}
          onDone={(updated) => {
            onDone?.(updated, appointment.id);
            onClose();
          }}
        />
      ) : null}
    </Modal>
  );
}

// ---------- Ocupar horario ----------

function BlockForm({ initialDate, initialTime = null, onDone, onCancel }) {
  const { handleError } = useAdmin();
  const toast = useToast();
  const [form, setForm] = useState(() => ({
    date: initialDate,
    start: initialTime || '',
    // One hour by default, never past midnight.
    end: initialTime ? toTime(Math.min(toMinutes(initialTime) + 60, 23 * 60 + 45)) : '',
    reason: '',
  }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const { occupied, now } = useOccupied(form.date);

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined, end: key === 'start' ? undefined : e.end }));
  };

  const range = form.start && form.end && toMinutes(form.end) > toMinutes(form.start) ? [toMinutes(form.start), toMinutes(form.end)] : null;
  const clash = range && !isFree(occupied, range[0], range[1] - range[0]);

  async function submit(event) {
    event.preventDefault();
    const local = fieldErrorsFor(timeBlockSchema, form);
    if (!form.start) local.start = 'Elige la hora de inicio.';
    if (!form.end) local.end = 'Elige la hora final.';
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setSaving(true);
    try {
      const { block } = await apiPost('/api/admin/time-blocks', form);
      toast.success(`Horario ocupado: ${formatTime(block.timeSlot)} – ${formatTime(block.endTime)}.`);
      onDone(block);
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors()).some((k) => k in form)) setErrors(error.fieldErrors());
      else if (error instanceof ApiError && (error.status === 409 || error.status === 422)) setErrors({ end: error.message });
      else handleError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Fecha" error={errors.date}>
        {(p) => <Input {...p} type="date" value={form.date} min={now?.date} onChange={(e) => set('date', e.target.value)} />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Desde" error={errors.start}>
          {(p) => <Input {...p} type="time" step={TICK_MINUTES * 60} value={form.start} onChange={(e) => set('start', e.target.value)} />}
        </Field>
        <Field label="Hasta" error={errors.end || (clash ? 'Ese rango choca con una cita u otro horario ocupado.' : undefined)}>
          {(p) => <Input {...p} type="time" step={TICK_MINUTES * 60} value={form.end} onChange={(e) => set('end', e.target.value)} />}
        </Field>
      </div>
      <Field label="Motivo" hint={`Opcional, solo lo ves tú. ${form.reason.length}/${LIMITS.blockReasonMax}`} error={errors.reason}>
        {(p) => <Input {...p} value={form.reason} maxLength={LIMITS.blockReasonMax} onChange={(e) => set('reason', e.target.value)} placeholder="Almuerzo, diligencia…" autoComplete="off" />}
      </Field>
      <p className="text-xs text-ink-3">Las clientas no podrán reservar en ese rango. Para cerrar el día entero, usa «Bloquear día» al tocar el día en el calendario.</p>
      <div className="sticky bottom-0 -mx-1 flex flex-col-reverse gap-2 bg-transparent px-1 pt-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" icon={Lock} loading={saving} disabled={Boolean(clash)}>
          Ocupar horario
        </Button>
      </div>
    </form>
  );
}

export function TimeBlockModal({ open, initialDate, initialTime = null, onClose, onCreated }) {
  return (
    <Modal open={open} onClose={onClose} title="Ocupar horario" description="Reserva un rango del día para ti." size="sm" placement="top">
      {open ? (
        <BlockForm
          initialDate={initialDate}
          initialTime={initialTime}
          onCancel={onClose}
          onDone={(block) => {
            onCreated?.(block);
            onClose();
          }}
        />
      ) : null}
    </Modal>
  );
}
