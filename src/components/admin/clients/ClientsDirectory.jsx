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
import { ClientCards } from './ClientCards';
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
        <ClientsTable items={data.items} businessName={businessName} onCopy={copyPhone} />
        <ClientCards items={data.items} businessName={businessName} onCopy={copyPhone} />
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
    </>
  );
}
