import { Router } from 'express';
import { loginSchema, setupSchema } from '../../shared/schemas.js';
import { validate } from '../middleware/index.js';
import {
  authStatus,
  clearSession,
  createSuperadmin,
  issueSession,
  login,
  requireAdminSession,
} from '../services/auth.service.js';

export const authRouter = Router();

// GET /api/auth/status — is there a session, and is the one-time setup still open?
authRouter.get('/status', async (req, res) => {
  res.json(await authStatus(req));
});

// GET /api/auth/session — 200 with the admin, or 401.
authRouter.get('/session', async (req, res) => {
  res.json({ admin: await requireAdminSession(req) });
});

// POST /api/auth/setup — creates the superadmin once. Locks itself after the first account.
authRouter.post('/setup', validate(setupSchema), async (req, res) => {
  const admin = await createSuperadmin(req.valid.body, { ip: req.ip });
  await issueSession(res, admin);
  res.status(201).json({ admin: { id: String(admin._id), username: admin.username, role: admin.role } });
});

// POST /api/auth/login
authRouter.post('/login', validate(loginSchema), async (req, res) => {
  const admin = await login(req.valid.body, { ip: req.ip });
  await issueSession(res, admin);
  res.json({ admin: { id: String(admin._id), username: admin.username, role: admin.role } });
});

// POST /api/auth/logout
authRouter.post('/logout', (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});
