import { AdminUser } from './AdminUser.js';
import { AppSecret } from './AppSecret.js';
import { Appointment } from './Appointment.js';
import { Client } from './Client.js';
import { PurgeLog } from './PurgeLog.js';
import { RateLimit } from './RateLimit.js';
import { Settings } from './Settings.js';

export { AdminUser, AppSecret, Appointment, Client, PurgeLog, RateLimit, Settings };

export const ALL_MODELS = [Settings, Appointment, Client, AdminUser, RateLimit, AppSecret, PurgeLog];

/** Creates the indexes declared in the schemas. Idempotent and cheap when they exist. */
export async function ensureIndexes() {
  await Promise.all(ALL_MODELS.map((model) => model.createIndexes()));
}
