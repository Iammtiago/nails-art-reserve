import { Router } from 'express';
import { settingsUpdateSchema } from '../../shared/schemas.js';
import { requireAdmin, validate } from '../middleware/index.js';
import { getSettingsDoc, toAdminSettings, toPublicSettings, updateSettings } from '../services/settings.service.js';

export const settingsRouter = Router();

// GET /api/settings — public business profile, theme, hours and active services.
settingsRouter.get('/', async (_req, res) => {
  const settings = await getSettingsDoc();
  res.json({ settings: toPublicSettings(settings) });
});

// PUT /api/settings — admin only. Partial update: only the fields sent change.
settingsRouter.put('/', requireAdmin, validate(settingsUpdateSchema), async (req, res) => {
  const updated = await updateSettings(req.valid.body);
  res.json({ settings: toAdminSettings(updated) });
});
