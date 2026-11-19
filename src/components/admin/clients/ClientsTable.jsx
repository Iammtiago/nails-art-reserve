'use client';

import { ClientActions, ClientAvatar, ClientTag, DateOrDash, PhoneText } from './ClientBits';
import { staggerDelay } from './clientUtils';

function ClientRow({ client, index, businessName, onCopy, onEdit, onDeleted }) {
  return (
    <tr className="enter transition-colors hover:bg-surface/70" style={staggerDelay(index, 30)}>
      {/* w-full + max-w-0 lets the name truncate while the other columns keep their width. */}
      <td className="w-full max-w-0 py-3 pl-5 pr-2">
        <div className="flex min-w-0 items-center gap-3">
          <ClientAvatar name={client.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink" title={client.name}>
              {client.name}
            </p>
            <div className="mt-0.5 empty:hidden">
              <ClientTag client={client} />
            </div>
          </div>
        </div>
      </td>
      <td className="px-2 py-3 text-ink-2">
        <PhoneText phone={client.phone} />
      </td>
      <td className="px-2 py-3 text-center font-semibold tabular-nums text-ink">{client.totalAppointments}</td>
      <td className="px-2 py-3 text-center font-semibold tabular-nums text-ink">{client.completedAppointments}</td>
      <td className="whitespace-nowrap px-2 py-3 text-ink-2">
        <DateOrDash date={client.lastAppointmentDate} />
      </td>
      <td className="whitespace-nowrap px-2 py-3 text-ink-2">
        <DateOrDash date={client.lastVisitDate} />
      </td>
      <td className="py-2 pl-2 pr-4">
        <ClientActions client={client} businessName={businessName} onCopy={onCopy} onEdit={onEdit} onDeleted={onDeleted} compact />
      </td>
    </tr>
  );
}

/** Desktop directory (lg and up). */
export function ClientsTable({ items, businessName, onCopy, onEdit, onDeleted }) {
  return (
    <div className="glass enter hidden overflow-hidden lg:block" style={{ animationDelay: '120ms' }}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Directorio de clientas</caption>
          <thead>
            <tr className="border-b border-line text-xs font-semibold text-ink-3">
              <th scope="col" className="py-3 pl-5 pr-2 font-semibold">
                Clienta
              </th>
              <th scope="col" className="px-2 py-3 font-semibold">
                Teléfono
              </th>
              <th scope="col" className="px-2 py-3 text-center font-semibold">
                Reservas
              </th>
              <th scope="col" className="px-2 py-3 text-center font-semibold">
                Asistencias
              </th>
              <th scope="col" className="whitespace-nowrap px-2 py-3 font-semibold">
                Última cita
              </th>
              <th scope="col" className="whitespace-nowrap px-2 py-3 font-semibold">
                Última visita
              </th>
              <th scope="col" className="py-3 pl-2 pr-5 text-right font-semibold">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((client, index) => (
              <ClientRow key={client.id} client={client} index={index} businessName={businessName} onCopy={onCopy} onEdit={onEdit} onDeleted={onDeleted} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
