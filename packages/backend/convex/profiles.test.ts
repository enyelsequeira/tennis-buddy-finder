import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { ageOn } from "./model/time";
import { createUser, NOW, setup, type T } from "./test.helpers";

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
  it("counts the birthday from Lisbon midnight in summer (WEST)", () => {
    expect(ageOn("2008-07-15", Date.UTC(2026, 6, 14, 23, 30))).toBe(18);
    expect(ageOn("2008-07-15", Date.UTC(2026, 6, 14, 22, 59))).toBe(17);
  });
  it("counts the birthday from Lisbon midnight in winter (WET)", () => {
    expect(ageOn("2008-01-15", Date.UTC(2026, 0, 15, 0, 0))).toBe(18);
    expect(ageOn("2008-01-15", Date.UTC(2026, 0, 14, 23, 59))).toBe(17);
  });
  it("counts a leap-day birthday from 1 March in non-leap years", () => {
    expect(ageOn("2008-02-29", Date.UTC(2026, 1, 28, 12))).toBe(17);
    expect(ageOn("2008-02-29", Date.UTC(2026, 2, 1, 12))).toBe(18);
  });
  it("throws on an invalid ISO date", () => {
    expect(() => ageOn("2008-02-30", NOW)).toThrow("Invalid ISO date");
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

  it("accepts a user turning 18 today", async () => {
    const t = setup();
    const u = await createUser(t, { profile: false });
    await u.as.mutation(api.profiles.create, { ...validInput, birthDate: "2008-09-08" });
    const mine = await u.as.query(api.profiles.mine, {});
    expect(mine.birthDate).toBe("2008-09-08");
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

  it("returns only the public card, without birthDate, gender or profile ids", async () => {
    const t = setup();
    const viewer = await createUser(t);
    const other = await createUser(t);
    await other.as.mutation(api.profiles.update, {
      ...validInput,
      gender: "female",
      bio: "Saque e volei",
      handedness: "left",
    });
    const p = await viewer.as.query(api.profiles.getByUserId, { userId: other.userId });
    expect(p).toEqual({
      userId: other.userId,
      displayName: "Ana",
      age: 36,
      ntrp: 3.5,
      yearsPlaying: 4,
      formats: "both",
      languages: ["pt"],
      municipality: "Figueira da Foz",
      district: "Coimbra",
      handedness: "left",
      bio: "Saque e volei",
    });
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

/** Stores a file like an upload-URL POST would; convex-test does not record `contentType` itself. */
function storeFile(t: T, contentType: string, size = 1024) {
  return t.run(async (ctx) => {
    const id = await ctx.storage.store(new Blob([new Uint8Array(size)], { type: contentType }));
    await (ctx.db.patch as (id: Id<"_storage">, value: { contentType: string }) => Promise<void>)(
      id,
      { contentType },
    );
    return id;
  });
}

function storageExists(t: T, id: Id<"_storage">) {
  return t.run(async (ctx) => (await ctx.db.system.get("_storage", id)) !== null);
}

describe("profile avatars", () => {
  it("generateAvatarUploadUrl works before a profile exists", async () => {
    const t = setup();
    const u = await createUser(t, { profile: false });
    const url = await u.as.mutation(api.profiles.generateAvatarUploadUrl, {});
    expect(url).toMatch(/^https:\/\//);
  });

  it("create accepts the caller's own image", async () => {
    const t = setup();
    const u = await createUser(t, { profile: false });
    const avatarStorageId = await storeFile(t, "image/png");
    await u.as.mutation(api.profiles.create, { ...validInput, avatarStorageId });
    const mine = await u.as.query(api.profiles.mine, {});
    expect(mine.avatarStorageId).toBe(avatarStorageId);
  });

  it("rejects another user's avatar on create and update", async () => {
    const t = setup();
    const owner = await createUser(t);
    const avatarStorageId = await storeFile(t, "image/jpeg");
    await owner.as.mutation(api.profiles.update, { ...validInput, avatarStorageId });

    const newcomer = await createUser(t, { profile: false });
    await expect(
      newcomer.as.mutation(api.profiles.create, { ...validInput, avatarStorageId }),
    ).rejects.toThrow("FORBIDDEN");
    const other = await createUser(t);
    await expect(
      other.as.mutation(api.profiles.update, { ...validInput, avatarStorageId }),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("rejects a non-image file", async () => {
    const t = setup();
    const u = await createUser(t, { profile: false });
    const avatarStorageId = await storeFile(t, "application/pdf");
    await expect(
      u.as.mutation(api.profiles.create, { ...validInput, avatarStorageId }),
    ).rejects.toThrow("INVALID_AVATAR");
  });

  it("rejects an image over 2 MB", async () => {
    const t = setup();
    const u = await createUser(t);
    const avatarStorageId = await storeFile(t, "image/webp", 2 * 1024 * 1024 + 1);
    await expect(
      u.as.mutation(api.profiles.update, { ...validInput, avatarStorageId }),
    ).rejects.toThrow("INVALID_AVATAR");
  });

  it("accepts an image of exactly 2 MB", async () => {
    const t = setup();
    const u = await createUser(t);
    const avatarStorageId = await storeFile(t, "image/png", 2 * 1024 * 1024);
    await u.as.mutation(api.profiles.update, { ...validInput, avatarStorageId });
    const profile = await u.as.query(api.profiles.mine, {});
    expect(profile.avatarStorageId).toBe(avatarStorageId);
  });

  it("rejects a file uploaded without a content type", async () => {
    const t = setup();
    const u = await createUser(t);
    const avatarStorageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob([new Uint8Array(16)])),
    );
    await expect(
      u.as.mutation(api.profiles.update, { ...validInput, avatarStorageId }),
    ).rejects.toThrow("INVALID_AVATAR");
  });

  it("rejects a storage id whose file no longer exists", async () => {
    const t = setup();
    const u = await createUser(t);
    const avatarStorageId = await storeFile(t, "image/png");
    await t.run(async (ctx) => ctx.storage.delete(avatarStorageId));
    await expect(
      u.as.mutation(api.profiles.update, { ...validInput, avatarStorageId }),
    ).rejects.toThrow("INVALID_AVATAR");
  });

  it("update replaces the avatar and deletes the old file", async () => {
    const t = setup();
    const u = await createUser(t);
    const first = await storeFile(t, "image/png");
    const second = await storeFile(t, "image/png");
    await u.as.mutation(api.profiles.update, { ...validInput, avatarStorageId: first });
    await u.as.mutation(api.profiles.update, { ...validInput, avatarStorageId: second });

    expect((await u.as.query(api.profiles.mine, {})).avatarStorageId).toBe(second);
    expect(await storageExists(t, first)).toBe(false);
    expect(await storageExists(t, second)).toBe(true);
  });

  it("update does not delete a previous avatar the caller never claimed", async () => {
    const t = setup();
    const u = await createUser(t);
    const unclaimed = await storeFile(t, "image/png");
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", u.userId))
        .unique();
      await ctx.db.patch("profiles", profile!._id, { avatarStorageId: unclaimed });
    });
    const avatarStorageId = await storeFile(t, "image/png");
    await u.as.mutation(api.profiles.update, { ...validInput, avatarStorageId });

    expect(await storageExists(t, unclaimed)).toBe(true);
  });

  it("update keeps the avatar when it is resent or omitted", async () => {
    const t = setup();
    const u = await createUser(t);
    const avatarStorageId = await storeFile(t, "image/png");
    await u.as.mutation(api.profiles.update, { ...validInput, avatarStorageId });
    await u.as.mutation(api.profiles.update, { ...validInput, avatarStorageId });
    await u.as.mutation(api.profiles.update, validInput);

    expect((await u.as.query(api.profiles.mine, {})).avatarStorageId).toBe(avatarStorageId);
    expect(await storageExists(t, avatarStorageId)).toBe(true);
  });
});
