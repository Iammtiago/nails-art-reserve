import mongoose from 'mongoose';
import {
  DEFAULT_BOOKING_RULES,
  DEFAULT_SERVICES,
  DEFAULT_SETTINGS,
  DEFAULT_THEME,
  DEFAULT_WORKING_HOURS,
  LIMITS,
  SLOT_DURATION_OPTIONS,
} from '../../shared/constants.js';

const { Schema } = mongoose;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const OPTIONAL_TIME_RE = /^(|([01]\d|2[0-3]):([0-5]\d))$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HEX_RE = /^#[0-9A-F]{6}$/;

const workingDaySchema = new Schema(
  {
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    isOpen: { type: Boolean, default: true },
    openTime: { type: String, required: true, match: TIME_RE },
    closeTime: { type: String, required: true, match: TIME_RE },
    breakStart: { type: String, default: '', match: OPTIONAL_TIME_RE },
    breakEnd: { type: String, default: '', match: OPTIONAL_TIME_RE },
    slotDurationMinutes: { type: Number, required: true, enum: SLOT_DURATION_OPTIONS },
  },
  { _id: false },
);

const serviceSchema = new Schema(
  {
    key: { type: String, required: true, match: /^[a-z0-9-]{1,40}$/ },
    name: { type: String, required: true, trim: true, maxlength: LIMITS.serviceNameMax },
    durationMinutes: { type: Number, required: true, min: 15, max: 240 },
    isActive: { type: Boolean, default: true },
  },
  { _id: false },
);

const blockedDateSchema = new Schema(
  {
    date: { type: String, required: true, match: DATE_RE },
    reason: { type: String, default: '', maxlength: LIMITS.blockReasonMax },
  },
  { _id: false },
);

const colorField = (fallback) => ({ type: String, match: HEX_RE, default: fallback });

const settingsSchema = new Schema(
  {
    // Singleton: there is exactly one settings document, key "main".
    key: { type: String, default: 'main', unique: true },
    businessName: { type: String, default: DEFAULT_SETTINGS.businessName, trim: true, maxlength: LIMITS.businessNameMax },
    phone: { type: String, default: DEFAULT_SETTINGS.phone, match: /^\d{8,15}$/ },
    instagramUrl: { type: String, default: DEFAULT_SETTINGS.instagramUrl, maxlength: 200 },
    logoUrl: { type: String, default: DEFAULT_SETTINGS.logoUrl, maxlength: LIMITS.logoDataUrlMaxChars },
    timezone: { type: String, default: DEFAULT_SETTINGS.timezone },
    themeColors: {
      primary: colorField(DEFAULT_THEME.primary),
      secondary: colorField(DEFAULT_THEME.secondary),
      accent: colorField(DEFAULT_THEME.accent),
      background: colorField(DEFAULT_THEME.background),
      text: colorField(DEFAULT_THEME.text),
    },
    workingHours: {
      type: [workingDaySchema],
      default: () => DEFAULT_WORKING_HOURS.map((d) => ({ ...d })),
      validate: { validator: (v) => Array.isArray(v) && v.length === 7, message: 'El horario debe tener 7 días.' },
    },
    services: {
      type: [serviceSchema],
      default: () => DEFAULT_SERVICES.map((s) => ({ ...s })),
    },
    booking: {
      windowDays: { type: Number, default: DEFAULT_BOOKING_RULES.windowDays, min: 1, max: LIMITS.bookingWindowMaxDays },
      minLeadMinutes: { type: Number, default: DEFAULT_BOOKING_RULES.minLeadMinutes, min: 0, max: 1440 },
      maxActivePerPhone: {
        type: Number,
        default: DEFAULT_BOOKING_RULES.maxActivePerPhone,
        min: 1,
        max: LIMITS.maxActivePerPhoneMax,
      },
    },
    blockedDates: { type: [blockedDateSchema], default: [] },
  },
  { timestamps: true, minimize: false },
);

export const Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
