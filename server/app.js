// Express REST API. Runs standalone (server/index.js) and inside Next.js
// (src/pages/api/[...path].js) as a Vercel Function.

import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { csrfGuard, errorHandler, notFoundHandler, requireAdmin, withDb } from './middleware/index.js';
import { adminRouter } from './routes/admin.routes.js';
import { appointmentsRouter } from './routes/appointments.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { settingsRouter } from './routes/settings.routes.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Vercel (and most hosts) sit behind one proxy: trust it for req.ip and req.protocol.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-origin' },
    }),
  );

  // Inside Next the API is same-origin; CORS only matters for `npm run api` in local dev.
  const origins = env().corsOrigins;
  if (origins.length) app.use(cors({ origin: origins, credentials: true }));

  app.use(express.json({ limit: '4mb' }));
  app.use(cookieParser());
  app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api', csrfGuard);
  app.use('/api', withDb);
  app.use('/api/auth', authRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/appointments', appointmentsRouter);
  app.use('/api/admin', requireAdmin, adminRouter);
  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}
