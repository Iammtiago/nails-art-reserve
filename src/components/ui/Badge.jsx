import { STATUS_LABELS } from '../../../shared/constants.js';

const TONES = {
  brand: 'bg-secondary-soft text-primary-ink',
  accent: 'bg-accent-soft text-accent-ink',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  neutral: 'bg-primary-soft text-ink-2',
};

export function Badge({ tone = 'neutral', className = '', children }) {
  return <span className={`chip ${TONES[tone] || TONES.neutral} ${className}`}>{children}</span>;
}

const STATUS_TONES = { confirmed: 'brand', completed: 'success', cancelled: 'danger' };

/** Status of an appointment; time blocks (kind="block") read «Ocupado» instead. */
export function StatusBadge({ status, kind }) {
  if (kind === 'block' && status !== 'cancelled') {
    return (
      <Badge tone="warning">
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
        Ocupado
      </Badge>
    );
  }
  return (
    <Badge tone={STATUS_TONES[status] || 'neutral'}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {STATUS_LABELS[status] || status}
    </Badge>
  );
}
