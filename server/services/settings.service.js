import { DEFAULT_SETTINGS } from '../../shared/constants.js';
import { addDays, nowInTimezone } from '../../shared/time.js';
import { currentInstant } from '../lib/clock.js';
import { isDuplicateKey } from '../lib/errors.js';
import { Settings } from '../models/index.js';

/**
 * One-time data fixes, applied once per settings document (idempotent: the id is stored).
 * 2026-11-19: Tiago asked for start times every 30 minutes, so days that started every
 * 60+ minutes move to 30. The admin can still pick another step afterwards.
 */
const MIGRATIONS = [
  {
    id: '2026-11-19-starts-every-30',
    update: { $set: { 'workingHours.$[day].slotDurationMinutes': 30 } },
    arrayFilters: [{ 'day.slotDurationMinutes': { $gt: 30 } }],
  },
];

async function applyMigrations(doc) {
  const pending = MIGRATIONS.filter((m) => !(doc.appliedMigrations || []).includes(m.id));
  if (!pending.length) return doc;
  for (const m of pending) {
    await Settings.updateOne(
      { key: 'main', appliedMigrations: { $ne: m.id } },
      { ...m.update, $addToSet: { appliedMigrations: m.id } },
      { arrayFilters: m.arrayFilters, runValidators: false },
    );
  }
  return Settings.findOne({ key: 'main' }).lean();
}

/** Returns the settings singleton as a plain object, creating it with defaults on first use. */
export async function getSettingsDoc() {
  let doc = await Settings.findOne({ key: 'main' }).lean();
  if (doc) return applyMigrations(doc);
  try {
    await Settings.create({ key: 'main' });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
  }
  doc = await Settings.findOne({ key: 'main' }).lean();
  return applyMigrations(doc);
}

export function businessNow(settings) {
  return nowInTimezone(settings.timezone || DEFAULT_SETTINGS.timezone, currentInstant());
}

/** What the public portal needs. Never includes admin-only rules or block reasons. */
export function toPublicSettings(settings) {
  const now = businessNow(settings);
  return {
    businessName: settings.businessName,
    phone: settings.phone,
    instagramUrl: settings.instagramUrl,
    logoUrl: settings.logoUrl,
    timezone: settings.timezone,
    themeColors: settings.themeColors,
    workingHours: settings.workingHours,
    services: (settings.services || [])
      .filter((s) => s.isActive)
      .map(({ key, name, durationMinutes }) => ({ key, name, durationMinutes })),
    booking: {
      windowDays: settings.booking.windowDays,
      minLeadMinutes: settings.booking.minLeadMinutes,
      // Shown in «Lo que debes saber»; the server enforces it either way.
      maxActivePerPhone: settings.booking.maxActivePerPhone,
    },
    blockedDates: (settings.blockedDates || []).filter((b) => b.date >= now.date).map((b) => ({ date: b.date })),
    now,
  };
}

/** Full settings for the admin panel. */
export function toAdminSettings(settings) {
  const now = businessNow(settings);
  return {
    businessName: settings.businessName,
    phone: settings.phone,
    instagramUrl: settings.instagramUrl,
    logoUrl: settings.logoUrl,
    timezone: settings.timezone,
    themeColors: settings.themeColors,
    workingHours: settings.workingHours,
    services: settings.services,
    booking: settings.booking,
    blockedDates: [...(settings.blockedDates || [])].sort((a, b) => (a.date < b.date ? -1 : 1)),
    updatedAt: settings.updatedAt,
    now,
  };
}

export async function updateSettings(patch) {
  await getSettingsDoc();
  const set = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'booking' || key === 'themeColors') {
      for (const [sub, subValue] of Object.entries(value)) set[`${key}.${sub}`] = subValue;
    } else if (key === 'workingHours') {
      set.workingHours = [...value].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    } else {
      set[key] = value;
    }
  }
  const doc = await Settings.findOneAndUpdate(
    { key: 'main' },
    { $set: set },
    { returnDocument: 'after', runValidators: true, lean: true },
  );
  return doc;
}

export async function blockDate({ date, reason }) {
  const settings = await getSettingsDoc();
  const pruneBefore = addDays(businessNow(settings).date, -60);
  await Settings.updateOne({ key: 'main' }, { $pull: { blockedDates: { date: { $lt: pruneBefore } } } });
  const updated = await Settings.updateOne(
    { key: 'main', 'blockedDates.date': date },
    { $set: { 'blockedDates.$.reason': reason } },
  );
  if (updated.matchedCount === 0) {
    await Settings.updateOne(
      { key: 'main', 'blockedDates.date': { $ne: date } },
      { $push: { blockedDates: { date, reason } } },
    );
  }
  return getSettingsDoc();
}

export async function unblockDate(date) {
  await Settings.updateOne({ key: 'main' }, { $pull: { blockedDates: { date } } });
  return getSettingsDoc();
}
