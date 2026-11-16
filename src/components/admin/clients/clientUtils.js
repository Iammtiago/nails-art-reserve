// Small helpers for the client directory (pure, no React).

export const CLIENTS_PAGE_SIZE = 20;

function words(name) {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/** «María Fernanda López» -> «ML» (first and last word). */
export function initialsOf(name) {
  const list = words(name);
  if (!list.length) return '?';
  const first = Array.from(list[0])[0] || '';
  const last = list.length > 1 ? Array.from(list[list.length - 1])[0] || '' : '';
  return `${first}${last}`.toUpperCase();
}

export function firstNameOf(name) {
  return words(name)[0] || '';
}

/** Recurring (2+ visits) or brand new (one booking, no visits yet); null otherwise. */
export function clientTag(client) {
  if (client.completedAppointments >= 2) return { label: 'Recurrente', tone: 'success' };
  if (client.totalAppointments <= 1 && client.completedAppointments === 0) return { label: 'Nueva', tone: 'accent' };
  return null;
}

/** Copies text to the clipboard; falls back to a hidden textarea outside secure contexts. */
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/** Animation delay for staggered entries, capped at 300 ms. */
export function staggerDelay(index, step = 40, offset = 0) {
  return { animationDelay: `${Math.min(offset + index * step, 300)}ms` };
}
