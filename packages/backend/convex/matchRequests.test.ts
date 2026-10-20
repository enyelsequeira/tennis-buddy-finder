import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import { createSlot, createUser, HOUR, NOW, setup, type T, tomorrow10 } from "./test.helpers";

function allConversations(t: T) {
  return t.run(async (ctx) => ctx.db.query("conversations").take(10));
}

describe("matchRequests.send", () => {
  it("creates a pending request and notifies the owner", async () => {
    const t = setup();
    const owner = await createUser(t);
    const asker = await createUser(t);
    const slotId = await createSlot(owner);
    const requestId = await asker.as.mutation(api.matchRequests.send, {
      slotId,
      message: "Up for a set?",
    });

    const received = await owner.as.query(api.matchRequests.received, {});
    expect(received).toHaveLength(1);
    expect(received[0]?.request).toMatchObject({
      _id: requestId,
      status: "pending",
      message: "Up for a set?",
    });
    expect(received[0]?.slot._id).toBe(slotId);
    expect(received[0]?.player).toEqual({
      userId: asker.userId,
      displayName: expect.any(String),
      age: 36,
      ntrp: 3.5,
      yearsPlaying: 5,
      formats: "both",
      languages: ["pt"],
    });

    const sent = await asker.as.query(api.matchRequests.sent, {});
    expect(sent).toHaveLength(1);
    expect(sent[0]?.player.userId).toBe(owner.userId);
    expect(await asker.as.query(api.matchRequests.received, {})).toHaveLength(0);

    const notes = await owner.as.query(api.notifications.unread, {});
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ type: "request_received", requestId });
  });

  it("rejects own slot, duplicates, blocked pairs, non-open slots and long messages", async () => {
    const t = setup();
    const owner = await createUser(t);
    const asker = await createUser(t);
    const slotId = await createSlot(owner);
    await expect(owner.as.mutation(api.matchRequests.send, { slotId })).rejects.toThrow(
      "CANNOT_REQUEST_OWN_SLOT",
    );
    await expect(
      asker.as.mutation(api.matchRequests.send, { slotId, message: "x".repeat(301) }),
    ).rejects.toThrow("INVALID_MESSAGE");
    await asker.as.mutation(api.matchRequests.send, { slotId });
    await expect(asker.as.mutation(api.matchRequests.send, { slotId })).rejects.toThrow(
      "REQUEST_EXISTS",
    );

    const blocked = await createUser(t);
    await owner.as.mutation(api.blocks.block, { userId: blocked.userId });
    await expect(blocked.as.mutation(api.matchRequests.send, { slotId })).rejects.toThrow(
      "BLOCKED",
    );

    const third = await createUser(t);
    const cancelledSlot = await createSlot(owner, tomorrow10 + 3 * HOUR);
    await owner.as.mutation(api.availability.cancel, { slotId: cancelledSlot });
    await expect(
      third.as.mutation(api.matchRequests.send, { slotId: cancelledSlot }),
    ).rejects.toThrow("SLOT_NOT_OPEN");
  });

  it("rejects a slot that already started", async () => {
    const t = setup();
    const owner = await createUser(t);
    const asker = await createUser(t);
    const slotId = await t.run(async (ctx) =>
      ctx.db.insert("availabilitySlots", {
        userId: owner.userId,
        startAt: NOW - HOUR,
        endAt: NOW,
        district: "Coimbra",
        municipality: "Figueira da Foz",
        status: "open",
      }),
    );
    await expect(asker.as.mutation(api.matchRequests.send, { slotId })).rejects.toThrow(
      "SLOT_IN_PAST",
    );
  });

  it("allows a new request once the previous one was cancelled, but still only one pending", async () => {
    const t = setup();
    const owner = await createUser(t);
    const asker = await createUser(t);
    const slotId = await createSlot(owner);
    const first = await asker.as.mutation(api.matchRequests.send, { slotId });
    await asker.as.mutation(api.matchRequests.cancel, { requestId: first });
    await asker.as.mutation(api.matchRequests.send, { slotId });
    await expect(asker.as.mutation(api.matchRequests.send, { slotId })).rejects.toThrow(
      "REQUEST_EXISTS",
    );
  });
});

describe("matchRequests.accept", () => {
  it("matches the slot, declines others, opens a conversation and notifies", async () => {
    const t = setup();
    const owner = await createUser(t);
    const a = await createUser(t);
    const b = await createUser(t);
    const slotId = await createSlot(owner);
    const reqA = await a.as.mutation(api.matchRequests.send, { slotId });
    const reqB = await b.as.mutation(api.matchRequests.send, { slotId });

    const conversationId = await owner.as.mutation(api.matchRequests.accept, { requestId: reqA });

    const slot = await t.run(async (ctx) => ctx.db.get("availabilitySlots", slotId));
    expect(slot?.status).toBe("matched");
    const [rowA, rowB] = await t.run(async (ctx) =>
      Promise.all([ctx.db.get("matchRequests", reqA), ctx.db.get("matchRequests", reqB)]),
    );
    expect(rowA).toMatchObject({ status: "accepted", conversationId, respondedAt: NOW });
    expect(rowB?.status).toBe("declined");

    const aNotes = await a.as.query(api.notifications.unread, {});
    expect(aNotes).toHaveLength(1);
    expect(aNotes[0]).toMatchObject({ type: "request_accepted", requestId: reqA, conversationId });
    const bNotes = await b.as.query(api.notifications.unread, {});
    expect(bNotes.map((n) => n.type)).toEqual(["request_declined"]);

    const members = await t.run(async (ctx) => ctx.db.query("conversationMembers").take(10));
    expect(members.map((m) => [m.conversationId, m.userId, m.lastReadAt])).toEqual(
      [owner.userId, a.userId].sort().map((userId) => [conversationId, userId, NOW]),
    );

    expect(await owner.as.query(api.matchRequests.received, {})).toHaveLength(0);
    const sent = await a.as.query(api.matchRequests.sent, {});
    expect(sent.map((r) => r.request.status)).toEqual(["accepted"]);
  });

  it("reuses the conversation for the same pair", async () => {
    const t = setup();
    const owner = await createUser(t);
    const a = await createUser(t);
    const s1 = await createSlot(owner);
    const s2 = await createSlot(owner, tomorrow10 + 3 * HOUR);
    const r1 = await a.as.mutation(api.matchRequests.send, { slotId: s1 });
    const r2 = await a.as.mutation(api.matchRequests.send, { slotId: s2 });
    const c1 = await owner.as.mutation(api.matchRequests.accept, { requestId: r1 });
    const c2 = await owner.as.mutation(api.matchRequests.accept, { requestId: r2 });
    expect(c2).toBe(c1);
    expect(await allConversations(t)).toHaveLength(1);
  });

  it("only the slot owner can accept, and only pending requests", async () => {
    const t = setup();
    const owner = await createUser(t);
    const a = await createUser(t);
    const slotId = await createSlot(owner);
    const req = await a.as.mutation(api.matchRequests.send, { slotId });
    await expect(a.as.mutation(api.matchRequests.accept, { requestId: req })).rejects.toThrow(
      "FORBIDDEN",
    );
    await owner.as.mutation(api.matchRequests.decline, { requestId: req });
    await expect(owner.as.mutation(api.matchRequests.accept, { requestId: req })).rejects.toThrow(
      "REQUEST_NOT_PENDING",
    );
    expect(await allConversations(t)).toHaveLength(0);
  });
});

describe("matchRequests.decline", () => {
  it("only the slot owner can decline; the sender is notified and the slot stays open", async () => {
    const t = setup();
    const owner = await createUser(t);
    const a = await createUser(t);
    const slotId = await createSlot(owner);
    const req = await a.as.mutation(api.matchRequests.send, { slotId });
    await expect(a.as.mutation(api.matchRequests.decline, { requestId: req })).rejects.toThrow(
      "FORBIDDEN",
    );
    await owner.as.mutation(api.matchRequests.decline, { requestId: req });
    await expect(owner.as.mutation(api.matchRequests.decline, { requestId: req })).rejects.toThrow(
      "REQUEST_NOT_PENDING",
    );

    const sent = await a.as.query(api.matchRequests.sent, {});
    expect(sent.map((r) => r.request.status)).toEqual(["declined"]);
    expect(sent[0]?.slot.status).toBe("open");
    const notes = await a.as.query(api.notifications.unread, {});
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ type: "request_declined", requestId: req });
  });
});

describe("matchRequests.cancel", () => {
  it("sender cancels a pending request silently", async () => {
    const t = setup();
    const owner = await createUser(t);
    const a = await createUser(t);
    const slotId = await createSlot(owner);
    const req = await a.as.mutation(api.matchRequests.send, { slotId });
    await expect(owner.as.mutation(api.matchRequests.cancel, { requestId: req })).rejects.toThrow(
      "FORBIDDEN",
    );
    await a.as.mutation(api.matchRequests.cancel, { requestId: req });
    await expect(a.as.mutation(api.matchRequests.cancel, { requestId: req })).rejects.toThrow(
      "REQUEST_NOT_PENDING",
    );
    expect(await owner.as.query(api.matchRequests.received, {})).toHaveLength(0);
    expect(await a.as.query(api.matchRequests.sent, {})).toHaveLength(0);
    const notes = await owner.as.query(api.notifications.unread, {});
    expect(notes.map((n) => n.type)).toEqual(["request_received"]);
  });
});

describe("matchRequests.sent", () => {
  it("lists my pending and answered requests newest first", async () => {
    const t = setup();
    const owner = await createUser(t);
    const a = await createUser(t);
    const requests = [];
    for (const offset of [0, 2, 4]) {
      const slotId = await createSlot(owner, tomorrow10 + offset * HOUR);
      requests.push(await a.as.mutation(api.matchRequests.send, { slotId }));
    }
    await owner.as.mutation(api.matchRequests.decline, { requestId: requests[0]! });
    await owner.as.mutation(api.matchRequests.accept, { requestId: requests[2]! });

    const sent = await a.as.query(api.matchRequests.sent, {});
    expect(sent.map((r) => [r.request._id, r.request.status])).toEqual([
      [requests[2], "accepted"],
      [requests[1], "pending"],
      [requests[0], "declined"],
    ]);
  });

  it("hides requests with a player blocked in either direction", async () => {
    const t = setup();
    const owner = await createUser(t);
    const a = await createUser(t);
    const slotId = await createSlot(owner);
    const req = await a.as.mutation(api.matchRequests.send, { slotId });
    await owner.as.mutation(api.matchRequests.accept, { requestId: req });
    await owner.as.mutation(api.blocks.block, { userId: a.userId });
    expect(await a.as.query(api.matchRequests.sent, {})).toHaveLength(0);
  });
});
