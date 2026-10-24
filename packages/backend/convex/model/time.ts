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

const lisbonClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Lisbon",
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

/** Lisbon's UTC offset in ms at an instant (0 in winter, one hour in summer). */
function lisbonOffset(ms: number) {
  const parts = lisbonClock.formatToParts(ms);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const wall = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return wall - (ms - (ms % 1000));
}

/**
 * Adds whole calendar days on the Europe/Lisbon wall clock, keeping the time of day.
 * A wall time repeated by fall-back takes the earlier instant; one skipped by
 * spring-forward keeps the pre-gap offset, landing an hour later (like Temporal's "compatible").
 */
export function addLisbonDays(ms: number, days: number) {
  const wall = ms + lisbonOffset(ms) + days * DAY;
  const before = lisbonOffset(wall - DAY / 2);
  const after = lisbonOffset(wall + DAY / 2);
  const exact = [wall - Math.max(before, after), wall - Math.min(before, after)].find(
    (at) => at + lisbonOffset(at) === wall,
  );
  return exact ?? wall - before;
}

export function isOnSlotGrid(ts: number) {
  return ts % SLOT_STEP_MS === 0;
}
