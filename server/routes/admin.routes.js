import { Router } from 'express';
import {
  accountSchema,
  adminAppointmentSchema,
  adminAppointmentsQuerySchema,
  adminClientsQuerySchema,
  adminRescheduleSchema,
  blockDateSchema,
  calendarQuerySchema,
  changePasswordSchema,
  clientUpdateSchema,
  dateParamSchema,
  idParamSchema,
  superKeySchema,
  timeBlockSchema,
} from '../../shared/schemas.js';
import { validate } from '../middleware/index.js';
import { changePassword, createAccount, deleteAccount, listAccounts } from '../services/account.service.js';
import { issueSession } from '../services/auth.service.js';
import { env } from '../config/env.js';
import { cancelByAdmin, completeAppointment, createAdminAppointment, createTimeBlock, getAdminTicket, listAppointments, rescheduleByAdmin } from '../services/appointment.service.js';

function publicBaseUrl(req) {
  return env().appUrl || `${req.protocol}://${req.get('host')}`;
}
import { addBlockedDate, getCalendar, removeBlockedDate } from '../services/calendar.service.js';
import { listClients, updateClient } from '../services/client.service.js';
import { lockSuper, purgeAppointment, purgeClient, requireSuper, superStatus, unlockSuper } from '../services/super.service.js';
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

// GET /api/admin/appointments/:id/ticket — QR and ticket data to download it again from the panel.
adminRouter.get('/appointments/:id/ticket', validate(idParamSchema, 'params'), async (req, res) => {
  res.json({ ticket: await getAdminTicket(req.valid.params.id, { baseUrl: publicBaseUrl(req) }) });
});

adminRouter.patch('/appointments/:id/complete', validate(idParamSchema, 'params'), async (req, res) => {
  res.json({ appointment: await completeAppointment(req.valid.params.id) });
});

adminRouter.patch('/appointments/:id/cancel', validate(idParamSchema, 'params'), async (req, res) => {
  res.json({ appointment: await cancelByAdmin(req.valid.params.id) });
});

// PATCH /api/admin/appointments/:id/reschedule — move a confirmed appointment to another free time.
adminRouter.patch('/appointments/:id/reschedule', validate(idParamSchema, 'params'), validate(adminRescheduleSchema), async (req, res) => {
  res.json({ appointment: await rescheduleByAdmin(req.valid.params.id, req.valid.body) });
});

adminRouter.get('/clients', validate(adminClientsQuerySchema, 'query'), async (req, res) => {
  res.json(await listClients(req.valid.query));
});

adminRouter.patch('/clients/:id', validate(idParamSchema, 'params'), validate(clientUpdateSchema), async (req, res) => {
  res.json({ client: await updateClient(req.valid.params.id, req.valid.body) });
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

// ---------- hidden superadmin mode ----------
// Four taps on a section title open the key prompt in the panel. Elevation lasts 15 minutes.

adminRouter.get('/super', async (req, res) => {
  res.json(await superStatus(req));
});

adminRouter.post('/super/unlock', validate(superKeySchema), async (req, res) => {
  res.json(await unlockSuper(req, res, req.valid.body));
});

adminRouter.post('/super/lock', (_req, res) => {
  res.json(lockSuper(res));
});

adminRouter.delete('/super/clients/:id', requireSuper, validate(idParamSchema, 'params'), async (req, res) => {
  res.json(await purgeClient(req.valid.params.id, req.admin));
});

adminRouter.delete('/super/appointments/:id', requireSuper, validate(idParamSchema, 'params'), async (req, res) => {
  res.json(await purgeAppointment(req.valid.params.id, req.admin));
});
