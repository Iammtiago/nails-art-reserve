import { APPOINTMENT_STATUS } from '../../shared/constants.js';
import { DATE_REASON_LABELS, checkSlot, ticksFor } from '../../shared/schedule.js';
import { toMinutes, toTime } from '../../shared/time.js';
import { generateBookingCode } from '../lib/booking-code.js';
import { AppError, conflict, isDuplicateKey, notFound, unprocessable } from '../lib/errors.js';
import { generateQrDataUrl, verificationUrl } from '../lib/qr.js';
import { Appointment } from '../models/index.js';
import { findActiveService, occupiedTicksOn } from './availability.service.js';
import { recordBooking, recordVisit } from './client.service.js';
import { businessNow, getSettingsDoc } from './settings.service.js';

const MAX_CODE_ATTEMPTS = 6;

// ---------- serializers ----------

/** Full ticket, returned once to the client right after booking. */
export function serializeTicket(a) {
  return {
    id: String(a._id),
    clientName: a.clientName,
    clientPhone: a.clientPhone,
    serviceKey: a.serviceKey,
    serviceName: a.serviceName,
    durationMinutes: a.durationMinutes,
    date: a.date,
    timeSlot: a.timeSlot,
    endTime: a.endTime,
    bookingCode: a.bookingCode,
    qrDataUrl: a.qrDataUrl,
    status: a.status,
    createdAt: a.createdAt,
  };
}

/** What a phone lookup reveals: enough to recognise and cancel, no code or QR. */
export function serializeForPhoneLookup(a) {
  return {
    id: String(a._id),
    clientFirstName: String(a.clientName).split(' ')[0],
    serviceName: a.serviceName,
    date: a.date,
    timeSlot: a.timeSlot,
    endTime: a.endTime,
    status: a.status,
  };
}

export function serializeForAdmin(a) {
  return {
    id: String(a._id),
    clientName: a.clientName,
    clientPhone: a.clientPhone,
    serviceKey: a.serviceKey,
    serviceName: a.serviceName,
    durationMinutes: a.durationMinutes,
    date: a.date,
    timeSlot: a.timeSlot,
    endTime: a.endTime,
    bookingCode: a.bookingCode,
    status: a.status,
    cancelledAt: a.cancelledAt || null,
    cancelledBy: a.cancelledBy || null,
    completedAt: a.completedAt || null,
    createdAt: a.createdAt,
  };
}

const ADMIN_PROJECTION = { qrDataUrl: 0, occupiedTicks: 0, __v: 0 };

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Has the appointment already started (in the business timezone)? */
function hasStarted(appointment, now) {
  if (appointment.date < now.date) return true;
  if (appointment.date > now.date) return false;
  return toMinutes(appointment.timeSlot) <= now.minutes;
}

// ---------- public booking ----------

/**
 * Books an appointment. The availability check gives a friendly early answer; the
 * unique (date, tick) index is what guarantees no double booking under concurrency.
 */
export async function createAppointment(input, { baseUrl }) {
  const settings = await getSettingsDoc();
  const service = findActiveService(settings, input.serviceKey);
  const now = businessNow(settings);
  const maxActive = settings.booking.maxActivePerPhone;

  const activeCount = await Appointment.countDocuments({
    clientPhone: input.clientPhone,
    status: APPOINTMENT_STATUS.CONFIRMED,
    date: { $gte: now.date },
  });
  if (activeCount >= maxActive) {
    throw unprocessable(
      `Este número ya tiene ${activeCount} ${activeCount === 1 ? 'cita activa' : 'citas activas'}. ` +
        'Cancela una o espera a ser atendida para reservar otra.',
      'MAX_ACTIVE_REACHED',
    );
  }

  const occupied = await occupiedTicksOn(input.date);
  const check = checkSlot({
    settings,
    date: input.date,
    time: input.timeSlot,
    durationMinutes: service.durationMinutes,
    occupied,
    now,
  });
  if (!check.ok) {
    if (check.reason === 'taken') throw conflict('Ese horario se acaba de ocupar. Elige otro, por favor.', 'SLOT_TAKEN');
    if (check.reason === 'invalid_time') throw unprocessable('Esa hora no está disponible para este servicio.', 'INVALID_TIME');
    throw unprocessable(DATE_REASON_LABELS[check.reason] || 'Esa fecha no está disponible.', 'DATE_UNAVAILABLE');
  }

  const start = toMinutes(input.timeSlot);
  const base = {
    clientName: input.clientName,
    clientPhone: input.clientPhone,
    serviceKey: service.key,
    serviceName: service.name,
    durationMinutes: service.durationMinutes,
    date: input.date,
    timeSlot: input.timeSlot,
    endTime: toTime(start + service.durationMinutes),
    occupiedTicks: ticksFor(start, service.durationMinutes),
    holdsSlot: true,
    status: APPOINTMENT_STATUS.CONFIRMED,
  };

  let created = null;
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS && !created; attempt += 1) {
    const bookingCode = generateBookingCode();
    const qrDataUrl = await generateQrDataUrl(verificationUrl(baseUrl, bookingCode));
    try {
      created = await Appointment.create({ ...base, bookingCode, qrDataUrl });
    } catch (error) {
      if (isDuplicateKey(error, 'bookingCode')) continue;
      if (isDuplicateKey(error)) throw conflict('Ese horario se acaba de ocupar. Elige otro, por favor.', 'SLOT_TAKEN');
      throw error;
    }
  }
  if (!created) throw new AppError(503, 'No pudimos generar tu código. Intenta de nuevo.', { code: 'CODE_EXHAUSTED' });

  try {
    await recordBooking({ phone: input.clientPhone, name: input.clientName, date: input.date });
  } catch (error) {
    // The appointment is already safe; the directory can be repaired on the next booking.
    console.error('[appointments] could not update client directory', error);
  }

  return serializeTicket(created.toObject());
}

/** Active, still-cancellable appointments for a phone. */
export async function listActiveByPhone(phone) {
  const settings = await getSettingsDoc();
  const now = businessNow(settings);
  const rows = await Appointment.find(
    { clientPhone: phone, status: APPOINTMENT_STATUS.CONFIRMED, date: { $gte: now.date } },
    { clientName: 1, serviceName: 1, date: 1, timeSlot: 1, endTime: 1, status: 1 },
  )
    .sort({ date: 1, timeSlot: 1 })
    .lean();
  return rows.filter((a) => !hasStarted(a, now)).map(serializeForPhoneLookup);
}

export async function cancelByClient(id, phone) {
  const settings = await getSettingsDoc();
  const now = businessNow(settings);
  const appointment = await Appointment.findById(id, { clientPhone: 1, status: 1, date: 1, timeSlot: 1 }).lean();
  if (!appointment || appointment.clientPhone !== phone) {
    throw notFound('No encontramos esa cita con ese número.', 'APPOINTMENT_NOT_FOUND');
  }
  if (appointment.status !== APPOINTMENT_STATUS.CONFIRMED) throw conflict('Esa cita ya no está activa.', 'NOT_ACTIVE');
  if (hasStarted(appointment, now)) {
    throw unprocessable('Esa cita ya empezó o pasó. Escríbenos por WhatsApp.', 'ALREADY_STARTED');
  }
  const updated = await Appointment.findOneAndUpdate(
    { _id: id, clientPhone: phone, status: APPOINTMENT_STATUS.CONFIRMED },
    {
      $set: {
        status: APPOINTMENT_STATUS.CANCELLED,
        holdsSlot: false,
        cancelledAt: new Date(),
        cancelledBy: 'client',
      },
    },
    { returnDocument: 'after', lean: true },
  );
  if (!updated) throw conflict('Esa cita ya no está activa.', 'NOT_ACTIVE');
  return serializeForPhoneLookup(updated);
}

// ---------- admin ----------

export async function cancelByAdmin(id) {
  const updated = await Appointment.findOneAndUpdate(
    { _id: id, status: APPOINTMENT_STATUS.CONFIRMED },
    {
      $set: {
        status: APPOINTMENT_STATUS.CANCELLED,
        holdsSlot: false,
        cancelledAt: new Date(),
        cancelledBy: 'admin',
      },
    },
    { returnDocument: 'after', lean: true, projection: ADMIN_PROJECTION },
  );
  if (updated) return serializeForAdmin(updated);
  const exists = await Appointment.exists({ _id: id });
  if (!exists) throw notFound('Esa cita no existe.', 'APPOINTMENT_NOT_FOUND');
  throw conflict('Solo se pueden cancelar citas confirmadas.', 'NOT_ACTIVE');
}

export async function completeAppointment(id) {
  const updated = await Appointment.findOneAndUpdate(
    { _id: id, status: APPOINTMENT_STATUS.CONFIRMED },
    { $set: { status: APPOINTMENT_STATUS.COMPLETED, completedAt: new Date() } },
    { returnDocument: 'after', lean: true, projection: ADMIN_PROJECTION },
  );
  if (!updated) {
    const existing = await Appointment.findById(id, { status: 1 }).lean();
    if (!existing) throw notFound('Esa cita no existe.', 'APPOINTMENT_NOT_FOUND');
    if (existing.status === APPOINTMENT_STATUS.COMPLETED) throw conflict('Esta cita ya estaba marcada como atendida.', 'ALREADY_COMPLETED');
    throw conflict('Esta cita está cancelada; no se puede marcar asistencia.', 'CANCELLED');
  }
  try {
    await recordVisit({ phone: updated.clientPhone, name: updated.clientName, date: updated.date });
  } catch (error) {
    console.error('[appointments] could not record visit', error);
  }
  return serializeForAdmin(updated);
}

/** Looks a code up for the scanner and optionally marks attendance. */
export async function verifyCode(code, { markAttended = false } = {}) {
  const settings = await getSettingsDoc();
  const now = businessNow(settings);
  const found = await Appointment.findOne({ bookingCode: code }, ADMIN_PROJECTION).lean();
  if (!found) throw notFound('No encontramos ninguna cita con ese código.', 'CODE_NOT_FOUND');

  let appointment = serializeForAdmin(found);
  let attended = false;
  if (markAttended) {
    appointment = await completeAppointment(found._id);
    attended = true;
  }

  const warnings = [];
  if (appointment.status === APPOINTMENT_STATUS.CANCELLED) warnings.push('Esta cita está cancelada.');
  if (!attended && appointment.status === APPOINTMENT_STATUS.COMPLETED) warnings.push('Esta cita ya fue marcada como atendida.');
  if (appointment.date !== now.date) {
    warnings.push(appointment.date < now.date ? 'Esta cita era para un día anterior.' : 'Esta cita es para otro día.');
  }
  return { appointment, attended, warnings, canMarkAttended: appointment.status === APPOINTMENT_STATUS.CONFIRMED, now };
}

export async function listAppointments({ view, date, q, page, limit }) {
  const settings = await getSettingsDoc();
  const now = businessNow(settings);
  const filter = {};
  let sort = { date: 1, timeSlot: 1 };

  switch (view) {
    case 'today':
      filter.date = now.date;
      break;
    case 'upcoming':
      filter.status = APPOINTMENT_STATUS.CONFIRMED;
      filter.date = { $gte: now.date };
      break;
    case 'completed':
      filter.status = APPOINTMENT_STATUS.COMPLETED;
      sort = { date: -1, timeSlot: -1 };
      break;
    case 'cancelled':
      filter.status = APPOINTMENT_STATUS.CANCELLED;
      sort = { date: -1, timeSlot: -1 };
      break;
    default:
      sort = { date: -1, timeSlot: -1 };
  }
  if (date) filter.date = view === 'upcoming' && date < now.date ? '__none__' : date;

  const query = (q || '').trim();
  if (query) {
    const digits = query.replace(/\D/g, '');
    const or = [{ clientName: { $regex: escapeRegex(query), $options: 'i' } }];
    if (digits.length >= 3) or.push({ clientPhone: { $regex: escapeRegex(digits.replace(/^0+/, '')) } });
    if (/^[A-Za-z0-9]{6}$/.test(query)) or.push({ bookingCode: query.toUpperCase() });
    filter.$or = or;
  }

  const [items, total, today, upcoming, completed, cancelled] = await Promise.all([
    Appointment.find(filter, ADMIN_PROJECTION)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Appointment.countDocuments(filter),
    Appointment.countDocuments({ date: now.date, status: { $ne: APPOINTMENT_STATUS.CANCELLED } }),
    Appointment.countDocuments({ status: APPOINTMENT_STATUS.CONFIRMED, date: { $gte: now.date } }),
    Appointment.countDocuments({ status: APPOINTMENT_STATUS.COMPLETED }),
    Appointment.countDocuments({ status: APPOINTMENT_STATUS.CANCELLED }),
  ]);

  return {
    items: items.map(serializeForAdmin),
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
    summary: { today, upcoming, completed, cancelled },
    now,
  };
}
