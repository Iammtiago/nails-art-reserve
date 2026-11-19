'use client';

import { CalendarCheck, CalendarClock, CalendarX2, CheckCircle2, CircleX, Inbox, SearchX, X } from 'lucide-react';
import { formatDateLong } from '@shared/format.js';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';

const COPY = {
  today: { icon: CalendarCheck, title: 'No hay citas para hoy', description: 'Cuando alguien reserve para hoy, la verás aquí.' },
  upcoming: { icon: CalendarClock, title: 'No hay citas próximas', description: 'Las nuevas reservas aparecerán aquí; la lista se actualiza sola.' },
  completed: { icon: CheckCircle2, title: 'Aún no hay asistencias', description: 'Marca «Asistió» cuando una clienta llegue, o escanea su código.' },
  cancelled: { icon: CircleX, title: 'No hay citas canceladas', description: 'Aquí verás las citas que se cancelen, por la clienta o por ti.' },
  all: { icon: Inbox, title: 'Todavía no hay citas', description: 'Comparte tu página de reservas para recibir las primeras.' },
};

/** Empty state for the current view, search or date filter. */
export function AppointmentsEmpty({ view, q, date, onClearSearch, onClearDate }) {
  if (q) {
    return (
      <EmptyState
        icon={SearchX}
        title={`Sin resultados para «${q}»`}
        description="Prueba con otro nombre, teléfono o código de reserva."
        action={
          <Button variant="secondary" icon={X} onClick={onClearSearch}>
            Borrar búsqueda
          </Button>
        }
      />
    );
  }
  if (date) {
    return (
      <EmptyState
        icon={CalendarX2}
        title={`Sin citas el ${formatDateLong(date).toLowerCase()}`}
        description="No hay citas de esta vista en esa fecha. Prueba con «Todas» o quita la fecha."
        action={
          <Button variant="secondary" icon={X} onClick={onClearDate}>
            Quitar fecha
          </Button>
        }
      />
    );
  }
  const copy = COPY[view] || COPY.all;
  return <EmptyState icon={copy.icon} title={copy.title} description={copy.description} />;
}
