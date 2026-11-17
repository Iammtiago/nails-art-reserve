// Editable model of the Configuración page: normalization, dirty tracking,
// client validation (mirrors shared/schemas.js) and the PUT /api/settings payload.

import {
  DEFAULT_BOOKING_RULES,
  DEFAULT_THEME,
  DEFAULT_WORKING_HOURS,
  LIMITS,
  SERVICE_DURATION_OPTIONS,
  SLOT_DURATION_OPTIONS,
  TICK_MINUTES,
} from '@shared/constants.js';
import { isHex } from '@shared/color.js';
import { formatPhone, normalizePhone } from '@shared/phone.js';
import { isValidTime, toMinutes, toTime } from '@shared/time.js';

export const EDITABLE_KEYS = Object.freeze([
  'businessName',
  'phone',
  'instagramUrl',
  'logoUrl',
  'themeColors',
  'workingHours',
  'services',
  'booking',
]);

export const SECTION_LABELS = Object.freeze({
  businessName: 'Negocio',
  phone: 'Negocio',
  instagramUrl: 'Negocio',
  logoUrl: 'Logo',
  workingHours: 'Horarios',
  services: 'Servicios',
  booking: 'Reglas de reserva',
  themeColors: 'Colores',
});

export const THEME_FIELDS = Object.freeze([
  { key: 'primary', label: 'Primario', hint: 'Botones y enlaces' },
  { key: 'secondary', label: 'Secundario', hint: 'Superficies y código del ticket' },
  { key: 'accent', label: 'Acento', hint: 'Detalles y estados activos' },
  { key: 'background', label: 'Fondo', hint: 'Fondo de la página' },
  { key: 'text', label: 'Texto', hint: 'Títulos y párrafos' },
]);

const THEME_KEYS = THEME_FIELDS.map((f) => f.key);

/** Monday-first display order (dayOfWeek: 0 = domingo). */
export const WEEK_ORDER = Object.freeze([1, 2, 3, 4, 5, 6, 0]);

export const DEFAULT_LOGO = '/logo.png';

export const MIN_LEAD_OPTIONS = Object.freeze([0, 15, 30, 60, 90, 120, 180, 240, 1440]);

const INSTAGRAM_RE = /^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._]+\/?$/;
const TICK_MESSAGE = `Usa tramos de ${TICK_MINUTES} minutos (por ejemplo 8:30 o 8:45).`;

export const collapseSpaces = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

export const isTickTime = (value) => isValidTime(value) && toMinutes(value) % TICK_MINUTES === 0;

const toNumber = (value) => (value === '' || value === null || value === undefined ? Number.NaN : Number(value));

function fallbackDay(dayOfWeek) {
  return DEFAULT_WORKING_HOURS.find((d) => d.dayOfWeek === dayOfWeek);
}

function cleanDay(day) {
  return {
    dayOfWeek: day.dayOfWeek,
    isOpen: Boolean(day.isOpen),
    openTime: day.openTime || '',
    closeTime: day.closeTime || '',
    breakStart: day.breakStart || '',
    breakEnd: day.breakEnd || '',
    slotDurationMinutes: Number(day.slotDurationMinutes),
  };
}

/** Always 7 days, indexed by dayOfWeek (index 0 = domingo), so API error paths map 1:1. */
export function normalizeHours(list) {
  return [0, 1, 2, 3, 4, 5, 6].map((dow) => {
    const fallback = fallbackDay(dow);
    const day = (list || []).find((d) => d.dayOfWeek === dow) || fallback;
    return cleanDay({
      ...day,
      dayOfWeek: dow,
      openTime: day.openTime || fallback.openTime,
      closeTime: day.closeTime || fallback.closeTime,
      slotDurationMinutes: Number(day.slotDurationMinutes) || fallback.slotDurationMinutes,
    });
  });
}

function normalizeTheme(colors) {
  return Object.fromEntries(
    THEME_KEYS.map((k) => [k, isHex(colors?.[k]) ? colors[k].toUpperCase() : DEFAULT_THEME[k]]),
  );
}

/** Settings from the API -> editable draft. Services get a stable client id (cid) for React keys. */
export function toEditable(settings) {
  const s = settings || {};
  const booking = s.booking || {};
  return {
    businessName: s.businessName || '',
    phone: s.phone ? formatPhone(s.phone) : '',
    instagramUrl: s.instagramUrl || '',
    logoUrl: s.logoUrl || '',
    themeColors: normalizeTheme(s.themeColors),
    workingHours: normalizeHours(s.workingHours),
    services: (s.services || []).map((service) => ({
      cid: service.key,
      key: service.key,
      name: service.name || '',
      durationMinutes: Number(service.durationMinutes) || 60,
      isActive: service.isActive !== false,
      isNew: false,
    })),
    booking: {
      windowDays: booking.windowDays ?? DEFAULT_BOOKING_RULES.windowDays,
      minLeadMinutes: booking.minLeadMinutes ?? DEFAULT_BOOKING_RULES.minLeadMinutes,
      maxActivePerPhone: booking.maxActivePerPhone ?? DEFAULT_BOOKING_RULES.maxActivePerPhone,
    },
  };
}

let cidSeq = 0;

export function newService() {
  cidSeq += 1;
  return { cid: `nuevo-${cidSeq}`, key: '', name: '', durationMinutes: 60, isActive: true, isNew: true };
}

/** A canonical string per key, so equivalent values (e.g. the same phone typed differently) are not dirty. */
function comparable(key, value) {
  switch (key) {
    case 'businessName':
      return collapseSpaces(value);
    case 'phone':
      return normalizePhone(String(value ?? '')) || collapseSpaces(value);
    case 'instagramUrl':
      return String(value ?? '').trim();
    case 'logoUrl':
      return String(value ?? '');
    case 'themeColors':
      return THEME_KEYS.map((k) => String(value?.[k] ?? '').toUpperCase()).join('|');
    case 'workingHours':
      return JSON.stringify((value || []).map(cleanDay));
    case 'services':
      return JSON.stringify(
        (value || []).map((s) => [s.key, collapseSpaces(s.name), Number(s.durationMinutes), Boolean(s.isActive)]),
      );
    case 'booking':
      return [value?.windowDays, value?.minLeadMinutes, value?.maxActivePerPhone].map(toNumber).join('|');
    default:
      return JSON.stringify(value);
  }
}

export function dirtyKeys(draft, original) {
  return EDITABLE_KEYS.filter((key) => comparable(key, draft[key]) !== comparable(key, original[key]));
}

/** manicura + pedicura -> manicura-pedicura (max 40 chars, fallback «servicio»). */
export function slugify(text) {
  const slug = String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return slug || 'servicio';
}

export function uniqueKey(base, taken) {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, 40 - suffix.length).replace(/-+$/g, '')}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Existing services keep their key; new ones get a unique slug of their name. */
export function servicesForApi(services) {
  const taken = new Set(services.filter((s) => s.key).map((s) => s.key));
  return services.map((s) => {
    let key = s.key;
    if (!key) {
      key = uniqueKey(slugify(s.name), taken);
      taken.add(key);
    }
    return { key, name: collapseSpaces(s.name), durationMinutes: Number(s.durationMinutes), isActive: Boolean(s.isActive) };
  });
}

/** Closed days are not validated by the server, but their times must still be valid ticks. */
export function hoursForApi(hours) {
  return hours.map((day) => {
    const d = cleanDay(day);
    if (d.isOpen) return d;
    const fallback = fallbackDay(d.dayOfWeek);
    return {
      ...d,
      openTime: isTickTime(d.openTime) ? d.openTime : fallback.openTime,
      closeTime: isTickTime(d.closeTime) ? d.closeTime : fallback.closeTime,
      breakStart: isTickTime(d.breakStart) ? d.breakStart : '',
      breakEnd: isTickTime(d.breakEnd) ? d.breakEnd : '',
      slotDurationMinutes: SLOT_DURATION_OPTIONS.includes(d.slotDurationMinutes)
        ? d.slotDurationMinutes
        : fallback.slotDurationMinutes,
    };
  });
}

/** Only the changed top-level keys, in the exact shape PUT /api/settings expects. */
export function buildPayload(draft, keys) {
  const payload = {};
  for (const key of keys) {
    const value = draft[key];
    if (key === 'businessName') payload.businessName = collapseSpaces(value);
    else if (key === 'phone') payload.phone = String(value ?? '');
    else if (key === 'instagramUrl') payload.instagramUrl = String(value ?? '').trim();
    else if (key === 'logoUrl') payload.logoUrl = value || '';
    else if (key === 'themeColors')
      payload.themeColors = Object.fromEntries(THEME_KEYS.map((k) => [k, String(value[k]).toUpperCase()]));
    else if (key === 'workingHours') payload.workingHours = hoursForApi(value);
    else if (key === 'services') payload.services = servicesForApi(value);
    else if (key === 'booking')
      payload.booking = {
        windowDays: Number(value.windowDays),
        minLeadMinutes: Number(value.minLeadMinutes),
        maxActivePerPhone: Number(value.maxActivePerPhone),
      };
  }
  return payload;
}

function validateDay(day, index, add) {
  if (!day.isOpen) return;
  const base = `workingHours.${index}`;
  const openOk = isTickTime(day.openTime);
  const closeOk = isTickTime(day.closeTime);
  if (!isValidTime(day.openTime)) add(`${base}.openTime`, 'Indica la hora de apertura.');
  else if (!openOk) add(`${base}.openTime`, TICK_MESSAGE);
  if (!isValidTime(day.closeTime)) add(`${base}.closeTime`, 'Indica la hora de cierre.');
  else if (!closeOk) add(`${base}.closeTime`, TICK_MESSAGE);
  if (!SLOT_DURATION_OPTIONS.includes(Number(day.slotDurationMinutes)))
    add(`${base}.slotDurationMinutes`, 'Elige cada cuánto empiezan las citas.');
  if (!openOk || !closeOk) return;

  const open = toMinutes(day.openTime);
  const close = toMinutes(day.closeTime);
  if (close <= open) {
    add(`${base}.closeTime`, 'El cierre debe ser después de la apertura.');
    return;
  }

  const hasStart = Boolean(day.breakStart);
  const hasEnd = Boolean(day.breakEnd);
  if (hasStart !== hasEnd) {
    add(hasStart ? `${base}.breakEnd` : `${base}.breakStart`, 'Indica inicio y fin de la pausa, o activa «Sin pausa».');
    return;
  }
  if (!hasStart) return;
  if (!isTickTime(day.breakStart)) add(`${base}.breakStart`, TICK_MESSAGE);
  if (!isTickTime(day.breakEnd)) add(`${base}.breakEnd`, TICK_MESSAGE);
  if (!isTickTime(day.breakStart) || !isTickTime(day.breakEnd)) return;
  const bs = toMinutes(day.breakStart);
  const be = toMinutes(day.breakEnd);
  if (be <= bs) add(`${base}.breakEnd`, 'La pausa debe terminar después de empezar.');
  else if (bs <= open || be >= close) add(`${base}.breakStart`, 'La pausa debe quedar dentro del horario.');
}

function intInRange(value, min, max) {
  const n = toNumber(value);
  return Number.isInteger(n) && n >= min && n <= max;
}

/** Live client-side validation. Returns { 'workingHours.1.breakEnd': message, … } (same paths as the API). */
export function validateDraft(draft) {
  const errors = {};
  const add = (path, message) => {
    if (!errors[path]) errors[path] = message;
  };

  const name = collapseSpaces(draft.businessName);
  if (name.length < 2) add('businessName', 'Escribe el nombre del salón (mínimo 2 caracteres).');
  else if (name.length > LIMITS.businessNameMax) add('businessName', `Máximo ${LIMITS.businessNameMax} caracteres.`);

  const phone = String(draft.phone ?? '').trim();
  if (!phone) add('phone', 'Escribe el WhatsApp del salón.');
  else if (!normalizePhone(phone)) add('phone', 'Revisa el número: por ejemplo 0414 123 4567 o +58 414 123 4567.');

  const instagram = String(draft.instagramUrl ?? '').trim();
  if (instagram && !INSTAGRAM_RE.test(instagram))
    add('instagramUrl', 'Usa el enlace del perfil: https://www.instagram.com/usuario');

  if (String(draft.logoUrl ?? '').length > LIMITS.logoDataUrlMaxChars)
    add('logoUrl', 'El logo pesa demasiado. Sube una imagen más liviana.');

  for (const key of THEME_KEYS) {
    if (!isHex(draft.themeColors?.[key])) add(`themeColors.${key}`, 'Usa un color en formato #RRGGBB.');
  }

  (draft.workingHours || []).forEach((day, index) => validateDay(day, index, add));

  const services = draft.services || [];
  if (!services.length) add('services', 'Debe haber al menos un servicio.');
  else if (!services.some((s) => s.isActive)) add('services', 'Deja al menos un servicio activo.');
  if (services.length > LIMITS.servicesMax) add('services', `Máximo ${LIMITS.servicesMax} servicios.`);
  const seenNames = new Map();
  services.forEach((s, index) => {
    const serviceName = collapseSpaces(s.name);
    if (serviceName.length < 2) add(`services.${index}.name`, 'Escribe el nombre del servicio (mínimo 2 caracteres).');
    else if (serviceName.length > LIMITS.serviceNameMax)
      add(`services.${index}.name`, `Máximo ${LIMITS.serviceNameMax} caracteres.`);
    else {
      const normalized = serviceName.toLocaleLowerCase('es');
      if (seenNames.has(normalized)) add(`services.${index}.name`, 'Ya hay un servicio con ese nombre.');
      else seenNames.set(normalized, index);
    }
    if (!SERVICE_DURATION_OPTIONS.includes(Number(s.durationMinutes)))
      add(`services.${index}.durationMinutes`, 'Elige una duración de la lista.');
  });

  const booking = draft.booking || {};
  if (!intInRange(booking.windowDays, 1, LIMITS.bookingWindowMaxDays))
    add('booking.windowDays', `Elige entre 1 y ${LIMITS.bookingWindowMaxDays} días.`);
  if (!intInRange(booking.minLeadMinutes, 0, 1440)) add('booking.minLeadMinutes', 'Elige una antelación de la lista.');
  if (!intInRange(booking.maxActivePerPhone, 1, LIMITS.maxActivePerPhoneMax))
    add('booking.maxActivePerPhone', `Elige entre 1 y ${LIMITS.maxActivePerPhoneMax} citas.`);

  return errors;
}

/** API 422 details -> inline error map. A service key error is shown on its name (the key comes from it). */
export function mapServerErrors(details) {
  const map = {};
  for (const detail of details || []) {
    if (!detail?.message) continue;
    let path = String(detail.path || '');
    path = path
      .replace(/^services\.(\d+)\.key$/, 'services.$1.name')
      .replace(/^(workingHours|services)\.\d+$/, '$1')
      .replace(/^(themeColors|booking)\.(\w+)\..*$/, '$1.$2');
    if (!path) path = '_form';
    if (!map[path]) map[path] = detail.message;
  }
  return map;
}

/** Drops the errors that belong to one top-level key (after the user edits it). */
export function dropErrorsFor(errors, key) {
  const next = {};
  let changed = false;
  for (const [path, message] of Object.entries(errors)) {
    if (path === key || path.startsWith(`${key}.`) || path === '_form') changed = true;
    else next[path] = message;
  }
  return changed ? next : errors;
}

/** Valid colors for the live preview: falls back to the saved palette while a hex is half typed. */
export function safeTheme(colors, fallback = DEFAULT_THEME) {
  return Object.fromEntries(
    THEME_KEYS.map((k) => [k, isHex(colors?.[k]) ? colors[k].toUpperCase() : isHex(fallback?.[k]) ? fallback[k] : DEFAULT_THEME[k]]),
  );
}

export function sameTheme(a, b) {
  return THEME_KEYS.every((k) => String(a?.[k] ?? '').toUpperCase() === String(b?.[k] ?? '').toUpperCase());
}

/** A sensible lunch break inside the day's hours, used when «Sin pausa» is turned off. */
export function suggestBreak(day) {
  if (isTickTime(day.openTime) && isTickTime(day.closeTime)) {
    const open = toMinutes(day.openTime);
    const close = toMinutes(day.closeTime);
    if (open < toMinutes('12:30') && close > toMinutes('14:00')) return { breakStart: '12:30', breakEnd: '14:00' };
    if (close - open >= 3 * TICK_MINUTES) {
      const start = open + Math.max(1, Math.floor((close - open) / 2 / TICK_MINUTES)) * TICK_MINUTES;
      const end = Math.min(start + 60, close - TICK_MINUTES);
      if (end > start) return { breakStart: toTime(start), breakEnd: toTime(end) };
    }
  }
  return { breakStart: '12:30', breakEnd: '14:00' };
}
