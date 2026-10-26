import { HOUR } from "@tennis-buddy-finder/backend/convex/model/time";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { useLisbonTime } from "../composables/useLisbonTime";
import { latestEnd, timeLabel } from "./slotTimes";

// useI18n is a Nuxt auto-import global; the composable only needs the locale and t.
beforeAll(() => {
  vi.stubGlobal("useI18n", () => ({ locale: { value: "pt" }, t: (key: string) => key }));
});

describe("latestEnd", () => {
  const startAt = Date.UTC(2026, 8, 10, 9);

  test("caps a free day at six hours after the start", () => {
    expect(latestEnd(startAt, [])).toBe(startAt + 6 * HOUR);
  });

  test("caps at the start of the next slot when it comes sooner", () => {
    const slots = [
      { startAt: startAt - 2 * HOUR, endAt: startAt - HOUR },
      { startAt: startAt + 4 * HOUR, endAt: startAt + 5 * HOUR },
      { startAt: startAt + 2 * HOUR, endAt: startAt + 3 * HOUR },
    ];
    expect(latestEnd(startAt, slots)).toBe(startAt + 2 * HOUR);
  });
});

describe("timeLabel", () => {
  test("tells the repeated wall times of 25 Oct 2026 apart", () => {
    const { halfHours, formatTime } = useLisbonTime();
    const labels = halfHours(Date.UTC(2026, 9, 25, 12))
      .slice(0, -1)
      .map((at) => timeLabel(at, formatTime));
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels.slice(2, 6)).toEqual([
      "01:00 (WEST)",
      "01:30 (WEST)",
      "01:00 (WET)",
      "01:30 (WET)",
    ]);
    expect(labels[6]).toBe("02:00");
  });

  test("keeps plain labels on a normal day", () => {
    const { halfHours, formatTime } = useLisbonTime();
    const steps = halfHours(Date.UTC(2026, 8, 10, 12));
    expect(steps.map((at) => timeLabel(at, formatTime))).toEqual(steps.map(formatTime));
  });
});
