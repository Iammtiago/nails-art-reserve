'use client';

import { ClientsDirectory } from '@/components/admin/clients/ClientsDirectory';
import { PageHeader } from '@/components/ui/Controls';

export default function ClientesPage() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="enter">
        <PageHeader eyebrow="Directorio" title="Clientes" description="Toca una clienta para ver su historial y su próxima cita, y agendarle o reagendarle." />
      </div>
      <ClientsDirectory />
    </div>
  );
}
