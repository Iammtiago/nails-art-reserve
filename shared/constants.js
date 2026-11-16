// Single source of business constants shared by the server and the UI.

/** Fixed agenda granularity. Every time, duration and block is a multiple of this. */
export const TICK_MINUTES = 15;

/** Booking code: 6 uppercase chars, without ambiguous 0/O, 1/I/L. */
export const BOOKING_CODE_LENGTH = 6;
export const BOOKING_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const BOOKING_CODE_REGEX = new RegExp(`^[${BOOKING_CODE_ALPHABET}]{${BOOKING_CODE_LENGTH}}$`);

export const DEFAULT_TIMEZONE = 'America/Caracas';
export const DEFAULT_COUNTRY_CODE = '58';

export const APPOINTMENT_STATUS = Object.freeze({
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

export const APPOINTMENT_STATUSES = Object.freeze(Object.values(APPOINTMENT_STATUS));

export const STATUS_LABELS = Object.freeze({
  confirmed: 'Confirmada',
  completed: 'Asistió',
  cancelled: 'Cancelada',
});

/** Index = dayOfWeek (0 = domingo), same convention as Date#getUTCDay. */
export const DAY_NAMES = Object.freeze(['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']);
export const DAY_SHORT_NAMES = Object.freeze(['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']);

export const SLOT_DURATION_OPTIONS = Object.freeze([15, 30, 45, 60, 75, 90, 105, 120]);
export const SERVICE_DURATION_OPTIONS = Object.freeze([15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 210, 240]);

export const LIMITS = Object.freeze({
  businessNameMax: 60,
  clientNameMin: 3,
  clientNameMax: 80,
  serviceNameMax: 40,
  servicesMax: 12,
  blockReasonMax: 80,
  logoDataUrlMaxChars: 2_800_000, // ~2 MB of image once decoded
  bookingWindowMaxDays: 90,
  maxActivePerPhoneMax: 10,
  calendarRangeMaxDays: 62,
  pageSizeMax: 50,
});

/** Brand palette extracted from the Nails Art logo (paleta A «Lila claro»). */
export const DEFAULT_THEME = Object.freeze({
  primary: '#4B1C71',
  secondary: '#D3B0F4',
  accent: '#8E3FC7',
  background: '#F8F2FE',
  text: '#2A0F40',
});

export const DEFAULT_SERVICES = Object.freeze([
  { key: 'manicura', name: 'Manicura', durationMinutes: 60, isActive: true },
  { key: 'pedicura', name: 'Pedicura', durationMinutes: 60, isActive: true },
  { key: 'manicura-pedicura', name: 'Manicura + pedicura', durationMinutes: 120, isActive: true },
]);

const weekday = (dayOfWeek) => ({
  dayOfWeek,
  isOpen: true,
  openTime: '08:30',
  closeTime: '19:00',
  breakStart: '12:30',
  breakEnd: '14:00',
  slotDurationMinutes: 60,
});

/** Lunes a sábado 8:30–12:30 y 14:00–19:00; domingo cerrado (Instagram @nailsart.sc). */
export const DEFAULT_WORKING_HOURS = Object.freeze([
  { dayOfWeek: 0, isOpen: false, openTime: '08:30', closeTime: '19:00', breakStart: '', breakEnd: '', slotDurationMinutes: 60 },
  weekday(1),
  weekday(2),
  weekday(3),
  weekday(4),
  weekday(5),
  weekday(6),
]);

export const DEFAULT_BOOKING_RULES = Object.freeze({
  windowDays: 30,
  minLeadMinutes: 60,
  maxActivePerPhone: 3,
});

export const DEFAULT_SETTINGS = Object.freeze({
  businessName: 'Nails Art',
  phone: '584147368595',
  instagramUrl: 'https://www.instagram.com/nailsart.sc',
  logoUrl: '/logo.png',
  timezone: DEFAULT_TIMEZONE,
  themeColors: DEFAULT_THEME,
  workingHours: DEFAULT_WORKING_HOURS,
  services: DEFAULT_SERVICES,
  booking: DEFAULT_BOOKING_RULES,
  blockedDates: [],
});

/** Header every non-GET request must carry (CSRF defence in depth). */
export const CSRF_HEADER = 'x-requested-with';
export const CSRF_HEADER_VALUE = 'nails-art';

export const ADMIN_COOKIE = 'na_admin';
