'use client';

import { AlertTriangle, RotateCw } from 'lucide-react';
import { errorMessage } from '@/lib/api';
import { Button } from './Button';
import { Spinner } from './Spinner';

export function LoadingState({ label = 'Cargando…', className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-12 text-ink-2 ${className}`} role="status">
      <Spinner className="h-7 w-7 text-accent-ink" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className}`}>
      {Icon ? (
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-secondary-soft text-primary-ink">
          <Icon aria-hidden="true" className="h-7 w-7" />
        </div>
      ) : null}
      <p className="font-display text-lg font-semibold text-ink">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-ink-2">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ error, message, onRetry, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className}`} role="alert">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-danger-soft text-danger">
        <AlertTriangle aria-hidden="true" className="h-7 w-7" />
      </div>
      <p className="font-display text-lg font-semibold text-ink">No se pudo cargar</p>
      <p className="mt-1 max-w-sm text-sm text-ink-2">{message || errorMessage(error)}</p>
      {onRetry ? (
        <Button variant="secondary" icon={RotateCw} className="mt-5" onClick={() => onRetry()}>
          Reintentar
        </Button>
      ) : null}
    </div>
  );
}

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-xl bg-secondary-soft/80 ${className}`} aria-hidden="true" />;
}
