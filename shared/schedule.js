// Pure availability engine shared by the API and the UI.
// A day has up to two segments (before and after the break). Start times step by the
// day's fixed block from the start of each segment; a service is offered only if it
// fits whole inside one segment and none of its 15-minute ticks is occupied.

import { TICK_MINUTES } from './constants.js';
import { diffDays, dayOfWeek, isValidTime, toMinutes, toTime } from './time.js';

export function getDayConfig(workingHours, date) {
  const dow = dayOfWeek(date);
  return (workingHours || []).find((d) => d.dayOfWeek === dow) || null;
}

/** Open segments of a day in minutes: [{ start, end }]. */
export function daySegments(day) {
  if (!day || !day.isOpen || !isValidTime(day.openTime) || !isValidTime(day.closeTime)) return [];
  const open = toMinutes(day.openTime);
  const close = toMinutes(day.closeTime);
  if (close <= open) return [];

  const hasBreak =
    isValidTime(day.breakStart) && isValidTime(day.breakEnd) && toMinutes(day.breakStart) < toMinutes(day.breakEnd);
  if (!hasBreak) return [{ start: open, end: close }];

  const breakStart = Math.min(Math.max(toMinutes(day.breakStart), open), close);
  const breakEnd = Math.min(Math.max(toMinutes(day.breakEnd), open), close);
  return [
    { start: open, end: breakStart },
    { start: breakEnd, end: close },
  ].filter((s) => s.end > s.start);
}

/** Total bookable minutes of a day (used for occupancy in the admin calendar). */
export function dayCapacityMinutes(day) {
  return daySegments(day).reduce((sum, s) => sum + (s.end - s.start), 0);
}

/** 15-minute ticks covered by [start, start + duration), as 'HH:mm'. */
export function ticksFor(startMinutes, durationMinutes) {
  const ticks = [];
  for (let t = startMinutes; t < startMinutes + durationMinutes; t += TICK_MINUTES) ticks.push(toTime(t));
  return ticks;
}

/** Candidate start minutes for a service duration on a given day. */
export function candidateStarts(day, durationMinutes) {
  const step = Number(day?.slotDurationMinutes) || 60;
  const starts = [];
  for (const segment of daySegments(day)) {
    for (let t = segment.start; t + durationMinutes <= segment.end; t += step) starts.push(t);
  }
  return starts;
}

/**
 * Decides whether a date can take bookings at all.
 * @returns {{ bookable: boolean, reason: null|'past'|'out_of_window'|'blocked'|'closed', day: object|null }}
 */
export function evaluateDate({ settings, date, now }) {
  const day = getDayConfig(settings.workingHours, date);
  const ahead = diffDays(now.date, date);
  if (ahead < 0) return { bookable: false, reason: 'past', day };
  if (ahead > (settings.booking?.windowDays ?? 30)) return { bookable: false, reason: 'out_of_window', day };
  if ((settings.blockedDates || []).some((b) => b.date === date)) return { bookable: false, reason: 'blocked', day };
  if (daySegments(day).length === 0) return { bookable: false, reason: 'closed', day };
  return { bookable: true, reason: null, day };
}

/**
 * Start times for a service on a date.
 * Past starts (or inside the minimum lead time) are omitted; taken starts are
 * returned with available=false so the UI can show them greyed out.
 *
 * @param {object} p
 * @param {object} p.settings  settings document (workingHours, booking, blockedDates)
 * @param {string} p.date      'YYYY-MM-DD'
 * @param {number} p.durationMinutes
 * @param {Set<string>} p.occupied  occupied ticks 'HH:mm' on that date
 * @param {{date: string, minutes: number}} p.now  current civil date/minutes in the business timezone
 */
export function computeAvailability({ settings, date, durationMinutes, occupied, now }) {
  const verdict = evaluateDate({ settings, date, now });
  if (!verdict.bookable) return { date, bookable: false, reason: verdict.reason, slots: [] };

  const minLead = settings.booking?.minLeadMinutes ?? 0;
  const earliest = date === now.date ? now.minutes + minLead : -Infinity;

  const slots = candidateStarts(verdict.day, durationMinutes)
    .filter((start) => start >= earliest)
    .map((start) => {
      const ticks = ticksFor(start, durationMinutes);
      return {
        time: toTime(start),
        endTime: toTime(start + durationMinutes),
        available: ticks.every((t) => !occupied.has(t)),
      };
    });

  const anyFree = slots.some((s) => s.available);
  return { date, bookable: anyFree, reason: anyFree ? null : 'full', slots };
}

/** Is `time` a valid, free start for this service right now? Returns the slot or a reason. */
export function checkSlot({ settings, date, time, durationMinutes, occupied, now }) {
  const result = computeAvailability({ settings, date, durationMinutes, occupied, now });
  const slot = result.slots.find((s) => s.time === time);
  if (slot?.available) return { ok: true, slot };
  if (slot) return { ok: false, reason: 'taken' };
  if (!result.bookable && result.reason && result.reason !== 'full') return { ok: false, reason: result.reason };
  return { ok: false, reason: 'invalid_time' };
}

export const DATE_REASON_LABELS = Object.freeze({
  past: 'Esa fecha ya pasó.',
  out_of_window: 'Esa fecha está fuera del rango de reservas.',
  blocked: 'Ese día el salón no atiende.',
  closed: 'Ese día el salón está cerrado.',
  full: 'Ese día ya no quedan horarios libres.',
});
