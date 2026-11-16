import mongoose from 'mongoose';
import { CSRF_HEADER, CSRF_HEADER_VALUE } from '../../shared/constants.js';
import { issuesToDetails } from '../../shared/schemas.js';
import { connectDB } from '../lib/db.js';
import { AppError } from '../lib/errors.js';
import { requireAdminSession } from '../services/auth.service.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Every state-changing request must carry X-Requested-With: nails-art (CSRF defence in depth). */
export function csrfGuard(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (req.get(CSRF_HEADER) !== CSRF_HEADER_VALUE) {
    throw new AppError(403, 'Solicitud no permitida.', { code: 'CSRF' });
  }
  return next();
}

export async function withDb(_req, _res, next) {
  try {
    await connectDB();
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('[db] connection failed', error);
    throw new AppError(503, 'El servicio no está disponible en este momento. Intenta en unos minutos.', { code: 'DB_UNAVAILABLE' });
  }
  return next();
}

export async function requireAdmin(req, _res, next) {
  req.admin = await requireAdminSession(req);
  return next();
}

/**
 * Validates req[source] with a zod schema and stores the parsed value in req.valid[source]
 * (Express 5 makes req.query read-only, so parsed data never overwrites the original).
 */
export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      const details = issuesToDetails(result.error);
      throw new AppError(422, details[0]?.message || 'Revisa los datos enviados.', { code: 'VALIDATION', details });
    }
    req.valid = { ...(req.valid || {}), [source]: result.data };
    return next();
  };
}

export function notFoundHandler(_req, _res) {
  throw new AppError(404, 'Ruta no encontrada.', { code: 'ROUTE_NOT_FOUND' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (res.headersSent) return;
  if (err instanceof AppError) {
    const body = { error: err.message };
    if (err.code) body.code = err.code;
    if (err.details) body.details = err.details;
    res.status(err.status).json(body);
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'El cuerpo de la solicitud no es JSON válido.', code: 'BAD_JSON' });
    return;
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: 'La solicitud es demasiado grande.', code: 'TOO_LARGE' });
    return;
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
    res.status(422).json({ error: 'Revisa los datos enviados.', code: 'VALIDATION', details });
    return;
  }
  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({ error: 'Identificador inválido.', code: 'BAD_ID' });
    return;
  }
  if (err?.code === 11000) {
    res.status(409).json({ error: 'Ese registro ya existe.', code: 'DUPLICATE' });
    return;
  }
  console.error('[api] unexpected error', err);
  res.status(500).json({ error: 'Algo salió mal. Intenta de nuevo.', code: 'INTERNAL' });
}
