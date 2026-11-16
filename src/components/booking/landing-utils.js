// Pure helpers for the public landing (open/closed status, sample ticket art).

import { DAY_NAMES } from '@shared/constants.js';
import { formatTime } from '@shared/format.js';
import { getDayConfig, daySegments } from '@shared/schedule.js';
import { addDays, dayOfWeek, toTime } from '@shared/time.js';

/** tel: link for digits stored with country code (584147368595 -> tel:+584147368595). */
export function telLink(phoneDigits) {
  const digits = String(phoneDigits || '').replace(/\D/g, '');
  return digits ? `tel:+${digits}` : '';
}

function segmentsOn(settings, date) {
  if ((settings.blockedDates || []).some((b) => b.date === date)) return [];
  return daySegments(getDayConfig(settings.workingHours, date));
}

/**
 * Live status of the salon from the server's «now» (business timezone):
 * { open: boolean, tone: 'open'|'break'|'closed', label: string } or null when there is no schedule.
 */
export function openStatus(settings) {
  const now = settings?.now;
  if (!now?.date || typeof now.minutes !== 'number') return null;

  const today = segmentsOn(settings, now.date);
  const current = today.find((s) => now.minutes >= s.start && now.minutes < s.end);
  if (current) return { open: true, tone: 'open', label: `Abierto ahora · hasta las ${formatTime(toTime(current.end))}` };

  const laterToday = today.find((s) => s.start > now.minutes);
  if (laterToday) {
    const inBreak = today.some((s) => s.end <= now.minutes);
    return {
      open: false,
      tone: inBreak ? 'break' : 'closed',
      label: `${inBreak ? 'En pausa' : 'Cerrado ahora'} · abre hoy a las ${formatTime(toTime(laterToday.start))}`,
    };
  }

  for (let ahead = 1; ahead <= 14; ahead += 1) {
    const date = addDays(now.date, ahead);
    const first = segmentsOn(settings, date)[0];
    if (first) {
      const day = ahead === 1 ? 'mañana' : `el ${DAY_NAMES[dayOfWeek(date)].toLowerCase()}`;
      return { open: false, tone: 'closed', label: `Cerrado ahora · abre ${day} a las ${formatTime(toTime(first.start))}` };
    }
  }
  return { open: false, tone: 'closed', label: 'Cerrado por ahora' };
}

/** Day of week (0 = domingo) of the business «today», for highlighting the schedule. */
export function todayDow(settings) {
  return settings?.now?.date ? dayOfWeek(settings.now.date) : null;
}

/**
 * Decorative QR-like grid for the sample ticket (deterministic, so server and client match).
 * Returns the dark cells of a size×size grid as [x, y] pairs.
 */
export function sampleQrCells(size = 21, seed = 7) {
  let state = seed;
  const random = () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
  const finder = (x, y) => {
    for (const [ox, oy] of [[0, 0], [size - 7, 0], [0, size - 7]]) {
      const dx = x - ox;
      const dy = y - oy;
      if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7) {
        const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
        return ring === 3 || ring <= 1 ? 'dark' : 'light';
      }
      if (dx >= -1 && dx <= 7 && dy >= -1 && dy <= 7) return 'light';
    }
    return null;
  };
  const cells = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const fixed = finder(x, y);
      if (fixed === 'dark' || (fixed === null && random() > 0.52)) cells.push([x, y]);
    }
  }
  return cells;
}
