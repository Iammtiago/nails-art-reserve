'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useId, useMemo } from 'react';
import { DAY_SHORT_NAMES } from '@shared/constants.js';
import { formatDateLong, formatMonth } from '@shared/format.js';
import { addDays, addMonths, dayOfWeek, daysInMonth, startOfMonth } from '@shared/time.js';
import { IconButton } from '@/components/ui/Button';

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0].map((d) => DAY_SHORT_NAMES[d]);

const STATUS_TEXT = {
  available: 'disponible',
  full: 'completo',
  ended: 'por hoy ya no quedan horarios',
  closed: 'cerrado',
  blocked: 'el salón no atiende',
  past: 'ya pasó',
  out_of_window: 'fuera del rango de reservas',
};

function statusOf(date, map, from) {
  const entry = map.get(date);
  if (entry) return entry.status;
  return date < from ? 'past' : 'out_of_window';
}

// Arrow keys move between selectable days (±1 day, ±1 week), skipping disabled ones.
function handleGridKeys(event) {
  const steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
  const step = steps[event.key];
  if (!step) return;
  const current = document.activeElement?.dataset?.date;
  if (!current) return;
  event.preventDefault();
  const grid = event.currentTarget;
  let target = addDays(current, step);
  for (let i = 0; i < 6; i += 1) {
    const button = grid.querySelector(`[data-date="${target}"]`);
    if (!button) return;
    if (!button.disabled) {
      button.focus();
      return;
    }
    target = addDays(target, step);
  }
}

function DayCell({ date, status, selected, today, focusable, onSelect }) {
  const available = status === 'available';
  const day = Number(date.slice(8, 10));
  const label = `${formatDateLong(date)}${today ? ', hoy' : ''}: ${STATUS_TEXT[status] || 'no disponible'}`;

  let circle = 'text-ink-3 opacity-50';
  if (available) circle = selected ? 'bg-primary text-primary-on shadow-lift' : 'bg-surface/80 font-semibold text-ink hover:bg-secondary-soft';
  else if (status === 'full') circle = 'text-ink-3';
  const ring = today ? (selected ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : 'ring-1 ring-inset ring-accent') : '';

  return (
    <button
      type="button"
      data-date={date}
      disabled={!available}
      aria-pressed={available ? selected : undefined}
      aria-current={today ? 'date' : undefined}
      aria-label={label}
      tabIndex={focusable ? 0 : -1}
      onClick={() => onSelect(date)}
      className="group relative flex h-[52px] w-full items-start justify-center pt-1 outline-none disabled:cursor-not-allowed"
    >
      <span
        className={`grid h-10 w-10 place-items-center rounded-full text-[0.95rem] tabular-nums transition-colors duration-150 group-focus-visible:outline group-focus-visible:outline-[3px] group-focus-visible:outline-offset-2 group-focus-visible:outline-accent/60 ${circle} ${ring}`}
        aria-hidden="true"
      >
        {day}
      </span>
      {status === 'full' ? (
        <span className="absolute bottom-0.5 text-[0.55rem] font-semibold leading-none text-accent-ink" aria-hidden="true">
          Completo
        </span>
      ) : null}
    </button>
  );
}

function LegendDot({ className }) {
  return <span className={`inline-block h-3.5 w-3.5 shrink-0 rounded-full ${className}`} aria-hidden="true" />;
}

export function MonthCalendar({ days, from, to, today, month, onMonthChange, selected, onSelect }) {
  const labelId = useId();
  const map = useMemo(() => new Map((days || []).map((d) => [d.date, d])), [days]);
  const minMonth = startOfMonth(from);
  const maxMonth = startOfMonth(to);

  const cells = useMemo(() => {
    const list = [];
    const lead = (dayOfWeek(month) + 6) % 7;
    for (let i = 0; i < lead; i += 1) list.push(null);
    const count = daysInMonth(month);
    for (let d = 0; d < count; d += 1) list.push(addDays(month, d));
    return list;
  }, [month]);

  // One tab stop: the selected day when visible, otherwise the first selectable one.
  const monthDates = cells.filter(Boolean);
  const focusDate =
    (selected && monthDates.includes(selected) && statusOf(selected, map, from) === 'available' && selected) ||
    monthDates.find((d) => statusOf(d, map, from) === 'available') ||
    null;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <IconButton icon={ChevronLeft} label="Mes anterior" variant="ghost" disabled={month <= minMonth} onClick={() => onMonthChange(addMonths(month, -1))} />
        <p id={labelId} className="font-display text-lg font-semibold text-ink" aria-live="polite">
          {formatMonth(month)}
        </p>
        <IconButton icon={ChevronRight} label="Mes siguiente" variant="ghost" disabled={month >= maxMonth} onClick={() => onMonthChange(addMonths(month, 1))} />
      </div>

      <div className="-mx-2 sm:mx-0">
        <div className="grid grid-cols-7 pb-1" aria-hidden="true">
          {WEEKDAYS.map((name) => (
            <span key={name} className="text-center text-[0.7rem] font-semibold uppercase tracking-wide text-ink-3">
              {name}
            </span>
          ))}
        </div>
        <div role="group" aria-labelledby={labelId} className="grid grid-cols-7" onKeyDown={handleGridKeys}>
          {cells.map((date, index) =>
            date ? (
              <DayCell
                key={date}
                date={date}
                status={statusOf(date, map, from)}
                selected={date === selected}
                today={date === today}
                focusable={date === focusDate}
                onSelect={onSelect}
              />
            ) : (
              <span key={`blank-${index}`} aria-hidden="true" />
            ),
          )}
        </div>
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-2" aria-label="Leyenda del calendario">
        <li className="flex items-center gap-1.5">
          <LegendDot className="border border-line bg-surface" />
          Disponible
        </li>
        <li className="flex items-center gap-1.5">
          <LegendDot className="bg-primary" />
          Elegido
        </li>
        <li className="flex items-center gap-1.5">
          <LegendDot className="ring-1 ring-inset ring-accent" />
          Hoy
        </li>
        <li className="flex items-center gap-1.5">
          <span className="text-[0.6rem] font-semibold leading-none text-accent-ink" aria-hidden="true">
            Completo
          </span>
          Sin horarios libres
        </li>
        <li className="flex items-center gap-1.5">
          <LegendDot className="bg-ink-3 opacity-30" />
          No disponible
        </li>
      </ul>
    </div>
  );
}
