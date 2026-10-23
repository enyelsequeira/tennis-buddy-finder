import { describe, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { addLisbonDays } from "./model/time";
import {
  createSlot,
  createUser,
  DAY,
  HOUR,
  NOW,
  page,
  setup,
  type T,
  tomorrow10,
  week,
} from "./test.helpers";

type RawSlot = {
  userId: Id<"users">;
  startAt: number;
  status: Doc<"availabilitySlots">["status"];
};

/** Bypasses `create`'s checks, for slots in the past or in a non-open status. */
function insertSlot(t: T, slot: RawSlot) {
  return t.run(async (ctx) =>
    ctx.db.insert("availabilitySlots", {
      ...slot,
      endAt: slot.startAt + HOUR,
      district: "Coimbra",
      municipality: "Figueira da Foz",
    }),
  );
}

describe("availability.create", () => {
  it("creates an open slot copying the profile location", async () => {
    const t = setup();
    const u = await createUser(t);
    const id = await u.as.mutation(api.availability.create, {
      startAt: tomorrow10,
      endAt: tomorrow10 + 2 * HOUR,
    });
    const mine = await u.as.query(api.availability.mine, week);
    expect(mine).toHaveLength(1);
    expect(mine[0]?._id).toBe(id);
    expect(mine[0]?.status).toBe("open");
    expect(mine[0]?.district).toBe("Coimbra");
    expect(mine[0]?.municipality).toBe("Figueira da Foz");
  });

  it("rejects past, off-grid, inverted and too long ranges", async () => {
    const t = setup();
    const u = await createUser(t);
    await expect(
      u.as.mutation(api.availability.create, { startAt: NOW - HOUR, endAt: NOW }),
    ).rejects.toThrow("SLOT_IN_PAST");
    await expect(
      u.as.mutation(api.availability.create, {
        startAt: tomorrow10 + 10 * 60 * 1000,
        endAt: tomorrow10 + HOUR,
      }),
    ).rejects.toThrow("SLOT_NOT_ON_GRID");
    await expect(
      u.as.mutation(api.availability.create, { startAt: tomorrow10 + HOUR, endAt: tomorrow10 }),
    ).rejects.toThrow("SLOT_INVALID_RANGE");
    await expect(
      u.as.mutation(api.availability.create, { startAt: tomorrow10, endAt: tomorrow10 + 7 * HOUR }),
    ).rejects.toThrow("SLOT_TOO_LONG");
  });

  it("rejects overlapping slots for the same user but allows touching ones", async () => {
    const t = setup();
    const u = await createUser(t);
    await u.as.mutation(api.availability.create, {
      startAt: tomorrow10,
      endAt: tomorrow10 + 2 * HOUR,
    });
    await expect(
      u.as.mutation(api.availability.create, {
        startAt: tomorrow10 + HOUR,
        endAt: tomorrow10 + 3 * HOUR,
      }),
    ).rejects.toThrow("SLOT_OVERLAP");
    await u.as.mutation(api.availability.create, {
      startAt: tomorrow10 + 2 * HOUR,
      endAt: tomorrow10 + 3 * HOUR,
    });
    expect(await u.as.query(api.availability.mine, week)).toHaveLength(2);
  });

  it("allows a slot over a cancelled one", async () => {
    const t = setup();
    const u = await createUser(t);
    const id = await createSlot(u, tomorrow10);
    await u.as.mutation(api.availability.cancel, { slotId: id });
    await createSlot(u, tomorrow10);
  });

  it("rejects an inactive venue, a venue elsewhere and a long note", async () => {
    const t = setup();
    const u = await createUser(t);
    const [inactive, elsewhere] = await t.run(async (ctx) =>
      Promise.all([
        ctx.db.insert("venues", {
          name: "Old",
          district: "Coimbra",
          municipality: "Figueira da Foz",
          isActive: false,
        }),
        ctx.db.insert("venues", {
          name: "Far",
          district: "Coimbra",
          municipality: "Coimbra",
          isActive: true,
        }),
      ]),
    );
    for (const venueId of [inactive, elsewhere]) {
      await expect(
        u.as.mutation(api.availability.create, {
          startAt: tomorrow10,
          endAt: tomorrow10 + HOUR,
          venueId,
        }),
      ).rejects.toThrow("INVALID_VENUE");
    }
    await expect(
      u.as.mutation(api.availability.create, {
        startAt: tomorrow10,
        endAt: tomorrow10 + HOUR,
        note: "x".repeat(201),
      }),
    ).rejects.toThrow("INVALID_NOTE");
  });

  it("requires a profile", async () => {
    const t = setup();
    const u = await createUser(t, { profile: false });
    await expect(createSlot(u, tomorrow10)).rejects.toThrow("PROFILE_REQUIRED");
  });
});

describe("availability.remove / cancel", () => {
  it("removes my open slot and forbids touching someone else's", async () => {
    const t = setup();
    const a = await createUser(t);
    const b = await createUser(t);
    const id = await createSlot(a, tomorrow10);
    await expect(b.as.mutation(api.availability.remove, { slotId: id })).rejects.toThrow(
      "FORBIDDEN",
    );
    await expect(b.as.mutation(api.availability.cancel, { slotId: id })).rejects.toThrow(
      "FORBIDDEN",
    );
    await a.as.mutation(api.availability.remove, { slotId: id });
    expect(await a.as.query(api.availability.mine, week)).toHaveLength(0);
    await expect(a.as.mutation(api.availability.remove, { slotId: id })).rejects.toThrow(
      "NOT_FOUND",
    );
  });

  it("cancel marks an open slot cancelled, after which it is no longer open", async () => {
    const t = setup();
    const a = await createUser(t);
    const id = await createSlot(a, tomorrow10);
    await a.as.mutation(api.availability.cancel, { slotId: id });
    const mine = await a.as.query(api.availability.mine, week);
    expect(mine[0]?.status).toBe("cancelled");
    await expect(a.as.mutation(api.availability.cancel, { slotId: id })).rejects.toThrow(
      "SLOT_NOT_OPEN",
    );
    await expect(a.as.mutation(api.availability.remove, { slotId: id })).rejects.toThrow(
      "SLOT_NOT_OPEN",
    );
  });

  it("removing or cancelling an open slot declines its pending requests and notifies", async () => {
    const t = setup();
    const owner = await createUser(t);
    const asker = await createUser(t);
    const removed = await createSlot(owner, tomorrow10);
    const cancelled = await createSlot(owner, tomorrow10 + 2 * HOUR);
    const requests = [
      await asker.as.mutation(api.matchRequests.send, { slotId: removed }),
      await asker.as.mutation(api.matchRequests.send, { slotId: cancelled }),
    ];
    await owner.as.mutation(api.availability.remove, { slotId: removed });
    await owner.as.mutation(api.availability.cancel, { slotId: cancelled });
    const rows = await t.run(async (ctx) =>
      Promise.all(requests.map((id) => ctx.db.get("matchRequests", id))),
    );
    expect(rows.map((r) => r?.status)).toEqual(["declined", "declined"]);
    const notes = await asker.as.query(api.notifications.unread, {});
    expect(notes.map((n) => n.type)).toEqual(["request_declined", "request_declined"]);
  });

  it("a matched slot cannot be removed; cancelling it cancels the accepted request and notifies", async () => {
    const t = setup();
    const owner = await createUser(t);
    const asker = await createUser(t);
    const slotId = await createSlot(owner, tomorrow10);
    const requestId = await asker.as.mutation(api.matchRequests.send, { slotId });
    await owner.as.mutation(api.matchRequests.accept, { requestId });
    await expect(owner.as.mutation(api.availability.remove, { slotId })).rejects.toThrow(
      "SLOT_NOT_OPEN",
    );
    await owner.as.mutation(api.availability.cancel, { slotId });
    const mine = await owner.as.query(api.availability.mine, week);
    expect(mine[0]?.status).toBe("cancelled");
    const request = await t.run(async (ctx) => ctx.db.get("matchRequests", requestId));
    expect(request?.status).toBe("cancelled");
    const notes = await asker.as.query(api.notifications.unread, {});
    expect(notes.map((n) => n.type)).toEqual(["request_declined", "request_accepted"]);
    expect(notes[0]?.requestId).toBe(requestId);
  });
});

describe("availability.mine", () => {
  it("returns only my slots starting inside the range, oldest first", async () => {
    const t = setup();
    const a = await createUser(t);
    const b = await createUser(t);
    await createSlot(a, tomorrow10 + 2 * DAY);
    await createSlot(a, tomorrow10);
    await createSlot(a, tomorrow10 + 10 * DAY);
    await createSlot(b, tomorrow10);
    const mine = await a.as.query(api.availability.mine, week);
    expect(mine.map((s) => s.startAt)).toEqual([tomorrow10, tomorrow10 + 2 * DAY]);
  });
});

describe("availability.listOpenForUser", () => {
  it("returns only open future slots and nothing when blocked", async () => {
    const t = setup();
    const a = await createUser(t);
    const b = await createUser(t);
    await createSlot(a, tomorrow10);
    const cancelled = await createSlot(a, tomorrow10 + 2 * HOUR);
    await a.as.mutation(api.availability.cancel, { slotId: cancelled });
    await insertSlot(t, { userId: a.userId, startAt: NOW - 2 * HOUR, status: "open" });
    const open = await b.as.query(api.availability.listOpenForUser, { userId: a.userId });
    expect(open.map((s) => s.startAt)).toEqual([tomorrow10]);
    await a.as.mutation(api.blocks.block, { userId: b.userId });
    expect(await b.as.query(api.availability.listOpenForUser, { userId: a.userId })).toHaveLength(
      0,
    );
  });
});

describe("availability.copyLastWeek", () => {
  it("copies last week forward 7 days, skipping past, cancelled and overlapping copies", async () => {
    const t = setup();
    const a = await createUser(t);
    /** 2026-09-01T14:00Z, inside the last 7 days. */
    const lastTue14 = NOW - 7 * DAY + 2 * HOUR;
    const userId = a.userId;
    // older than 7 days: outside the window
    await insertSlot(t, { userId, startAt: lastTue14 - 4 * HOUR, status: "expired" });
    // copy lands tomorrow 14:00, overlapping the existing open slot below
    await insertSlot(t, { userId, startAt: lastTue14 + DAY, status: "matched" });
    await insertSlot(t, { userId, startAt: lastTue14 + 2 * DAY, status: "cancelled" });
    // copy lands Friday 14:00
    await insertSlot(t, { userId, startAt: lastTue14 + 3 * DAY, status: "expired" });
    await insertSlot(t, { userId, startAt: lastTue14 + 8 * DAY, status: "open" });
    expect(await a.as.mutation(api.availability.copyLastWeek, {})).toBe(1);
    const mine = await a.as.query(api.availability.mine, week);
    expect(mine.map((s) => [s.startAt, s.status])).toEqual([
      [lastTue14 + 8 * DAY, "open"],
      [lastTue14 + 10 * DAY, "open"],
    ]);
    expect(await a.as.mutation(api.availability.copyLastWeek, {})).toBe(0);
  });

  async function copiedStarts(t: T, userId: Id<"users">, after: number) {
    const slots = await t.run(async (ctx) => ctx.db.query("availabilitySlots").collect());
    return slots
      .filter((s) => s.userId === userId && s.startAt > after)
      .map((s) => [s.startAt, s.endAt - s.startAt]);
  }

  it("keeps the Lisbon wall-clock time across the autumn clock change", async () => {
    const t = setup();
    const a = await createUser(t);
    /** Tue 20 Oct 2026 18:00 WEST */
    const source = Date.UTC(2026, 9, 20, 17);
    await insertSlot(t, { userId: a.userId, startAt: source, status: "expired" });
    const now = Date.UTC(2026, 9, 26, 12);
    vi.setSystemTime(now);
    expect(await a.as.mutation(api.availability.copyLastWeek, {})).toBe(1);
    // Tue 27 Oct 18:00 WET
    expect(await copiedStarts(t, a.userId, now)).toEqual([[Date.UTC(2026, 9, 27, 18), HOUR]]);
  });

  it("keeps the Lisbon wall-clock time across the spring clock change and skips copies now in the past", async () => {
    const t = setup();
    const a = await createUser(t);
    // Mon 22 Mar 2027 12:30 WET: a week later is 12:30 WEST = 11:30Z, before now
    await insertSlot(t, {
      userId: a.userId,
      startAt: Date.UTC(2027, 2, 22, 12, 30),
      status: "expired",
    });
    // Tue 23 Mar 2027 18:00 WET
    await insertSlot(t, {
      userId: a.userId,
      startAt: Date.UTC(2027, 2, 23, 18),
      status: "expired",
    });
    const now = Date.UTC(2027, 2, 29, 12);
    vi.setSystemTime(now);
    expect(await a.as.mutation(api.availability.copyLastWeek, {})).toBe(1);
    // Tue 30 Mar 18:00 WEST
    expect(await copiedStarts(t, a.userId, now)).toEqual([[Date.UTC(2027, 2, 30, 17), HOUR]]);
  });
});

describe("addLisbonDays", () => {
  it("is a plain 7 x 24 h shift when no clock change is crossed", () => {
    expect(addLisbonDays(NOW, 7)).toBe(NOW + 7 * DAY);
  });

  it("resolves wall times skipped or repeated by the clock change deterministically", () => {
    // Sun 28 Mar 2027 01:30 does not exist: lands at 02:30 WEST
    expect(addLisbonDays(Date.UTC(2027, 2, 21, 1, 30), 7)).toBe(Date.UTC(2027, 2, 28, 1, 30));
    // Sun 25 Oct 2026 01:30 happens twice: takes the earlier, 01:30 WEST
    expect(addLisbonDays(Date.UTC(2026, 9, 18, 0, 30), 7)).toBe(Date.UTC(2026, 9, 25, 0, 30));
  });
});

describe("availability.search", () => {
  it("returns open slots in my municipality within range and NTRP window, excluding mine", async () => {
    const t = setup();
    const me = await createUser(t, { ntrp: 3.5 });
    const close = await createUser(t, { ntrp: 4 });
    const far = await createUser(t, { ntrp: 5.5 });
    const elsewhere = await createUser(t, { ntrp: 3.5, municipality: "Coimbra" });
    await createSlot(me, tomorrow10);
    await createSlot(close, tomorrow10);
    await createSlot(far, tomorrow10);
    await createSlot(elsewhere, tomorrow10);
    await createSlot(close, tomorrow10 + 10 * DAY);

    const result = await me.as.query(api.availability.search, {
      ...week,
      minNtrp: 3,
      maxNtrp: 4,
      paginationOpts: page,
    });
    expect(result.isDone).toBe(true);
    expect(result.page).toHaveLength(1);
    expect(result.page[0]?.slot.startAt).toBe(tomorrow10);
    expect(result.page[0]?.player).toEqual({
      userId: close.userId,
      displayName: expect.any(String),
      age: 36,
      ntrp: 4,
      yearsPlaying: 5,
      formats: "both",
      languages: ["pt"],
    });
  });

  it("excludes cancelled slots, blocked users in both directions, and applies format and venue filters", async () => {
    const t = setup();
    const me = await createUser(t);
    const blockedByMe = await createUser(t);
    const blockedMe = await createUser(t);
    const singlesOnly = await createUser(t, { formats: "singles" });
    const withVenue = await createUser(t);
    const venueId = await t.run(async (ctx) =>
      ctx.db.insert("venues", {
        name: "V",
        district: "Coimbra",
        municipality: "Figueira da Foz",
        isActive: true,
      }),
    );
    await createSlot(blockedByMe, tomorrow10);
    await createSlot(blockedMe, tomorrow10);
    await createSlot(singlesOnly, tomorrow10);
    const cancelled = await createSlot(withVenue, tomorrow10 + 3 * HOUR);
    await withVenue.as.mutation(api.availability.cancel, { slotId: cancelled });
    await withVenue.as.mutation(api.availability.create, {
      startAt: tomorrow10,
      endAt: tomorrow10 + HOUR,
      venueId,
    });
    await me.as.mutation(api.blocks.block, { userId: blockedByMe.userId });
    await blockedMe.as.mutation(api.blocks.block, { userId: me.userId });

    const base = { ...week, minNtrp: 1, maxNtrp: 7, paginationOpts: page };
    const all = await me.as.query(api.availability.search, base);
    expect(all.page.map((r) => r.player.userId).sort()).toEqual(
      [singlesOnly.userId, withVenue.userId].sort(),
    );

    const doubles = await me.as.query(api.availability.search, { ...base, format: "doubles" });
    expect(doubles.page.map((r) => r.player.userId)).toEqual([withVenue.userId]);

    const atVenue = await me.as.query(api.availability.search, { ...base, venueId });
    expect(atVenue.page.map((r) => r.player.userId)).toEqual([withVenue.userId]);
  });

  it("skips slots that already started even when the range reaches into the past", async () => {
    const t = setup();
    const me = await createUser(t);
    const other = await createUser(t);
    await insertSlot(t, { userId: other.userId, startAt: NOW - HOUR, status: "open" });
    await createSlot(other, tomorrow10);
    const result = await me.as.query(api.availability.search, {
      from: NOW - DAY,
      to: NOW + 7 * DAY,
      minNtrp: 1,
      maxNtrp: 7,
      paginationOpts: page,
    });
    expect(result.page.map((r) => r.slot.startAt)).toEqual([tomorrow10]);
  });

  it("pages through results in start order", async () => {
    const t = setup();
    const me = await createUser(t);
    const other = await createUser(t);
    for (const offset of [2, 0, 1]) await createSlot(other, tomorrow10 + offset * DAY);
    const base = { ...week, minNtrp: 1, maxNtrp: 7 };
    const first = await me.as.query(api.availability.search, {
      ...base,
      paginationOpts: { numItems: 2, cursor: null },
    });
    expect(first.page.map((r) => r.slot.startAt)).toEqual([tomorrow10, tomorrow10 + DAY]);
    expect(first.isDone).toBe(false);
    const second = await me.as.query(api.availability.search, {
      ...base,
      paginationOpts: { numItems: 2, cursor: first.continueCursor },
    });
    expect(second.page.map((r) => r.slot.startAt)).toEqual([tomorrow10 + 2 * DAY]);
    expect(second.isDone).toBe(true);
  });

  it("rejects an inverted, empty or over-long range", async () => {
    const t = setup();
    const me = await createUser(t);
    const base = { minNtrp: 1, maxNtrp: 7, paginationOpts: page };
    for (const range of [
      { from: NOW + DAY, to: NOW },
      { from: NOW, to: NOW },
      { from: NOW, to: NOW + 32 * DAY },
      { from: NOW, to: Number.NaN },
    ]) {
      await expect(me.as.query(api.availability.search, { ...base, ...range })).rejects.toThrow(
        "INVALID_RANGE",
      );
    }
  });
});
