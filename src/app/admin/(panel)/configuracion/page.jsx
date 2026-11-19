'use client';

import { ExternalLink, Globe } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { ApiError, apiGet } from '@/lib/api';
import { useAsync } from '@/lib/hooks';
import { useAdmin } from '@/components/admin/AdminContext';
import { ConfigEditor } from '@/components/admin/config/ConfigEditor';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/Controls';
import { ErrorState, LoadingState } from '@/components/ui/States';

function HeaderActions({ timezone }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {timezone ? (
        <Badge tone="neutral" className="py-1.5">
          <Globe aria-hidden="true" className="h-3.5 w-3.5" />
          Zona horaria: {timezone}
        </Badge>
      ) : null}
      <Button variant="secondary" icon={ExternalLink} href="/" target="_blank" rel="noopener noreferrer">
        Ver página de reservas
      </Button>
    </div>
  );
}

export default function ConfiguracionPage() {
  const { handleError } = useAdmin();
  const handleErrorRef = useRef(handleError);
  handleErrorRef.current = handleError;

  const state = useAsync((signal) => apiGet('/api/admin/settings', null, { signal }).then((r) => r.settings), []);

  // An expired session while loading goes back to the login.
  useEffect(() => {
    if (state.error instanceof ApiError && state.error.status === 401) handleErrorRef.current(state.error);
  }, [state.error]);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        eyebrow="Ajustes"
        title="Configuración"
        description="Tus datos, horarios, servicios y colores de tu página de reservas."
        actions={state.data ? <HeaderActions timezone={state.data.timezone} /> : null}
      />
      {state.data ? (
        <ConfigEditor initial={state.data} />
      ) : state.error ? (
        <div className="glass enter">
          <ErrorState error={state.error} onRetry={() => state.reload()} />
        </div>
      ) : (
        <div className="glass enter">
          <LoadingState label="Cargando la configuración…" />
        </div>
      )}
    </div>
  );
}
