'use client';

import { AlertTriangle, CalendarPlus, Clock, Lock, LockOpen } from 'lucide-react';
import { useState } from 'react';
import { LIMITS } from '@shared/constants.js';
import { formatDateLong, formatDuration, formatTime, formatTimeRange, pluralize } from '@shared/format.js';
import { apiDelete, apiPost } from '@/lib/api';
import { useAdmin } from '@/components/admin/AdminContext';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { OccupancyBar } from './OccupancyBar';
import { dayState, dayStatusText, occupancyPercent, percentText } from './calendarUtils';

function DayOccupancy({ day }) {
  const percent = occupancyPercent(day);
  return (
    <div className="rounded-2xl bg-secondary-soft/70 p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Ocupación</p>
          <p className="font-display text-2xl font-semibold leading-tight text-ink">{percentText(percent)}</p>
        </div>
        <p className="text-right text-xs text-ink-2">
          {formatDuration(day.bookedMinutes)} de {formatDuration(day.capacityMinutes)}
          <br />
          {pluralize(day.pendingCount, 'pendiente', 'pendientes')}
        </p>
      </div>
      <OccupancyBar percent={percent} className="mt-3" />
    </div>
  );
}

function DayAppointment({ appointment, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(appointment)}
      className="flex min-h-[56px] w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-primary-soft"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{formatTimeRange(appointment.timeSlot, appointment.endTime)}</span>
        <span className="block truncate text-sm text-ink-2">
          {appointment.clientName} · {appointment.serviceName}
        </span>
      </span>
      <StatusBadge status={appointment.status} kind={appointment.kind} />
    </button>
  );
}

function BlockForm({ day, saving, reason, onReasonChange, onSubmit }) {
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      {day.pendingCount > 0 ? (
        <p className="flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2.5 text-sm text-warning">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          {day.pendingCount === 1
            ? 'Este día tiene 1 cita agendada. Bloquearlo no la cancela.'
            : `Este día tiene ${day.pendingCount} citas agendadas. Bloquearlo no las cancela.`}
        </p>
      ) : null}
      <Field label="Motivo" hint={`Opcional, por ejemplo «Feriado». ${reason.length}/${LIMITS.blockReasonMax}`}>
        {(p) => (
          <Input
            {...p}
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            maxLength={LIMITS.blockReasonMax}
            placeholder="Feriado"
            autoComplete="off"
          />
        )}
      </Field>
      <div className="flex justify-end">
        <Button type="submit" icon={Lock} loading={saving} className="w-full sm:w-auto">
          Bloquear día
        </Button>
      </div>
    </form>
  );
}

function UnblockBar({ saving, onUnblock }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-ink-2">Tus clientas no pueden reservar este día.</p>
      <Button variant="secondary" icon={LockOpen} loading={saving} onClick={onUnblock} className="w-full sm:w-auto">
        Desbloquear día
      </Button>
    </div>
  );
}

/** One day: status, occupancy, appointments and block/unblock (today and future only). */
export function DayPanel({ day, appointments, workingHours, isToday, time = null, onClose, onOpenAppointment, onChanged, onNewAppointment, onBlockTime }) {
  const toast = useToast();
  const { handleError } = useAdmin();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const state = dayState(day);
  const editable = !day.isPast;

  async function block(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const response = await apiPost('/api/admin/blocked-dates', { date: day.date, reason: reason.trim() });
      toast.success('Día bloqueado');
      const affected = Number(response?.affectedAppointments) || 0;
      if (affected > 0) {
        toast.info(
          affected === 1
            ? 'Hay 1 cita agendada ese día: avísale o cancélala desde Citas.'
            : `Hay ${affected} citas agendadas ese día: avísales o cancélalas desde Citas.`,
        );
      }
      setReason('');
      onChanged();
    } catch (error) {
      handleError(error);
    } finally {
      setSaving(false);
    }
  }

  async function unblock() {
    if (saving) return;
    setSaving(true);
    try {
      await apiDelete(`/api/admin/blocked-dates/${day.date}`);
      toast.success('Día desbloqueado');
      onChanged();
    } catch (error) {
      handleError(error);
    } finally {
      setSaving(false);
    }
  }

  let footer = null;
  if (editable) {
    footer =
      state === 'blocked' ? (
        <UnblockBar saving={saving} onUnblock={unblock} />
      ) : (
        <BlockForm day={day} saving={saving} reason={reason} onReasonChange={setReason} onSubmit={block} />
      );
  }

  return (
    <Modal open onClose={onClose} title={formatDateLong(day.date, { withYear: true })} description={dayStatusText(day, workingHours)} footer={footer}>
      {/* Initial focus lands here, not on the reason field, so the keyboard does not pop up on phones. */}
      <div data-autofocus tabIndex={-1} className="space-y-4 outline-none">
        {isToday || day.isPast ? (
          <div className="flex flex-wrap gap-2">
            {isToday ? <Badge tone="accent">Hoy</Badge> : null}
            {day.isPast ? <Badge tone="neutral">Día pasado · solo lectura</Badge> : null}
          </div>
        ) : null}

        {day.isOpen && state !== 'blocked' ? <DayOccupancy day={day} /> : null}

        {editable ? (
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" icon={CalendarPlus} onClick={onNewAppointment}>
              {time ? `Agendar a las ${formatTime(time)}` : 'Agendar aquí'}
            </Button>
            <Button size="sm" variant="secondary" icon={Clock} onClick={onBlockTime}>
              {time ? `Ocupar desde ${formatTime(time)}` : 'Ocupar horas'}
            </Button>
          </div>
        ) : null}

        <div>
          <h3 className="mb-1 font-sans text-sm font-semibold text-ink">
            Citas del día <span className="font-normal text-ink-3">· {appointments.length}</span>
          </h3>
          {appointments.length ? (
            <ul className="-mx-3 divide-y divide-line/60">
              {appointments.map((appointment) => (
                <li key={appointment.id}>
                  <DayAppointment appointment={appointment} onOpen={onOpenAppointment} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl bg-primary-soft/50 px-3 py-4 text-center text-sm text-ink-3">Sin citas este día</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
