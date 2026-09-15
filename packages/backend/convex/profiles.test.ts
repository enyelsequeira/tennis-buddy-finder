import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import { ageOn } from "./model/time";
import { createUser, NOW, setup } from "./test.helpers";

const validInput = {
  displayName: "Ana",
  birthDate: "1990-05-01",
  ntrp: 3.5,
  yearsPlaying: 4,
  formats: "both" as const,
  languages: ["pt"],
};

describe("ageOn", () => {
  it("counts a birthday that already happened this year", () => {
    expect(ageOn("2008-09-08", NOW)).toBe(18);
  });
  it("does not count a birthday still to come this year", () => {
    expect(ageOn("2008-09-09", NOW)).toBe(17);
  });
});

describe("profiles.create", () => {
  it("creates a profile fixed to Figueira da Foz / Coimbra", async () => {
    const t = setup();
    const u = await createUser(t, { profile: false });
    await u.as.mutation(api.profiles.create, validInput);
    const mine = await u.as.query(api.profiles.mine, {});
    expect(mine.municipality).toBe("Figueira da Foz");
    expect(mine.district).toBe("Coimbra");
    expect(mine.displayName).toBe("Ana");
  });

  it("rejects a second profile", async () => {
    const t = setup();
    const u = await createUser(t);
    await expect(u.as.mutation(api.profiles.create, validInput)).rejects.toThrow("PROFILE_EXISTS");
  });

  it("rejects under 18", async () => {
    const t = setup();
    const u = await createUser(t, { profile: false });
    await expect(
      u.as.mutation(api.profiles.create, { ...validInput, birthDate: "2008-09-09" }),
    ).rejects.toThrow("UNDERAGE");
  });

  it("rejects a malformed birth date", async () => {
    const t = setup();
    const u = await createUser(t, { profile: false });
    await expect(
      u.as.mutation(api.profiles.create, { ...validInput, birthDate: "01/05/1990" }),
    ).rejects.toThrow("INVALID_BIRTH_DATE");
  });

  it("rejects NTRP outside 1.0..7.0 or off the 0.5 grid", async () => {
    const t = setup();
    const u = await createUser(t, { profile: false });
    await expect(u.as.mutation(api.profiles.create, { ...validInput, ntrp: 7.5 })).rejects.toThrow(
      "INVALID_NTRP",
    );
    await expect(u.as.mutation(api.profiles.create, { ...validInput, ntrp: 3.2 })).rejects.toThrow(
      "INVALID_NTRP",
    );
  });

  it("requires at least one language", async () => {
    const t = setup();
    const u = await createUser(t, { profile: false });
    await expect(
      u.as.mutation(api.profiles.create, { ...validInput, languages: [] }),
    ).rejects.toThrow("INVALID_LANGUAGES");
  });
});

describe("profiles.update", () => {
  it("updates fields and keeps location fixed", async () => {
    const t = setup();
    const u = await createUser(t);
    await u.as.mutation(api.profiles.update, { ...validInput, displayName: "Ana B", ntrp: 4 });
    const mine = await u.as.query(api.profiles.mine, {});
    expect(mine.displayName).toBe("Ana B");
    expect(mine.ntrp).toBe(4);
    expect(mine.municipality).toBe("Figueira da Foz");
  });

  it("throws PROFILE_REQUIRED when there is no profile", async () => {
    const t = setup();
    const u = await createUser(t, { profile: false });
    await expect(u.as.mutation(api.profiles.update, validInput)).rejects.toThrow(
      "PROFILE_REQUIRED",
    );
  });
});

describe("profiles.getByUserId", () => {
  it("returns another player's profile with computed age", async () => {
    const t = setup();
    const viewer = await createUser(t);
    const other = await createUser(t);
    const p = await viewer.as.query(api.profiles.getByUserId, { userId: other.userId });
    expect(p.userId).toBe(other.userId);
    expect(p.age).toBe(36);
  });

  it("throws NOT_FOUND for a user without profile", async () => {
    const t = setup();
    const viewer = await createUser(t);
    const other = await createUser(t, { profile: false });
    await expect(
      viewer.as.query(api.profiles.getByUserId, { userId: other.userId }),
    ).rejects.toThrow("NOT_FOUND");
  });
});
