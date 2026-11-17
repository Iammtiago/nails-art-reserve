// Hidden superadmin mode (Tiago's rule for every platform, 2026-11-17).
// Four taps on any section title open a key prompt; the right key elevates the current
// panel session for SUPER_MINUTES and unlocks permanent deletion of clients and appointments.
// The key is checked only here, attempts are rate limited, and every deletion is audited.

import { timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { APPOINTMENT_STATUS, SUPER_COOKIE, SUPER_MINUTES } from '../../shared/constants.js';
import { AppError, notFound } from '../lib/errors.js';
import { env } from '../config/env.js';
import { Appointment, Client, PurgeLog } from '../models/index.js';
import { hit, peek, tooMany } from './rate-limit.service.js';
import { sessionCookieOptions, sessionSecret } from './auth.service.js';

// Fixed by Tiago's explicit order: never change it, ask for another one or move it to an env var.
const SUPER_KEY = '1111';
const UNLOCK_WINDOW_MS = 15 * 60 * 1000;
const UNLOCK_MAX_FAILURES = 5;
const SCOPE = 'superadmin-mode';

function keyMatches(input) {
  const a = Buffer.from(String(input ?? ''));
  const b = Buffer.from(SUPER_KEY);
  return a.length === b.length && timingSafeEqual(a, b);
}

function cookieOptions() {
  return { ...sessionCookieOptions(), maxAge: SUPER_MINUTES * 60 * 1000 };
}

/** { active, expiresAt } for the current admin; the elevation is bound to that admin. */
export async function superStatus(req) {
  const token = req.cookies?.[SUPER_COOKIE];
  if (!token || !req.admin) return { active: false, expiresAt: null };
  try {
    const payload = jwt.verify(token, await sessionSecret(), { algorithms: ['HS256'] });
    if (payload.scope !== SCOPE || payload.sub !== req.admin.id) return { active: false, expiresAt: null };
    return { active: true, expiresAt: new Date(payload.exp * 1000).toISOString() };
  } catch {
    return { active: false, expiresAt: null };
  }
}

export async function unlockSuper(req, res, { key }) {
  const limitKey = `super:${req.admin.id}:${req.ip}`;
  const limited = env().rateLimitsEnabled;
  if (limited) {
    const { count, resetAt } = await peek(limitKey, UNLOCK_WINDOW_MS);
    if (count >= UNLOCK_MAX_FAILURES) throw tooMany('Demasiados intentos con la clave.', resetAt);
  }
  if (!keyMatches(key)) {
    if (limited) await hit(limitKey, UNLOCK_WINDOW_MS);
    throw new AppError(401, 'Clave incorrecta.', { code: 'BAD_SUPER_KEY' });
  }
  const token = jwt.sign({ sub: req.admin.id, scope: SCOPE }, await sessionSecret(), {
    algorithm: 'HS256',
    expiresIn: `${SUPER_MINUTES}m`,
  });
  res.cookie(SUPER_COOKIE, token, cookieOptions());
  return { active: true, expiresAt: new Date(Date.now() + SUPER_MINUTES * 60 * 1000).toISOString() };
}

export function lockSuper(res) {
  const { maxAge, ...options } = cookieOptions();
  res.clearCookie(SUPER_COOKIE, options);
  return { active: false, expiresAt: null };
}

/** Express middleware for the permanent-deletion routes. */
export async function requireSuper(req, _res, next) {
  const { active } = await superStatus(req);
  if (!active) throw new AppError(403, 'Activa el modo superadmin para eliminar datos.', { code: 'SUPER_REQUIRED' });
  return next();
}

function plain(doc) {
  const { qrDataUrl, occupiedTicks, __v, ...rest } = doc;
  return { ...rest, _id: String(doc._id) };
}

async function audit(admin, entity, entityId, summary, snapshot) {
  await PurgeLog.create({ adminId: admin.id, username: admin.username, entity, entityId: String(entityId), summary, snapshot });
}

/** Deletes a client and every appointment booked with their phone. */
export async function purgeClient(id, admin) {
  const client = await Client.findById(id).lean();
  if (!client) throw notFound('Esa clienta ya no existe.');
  const appointments = await Appointment.find({ clientPhone: client.phone, kind: { $ne: 'block' } }).lean();
  await audit(admin, 'client', client._id, `Clienta ${client.name} (${client.phone}) y ${appointments.length} cita(s)`, {
    client: plain(client),
    appointments: appointments.map(plain),
  });
  const { deletedCount } = await Appointment.deleteMany({ _id: { $in: appointments.map((a) => a._id) } });
  await Client.deleteOne({ _id: client._id });
  return { deleted: { clients: 1, appointments: deletedCount } };
}

/** Deletes one appointment (or time block) for good and takes it out of the client's counters. */
export async function purgeAppointment(id, admin) {
  const appointment = await Appointment.findById(id).lean();
  if (!appointment) throw notFound('Esa cita ya no existe.');
  const label = appointment.kind === 'block' ? 'Horario ocupado' : `Cita ${appointment.bookingCode} de ${appointment.clientName}`;
  await audit(admin, 'appointment', appointment._id, `${label}, ${appointment.date} ${appointment.timeSlot}`, plain(appointment));
  await Appointment.deleteOne({ _id: appointment._id });
  if (appointment.kind !== 'block' && appointment.clientPhone) {
    const attended = appointment.status === APPOINTMENT_STATUS.COMPLETED ? 1 : 0;
    await Client.updateOne({ phone: appointment.clientPhone }, [
      {
        $set: {
          totalAppointments: { $max: [0, { $subtract: ['$totalAppointments', 1] }] },
          completedAppointments: { $max: [0, { $subtract: ['$completedAppointments', attended] }] },
        },
      },
    ], { updatePipeline: true });
  }
  return { deleted: { appointments: 1 } };
}
