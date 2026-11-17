'use client';

import { formatDuration, formatTime, formatTimeRange } from '@shared/format.js';
import { formatPhone } from '@shared/phone.js';
import { StatusBadge } from '@/components/ui/Badge';
import { AppointmentActions } from './AppointmentActions';
import { contactHref, dateLabel, staggerDelay } from './appointmentUtils';

// Same columns for the header and every row, so they line up (Hora, Clienta, Servicio, Código, Estado, Acciones).
const ROW_GRID =
  'lg:grid-cols-[7rem_minmax(0,1.2fr)_minmax(0,1fr)_5rem_6.75rem_8.75rem] xl:grid-cols-[8rem_minmax(0,1.25fr)_minmax(0,1fr)_5.5rem_7rem_17rem]';

// The whole row/card opens the detail: the button stretches over it; actions sit above.
const STRETCHED =
  "text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-accent";

function TimeRange({ start, end, className = '' }) {
  return (
    <span className={`font-semibold text-ink ${className}`}>
      <span className="whitespace-nowrap">{formatTime(start)} –</span> <span className="whitespace-nowrap">{formatTime(end)}</span>
    </span>
  );
}

function openLabel(appointment, today) {
  return `Ver detalle de la cita de ${appointment.clientName}: ${dateLabel(appointment.date, today)}, ${formatTimeRange(appointment.timeSlot, appointment.endTime)}`;
}

function AppointmentRow({ appointment, today, businessName, busyAction, disabled, onOpen, onComplete, onCancel, onPurged, index }) {
  const isToday = appointment.date === today;
  return (
    <li
      className={`enter relative grid items-center gap-2.5 px-4 py-3 transition hover:bg-primary-soft/50 ${ROW_GRID}`}
      style={{ animationDelay: staggerDelay(index) }}
    >
      <div className="min-w-0 text-sm">
        <button type="button" onClick={() => onOpen(appointment)} aria-label={openLabel(appointment, today)} className={`block ${STRETCHED}`}>
          <TimeRange start={appointment.timeSlot} end={appointment.endTime} />
        </button>
        <p className={`mt-0.5 text-xs ${isToday ? 'font-semibold text-accent-ink' : 'text-ink-3'}`}>{dateLabel(appointment.date, today)}</p>
      </div>
      <div className="min-w-0">
        <p className="truncate font-semibold text-ink" title={appointment.clientName}>
          {appointment.clientName}
        </p>
        <p className="truncate text-xs text-ink-2">{formatPhone(appointment.clientPhone)}</p>
      </div>
      <div className="min-w-0">
        <p className="line-clamp-2 text-sm text-ink" title={appointment.serviceName}>
          {appointment.serviceName}
        </p>
        <p className="text-xs text-ink-3">{formatDuration(appointment.durationMinutes)}</p>
      </div>
      <p className="font-mono text-sm font-semibold tracking-[0.15em] text-primary-ink">{appointment.bookingCode}</p>
      <div className="min-w-0">
        <StatusBadge status={appointment.status} />
      </div>
      <AppointmentActions
        appointment={appointment}
        waHref={contactHref(appointment, businessName)}
        busyAction={busyAction}
        disabled={disabled}
        onComplete={onComplete}
        onCancel={onCancel}
        onPurged={onPurged}
        compactOnLg
        className="relative z-10 justify-end"
      />
    </li>
  );
}

function AppointmentCard({ appointment, today, businessName, busyAction, disabled, onOpen, onComplete, onCancel, onPurged, index }) {
  const isToday = appointment.date === today;
  return (
    <li className="glass enter relative p-4" style={{ animationDelay: staggerDelay(index) }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button type="button" onClick={() => onOpen(appointment)} aria-label={openLabel(appointment, today)} className={`block after:rounded-2xl ${STRETCHED}`}>
            <TimeRange start={appointment.timeSlot} end={appointment.endTime} className="text-base" />
          </button>
          <p className={`mt-0.5 text-xs ${isToday ? 'font-semibold text-accent-ink' : 'text-ink-3'}`}>
            {dateLabel(appointment.date, today)} · {formatDuration(appointment.durationMinutes)}
          </p>
        </div>
        <StatusBadge status={appointment.status} />
      </div>
      <div className="mt-3 min-w-0">
        <p className="truncate font-semibold text-ink">{appointment.clientName}</p>
        <p className="text-sm text-ink-2">{formatPhone(appointment.clientPhone)}</p>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-3 text-sm">
        <p className="min-w-0 truncate text-ink-2">{appointment.serviceName}</p>
        <span className="shrink-0 font-mono text-xs font-semibold tracking-[0.15em] text-primary-ink">{appointment.bookingCode}</span>
      </div>
      <AppointmentActions
        appointment={appointment}
        waHref={contactHref(appointment, businessName)}
        busyAction={busyAction}
        disabled={disabled}
        onComplete={onComplete}
        onCancel={onCancel}
        onPurged={onPurged}
        className="relative z-10 mt-3 border-t border-line/60 pt-3"
      />
    </li>
  );
}

/**
 * Appointment list: table-like rows inside a glass card from lg, stacked cards below.
 * busyFor(id) -> 'complete' | 'cancel' | null; anyBusy disables every action meanwhile.
 */
export function AppointmentList({ items, today, businessName, busyFor, anyBusy, refreshing, onOpen, onComplete, onCancel, onPurged }) {
  const shared = { today, businessName, onOpen, onComplete, onCancel, onPurged, disabled: anyBusy };
  return (
    <div className={`transition-opacity duration-200 ${refreshing ? 'opacity-60' : ''}`} aria-busy={refreshing || undefined}>
      <div className="glass hidden overflow-hidden lg:block">
        <div
          aria-hidden="true"
          className={`grid gap-2.5 border-b border-line/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-3 ${ROW_GRID}`}
        >
          <span>Hora</span>
          <span>Clienta</span>
          <span>Servicio</span>
          <span>Código</span>
          <span>Estado</span>
          <span className="text-right">Acciones</span>
        </div>
        <ul className="divide-y divide-line/60">
          {items.map((appointment, index) => (
            <AppointmentRow key={appointment.id} appointment={appointment} index={index} busyAction={busyFor(appointment.id)} {...shared} />
          ))}
        </ul>
      </div>
      <ul className="grid gap-3 lg:hidden">
        {items.map((appointment, index) => (
          <AppointmentCard key={appointment.id} appointment={appointment} index={index} busyAction={busyFor(appointment.id)} {...shared} />
        ))}
      </ul>
    </div>
  );
}
