'use client';

import { ClientActions, ClientAvatar, ClientTag, DateOrDash, PhoneText } from './ClientBits';
import { staggerDelay } from './clientUtils';

function Figure({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-ink-3">{label}</dt>
      <dd className="mt-0.5 truncate font-semibold text-ink">{children}</dd>
    </div>
  );
}

function ClientCard({ client, index, businessName, onCopy, onEdit, onDeleted }) {
  return (
    <li className="glass enter flex flex-col p-4" style={staggerDelay(index, 40, 80)}>
      <div className="flex items-start gap-3">
        <ClientAvatar name={client.name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="min-w-0 max-w-full truncate font-semibold text-ink">{client.name}</p>
            <ClientTag client={client} />
          </div>
          <p className="mt-0.5 text-sm text-ink-2">
            <PhoneText phone={client.phone} />
          </p>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 rounded-xl bg-surface/70 p-3 text-sm">
        <Figure label="Reservas">{client.totalAppointments}</Figure>
        <Figure label="Asistencias">{client.completedAppointments}</Figure>
        <Figure label="Última cita">
          <DateOrDash date={client.lastAppointmentDate} />
        </Figure>
        <Figure label="Última visita">
          <DateOrDash date={client.lastVisitDate} />
        </Figure>
      </dl>
      <div className="mt-3 pt-0.5 md:mt-auto md:pt-3">
        <ClientActions client={client} businessName={businessName} onCopy={onCopy} onEdit={onEdit} onDeleted={onDeleted} />
      </div>
    </li>
  );
}

/** Stacked cards below lg (two columns from md). */
export function ClientCards({ items, businessName, onCopy, onEdit, onDeleted }) {
  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:hidden" aria-label="Directorio de clientas">
      {items.map((client, index) => (
        <ClientCard key={client.id} client={client} index={index} businessName={businessName} onCopy={onCopy} onEdit={onEdit} onDeleted={onDeleted} />
      ))}
    </ul>
  );
}
