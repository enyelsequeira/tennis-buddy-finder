import { describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  ban,
  createSlot,
  createUser,
  DAY,
  HOUR,
  match,
  NOW,
  page,
  setup,
  type TestUser,
  tomorrow10,
  week,
} from "./test.helpers";

type T = ReturnType<typeof setup>;

/** A Better Auth `user` doc, as the component passes it to the triggers. */
function authDoc(authId: string, overrides: { name?: string; email?: string } = {}) {
  return {
    _id: authId,
    _creationTime: NOW,
    name: overrides.name ?? "Auth User",
    email: overrides.email ?? `${authId}@test.pt`,
    emailVerified: false,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function deleteAccount(t: T, authId: string) {
  return t.mutation(internal.auth.onDelete, { model: "user", doc: authDoc(authId) });
}

async function searchSlotIds(user: TestUser) {
  const result = await user.as.query(api.availability.search, {
    ...week,
    minNtrp: 1,
    maxNtrp: 7,
    paginationOpts: page,
  });
  return result.page.map((row) => row.slot._id);
}

function get<Table extends "availabilitySlots" | "matchRequests" | "messages">(
  t: T,
  table: Table,
  id: Id<Table>,
) {
  return t.run(async (ctx) => ctx.db.get(table, id));
}

function notificationsOf(t: T, userId: Id<"users">) {
  return t.run(async (ctx) =>
    ctx.db
      .query("notifications")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect(),
  );
}

function rowsOf<Table extends "profiles" | "avatarUploads" | "conversationMembers" | "blocks">(
  t: T,
  table: Table,
) {
  return t.run(async (ctx) => ctx.db.query(table).collect());
}

describe("auth.onDelete", () => {
  it("removes the deleted player's profile, slots and requests, keeping chats tombstoned", async () => {
    const t = setup();
    const a = await createUser(t);
    const b = await createUser(t);
    const c = await createUser(t);
    const d = await createUser(t);
    const e = await createUser(t);

    const avatarStorageId = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob([new Uint8Array(16)]));
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", b.userId))
        .unique();
      await ctx.db.patch("profiles", profile!._id, { avatarStorageId: storageId });
      await ctx.db.insert("avatarUploads", { userId: b.userId, storageId });
      return storageId;
    });

    const openSlot = await createSlot(b, tomorrow10);
    const otherOpenSlot = await createSlot(b, tomorrow10 + 2 * HOUR);
    const fromD = await d.as.mutation(api.matchRequests.send, { slotId: openSlot });
    const matchedWithA = await match(b, a, tomorrow10 + DAY);
    const cSlot = await createSlot(c, tomorrow10);
    const toC = await b.as.mutation(api.matchRequests.send, { slotId: cSlot });
    const onE = await match(e, b, tomorrow10 + 2 * DAY);

    const { conversationId } = matchedWithA;
    const aMessage = await a.as.mutation(api.messages.send, { conversationId, body: "Olá" });
    vi.advanceTimersByTime(1000);
    const bMessage = await b.as.mutation(api.messages.send, { conversationId, body: "Até já" });

    const f = await createUser(t);
    await b.as.mutation(api.blocks.block, { userId: f.userId });
    await f.as.mutation(api.blocks.block, { userId: b.userId });
    await t.run(async (ctx) =>
      ctx.db.insert("reports", {
        reporterId: a.userId,
        reportedUserId: b.userId,
        reason: "no_show",
        status: "open",
      }),
    );
    expect((await notificationsOf(t, b.userId)).length).toBeGreaterThan(0);

    await deleteAccount(t, b.authId);

    // Profile, avatar and users row are gone.
    await expect(a.as.query(api.profiles.getByUserId, { userId: b.userId })).rejects.toThrow(
      "NOT_FOUND",
    );
    expect(await t.run(async (ctx) => ctx.db.get("users", b.userId))).toBeNull();
    expect(await t.run(async (ctx) => ctx.db.system.get("_storage", avatarStorageId))).toBeNull();
    expect(await rowsOf(t, "avatarUploads")).toEqual([]);

    // B's future slots are cancelled: out of search and no longer requestable.
    for (const slotId of [openSlot, otherOpenSlot, matchedWithA.slotId]) {
      expect((await get(t, "availabilitySlots", slotId))?.status).toBe("cancelled");
    }
    expect(await searchSlotIds(a)).toEqual(expect.not.arrayContaining([openSlot, otherOpenSlot]));
    await expect(a.as.mutation(api.matchRequests.send, { slotId: openSlot })).rejects.toThrow(
      "SLOT_NOT_OPEN",
    );

    // D's pending request is declined and D is told, as when B cancels the slot.
    expect((await get(t, "matchRequests", fromD))?.status).toBe("declined");
    expect((await notificationsOf(t, d.userId)).map((n) => [n.type, n.requestId])).toEqual([
      ["request_declined", fromD],
    ]);
    // A's accepted match is cancelled and A is told.
    expect((await get(t, "matchRequests", matchedWithA.requestId))?.status).toBe("cancelled");
    expect(
      (await notificationsOf(t, a.userId)).some(
        (n) => n.type === "match_cancelled" && n.requestId === matchedWithA.requestId,
      ),
    ).toBe(true);
    // B's pending request to C is cancelled and C's request_received for it is gone.
    expect((await get(t, "matchRequests", toC))?.status).toBe("cancelled");
    expect((await notificationsOf(t, c.userId)).some((n) => n.requestId === toC)).toBe(false);
    // B's accepted request on E's slot is cancelled and E's slot is open again.
    expect((await get(t, "matchRequests", onE.requestId))?.status).toBe("cancelled");
    expect((await get(t, "availabilitySlots", onE.slotId))?.status).toBe("open");
    expect(await searchSlotIds(a)).toContain(onE.slotId);

    // B's notifications and blocks are gone; the report stays for moderation.
    expect(await notificationsOf(t, b.userId)).toEqual([]);
    expect(await rowsOf(t, "blocks")).toEqual([]);
    expect(await t.run(async (ctx) => ctx.db.query("reports").collect())).toHaveLength(1);

    // B's messages are tombstoned; A's are untouched; only B's memberships are dropped.
    const tombstone = await get(t, "messages", bMessage);
    expect(tombstone?.body).toBe("");
    expect(tombstone?.senderId).toBeUndefined();
    expect((await get(t, "messages", aMessage))?.body).toBe("Olá");
    const members = await rowsOf(t, "conversationMembers");
    expect(members.some((m) => m.userId === b.userId)).toBe(false);
    expect(members.filter((m) => m.userId === a.userId)).toHaveLength(1);

    // A's conversation list and thread still load, showing the deleted player.
    const list = await a.as.query(api.conversations.list, {});
    expect(list.map((row) => [row.conversationId, row.player, row.lastMessage?.body])).toEqual([
      [conversationId, null, ""],
    ]);
    const thread = await a.as.query(api.conversations.get, { conversationId });
    expect(thread.player).toBeNull();
    const messages = await a.as.query(api.messages.list, { conversationId, limit: 50 });
    expect(messages.messages.map((m) => [m.body, m.mine])).toEqual([
      ["Olá", true],
      ["", false],
    ]);
    await a.as.mutation(api.messages.send, { conversationId, body: "Ainda aqui" });
  });

  it("leaves past slots, a slot starting exactly now and past matches untouched", async () => {
    const t = setup();
    const b = await createUser(t);
    const e = await createUser(t);
    const pastMatch = await match(e, b, tomorrow10);
    vi.setSystemTime(tomorrow10 + 2 * HOUR);
    const now = Date.now();
    const [pastSlot, nowSlot] = await t.run(async (ctx) => {
      const slot = {
        userId: b.userId,
        district: "Coimbra",
        municipality: "Figueira da Foz",
        status: "open" as const,
      };
      return Promise.all([
        ctx.db.insert("availabilitySlots", {
          ...slot,
          startAt: now - DAY,
          endAt: now - DAY + HOUR,
        }),
        ctx.db.insert("availabilitySlots", { ...slot, startAt: now, endAt: now + HOUR }),
      ]);
    });

    await deleteAccount(t, b.authId);

    expect((await get(t, "availabilitySlots", pastSlot))?.status).toBe("open");
    expect((await get(t, "availabilitySlots", nowSlot))?.status).toBe("open");
    expect((await get(t, "availabilitySlots", pastMatch.slotId))?.status).toBe("matched");
    expect((await get(t, "matchRequests", pastMatch.requestId))?.status).toBe("accepted");
  });

  it("finishes a large account in scheduled batches", async () => {
    const t = setup();
    const a = await createUser(t);
    const b = await createUser(t);
    const { conversationId } = await match(a, b);
    await t.run(async (ctx) => {
      for (let i = 0; i < 120; i++) {
        await ctx.db.insert("messages", { conversationId, senderId: b.userId, body: `m${i}` });
        await ctx.db.insert("notifications", { userId: b.userId, type: "new_message" });
      }
    });
    const bMessages = () =>
      t.run(async (ctx) =>
        ctx.db
          .query("messages")
          .withIndex("by_senderId", (q) => q.eq("senderId", b.userId))
          .collect(),
      );

    await deleteAccount(t, b.authId);
    expect((await bMessages()).length).toBeGreaterThan(0);

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await bMessages()).toEqual([]);
    expect(await notificationsOf(t, b.userId)).toEqual([]);
  });

  it("is a no-op for an unknown authId", async () => {
    const t = setup();
    const b = await createUser(t);
    const slotId = await createSlot(b);

    await deleteAccount(t, "unknown");

    expect(await t.run(async (ctx) => ctx.db.get("users", b.userId))).not.toBeNull();
    expect(await rowsOf(t, "profiles")).toHaveLength(1);
    expect((await get(t, "availabilitySlots", slotId))?.status).toBe("open");
  });

  it("leaves other players' rows and block/ban hiding untouched", async () => {
    const t = setup();
    const a = await createUser(t);
    const b = await createUser(t);
    const c = await createUser(t);
    const banned = await createUser(t);
    const blocker = await createUser(t);
    const cSlot = await createSlot(c, tomorrow10);
    await createSlot(banned, tomorrow10);
    await createSlot(blocker, tomorrow10);
    await ban(t, banned.userId);
    await blocker.as.mutation(api.blocks.block, { userId: a.userId });
    const aToC = await a.as.mutation(api.matchRequests.send, { slotId: cSlot });
    await createSlot(b, tomorrow10 + 2 * HOUR);
    const before = await notificationsOf(t, c.userId);

    await deleteAccount(t, b.authId);

    // The banned and the blocking player's slots stay hidden from A.
    expect(await searchSlotIds(a)).toEqual([cSlot]);
    expect((await get(t, "matchRequests", aToC))?.status).toBe("pending");
    expect(await notificationsOf(t, c.userId)).toEqual(before);
    expect((await rowsOf(t, "profiles")).map((p) => p.userId)).toEqual([
      a.userId,
      c.userId,
      banned.userId,
      blocker.userId,
    ]);
    expect(await rowsOf(t, "blocks")).toHaveLength(1);
  });
});

describe("auth.onCreate / auth.onUpdate", () => {
  it("still mirror the Better Auth user into users", async () => {
    const t = setup();
    await t.mutation(internal.auth.onCreate, { model: "user", doc: authDoc("ba_new") });
    await t.mutation(internal.auth.onUpdate, {
      model: "user",
      oldDoc: authDoc("ba_new"),
      newDoc: authDoc("ba_new", { name: "Renamed", email: "renamed@test.pt" }),
    });
    const me = await t.withIdentity({ subject: "ba_new" }).query(api.users.me, {});
    expect(me.user).toMatchObject({ name: "Renamed", email: "renamed@test.pt", role: "user" });
    expect(me.profile).toBeNull();
  });
});
