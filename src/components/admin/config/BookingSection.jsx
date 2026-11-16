'use client';

import { CalendarClock } from 'lucide-react';
import { LIMITS } from '@shared/constants.js';
import { formatDuration } from '@shared/format.js';
import { Field, Input, Select } from '@/components/ui/Field';
import { ConfigCard } from './ConfigCard';
import { MIN_LEAD_OPTIONS } from './configModel';

function leadLabel(minutes) {
  if (minutes === 0) return 'Sin mínimo';
  if (minutes === 1440) return '1 día';
  return formatDuration(minutes);
}

export function BookingSection({ booking, errors, onChange, delay, className = '' }) {
  const set = (field, value) => onChange((current) => ({ ...current, [field]: value }));
  const lead = Number(booking.minLeadMinutes);

  return (
    <ConfigCard
      id="reglas"
      icon={CalendarClock}
      title="Reglas de reserva"
      description="Cuándo y cuánto pueden reservar tus clientas desde la página."
      delay={delay}
      className={className}
    >
      <div className="space-y-4">
        <Field
          label="Días de anticipación máxima"
          required
          error={errors['booking.windowDays']}
          hint={`Hasta cuántos días adelante se puede reservar (1 a ${LIMITS.bookingWindowMaxDays}).`}
        >
          {(p) => (
            <Input
              {...p}
              type="number"
              inputMode="numeric"
              min={1}
              max={LIMITS.bookingWindowMaxDays}
              step={1}
              value={booking.windowDays}
              onChange={(event) => set('windowDays', event.target.value)}
              className="tabular-nums"
            />
          )}
        </Field>

        <Field
          label="Antelación mínima para reservar hoy"
          error={errors['booking.minLeadMinutes']}
          hint="Para el mismo día, solo se muestran horarios que empiecen después de este margen."
        >
          {(p) => (
            <Select {...p} value={lead} onChange={(event) => set('minLeadMinutes', Number(event.target.value))}>
              {MIN_LEAD_OPTIONS.includes(lead) || !Number.isFinite(lead) ? null : <option value={lead}>{leadLabel(lead)}</option>}
              {MIN_LEAD_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {leadLabel(minutes)}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field
          label="Citas activas por teléfono"
          required
          error={errors['booking.maxActivePerPhone']}
          hint={`Cuántas citas pendientes puede tener una misma clienta (1 a ${LIMITS.maxActivePerPhoneMax}).`}
        >
          {(p) => (
            <Input
              {...p}
              type="number"
              inputMode="numeric"
              min={1}
              max={LIMITS.maxActivePerPhoneMax}
              step={1}
              value={booking.maxActivePerPhone}
              onChange={(event) => set('maxActivePerPhone', event.target.value)}
              className="tabular-nums"
            />
          )}
        </Field>
      </div>
    </ConfigCard>
  );
}
