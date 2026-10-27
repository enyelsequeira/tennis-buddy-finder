import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

import type { Ctx } from "./auth";
import type { Pair } from "./conversations";
import { createNotification, deleteRequestNotifications } from "./notifications";

const MAX_PENDING = 100;

type DeclineReason = Doc<"matchRequests">["reason"];

export async function declineRequest(
  ctx: MutationCtx,
  request: Doc<"matchRequests">,
  reason?: DeclineReason,
) {
  await ctx.db.patch("matchRequests", request._id, {
    status: "declined",
    reason,
    respondedAt: Date.now(),
  });
  // A pending request only has the owner's request_received, which is now dead.
  await deleteRequestNotifications(ctx, request._id);
  await createNotification(ctx, {
    userId: request.fromUserId,
    type: reason === "slot_taken" ? "slot_taken" : "request_declined",
    requestId: request._id,
  });
}

/** `fromUserId`'s newest request on a slot; only that one can be pending. */
export async function latestRequest(
  ctx: Ctx,
  slotId: Id<"availabilitySlots">,
  fromUserId: Id<"users">,
) {
  return ctx.db
    .query("matchRequests")
    .withIndex("by_slotId_and_fromUserId", (q) =>
      q.eq("slotId", slotId).eq("fromUserId", fromUserId),
    )
    .order("desc")
    .first();
}

type DeclineOptions = {
  slotId: Id<"availabilitySlots">;
  except?: Id<"matchRequests">;
  reason?: DeclineReason;
};

export async function declinePendingForSlot(ctx: MutationCtx, options: DeclineOptions) {
  const pending = await ctx.db
    .query("matchRequests")
    .withIndex("by_slotId_and_status", (q) =>
      q.eq("slotId", options.slotId).eq("status", "pending"),
    )
    .take(MAX_PENDING);
  for (const request of pending) {
    if (request._id !== options.except) await declineRequest(ctx, request, options.reason);
  }
}

/** Cancels an open or matched slot: pending requests are declined and a matched partner is told. */
export async function cancelSlot(ctx: MutationCtx, slot: Doc<"availabilitySlots">) {
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
}

/** Cancels pending requests between two users in both directions, without notifying anyone. */
export async function cancelPendingBetween(ctx: MutationCtx, pair: Pair) {
  const respondedAt = Date.now();
  for (const [from, to] of [
    [pair.userId, pair.otherUserId],
    [pair.otherUserId, pair.userId],
  ] as const) {
    const pending = await ctx.db
      .query("matchRequests")
      .withIndex("by_fromUserId_and_status", (q) =>
        q.eq("fromUserId", from).eq("status", "pending"),
      )
      .take(MAX_PENDING);
    for (const request of pending) {
      if (request.toUserId !== to) continue;
      await ctx.db.patch("matchRequests", request._id, { status: "cancelled", respondedAt });
      await deleteRequestNotifications(ctx, request._id);
    }
  }
}
