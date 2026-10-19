import { CalendarDate } from "@internationalized/date";
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

/** The calendar fields of a `UCalendar` date value (`month` is 1 to 12). */
export interface CalendarDay {
  year: number;
  month: number;
  day: number;
}

export type TimeOfDay = "morning" | "afternoon" | "evening";

export function useLisbonTime() {
  const { locale, t } = useI18n();

  const lisbon = (ms: number) => dayjs(ms).tz(LISBON_TZ).locale(locale.value);

  const now = () => dayjs().valueOf();

  const startOfDay = (ms: number) => lisbon(ms).startOf("day").valueOf();

  // dayjs keeps the old UTC offset when adding across a clock change, so the wall-clock
  // result is re-read in Lisbon time instead of trusting the shifted instant.
  const addDays = (ms: number, days: number) =>
    dayjs.tz(lisbon(ms).add(days, "day").format("YYYY-MM-DDTHH:mm:ss.SSS"), LISBON_TZ).valueOf();

  /** The instant at which the Lisbon wall clock reads `hour:minute` on the given day. */
  const atTime = ({ dayMs, hour, minute = 0 }: AtTimeOptions) =>
    lisbon(dayMs).startOf("day").hour(hour).minute(minute).valueOf();

  function timeOfDay(ms: number): TimeOfDay {
    const hour = lisbon(ms).hour();
    if (hour < 12) return "morning";
    return hour < 18 ? "afternoon" : "evening";
  }

  const formatTime = (ms: number) => lisbon(ms).format("HH:mm");

  const formatRange = ({ startAt, endAt }: TimeRange) =>
    `${formatTime(startAt)}–${formatTime(endAt)}`;

  function formatDuration({ startAt, endAt }: TimeRange) {
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

  /** Whether two instants fall on the same Lisbon calendar day. */
  const isSameDay = (a: number, b: number) => lisbon(a).isSame(lisbon(b), "day");

  // dayjs's isToday/isYesterday plugins compare against the browser zone, not Lisbon.
  const isToday = (ms: number) => lisbon(ms).isSame(lisbon(now()), "day");
  const isYesterday = (ms: number) => lisbon(ms).isSame(lisbon(now()).subtract(1, "day"), "day");

  /** Chat date separator: "Today", "Yesterday" or the long day. */
  function formatDayLabel(ms: number) {
    if (isToday(ms)) return t("chat.today");
    if (isYesterday(ms)) return t("chat.yesterday");
    return formatLongDay(ms);
  }

  /** Conversation list stamp: the time today, "Yesterday", else the short day. */
  function formatStamp(ms: number) {
    if (isToday(ms)) return formatTime(ms);
    if (isYesterday(ms)) return t("chat.yesterday");
    return formatShortDay(ms);
  }

  /** Whole years since an ISO `YYYY-MM-DD` birth date, on the Lisbon calendar. */
  const ageFromBirthDate = (birthDate: string) =>
    lisbon(now()).diff(dayjs.tz(birthDate, LISBON_TZ), "year");

  const startOfMonth = (ms: number) => lisbon(ms).startOf("month").valueOf();

  const dayBounds = (ms: number) => ({ from: startOfDay(ms), to: addDays(startOfDay(ms), 1) });

  const monthBounds = (ms: number) => ({
    from: startOfMonth(ms),
    to: lisbon(ms).endOf("month").add(1, "millisecond").valueOf(),
  });

  const toCalendarDate = (ms: number) => {
    const date = lisbon(ms);
    return new CalendarDate(date.year(), date.month() + 1, date.date());
  };

  const startOfCalendarDay = ({ year, month, day }: CalendarDay) => {
    const iso = [year, month, day].map((part) => String(part).padStart(2, "0")).join("-");
    return dayjs.tz(iso, LISBON_TZ).valueOf();
  };

  /** Every 30-minute instant of a Lisbon day, from 00:00 to the next midnight inclusive. */
  function halfHours(ms: number) {
    const { from, to } = dayBounds(ms);
    const steps: number[] = [];
    for (let at = dayjs(from); !at.isAfter(to); at = at.add(30, "minute")) {
      steps.push(at.valueOf());
    }
    return steps;
  }

  return {
    now,
    ageFromBirthDate,
    startOfDay,
    addDays,
    atTime,
    timeOfDay,
    formatTime,
    formatRange,
    formatDuration,
    formatWeekday,
    formatDayNumber,
    formatLongDay,
    formatShortDay,
    formatYear,
    isSameDay,
    formatDayLabel,
    formatStamp,
    startOfMonth,
    dayBounds,
    monthBounds,
    toCalendarDate,
    startOfCalendarDay,
    halfHours,
  };
}

export type LisbonTime = ReturnType<typeof useLisbonTime>;
