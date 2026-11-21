'use client';

import { CalendarClock, CheckCircle2, CircleX, MessageCircle } from 'lucide-react';
import { APPOINTMENT_STATUS } from '@shared/constants.js';
import { Button } from '@/components/ui/Button';
import { SuperDeleteButton } from '@/components/admin/SuperMode';

/** «Asistió»: soft button with the success palette. */
export const ATTENDED_CLASSES = 'bg-success-soft text-success hover:bg-success-soft hover:brightness-95';
/** «Cancelar»: ghost button with the danger palette. */
export const CANCEL_CLASSES = 'text-danger hover:bg-danger-soft';

/** Icon-only wa.me link (44 px target). */
export function WhatsAppIconLink({ href, label, className = '' }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className={`btn btn-ghost h-11 w-11 shrink-0 !min-h-0 !px-0 text-success hover:bg-success-soft ${className}`}
    >
      <MessageCircle aria-hidden="true" className="h-5 w-5" />
    </a>
  );
}

/**
 * Row/card actions. «Asistió» and «Cancelar» only for confirmed appointments; WhatsApp always.
 * compactOnLg: icon-only buttons between lg and xl, where the table is narrow.
 */
export function AppointmentActions({ appointment, waHref, busyAction, disabled = false, onComplete, onCancel, onReschedule, onPurged, compactOnLg = false, className = '' }) {
  const confirmed = appointment.status === APPOINTMENT_STATUS.CONFIRMED;
  const labelClass = compactOnLg ? 'lg:max-xl:sr-only' : '';
  const completeLabel = `Marcar que ${appointment.clientName} asistió`;
  const cancelLabel = `Cancelar la cita de ${appointment.clientName}`;
  const rescheduleLabel = `Reagendar la cita de ${appointment.clientName}`;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {confirmed ? (
        <>
          <Button
            size="sm"
            variant="soft"
            icon={CheckCircle2}
            loading={busyAction === 'complete'}
            disabled={disabled}
            onClick={() => onComplete(appointment)}
            aria-label={completeLabel}
            title={completeLabel}
            className={`min-h-[44px] ${ATTENDED_CLASSES}`}
          >
            <span className={labelClass}>Asistió</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={CircleX}
            loading={busyAction === 'cancel'}
            disabled={disabled}
            onClick={() => onCancel(appointment)}
            aria-label={cancelLabel}
            title={cancelLabel}
            className={`min-h-[44px] ${CANCEL_CLASSES}`}
          >
            <span className={labelClass}>Cancelar</span>
          </Button>
          {onReschedule ? (
            <Button
              size="sm"
              variant="ghost"
              icon={CalendarClock}
              disabled={disabled}
              onClick={() => onReschedule(appointment)}
              aria-label={rescheduleLabel}
              title={rescheduleLabel}
              className={`min-h-[44px] text-accent-ink hover:bg-accent-soft ${compactOnLg ? 'lg:max-xl:hidden' : ''}`}
            >
              {/* Icon only in the wide table, with its label on the phone cards. Between lg and xl
                  the table is too narrow: there it lives in the detail (tap the row). */}
              <span className={compactOnLg ? 'lg:sr-only' : ''}>Reagendar</span>
            </Button>
          ) : null}
        </>
      ) : null}
      <SuperDeleteButton entity="appointment" item={appointment} onDeleted={onPurged} compact />
      <WhatsAppIconLink href={waHref} label={`Escribir a ${appointment.clientName} por WhatsApp`} className="ml-auto" />
    </div>
  );
}
