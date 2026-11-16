// Phone numbers are stored as digits with country code (WhatsApp format), e.g. 584141234567.

import { DEFAULT_COUNTRY_CODE } from './constants.js';

/**
 * Normalizes a phone typed by a person.
 * - Venezuela by default: 0414-1234567, 414 1234567, 58 414 1234567 -> 584141234567
 * - Any country with a leading + or 00: +57 300 1234567 -> 573001234567
 * @returns {string|null} digits, or null when the number is not valid
 */
export function normalizePhone(input, defaultCountry = DEFAULT_COUNTRY_CODE) {
  if (typeof input !== 'string' && typeof input !== 'number') return null;
  const raw = String(input).trim();
  if (!raw || raw.length > 25) return null;
  if (/[^\d\s()+.-]/.test(raw)) return null;

  const international = raw.startsWith('+') || raw.startsWith('00');
  let digits = raw.replace(/\D/g, '');
  if (raw.startsWith('00')) digits = digits.slice(2);

  if (international) {
    if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
    if (digits.startsWith('58') && !isVenezuelanNational(digits.slice(2))) return null;
    return digits;
  }

  if (defaultCountry === '58') {
    if (digits.startsWith('58') && digits.length === 12 && isVenezuelanNational(digits.slice(2))) return digits;
    if (digits.length === 11 && digits.startsWith('0') && isVenezuelanNational(digits.slice(1))) return `58${digits.slice(1)}`;
    if (digits.length === 10 && isVenezuelanNational(digits)) return `58${digits}`;
    return null;
  }

  if (/^\d{7,12}$/.test(digits)) return `${defaultCountry}${digits.replace(/^0+/, '')}`;
  return null;
}

/** 10 national digits: mobile 4XX or landline 2XX. */
function isVenezuelanNational(national) {
  return /^[24]\d{9}$/.test(national);
}

/** 584147368595 -> +58 414-736-8595 */
export function formatPhone(digits) {
  if (!digits) return '';
  const d = String(digits);
  if (d.startsWith('58') && d.length === 12) return `+58 ${d.slice(2, 5)}-${d.slice(5, 8)}-${d.slice(8)}`;
  if (d.startsWith('57') && d.length === 12) return `+57 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  return `+${d}`;
}

export const PHONE_HINT = 'Ejemplo: 0414 123 4567. Si es de otro país, empieza con + y el código.';
