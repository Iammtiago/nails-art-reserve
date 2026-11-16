'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useId } from 'react';

/** Pill tabs. options: [{ value, label, count? }] */
export function Segmented({ options, value, onChange, ariaLabel, className = '' }) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={`flex gap-1 overflow-x-auto rounded-2xl bg-primary-soft/80 p-1 [scrollbar-width:none] ${className}`}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition ${
              active ? 'bg-surface text-primary-ink shadow-glass' : 'text-ink-2 hover:text-ink'
            }`}
          >
            {opt.label}
            {typeof opt.count === 'number' ? (
              <span className={`rounded-full px-1.5 text-xs ${active ? 'bg-secondary-soft text-primary-ink' : 'bg-surface/70 text-ink-2'}`}>{opt.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description, disabled = false }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-semibold text-ink">
          {label}
        </label>
        {description ? <p className="text-xs text-ink-3">{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="inline-flex min-h-[44px] shrink-0 items-center rounded-full disabled:opacity-50"
      >
        <span
          aria-hidden="true"
          className={`relative inline-flex h-8 w-14 items-center rounded-full p-1 transition ${checked ? 'bg-primary' : 'bg-ink-3/35'}`}
        >
          <span className={`h-6 w-6 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
        </span>
      </button>
    </div>
  );
}

export function Pagination({ page, pages, total, onChange }) {
  if (!pages || pages <= 1) return null;
  return (
    <nav className="flex items-center justify-between gap-3 pt-4" aria-label="Paginación">
      <p className="text-sm text-ink-2">
        Página {page} de {pages}
        {typeof total === 'number' ? ` · ${total} en total` : ''}
      </p>
      <div className="flex gap-2">
        <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Página anterior">
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        </button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Página siguiente">
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}

export function PageHeader({ title, description, actions, eyebrow }) {
  return (
    <header className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-ink-2 sm:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

/** Small KPI tile. */
export function Stat({ label, value, hint, icon: Icon, tone = 'brand' }) {
  const tones = {
    brand: 'bg-secondary-soft text-primary-ink',
    success: 'bg-success-soft text-success',
    danger: 'bg-danger-soft text-danger',
    accent: 'bg-accent-soft text-accent-ink',
  };
  return (
    <div className="glass flex flex-col items-start gap-2 p-3.5 min-[480px]:flex-row min-[480px]:items-center min-[480px]:gap-3 min-[480px]:p-4">
      {Icon ? (
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl min-[480px]:h-11 min-[480px]:w-11 ${tones[tone] || tones.brand}`}>
          <Icon aria-hidden="true" className="h-5 w-5" />
        </div>
      ) : null}
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">{label}</p>
        <p className="font-display text-2xl font-semibold leading-tight text-ink">{value}</p>
        {hint ? <p className="truncate text-xs text-ink-2">{hint}</p> : null}
      </div>
    </div>
  );
}
