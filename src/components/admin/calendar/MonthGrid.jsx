'use client';

import { CircleSlash, Lock } from 'lucide-react';
import { pluralize } from '@shared/format.js';
import { OccupancyBar } from './OccupancyBar';
import { WEEKDAY_HEADERS, dayAriaLabel, dayNumber, dayState, occupancyPercent } from './calendarUtils';

const CELL_TONES = {
  open: 'bg-surface/80 text-ink shadow-sm hover:bg-surface',
  closed: 'bg-primary-soft/50 text-ink-3 hover:bg-primary-soft',
  blocked: 'bg-danger-soft text-danger hover:brightness-[0.97]',
};

const COUNT_TONES = {
  open: 'bg-secondary-soft text-primary-ink',
  closed: 'bg-surface/80 text-ink-2',
  blocked: 'bg-surface/80 text-danger',
};

function CellStatus({ day, state }) {
  if (state === 'blocked') {
    return (
      <>
        <Lock aria-hidden="true" className="h-3.5 w-3.5 sm:hidden" />
        <span className="hidden truncate text-[0.7rem] font-semibold leading-tight sm:block">Bloqueado</span>
        {day.blockReason ? <span className="hidden truncate text-[0.65rem] leading-tight opacity-90 sm:block">{day.blockReason}</span> : null}
      </>
    );
  }
  if (state === 'closed') {
    return (
      <>
        <CircleSlash aria-hidden="true" className="h-3.5 w-3.5 sm:hidden" />
        <span className="hidden text-[0.7rem] font-medium leading-tight sm:block">Cerrado</span>
      </>
    );
  }
  return <OccupancyBar percent={occupancyPercent(day)} />;
}

function MonthCell({ day, inMonth, isToday, index, onOpen }) {
  const state = dayState(day);
  const label = dayAriaLabel(day, isToday);
  const count = day.appointmentsCount;
  const dim = !inMonth ? 'opacity-40' : day.isPast ? 'opacity-70' : '';

  return (
    // The entrance animation lives on the wrapper so it never overrides the dimming opacity.
    <div className="enter min-w-0" style={{ animationDelay: `${Math.min(index * 7, 300)}ms` }}>
      <button
        type="button"
        onClick={() => onOpen(day.date)}
        aria-label={label}
        title={label}
        className={`flex h-full min-h-[76px] w-full min-w-0 flex-col rounded-xl p-1.5 text-left transition sm:p-2 lg:min-h-[104px] lg:p-2.5 ${CELL_TONES[state]} ${dim} ${
          isToday ? 'ring-2 ring-accent' : ''
        }`}
      >
        <span
          className={`grid h-6 min-w-[1.5rem] place-items-center rounded-full text-xs font-semibold lg:h-7 lg:min-w-[1.75rem] lg:text-sm ${
            isToday ? 'bg-accent text-accent-on' : ''
          }`}
        >
          {dayNumber(day.date)}
        </span>
        <span className="mt-auto flex w-full min-w-0 flex-col gap-1 pt-1">
          {count > 0 ? (
            <>
              <span className="text-[0.7rem] font-bold leading-none sm:hidden">{count}</span>
              <span className={`hidden max-w-full truncate rounded-full px-1.5 py-0.5 text-[0.7rem] font-semibold leading-tight sm:block sm:self-start ${COUNT_TONES[state]}`}>
                {pluralize(count, 'cita', 'citas')}
              </span>
            </>
          ) : null}
          <CellStatus day={day} state={state} />
        </span>
      </button>
    </div>
  );
}

/** 7 × 6 month grid, Monday first. Cells open the day panel. */
export function MonthGrid({ days, monthKey, today, onOpenDay }) {
  return (
    <div>
      <div className="mb-1.5 grid grid-cols-7 gap-1 sm:gap-1.5 lg:gap-2" aria-hidden="true">
        {WEEKDAY_HEADERS.map((label) => (
          <p key={label} className="py-1 text-center text-[0.7rem] font-semibold uppercase tracking-wide text-ink-3">
            {label}
          </p>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5 lg:gap-2">
        {days.map((day, index) => (
          <MonthCell key={day.date} day={day} inMonth={day.date.slice(0, 7) === monthKey} isToday={day.date === today} index={index} onOpen={onOpenDay} />
        ))}
      </div>
    </div>
  );
}

function LegendSwatch({ className }) {
  return <span aria-hidden="true" className={`inline-block shrink-0 ${className}`} />;
}

export function CalendarLegend() {
  return (
    <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 px-1 text-xs text-ink-2" aria-label="Leyenda del calendario">
      <li className="flex items-center gap-2">
        <LegendSwatch className="h-3.5 w-3.5 rounded-md bg-surface ring-2 ring-accent" />
        Hoy
      </li>
      <li className="flex items-center gap-2">
        <LegendSwatch className="h-1.5 w-5 rounded-full bg-accent" />
        Ocupación baja (menos del 50&nbsp;%)
      </li>
      <li className="flex items-center gap-2">
        <LegendSwatch className="h-1.5 w-5 rounded-full bg-primary" />
        Media (50–84&nbsp;%)
      </li>
      <li className="flex items-center gap-2">
        <LegendSwatch className="h-1.5 w-5 rounded-full bg-danger" />
        Alta (85&nbsp;% o más)
      </li>
      <li className="flex items-center gap-2">
        <Lock aria-hidden="true" className="h-3.5 w-3.5 text-danger" />
        Bloqueado
      </li>
      <li className="flex items-center gap-2">
        <CircleSlash aria-hidden="true" className="h-3.5 w-3.5 text-ink-3" />
        Cerrado
      </li>
    </ul>
  );
}
