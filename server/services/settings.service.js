import { DEFAULT_SETTINGS } from '../../shared/constants.js';
import { addDays, nowInTimezone } from '../../shared/time.js';
import { currentInstant } from '../lib/clock.js';
import { isDuplicateKey } from '../lib/errors.js';
import { Settings } from '../models/index.js';

/** Returns the settings singleton as a plain object, creating it with defaults on first use. */
export async function getSettingsDoc() {
  let doc = await Settings.findOne({ key: 'main' }).lean();
  if (doc) return doc;
  try {
    await Settings.create({ key: 'main' });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
  }
  doc = await Settings.findOne({ key: 'main' }).lean();
  return doc;
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
