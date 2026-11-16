'use client';

import { useCallback, useState } from 'react';
import { ApiError, apiGet } from '@/lib/api';
import { useAsync } from '@/lib/hooks';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { BookingWizard } from './BookingWizard';
import { CancelModal } from './CancelModal';
import { Hero } from './Hero';
import { Faq, FinalCta, GoodToKnow, HowItWorks, QuoteBand, VisitInfo } from './LandingSections';
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
  const [pick, setPick] = useState(null);
  const openCancel = useCallback((phone = '') => setCancel({ open: true, phone: typeof phone === 'string' ? phone : '' }), []);
  const closeCancel = useCallback(() => setCancel((c) => ({ ...c, open: false })), []);
  const openCancelEmpty = useCallback(() => openCancel(''), [openCancel]);

  const pickService = useCallback((service) => {
    setPick({ service, at: Date.now() });
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('reservar')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }, []);

  return (
    <>
      <Aurora />
      <a href="#reservar" className="sr-only z-50 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-on focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Ir directo a reservar
      </a>
      <div className="flex min-h-dvh w-full flex-col">
        <SiteHeader settings={settings} onCancelClick={openCancelEmpty} />
        <main id="contenido" className="flex-1">
          <Hero settings={settings} onPickService={pickService} />

          <section id="reservar" className="px-4 pb-6 sm:px-6" aria-labelledby="reservar-title">
            <div className="mx-auto max-w-2xl">
              <div className="mb-6 text-center">
                <p className="eyebrow">Reserva en línea</p>
                <h2 id="reservar-title" className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
                  Agenda tu cita
                </h2>
                <p className="mt-2 text-ink-2">Cuatro pasos y listo. Solo ves los horarios que están libres de verdad.</p>
              </div>
              <BookingWizard settings={settings} onOpenCancel={openCancel} pick={pick} />
            </div>
          </section>

          <HowItWorks />
          <GoodToKnow settings={settings} onCancelClick={openCancelEmpty} />
          <QuoteBand />
          <VisitInfo settings={settings} />
          <Faq settings={settings} />
          <FinalCta settings={settings} />
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
