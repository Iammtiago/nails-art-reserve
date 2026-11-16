// zod schemas shared by the API (authoritative) and the UI (early feedback).

import { z } from 'zod';
import {
  BOOKING_CODE_REGEX,
  LIMITS,
  SERVICE_DURATION_OPTIONS,
  SLOT_DURATION_OPTIONS,
  TICK_MINUTES,
} from './constants.js';
import { normalizePhone } from './phone.js';
import { diffDays, isValidDate, isValidTime, toMinutes } from './time.js';

// ---------- primitives ----------

export const dateString = z.string({ error: 'Indica una fecha.' }).refine(isValidDate, 'Fecha inválida (AAAA-MM-DD).');

export const timeString = z.string({ error: 'Indica una hora.' }).refine(isValidTime, 'Hora inválida (HH:mm).');

const onTick = (t) => toMinutes(t) % TICK_MINUTES === 0;
const tickTime = timeString.refine(onTick, `La hora debe ir en tramos de ${TICK_MINUTES} minutos.`);
const optionalTickTime = z.union([z.literal(''), tickTime]);

export const slug = z
  .string({ error: 'Indica el servicio.' })
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Identificador inválido.')
  .max(40, 'Identificador demasiado largo.');

export const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Usa un color en formato #RRGGBB.')
  .transform((v) => v.toUpperCase());

export const phoneField = z
  .string({ error: 'Escribe tu número de teléfono.' })
  .trim()
  .min(1, 'Escribe tu número de teléfono.')
  .max(25, 'El teléfono es demasiado largo.')
  .transform((value, ctx) => {
    const normalized = normalizePhone(value);
    if (!normalized) {
      ctx.addIssue({ code: 'custom', message: 'Revisa el número: por ejemplo 0414 123 4567 o +57 300 123 4567.' });
      return z.NEVER;
    }
    return normalized;
  });

export const clientNameField = z
  .string({ error: 'Escribe tu nombre completo.' })
  .transform((v) => v.replace(/\s+/g, ' ').trim())
  .pipe(
    z
      .string()
      .min(LIMITS.clientNameMin, 'Escribe tu nombre completo.')
      .max(LIMITS.clientNameMax, 'El nombre es demasiado largo.')
      .regex(/^[\p{L}\p{M}][\p{L}\p{M}' .-]*$/u, 'Usa solo letras en el nombre.'),
  );

export const bookingCodeField = z
  .string({ error: 'Escribe el código.' })
  .trim()
  .transform((v) => v.toUpperCase())
  .pipe(z.string().regex(BOOKING_CODE_REGEX, 'El código tiene 6 caracteres (letras y números).'));

const objectIdString = z.string().regex(/^[a-f0-9]{24}$/i, 'Identificador inválido.');

const pageParam = z.coerce.number().int().min(1).max(10_000).default(1);
const limitParam = z.coerce.number().int().min(1).max(LIMITS.pageSizeMax).default(20);
const searchParam = z.string().trim().max(60, 'Búsqueda demasiado larga.').default('');

// ---------- public booking ----------

export const availabilityQuerySchema = z.object({
  date: dateString,
  service: slug,
});

export const daysQuerySchema = z.object({
  service: slug,
});

export const createAppointmentSchema = z.strictObject({
  serviceKey: slug,
  date: dateString,
  timeSlot: timeString,
  clientName: clientNameField,
  clientPhone: phoneField,
  // Honeypot: real people never see or fill this field.
  website: z.string().max(0, 'Solicitud no válida.').optional().default(''),
});

export const phoneParamSchema = z.object({ phone: phoneField });

export const cancelByClientSchema = z.strictObject({ phone: phoneField });

export const idParamSchema = z.object({ id: objectIdString });

export const verifySchema = z.strictObject({
  code: bookingCodeField,
  markAttended: z.boolean().optional().default(false),
});

// ---------- admin auth ----------

export const usernameField = z
  .string({ error: 'Escribe el usuario.' })
  .trim()
  .toLowerCase()
  .min(3, 'El usuario necesita al menos 3 caracteres.')
  .max(40, 'El usuario es demasiado largo.')
  .regex(/^[a-z0-9._-]+$/, 'Usa letras sin acentos, números, punto, guion o guion bajo.');

export const passwordField = z
  .string({ error: 'Escribe la contraseña.' })
  .min(10, 'La contraseña necesita al menos 10 caracteres.')
  .max(128, 'La contraseña es demasiado larga.');

export const loginSchema = z.strictObject({
  username: usernameField,
  password: z.string({ error: 'Escribe la contraseña.' }).min(1, 'Escribe la contraseña.').max(128),
});

export const setupSchema = z
  .strictObject({
    setupKey: z.string({ error: 'Escribe la clave de instalación.' }).min(1, 'Escribe la clave de instalación.').max(200),
    username: usernameField,
    password: passwordField,
    passwordConfirm: z.string().max(128),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    message: 'Las contraseñas no coinciden.',
    path: ['passwordConfirm'],
  });

// ---------- admin lists ----------

export const ADMIN_VIEWS = ['today', 'upcoming', 'completed', 'cancelled', 'all'];

export const adminAppointmentsQuerySchema = z.object({
  view: z.enum(ADMIN_VIEWS).default('upcoming'),
  date: z.union([z.literal(''), dateString]).optional().default(''),
  q: searchParam,
  page: pageParam,
  limit: limitParam,
});

export const adminClientsQuerySchema = z.object({
  q: searchParam,
  page: pageParam,
  limit: limitParam,
});

export const calendarQuerySchema = z
  .object({ from: dateString, to: dateString })
  .refine((v) => diffDays(v.from, v.to) >= 0, { message: 'El rango está invertido.', path: ['to'] })
  .refine((v) => diffDays(v.from, v.to) <= LIMITS.calendarRangeMaxDays, {
    message: `El rango máximo es de ${LIMITS.calendarRangeMaxDays} días.`,
    path: ['to'],
  });

export const blockDateSchema = z.strictObject({
  date: dateString,
  reason: z.string().trim().max(LIMITS.blockReasonMax, 'Motivo demasiado largo.').optional().default(''),
});

export const dateParamSchema = z.object({ date: dateString });

// ---------- settings ----------

export const workingDaySchema = z
  .strictObject({
    dayOfWeek: z.number().int().min(0).max(6),
    isOpen: z.boolean(),
    openTime: tickTime,
    closeTime: tickTime,
    breakStart: optionalTickTime.default(''),
    breakEnd: optionalTickTime.default(''),
    slotDurationMinutes: z
      .number()
      .int()
      .refine((v) => SLOT_DURATION_OPTIONS.includes(v), 'Bloque no permitido.'),
  })
  .superRefine((day, ctx) => {
    if (!day.isOpen) return;
    const open = toMinutes(day.openTime);
    const close = toMinutes(day.closeTime);
    if (close <= open) {
      ctx.addIssue({ code: 'custom', path: ['closeTime'], message: 'El cierre debe ser después de la apertura.' });
      return;
    }
    const hasStart = Boolean(day.breakStart);
    const hasEnd = Boolean(day.breakEnd);
    if (hasStart !== hasEnd) {
      ctx.addIssue({ code: 'custom', path: ['breakEnd'], message: 'Indica inicio y fin de la pausa, o deja ambos vacíos.' });
      return;
    }
    if (hasStart) {
      const bs = toMinutes(day.breakStart);
      const be = toMinutes(day.breakEnd);
      if (be <= bs) ctx.addIssue({ code: 'custom', path: ['breakEnd'], message: 'La pausa debe terminar después de empezar.' });
      if (bs <= open || be >= close)
        ctx.addIssue({ code: 'custom', path: ['breakStart'], message: 'La pausa debe quedar dentro del horario.' });
    }
  });

export const serviceSchema = z.strictObject({
  key: slug,
  name: z
    .string({ error: 'Escribe el nombre del servicio.' })
    .transform((v) => v.replace(/\s+/g, ' ').trim())
    .pipe(z.string().min(2, 'Nombre demasiado corto.').max(LIMITS.serviceNameMax, 'Nombre demasiado largo.')),
  durationMinutes: z
    .number()
    .int()
    .refine((v) => SERVICE_DURATION_OPTIONS.includes(v), 'Duración no permitida.'),
  isActive: z.boolean(),
});

export const servicesSchema = z
  .array(serviceSchema)
  .min(1, 'Debe haber al menos un servicio.')
  .max(LIMITS.servicesMax, `Máximo ${LIMITS.servicesMax} servicios.`)
  .superRefine((list, ctx) => {
    const seen = new Set();
    list.forEach((s, i) => {
      if (seen.has(s.key)) ctx.addIssue({ code: 'custom', path: [i, 'key'], message: 'Servicio repetido.' });
      seen.add(s.key);
    });
    if (!list.some((s) => s.isActive))
      ctx.addIssue({ code: 'custom', path: [], message: 'Deja al menos un servicio activo.' });
  });

export const workingHoursSchema = z
  .array(workingDaySchema)
  .length(7, 'Faltan días en el horario.')
  .superRefine((list, ctx) => {
    const days = new Set(list.map((d) => d.dayOfWeek));
    if (days.size !== 7) ctx.addIssue({ code: 'custom', path: [], message: 'Cada día de la semana debe aparecer una vez.' });
  });

export const bookingRulesSchema = z.strictObject({
  windowDays: z.number().int().min(1).max(LIMITS.bookingWindowMaxDays),
  minLeadMinutes: z.number().int().min(0).max(1440),
  maxActivePerPhone: z.number().int().min(1).max(LIMITS.maxActivePerPhoneMax),
});

const logoField = z.union(
  [
    z.literal(''),
    z
      .string()
      .regex(/^\/[A-Za-z0-9._/-]+$/, 'Ruta de logo inválida.')
      .refine((v) => !v.includes('..'), 'Ruta de logo inválida.'),
    z.string().max(2000).regex(/^https:\/\/[^\s"'<>]+$/, 'Usa una URL https.'),
    z
      .string()
      .max(LIMITS.logoDataUrlMaxChars, 'El logo pesa demasiado (máximo 2 MB).')
      .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/, 'Sube una imagen PNG, JPG o WebP.'),
  ],
  { error: 'Logo inválido.' },
);

export const settingsUpdateSchema = z
  .strictObject({
    businessName: z
      .string()
      .transform((v) => v.replace(/\s+/g, ' ').trim())
      .pipe(z.string().min(2, 'Nombre demasiado corto.').max(LIMITS.businessNameMax, 'Nombre demasiado largo.')),
    phone: phoneField,
    instagramUrl: z.union([
      z.literal(''),
      z
        .string()
        .trim()
        .regex(/^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._]+\/?$/, 'Usa el enlace del perfil: https://www.instagram.com/usuario'),
    ]),
    logoUrl: logoField,
    themeColors: z.strictObject({
      primary: hexColor,
      secondary: hexColor,
      accent: hexColor,
      background: hexColor,
      text: hexColor,
    }),
    workingHours: workingHoursSchema,
    services: servicesSchema,
    booking: bookingRulesSchema,
  })
  .partial();

/** Flattens zod issues into the API error format: [{ path, message }]. */
export function issuesToDetails(error) {
  return (error?.issues || []).map((i) => ({ path: i.path.join('.'), message: i.message }));
}
