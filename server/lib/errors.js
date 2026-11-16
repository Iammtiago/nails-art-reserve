// One error type for the whole API. The error handler turns it into
// { error, code?, details? } with the right status.

export class AppError extends Error {
  /**
   * @param {number} status HTTP status
   * @param {string} message human message in Spanish, safe to show
   * @param {{ code?: string, details?: Array<{path: string, message: string}> }} [extra]
   */
  constructor(status, message, extra = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = extra.code;
    this.details = extra.details;
  }
}

export const notFound = (message = 'No encontrado.', code = 'NOT_FOUND') => new AppError(404, message, { code });
export const conflict = (message, code = 'CONFLICT') => new AppError(409, message, { code });
export const unprocessable = (message, code = 'UNPROCESSABLE', details) => new AppError(422, message, { code, details });
export const unauthorized = (message = 'Inicia sesión para continuar.') => new AppError(401, message, { code: 'UNAUTHORIZED' });
export const unavailable = (message, code = 'UNAVAILABLE') => new AppError(503, message, { code });

/** True when a MongoDB duplicate-key error touched the given field. */
export function isDuplicateKey(error, field) {
  if (!error || error.code !== 11000) return false;
  if (!field) return true;
  const pattern = error.keyPattern || {};
  const value = error.keyValue || {};
  return field in pattern || field in value || String(error.message || '').includes(field);
}
