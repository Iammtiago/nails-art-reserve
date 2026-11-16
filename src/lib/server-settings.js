// Server-only: reads the public settings straight from MongoDB during render
// (same code the API uses), deduplicated per request with React cache().

import 'server-only';
import { cache } from 'react';
import { DEFAULT_SETTINGS } from '../../shared/constants.js';
import { connectDB } from '../../server/lib/db.js';
import { getSettingsDoc, toPublicSettings } from '../../server/services/settings.service.js';

export const getPublicSettings = cache(async () => {
  try {
    await connectDB();
    return { settings: toPublicSettings(await getSettingsDoc()), error: null };
  } catch (error) {
    console.error('[render] settings unavailable', error?.message || error);
    return { settings: null, error: 'unavailable' };
  }
});

/** Theme colors for the <style> tag; falls back to the logo palette. */
export async function getThemeColors() {
  const { settings } = await getPublicSettings();
  return settings?.themeColors || DEFAULT_SETTINGS.themeColors;
}
