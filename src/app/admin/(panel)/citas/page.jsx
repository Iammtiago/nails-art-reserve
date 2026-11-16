'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDateLong } from '@shared/format.js';
import { isValidDate } from '@shared/time.js';
import { ApiError, apiGet } from '@/lib/api';
import { useAsync, useDebouncedValue, useInterval } from '@/lib/hooks';
import { useAdmin } from '@/components/admin/AdminContext';
import { AppointmentDetailModal } from '@/components/admin/appointments/AppointmentDetailModal';
import { AppointmentFilters } from '@/components/admin/appointments/AppointmentFilters';
import { AppointmentList } from '@/components/admin/appointments/AppointmentList';
import { AppointmentsEmpty } from '@/components/admin/appointments/AppointmentsEmpty';
import { AppointmentStats } from '@/components/admin/appointments/AppointmentStats';
import { useAppointmentActions } from '@/components/admin/appointments/useAppointmentActions';
import { PageHeader, Pagination } from '@/components/ui/Controls';
import { ErrorState, LoadingState } from '@/components/ui/States';

const PAGE_SIZE = 20;
const REFRESH_MS = 60_000;

export default function CitasPage() {
  const { settings, handleError } = useAdmin();
  const handleErrorRef = useRef(handleError);
  handleErrorRef.current = handleError;

  const [view, setView] = useState('upcoming');
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [selected, setSelected] = useState(null);
  const listTopRef = useRef(null);

  const q = useDebouncedValue(search.trim(), 300);
  const dateQuery = isValidDate(date) ? date : '';

  // Page resets to 1 whenever a filter changes (derived, so no extra request).
  const filterKey = `${view}|${dateQuery}|${q}`;
  const [paging, setPaging] = useState({ key: filterKey, page: 1 });
  const page = paging.key === filterKey ? paging.page : 1;
  const requestKey = `${filterKey}|${page}`;

  const { data, error, reload } = useAsync(
    (signal) =>
      apiGet('/api/admin/appointments', { view, date: dateQuery, q, page, limit: PAGE_SIZE }, { signal }).then((response) => ({
        ...response,
        requestKey,
      })),
    [requestKey],
  );

  useInterval(() => reload({ silent: true }), REFRESH_MS, Boolean(data));

  // An expired session while loading goes back to the login.
  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) handleErrorRef.current(error);
  }, [error]);

  // After cancelling the last item of the last page, step back to the new last page.
  useEffect(() => {
    if (data && data.requestKey === requestKey && page > data.pages) setPaging({ key: filterKey, page: data.pages });
  }, [data, requestKey, page, filterKey]);

  const handleChanged = useCallback(
    (updated, id) => {
      setSelected((current) => {
        if (!current || current.id !== id) return current;
        return updated ? { ...current, ...updated } : null;
      });
      reload({ silent: true });
    },
    [reload],
  );
  const actions = useAppointmentActions(handleChanged);

  const changePage = (next) => {
    setPaging({ key: filterKey, page: next });
    listTopRef.current?.scrollIntoView({ block: 'start' });
  };

  const today = data?.now?.date || settings?.now?.date || '';
  const businessName = settings?.businessName || 'Nails Art';
  const fresh = Boolean(data) && data.requestKey === requestKey;

  // While a new filter loads, the previous list stays visible (dimmed) instead of flashing a spinner.
  let content;
  if (data && data.items.length) {
    content = (
      <AppointmentList
        items={data.items}
        today={today}
        businessName={businessName}
        busyFor={actions.busyFor}
        anyBusy={Boolean(actions.busy)}
        refreshing={!fresh}
        onOpen={setSelected}
        onComplete={actions.complete}
        onCancel={actions.cancel}
      />
    );
  } else if (fresh) {
    content = (
      <div className="glass enter">
        <AppointmentsEmpty view={view} q={q} date={dateQuery} onClearSearch={() => setSearch('')} onClearDate={() => setDate('')} />
      </div>
    );
  } else if (error) {
    content = (
      <div className="glass enter">
        <ErrorState error={error} onRetry={() => reload()} />
      </div>
    );
  } else {
    content = (
      <div className="glass enter">
        <LoadingState label="Cargando citas…" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        eyebrow={today ? formatDateLong(today) : undefined}
        title="Citas"
        description="Agenda del salón: confirma asistencias, cancela o escribe a tus clientas."
      />
      <AppointmentStats summary={data?.summary} />
      <AppointmentFilters
        view={view}
        onViewChange={setView}
        summary={data?.summary}
        search={search}
        onSearchChange={setSearch}
        date={date}
        onDateChange={setDate}
      />
      <div ref={listTopRef} className="scroll-mt-24">
        {content}
        {fresh ? <Pagination page={data.page} pages={data.pages} total={data.total} onChange={changePage} /> : null}
      </div>
      {selected ? (
        <AppointmentDetailModal
          appointment={selected}
          onClose={() => setSelected(null)}
          today={today}
          timezone={settings?.timezone}
          businessName={businessName}
          busyAction={actions.busyFor(selected.id)}
          disabled={Boolean(actions.busy)}
          onComplete={actions.complete}
          onCancel={actions.cancel}
        />
      ) : null}
    </div>
  );
}
