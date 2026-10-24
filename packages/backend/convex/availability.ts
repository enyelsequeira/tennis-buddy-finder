import { paginationOptsValidator } from "convex/server";
import { v, type Infer } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { getProfileForUser, profileMutation, profileQuery, type Ctx } from "./model/auth";
import { isHiddenFrom } from "./model/blocks";
import { fail } from "./model/errors";
import { createNotification } from "./model/notifications";
import { playerCard, toPlayerCard } from "./model/playerCard";
import { declinePendingForSlot } from "./model/requests";
import { addLisbonDays, DAY, isOnSlotGrid, MAX_SLOT_MS } from "./model/time";
import { formatsValidator, paginated } from "./model/validators";
import schema from "./schema";

export const slotDoc = schema.doc("availabilitySlots");

const MAX_SLOTS_PER_QUERY = 200;
const MAX_NOTE = 200;
const MAX_SEARCH_RANGE = 31 * DAY;
const MAX_SEARCH_PAGE = 100;

type SlotRange = { startAt: number; endAt: number };

function validateRange({ startAt, endAt }: SlotRange) {
  if (endAt <= startAt) fail("SLOT_INVALID_RANGE");
  if (!isOnSlotGrid(startAt) || !isOnSlotGrid(endAt)) fail("SLOT_NOT_ON_GRID");
  if (startAt <= Date.now()) fail("SLOT_IN_PAST");
  if (endAt - startAt > MAX_SLOT_MS) fail("SLOT_TOO_LONG");
}

async function hasOverlap(ctx: Ctx, slot: SlotRange & { userId: Id<"users"> }) {
  // Slots last at most MAX_SLOT_MS, so anything overlapping starts within that much of `startAt`.
  const candidates = await ctx.db
    .query("availabilitySlots")
    .withIndex("by_userId_and_startAt", (q) =>
      q
        .eq("userId", slot.userId)
        .gt("startAt", slot.startAt - MAX_SLOT_MS)
        .lt("startAt", slot.endAt),
    )
    .take(MAX_SLOTS_PER_QUERY);
  return candidates.some((other) => other.status !== "cancelled" && other.endAt > slot.startAt);
}

async function getOwnSlot(ctx: Ctx, userId: Id<"users">, slotId: Id<"availabilitySlots">) {
  const slot = await ctx.db.get("availabilitySlots", slotId);
  if (!slot) fail("NOT_FOUND");
  if (slot.userId !== userId) fail("FORBIDDEN");
  return slot;
}

export const create = profileMutation({
  args: {
    startAt: v.number(),
    endAt: v.number(),
    venueId: v.optional(v.id("venues")),
    note: v.optional(v.string()),
  },
  returns: v.id("availabilitySlots"),
  handler: async (ctx, args) => {
    const { user, profile } = ctx;
    validateRange(args);
    if (args.note !== undefined && args.note.length > MAX_NOTE) fail("INVALID_NOTE");
    if (args.venueId !== undefined) {
      const venue = await ctx.db.get("venues", args.venueId);
      if (!venue || !venue.isActive || venue.municipality !== profile.municipality) {
        fail("INVALID_VENUE");
      }
    }
    if (await hasOverlap(ctx, { userId: user._id, startAt: args.startAt, endAt: args.endAt })) {
      fail("SLOT_OVERLAP");
    }
    return ctx.db.insert("availabilitySlots", {
      userId: user._id,
      startAt: args.startAt,
      endAt: args.endAt,
      district: profile.district,
      municipality: profile.municipality,
      venueId: args.venueId,
      note: args.note,
      status: "open",
    });
  },
});

export const remove = profileMutation({
  args: { slotId: v.id("availabilitySlots") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const slot = await getOwnSlot(ctx, ctx.user._id, args.slotId);
    if (slot.status !== "open") fail("SLOT_NOT_OPEN");
    await declinePendingForSlot(ctx, { slotId: slot._id });
    await ctx.db.delete("availabilitySlots", slot._id);
    return null;
  },
});

export const cancel = profileMutation({
  args: { slotId: v.id("availabilitySlots") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const slot = await getOwnSlot(ctx, ctx.user._id, args.slotId);
    if (slot.status !== "open" && slot.status !== "matched") fail("SLOT_NOT_OPEN");
    await declinePendingForSlot(ctx, { slotId: slot._id });
    if (slot.status === "matched") {
      const accepted = await ctx.db
        .query("matchRequests")
        .withIndex("by_slotId_and_status", (q) => q.eq("slotId", slot._id).eq("status", "accepted"))
        .unique();
      if (accepted) {
        await ctx.db.patch("matchRequests", accepted._id, {
          status: "cancelled",
          respondedAt: Date.now(),
        });
        await createNotification(ctx, {
          userId: accepted.fromUserId,
          type: "request_declined",
          requestId: accepted._id,
        });
      }
    }
    await ctx.db.patch("availabilitySlots", slot._id, { status: "cancelled" });
    return null;
  },
});

export const mine = profileQuery({
  args: { from: v.number(), to: v.number() },
  returns: v.array(slotDoc),
  handler: async (ctx, args) => {
    const { user } = ctx;
    return ctx.db
      .query("availabilitySlots")
      .withIndex("by_userId_and_startAt", (q) =>
        q.eq("userId", user._id).gte("startAt", args.from).lt("startAt", args.to),
      )
      .take(MAX_SLOTS_PER_QUERY);
  },
});

export const listOpenForUser = profileQuery({
  args: { userId: v.id("users") },
  returns: v.array(slotDoc),
  handler: async (ctx, args) => {
    const { user } = ctx;
    if (await isHiddenFrom(ctx, user._id, args.userId)) return [];
    const slots = await ctx.db
      .query("availabilitySlots")
      .withIndex("by_userId_and_startAt", (q) =>
        q.eq("userId", args.userId).gt("startAt", Date.now()),
      )
      .take(MAX_SLOTS_PER_QUERY);
    return slots.filter((slot) => slot.status === "open");
  },
});

export const copyLastWeek = profileMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const { user } = ctx;
    const now = Date.now();
    // Rolling window: slots that started in the last 7 days, not the previous calendar week.
    const lastWeek = await ctx.db
      .query("availabilitySlots")
      .withIndex("by_userId_and_startAt", (q) =>
        q
          .eq("userId", user._id)
          .gt("startAt", now - 7 * DAY)
          .lt("startAt", now),
      )
      .take(MAX_SLOTS_PER_QUERY);
    let created = 0;
    for (const slot of lastWeek) {
      if (slot.status === "cancelled") continue;
      // Same Lisbon wall-clock time a week later, so copies across a DST change keep their hour.
      const startAt = addLisbonDays(slot.startAt, 7);
      // Keeping the duration avoids inverted or over-long slots when one spans the clock change.
      const endAt = startAt + (slot.endAt - slot.startAt);
      // Across spring-forward a week is only 167 h, so the earliest copies can land in the past.
      if (startAt <= now) continue;
      if (await hasOverlap(ctx, { userId: user._id, startAt, endAt })) continue;
      await ctx.db.insert("availabilitySlots", {
        userId: user._id,
        startAt,
        endAt,
        district: slot.district,
        municipality: slot.municipality,
        venueId: slot.venueId,
        note: slot.note,
        status: "open",
      });
      created += 1;
    }
    return created;
  },
});

export const search = profileQuery({
  args: {
    from: v.number(),
    to: v.number(),
    minNtrp: v.number(),
    maxNtrp: v.number(),
    format: v.optional(formatsValidator),
    venueId: v.optional(v.id("venues")),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginated(v.object({ slot: slotDoc, player: playerCard })),
  handler: async (ctx, args) => {
    const { user, profile } = ctx;
    const span = args.to - args.from;
    // Written as a negation so a NaN bound is rejected too.
    if (!(span > 0 && span <= MAX_SEARCH_RANGE)) fail("INVALID_RANGE");
    const now = Date.now();

    const result = await ctx.db
      .query("availabilitySlots")
      .withIndex("by_municipality_and_status_and_startAt", (q) =>
        q
          .eq("municipality", profile.municipality)
          .eq("status", "open")
          .gte("startAt", Math.max(args.from, now))
          .lt("startAt", args.to),
      )
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(args.paginationOpts.numItems, MAX_SEARCH_PAGE),
      });

    async function loadPlayer(userId: Id<"users">) {
      if (userId === user._id || (await isHiddenFrom(ctx, user._id, userId))) return null;
      const player = await getProfileForUser(ctx, userId);
      if (!player || player.ntrp < args.minNtrp || player.ntrp > args.maxNtrp) return null;
      if (
        args.format !== undefined &&
        player.formats !== "both" &&
        player.formats !== args.format
      ) {
        return null;
      }
      return toPlayerCard(player);
    }

    // Cached per page because one player can own several slots; null marks a filtered-out player.
    const players = new Map<Id<"users">, Infer<typeof playerCard> | null>();

    // The index cannot express the player filters, so they run after pagination: a page can
    // hold fewer items than requested, and the client keeps loading while `isDone` is false.
    const page = [];
    for (const slot of result.page) {
      if (args.venueId !== undefined && slot.venueId !== args.venueId) continue;
      if (!players.has(slot.userId)) players.set(slot.userId, await loadPlayer(slot.userId));
      const player = players.get(slot.userId);
      if (player) page.push({ slot, player });
    }
    return { ...result, page };
  },
});
