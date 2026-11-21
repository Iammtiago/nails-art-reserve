import { DATE_REASON_LABELS, computeAvailability } from '../../shared/schedule.js';
import { addDays } from '../../shared/time.js';
import { unprocessable } from '../lib/errors.js';
import { Appointment } from '../models/index.js';
import { businessNow, getSettingsDoc } from './settings.service.js';

export function findActiveService(settings, serviceKey) {
  const service = (settings.services || []).find((s) => s.key === serviceKey && s.isActive);
  if (!service) throw unprocessable('Ese servicio no está disponible. Elige otro.', 'SERVICE_UNAVAILABLE');
  return service;
}

/**
 * Occupied ticks per date for appointments that hold time (confirmed or attended).
 * `excludeId` leaves one appointment out: the one being rescheduled.
 */
export async function occupiedTicksByDate({ from, to, excludeId = null }) {
  const filter = { date: { $gte: from, $lte: to }, holdsSlot: true };
  if (excludeId) filter._id = { $ne: excludeId };
  const rows = await Appointment.find(
    filter,
    { date: 1, occupiedTicks: 1, _id: 0 },
  ).lean();
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.date)) map.set(row.date, new Set());
    const set = map.get(row.date);
    for (const tick of row.occupiedTicks) set.add(tick);
  }
  return map;
}

export async function occupiedTicksOn(date, { excludeId = null } = {}) {
  const map = await occupiedTicksByDate({ from: date, to: date, excludeId });
  return map.get(date) || new Set();
}

export async function getAvailability({ date, serviceKey, excludeId = null }) {
  const settings = await getSettingsDoc();
  const service = findActiveService(settings, serviceKey);
  const now = businessNow(settings);
  const occupied = await occupiedTicksOn(date, { excludeId });
  const result = computeAvailability({ settings, date, durationMinutes: service.durationMinutes, occupied, now });
  return {
    ...result,
    reasonLabel: result.reason ? DATE_REASON_LABELS[result.reason] : null,
    service: { key: service.key, name: service.name, durationMinutes: service.durationMinutes },
    now,
  };
}

/** Status of every date in the booking window for one service (drives the public calendar). */
export async function getBookableDays({ serviceKey, excludeId = null }) {
  const settings = await getSettingsDoc();
  const service = findActiveService(settings, serviceKey);
  const now = businessNow(settings);
  const last = addDays(now.date, settings.booking.windowDays);
  const occupiedMap = await occupiedTicksByDate({ from: now.date, to: last, excludeId });

  const days = [];
  for (let date = now.date; date <= last; date = addDays(date, 1)) {
    const result = computeAvailability({
      settings,
      date,
      durationMinutes: service.durationMinutes,
      occupied: occupiedMap.get(date) || new Set(),
      now,
    });
    days.push({
      date,
      status: result.bookable ? 'available' : result.reason,
      freeSlots: result.slots.filter((s) => s.available).length,
    });
  }
  return { days, from: now.date, to: last, now, service: { key: service.key, name: service.name, durationMinutes: service.durationMinutes } };
}
