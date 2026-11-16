'use client';

import { Search, X } from 'lucide-react';
import { Field, Input } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Spinner';

/** Instant search box; the parent debounces the value. Escape clears it. */
export function ClientSearch({ value, onChange, busy, status }) {
  const clear = () => onChange('');

  return (
    <div className="glass enter mb-4 p-4 sm:p-5" style={{ animationDelay: '80ms' }}>
      <Field label="Buscar clienta" id="buscar-clienta">
        {(p) => (
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 grid w-11 place-items-center text-ink-3">
              {busy ? <Spinner className="h-4 w-4 text-accent-ink" /> : <Search aria-hidden="true" className="h-5 w-5" />}
            </span>
            <Input
              {...p}
              type="search"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && value) {
                  event.preventDefault();
                  clear();
                }
              }}
              placeholder="Buscar por nombre o teléfono"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="search"
              maxLength={60}
              className="pl-11 pr-12 [&::-webkit-search-cancel-button]:appearance-none"
            />
            {value ? (
              <button
                type="button"
                onClick={clear}
                className="absolute right-0.5 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg text-ink-3 transition hover:bg-primary-soft hover:text-ink"
                aria-label="Borrar búsqueda"
                title="Borrar búsqueda"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            ) : null}
          </div>
        )}
      </Field>
      <p className="mt-2 min-h-[1.25rem] text-sm text-ink-2" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
