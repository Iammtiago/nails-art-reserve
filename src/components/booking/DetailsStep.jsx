'use client';

import { AlertTriangle, CalendarCheck, CalendarDays, Clock, ListChecks, Pencil, ShieldCheck, UserRoundCheck } from 'lucide-react';
import { useRef, useState } from 'react';
import { formatDateLong, formatTimeRange } from '@shared/format.js';
import { PHONE_HINT } from '@shared/phone.js';
import { clientNameField, phoneField } from '@shared/schemas.js';
import { ApiError, apiPost, errorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { serviceIcon } from './booking-utils';

// Errors that mean the chosen time is no longer bookable: back to step 2.
const SLOT_ERRORS = ['SLOT_TAKEN', 'INVALID_TIME', 'DATE_UNAVAILABLE'];

function firstIssue(result, fallback) {
  return result.success ? undefined : result.error?.issues?.[0]?.message || fallback;
}

function SummaryCard({ service, date, time, onEdit }) {
  const ServiceIcon = serviceIcon(service);
  return (
    <div className="mt-4 rounded-2xl bg-secondary-soft px-4 pb-4 pt-2">
      <div className="flex items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 font-semibold text-ink">
          <ServiceIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-primary-ink" />
          <span className="sr-only">Servicio: </span>
          {service.name}
        </p>
        <Button variant="ghost" size="sm" icon={Pencil} className="-mr-2 min-h-[44px] shrink-0" onClick={onEdit} aria-label="Cambiar fecha u hora">
          Cambiar
        </Button>
      </div>
      <dl className="space-y-1.5 text-sm text-ink-2">
        <div className="flex items-center gap-2">
          <dt className="shrink-0">
            <CalendarDays aria-hidden="true" className="h-4 w-4 text-primary-ink" />
            <span className="sr-only">Fecha</span>
          </dt>
          <dd>{formatDateLong(date)}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="shrink-0">
            <Clock aria-hidden="true" className="h-4 w-4 text-primary-ink" />
            <span className="sr-only">Hora</span>
          </dt>
          <dd className="whitespace-nowrap">{formatTimeRange(time.time, time.endTime)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function DetailsStep({ service, date, time, contact, onContactChange, remembered = false, onForget, onEdit, onBooked, onSlotTaken, onOpenCancel, headingRef }) {
  const toast = useToast();
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [website, setWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef(null);
  const phoneRef = useRef(null);

  const update = (key) => (event) => {
    onContactChange(key, event.target.value);
    setErrors((e) => ({ ...e, [key]: undefined }));
    if (key === 'clientPhone') setNotice('');
  };

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;

    const name = clientNameField.safeParse(contact.clientName);
    const phone = phoneField.safeParse(contact.clientPhone);
    const nextErrors = {
      clientName: firstIssue(name, 'Escribe tu nombre completo.'),
      clientPhone: firstIssue(phone, 'Revisa el número de teléfono.'),
    };
    if (nextErrors.clientName || nextErrors.clientPhone) {
      setErrors(nextErrors);
      (nextErrors.clientName ? nameRef : phoneRef).current?.focus();
      return;
    }

    setErrors({});
    setNotice('');
    setSubmitting(true);
    try {
      const result = await apiPost('/api/appointments', {
        serviceKey: service.key,
        date,
        timeSlot: time.time,
        clientName: name.data,
        // Raw input: the server normalizes it (and keeps +country numbers intact).
        clientPhone: contact.clientPhone.trim(),
        website,
      });
      onBooked(result.appointment);
    } catch (error) {
      setSubmitting(false);
      if (error instanceof ApiError) {
        if (SLOT_ERRORS.includes(error.code)) {
          toast.error(error.message);
          onSlotTaken();
          return;
        }
        if (error.code === 'MAX_ACTIVE_REACHED') {
          setNotice(error.message);
          return;
        }
        if (error.status === 422 && error.details.length) {
          const fields = error.fieldErrors();
          if (fields.clientName || fields.clientPhone) {
            setErrors({ clientName: fields.clientName, clientPhone: fields.clientPhone });
            (fields.clientName ? nameRef : phoneRef).current?.focus();
            return;
          }
        }
      }
      toast.error(errorMessage(error));
    }
  }

  return (
    <div>
      <h2 ref={headingRef} tabIndex={-1} className="section-title outline-none">
        Tus datos
      </h2>
      <p className="mt-1 text-sm text-ink-2">Solo necesitamos tu nombre y tu WhatsApp para confirmar la cita.</p>

      <SummaryCard service={service} date={date} time={time} onEdit={onEdit} />

      <form onSubmit={submit} noValidate className="relative mt-5 space-y-4">
        {remembered && (contact.clientName || contact.clientPhone) ? (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-2xl bg-accent-soft/70 px-4 py-2.5 text-sm text-ink-2">
            <p className="flex min-w-0 basis-52 flex-1 items-center gap-2">
              <UserRoundCheck aria-hidden="true" className="h-4 w-4 shrink-0 text-accent-ink" />
              Pusimos tus datos de la última vez. Revísalos y confirma.
            </p>
            <button type="button" onClick={onForget} className="min-h-[44px] shrink-0 rounded-lg px-1 font-semibold text-primary-ink underline-offset-2 hover:underline">
              No soy yo
            </button>
          </div>
        ) : null}
        <Field label="Nombre completo" error={errors.clientName} required>
          {(p) => (
            <Input
              {...p}
              ref={nameRef}
              name="clientName"
              value={contact.clientName}
              onChange={update('clientName')}
              autoComplete="name"
              autoCapitalize="words"
              enterKeyHint="next"
              maxLength={80}
              placeholder="María Pérez"
            />
          )}
        </Field>
        <Field label="Teléfono (WhatsApp)" hint={PHONE_HINT} error={errors.clientPhone} required>
          {(p) => (
            <Input
              {...p}
              ref={phoneRef}
              name="clientPhone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              enterKeyHint="done"
              maxLength={25}
              value={contact.clientPhone}
              onChange={update('clientPhone')}
              placeholder="0414 123 4567"
            />
          )}
        </Field>

        {/* Honeypot: hidden from people and assistive tech; bots tend to fill it. */}
        <div aria-hidden="true" className="absolute -left-[10000px] top-0 h-px w-px overflow-hidden">
          <label htmlFor="booking-website">Sitio web</label>
          <input
            id="booking-website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
        </div>

        {notice ? (
          <div className="rounded-2xl bg-warning-soft p-4 text-sm text-warning" role="alert">
            <p className="flex items-start gap-2 font-medium">
              <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              {notice}
            </p>
            <Button variant="secondary" size="sm" icon={ListChecks} className="mt-3 min-h-[44px]" onClick={() => onOpenCancel(contact.clientPhone.trim())}>
              Ver mis citas
            </Button>
          </div>
        ) : null}

        <div className="pt-1">
          <Button type="submit" size="lg" block loading={submitting} icon={CalendarCheck}>
            Confirmar cita
          </Button>
          <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-xs text-ink-3">
            <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            Usamos tu teléfono solo para tus citas. Tus datos quedan guardados en este dispositivo para la próxima vez.
          </p>
        </div>
      </form>
    </div>
  );
}
