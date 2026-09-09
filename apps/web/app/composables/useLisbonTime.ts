import dayjs from "dayjs";
import "dayjs/locale/en";
import "dayjs/locale/pt";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Owns every Europe/Lisbon formatting and day-boundary computation.
 * Timestamps in and out are milliseconds since epoch, UTC; the backend
 * never does timezone math. Weekday and month names follow the active
 * i18n locale; format patterns come from the `dates.*` translation keys.
 *
 * Call it in `<script setup>` (it reads the i18n context), then pass the
 * helpers you need into plain utilities.
 */

export const LISBON_TZ = "Europe/Lisbon";

export interface AtTimeOptions {
  /** Any instant on the target Lisbon day. */
  dayMs: number;
  hour: number;
  minute?: number;
}

export interface TimeRange {
  startAt: number;
  endAt: number;
}

export function useLisbonTime() {
  const { locale, t } = useI18n();

  const lisbon = (ms: number) => dayjs(ms).tz(LISBON_TZ).locale(locale.value);

  const now = () => dayjs().valueOf();

  const startOfDay = (ms: number) => lisbon(ms).startOf("day").valueOf();

  const addDays = (ms: number, days: number) => lisbon(ms).add(days, "day").valueOf();

  /** The instant at which the Lisbon wall clock reads `hour:minute` on the given day. */
  const atTime = ({ dayMs, hour, minute = 0 }: AtTimeOptions) =>
    lisbon(dayMs).startOf("day").hour(hour).minute(minute).valueOf();

  const formatTime = (ms: number) => lisbon(ms).format("HH:mm");

  const formatRange = ({ startAt, endAt }: TimeRange) =>
    `${formatTime(startAt)}–${formatTime(endAt)}`;

  function formatDuration({ startAt, endAt }: TimeRange): string {
    const minutes = dayjs(endAt).diff(startAt, "minute");
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (hours === 0) return `${rest} min`;
    return rest === 0 ? `${hours}h` : `${hours}h ${rest}`;
  }

  // dayjs's Portuguese locale is lowercase ("terça-feira"); labels start with a capital.
  const upperFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

  /** "Thu" / "Ter" */
  const formatWeekday = (ms: number) => upperFirst(lisbon(ms).format("ddd"));
  /** "11" */
  const formatDayNumber = (ms: number) => lisbon(ms).format("D");
  /** "Thursday 11 September" / "Quinta-feira, 11 de setembro" */
  const formatLongDay = (ms: number) => upperFirst(lisbon(ms).format(t("dates.longDay")));
  /** "Thu 11" / "Qui 11" */
  const formatShortDay = (ms: number) => upperFirst(lisbon(ms).format(t("dates.shortDay")));
  /** "2026" */
  const formatYear = (ms: number) => lisbon(ms).format("YYYY");

  return {
    now,
    startOfDay,
    addDays,
    atTime,
    formatTime,
    formatRange,
    formatDuration,
    formatWeekday,
    formatDayNumber,
    formatLongDay,
    formatShortDay,
    formatYear,
  };
}

export type LisbonTime = ReturnType<typeof useLisbonTime>;
