import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

import type { Ctx } from "./auth";
import type { Pair } from "./conversations";
import { createNotification } from "./notifications";

const MAX_PENDING = 100;

export async function declineRequest(ctx: MutationCtx, request: Doc<"matchRequests">) {
  await ctx.db.patch("matchRequests", request._id, {
    status: "declined",
    respondedAt: Date.now(),
  });
  await createNotification(ctx, {
    userId: request.fromUserId,
    type: "request_declined",
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

type DeclineOptions = { slotId: Id<"availabilitySlots">; except?: Id<"matchRequests"> };

export async function declinePendingForSlot(ctx: MutationCtx, options: DeclineOptions) {
  const pending = await ctx.db
    .query("matchRequests")
    .withIndex("by_slotId_and_status", (q) =>
      q.eq("slotId", options.slotId).eq("status", "pending"),
    )
    .take(MAX_PENDING);
  for (const request of pending) {
    if (request._id !== options.except) await declineRequest(ctx, request);
  }
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
    }
  }
}
