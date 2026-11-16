import { AlertCircle } from 'lucide-react';

/** Glass card for one settings section, with a staggered entrance (delay capped at 300 ms). */
export function ConfigCard({ id, icon: Icon, title, description, delay = 0, className = '', children }) {
  const titleId = `${id}-titulo`;
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className={`glass enter scroll-mt-24 p-4 sm:p-6 ${className}`}
      style={{ animationDelay: `${Math.min(Math.max(delay, 0), 300)}ms` }}
    >
      <div className="mb-5 flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary-soft text-primary-ink">
          <Icon aria-hidden="true" className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 id={titleId} className="font-display text-lg font-semibold leading-tight sm:text-xl">
            {title}
          </h2>
          {description ? <p className="mt-1 text-sm text-ink-2">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

/** Section-level error (rules that do not belong to a single field). */
export function SectionAlert({ message, className = '' }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      data-config-alert=""
      tabIndex={-1}
      className={`flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger ${className}`}
    >
      <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      {message}
    </p>
  );
}
