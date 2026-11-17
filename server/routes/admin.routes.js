import { Router } from 'express';
import {
  accountSchema,
  adminAppointmentSchema,
  adminAppointmentsQuerySchema,
  adminClientsQuerySchema,
  blockDateSchema,
  calendarQuerySchema,
  changePasswordSchema,
  dateParamSchema,
  idParamSchema,
  timeBlockSchema,
} from '../../shared/schemas.js';
import { validate } from '../middleware/index.js';
import { changePassword, createAccount, deleteAccount, listAccounts } from '../services/account.service.js';
import { issueSession } from '../services/auth.service.js';
import { env } from '../config/env.js';
import { cancelByAdmin, completeAppointment, createAdminAppointment, createTimeBlock, listAppointments } from '../services/appointment.service.js';

function publicBaseUrl(req) {
  return env().appUrl || `${req.protocol}://${req.get('host')}`;
}
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

// POST /api/admin/appointments — manual appointment (phone, WhatsApp, walk-in).
adminRouter.post('/appointments', validate(adminAppointmentSchema), async (req, res) => {
  res.status(201).json({ appointment: await createAdminAppointment(req.valid.body, { baseUrl: publicBaseUrl(req) }) });
});

// POST /api/admin/time-blocks — reserve a time range for the salon. Release it with
// PATCH /api/admin/appointments/:id/cancel.
adminRouter.post('/time-blocks', validate(timeBlockSchema), async (req, res) => {
  res.status(201).json({ block: await createTimeBlock(req.valid.body) });
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

// ---------- accounts (Cuentas) ----------

adminRouter.get('/accounts', async (req, res) => {
  res.json(await listAccounts(req.admin));
});

adminRouter.post('/accounts', validate(accountSchema), async (req, res) => {
  res.status(201).json({ account: await createAccount(req.valid.body, req.admin) });
});

adminRouter.patch('/accounts/:id/password', validate(idParamSchema, 'params'), validate(changePasswordSchema), async (req, res) => {
  const { account, doc, isSelf } = await changePassword(req.valid.params.id, req.valid.body, req.admin);
  // The session embeds a password fingerprint: renew it so you stay signed in after your own change.
  if (isSelf) await issueSession(res, doc);
  res.json({ account });
});

adminRouter.delete('/accounts/:id', validate(idParamSchema, 'params'), async (req, res) => {
  res.json(await deleteAccount(req.valid.params.id, req.admin));
});
