'use client';

import { Sun, Sunset } from 'lucide-react';
import { useId } from 'react';
import { formatTime } from '@shared/format.js';
import { groupSlots } from './booking-utils';

const GROUP_ICONS = { morning: Sun, afternoon: Sunset };

function TimeButton({ slot, selected, onSelect }) {
  if (!slot.available) {
    return (
      <button
        type="button"
        disabled
        className="min-h-[48px] cursor-not-allowed whitespace-nowrap rounded-xl border border-dashed border-line px-1 text-sm font-medium text-ink-3 opacity-70 sm:text-[0.95rem]"
      >
        <span className="line-through">{formatTime(slot.time)}</span>
        <span className="sr-only"> ocupado</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(slot)}
      className={`min-h-[48px] whitespace-nowrap rounded-xl border px-1 text-sm font-semibold tabular-nums transition duration-150 sm:text-[0.95rem] ${
        selected
          ? 'border-primary bg-primary text-primary-on shadow-lift'
          : 'border-line bg-surface/80 text-ink hover:border-secondary hover:bg-secondary-soft'
      }`}
    >
      {formatTime(slot.time)}
    </button>
  );
}

function SlotGroup({ group, selectedTime, onSelect }) {
  const titleId = useId();
  const Icon = GROUP_ICONS[group.key];
  return (
    <div role="group" aria-labelledby={titleId}>
      <p id={titleId} className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">
        {Icon ? <Icon aria-hidden="true" className="h-4 w-4" /> : null}
        {group.label}
      </p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {group.slots.map((slot) => (
          <TimeButton key={slot.time} slot={slot} selected={slot.time === selectedTime} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

export function TimeGrid({ slots, selectedTime, onSelect }) {
  const groups = groupSlots(slots);
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <SlotGroup key={group.key} group={group} selectedTime={selectedTime} onSelect={onSelect} />
      ))}
    </div>
  );
}
