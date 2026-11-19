// The client's name and phone, remembered on her own device after a booking so the
// next one is prefilled. localStorage only (never sent anywhere else); every access is
// guarded because private mode or blocked storage can throw.

const KEY = 'nails-art:contact';

export function loadContact() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const clientName = typeof data?.clientName === 'string' ? data.clientName.slice(0, 80) : '';
    const clientPhone = typeof data?.clientPhone === 'string' ? data.clientPhone.slice(0, 25) : '';
    return clientName || clientPhone ? { clientName, clientPhone } : null;
  } catch {
    return null;
  }
}

export function saveContact({ clientName, clientPhone }) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ clientName: String(clientName || '').trim(), clientPhone: String(clientPhone || '').trim() }));
  } catch {
    // Storage unavailable: the form simply starts empty next time.
  }
}

export function forgetContact() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to forget.
  }
}
