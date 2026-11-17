import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULT_SETTINGS, BOOKING_CODE_ALPHABET } from '../constants.js';
import { addDays, dayOfWeek, diffDays, nowInTimezone, parseTypedTime, startOfWeek } from '../time.js';
import { candidateStarts, checkSlot, computeAvailability, daySegments, ticksFor } from '../schedule.js';
import { formatPhone, normalizePhone } from '../phone.js';
import { buildThemeTokens, contrastRatio, paletteReport } from '../color.js';
import { accountSchema, changePasswordSchema, createAppointmentSchema, settingsUpdateSchema, verifySchema } from '../schemas.js';
import { formatDateLong, formatTime } from '../format.js';
import { bookingConfirmationText, whatsappLink } from '../whatsapp.js';

const settings = structuredClone(DEFAULT_SETTINGS);
const SATURDAY = '2026-11-21';

describe('time', () => {
  it('handles civil dates without timezone drift', () => {
    assert.equal(dayOfWeek(SATURDAY), 6);
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(diffDays('2026-11-16', SATURDAY), 5);
    assert.equal(startOfWeek(SATURDAY), '2026-11-16');
    assert.equal(startOfWeek('2026-11-22'), '2026-11-16');
  });

  it('computes now in America/Caracas (UTC-4)', () => {
    const now = nowInTimezone('America/Caracas', new Date('2026-11-17T02:30:00Z'));
    assert.deepEqual(now, { date: '2026-11-16', minutes: 22 * 60 + 30, time: '22:30' });
  });
});

describe('schedule', () => {
  const saturday = settings.workingHours[6];

  it('splits the day around the lunch break', () => {
    assert.deepEqual(daySegments(saturday), [
      { start: 510, end: 750 },
      { start: 840, end: 1140 },
    ]);
  });

  it('offers 1-hour services on the hour grid of each segment', () => {
    const starts = candidateStarts(saturday, 60).map((m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`);
    assert.deepEqual(starts, ['8:30', '9:30', '10:30', '11:30', '14:00', '15:00', '16:00', '17:00', '18:00']);
  });

  it('only offers 2-hour services that fit before the break or closing', () => {
    const starts = candidateStarts(saturday, 120);
    assert.deepEqual(starts, [510, 570, 630, 840, 900, 960, 1020]);
  });

  it('marks overlapping slots as taken', () => {
    const now = { date: '2026-11-16', minutes: 600 };
    const occupied = new Set(ticksFor(630, 60)); // 10:30-11:30 taken
    const result = computeAvailability({ settings, date: SATURDAY, durationMinutes: 120, occupied, now });
    const byTime = Object.fromEntries(result.slots.map((s) => [s.time, s.available]));
    assert.equal(byTime['08:30'], true); // 8:30-10:30 ends exactly where the taken one starts
    assert.equal(byTime['09:30'], false); // 9:30-11:30 overlaps
    assert.equal(byTime['10:30'], false);
    assert.equal(byTime['14:00'], true);
  });

  it('with 30-minute starts, a 1-hour booking takes out the starts it overlaps', () => {
    const half = structuredClone(settings);
    half.workingHours[6].slotDurationMinutes = 30;
    const now = { date: '2026-11-16', minutes: 600 };
    const occupied = new Set(ticksFor(570, 60)); // 9:30-10:30 taken
    const result = computeAvailability({ settings: half, date: SATURDAY, durationMinutes: 60, occupied, now });
    const byTime = Object.fromEntries(result.slots.map((s) => [s.time, s.available]));
    assert.equal(byTime['08:30'], true);
    assert.equal(byTime['09:00'], false); // 9:00-10:00 overlaps
    assert.equal(byTime['09:30'], false);
    assert.equal(byTime['10:00'], false);
    assert.equal(byTime['10:30'], true);
    assert.equal(byTime['11:30'], true); // last start that ends at the break (12:30)
    assert.equal(byTime['12:00'], undefined);
  });

  it('hides past starts and respects the minimum lead time today', () => {
    const now = { date: SATURDAY, minutes: 9 * 60 + 45 }; // 9:45
    const result = computeAvailability({ settings, date: SATURDAY, durationMinutes: 60, occupied: new Set(), now });
    assert.equal(result.slots[0].time, '11:30'); // 10:30 < 9:45 + 60
  });

  it('says the day is over (not full) once every start today has passed', () => {
    const now = { date: SATURDAY, minutes: 17 * 60 + 45 }; // 17:45, last 2 h start was 17:00
    const result = computeAvailability({ settings, date: SATURDAY, durationMinutes: 120, occupied: new Set(), now });
    assert.equal(result.reason, 'ended');
    const earlier = { date: SATURDAY, minutes: 16 * 60 + 30 }; // 18:00 still ahead (lead 60 min)
    const taken = computeAvailability({ settings, date: SATURDAY, durationMinutes: 60, occupied: new Set(ticksFor(1080, 60)), now: earlier });
    assert.equal(taken.reason, 'full'); // the only start left is booked
  });

  it('rejects closed, blocked, past and out-of-window dates', () => {
    const now = { date: '2026-11-16', minutes: 600 };
    const run = (date, s = settings) =>
      computeAvailability({ settings: s, date, durationMinutes: 60, occupied: new Set(), now }).reason;
    assert.equal(run('2026-11-22'), 'closed'); // Sunday
    assert.equal(run('2026-11-15'), 'past');
    assert.equal(run(addDays('2026-11-16', 31)), 'out_of_window');
    assert.equal(run(SATURDAY, { ...settings, blockedDates: [{ date: SATURDAY, reason: 'Feriado' }] }), 'blocked');
  });

  it('checkSlot distinguishes taken from invalid times', () => {
    const now = { date: '2026-11-16', minutes: 600 };
    const occupied = new Set(ticksFor(510, 60));
    const base = { settings, date: SATURDAY, durationMinutes: 60, occupied, now };
    assert.equal(checkSlot({ ...base, time: '08:30' }).reason, 'taken');
    assert.equal(checkSlot({ ...base, time: '08:45' }).reason, 'invalid_time');
    assert.equal(checkSlot({ ...base, time: '09:30' }).ok, true);
  });
});

describe('typed time', () => {
  it('reads hours typed by hand', () => {
    assert.equal(parseTypedTime('5:30', 'pm'), '17:30');
    assert.equal(parseTypedTime('6:45', 'pm'), '18:45');
    assert.equal(parseTypedTime('9.15', 'am'), '09:15');
    assert.equal(parseTypedTime('530', 'pm'), '17:30');
    assert.equal(parseTypedTime('17:30', 'am'), '17:30');
    assert.equal(parseTypedTime('5:30 am', 'pm'), '05:30');
    assert.equal(parseTypedTime('12:00', 'pm'), '12:00');
    assert.equal(parseTypedTime('12:00', 'am'), '00:00');
    for (const bad of ['', '5:3', '25:00', '13:00 pm', 'hola']) assert.equal(parseTypedTime(bad, 'pm'), null);
  });
});

describe('phone', () => {
  it('normalizes Venezuelan and international numbers', () => {
    assert.equal(normalizePhone('0414-736 8595'), '584147368595');
    assert.equal(normalizePhone('414 7368595'), '584147368595');
    assert.equal(normalizePhone('+58 414 7368595'), '584147368595');
    assert.equal(normalizePhone('58 414 7368595'), '584147368595');
    assert.equal(normalizePhone('+57 300 123 4567'), '573001234567');
    assert.equal(normalizePhone('0212-5551234'), '582125551234');
  });

  it('rejects malformed numbers', () => {
    for (const bad of ['', '123', '0514-1234567', '+58 414 12345', 'abc0414123', '+0123456789', '04141234567890']) {
      assert.equal(normalizePhone(bad), null, bad);
    }
  });

  it('formats for display', () => {
    assert.equal(formatPhone('584147368595'), '+58 414-736-8595');
  });
});

describe('booking code alphabet', () => {
  it('has no ambiguous characters', () => {
    for (const ch of '0O1IL') assert.equal(BOOKING_CODE_ALPHABET.includes(ch), false, ch);
  });
});

describe('color', () => {
  it('default palette passes AA everywhere', () => {
    for (const row of paletteReport(DEFAULT_SETTINGS.themeColors)) assert.equal(row.passes, true, row.label);
  });

  it('forces readable text tokens even with a poor palette', () => {
    const tokens = buildThemeTokens({ ...DEFAULT_SETTINGS.themeColors, text: '#EEEEEE', background: '#FFFFFF' });
    assert.ok(contrastRatio(tokens['--color-text'], '#FFFFFF') >= 4.5);
    assert.ok(contrastRatio(tokens['--color-text-3'], '#FFFFFF') >= 4.5);
  });
});

describe('schemas', () => {
  it('normalizes booking input', () => {
    const parsed = createAppointmentSchema.parse({
      serviceKey: 'manicura',
      date: SATURDAY,
      timeSlot: '10:30',
      clientName: '  María   José Pérez ',
      clientPhone: '0414 123 4567',
    });
    assert.equal(parsed.clientName, 'María José Pérez');
    assert.equal(parsed.clientPhone, '584141234567');
    assert.equal(parsed.website, '');
  });

  it('rejects the honeypot and unknown fields', () => {
    const base = { serviceKey: 'manicura', date: SATURDAY, timeSlot: '10:30', clientName: 'Ana Ruiz', clientPhone: '04141234567' };
    assert.equal(createAppointmentSchema.safeParse({ ...base, website: 'spam' }).success, false);
    assert.equal(createAppointmentSchema.safeParse({ ...base, status: 'completed' }).success, false);
  });

  it('uppercases booking codes and rejects ambiguous ones', () => {
    assert.equal(verifySchema.parse({ code: 'na84k2' }).code, 'NA84K2');
    assert.equal(verifySchema.safeParse({ code: 'NA0OK2' }).success, false);
  });

  it('validates working hours and breaks', () => {
    const hours = structuredClone(DEFAULT_SETTINGS.workingHours);
    assert.equal(settingsUpdateSchema.safeParse({ workingHours: hours }).success, true);
    hours[1].breakEnd = '';
    assert.equal(settingsUpdateSchema.safeParse({ workingHours: hours }).success, false);
  });

  it('accepts only safe logo sources', () => {
    const ok = (logoUrl) => settingsUpdateSchema.safeParse({ logoUrl }).success;
    assert.equal(ok('/logo.png'), true);
    assert.equal(ok('https://cdn.example.com/logo.png'), true);
    assert.equal(ok('data:image/png;base64,iVBORw0KGgo='), true);
    assert.equal(ok('data:image/svg+xml;base64,PHN2Zz4='), false);
    assert.equal(ok('javascript:alert(1)'), false);
    assert.equal(ok('/../etc/passwd'), false);
  });

  it('requires matching passwords on setup', () => {
    const r = accountSchema.safeParse({ username: 'Tiago', password: 'clave-larga-123', passwordConfirm: 'otra' });
    assert.equal(r.success, false);
    assert.equal(r.error.issues[0].path.join('.'), 'passwordConfirm');
    assert.equal(accountSchema.safeParse({ username: 'tiago', password: 'abc123', passwordConfirm: 'abc123' }).success, true);
  });

  it('asks for matching passwords when changing one', () => {
    const ok = changePasswordSchema.safeParse({ password: 'clave-larga-123', passwordConfirm: 'clave-larga-123' });
    assert.equal(ok.success, true);
    assert.equal(ok.data.currentPassword, '');
    assert.equal(changePasswordSchema.safeParse({ password: 'corta', passwordConfirm: 'corta' }).success, false);
  });
});

describe('format and whatsapp', () => {
  it('formats civil dates and 12h times in Spanish', () => {
    assert.equal(formatDateLong(SATURDAY), 'Sábado, 21 de noviembre');
    assert.equal(formatTime('14:30'), '2:30 p. m.');
  });

  it('builds the confirmation message', () => {
    const text = bookingConfirmationText({
      businessName: 'Nails Art',
      clientName: 'Ana Ruiz',
      serviceName: 'Manicura',
      date: SATURDAY,
      time: '10:30',
      code: 'NA84K2',
    });
    assert.ok(text.startsWith('¡Hola Nails Art! Acabo de agendar mi cita.\n👤 Nombre: Ana Ruiz'));
    assert.ok(whatsappLink('584147368595', text).startsWith('https://wa.me/584147368595?text=%C2%A1Hola'));
  });
});
