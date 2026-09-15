import { describe, expect, it } from "vitest";

import { NTRP_VALUES, profileInputSchema } from "./model/profileSchema";

const valid = {
  displayName: "Ana",
  birthDate: "1990-05-01",
  ntrp: 3.5,
  yearsPlaying: 4,
  formats: "both" as const,
  languages: ["pt"],
};

describe("profileInputSchema", () => {
  it("accepts the same input the backend accepts", () => {
    expect(profileInputSchema.safeParse(valid).success).toBe(true);
  });

  it("trims the display name", () => {
    const parsed = profileInputSchema.parse({ ...valid, displayName: "  Ana  " });
    expect(parsed.displayName).toBe("Ana");
  });

  it.each([
    ["short name", { displayName: "A" }],
    ["malformed birth date", { birthDate: "01/05/1990" }],
    ["under 18", { birthDate: new Date().toISOString().slice(0, 10) }],
    ["ntrp off grid", { ntrp: 3.2 }],
    ["ntrp too high", { ntrp: 7.5 }],
    ["negative years", { yearsPlaying: -1 }],
    ["no languages", { languages: [] }],
    ["bad language code", { languages: ["por"] }],
    ["long bio", { bio: "x".repeat(501) }],
  ])("rejects %s", (_label, override) => {
    expect(profileInputSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });

  it("lists NTRP values from 1.0 to 7.0 in 0.5 steps", () => {
    expect(NTRP_VALUES).toEqual([1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7]);
  });
});
