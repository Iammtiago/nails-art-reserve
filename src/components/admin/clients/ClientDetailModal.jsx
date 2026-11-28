'use client';

import { CalendarClock, CalendarDays, CalendarPlus, CircleX, History, MessageCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { APPOINTMENT_STATUS } from '@shared/constants.js';
import { formatDateLong, formatDateShort, formatTimeRange, pluralize } from '@shared/format.js';
import { formatPhone } from '@shared/phone.js';
import { apiGet } from '@/lib/api';
import { useAsync } from '@/lib/hooks';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { CANCEL_CLASSES } from '@/components/admin/appointments/AppointmentActions';
import { agendaDateLabel, canChangeAppointment } from '@/components/admin/appointments/appointmentUtils';
import { clientWhatsappHref } from './ClientBits';

function Figure({ label, value, className = '' }) {
  return (
    <div className={`min-w-0 rounded-xl bg-surface/70 px-3 py-2.5 ${className}`}>
      <dt className="text-xs font-medium text-ink-3">{label}</dt>
      <dd className="mt-0.5 truncate font-semibold text-ink">{value}</dd>
    </div>
  );
}

/**
 * Her next appointment, with «Reagendar» and «Cancelar» right there; or «Agendar».
 * One on a future day marked attended by mistake shows here too, with the way to fix it.
 */
function NextAppointment({ appointment, busy, disabled, onSchedule, onOpen, onReschedule, onCancel }) {
  if (!appointment) {
    return (
      <section aria-label="Próxima cita" className="rounded-2xl bg-secondary-soft/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Próxima cita</p>
        <p className="mt-1 text-sm text-ink-2">No tiene citas pendientes.</p>
        <Button icon={CalendarPlus} onClick={onSchedule} className="mt-3 w-full sm:w-auto">
          Agendar cita
        </Button>
      </section>
    );
  }
  return (
    <section aria-label="Próxima cita" className="rounded-2xl bg-secondary-soft/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Próxima cita</p>
      <p className="mt-1 font-display text-xl font-semibold leading-tight text-ink">{formatTimeRange(appointment.timeSlot, appointment.endTime)}</p>
      <p className="mt-0.5 font-semibold text-accent-ink">{formatDateLong(appointment.date, { withYear: true })}</p>
      <p className="mt-0.5 text-sm text-ink-2">{appointment.serviceName}</p>
      {appointment.status === APPOINTMENT_STATUS.COMPLETED ? (
        <p className="mt-2 rounded-xl bg-warning-soft px-3 py-2 text-xs font-medium text-warning">
          Está marcada como atendida pero aún no llega su día.{' '}
          <button type="button" onClick={() => onOpen(appointment)} className="font-semibold underline underline-offset-2">
            Abrir para quitar la asistencia
          </button>
        </p>
      ) : null}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Button variant="secondary" icon={CalendarClock} disabled={disabled} onClick={() => onReschedule(appointment)}>
          Reagendar
        </Button>
        <Button variant="ghost" icon={CircleX} className={CANCEL_CLASSES} loading={busy === 'cancel'} disabled={disabled} onClick={() => onCancel(appointment)}>
          Cancelar
        </Button>
      </div>
    </section>
  );
}

/** One appointment of her history: tap it for the detail. Quick «Reagendar» only where it is allowed. */
function HistoryItem({ appointment, today, onOpen, onReschedule, disabled }) {
  const movable = canChangeAppointment(appointment, today);
  return (
    <li className="flex min-w-0 items-center gap-1 rounded-xl pr-2 transition hover:bg-primary-soft">
      <button
        type="button"
        onClick={() => onOpen(appointment)}
        className="flex min-h-[56px] min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-bold text-accent-ink">
            <CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap">{agendaDateLabel(appointment.date, today)}</span>
          </span>
          <span className="mt-0.5 block truncate text-sm text-ink-2">
            {formatTimeRange(appointment.timeSlot, appointment.endTime)} · {appointment.serviceName}
          </span>
        </span>
        <StatusBadge status={appointment.status} />
      </button>
      {movable ? (
        <Button
          size="sm"
          variant="ghost"
          icon={CalendarClock}
          disabled={disabled}
          onClick={() => onReschedule(appointment)}
          aria-label={`Reagendar la cita del ${formatDateLong(appointment.date)}`}
          title="Reagendar"
          className="min-h-[44px] w-11 shrink-0 !px-0 text-accent-ink hover:bg-accent-soft"
        />
      ) : null}
    </li>
  );
}

/**
 * One client: figures, her next appointment and every appointment she had (newest first).
 * From here the salon books a new one for her, or moves or cancels any of them.
 * refreshKey: bump it after a change made elsewhere so the history loads again.
 */
export function ClientDetailModal({ client, refreshKey = 0, businessName, busyFor, disabled = false, onNow, onClose, onSchedule, onOpenAppointment, onReschedule, onCancel }) {
  const { data, error, reload } = useAsync(
    (signal) => (client ? apiGet(`/api/admin/clients/${client.id}`, null, { signal }) : Promise.resolve(null)),
    [client?.id, refreshKey],
  );
  // Hands the server's fresh «today» to the page (for «Asistió» and new appointments).
  const serverToday = data?.now?.date || '';
  const onNowRef = useRef(onNow);
  onNowRef.current = onNow;
  useEffect(() => {
    if (serverToday) onNowRef.current?.(serverToday);
  }, [serverToday]);
  if (!client) return null;
  const fresh = data && data.client?.id === client.id ? data : null;
  const shown = fresh?.client || client;
  const today = fresh?.now?.date || '';
  const next = fresh?.nextAppointment || null;
  const history = fresh?.appointments || [];
  const cancelledCount = history.filter((a) => a.status === APPOINTMENT_STATUS.CANCELLED).length;

  let body;
  if (fresh) {
    body = (
      <>
        <NextAppointment
          appointment={next}
          busy={next ? busyFor(next.id) : null}
          disabled={disabled}
          onSchedule={() => onSchedule(shown)}
          onOpen={onOpenAppointment}
          onReschedule={onReschedule}
          onCancel={onCancel}
        />
        <section aria-labelledby="historial-clienta" className="mt-5">
          <h3 id="historial-clienta" className="mb-1 flex items-center gap-2 font-sans text-sm font-semibold text-ink">
            <History aria-hidden="true" className="h-4 w-4 text-ink-3" />
            Historial de citas <span className="font-normal text-ink-3">· {history.length}</span>
          </h3>
          {history.length ? (
            <ul className="-mx-3 divide-y divide-line/60">
              {history.map((appointment) => (
                <HistoryItem key={appointment.id} appointment={appointment} today={today} onOpen={onOpenAppointment} onReschedule={onReschedule} disabled={disabled} />
              ))}
            </ul>
          ) : (
            <p className="rounded-xl bg-primary-soft/50 px-3 py-4 text-center text-sm text-ink-3">Aún no tiene citas registradas.</p>
          )}
          {cancelledCount ? <p className="mt-2 text-xs text-ink-3">{pluralize(cancelledCount, 'cita cancelada', 'citas canceladas')} en su historial.</p> : null}
        </section>
      </>
    );
  } else if (error) {
    body = <ErrorState error={error} onRetry={() => reload()} />;
  } else {
    body = <LoadingState label="Cargando sus citas…" />;
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={shown.name}
      description={formatPhone(shown.phone)}
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="whatsapp" icon={MessageCircle} href={clientWhatsappHref(shown, businessName)} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </Button>
          <Button icon={CalendarPlus} onClick={() => onSchedule(shown)}>
            Agendar cita
          </Button>
        </div>
      }
    >
      {/* Two columns on phones: «21 nov 2026» does not fit a third of 360 px. */}
      <dl className="mb-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        <Figure label="Reservas" value={shown.totalAppointments} />
        <Figure label="Asistencias" value={shown.completedAppointments} />
        <Figure label="Última visita" value={shown.lastVisitDate ? formatDateShort(shown.lastVisitDate) : '—'} className="col-span-2 sm:col-span-1" />
      </dl>
      {body}
    </Modal>
  );
}
