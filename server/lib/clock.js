// Injectable clock so tests can pin "now". Production always uses the real time.

let fixedInstant = null;

export function currentInstant() {
  return fixedInstant ? new Date(fixedInstant) : new Date();
}

/** Test helper: pass an ISO string to freeze time, or null to release it. */
export function setFixedInstant(iso) {
  fixedInstant = iso;
}
