'use client';

import { useCallback, useState } from 'react';
import { ApiError, apiGet } from '@/lib/api';
import { useAsync } from '@/lib/hooks';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { BookingWizard } from './BookingWizard';
import { CancelModal } from './CancelModal';
import { Hero } from './Hero';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

function Aurora() {
  return (
    <div className="aurora" aria-hidden="true">
      <span />
    </div>
  );
}

function BookingPortal({ settings }) {
  const [cancel, setCancel] = useState({ open: false, phone: '' });
  const openCancel = useCallback((phone = '') => setCancel({ open: true, phone: typeof phone === 'string' ? phone : '' }), []);
  const closeCancel = useCallback(() => setCancel((c) => ({ ...c, open: false })), []);

  return (
    <>
      <Aurora />
      <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 sm:px-6">
        <SiteHeader settings={settings} onCancelClick={() => openCancel('')} />
        <main id="contenido" className="flex-1">
          <Hero settings={settings} />
          <BookingWizard settings={settings} onOpenCancel={openCancel} />
        </main>
        <SiteFooter settings={settings} />
      </div>
      <CancelModal open={cancel.open} onClose={closeCancel} settings={settings} initialPhone={cancel.phone} />
    </>
  );
}

function SettingsGate() {
  const state = useAsync(
    (signal) =>
      apiGet('/api/settings', null, { signal }).then((r) => {
        if (!r?.settings) throw new ApiError(503, { error: 'No pudimos cargar la información del salón. Intenta de nuevo.' });
        return r.settings;
      }),
    [],
  );

  if (state.data) return <BookingPortal settings={state.data} />;

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <Aurora />
      <div className="glass glass-strong w-full max-w-md p-6">
        {state.error ? (
          <ErrorState error={state.error} onRetry={() => state.reload()} className="py-6" />
        ) : (
          <LoadingState label="Preparando la agenda…" />
        )}
      </div>
    </div>
  );
}

/** Public booking portal. Uses the server-rendered settings, or fetches them if those failed. */
export function BookingApp({ initialSettings }) {
  if (initialSettings) return <BookingPortal settings={initialSettings} />;
  return <SettingsGate />;
}
