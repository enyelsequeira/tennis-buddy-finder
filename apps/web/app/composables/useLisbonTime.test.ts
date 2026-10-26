import { beforeAll, describe, expect, test, vi } from "vitest";
import { useLisbonTime } from "./useLisbonTime";

// useI18n is a Nuxt auto-import global; the composable only needs the locale and t.
beforeAll(() => {
  vi.stubGlobal("useI18n", () => ({ locale: { value: "pt" }, t: (key: string) => key }));
});

describe("atTime", () => {
  test("18:00 on 25 Oct 2026 (WEST to WET) is 18:00 Lisbon", () => {
    const { atTime } = useLisbonTime();
    expect(atTime({ dayMs: Date.UTC(2026, 9, 25, 12), hour: 18 })).toBe(Date.UTC(2026, 9, 25, 18));
  });

  test("18:00 on 28 Mar 2027 (WET to WEST) is 18:00 Lisbon", () => {
    const { atTime } = useLisbonTime();
    expect(atTime({ dayMs: Date.UTC(2027, 2, 28, 12), hour: 18 })).toBe(Date.UTC(2027, 2, 28, 17));
  });

  test("keeps the minute on a DST day", () => {
    const { atTime } = useLisbonTime();
    expect(atTime({ dayMs: Date.UTC(2026, 9, 25, 12), hour: 18, minute: 30 })).toBe(
      Date.UTC(2026, 9, 25, 18, 30),
    );
  });

  test("Lisbon midnight and 23:59 of a DST day give the same instant", () => {
    const { atTime } = useLisbonTime();
    const midnight = Date.UTC(2026, 9, 24, 23); // 00:00 WEST
    const lastMinute = Date.UTC(2026, 9, 25, 23, 59); // 23:59 WET
    expect(atTime({ dayMs: midnight, hour: 18 })).toBe(Date.UTC(2026, 9, 25, 18));
    expect(atTime({ dayMs: lastMinute, hour: 18 })).toBe(Date.UTC(2026, 9, 25, 18));
  });

  test("normal summer and winter days", () => {
    const { atTime } = useLisbonTime();
    expect(atTime({ dayMs: Date.UTC(2026, 8, 10, 12), hour: 18 })).toBe(Date.UTC(2026, 8, 10, 17));
    expect(atTime({ dayMs: Date.UTC(2026, 11, 10, 12), hour: 18 })).toBe(
      Date.UTC(2026, 11, 10, 18),
    );
  });
});

describe("addDays", () => {
  test("keeps the wall-clock time across 25 Oct 2026", () => {
    const { addDays } = useLisbonTime();
    expect(addDays(Date.UTC(2026, 9, 24, 17), 1)).toBe(Date.UTC(2026, 9, 25, 18));
  });
});

describe("halfHours", () => {
  test("covers the 25-hour day of 25 Oct 2026 from Lisbon midnight", () => {
    const { halfHours } = useLisbonTime();
    const steps = halfHours(Date.UTC(2026, 9, 25, 12));
    // 50 half hours plus the inclusive next midnight.
    expect(steps).toHaveLength(51);
    expect(steps[0]).toBe(Date.UTC(2026, 9, 24, 23));
    expect(steps.at(-1)).toBe(Date.UTC(2026, 9, 26, 0));
  });
});

describe("formatWeekday", () => {
  const saturday = Date.UTC(2026, 9, 24, 12);

  test("Saturday in pt is Sáb", () => {
    vi.stubGlobal("useI18n", () => ({ locale: { value: "pt" }, t: (key: string) => key }));
    expect(useLisbonTime().formatWeekday(saturday)).toBe("Sáb");
  });

  test("Tuesday in pt is still Ter", () => {
    vi.stubGlobal("useI18n", () => ({ locale: { value: "pt" }, t: (key: string) => key }));
    expect(useLisbonTime().formatWeekday(Date.UTC(2026, 9, 20, 12))).toBe("Ter");
  });

  test("Saturday in en is Sat", () => {
    vi.stubGlobal("useI18n", () => ({ locale: { value: "en" }, t: (key: string) => key }));
    expect(useLisbonTime().formatWeekday(saturday)).toBe("Sat");
  });
});
