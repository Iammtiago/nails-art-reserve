// Civil date and local time helpers. Dates travel as 'YYYY-MM-DD' strings and
// times as 'HH:mm' strings end to end; they are never converted to instants.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(value) {
  return typeof value === 'string' && TIME_RE.test(value);
}

export function isValidDate(value) {
  if (typeof value !== 'string') return false;
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

/** 'HH:mm' -> minutes since midnight. */
export function toMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** minutes since midnight -> 'HH:mm'. */
export function toTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function parts(date) {
  const [y, m, d] = date.split('-').map(Number);
  return { y, m, d };
}

/** Day of week of a civil date (0 = Sunday). Uses UTC so the host timezone never shifts it. */
export function dayOfWeek(date) {
  const { y, m, d } = parts(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(date, days) {
  const { y, m, d } = parts(date);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

/** Whole days from a to b (b - a). */
export function diffDays(a, b) {
  const pa = parts(a);
  const pb = parts(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86_400_000);
}

export function compareDates(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function startOfMonth(date) {
  return `${date.slice(0, 7)}-01`;
}

export function daysInMonth(date) {
  const { y, m } = parts(date);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addMonths(date, months) {
  const { y, m } = parts(date);
  const next = new Date(Date.UTC(y, m - 1 + months, 1));
  return next.toISOString().slice(0, 10);
}

/** Monday-based start of week for a civil date. */
export function startOfWeek(date) {
  const dow = dayOfWeek(date);
  const offset = dow === 0 ? -6 : 1 - dow;
  return addDays(date, offset);
}

/**
 * Current civil date and minutes in a timezone. `instant` is injectable for tests.
 * @returns {{ date: string, minutes: number, time: string }}
 */
export function nowInTimezone(timezone, instant = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const map = Object.fromEntries(formatter.formatToParts(instant).map((p) => [p.type, p.value]));
  const date = `${map.year}-${map.month}-${map.day}`;
  const minutes = Number(map.hour) * 60 + Number(map.minute);
  return { date, minutes, time: toTime(minutes) };
}

const TYPED_RE = /^(\d{1,2})(?:\s*[:.h]\s*(\d{2})|(\d{2}))?\s*(?:([ap])\.?\s*m?\.?)?$/i;

/**
 * Reads a time typed by hand: «5:30», «6.45», «530», «17:30», «5:30 pm».
 * `meridiem` ('am' | 'pm') applies to 1-12 when the text has no a. m./p. m. of its own.
 * @returns {string|null} 'HH:mm', or null when it is not a time.
 */
export function parseTypedTime(text, meridiem = 'pm') {
  const match = TYPED_RE.exec(String(text ?? '').trim());
  if (!match) return null;
  let h = Number(match[1]);
  const m = Number(match[2] ?? match[3] ?? 0);
  const suffix = match[4]?.toLowerCase();
  if (h > 23 || m > 59) return null;
  if (suffix && (h === 0 || h > 12)) return null;
  const half = suffix ? `${suffix}m` : meridiem;
  if (h >= 1 && h <= 12) {
    if (half === 'am' && h === 12) h = 0;
    else if (half === 'pm' && h < 12) h += 12;
  }
  return toTime(h * 60 + m);
}

/** a. m. or p. m. a salon most likely means for a bare 1-12 hour: 7-11 in the morning, the rest after noon. */
export function guessMeridiem(text) {
  const h = Number(/^\s*(\d{1,2})/.exec(String(text ?? ''))?.[1]);
  return h >= 7 && h <= 11 ? 'am' : 'pm';
}
