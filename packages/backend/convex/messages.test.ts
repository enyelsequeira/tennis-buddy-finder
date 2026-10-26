import { describe, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  createUser,
  DAY,
  HOUR,
  match,
  setup,
  type T,
  type TestUser,
  tomorrow10,
} from "./test.helpers";

async function pair(t: T) {
  const owner = await createUser(t);
  const asker = await createUser(t);
  const matched = await match(owner, asker);
  return { owner, asker, ...matched };
}

function tick(ms = 1000) {
  vi.advanceTimersByTime(ms);
}

async function unreadMessageNotes(user: TestUser) {
  const notes = await user.as.query(api.notifications.unread, {});
  return notes.filter((note) => note.type === "new_message");
}

/** Every unread notification row of `userId` for one conversation, uncapped (unlike `notifications.unread`). */
function unreadRowsFor(
  t: ReturnType<typeof setup>,
  userId: Id<"users">,
  conversationId: Id<"conversations">,
) {
  return t.run(async (ctx) =>
    (
      await ctx.db
        .query("notifications")
        .withIndex("by_userId_and_readAt", (q) => q.eq("userId", userId).eq("readAt", undefined))
        .collect()
    )
      .filter((row) => row.conversationId === conversationId)
      .map((row) => row.type),
  );
}

describe("messages.send / messages.list", () => {
  it("both members see the thread in order, with mine flags", async () => {
    const t = setup();
    const { owner, asker, conversationId } = await pair(t);
    tick();
    await asker.as.mutation(api.messages.send, { conversationId, body: "  Olá!  " });
    tick();
    await owner.as.mutation(api.messages.send, { conversationId, body: "Bora jogar" });

    const forAsker = await asker.as.query(api.messages.list, { conversationId, limit: 50 });
    expect(forAsker.hasMore).toBe(false);
    expect(forAsker.messages.map((m) => [m.body, m.mine])).toEqual([
      ["Olá!", true],
      ["Bora jogar", false],
    ]);
    const forOwner = await owner.as.query(api.messages.list, { conversationId, limit: 50 });
    expect(forOwner.messages.map((m) => m.mine)).toEqual([false, true]);
  });

  it("returns the newest `limit` messages and reports older ones", async () => {
    const t = setup();
    const { asker, conversationId } = await pair(t);
    for (const body of ["1", "2", "3"]) {
      tick();
      await asker.as.mutation(api.messages.send, { conversationId, body });
    }
    const page = await asker.as.query(api.messages.list, { conversationId, limit: 2 });
    expect(page.hasMore).toBe(true);
    expect(page.messages.map((m) => m.body)).toEqual(["2", "3"]);
  });

  it("rejects empty, whitespace-only and too long bodies", async () => {
    const t = setup();
    const { asker, conversationId } = await pair(t);
    for (const body of ["", "   \n ", "x".repeat(2001)]) {
      await expect(asker.as.mutation(api.messages.send, { conversationId, body })).rejects.toThrow(
        "INVALID_MESSAGE",
      );
    }
    await asker.as.mutation(api.messages.send, { conversationId, body: "x".repeat(2000) });
  });

  it("only members can read or write", async () => {
    const t = setup();
    const { conversationId } = await pair(t);
    const stranger = await createUser(t);
    await expect(
      stranger.as.query(api.messages.list, { conversationId, limit: 10 }),
    ).rejects.toThrow("NOT_FOUND");
    await expect(
      stranger.as.mutation(api.messages.send, { conversationId, body: "hi" }),
    ).rejects.toThrow("NOT_FOUND");
    await expect(stranger.as.query(api.conversations.get, { conversationId })).rejects.toThrow(
      "NOT_FOUND",
    );
    await expect(
      stranger.as.mutation(api.conversations.markRead, { conversationId }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("a block either way hides the thread and refuses messages", async () => {
    const t = setup();
    const { owner, asker, conversationId } = await pair(t);
    await asker.as.mutation(api.messages.send, { conversationId, body: "hi" });
    await owner.as.mutation(api.blocks.block, { userId: asker.userId });

    for (const user of [owner, asker]) {
      await expect(
        user.as.mutation(api.messages.send, { conversationId, body: "still there?" }),
      ).rejects.toThrow("NOT_FOUND");
      await expect(user.as.query(api.messages.list, { conversationId, limit: 10 })).rejects.toThrow(
        "NOT_FOUND",
      );
      expect(await user.as.query(api.conversations.list, {})).toEqual([]);
    }

    await owner.as.mutation(api.blocks.unblock, { userId: asker.userId });
    expect(await asker.as.query(api.conversations.list, {})).toHaveLength(1);
  });

  it("notifies the recipient once until they read the conversation", async () => {
    const t = setup();
    const { owner, asker, conversationId } = await pair(t);
    tick();
    await asker.as.mutation(api.messages.send, { conversationId, body: "1" });
    tick();
    await asker.as.mutation(api.messages.send, { conversationId, body: "2" });
    expect(await unreadMessageNotes(owner)).toHaveLength(1);
    expect(await unreadMessageNotes(asker)).toHaveLength(0);

    tick();
    await owner.as.mutation(api.conversations.markRead, { conversationId });
    expect(await unreadMessageNotes(owner)).toHaveLength(0);

    tick();
    await asker.as.mutation(api.messages.send, { conversationId, body: "3" });
    const notes = await unreadMessageNotes(owner);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.conversationId).toBe(conversationId);
  });

  it("notifies again after the bell is read, even if the thread is not", async () => {
    const t = setup();
    const { owner, asker, conversationId } = await pair(t);
    tick();
    await asker.as.mutation(api.messages.send, { conversationId, body: "1" });
    await owner.as.mutation(api.notifications.markAllRead, {});
    expect(await unreadMessageNotes(owner)).toHaveLength(0);

    tick();
    await asker.as.mutation(api.messages.send, { conversationId, body: "2" });
    expect(await unreadMessageNotes(owner)).toHaveLength(1);
  });

  it("replying clears the sender's own message notification", async () => {
    const t = setup();
    const { owner, asker, conversationId } = await pair(t);
    tick();
    await asker.as.mutation(api.messages.send, { conversationId, body: "hi" });
    expect(await unreadMessageNotes(owner)).toHaveLength(1);

    tick();
    await owner.as.mutation(api.messages.send, { conversationId, body: "hey" });
    expect(await unreadMessageNotes(owner)).toHaveLength(0);

    tick();
    await asker.as.mutation(api.messages.send, { conversationId, body: "again" });
    expect(await unreadMessageNotes(owner)).toHaveLength(1);
  });

  it.each([199, 200, 201])(
    "keeps one message notification per conversation with %i newer unread notifications",
    async (newer) => {
      const t = setup();
      const { owner, asker, conversationId } = await pair(t);
      tick();
      await asker.as.mutation(api.messages.send, { conversationId, body: "1" });
      tick();
      await t.run(async (ctx) => {
        for (let i = 0; i < newer; i++) {
          await ctx.db.insert("notifications", { userId: owner.userId, type: "request_received" });
        }
      });

      tick();
      await asker.as.mutation(api.messages.send, { conversationId, body: "2" });
      expect(await unreadRowsFor(t, owner.userId, conversationId)).toEqual(["new_message"]);

      tick();
      await owner.as.mutation(api.conversations.markRead, { conversationId });
      expect(await unreadRowsFor(t, owner.userId, conversationId)).toEqual([]);
    },
  );

  it("markRead clears only this conversation's message notification", async () => {
    const t = setup();
    const { owner, asker, conversationId } = await pair(t);
    const other = await createUser(t);
    const second = await match(asker, other, tomorrow10 + 2 * HOUR);
    tick();
    await owner.as.mutation(api.messages.send, { conversationId, body: "hi" });
    tick();
    await other.as.mutation(api.messages.send, {
      conversationId: second.conversationId,
      body: "hey",
    });

    tick();
    await asker.as.mutation(api.conversations.markRead, { conversationId });
    // The acceptance notification carries the conversationId too, but is not a message one.
    expect(await unreadRowsFor(t, asker.userId, conversationId)).toEqual(["request_accepted"]);
    expect(await unreadRowsFor(t, asker.userId, second.conversationId)).toEqual(["new_message"]);
  });

  it("markRead does not write when nothing is unread", async () => {
    const t = setup();
    const { owner, asker, conversationId } = await pair(t);
    tick();
    await asker.as.mutation(api.messages.send, { conversationId, body: "1" });
    tick();
    await owner.as.mutation(api.conversations.markRead, { conversationId });
    const readAt = async () =>
      t.run(
        async (ctx) =>
          (
            await ctx.db
              .query("conversationMembers")
              .withIndex("by_conversationId_and_userId", (q) =>
                q.eq("conversationId", conversationId).eq("userId", owner.userId),
              )
              .unique()
          )?.lastReadAt,
      );
    const first = await readAt();
    tick();
    await owner.as.mutation(api.conversations.markRead, { conversationId });
    expect(await readAt()).toBe(first);
  });
});

describe("conversations", () => {
  it("lists conversations newest first with preview and unread count", async () => {
    const t = setup();
    const owner = await createUser(t);
    const first = await createUser(t);
    const second = await createUser(t);
    const c1 = await match(owner, first);
    const c2 = await match(owner, second, tomorrow10 + 2 * HOUR);

    tick();
    await first.as.mutation(api.messages.send, { conversationId: c1.conversationId, body: "a" });
    tick();
    await first.as.mutation(api.messages.send, { conversationId: c1.conversationId, body: "b" });
    tick();
    await owner.as.mutation(api.messages.send, { conversationId: c2.conversationId, body: "c" });

    const list = await owner.as.query(api.conversations.list, {});
    expect(list.map((row) => row.conversationId)).toEqual([c2.conversationId, c1.conversationId]);
    expect(list[0]).toMatchObject({
      unreadCount: 0,
      lastMessage: { body: "c", mine: true },
      player: { userId: second.userId },
    });
    expect(list[1]).toMatchObject({ unreadCount: 2, lastMessage: { body: "b", mine: false } });

    tick();
    await owner.as.mutation(api.conversations.markRead, { conversationId: c1.conversationId });
    const after = await owner.as.query(api.conversations.list, {});
    expect(after.find((row) => row.conversationId === c1.conversationId)?.unreadCount).toBe(0);
  });

  it.each([99, 100])(
    "lists an old conversation first once it gets a message, with %i newer conversations",
    async (newer) => {
      const t = setup();
      const { owner, asker, conversationId } = await pair(t);
      tick();
      // Seeded directly: going through match() for 100 players is slow and adds nothing here.
      await t.run(async (ctx) => {
        for (let i = 0; i < newer; i++) {
          const otherId = await ctx.db.insert("users", {
            authId: `seed_${i}`,
            email: `seed${i}@test.pt`,
            name: `Seed ${i}`,
            role: "user",
            emailNotifications: true,
          });
          const [userAId, userBId] =
            owner.userId < otherId ? [owner.userId, otherId] : [otherId, owner.userId];
          const seededId = await ctx.db.insert("conversations", {
            userAId,
            userBId,
            lastMessageAt: Date.now(),
          });
          for (const userId of [userAId, userBId]) {
            await ctx.db.insert("conversationMembers", { conversationId: seededId, userId });
          }
        }
      });

      tick();
      await asker.as.mutation(api.messages.send, { conversationId, body: "still on?" });
      const list = await owner.as.query(api.conversations.list, {});
      expect(list).toHaveLength(100);
      expect(list[0]).toMatchObject({
        conversationId,
        unreadCount: 1,
        lastMessage: { body: "still on?", mine: false },
        player: { userId: asker.userId },
      });
    },
  );

  it("a fresh match shows an empty conversation and the matched slot", async () => {
    const t = setup();
    const { owner, asker, slotId, conversationId } = await pair(t);
    const list = await asker.as.query(api.conversations.list, {});
    expect(list).toEqual([expect.objectContaining({ conversationId, lastMessage: null })]);

    const thread = await asker.as.query(api.conversations.get, { conversationId });
    expect(thread.otherUserId).toBe(owner.userId);
    expect(thread.player?.userId).toBe(owner.userId);
    expect(thread.slot).toMatchObject({ _id: slotId, status: "matched" });
  });

  it("a second match between the pair reuses the thread and pins the newer slot", async () => {
    const t = setup();
    const { owner, asker, conversationId } = await pair(t);
    tick();
    const second = await match(asker, owner, tomorrow10 + DAY);
    expect(second.conversationId).toBe(conversationId);
    const thread = await owner.as.query(api.conversations.get, { conversationId });
    expect(thread.slot?._id).toBe(second.slotId);
  });
});
