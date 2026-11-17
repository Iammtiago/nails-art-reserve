'use client';

import { Copy, MessageCircle } from 'lucide-react';
import { formatDateShort } from '@shared/format.js';
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

export function clientWhatsappHref(client, businessName) {
  const firstName = firstNameOf(client.name);
  const greeting = firstName ? `Hola ${firstName}` : 'Hola';
  return whatsappLink(client.phone, `${greeting}, te escribimos de ${businessName}.`);
}

/** WhatsApp + copy phone. `compact` renders icon-only buttons for the desktop table. */
export function ClientActions({ client, businessName, onCopy, onDeleted, compact = false }) {
  const href = clientWhatsappHref(client, businessName);
  if (compact) {
    return (
      <div className="flex items-center justify-end gap-1">
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
        <IconButton icon={Copy} label={`Copiar teléfono de ${client.name}`} variant="ghost" onClick={() => onCopy(client)} />
        <SuperDeleteButton entity="client" item={client} onDeleted={onDeleted} compact />
      </div>
    );
  }
  return (
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
      <SuperDeleteButton entity="client" item={client} onDeleted={onDeleted} compact />
    </div>
  );
}

export function PhoneText({ phone, className = '' }) {
  return <span className={`whitespace-nowrap tabular-nums ${className}`}>{formatPhone(phone)}</span>;
}
