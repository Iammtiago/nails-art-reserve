// Display formatting for civil dates and local times (es-VE). Dates are rendered
// through UTC so the viewer's timezone never shifts the day.

const LOCALE = 'es-VE';

const longDate = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const longDateYear = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const shortDate = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const dayMonth = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', timeZone: 'UTC' });
const monthYear = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric', timeZone: 'UTC' });
const time12 = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' });

function toUtcDate(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function capitalize(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** 2026-11-21 -> «Sábado, 21 de noviembre» */
export function formatDateLong(date, { withYear = false } = {}) {
  if (!date) return '';
  return capitalize((withYear ? longDateYear : longDate).format(toUtcDate(date)));
}

/** 2026-11-21 -> «21 nov 2026» */
export function formatDateShort(date) {
  if (!date) return '';
  return shortDate.format(toUtcDate(date)).replace(/\./g, '');
}

/** 2026-11-21 -> «21 nov» */
export function formatDayMonth(date) {
  if (!date) return '';
  return dayMonth.format(toUtcDate(date)).replace(/\./g, '');
}

/** 2026-11-01 -> «Noviembre de 2026» */
export function formatMonth(date) {
  if (!date) return '';
  return capitalize(monthYear.format(toUtcDate(date)));
}

/** '14:30' -> «2:30 p. m.» (normal spaces, safe for canvas and WhatsApp). */
export function formatTime(time) {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  return time12.format(new Date(Date.UTC(2000, 0, 1, h, m))).replace(/[  ]/g, ' ');
}

export function formatTimeRange(start, end) {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

/** 120 -> «2 h», 90 -> «1 h 30 min», 45 -> «45 min» */
export function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} h ${m} min`;
  if (h) return `${h} h`;
  return `${m} min`;
}

export function pluralize(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}
