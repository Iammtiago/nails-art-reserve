import { Router } from 'express';
import { loginSchema } from '../../shared/schemas.js';
import { validate } from '../middleware/index.js';
import { authStatus, clearSession, issueSession, login, requireAdminSession } from '../services/auth.service.js';

export const authRouter = Router();

// GET /api/auth/status — is there a session?
authRouter.get('/status', async (req, res) => {
  res.json(await authStatus(req));
});

// GET /api/auth/session — 200 with the admin, or 401.
authRouter.get('/session', async (req, res) => {
  res.json({ admin: await requireAdminSession(req) });
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
