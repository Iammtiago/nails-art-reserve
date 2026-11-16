import { Router } from 'express';
import {
  availabilityQuerySchema,
  cancelByClientSchema,
  createAppointmentSchema,
  daysQuerySchema,
  idParamSchema,
  phoneParamSchema,
  verifySchema,
} from '../../shared/schemas.js';
import { env } from '../config/env.js';
import { requireAdmin, validate } from '../middleware/index.js';
import { cancelByClient, createAppointment, listActiveByPhone, verifyCode } from '../services/appointment.service.js';
import { getAvailability, getBookableDays } from '../services/availability.service.js';
import { rateLimit } from '../services/rate-limit.service.js';

export const appointmentsRouter = Router();

const TEN_MINUTES = 10 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

function publicBaseUrl(req) {
  return env().appUrl || `${req.protocol}://${req.get('host')}`;
}

// GET /api/appointments/days?service=manicura — status of each date in the booking window.
appointmentsRouter.get('/days', validate(daysQuerySchema, 'query'), async (req, res) => {
  res.json(await getBookableDays({ serviceKey: req.valid.query.service }));
});

// GET /api/appointments/availability?date=YYYY-MM-DD&service=manicura
appointmentsRouter.get('/availability', validate(availabilityQuerySchema, 'query'), async (req, res) => {
  const { date, service } = req.valid.query;
  res.json(await getAvailability({ date, serviceKey: service }));
});

// GET /api/appointments/by-phone/:phone — active appointments the client can still cancel.
appointmentsRouter.get(
  '/by-phone/:phone',
  rateLimit({ bucket: 'by-phone', limit: 30, windowMs: TEN_MINUTES, message: 'Demasiadas búsquedas.' }),
  validate(phoneParamSchema, 'params'),
  async (req, res) => {
    res.json({ appointments: await listActiveByPhone(req.valid.params.phone) });
  },
);

// POST /api/appointments — book. 409 when the slot was taken meanwhile.
appointmentsRouter.post(
  '/',
  rateLimit({ bucket: 'book', limit: 12, windowMs: ONE_HOUR, message: 'Demasiadas reservas seguidas.' }),
  validate(createAppointmentSchema),
  async (req, res) => {
    const appointment = await createAppointment(req.valid.body, { baseUrl: publicBaseUrl(req) });
    res.status(201).json({ appointment });
  },
);

// PATCH /api/appointments/:id/cancel — client cancellation; the phone must match the booking.
appointmentsRouter.patch(
  '/:id/cancel',
  rateLimit({ bucket: 'cancel', limit: 15, windowMs: TEN_MINUTES, message: 'Demasiados intentos.' }),
  validate(idParamSchema, 'params'),
  validate(cancelByClientSchema),
  async (req, res) => {
    const appointment = await cancelByClient(req.valid.params.id, req.valid.body.phone);
    res.json({ appointment });
  },
);

// POST /api/appointments/verify — admin scanner: look up a code, optionally mark attendance.
appointmentsRouter.post('/verify', requireAdmin, validate(verifySchema), async (req, res) => {
  const { code, markAttended } = req.valid.body;
  res.json(await verifyCode(code, { markAttended }));
});
