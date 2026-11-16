import { Router } from 'express';
import {
  adminAppointmentsQuerySchema,
  adminClientsQuerySchema,
  blockDateSchema,
  calendarQuerySchema,
  dateParamSchema,
  idParamSchema,
} from '../../shared/schemas.js';
import { validate } from '../middleware/index.js';
import { cancelByAdmin, completeAppointment, listAppointments } from '../services/appointment.service.js';
import { addBlockedDate, getCalendar, removeBlockedDate } from '../services/calendar.service.js';
import { listClients } from '../services/client.service.js';
import { getSettingsDoc, toAdminSettings } from '../services/settings.service.js';

// Every route here is mounted behind requireAdmin.
export const adminRouter = Router();

adminRouter.get('/settings', async (_req, res) => {
  res.json({ settings: toAdminSettings(await getSettingsDoc()) });
});

adminRouter.get('/appointments', validate(adminAppointmentsQuerySchema, 'query'), async (req, res) => {
  res.json(await listAppointments(req.valid.query));
});

adminRouter.patch('/appointments/:id/complete', validate(idParamSchema, 'params'), async (req, res) => {
  res.json({ appointment: await completeAppointment(req.valid.params.id) });
});

adminRouter.patch('/appointments/:id/cancel', validate(idParamSchema, 'params'), async (req, res) => {
  res.json({ appointment: await cancelByAdmin(req.valid.params.id) });
});

adminRouter.get('/clients', validate(adminClientsQuerySchema, 'query'), async (req, res) => {
  res.json(await listClients(req.valid.query));
});

adminRouter.get('/calendar', validate(calendarQuerySchema, 'query'), async (req, res) => {
  res.json(await getCalendar(req.valid.query));
});

adminRouter.post('/blocked-dates', validate(blockDateSchema), async (req, res) => {
  res.status(201).json(await addBlockedDate(req.valid.body));
});

adminRouter.delete('/blocked-dates/:date', validate(dateParamSchema, 'params'), async (req, res) => {
  res.json(await removeBlockedDate(req.valid.params.date));
});
