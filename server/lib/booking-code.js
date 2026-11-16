import { randomInt } from 'node:crypto';
import { BOOKING_CODE_ALPHABET, BOOKING_CODE_LENGTH } from '../../shared/constants.js';

/** Cryptographically random 6-char code without ambiguous characters, e.g. NA84K2. */
export function generateBookingCode() {
  let code = '';
  for (let i = 0; i < BOOKING_CODE_LENGTH; i += 1) {
    code += BOOKING_CODE_ALPHABET[randomInt(BOOKING_CODE_ALPHABET.length)];
  }
  return code;
}
