// Small pure helpers for the public booking portal.

import { Footprints, Gem, Hand, Sparkles } from 'lucide-react';
import { DAY_SHORT_NAMES } from '@shared/constants.js';
import { formatTimeRange } from '@shared/format.js';
import { daySegments } from '@shared/schedule.js';
import { toMinutes, toTime } from '@shared/time.js';

/** 'https://www.instagram.com/nailsart.sc' -> '@nailsart.sc' ('' when it cannot be read). */
export function instagramHandle(url) {
  if (!url) return '';
  const match = /instagram\.com\/([A-Za-z0-9._]+)/i.exec(String(url));
  return match ? `@${match[1]}` : '';
}

/** Icon for a service card, guessed from its key and name. */
export function serviceIcon(service) {
  const text = `${service?.key || ''} ${service?.name || ''}`.toLowerCase();
  const mani = text.includes('manicur');
  const pedi = text.includes('pedicur');
  if (mani && pedi) return Gem;
  if (mani) return Sparkles;
  if (pedi) return Footprints;
  return Hand;
}

/** First word of a full name. */
export function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || '';
}

/** Morning (< 12:00) and afternoon groups of availability slots. */
export function groupSlots(slots) {
  const morning = [];
  const afternoon = [];
  for (const slot of slots || []) (toMinutes(slot.time) < 720 ? morning : afternoon).push(slot);
  return [
    { key: 'morning', label: 'Mañana', slots: morning },
    { key: 'afternoon', label: 'Tarde', slots: afternoon },
  ].filter((group) => group.slots.length > 0);
}

const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

function dayRanges(day) {
  return daySegments(day).map((s) => formatTimeRange(toTime(s.start), toTime(s.end)));
}

function groupLabel(days) {
  const first = DAY_SHORT_NAMES[days[0]];
  if (days.length === 1) return first;
  const last = DAY_SHORT_NAMES[days[days.length - 1]];
  return days.length === 2 ? `${first} y ${last}` : `${first} a ${last}`;
}

/**
 * Compact opening hours, Monday first, consecutive days with identical hours grouped:
 * [{ days: 'Lun a Sáb', ranges: ['8:30 a. m. – 12:30 p. m.', '2:00 p. m. – 7:00 p. m.'], closed: false },
 *  { days: 'Dom', ranges: [], closed: true }]
 */
export function summarizeWorkingHours(workingHours) {
  const byDay = new Map((workingHours || []).map((d) => [d.dayOfWeek, d]));
  const groups = [];
  for (const dow of MONDAY_FIRST) {
    const ranges = dayRanges(byDay.get(dow));
    const signature = ranges.join('|');
    const last = groups[groups.length - 1];
    if (last && last.signature === signature) last.days.push(dow);
    else groups.push({ days: [dow], ranges, signature });
  }
  return groups.map((g) => ({ key: g.days.join('-'), days: groupLabel(g.days), ranges: g.ranges, closed: g.ranges.length === 0 }));
}
