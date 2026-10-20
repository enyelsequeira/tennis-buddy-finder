const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
const SLOT_STEP_MS = 30 * MINUTE;
export const MAX_SLOT_MS = 6 * HOUR;
export const MIN_AGE = 18;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses `YYYY-MM-DD`; returns null when malformed or not a real date. */
export function parseIsoDate(value: string) {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    return null;
  }
  return { y, m, d };
}

/** Whole years between an ISO birth date and a timestamp (UTC calendar). */
export function ageOn(birthDate: string, at: number) {
  const parsed = parseIsoDate(birthDate);
  if (!parsed) throw new Error(`Invalid ISO date: ${birthDate}`);
  const now = new Date(at);
  let age = now.getUTCFullYear() - parsed.y;
  const beforeBirthday =
    now.getUTCMonth() + 1 < parsed.m ||
    (now.getUTCMonth() + 1 === parsed.m && now.getUTCDate() < parsed.d);
  if (beforeBirthday) age -= 1;
  return age;
}

export function isOnSlotGrid(ts: number) {
  return ts % SLOT_STEP_MS === 0;
}
