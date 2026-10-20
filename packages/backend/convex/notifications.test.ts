import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import { createNotification } from "./model/notifications";
import { ban, createUser, HOUR, setup, type TestUser, tomorrow10 } from "./test.helpers";

let slotCounter = 0;

/** Each call gets its own two-hour window, so slots never overlap. */
function nextSlot(user: TestUser) {
  const startAt = tomorrow10 + 2 * HOUR * slotCounter++;
  return user.as.mutation(api.availability.create, { startAt, endAt: startAt + HOUR });
}

/**
 * Gives `me` one notification of each kind caused by `other`: `other` requests my slot
 * (`request_received`), declines one request of mine (`request_declined`), accepts
 * another (`request_accepted`), then messages me (`new_message`).
 */
async function notesFrom(other: TestUser, me: TestUser) {
  await other.as.mutation(api.matchRequests.send, { slotId: await nextSlot(me) });
  const declinedId = await me.as.mutation(api.matchRequests.send, {
    slotId: await nextSlot(other),
  });
  await other.as.mutation(api.matchRequests.decline, { requestId: declinedId });
  const requestId = await me.as.mutation(api.matchRequests.send, {
    slotId: await nextSlot(other),
  });
  const conversationId = await other.as.mutation(api.matchRequests.accept, { requestId });
  await other.as.mutation(api.messages.send, { conversationId, body: "see you there" });
  return { conversationId };
}

async function unreadTypes(user: TestUser) {
  return (await user.as.query(api.notifications.unread, {})).map((n) => n.type).sort();
}

const ALL_TYPES = ["new_message", "request_accepted", "request_declined", "request_received"];

describe("notifications", () => {
  it("lists unread for me only, newest first, and marks all read", async () => {
    const t = setup();
    const a = await createUser(t);
    const b = await createUser(t);
    await t.run(async (ctx) => {
      await createNotification(ctx, { userId: a.userId, type: "request_received" });
      await createNotification(ctx, { userId: a.userId, type: "new_message" });
      await createNotification(ctx, { userId: b.userId, type: "request_accepted" });
    });
    const unread = await a.as.query(api.notifications.unread, {});
    expect(unread.map((n) => n.type)).toEqual(["new_message", "request_received"]);
    await a.as.mutation(api.notifications.markAllRead, {});
    expect(await a.as.query(api.notifications.unread, {})).toHaveLength(0);
    expect(await b.as.query(api.notifications.unread, {})).toHaveLength(1);
  });

  it("markRead only touches my own notification", async () => {
    const t = setup();
    const a = await createUser(t);
    const b = await createUser(t);
    const id = await t.run(async (ctx) =>
      createNotification(ctx, { userId: a.userId, type: "request_received" }),
    );
    await expect(b.as.mutation(api.notifications.markRead, { notificationId: id })).rejects.toThrow(
      "FORBIDDEN",
    );
    await a.as.mutation(api.notifications.markRead, { notificationId: id });
    expect(await a.as.query(api.notifications.unread, {})).toHaveLength(0);
  });

  it("hides notifications pointing at a player who was banned afterwards", async () => {
    const t = setup();
    const me = await createUser(t);
    const banned = await createUser(t);
    const other = await createUser(t);
    await notesFrom(banned, me);
    await notesFrom(other, me);
    expect(await unreadTypes(me)).toEqual([...ALL_TYPES, ...ALL_TYPES].sort());

    await ban(t, banned.userId);

    expect(await unreadTypes(me)).toEqual(ALL_TYPES);
  });

  it("hides notifications from a player I blocked, and from one who blocked me", async () => {
    const t = setup();
    const me = await createUser(t);
    const iBlocked = await createUser(t);
    const blockedMe = await createUser(t);
    const other = await createUser(t);
    await notesFrom(iBlocked, me);
    await notesFrom(blockedMe, me);
    await notesFrom(other, me);
    expect(await me.as.query(api.notifications.unread, {})).toHaveLength(12);

    await me.as.mutation(api.blocks.block, { userId: iBlocked.userId });
    await blockedMe.as.mutation(api.blocks.block, { userId: me.userId });

    expect(await unreadTypes(me)).toEqual(ALL_TYPES);

    await me.as.mutation(api.blocks.unblock, { userId: iBlocked.userId });
    expect(await me.as.query(api.notifications.unread, {})).toHaveLength(8);
  });

  it("keeps notifications whose request or conversation points at a deleted player", async () => {
    const t = setup();
    const me = await createUser(t);
    const gone = await createUser(t);
    await notesFrom(gone, me);

    await t.run(async (ctx) => ctx.db.delete("users", gone.userId));

    expect(await unreadTypes(me)).toEqual(ALL_TYPES);
  });

  it("still returns up to 50 visible notifications when newer hidden ones fill the window", async () => {
    const t = setup();
    const me = await createUser(t);
    const banned = await createUser(t);
    const { conversationId } = await notesFrom(banned, me);
    await t.run(async (ctx) => {
      for (let i = 0; i < 60; i++) {
        await createNotification(ctx, { userId: me.userId, type: "request_received" });
      }
      for (let i = 0; i < 60; i++) {
        await createNotification(ctx, { userId: me.userId, type: "new_message", conversationId });
      }
    });

    await ban(t, banned.userId);

    const unread = await me.as.query(api.notifications.unread, {});
    expect(unread).toHaveLength(50);
    expect(unread.every((n) => n.type === "request_received")).toBe(true);
  });
});
