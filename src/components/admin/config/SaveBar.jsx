'use client';

import { Save, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/**
 * Sticky bar shown while there are unsaved changes. On mobile it sits above the
 * AdminShell bottom navigation; on desktop it floats near the bottom edge.
 */
export function SaveBar({ sections, saving, onDiscard }) {
  return (
    <div
      role="region"
      aria-label="Cambios sin guardar"
      className="enter sticky bottom-[max(6.5rem,calc(5.5rem_+_env(safe-area-inset-bottom)))] z-30 mt-5 lg:bottom-6"
    >
      <div className="glass glass-strong flex flex-col gap-3 rounded-2xl p-3 shadow-lift sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="flex min-w-0 items-start gap-2.5 px-1">
          <span className="relative mt-1.5 flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">Tienes cambios sin guardar</p>
            {sections.length ? <p className="truncate text-xs text-ink-3">{sections.join(' · ')}</p> : null}
          </div>
        </div>
        <div className="flex gap-2 sm:shrink-0">
          <Button variant="secondary" onClick={onDiscard} disabled={saving}>
            <Undo2 aria-hidden="true" className="hidden h-[18px] w-[18px] shrink-0 sm:block" />
            Descartar
          </Button>
          <Button type="submit" variant="primary" icon={Save} loading={saving} className="flex-1 sm:flex-none">
            Guardar cambios
          </Button>
        </div>
      </div>
    </div>
  );
}
