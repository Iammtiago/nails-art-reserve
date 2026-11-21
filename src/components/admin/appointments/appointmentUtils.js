// Small display helpers shared by the Citas list, the detail modal and the calendar.

import { DEFAULT_TIMEZONE } from '@shared/constants.js';
import { formatDayMonth, formatWeekdayDayMonth } from '@shared/format.js';
import { clientContactText, whatsappLink } from '@shared/whatsapp.js';

/** «Hoy» when the date is the business' today, otherwise «21 nov». */
export function dateLabel(date, today) {
  if (!date) return '';
  return today && date === today ? 'Hoy' : formatDayMonth(date);
}

/** Date in the Citas list: «Hoy · Vie 20 nov» or «Sáb 21 nov» (the weekday helps to read it fast). */
export function agendaDateLabel(date, today) {
  if (!date) return '';
  const label = formatWeekdayDayMonth(date);
  return today && date === today ? `Hoy · ${label}` : label;
}

export function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || '';
}

/** ISO instant (createdAt, cancelledAt…) in the salon's timezone: «16 nov 2026, 10:42 a. m.». */
export function formatInstant(value, timezone) {
  if (!value) return '';
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return '';
  const options = { timeZone: timezone || DEFAULT_TIMEZONE, dateStyle: 'medium', timeStyle: 'short' };
  try {
    return instant.toLocaleString('es-VE', options);
  } catch {
    return instant.toLocaleString('es-VE', { ...options, timeZone: DEFAULT_TIMEZONE });
  }
}

const CANCELLED_BY = { client: 'la clienta', admin: 'la manicurista' };

export function cancelledByLabel(by) {
  return CANCELLED_BY[by] || '';
}

/** Prefilled wa.me link for the salon to write to the client about this appointment. */
export function contactHref(appointment, businessName) {
  return whatsappLink(
    appointment.clientPhone,
    clientContactText({
      businessName: businessName || 'Nails Art',
      clientName: appointment.clientName,
      serviceName: appointment.serviceName,
      date: appointment.date,
      time: appointment.timeSlot,
    }),
  );
}

/** Entrance delay for staggered lists, capped at 300 ms. */
export function staggerDelay(index, step = 40) {
  return `${Math.min(Math.max(index, 0) * step, 300)}ms`;
}
