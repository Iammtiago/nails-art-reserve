'use client';

import { ChevronRight, History } from 'lucide-react';
import { Badge, StatusBadge } from '@/components/ui/Badge';

/** This session's last verifications (memory only). Tapping one verifies it again. */
export function RecentVerifications({ items, onSelect, disabled = false }) {
  if (!items.length) return null;
  return (
    <section className="glass enter p-4 sm:p-5" aria-labelledby="ultimas-verificaciones" style={{ animationDelay: '60ms' }}>
      <div className="mb-2 flex items-center gap-2">
        <History aria-hidden="true" className="h-5 w-5 text-accent-ink" />
        <h2 id="ultimas-verificaciones" className="font-display text-lg font-semibold">
          Últimas verificaciones
        </h2>
      </div>
      <ul className="-mx-2 divide-y divide-line">
        {items.map((item) => (
          <li key={item.code}>
            <button
              type="button"
              onClick={() => onSelect(item.code)}
              disabled={disabled}
              title="Verificar de nuevo"
              className="group flex min-h-[52px] w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-surface/70 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="sr-only">Verificar de nuevo: </span>
              <span className="font-mono text-sm font-semibold tracking-[0.2em] text-primary-ink">{item.code}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink-2">{item.name || 'Sin cita'}</span>
              {item.status === 'not_found' ? <Badge tone="neutral">No encontrado</Badge> : <StatusBadge status={item.status} />}
              <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-3 transition group-hover:translate-x-0.5" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
