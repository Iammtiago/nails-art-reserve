// Pure helpers for the admin calendar: visible ranges, labels, day states and the week time frame.

import { DAY_SHORT_NAMES } from '@shared/constants.js';
import { formatDateLong, formatDayMonth, formatMonth, formatTimeRange, pluralize } from '@shared/format.js';
import { daySegments, getDayConfig } from '@shared/schedule.js';
import { addDays, addMonths, startOfMonth, startOfWeek, toMinutes, toTime } from '@shared/time.js';

/** Monday-first column order (dayOfWeek values). */
export const WEEKDAY_ORDER = Object.freeze([1, 2, 3, 4, 5, 6, 0]);
export const WEEKDAY_HEADERS = Object.freeze(WEEKDAY_ORDER.map((dow) => DAY_SHORT_NAMES[dow]));

/** Month: 6 full weeks starting on the Monday on/before the 1st. Week: Monday..Sunday. */
export function calendarRange(view, base) {
  if (view === 'week') {
    const from = startOfWeek(base);
    return { from, to: addDays(from, 6) };
  }
  const from = startOfWeek(startOfMonth(base));
  return { from, to: addDays(from, 41) };
}

export function shiftAnchor(view, base, step) {
  return view === 'week' ? addDays(base, 7 * step) : addMonths(startOfMonth(base), step);
}

/** «Noviembre de 2026» or «16 – 22 nov» / «30 nov – 6 dic». */
export function periodLabel(view, base) {
  if (view !== 'week') return formatMonth(startOfMonth(base));
  const { from, to } = calendarRange('week', base);
  const start = from.slice(0, 7) === to.slice(0, 7) ? String(Number(from.slice(8))) : formatDayMonth(from);
  return `${start} – ${formatDayMonth(to)}`;
}

export function dayNumber(date) {
  return Number(date.slice(8));
}

/** 'blocked' wins over 'closed': a blocked day is shown as blocked even if it is a working day. */
export function dayState(day) {
  if (day.blocked) return 'blocked';
  if (!day.isOpen) return 'closed';
  return 'open';
}

export function occupancyPercent(day) {
  return Math.round((Number(day.occupancy) || 0) * 100);
}

export function occupancyLevel(percent) {
  if (percent >= 85) return 'high';
  if (percent >= 50) return 'mid';
  return 'low';
}

export const OCCUPANCY_BAR_CLASSES = Object.freeze({ low: 'bg-accent', mid: 'bg-primary', high: 'bg-danger' });

/** '45 %' with a non-breaking space. */
export function percentText(percent) {
  return `${percent} %`;
}

/** Open segments of that date in minutes (empty when closed). */
export function segmentsFor(workingHours, date) {
  return daySegments(getDayConfig(workingHours, date));
}

/** «Abierto · 8:30 a. m. – 12:30 p. m. y 2:00 p. m. – 7:00 p. m.» / «Cerrado» / «Bloqueado: Feriado». */
export function dayStatusText(day, workingHours) {
  if (day.blocked) return day.blockReason ? `Bloqueado: ${day.blockReason}` : 'Bloqueado';
  if (!day.isOpen) return 'Cerrado';
  const segments = segmentsFor(workingHours, day.date);
  if (!segments.length) return 'Abierto';
  return `Abierto · ${segments.map((s) => formatTimeRange(toTime(s.start), toTime(s.end))).join(' y ')}`;
}

/** Short line for the mobile agenda: «3 citas · 8:30 a. m. – 7:00 p. m.» (just the hours when empty). */
export function dayShortStatus(day, workingHours) {
  if (day.blocked) return day.blockReason ? `Bloqueado: ${day.blockReason}` : 'Bloqueado';
  if (!day.isOpen) return 'Cerrado';
  const segments = segmentsFor(workingHours, day.date);
  const count = day.appointmentsCount ? pluralize(day.appointmentsCount, 'cita', 'citas') : '';
  if (!segments.length) return count || 'Abierto';
  const hours = formatTimeRange(toTime(segments[0].start), toTime(segments[segments.length - 1].end));
  return count ? `${count} · ${hours}` : hours;
}

/** Screen-reader label for a day button. */
export function dayAriaLabel(day, isToday) {
  const parts = [formatDateLong(day.date, { withYear: true })];
  if (isToday) parts.push('hoy');
  const state = dayState(day);
  if (state === 'blocked') parts.push(day.blockReason ? `bloqueado: ${day.blockReason}` : 'bloqueado');
  else if (state === 'closed') parts.push('cerrado');
  else parts.push(`ocupación ${percentText(occupancyPercent(day))}`);
  if (day.appointmentsCount) parts.push(pluralize(day.appointmentsCount, 'cita', 'citas'));
  else if (state === 'open') parts.push('sin citas');
  return parts.join(', ');
}

/** Figures for the stats strip over the visible days. */
export function summarizeDays(days) {
  let booked = 0;
  let capacity = 0;
  let appointments = 0;
  let pending = 0;
  let blocked = 0;
  for (const day of days) {
    if (day.isOpen && !day.blocked) {
      booked += day.bookedMinutes;
      capacity += day.capacityMinutes;
    }
    appointments += day.appointmentsCount;
    if (!day.isPast) pending += day.pendingCount;
    if (day.blocked) blocked += 1;
  }
  return { booked, capacity, occupancy: capacity ? Math.round((booked / capacity) * 100) : 0, appointments, pending, blocked };
}

/** date -> appointments sorted by start time. */
export function groupByDate(appointments) {
  const map = new Map();
  for (const appointment of appointments || []) {
    if (!map.has(appointment.date)) map.set(appointment.date, []);
    map.get(appointment.date).push(appointment);
  }
  for (const list of map.values()) list.sort((a, b) => (a.timeSlot < b.timeSlot ? -1 : a.timeSlot > b.timeSlot ? 1 : 0));
  return map;
}

export function appointmentEndMinutes(appointment) {
  const start = toMinutes(appointment.timeSlot);
  const end = appointment.endTime ? toMinutes(appointment.endTime) : start + (appointment.durationMinutes || 0);
  return end > start ? end : start + (appointment.durationMinutes || 30);
}

const FRAME_STEP = 30;

/**
 * Vertical frame of the week grid in minutes: earliest open time to latest close time among
 * the open days, widened to fit any appointment, snapped to 30 minutes.
 */
export function weekFrame(days, workingHours, appointments) {
  let start = Infinity;
  let end = -Infinity;
  for (const day of days) {
    if (!day.isOpen) continue;
    const segments = segmentsFor(workingHours, day.date);
    if (!segments.length) continue;
    start = Math.min(start, segments[0].start);
    end = Math.max(end, segments[segments.length - 1].end);
  }
  for (const appointment of appointments || []) {
    start = Math.min(start, toMinutes(appointment.timeSlot));
    end = Math.max(end, appointmentEndMinutes(appointment));
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    start = 8 * 60;
    end = 18 * 60;
  }
  start = Math.max(0, Math.floor(start / FRAME_STEP) * FRAME_STEP);
  end = Math.min(24 * 60, Math.ceil(end / FRAME_STEP) * FRAME_STEP);
  if (end <= start) end = Math.min(24 * 60, start + 60);
  return { start, end, step: FRAME_STEP, slots: Math.max(1, Math.round((end - start) / FRAME_STEP)) };
}

/** Shaded spans of a day inside the frame: before opening / after closing ('off') and the break ('pause'). */
export function offHourSpans(segments, frame) {
  if (!segments.length) return [{ start: frame.start, end: frame.end, kind: 'off' }];
  const spans = [];
  let cursor = frame.start;
  segments.forEach((segment, index) => {
    if (segment.start > cursor) spans.push({ start: cursor, end: segment.start, kind: index === 0 ? 'off' : 'pause' });
    cursor = Math.max(cursor, segment.end);
  });
  if (cursor < frame.end) spans.push({ start: cursor, end: frame.end, kind: 'off' });
  return spans;
}
