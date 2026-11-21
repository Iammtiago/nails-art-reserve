'use client';

import { CalendarClock, CheckCircle2, CircleX, LockOpen, MessageCircle } from 'lucide-react';
import { APPOINTMENT_STATUS } from '@shared/constants.js';
import { formatDateLong, formatDayMonth, formatDuration, formatTime, formatTimeRange } from '@shared/format.js';
import { formatPhone } from '@shared/phone.js';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SuperDeleteButton } from '@/components/admin/SuperMode';
import { AppointmentTicket } from '@/components/admin/TicketDownload';
import { ATTENDED_CLASSES, CANCEL_CLASSES } from './AppointmentActions';
import { cancelledByLabel, contactHref, formatInstant } from './appointmentUtils';

function detailRows(appointment, timezone) {
  if (appointment.kind === 'block') return [];
  const rows = [
    { key: 'phone', label: 'Teléfono', value: formatPhone(appointment.clientPhone), href: `tel:+${appointment.clientPhone}` },
    { key: 'code', label: 'Código', value: appointment.bookingCode, mono: true },
  ];
  if (appointment.createdAt) rows.push({ key: 'created', label: 'Reservada', value: formatInstant(appointment.createdAt, timezone) });
  if (appointment.cancelledAt) {
    const by = cancelledByLabel(appointment.cancelledBy);
    rows.push({ key: 'cancelled', label: 'Cancelada', value: `${formatInstant(appointment.cancelledAt, timezone)}${by ? ` · por ${by}` : ''}` });
  }
  if (appointment.completedAt) rows.push({ key: 'completed', label: 'Asistencia', value: formatInstant(appointment.completedAt, timezone) });
  if (appointment.rescheduledAt) {
    const by = cancelledByLabel(appointment.rescheduledBy);
    const before = appointment.previousDate ? ` · antes ${formatDayMonth(appointment.previousDate)}, ${formatTime(appointment.previousTimeSlot)}` : '';
    rows.push({ key: 'rescheduled', label: 'Reagendada', value: `${formatInstant(appointment.rescheduledAt, timezone)}${by ? ` · por ${by}` : ''}${before}` });
  }
  return rows;
}

function DetailRow({ row }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 text-sm">
      <dt className="shrink-0 text-ink-2">{row.label}</dt>
      <dd className={`min-w-0 text-right font-semibold text-ink ${row.mono ? 'font-mono tracking-[0.2em] text-primary-ink' : ''}`}>
        {row.href ? (
          <a href={row.href} className="inline-flex min-h-[44px] items-center text-primary-ink underline-offset-4 hover:underline sm:min-h-0">
            {row.value}
          </a>
        ) : (
          row.value
        )}
      </dd>
    </div>
  );
}

function DetailFooter({ appointment, waHref, busyAction, disabled, onComplete, onCancel, onReschedule, onPurged }) {
  const confirmed = appointment.status === APPOINTMENT_STATUS.CONFIRMED;
  const purge = <SuperDeleteButton entity="appointment" item={appointment} onDeleted={onPurged} className="w-full sm:mr-auto sm:w-auto" />;
  if (appointment.kind === 'block') {
    return (
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {purge}
        {confirmed ? (
          <Button variant="secondary" icon={LockOpen} loading={busyAction === 'cancel'} disabled={disabled} onClick={() => onCancel(appointment)} className="w-full sm:w-auto">
            Liberar horario
          </Button>
        ) : null}
      </div>
    );
  }
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
      {purge}
      {confirmed ? (
        <Button variant="ghost" icon={CircleX} className={CANCEL_CLASSES} loading={busyAction === 'cancel'} disabled={disabled} onClick={() => onCancel(appointment)}>
          Cancelar cita
        </Button>
      ) : null}
      {confirmed && onReschedule ? (
        <Button variant="secondary" icon={CalendarClock} disabled={disabled} onClick={() => onReschedule(appointment)}>
          Reagendar
        </Button>
      ) : null}
      <Button variant="whatsapp" icon={MessageCircle} href={waHref} target="_blank" rel="noopener noreferrer">
        Escribir por WhatsApp
      </Button>
      {confirmed ? (
        <Button variant="soft" icon={CheckCircle2} className={ATTENDED_CLASSES} loading={busyAction === 'complete'} disabled={disabled} onClick={() => onComplete(appointment)}>
          Asistió
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Full detail of one appointment with the same actions as the list.
 * Works with list items (all fields) and calendar items (no created/cancelled/completed instants).
 */
export function AppointmentDetailModal({ appointment, onClose, today, timezone, businessName, busyAction = null, disabled = false, onComplete, onCancel, onReschedule, onPurged }) {
  const isToday = Boolean(today) && appointment.date === today;
  const waHref = contactHref(appointment, businessName);

  return (
    <Modal
      open
      onClose={onClose}
      title={appointment.clientName}
      description={
        appointment.kind === 'block'
          ? `Horario que reservaste para ti · ${formatDuration(appointment.durationMinutes)}`
          : `${appointment.serviceName} · ${formatDuration(appointment.durationMinutes)}`
      }
      footer={
        <DetailFooter
          appointment={appointment}
          waHref={waHref}
          busyAction={busyAction}
          disabled={disabled}
          onComplete={onComplete}
          onCancel={onCancel}
          onReschedule={onReschedule}
          onPurged={onPurged}
        />
      }
    >
      <div className="rounded-2xl bg-secondary-soft/70 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={appointment.status} kind={appointment.kind} />
          {isToday ? <Badge tone="accent">Hoy</Badge> : null}
        </div>
        <p className="mt-3 font-display text-2xl font-semibold leading-tight text-ink">{formatTimeRange(appointment.timeSlot, appointment.endTime)}</p>
        <p className="mt-1 text-base font-semibold text-accent-ink">{formatDateLong(appointment.date, { withYear: true })}</p>
      </div>
      <dl className="mt-2 divide-y divide-line/60">
        {detailRows(appointment, timezone).map((row) => (
          <DetailRow key={row.key} row={row} />
        ))}
      </dl>
      {appointment.kind !== 'block' && appointment.status !== APPOINTMENT_STATUS.CANCELLED ? <AppointmentTicket appointmentId={appointment.id} /> : null}
    </Modal>
  );
}
