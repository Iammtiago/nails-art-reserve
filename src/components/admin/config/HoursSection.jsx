'use client';

import { Clock, Copy } from 'lucide-react';
import { useRef } from 'react';
import { DAY_NAMES, SLOT_DURATION_OPTIONS } from '@shared/constants.js';
import { formatDuration, formatTimeRange, pluralize } from '@shared/format.js';
import { dayCapacityMinutes, daySegments } from '@shared/schedule.js';
import { toTime } from '@shared/time.js';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Controls';
import { Field, Input, Select } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { ConfigCard, SectionAlert } from './ConfigCard';
import { WEEK_ORDER, suggestBreak } from './configModel';

const COPY_FIELDS = ['openTime', 'closeTime', 'breakStart', 'breakEnd', 'slotDurationMinutes'];

// Some browsers report HH:mm:ss; the API only takes HH:mm.
const timeValue = (event) => event.target.value.slice(0, 5);

function shiftsPreview(day) {
  const segments = daySegments(day);
  if (!segments.length) return '';
  return segments.map((s) => formatTimeRange(toTime(s.start), toTime(s.end))).join(' · ');
}

function PauseSwitch({ checked, onChange, dayName }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`Sin pausa el ${dayName.toLowerCase()}`}
      onClick={() => onChange(!checked)}
      className="inline-flex min-h-[44px] items-center gap-2.5 rounded-xl px-1.5 text-sm font-semibold text-ink-2 transition hover:text-ink"
    >
      <span
        aria-hidden="true"
        className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition ${checked ? 'bg-primary' : 'bg-line'}`}
      >
        <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </span>
      Sin pausa
    </button>
  );
}

function TimeField({ label, value, error, onChange }) {
  return (
    <Field label={label} error={error}>
      {(p) => <Input {...p} type="time" step={900} value={value} onChange={(event) => onChange(timeValue(event))} className="tabular-nums" />}
    </Field>
  );
}

function DayRow({ day, index, errors, canCopy, onUpdate, onTogglePause, onCopy }) {
  const dayName = DAY_NAMES[day.dayOfWeek];
  const err = (field) => errors[`workingHours.${index}.${field}`];
  const hasBreak = Boolean(day.breakStart || day.breakEnd);
  const preview = shiftsPreview(day);
  const capacity = dayCapacityMinutes(day);

  return (
    <li className="rounded-2xl border border-line bg-surface/55 p-3.5 sm:p-4">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="sm:w-56 sm:shrink-0">
          <Toggle
            label={dayName}
            description={day.isOpen ? 'Abierto' : 'Cerrado'}
            checked={day.isOpen}
            onChange={(isOpen) => onUpdate({ isOpen })}
          />
        </div>
        <p className="flex min-w-0 items-start gap-1.5 text-sm text-ink-2 sm:justify-end sm:text-right">
          {day.isOpen ? (
            preview ? (
              <>
                <Clock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" />
                <span>
                  {preview}
                  <span className="text-ink-3"> · {formatDuration(capacity)}</span>
                </span>
              </>
            ) : (
              <span className="text-danger">Revisa las horas de este día.</span>
            )
          ) : (
            <span className="text-ink-3">No se ofrecen horarios este día.</span>
          )}
        </p>
      </div>

      {day.isOpen ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
            <TimeField label="Apertura" value={day.openTime} error={err('openTime')} onChange={(openTime) => onUpdate({ openTime })} />
            <TimeField label="Cierre" value={day.closeTime} error={err('closeTime')} onChange={(closeTime) => onUpdate({ closeTime })} />
            {hasBreak ? (
              <>
                <TimeField
                  label="Pausa desde"
                  value={day.breakStart}
                  error={err('breakStart')}
                  onChange={(breakStart) => onUpdate({ breakStart })}
                />
                <TimeField label="Pausa hasta" value={day.breakEnd} error={err('breakEnd')} onChange={(breakEnd) => onUpdate({ breakEnd })} />
              </>
            ) : null}
            <Field label="Horas cada" error={err('slotDurationMinutes')}>
              {(p) => (
                <Select {...p} value={day.slotDurationMinutes} onChange={(event) => onUpdate({ slotDurationMinutes: Number(event.target.value) })}>
                  {SLOT_DURATION_OPTIONS.includes(day.slotDurationMinutes) ? null : (
                    <option value={day.slotDurationMinutes}>{formatDuration(day.slotDurationMinutes)}</option>
                  )}
                  {SLOT_DURATION_OPTIONS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {formatDuration(minutes)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <PauseSwitch checked={!hasBreak} dayName={dayName} onChange={(noPause) => onTogglePause(noPause)} />
            <Button
              variant="ghost"
              icon={Copy}
              disabled={!canCopy}
              onClick={onCopy}
              aria-label={`Copiar a los demás días abiertos el horario del ${dayName.toLowerCase()}`}
            >
              <span className="sm:hidden">Copiar a los demás</span>
              <span className="hidden sm:inline">Copiar a los demás días abiertos</span>
            </Button>
          </div>
        </>
      ) : null}
    </li>
  );
}

export function HoursSection({ hours, errors, onChange, delay, className = '' }) {
  const toast = useToast();
  // Last break of each day, restored when «Sin pausa» is turned off again.
  const lastBreaks = useRef({});
  const openCount = hours.filter((d) => d.isOpen).length;

  const updateDay = (dayOfWeek, patch) => {
    onChange((list) => list.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d)));
  };

  const togglePause = (day, noPause) => {
    if (noPause) {
      lastBreaks.current[day.dayOfWeek] = { breakStart: day.breakStart, breakEnd: day.breakEnd };
      updateDay(day.dayOfWeek, { breakStart: '', breakEnd: '' });
      return;
    }
    const saved = lastBreaks.current[day.dayOfWeek];
    updateDay(day.dayOfWeek, saved?.breakStart && saved?.breakEnd ? saved : suggestBreak(day));
  };

  const copyFrom = (source) => {
    const targets = hours.filter((d) => d.isOpen && d.dayOfWeek !== source.dayOfWeek);
    if (!targets.length) return;
    const patch = Object.fromEntries(COPY_FIELDS.map((field) => [field, source[field]]));
    onChange((list) => list.map((d) => (d.isOpen && d.dayOfWeek !== source.dayOfWeek ? { ...d, ...patch } : d)));
    toast.info(`Copiamos el horario del ${DAY_NAMES[source.dayOfWeek].toLowerCase()} a ${pluralize(targets.length, 'día abierto', 'días abiertos')}.`);
  };

  return (
    <ConfigCard
      id="horarios"
      icon={Clock}
      title="Horarios de atención"
      description="«Horas cada» marca cada cuánto puede empezar una cita (por ejemplo cada 30 min: 8:30, 9:00, 9:30…). Cada cita ocupa lo que dura su servicio y tapa las horas que pisa."
      delay={delay}
      className={className}
    >
      <SectionAlert message={errors.workingHours} className="mb-4" />
      <ul className="space-y-3">
        {WEEK_ORDER.map((dayOfWeek) => {
          const index = hours.findIndex((d) => d.dayOfWeek === dayOfWeek);
          const day = hours[index];
          if (!day) return null;
          return (
            <DayRow
              key={dayOfWeek}
              day={day}
              index={index}
              errors={errors}
              canCopy={openCount > 1}
              onUpdate={(patch) => updateDay(dayOfWeek, patch)}
              onTogglePause={(noPause) => togglePause(day, noPause)}
              onCopy={() => copyFrom(day)}
            />
          );
        })}
      </ul>
    </ConfigCard>
  );
}
