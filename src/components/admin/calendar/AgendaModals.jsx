'use client';

// «Nueva cita» (manual booking from the panel) and «Ocupar horario» (time the salon keeps).
// Both read the day's occupation to suggest free times; the server re-checks everything.

import { CalendarPlus, Check, Copy, Lock, MessageCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { LIMITS, TICK_MINUTES } from '@shared/constants.js';
import { formatDateLong, formatDuration, formatTime } from '@shared/format.js';
import { candidateStarts, getDayConfig, ticksFor } from '@shared/schedule.js';
import { adminAppointmentSchema, fieldErrorsFor, timeBlockSchema } from '@shared/schemas.js';
import { toMinutes, toTime } from '@shared/time.js';
import { whatsappLink } from '@shared/whatsapp.js';
import { ApiError, apiGet, apiPost } from '@/lib/api';
import { useAsync } from '@/lib/hooks';
import { useAdmin } from '@/components/admin/AdminContext';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

/** Ticks already taken on `date` (confirmed and attended appointments plus time blocks). */
function useOccupied(date) {
  const state = useAsync(
    (signal) => (date ? apiGet('/api/admin/calendar', { from: date, to: date }, { signal }) : Promise.resolve(null)),
    [date],
  );
  const occupied = useMemo(() => {
    const set = new Set();
    for (const a of state.data?.appointments || []) {
      if (a.status === 'cancelled') continue;
      for (const t of ticksFor(toMinutes(a.timeSlot), toMinutes(a.endTime) - toMinutes(a.timeSlot))) set.add(t);
    }
    return set;
  }, [state.data]);
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

// ---------- Nueva cita ----------

function ManualForm({ initialDate, onDone, onCancel }) {
  const { settings, handleError } = useAdmin();
  const services = (settings?.services || []).filter((s) => s.isActive !== false);
  const [form, setForm] = useState({ serviceKey: services[0]?.key || '', date: initialDate, timeSlot: '', clientName: '', clientPhone: '' });
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
        <Field
          label="Otra hora (también fuera del horario)"
          className="mt-3"
          error={errors.timeSlot || (clash ? 'Esa hora choca con otra cita u horario ocupado.' : undefined)}
          hint={chosen !== null ? `Termina a las ${formatTime(toTime(chosen + duration))}.` : 'En tramos de 15 minutos.'}
        >
          {(p) => <Input {...p} type="time" step={TICK_MINUTES * 60} value={form.timeSlot} onChange={(e) => set('timeSlot', e.target.value)} />}
        </Field>
      </div>
      <div className="sticky bottom-0 -mx-1 flex flex-col-reverse gap-2 bg-gradient-to-t from-surface via-surface/95 to-transparent px-1 pt-3 sm:flex-row sm:justify-end">
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
  const { settings } = useAdmin();
  const toast = useToast();
  const text = `Hola ${appointment.clientName.split(' ')[0]}, tu cita en ${settings?.businessName || 'Nails Art'} quedó agendada: ${appointment.serviceName}, ${formatDateLong(
    appointment.date,
  ).toLowerCase()} a las ${formatTime(appointment.timeSlot)}. Tu código es ${appointment.bookingCode}; muéstralo al llegar.`;
  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-success-soft text-success">
        <Check aria-hidden="true" className="h-7 w-7" />
      </div>
      <div>
        <p className="font-display text-xl font-semibold">Cita agendada</p>
        <p className="mt-1 text-sm text-ink-2">
          {appointment.clientName} · {appointment.serviceName} · {formatDateLong(appointment.date)}, {formatTime(appointment.timeSlot)}
        </p>
      </div>
      <p className="code-text rounded-2xl bg-secondary py-3 text-2xl font-bold text-secondary-on">{appointment.bookingCode}</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button variant="whatsapp" icon={MessageCircle} href={whatsappLink(appointment.clientPhone, text)} target="_blank" rel="noopener noreferrer">
          Enviar por WhatsApp
        </Button>
        <Button
          variant="secondary"
          icon={Copy}
          onClick={() =>
            navigator.clipboard
              ?.writeText(appointment.bookingCode)
              .then(() => toast.success('Código copiado'))
              .catch(() => {})
          }
        >
          Copiar código
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Listo
        </Button>
      </div>
    </div>
  );
}

export function ManualAppointmentModal({ open, initialDate, onClose, onCreated }) {
  const [done, setDone] = useState(null);
  useEffect(() => {
    if (!open) setDone(null);
  }, [open]);
  return (
    <Modal open={open} onClose={onClose} title={done ? 'Listo' : 'Nueva cita'} description={done ? undefined : 'Para citas por teléfono, WhatsApp o en el salón. Puedes usar cualquier hora libre.'} size="lg" placement="top">
      {open && !done ? (
        <ManualForm
          initialDate={initialDate}
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

// ---------- Ocupar horario ----------

function BlockForm({ initialDate, onDone, onCancel }) {
  const { handleError } = useAdmin();
  const toast = useToast();
  const [form, setForm] = useState({ date: initialDate, start: '', end: '', reason: '' });
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
      <div className="sticky bottom-0 -mx-1 flex flex-col-reverse gap-2 bg-gradient-to-t from-surface via-surface/95 to-transparent px-1 pt-3 sm:flex-row sm:justify-end">
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

export function TimeBlockModal({ open, initialDate, onClose, onCreated }) {
  return (
    <Modal open={open} onClose={onClose} title="Ocupar horario" description="Reserva un rango del día para ti." size="sm" placement="top">
      {open ? (
        <BlockForm
          initialDate={initialDate}
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
