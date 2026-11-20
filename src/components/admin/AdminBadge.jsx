import { Lock, ShieldCheck } from 'lucide-react';

/**
 * Pill that tells the salon owner she is in her private admin area.
 * `tone="deep"` is for dark surfaces (glass-deep panel).
 */
export function AdminBadge({ tone = 'light', className = '' }) {
  const styles =
    tone === 'deep'
      ? 'bg-white/15 text-white ring-white/30'
      : 'bg-primary-soft text-primary-ink ring-primary/25';
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider shadow-sm ring-1 ${styles} ${className}`}
    >
      <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
      Lado administrativo
      <span aria-hidden="true" className="opacity-50">·</span>
      <span className="inline-flex items-center gap-1">
        <Lock aria-hidden="true" className="h-3 w-3 shrink-0" />
        Solo admin
      </span>
    </span>
  );
}
