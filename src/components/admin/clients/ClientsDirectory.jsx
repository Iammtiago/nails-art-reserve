'use client';

import { SearchX, Users, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatPhone } from '@shared/phone.js';
import { pluralize } from '@shared/format.js';
import { apiGet } from '@/lib/api';
import { useAsync, useDebouncedValue } from '@/lib/hooks';
import { useAdmin } from '@/components/admin/AdminContext';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Controls';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { ManualAppointmentModal, RescheduleModal } from '@/components/admin/calendar/AgendaModals';
import { AppointmentDetailModal } from '@/components/admin/appointments/AppointmentDetailModal';
import { useAppointmentActions } from '@/components/admin/appointments/useAppointmentActions';
import { ClientCards } from './ClientCards';
import { ClientDetailModal } from './ClientDetailModal';
import { ClientEditModal } from './ClientEditModal';
import { ClientSearch } from './ClientSearch';
import { ClientsStats } from './ClientsStats';
import { ClientsTable } from './ClientsTable';
import { CLIENTS_PAGE_SIZE, copyText } from './clientUtils';

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function searchStatus({ data, loading, pending, q }) {
  if (!data) return loading ? 'Cargando clientas…' : '';
  if (pending) return 'Buscando…';
  if (q) return data.total ? `${pluralize(data.total, 'coincidencia', 'coincidencias')} para «${q}»` : 'Sin coincidencias.';
  return data.total ? `${pluralize(data.total, 'clienta', 'clientas')} · primero las de cita más reciente` : '';
}

function ClientsEmpty({ q, onClear }) {
  if (q) {
    return (
      <EmptyState
        icon={SearchX}
        title={`Sin resultados para «${q}»`}
        description="Prueba con otro nombre o con parte del número de teléfono."
        action={
          <Button variant="secondary" icon={X} onClick={onClear}>
            Borrar búsqueda
          </Button>
        }
      />
    );
  }
  return <EmptyState icon={Users} title="Aún no hay clientas" description="Se agregan solas cuando alguien reserva." />;
}

/** Client directory: figures, instant search, table (desktop) or cards (mobile) and pagination. */
export function ClientsDirectory() {
  const { settings, handleError } = useAdmin();
  const toast = useToast();
  const handleErrorRef = useRef(handleError);
  handleErrorRef.current = handleError;
  const listTopRef = useRef(null);

  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  // Client whose appointments are open. While she gets a new appointment or one moves, her
  // detail steps aside (one dialog at a time) and comes back afterwards with fresh data.
  const [viewing, setViewing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [moving, setMoving] = useState(null);
  const [scheduling, setScheduling] = useState(null);
  const [historyKey, setHistoryKey] = useState(0);
  const q = useDebouncedValue(query.trim(), 250);
  // The page belongs to the search it was chosen for, so a new search starts on page 1.
  const [paging, setPaging] = useState({ q: '', page: 1 });
  const page = paging.q === q ? paging.page : 1;

  const state = useAsync((signal) => apiGet('/api/admin/clients', { q, page, limit: CLIENTS_PAGE_SIZE }, { signal }), [q, page]);
  const { data, error, loading } = state;
  const pending = Boolean(data) && (loading || query.trim() !== q);

  useEffect(() => {
    if (error) handleErrorRef.current(error);
  }, [error]);

  // The list shrank under the current page (e.g. after new data): jump to the last page.
  useEffect(() => {
    if (data && !data.items.length && data.total > 0 && page > 1) setPaging({ q, page: data.pages });
  }, [data, page, q]);

  const changePage = (next) => {
    setPaging({ q, page: next });
    const top = listTopRef.current;
    if (top && top.getBoundingClientRect().top < 0) {
      top.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
  };

  const copyPhone = useCallback(
    async (client) => {
      const ok = await copyText(formatPhone(client.phone));
      if (ok) toast.success('Teléfono copiado');
      else toast.error('No pudimos copiar el teléfono. Cópialo a mano.');
    },
    [toast],
  );

  const businessName = settings?.businessName || 'Nails Art';
  // «Today» from the server's latest answer (the panel may stay open overnight); settings as a fallback.
  const [detailToday, setDetailToday] = useState('');
  const today = detailToday || data?.now?.date || settings?.now?.date || '';
  const reloadList = state.reload;

  // Any change to one of her appointments refreshes her history and the directory figures.
  const handleAppointmentChanged = useCallback(
    (updated, id) => {
      setSelected((current) => {
        if (!current || current.id !== id) return current;
        return updated ? { ...current, ...updated } : null;
      });
      setHistoryKey((k) => k + 1);
      reloadList({ silent: true });
    },
    [reloadList],
  );
  const actions = useAppointmentActions(handleAppointmentChanged);

  const startReschedule = useCallback((appointment) => {
    setSelected(null);
    setMoving(appointment);
  }, []);

  let body;
  if (error) {
    body = (
      <div className="glass enter">
        <ErrorState error={error} onRetry={() => state.reload()} />
      </div>
    );
  } else if (!data) {
    body = (
      <div className="glass enter">
        <LoadingState label="Cargando clientas…" />
      </div>
    );
  } else if (!data.items.length) {
    body = (
      <div className={`glass enter transition-opacity ${pending ? 'opacity-60' : ''}`}>
        <ClientsEmpty q={q} onClear={() => setQuery('')} />
      </div>
    );
  } else {
    body = (
      <div aria-busy={pending || undefined} className={`transition-opacity duration-200 ${pending ? 'opacity-60' : ''}`}>
        <ClientsTable items={data.items} businessName={businessName} onOpen={setViewing} onCopy={copyPhone} onEdit={setEditing} onDeleted={() => state.reload({ silent: true })} />
        <ClientCards items={data.items} businessName={businessName} onOpen={setViewing} onCopy={copyPhone} onEdit={setEditing} onDeleted={() => state.reload({ silent: true })} />
        <Pagination page={data.page} pages={data.pages} total={data.total} onChange={changePage} />
      </div>
    );
  }

  return (
    <>
      <ClientsStats summary={data?.summary || null} unavailable={Boolean(error)} />
      <ClientSearch value={query} onChange={setQuery} busy={pending} status={searchStatus({ data, loading, pending, q })} />
      <div ref={listTopRef} className="scroll-mt-24 lg:scroll-mt-8">
        {body}
      </div>
      <ClientEditModal client={editing} onClose={() => setEditing(null)} onSaved={() => state.reload({ silent: true })} />

      {viewing && !moving && !scheduling ? (
        <ClientDetailModal
          client={viewing}
          refreshKey={historyKey}
          businessName={businessName}
          busyFor={actions.busyFor}
          disabled={Boolean(actions.busy)}
          onNow={setDetailToday}
          onClose={() => {
            setViewing(null);
            setSelected(null);
          }}
          onSchedule={(client) => {
            setSelected(null);
            setScheduling(client);
          }}
          onOpenAppointment={setSelected}
          onReschedule={startReschedule}
          onCancel={actions.cancel}
        />
      ) : null}
      {selected && !moving && !scheduling ? (
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
          onReschedule={startReschedule}
          onReopen={actions.reopen}
          onPurged={(a) => handleAppointmentChanged(null, a.id)}
        />
      ) : null}
      <RescheduleModal
        appointment={moving}
        onClose={() => setMoving(null)}
        onDone={() => {
          setHistoryKey((k) => k + 1);
          state.reload({ silent: true });
        }}
      />
      <ManualAppointmentModal
        open={Boolean(scheduling)}
        initialDate={today}
        initialClient={scheduling}
        onClose={() => setScheduling(null)}
        onCreated={() => {
          setHistoryKey((k) => k + 1);
          state.reload({ silent: true });
        }}
      />
    </>
  );
}
