// Booking code parsing shared by the camera and the manual input.

import { BOOKING_CODE_ALPHABET, BOOKING_CODE_LENGTH, BOOKING_CODE_REGEX } from '@shared/constants.js';

// A run of exactly 6 code characters, not glued to other letters or digits.
const CODE_RUN_RE = new RegExp(`(?:^|[^A-Z0-9])([${BOOKING_CODE_ALPHABET}]{${BOOKING_CODE_LENGTH}})(?![A-Z0-9])`);
const AMBIGUOUS_RE = /[0O1IL]/;

export function isBookingCode(value) {
  return typeof value === 'string' && BOOKING_CODE_REGEX.test(value);
}

/**
 * Code from a scanned QR or pasted text: the ?codigo= of the ticket URL, or a bare code.
 * @returns {string|null}
 */
export function extractBookingCode(text) {
  const value = String(text ?? '').trim();
  if (!value) return null;
  try {
    const param = new URL(value).searchParams.get('codigo');
    if (param) {
      const code = param.trim().toUpperCase();
      return isBookingCode(code) ? code : null;
    }
  } catch {
    // Not a URL: look for a bare code below.
  }
  const match = CODE_RUN_RE.exec(value.toUpperCase());
  return match && isBookingCode(match[1]) ? match[1] : null;
}

/** Uppercases, keeps only code characters and flags 0/O/1/I/L, which codes never use. */
export function sanitizeCodeInput(raw) {
  const upper = String(raw ?? '').toUpperCase();
  let code = '';
  for (const char of upper) {
    if (BOOKING_CODE_ALPHABET.includes(char)) code += char;
  }
  return { code: code.slice(0, BOOKING_CODE_LENGTH), ambiguous: AMBIGUOUS_RE.test(upper) };
}

export { BOOKING_CODE_LENGTH };
