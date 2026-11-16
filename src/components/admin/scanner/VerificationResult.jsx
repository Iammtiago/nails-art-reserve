'use client';

import { QrCode, ScanLine, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { VerificationCard } from './VerificationCard';

function NotFoundCard({ code, onReset, resetLabel }) {
  return (
    <article className="glass enter overflow-hidden" aria-labelledby="codigo-no-encontrado">
      <div className="flex flex-col items-center px-6 pb-6 pt-8 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-danger-soft text-danger">
          <SearchX aria-hidden="true" className="h-8 w-8" />
        </span>
        <h2 id="codigo-no-encontrado" className="mt-4 font-display text-xl font-semibold">
          Código no encontrado
        </h2>
        <p className="mt-1 max-w-sm text-sm text-ink-2">No encontramos ninguna cita con ese código.</p>
        <p className="mt-4 rounded-xl bg-primary-soft px-4 py-2 font-mono text-lg font-semibold tracking-[0.28em] text-primary-ink">{code}</p>
        <p className="mt-3 max-w-sm text-xs text-ink-3">Compáralo letra por letra con el del ticket o pide a la clienta que te lo muestre de nuevo.</p>
      </div>
      <div className="border-t border-line p-4 sm:px-6">
        <Button icon={ScanLine} block onClick={onReset}>
          {resetLabel}
        </Button>
      </div>
    </article>
  );
}

function FailedCard({ error, onRetry, onReset, resetLabel }) {
  return (
    <div className="glass enter">
      <ErrorState error={error} onRetry={onRetry} className="pb-6" />
      <div className="border-t border-line p-4 sm:px-6">
        <Button variant="secondary" icon={ScanLine} block onClick={onReset}>
          {resetLabel}
        </Button>
      </div>
    </div>
  );
}

/**
 * Right-hand column of the scanner. verification:
 * { status: 'idle' } | { status: 'loading', code } | { status: 'found', code, data }
 * | { status: 'not_found', code } | { status: 'error', code, error }
 */
export function VerificationResult({ verification, businessName, marking, onMarkAttended, onRetry, onReset, resetLabel }) {
  switch (verification.status) {
    case 'loading':
      return (
        <div className="glass enter">
          <LoadingState label={`Verificando ${verification.code}…`} className="py-16" />
        </div>
      );
    case 'found':
      return (
        <VerificationCard
          data={verification.data}
          businessName={businessName}
          marking={marking}
          onMarkAttended={onMarkAttended}
          onReset={onReset}
          resetLabel={resetLabel}
        />
      );
    case 'not_found':
      return <NotFoundCard code={verification.code} onReset={onReset} resetLabel={resetLabel} />;
    case 'error':
      return <FailedCard error={verification.error} onRetry={onRetry} onReset={onReset} resetLabel={resetLabel} />;
    default:
      return (
        <div className="glass enter">
          <EmptyState
            icon={QrCode}
            title="Listo para verificar"
            description="Escanea el QR del ticket o escribe el código de 6 caracteres para ver la cita."
            className="py-16"
          />
        </div>
      );
  }
}
