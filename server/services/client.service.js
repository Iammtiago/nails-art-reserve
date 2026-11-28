import { APPOINTMENT_STATUS } from '../../shared/constants.js';
import { escapeRegex, nameSearchPatterns } from '../../shared/search.js';
import { toMinutes } from '../../shared/time.js';
import { AppError, isDuplicateKey, notFound } from '../lib/errors.js';
import { Appointment, Client } from '../models/index.js';
import { businessNow, getSettingsDoc } from './settings.service.js';

const NOT_BLOCK = { kind: { $ne: 'block' } };
const HISTORY_LIMIT = 200;

/** Still ahead: a later day, or today at a time that has not come yet. */
function isAhead(appointment, now) {
  return appointment.date > now.date || (appointment.date === now.date && toMinutes(appointment.timeSlot) >= now.minutes);
}

/** Creates or refreshes the client record when a booking is made. */
export async function recordBooking({ phone, name, date }) {
  await Client.findOneAndUpdate(
    { phone },
    {
      $set: { name },
      $inc: { totalAppointments: 1 },
      $max: { lastAppointmentDate: date },
      $setOnInsert: { completedAppointments: 0, lastVisitDate: '' },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: false },
  );
}

/** Keeps the directory's «last appointment» in step when an appointment moves later. */
export async function recordReschedule({ phone, date }) {
  if (!phone) return;
  await Client.updateOne({ phone }, { $max: { lastAppointmentDate: date } });
}

/** Counts a visit when an appointment is marked as attended. */
export async function recordVisit({ phone, name, date }) {
  await Client.findOneAndUpdate(
    { phone },
    {
      $inc: { completedAppointments: 1 },
      $max: { lastVisitDate: date, lastAppointmentDate: date },
      $setOnInsert: { name, totalAppointments: 1 },
    },
    { upsert: true, setDefaultsOnInsert: false },
  );
}

/**
 * An attendance was undone (cancelled, moved or «Quitar asistencia»): one visit less, and the
 * last visit is the latest attended appointment that remains. Call it after the change.
 */
export async function undoVisit({ phone }) {
  if (!phone) return;
  const last = await Appointment.findOne({ clientPhone: phone, status: APPOINTMENT_STATUS.COMPLETED, ...NOT_BLOCK }, { date: 1 })
    .sort({ date: -1 })
    .lean();
  await Client.updateOne({ phone, completedAppointments: { $gt: 0 } }, { $inc: { completedAppointments: -1 } });
  await Client.updateOne({ phone }, { $set: { lastVisitDate: last?.date || '' } });
}

export function serializeClient(c, nextAppointment = null) {
  return {
    id: String(c._id),
    name: c.name,
    phone: c.phone,
    totalAppointments: c.totalAppointments,
    completedAppointments: c.completedAppointments,
    lastAppointmentDate: c.lastAppointmentDate,
    lastVisitDate: c.lastVisitDate,
    nextAppointment,
    createdAt: c.createdAt,
  };
}

function nextSummary(a) {
  return { id: String(a._id), date: a.date, timeSlot: a.timeSlot, endTime: a.endTime, serviceName: a.serviceName, status: a.status };
}

/**
 * Her next appointment: the soonest one not cancelled that has not started yet. Like «Próximas»
 * in Citas it includes a future one marked attended by mistake, so it is not booked twice.
 */
function isNext(appointment, now) {
  return appointment.status !== APPOINTMENT_STATUS.CANCELLED && isAhead(appointment, now);
}

/** Next appointment of each phone (only the ones given), for the directory list. */
async function nextAppointmentsByPhone(phones, now) {
  if (!phones.length) return new Map();
  const rows = await Appointment.find(
    { clientPhone: { $in: phones }, status: { $ne: APPOINTMENT_STATUS.CANCELLED }, date: { $gte: now.date }, ...NOT_BLOCK },
    { clientPhone: 1, date: 1, timeSlot: 1, endTime: 1, serviceName: 1, status: 1 },
  )
    .sort({ date: 1, timeSlot: 1 })
    .lean();
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.clientPhone) && isNext(row, now)) map.set(row.clientPhone, nextSummary(row));
  }
  return map;
}

const PHONE_TAKEN = 'Ese teléfono ya es de otra clienta.';

/**
 * Edits a client's name and phone. Her appointments follow: they carry the phone (it is how she
 * looks up and cancels them) and the name shown in the agenda, so both are updated together.
 */
export async function updateClient(id, { name, phone }) {
  const client = await Client.findById(id).lean();
  if (!client) throw notFound('Esa clienta ya no existe.', 'CLIENT_NOT_FOUND');
  const taken = () =>
    new AppError(409, PHONE_TAKEN, { code: 'PHONE_TAKEN', details: [{ path: 'phone', message: PHONE_TAKEN }] });
  if (phone !== client.phone && (await Client.exists({ phone, _id: { $ne: client._id } }))) throw taken();

  let updated;
  try {
    updated = await Client.findByIdAndUpdate(id, { $set: { name, phone } }, { returnDocument: 'after', runValidators: true }).lean();
  } catch (error) {
    if (isDuplicateKey(error, 'phone')) throw taken();
    throw error;
  }
  await Appointment.updateMany({ clientPhone: client.phone, kind: { $ne: 'block' } }, { $set: { clientPhone: phone, clientName: name } });
  return serializeClient(updated);
}

export async function listClients({ q, page, limit }) {
  const filter = {};
  const query = (q || '').trim();
  if (query) {
    const or = [];
    const words = nameSearchPatterns(query);
    if (words.length) or.push({ $and: words.map((word) => ({ name: { $regex: word, $options: 'i' } })) });
    const digits = query.replace(/\D/g, '').replace(/^0+/, '');
    if (digits.length >= 3) or.push({ phone: { $regex: escapeRegex(digits) } });
    // Nothing searchable (only symbols): no client matches.
    if (or.length) filter.$or = or;
    else filter._id = null;
  }
  const settings = await getSettingsDoc();
  const now = businessNow(settings);
  const [items, total, all, recurring] = await Promise.all([
    Client.find(filter)
      .sort({ lastAppointmentDate: -1, name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Client.countDocuments(filter),
    Client.estimatedDocumentCount(),
    Client.countDocuments({ completedAppointments: { $gte: 2 } }),
  ]);
  const next = await nextAppointmentsByPhone(
    items.map((c) => c.phone),
    now,
  );
  return {
    items: items.map((c) => serializeClient(c, next.get(c.phone) || null)),
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
    summary: { total: all, recurring },
    now,
  };
}

/**
 * One client with her whole history (newest first) and her next pending appointment,
 * for the client detail in the panel. Appointments are linked by phone. `serialize` is the
 * appointment serializer of the panel (passed in: appointment.service already imports this file).
 */
export async function getClientDetail(id, { serialize }) {
  const client = await Client.findById(id).lean();
  if (!client) throw notFound('Esa clienta ya no existe.', 'CLIENT_NOT_FOUND');
  const settings = await getSettingsDoc();
  const now = businessNow(settings);
  const rows = await Appointment.find({ clientPhone: client.phone, ...NOT_BLOCK }, { qrDataUrl: 0, occupiedTicks: 0, __v: 0 })
    .sort({ date: -1, timeSlot: -1 })
    .limit(HISTORY_LIMIT)
    .lean();
  // rows are newest first, so the soonest one ahead is the last that qualifies.
  const pending = rows.filter((a) => isNext(a, now));
  const next = pending.length ? pending[pending.length - 1] : null;
  return {
    client: serializeClient(client, next ? nextSummary(next) : null),
    appointments: rows.map(serialize),
    nextAppointment: next ? serialize(next) : null,
    now,
  };
}
