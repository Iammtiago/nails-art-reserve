'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Controls';

const VIEW_OPTIONS = [
  { value: 'month', label: 'Mes' },
  { value: 'week', label: 'Semana' },
];

/** Mes | Semana, previous / today / next. */
export function CalendarToolbar({ view, onViewChange, onPrev, onNext, onToday, disabled = false }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented options={VIEW_OPTIONS} value={view} onChange={onViewChange} ariaLabel="Vista del calendario" />
      <div className="flex items-center gap-1">
        <IconButton icon={ChevronLeft} label="Anterior" variant="secondary" onClick={onPrev} disabled={disabled} />
        <Button variant="secondary" onClick={onToday} disabled={disabled}>
          Hoy
        </Button>
        <IconButton icon={ChevronRight} label="Siguiente" variant="secondary" onClick={onNext} disabled={disabled} />
      </div>
    </div>
  );
}
