import { describe, expect, it } from "vitest";

import { api, internal } from "./_generated/api";
import { createUser, setup } from "./test.helpers";

describe("users.me", () => {
  it("throws UNAUTHENTICATED without identity", async () => {
    const t = setup();
    await expect(t.query(api.users.me, {})).rejects.toThrow("UNAUTHENTICATED");
  });

  it("throws UNAUTHENTICATED for an identity with no users row", async () => {
    const t = setup();
    await expect(t.withIdentity({ subject: "ghost" }).query(api.users.me, {})).rejects.toThrow(
      "UNAUTHENTICATED",
    );
  });

  it("throws UNAUTHENTICATED for a banned user", async () => {
    const t = setup();
    const banned = await createUser(t, { bannedAt: 1 });
    await expect(banned.as.query(api.users.me, {})).rejects.toThrow("UNAUTHENTICATED");
  });

  it("returns user and null profile before onboarding", async () => {
    const t = setup();
    const u = await createUser(t, { profile: false });
    const me = await u.as.query(api.users.me, {});
    expect(me.user._id).toBe(u.userId);
    expect(me.profile).toBeNull();
  });

  it("returns user and profile after onboarding", async () => {
    const t = setup();
    const u = await createUser(t);
    const me = await u.as.query(api.users.me, {});
    expect(me.profile?.userId).toBe(u.userId);
  });
});

describe("users.setEmailNotifications", () => {
  it("flips the flag", async () => {
    const t = setup();
    const u = await createUser(t);
    await u.as.mutation(api.users.setEmailNotifications, { enabled: false });
    const me = await u.as.query(api.users.me, {});
    expect(me.user.emailNotifications).toBe(false);
  });
});

describe("users.internalCreateFromAuth", () => {
  it("creates a users row and is idempotent on authId", async () => {
    const t = setup();
    const first = await t.mutation(internal.users.internalCreateFromAuth, {
      authId: "ba_1",
      email: "x@test.pt",
      name: "X",
    });
    const second = await t.mutation(internal.users.internalCreateFromAuth, {
      authId: "ba_1",
      email: "x@test.pt",
      name: "X",
    });
    expect(second).toBe(first);
    const me = await t.withIdentity({ subject: "ba_1" }).query(api.users.me, {});
    expect(me.user.role).toBe("user");
    expect(me.user.emailNotifications).toBe(true);
  });
});
