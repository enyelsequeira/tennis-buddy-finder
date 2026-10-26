import { HOUR, MAX_SLOT_MS } from "@tennis-buddy-finder/backend/convex/model/time";
import type { TimeRange } from "../composables/useLisbonTime";

/** The latest end for a new slot from `startAt`: six hours later, or the next slot's start if sooner. */
export const latestEnd = (startAt: number, slots: TimeRange[]) =>
  Math.min(
    startAt + MAX_SLOT_MS,
    ...slots.filter((slot) => slot.startAt >= startAt).map((slot) => slot.startAt),
  );

/** "HH:mm", plus the zone for the hour Lisbon's autumn clock change repeats: "01:00 (WEST)" / "01:00 (WET)". */
export function timeLabel(at: number, formatTime: (ms: number) => string) {
  const label = formatTime(at);
  if (label === formatTime(at + HOUR)) return `${label} (WEST)`;
  return label === formatTime(at - HOUR) ? `${label} (WET)` : label;
}
