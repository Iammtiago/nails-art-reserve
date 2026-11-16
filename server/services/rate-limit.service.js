import { env } from '../config/env.js';
import { AppError, isDuplicateKey } from '../lib/errors.js';
import { RateLimit } from '../models/index.js';

function windowKey(key, windowMs, at = Date.now()) {
  const start = Math.floor(at / windowMs) * windowMs;
  return { id: `${key}:${start}`, resetAt: start + windowMs };
}

/** Adds one hit to the counter and returns the new count. */
export async function hit(key, windowMs) {
  const { id, resetAt } = windowKey(key, windowMs);
  const update = { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(resetAt) } };
  try {
    const doc = await RateLimit.findOneAndUpdate({ key: id }, update, { upsert: true, returnDocument: 'after', lean: true });
    return { count: doc.count, resetAt };
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    const doc = await RateLimit.findOneAndUpdate({ key: id }, update, { returnDocument: 'after', lean: true });
    return { count: doc?.count ?? 1, resetAt };
  }
}

export async function peek(key, windowMs) {
  const { id, resetAt } = windowKey(key, windowMs);
  const doc = await RateLimit.findOne({ key: id }, { count: 1 }).lean();
  return { count: doc?.count ?? 0, resetAt };
}

export function tooMany(message, resetAt) {
  const minutes = Math.max(1, Math.ceil((resetAt - Date.now()) / 60_000));
  return new AppError(429, `${message} Intenta de nuevo en ${minutes} min.`, { code: 'RATE_LIMITED' });
}

/** Express middleware: every request counts. */
export function rateLimit({ bucket, limit, windowMs, message = 'Demasiadas solicitudes.' }) {
  return async (req, _res, next) => {
    if (!env().rateLimitsEnabled) return next();
    const { count, resetAt } = await hit(`${bucket}:${req.ip}`, windowMs);
    if (count > limit) throw tooMany(message, resetAt);
    return next();
  };
}
