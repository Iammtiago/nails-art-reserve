'use client';

import { CalendarCheck, CalendarClock, CalendarX2, CheckCircle2, CircleX, Inbox, ListFilter, SearchX, X } from 'lucide-react';
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

const VIEW_NAMES = { today: 'Hoy', upcoming: 'Próximas', completed: 'Atendidas', cancelled: 'Canceladas' };

function EmptyActions({ narrowed, onShowAll, clearLabel, onClear }) {
  return (
    <div className="flex flex-col justify-center gap-2 sm:flex-row">
      {narrowed ? (
        <Button icon={ListFilter} onClick={onShowAll}>
          Buscar en «Todas»
        </Button>
      ) : null}
      <Button variant="secondary" icon={X} onClick={onClear}>
        {clearLabel}
      </Button>
    </div>
  );
}

/** Empty state for the current view, search or date filter. Outside «Todas» it offers to look there. */
export function AppointmentsEmpty({ view, q, date, onClearSearch, onClearDate, onShowAll }) {
  const narrowed = view !== 'all' && Boolean(onShowAll);
  const inView = narrowed ? ` en «${VIEW_NAMES[view] || view}»` : '';
  if (q && date) {
    // The date still narrows the search: say so, and offer to search every day.
    return (
      <EmptyState
        icon={SearchX}
        title={`Sin resultados para «${q}» el ${formatDateLong(date).toLowerCase()}${inView}`}
        description="La búsqueda solo mira ese día. Quita la fecha para buscar en todos los días."
        action={
          <div className="flex flex-col justify-center gap-2 sm:flex-row">
            <Button icon={CalendarX2} onClick={onClearDate}>
              Buscar en todos los días
            </Button>
            {narrowed ? (
              <Button variant="secondary" icon={ListFilter} onClick={onShowAll}>
                Buscar en «Todas»
              </Button>
            ) : null}
            <Button variant="secondary" icon={X} onClick={onClearSearch}>
              Borrar búsqueda
            </Button>
          </div>
        }
      />
    );
  }
  if (q) {
    return (
      <EmptyState
        icon={SearchX}
        title={`Sin resultados para «${q}»${inView}`}
        description={narrowed ? 'Esta vista solo muestra una parte de las citas. Búscala en «Todas».' : 'Prueba con otro nombre, teléfono o código de reserva.'}
        action={<EmptyActions narrowed={narrowed} onShowAll={onShowAll} clearLabel="Borrar búsqueda" onClear={onClearSearch} />}
      />
    );
  }
  if (date) {
    return (
      <EmptyState
        icon={CalendarX2}
        title={`Sin citas el ${formatDateLong(date).toLowerCase()}${inView}`}
        description={narrowed ? 'Esta vista solo muestra una parte de las citas. Mira ese día en «Todas».' : 'Ese día no tiene citas. Prueba con otra fecha o quita el filtro.'}
        action={<EmptyActions narrowed={narrowed} onShowAll={onShowAll} clearLabel="Quitar fecha" onClear={onClearDate} />}
      />
    );
  }
  const copy = COPY[view] || COPY.all;
  return <EmptyState icon={copy.icon} title={copy.title} description={copy.description} />;
}
