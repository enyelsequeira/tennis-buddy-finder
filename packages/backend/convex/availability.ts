import { paginationOptsValidator } from "convex/server";
import { v, type Infer } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { getProfileForUser, profileMutation, profileQuery, type Ctx } from "./model/auth";
import { isHiddenFrom } from "./model/blocks";
import { fail } from "./model/errors";
import { playerCard, toPlayerCard } from "./model/playerCard";
import { cancelSlot, declinePendingForSlot } from "./model/requests";
import { addLisbonDays, DAY, isOnSlotGrid, MAX_SLOT_MS } from "./model/time";
import { formatsValidator, paginated } from "./model/validators";
import schema from "./schema";

export const slotDoc = schema.doc("availabilitySlots");

const MAX_SLOTS_PER_QUERY = 200;
const MAX_NOTE = 200;
const MAX_SEARCH_RANGE = 31 * DAY;
const MAX_SEARCH_PAGE = 100;

type SlotRange = { startAt: number; endAt: number };

/** Every status but "cancelled": the slots that still occupy their time. */
const LIVE_SLOT_STATUSES = ["open", "matched", "expired"] as const;

/**
 * The user's live slots starting strictly between `after` and `before`, oldest first. Queried per
 * status so cancelled rows can't use up the `take()` limit.
 */
async function liveSlotsStartingBetween(
  ctx: Ctx,
  userId: Id<"users">,
  after: number,
  before: number,
) {
  const perStatus = await Promise.all(
    LIVE_SLOT_STATUSES.map((status) =>
      ctx.db
        .query("availabilitySlots")
        .withIndex("by_userId_and_status_and_startAt", (q) =>
          q.eq("userId", userId).eq("status", status).gt("startAt", after).lt("startAt", before),
        )
        .take(MAX_SLOTS_PER_QUERY),
    ),
  );
  return perStatus.flat().sort((a, b) => a.startAt - b.startAt);
}

function validateRange({ startAt, endAt }: SlotRange) {
  if (endAt <= startAt) fail("SLOT_INVALID_RANGE");
  if (!isOnSlotGrid(startAt) || !isOnSlotGrid(endAt)) fail("SLOT_NOT_ON_GRID");
  if (startAt <= Date.now()) fail("SLOT_IN_PAST");
  if (endAt - startAt > MAX_SLOT_MS) fail("SLOT_TOO_LONG");
}

async function hasOverlap(ctx: Ctx, slot: SlotRange & { userId: Id<"users"> }) {
  // Slots last at most MAX_SLOT_MS, so anything overlapping starts within that much of `startAt`.
  const candidates = await liveSlotsStartingBetween(
    ctx,
    slot.userId,
    slot.startAt - MAX_SLOT_MS,
    slot.endAt,
  );
  return candidates.some((other) => other.endAt > slot.startAt);
}

async function getOwnSlot(ctx: Ctx, userId: Id<"users">, slotId: Id<"availabilitySlots">) {
  const slot = await ctx.db.get("availabilitySlots", slotId);
  if (!slot) fail("NOT_FOUND");
  if (slot.userId !== userId) fail("FORBIDDEN");
  return slot;
}

async function isUsableVenue(ctx: Ctx, venueId: Id<"venues">, profile: Doc<"profiles">) {
  const venue = await ctx.db.get("venues", venueId);
  return !!venue && venue.isActive && venue.municipality === profile.municipality;
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
    if (args.venueId !== undefined && !(await isUsableVenue(ctx, args.venueId, profile))) {
      fail("INVALID_VENUE");
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
    const requested = await ctx.db
      .query("matchRequests")
      .withIndex("by_slotId_and_status", (q) => q.eq("slotId", slot._id))
      .first();
    // Requesters' cards and notifications point at the slot, so a requested one is only cancelled.
    if (requested) await ctx.db.patch("availabilitySlots", slot._id, { status: "cancelled" });
    else await ctx.db.delete("availabilitySlots", slot._id);
    return null;
  },
});

export const cancel = profileMutation({
  args: { slotId: v.id("availabilitySlots") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const slot = await getOwnSlot(ctx, ctx.user._id, args.slotId);
    if (slot.status !== "open" && slot.status !== "matched") fail("SLOT_NOT_OPEN");
    await cancelSlot(ctx, slot);
    return null;
  },
});

export const mine = profileQuery({
  args: { from: v.number(), to: v.number() },
  returns: v.array(
    slotDoc.extend({
      partner: v.optional(v.object({ userId: v.id("users"), displayName: v.string() })),
    }),
  ),
  handler: async (ctx, args) => {
    const { user } = ctx;
    // Per status, so cancelled rows can't push live slots past the `take()` limit.
    const perStatus = await Promise.all(
      [...LIVE_SLOT_STATUSES, "cancelled" as const].map((status) =>
        ctx.db
          .query("availabilitySlots")
          .withIndex("by_userId_and_status_and_startAt", (q) =>
            q
              .eq("userId", user._id)
              .eq("status", status)
              .gte("startAt", args.from)
              .lt("startAt", args.to),
          )
          .take(MAX_SLOTS_PER_QUERY),
      ),
    );
    const slots = perStatus.flat().sort((a, b) => a.startAt - b.startAt);
    async function loadPartner(slot: Doc<"availabilitySlots">) {
      if (slot.status !== "matched") return undefined;
      const accepted = await ctx.db
        .query("matchRequests")
        .withIndex("by_slotId_and_status", (q) => q.eq("slotId", slot._id).eq("status", "accepted"))
        .unique();
      if (!accepted || (await isHiddenFrom(ctx, user._id, accepted.fromUserId))) return undefined;
      const profile = await getProfileForUser(ctx, accepted.fromUserId);
      return profile ? { userId: profile.userId, displayName: profile.displayName } : undefined;
    }
    return Promise.all(slots.map(async (slot) => ({ ...slot, partner: await loadPartner(slot) })));
  },
});

export const listOpenForUser = profileQuery({
  args: { userId: v.id("users") },
  returns: v.array(slotDoc),
  handler: async (ctx, args) => {
    const { user } = ctx;
    if (await isHiddenFrom(ctx, user._id, args.userId)) return [];
    return ctx.db
      .query("availabilitySlots")
      .withIndex("by_userId_and_status_and_startAt", (q) =>
        q.eq("userId", args.userId).eq("status", "open").gt("startAt", Date.now()),
      )
      .take(MAX_SLOTS_PER_QUERY);
  },
});

export const copyLastWeek = profileMutation({
  args: {},
  returns: v.object({ created: v.number(), skipped: v.number() }),
  handler: async (ctx) => {
    const { user, profile } = ctx;
    const now = Date.now();
    // Rolling window: slots that started in the last 7 days, not the previous calendar week.
    const lastWeek = (await liveSlotsStartingBetween(ctx, user._id, now - 7 * DAY, now)).slice(
      0,
      MAX_SLOTS_PER_QUERY,
    );
    let created = 0;
    // Lets the client tell "already copied" apart from "nothing to copy".
    let skipped = 0;
    for (const slot of lastWeek) {
      // Same Lisbon wall-clock time a week later, so copies across a DST change keep their hour.
      const startAt = addLisbonDays(slot.startAt, 7);
      // Keeping the duration avoids inverted or over-long slots when one spans the clock change.
      const endAt = startAt + (slot.endAt - slot.startAt);
      // Across spring-forward a week is only 167 h, so the earliest copies can land in the past.
      if (startAt <= now || (await hasOverlap(ctx, { userId: user._id, startAt, endAt }))) {
        skipped += 1;
        continue;
      }
      await ctx.db.insert("availabilitySlots", {
        userId: user._id,
        startAt,
        endAt,
        district: profile.district,
        municipality: profile.municipality,
        // A venue closed or outside the player's current municipality is dropped, not the slot.
        venueId:
          slot.venueId !== undefined && (await isUsableVenue(ctx, slot.venueId, profile))
            ? slot.venueId
            : undefined,
        note: slot.note,
        status: "open",
      });
      created += 1;
    }
    return { created, skipped };
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
          .gte("startAt", args.from)
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
      // Not in the index range: a bound that moves with the clock invalidates the page cursor.
      if (slot.startAt <= now) continue;
      if (args.venueId !== undefined && slot.venueId !== args.venueId) continue;
      if (!players.has(slot.userId)) players.set(slot.userId, await loadPlayer(slot.userId));
      const player = players.get(slot.userId);
      if (player) page.push({ slot, player });
    }
    return { ...result, page };
  },
});
