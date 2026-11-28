'use client';

import { CalendarDays, Copy, History, MessageCircle, Pencil } from 'lucide-react';
import { formatDateShort, formatTime, formatWeekdayDayMonth } from '@shared/format.js';
import { formatPhone } from '@shared/phone.js';
import { whatsappLink } from '@shared/whatsapp.js';
import { Badge } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { SuperDeleteButton } from '@/components/admin/SuperMode';
import { clientTag, firstNameOf, initialsOf } from './clientUtils';

const AVATAR_SIZES = {
  md: 'h-11 w-11 text-sm',
  sm: 'h-9 w-9 text-xs',
};

export function ClientAvatar({ name, size = 'md' }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full bg-secondary-soft font-semibold tracking-wide text-primary-ink ring-2 ring-white/80 ${AVATAR_SIZES[size] || AVATAR_SIZES.md}`}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  );
}

export function ClientTag({ client }) {
  const tag = clientTag(client);
  if (!tag) return null;
  return <Badge tone={tag.tone}>{tag.label}</Badge>;
}

/** Short date, or an em dash read as «Sin registro». */
export function DateOrDash({ date }) {
  if (!date) {
    return (
      <>
        <span aria-hidden="true">—</span>
        <span className="sr-only">Sin registro</span>
      </>
    );
  }
  return <time dateTime={date}>{formatDateShort(date)}</time>;
}

/**
 * Her next pending appointment («Sáb 12 dic · 10:30 a. m.») or «Sin cita pendiente».
 * `stacked` puts the time under the date, for the narrow table column.
 */
export function NextDate({ next, stacked = false, className = '' }) {
  if (!next) return <span className={`font-normal text-ink-3 ${className}`}>{stacked ? 'Sin cita' : 'Sin cita pendiente'}</span>;
  if (stacked) {
    return (
      <time dateTime={next.date} className={`block leading-tight ${className}`}>
        <span className="block font-semibold text-accent-ink">{formatWeekdayDayMonth(next.date)}</span>
        <span className="block text-xs text-ink-2">{formatTime(next.timeSlot)}</span>
      </time>
    );
  }
  return (
    <span className={`inline-flex min-w-0 max-w-full items-center gap-1.5 font-semibold text-accent-ink ${className}`}>
      <CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0" />
      <time dateTime={next.date} className="truncate">
        {formatWeekdayDayMonth(next.date)} · {formatTime(next.timeSlot)}
      </time>
    </span>
  );
}

export function clientWhatsappHref(client, businessName) {
  const firstName = firstNameOf(client.name);
  const greeting = firstName ? `Hola ${firstName}` : 'Hola';
  return whatsappLink(client.phone, `${greeting}, te escribimos de ${businessName}.`);
}

/** Her appointments, WhatsApp, edit and copy phone. `compact` renders icon-only buttons for the desktop table. */
export function ClientActions({ client, businessName, onOpen, onCopy, onEdit, onDeleted, compact = false }) {
  const href = clientWhatsappHref(client, businessName);
  if (compact) {
    return (
      <div className="flex items-center justify-end gap-1">
        <IconButton icon={History} label={`Ver las citas de ${client.name}`} variant="ghost" onClick={() => onOpen(client)} className="text-accent-ink hover:bg-accent-soft" />
        <Button
          variant="whatsapp"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          icon={MessageCircle}
          aria-label={`Escribir a ${client.name} por WhatsApp`}
          title="Escribir por WhatsApp"
          className="w-11 !px-0"
        />
        <IconButton icon={Pencil} label={`Editar a ${client.name}`} variant="ghost" onClick={() => onEdit(client)} />
        <IconButton icon={Copy} label={`Copiar teléfono de ${client.name}`} variant="ghost" onClick={() => onCopy(client)} />
        <SuperDeleteButton entity="client" item={client} onDeleted={onDeleted} compact />
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <Button variant="soft" icon={History} block onClick={() => onOpen(client)}>
        Ver citas y agendar
      </Button>
      <div className="flex gap-2">
        <Button
          variant="whatsapp"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          icon={MessageCircle}
          className="flex-1"
          aria-label={`Escribir a ${client.name} por WhatsApp`}
        >
          WhatsApp
        </Button>
        <Button variant="secondary" icon={Copy} className="flex-1" onClick={() => onCopy(client)} aria-label={`Copiar teléfono de ${client.name}`}>
          Copiar
        </Button>
        <IconButton icon={Pencil} label={`Editar a ${client.name}`} variant="secondary" onClick={() => onEdit(client)} />
        <SuperDeleteButton entity="client" item={client} onDeleted={onDeleted} compact />
      </div>
    </div>
  );
}

export function PhoneText({ phone, className = '' }) {
  return <span className={`whitespace-nowrap tabular-nums ${className}`}>{formatPhone(phone)}</span>;
}
