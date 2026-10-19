import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { createUser, DAY, HOUR, NOW, setup, type T } from "./test.helpers";

/** 2026-09-09T10:00Z */
const tomorrow10 = NOW + DAY - 2 * HOUR;
const week = { from: NOW, to: NOW + 7 * DAY };
const page = { numItems: 50, cursor: null };
const anyLevel = { minNtrp: 1, maxNtrp: 7 };

type TestUser = Awaited<ReturnType<typeof createUser>>;

function createSlot(user: TestUser, startAt = tomorrow10) {
  return user.as.mutation(api.availability.create, { startAt, endAt: startAt + HOUR });
}

function ban(t: T, userId: Id<"users">) {
  return t.run(async (ctx) => ctx.db.patch("users", userId, { bannedAt: NOW }));
}

describe("banned users are hidden from other players", () => {
  it("search skips a banned player's open slots", async () => {
    const t = setup();
    const me = await createUser(t);
    const banned = await createUser(t);
    const other = await createUser(t);
    await createSlot(banned);
    await createSlot(other);

    await ban(t, banned.userId);

    const result = await me.as.query(api.availability.search, {
      ...week,
      ...anyLevel,
      paginationOpts: page,
    });
    expect(result.page.map((row) => row.player.userId)).toEqual([other.userId]);
  });

  it("listOpenForUser returns nothing for a banned player", async () => {
    const t = setup();
    const me = await createUser(t);
    const banned = await createUser(t);
    await createSlot(banned);
    expect(
      await me.as.query(api.availability.listOpenForUser, { userId: banned.userId }),
    ).toHaveLength(1);

    await ban(t, banned.userId);

    expect(await me.as.query(api.availability.listOpenForUser, { userId: banned.userId })).toEqual(
      [],
    );
  });

  it("a banned player's profile looks like it does not exist", async () => {
    const t = setup();
    const me = await createUser(t);
    const banned = await createUser(t);
    await ban(t, banned.userId);

    await expect(me.as.query(api.profiles.getByUserId, { userId: banned.userId })).rejects.toThrow(
      "NOT_FOUND",
    );
  });

  it("requests to and from a banned player disappear from both lists", async () => {
    const t = setup();
    const me = await createUser(t);
    const banned = await createUser(t);
    const mySlot = await createSlot(me);
    const theirSlot = await createSlot(banned, tomorrow10 + 3 * HOUR);
    await banned.as.mutation(api.matchRequests.send, { slotId: mySlot });
    await me.as.mutation(api.matchRequests.send, { slotId: theirSlot });
    expect(await me.as.query(api.matchRequests.received, {})).toHaveLength(1);
    expect(await me.as.query(api.matchRequests.sent, {})).toHaveLength(1);

    await ban(t, banned.userId);

    expect(await me.as.query(api.matchRequests.received, {})).toEqual([]);
    expect(await me.as.query(api.matchRequests.sent, {})).toEqual([]);
  });

  it("refuses to request a banned player's slot or accept their request", async () => {
    const t = setup();
    const me = await createUser(t);
    const banned = await createUser(t);
    const theirSlot = await createSlot(banned);
    const mySlot = await createSlot(me, tomorrow10 + 3 * HOUR);
    const requestId = await banned.as.mutation(api.matchRequests.send, { slotId: mySlot });

    await ban(t, banned.userId);

    await expect(me.as.mutation(api.matchRequests.send, { slotId: theirSlot })).rejects.toThrow(
      "NOT_FOUND",
    );
    await expect(me.as.mutation(api.matchRequests.accept, { requestId })).rejects.toThrow(
      "NOT_FOUND",
    );
  });

  it("conversations with a banned player are hidden", async () => {
    const t = setup();
    const me = await createUser(t);
    const banned = await createUser(t);
    const slotId = await createSlot(me);
    const requestId = await banned.as.mutation(api.matchRequests.send, { slotId });
    const conversationId = await me.as.mutation(api.matchRequests.accept, { requestId });
    expect(await me.as.query(api.conversations.list, {})).toHaveLength(1);

    await ban(t, banned.userId);

    expect(await me.as.query(api.conversations.list, {})).toEqual([]);
    await expect(me.as.query(api.conversations.get, { conversationId })).rejects.toThrow(
      "NOT_FOUND",
    );
    await expect(
      me.as.mutation(api.messages.send, { conversationId, body: "hello?" }),
    ).rejects.toThrow("NOT_FOUND");
  });
});
