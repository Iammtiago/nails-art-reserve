'use client';

import { Search, X } from 'lucide-react';
import { IconButton } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Controls';
import { Field, Input } from '@/components/ui/Field';

// Order asked by Tiago (2026-11-27): «Todas» first and by default, «Hoy» next to it, «Próximas» last.
function viewOptions(summary) {
  return [
    { value: 'all', label: 'Todas', count: summary?.all },
    { value: 'today', label: 'Hoy', count: summary?.today },
    { value: 'completed', label: 'Atendidas', count: summary?.completed },
    { value: 'cancelled', label: 'Canceladas', count: summary?.cancelled },
    { value: 'upcoming', label: 'Próximas', count: summary?.upcoming },
  ];
}

/** View tabs, debounced search box (the parent debounces) and an optional date filter. */
export function AppointmentFilters({ view, onViewChange, summary, search, onSearchChange, date, onDateChange }) {
  return (
    <div className="glass enter mb-4 p-3 sm:p-4" style={{ animationDelay: '120ms' }}>
      {/* Five tabs do not fit a phone: they wrap instead of hiding «Próximas» off-screen. */}
      <Segmented options={viewOptions(summary)} value={view} onChange={onViewChange} ariaLabel="Filtrar citas" className="max-sm:flex-wrap" />
      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_16rem]">
        <Field label="Buscar">
          {(p) => (
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-3" />
              <Input
                {...p}
                type="text"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                spellCheck={false}
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && search) {
                    event.preventDefault();
                    onSearchChange('');
                  }
                }}
                maxLength={60}
                placeholder="Buscar por nombre, teléfono o código"
                className={`pl-11 ${search ? 'pr-12' : ''}`}
              />
              {search ? (
                <IconButton icon={X} label="Borrar búsqueda" size="sm" onClick={() => onSearchChange('')} className="absolute right-1 top-1" />
              ) : null}
            </div>
          )}
        </Field>
        <Field label="Fecha">
          {(p) => (
            <div className="flex items-center gap-2">
              <Input
                {...p}
                type="date"
                min="2020-01-01"
                max="2100-12-31"
                value={date}
                onChange={(event) => onDateChange(event.target.value)}
                className="min-w-0 flex-1"
              />
              {date ? <IconButton icon={X} label="Quitar filtro de fecha" variant="secondary" onClick={() => onDateChange('')} /> : null}
            </div>
          )}
        </Field>
      </div>
    </div>
  );
}
