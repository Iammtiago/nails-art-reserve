// Superadmin accounts and panel sessions.
// The first (and only) superadmin is created through a one-time setup that locks itself
// as soon as an account exists. Credentials never live in code, env files or chat.

import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { ADMIN_COOKIE } from '../../shared/constants.js';
import { SESSION_SECRET_MIN_LENGTH, SETUP_KEY_MIN_LENGTH, env } from '../config/env.js';
import { AppError, isDuplicateKey, unauthorized, unavailable } from '../lib/errors.js';
import { burnPasswordCheck, hashPassword, safeEqual, verifyPassword } from '../lib/password.js';
import { AdminUser, AppSecret } from '../models/index.js';
import { hit, peek, tooMany } from './rate-limit.service.js';

const SESSION_HOURS = 12;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;
const SETUP_WINDOW_MS = 15 * 60 * 1000;
const SETUP_MAX_ATTEMPTS = 5;

// ---------- session secret ----------

const secretCache = globalThis.__nailsArtSecret || (globalThis.__nailsArtSecret = { value: null });

/** ADMIN_SESSION_SECRET if set (32+ chars); otherwise a random key generated once and kept in MongoDB. */
async function sessionSecret() {
  const fromEnv = env().sessionSecret;
  if (fromEnv) {
    if (fromEnv.length < SESSION_SECRET_MIN_LENGTH) {
      throw unavailable('ADMIN_SESSION_SECRET debe tener al menos 32 caracteres.', 'SESSION_SECRET_WEAK');
    }
    return fromEnv;
  }
  if (secretCache.value) return secretCache.value;
  const existing = await AppSecret.findOne({ key: 'session' }).lean();
  if (existing) {
    secretCache.value = existing.value;
    return existing.value;
  }
  try {
    await AppSecret.create({ key: 'session', value: randomBytes(48).toString('base64url') });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
  }
  const stored = await AppSecret.findOne({ key: 'session' }).lean();
  secretCache.value = stored.value;
  return stored.value;
}

/** Changes when the password changes, so old sessions stop working. */
function passwordFingerprint(passwordHash) {
  return createHash('sha256').update(passwordHash).digest('base64url').slice(0, 16);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env().isProduction,
    path: '/',
    maxAge: SESSION_HOURS * 60 * 60 * 1000,
  };
}

export async function issueSession(res, admin) {
  const token = jwt.sign(
    { sub: String(admin._id), role: admin.role, pv: passwordFingerprint(admin.passwordHash) },
    await sessionSecret(),
    { algorithm: 'HS256', expiresIn: `${SESSION_HOURS}h` },
  );
  res.cookie(ADMIN_COOKIE, token, sessionCookieOptions());
}

export function clearSession(res) {
  const { maxAge, ...options } = sessionCookieOptions();
  res.clearCookie(ADMIN_COOKIE, options);
}

/** Returns the admin for a valid session cookie, or null. */
export async function adminFromRequest(req) {
  const token = req.cookies?.[ADMIN_COOKIE];
  if (!token) return null;
  let payload;
  try {
    payload = jwt.verify(token, await sessionSecret(), { algorithms: ['HS256'] });
  } catch {
    return null;
  }
  if (!payload?.sub || !/^[a-f0-9]{24}$/i.test(payload.sub)) return null;
  const admin = await AdminUser.findById(payload.sub, { username: 1, role: 1, passwordHash: 1 }).lean();
  if (!admin || payload.pv !== passwordFingerprint(admin.passwordHash)) return null;
  return { id: String(admin._id), username: admin.username, role: admin.role };
}

export async function requireAdminSession(req) {
  const admin = await adminFromRequest(req);
  if (!admin) throw unauthorized('Tu sesión terminó. Vuelve a entrar al panel.');
  return admin;
}

// ---------- setup (one time) ----------

function setupKeyConfigured() {
  return env().setupKey.length >= SETUP_KEY_MIN_LENGTH;
}

export async function authStatus(req) {
  const hasAdmin = Boolean(await AdminUser.exists({}));
  const admin = await adminFromRequest(req);
  return {
    authenticated: Boolean(admin),
    admin,
    hasAdmin,
    setupAvailable: !hasAdmin && setupKeyConfigured(),
    setupKeyConfigured: setupKeyConfigured(),
  };
}

export async function createSuperadmin({ setupKey, username, password }, { ip }) {
  if (await AdminUser.exists({})) {
    throw new AppError(410, 'El superadmin ya fue creado. Entra desde /admin.', { code: 'SETUP_DONE' });
  }
  if (!setupKeyConfigured()) {
    throw unavailable(
      `Configura la variable ADMIN_SETUP_KEY (mínimo ${SETUP_KEY_MIN_LENGTH} caracteres) en Vercel y vuelve a desplegar.`,
      'SETUP_KEY_MISSING',
    );
  }
  const limitKey = `setup:${ip}`;
  if (env().rateLimitsEnabled) {
    const { count, resetAt } = await peek(limitKey, SETUP_WINDOW_MS);
    if (count >= SETUP_MAX_ATTEMPTS) throw tooMany('Demasiados intentos.', resetAt);
  }
  if (!safeEqual(setupKey, env().setupKey)) {
    if (env().rateLimitsEnabled) await hit(limitKey, SETUP_WINDOW_MS);
    throw new AppError(403, 'La clave de instalación no es correcta.', { code: 'SETUP_KEY_INVALID' });
  }

  const passwordHash = await hashPassword(password);
  try {
    const admin = await AdminUser.create({ username, passwordHash, role: 'superadmin', setupSlot: 'initial' });
    return admin.toObject();
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw new AppError(410, 'El superadmin ya fue creado. Entra desde /admin.', { code: 'SETUP_DONE' });
    }
    throw error;
  }
}

// ---------- login ----------

export async function login({ username, password }, { ip }) {
  const limitKey = `login:${ip}`;
  const limited = env().rateLimitsEnabled;
  if (limited) {
    const { count, resetAt } = await peek(limitKey, LOGIN_WINDOW_MS);
    if (count >= LOGIN_MAX_FAILURES) throw tooMany('Demasiados intentos fallidos.', resetAt);
  }

  const admin = await AdminUser.findOne({ username }).lean();
  const valid = admin ? await verifyPassword(password, admin.passwordHash) : await burnPasswordCheck(password);
  if (!valid) {
    if (limited) await hit(limitKey, LOGIN_WINDOW_MS);
    throw new AppError(401, 'Usuario o contraseña incorrectos.', { code: 'BAD_CREDENTIALS' });
  }
  await AdminUser.updateOne({ _id: admin._id }, { $set: { lastLoginAt: new Date() } });
  return admin;
}
