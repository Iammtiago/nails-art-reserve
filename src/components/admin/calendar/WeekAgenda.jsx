'use client';

import { ChevronRight, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { formatDateLong, formatTimeRange } from '@shared/format.js';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { staggerDelay } from '@/components/admin/appointments/appointmentUtils';
import { OccupancyBar } from './OccupancyBar';
import { dayAriaLabel, dayShortStatus, dayState, groupByDate, occupancyPercent, percentText } from './calendarUtils';

function AgendaAppointment({ appointment, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(appointment)}
      className="flex min-h-[56px] w-full min-w-0 flex-col gap-1 rounded-xl bg-surface/80 px-3 py-2.5 text-left shadow-sm transition hover:bg-surface"
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink">{formatTimeRange(appointment.timeSlot, appointment.endTime)}</span>
        <StatusBadge status={appointment.status} kind={appointment.kind} />
      </span>
      <span className="block w-full truncate text-sm text-ink-2">
        <span className="font-semibold text-ink">{appointment.clientName}</span> · {appointment.serviceName}
      </span>
    </button>
  );
}

function AgendaDay({ day, items, isToday, workingHours, index, onOpenDay, onOpenAppointment }) {
  const state = dayState(day);
  const percent = occupancyPercent(day);
  return (
    <li className="enter" style={{ animationDelay: staggerDelay(index, 45) }}>
      <section
        aria-label={formatDateLong(day.date)}
        className={`rounded-2xl p-3 ${state === 'blocked' ? 'bg-danger-soft/70' : state === 'closed' ? 'bg-primary-soft/50' : 'bg-secondary-soft/50'} ${
          isToday ? 'ring-2 ring-accent' : ''
        } ${day.isPast && !isToday ? 'opacity-80' : ''}`}
      >
        <button
          type="button"
          onClick={() => onOpenDay(day.date)}
          aria-label={`Ver el día: ${dayAriaLabel(day, isToday)}`}
          className="flex min-h-[48px] w-full items-center gap-3 rounded-xl text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-display text-base font-semibold text-ink">{formatDateLong(day.date)}</span>
              {isToday ? <Badge tone="accent">Hoy</Badge> : null}
            </span>
            <span className={`mt-0.5 block truncate text-xs ${state === 'blocked' ? 'font-semibold text-danger' : 'text-ink-2'}`}>
              {dayShortStatus(day, workingHours)}
            </span>
          </span>
          {state === 'open' ? <span className="shrink-0 text-xs font-semibold text-ink-2">{percentText(percent)}</span> : null}
          <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-ink-3" />
        </button>
        {state === 'open' ? <OccupancyBar percent={percent} className="mt-2" /> : null}
        {items.length ? (
          <ul className="mt-3 space-y-2">
            {items.map((appointment) => (
              <li key={appointment.id}>
                <AgendaAppointment appointment={appointment} onOpen={onOpenAppointment} />
              </li>
            ))}
          </ul>
        ) : null}
        {state !== 'blocked' ? (
          <button
            type="button"
            onClick={() => onOpenDay(day.date)}
            className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line text-sm font-semibold text-primary-ink transition hover:border-secondary hover:bg-surface/60"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            {items.length ? 'Agendar u ocupar horas' : 'Sin citas · Agendar u ocupar horas'}
          </button>
        ) : null}
      </section>
    </li>
  );
}

/** Phones and tablets: the week as a vertical agenda grouped by day. */
export function WeekAgenda({ days, appointments, workingHours, today, onOpenDay, onOpenAppointment }) {
  const byDate = useMemo(() => groupByDate(appointments), [appointments]);
  return (
    <ol className="space-y-3 lg:hidden">
      {days.map((day, index) => (
        <AgendaDay
          key={day.date}
          day={day}
          items={byDate.get(day.date) || []}
          isToday={day.date === today}
          workingHours={workingHours}
          index={index}
          onOpenDay={onOpenDay}
          onOpenAppointment={onOpenAppointment}
        />
      ))}
    </ol>
  );
}
