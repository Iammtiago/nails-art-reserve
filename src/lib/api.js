// The only HTTP client of the UI. Same-origin, JSON, CSRF header on every write,
// and one error type with field errors for forms.

import { CSRF_HEADER_VALUE } from '../../shared/constants.js';

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || 'No pudimos completar la solicitud. Intenta de nuevo.');
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.code || null;
    this.details = Array.isArray(body?.details) ? body.details : [];
  }

  /** { fieldPath: message } for inline form errors. */
  fieldErrors() {
    const map = {};
    for (const d of this.details) if (d.path && !map[d.path]) map[d.path] = d.message;
    return map;
  }
}

function buildUrl(path, query) {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export async function api(path, { method = 'GET', body, query, signal } = {}) {
  const headers = { Accept: 'application/json' };
  if (method !== 'GET') headers['X-Requested-With'] = CSRF_HEADER_VALUE;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new ApiError(0, { error: 'Sin conexión. Revisa tu internet e intenta de nuevo.', code: 'NETWORK' });
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!response.ok) throw new ApiError(response.status, data);
  return data;
}

export const apiGet = (path, query, opts) => api(path, { ...opts, query });
export const apiPost = (path, body, opts) => api(path, { ...opts, method: 'POST', body: body ?? {} });
export const apiPut = (path, body, opts) => api(path, { ...opts, method: 'PUT', body: body ?? {} });
export const apiPatch = (path, body, opts) => api(path, { ...opts, method: 'PATCH', body: body ?? {} });
export const apiDelete = (path, opts) => api(path, { ...opts, method: 'DELETE' });

export function errorMessage(error) {
  if (error instanceof ApiError) return error.message;
  return 'Algo salió mal. Intenta de nuevo.';
}
