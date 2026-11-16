'use client';

import { AlertTriangle, Ban, BadgeCheck, CalendarClock, CalendarDays, CheckCheck, CheckCircle2, Clock3, Hash, MessageCircle, ScanLine, Sparkles } from 'lucide-react';
import { formatDateLong, formatDuration, formatTimeRange } from '@shared/format.js';
import { formatPhone } from '@shared/phone.js';
import { clientContactText, whatsappLink } from '@shared/whatsapp.js';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

const TONES = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
};

function firstNameOf(name) {
  return String(name || '').trim().split(/\s+/)[0] || '';
}

/** Glanceable verdict for the person at the door. */
function verdictFor(appointment, now) {
  if (appointment.status === 'cancelled') {
    const who =
      appointment.cancelledBy === 'client' ? 'La canceló la clienta. ' : appointment.cancelledBy === 'admin' ? 'Se canceló desde el panel. ' : '';
    return { tone: 'danger', icon: Ban, title: 'Cita cancelada', text: `${who}No se puede marcar asistencia.` };
  }
  if (appointment.status === 'completed') {
    return { tone: 'info', icon: CheckCheck, title: 'Asistencia ya registrada', text: 'No hace falta hacer nada más con esta cita.' };
  }
  if (appointment.date === now.date) {
    return { tone: 'success', icon: BadgeCheck, title: 'Código válido', text: 'La cita es para hoy. Marca la asistencia cuando llegue.' };
  }
  return {
    tone: 'warning',
    icon: CalendarClock,
    title: 'Código válido, pero no es para hoy',
    text: `La cita es del ${formatDateLong(appointment.date, { withYear: true }).toLowerCase()}.`,
  };
}

function Verdict({ verdict }) {
  const Icon = verdict.icon;
  return (
    <div className={`flex items-start gap-3 px-4 py-4 sm:px-6 ${TONES[verdict.tone]}`}>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface/80">
        <Icon aria-hidden="true" className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <p className="font-display text-lg font-semibold leading-tight">{verdict.title}</p>
        <p className="mt-0.5 text-sm text-ink-2">{verdict.text}</p>
      </div>
    </div>
  );
}

function AttendedHero({ name }) {
  const firstName = firstNameOf(name);
  return (
    <div className="flex flex-col items-center bg-success-soft px-6 py-8 text-center">
      <span className="enter grid h-20 w-20 place-items-center rounded-full bg-success text-white shadow-lift">
        <CheckCircle2 aria-hidden="true" className="h-11 w-11" />
      </span>
      <p className="mt-4 font-display text-2xl font-semibold text-success">Asistencia registrada</p>
      <p className="mt-1 text-sm text-ink-2">{firstName ? `La visita de ${firstName} ya quedó en su historial.` : 'La visita ya quedó en el historial.'}</p>
    </div>
  );
}

function Detail({ icon: Icon, label, children }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary-soft text-primary-ink">
        <Icon aria-hidden="true" className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-medium text-ink-3">{label}</dt>
        <dd className="mt-0.5 font-semibold text-ink">{children}</dd>
      </div>
    </div>
  );
}

/**
 * Verified appointment: verdict, warnings, client, details and the attendance action.
 * data = { appointment, attended, warnings, canMarkAttended, now }
 */
export function VerificationCard({ data, businessName, marking, onMarkAttended, onReset, resetLabel }) {
  const { appointment, attended, warnings = [], canMarkAttended, now } = data;
  const isToday = appointment.date === now?.date;
  const whatsappHref = whatsappLink(
    appointment.clientPhone,
    clientContactText({
      businessName,
      clientName: appointment.clientName,
      serviceName: appointment.serviceName,
      date: appointment.date,
      time: appointment.timeSlot,
    }),
  );

  return (
    <article className="glass enter overflow-hidden" aria-labelledby="cita-verificada">
      {attended ? <AttendedHero name={appointment.clientName} /> : <Verdict verdict={verdictFor(appointment, now)} />}

      <div className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={appointment.status} />
          <span className="chip bg-primary-soft font-mono tracking-[0.2em] text-ink-2">{appointment.bookingCode}</span>
        </div>

        {warnings.length ? (
          <ul className="space-y-2">
            {warnings.map((warning) => (
              <li key={warning} className="flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2.5 text-sm font-medium text-warning">
                <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                {warning}
              </li>
            ))}
          </ul>
        ) : null}

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Clienta</p>
          <h2 id="cita-verificada" className="mt-1 break-words font-display text-3xl font-semibold leading-tight sm:text-4xl">
            {appointment.clientName}
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="whitespace-nowrap text-base tabular-nums text-ink-2">{formatPhone(appointment.clientPhone)}</span>
            <Button
              variant="whatsapp"
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              icon={MessageCircle}
              aria-label={`Escribir a ${appointment.clientName} por WhatsApp`}
            >
              WhatsApp
            </Button>
          </div>
        </div>

        <dl className="grid gap-4 rounded-2xl bg-surface/70 p-4 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
          <Detail icon={Sparkles} label="Servicio">
            {appointment.serviceName}
            <span className="font-normal text-ink-2"> · {formatDuration(appointment.durationMinutes)}</span>
          </Detail>
          <Detail icon={CalendarDays} label="Fecha">
            <span className="inline-flex flex-wrap items-center gap-2">
              {formatDateLong(appointment.date, { withYear: true })}
              {isToday ? <Badge tone="success">Hoy</Badge> : null}
            </span>
          </Detail>
          <Detail icon={Clock3} label="Hora">
            {formatTimeRange(appointment.timeSlot, appointment.endTime)}
          </Detail>
          <Detail icon={Hash} label="Código">
            <span className="code-text text-primary-ink">{appointment.bookingCode}</span>
          </Detail>
        </dl>

        <div className="space-y-2.5">
          {!attended && canMarkAttended ? (
            <Button size="lg" icon={CheckCircle2} block loading={marking} onClick={onMarkAttended}>
              Validar y marcar asistencia
            </Button>
          ) : null}
          <Button
            variant={attended || !canMarkAttended ? 'primary' : 'secondary'}
            size={attended || !canMarkAttended ? 'lg' : 'md'}
            icon={ScanLine}
            block
            disabled={marking}
            onClick={onReset}
          >
            {resetLabel}
          </Button>
        </div>
      </div>
    </article>
  );
}
