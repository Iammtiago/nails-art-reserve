'use client';

import { useMemo } from 'react';
import { APPOINTMENT_STATUS, DAY_SHORT_NAMES, STATUS_LABELS } from '@shared/constants.js';
import { formatTime, formatTimeRange, pluralize } from '@shared/format.js';
import { toMinutes, toTime } from '@shared/time.js';
import {
  appointmentEndMinutes,
  dayAriaLabel,
  dayNumber,
  dayState,
  groupByDate,
  offHourSpans,
  segmentsFor,
  weekFrame,
} from './calendarUtils';

const COLUMNS = 'grid-cols-[4.5rem_repeat(7,minmax(0,1fr))]';
const REM_PER_SLOT = 2.25; // 30 minutes = 36 px

function toPercent(minutes, frame) {
  return ((minutes - frame.start) / (frame.end - frame.start)) * 100;
}

function WeekDayHeader({ day, isToday, onOpen }) {
  const state = dayState(day);
  const label = dayAriaLabel(day, isToday);
  let status = 'Sin citas';
  if (state === 'blocked') status = 'Bloqueado';
  else if (state === 'closed') status = 'Cerrado';
  else if (day.appointmentsCount) status = pluralize(day.appointmentsCount, 'cita', 'citas');
  return (
    <button
      type="button"
      onClick={() => onOpen(day.date)}
      aria-label={label}
      title={label}
      className={`mx-0.5 mb-2 flex min-h-[68px] min-w-0 flex-col items-center justify-center rounded-xl px-1 py-2 text-center transition hover:bg-primary-soft ${
        isToday ? 'bg-accent-soft ring-2 ring-accent' : ''
      } ${day.isPast && !isToday ? 'opacity-70' : ''}`}
    >
      <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-ink-3">{DAY_SHORT_NAMES[day.dayOfWeek]}</span>
      <span className={`font-display text-xl font-semibold leading-tight ${isToday ? 'text-accent-ink' : 'text-ink'}`}>{dayNumber(day.date)}</span>
      <span className={`block w-full truncate text-[0.7rem] ${state === 'blocked' ? 'font-semibold text-danger' : 'text-ink-2'}`}>{status}</span>
    </button>
  );
}

function WeekAppointmentBlock({ appointment, frame, onOpen }) {
  const start = toMinutes(appointment.timeSlot);
  const end = appointmentEndMinutes(appointment);
  const top = toPercent(Math.max(start, frame.start), frame);
  const height = toPercent(Math.min(end, frame.end), frame) - top;
  const completed = appointment.status === APPOINTMENT_STATUS.COMPLETED;
  const label = `${formatTimeRange(appointment.timeSlot, appointment.endTime)}, ${appointment.clientName}, ${appointment.serviceName}, ${
    STATUS_LABELS[appointment.status] || appointment.status
  }`;
  return (
    <button
      type="button"
      onClick={() => onOpen(appointment)}
      aria-label={label}
      title={label}
      className={`absolute inset-x-1 z-10 flex flex-col overflow-hidden rounded-lg border-l-4 px-2 py-1 text-left text-xs leading-snug shadow-sm transition hover:z-20 hover:shadow-lift focus-visible:z-20 ${
        completed ? 'border-success bg-success-soft' : 'border-primary bg-secondary-soft'
      }`}
      style={{ top: `${top}%`, height: `${height}%` }}
    >
      <span className={`font-semibold ${completed ? 'text-success' : 'text-primary-ink'}`}>{formatTime(appointment.timeSlot)}</span>
      <span className="truncate font-semibold text-ink">{appointment.clientName}</span>
      <span className="truncate text-ink-2">{appointment.serviceName}</span>
    </button>
  );
}

function WeekDayColumn({ day, appointments, workingHours, frame, now, onOpenAppointment }) {
  const state = dayState(day);
  const spans = state === 'open' ? offHourSpans(segmentsFor(workingHours, day.date), frame) : [];
  const showNow = now && day.date === now.date && now.minutes >= frame.start && now.minutes <= frame.end;

  return (
    <div
      className={`relative border-l border-line/60 ${state === 'blocked' ? 'bg-danger-soft/60' : state === 'closed' ? 'bg-primary-soft/50' : ''} ${
        day.isPast ? 'opacity-80' : ''
      }`}
    >
      {spans.map((span) => {
        const top = toPercent(span.start, frame);
        const height = toPercent(span.end, frame) - top;
        return (
          <div
            key={`${span.kind}-${span.start}`}
            aria-hidden="true"
            className={`absolute inset-x-0 flex items-center justify-center ${span.kind === 'pause' ? 'bg-primary-soft/80' : 'bg-primary-soft/45'}`}
            style={{ top: `${top}%`, height: `${height}%` }}
          >
            {span.kind === 'pause' && span.end - span.start >= 30 ? (
              <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-ink-3">Pausa</span>
            ) : null}
          </div>
        );
      })}
      {state !== 'open' ? (
        <div aria-hidden="true" className={`absolute inset-x-1 top-3 text-center text-xs font-semibold ${state === 'blocked' ? 'text-danger' : 'text-ink-3'}`}>
          {state === 'blocked' ? 'Bloqueado' : 'Cerrado'}
          {state === 'blocked' && day.blockReason ? <span className="mt-0.5 block truncate font-normal">{day.blockReason}</span> : null}
        </div>
      ) : null}
      {appointments.map((appointment) => (
        <WeekAppointmentBlock key={appointment.id} appointment={appointment} frame={frame} onOpen={onOpenAppointment} />
      ))}
      {showNow ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-30 h-0.5 bg-accent" style={{ top: `${toPercent(now.minutes, frame)}%` }}>
          <span className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-accent" />
        </div>
      ) : null}
    </div>
  );
}

/** Desktop week: 30-minute rows, appointments positioned by start and duration. */
export function WeekTimeGrid({ days, appointments, workingHours, now, today, onOpenDay, onOpenAppointment }) {
  const frame = useMemo(() => weekFrame(days, workingHours, appointments), [days, workingHours, appointments]);
  const byDate = useMemo(() => groupByDate(appointments), [appointments]);

  const marks = [];
  for (let m = frame.start; m <= frame.end; m += frame.step) marks.push(m);
  const hourLabels = marks.filter((m) => m % 60 === 0 || m === frame.start);

  return (
    <div className="hidden lg:block">
      <div className={`grid ${COLUMNS}`}>
        <div aria-hidden="true" />
        {days.map((day) => (
          <WeekDayHeader key={day.date} day={day} isToday={day.date === today} onOpen={onOpenDay} />
        ))}
      </div>
      <div className="py-2">
        <div className={`relative grid ${COLUMNS}`} style={{ height: `${frame.slots * REM_PER_SLOT}rem` }}>
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-[4.5rem] right-0">
            {marks.map((m) => (
              <div
                key={m}
                className={`absolute inset-x-0 border-t ${m % 60 === 0 ? 'border-line' : 'border-dashed border-line/60'}`}
                style={{ top: `${toPercent(m, frame)}%` }}
              />
            ))}
          </div>
          <div aria-hidden="true" className="relative">
            {hourLabels.map((m) => (
              <span
                key={m}
                className="absolute right-2 -translate-y-1/2 whitespace-nowrap text-[0.7rem] font-medium text-ink-3"
                style={{ top: `${toPercent(m, frame)}%` }}
              >
                {formatTime(toTime(m))}
              </span>
            ))}
          </div>
          {days.map((day) => (
            <WeekDayColumn
              key={day.date}
              day={day}
              appointments={byDate.get(day.date) || []}
              workingHours={workingHours}
              frame={frame}
              now={now}
              onOpenAppointment={onOpenAppointment}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
