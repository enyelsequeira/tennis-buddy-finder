import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

import type { Ctx } from "./auth";

type NotificationInput = Pick<
  Doc<"notifications">,
  "userId" | "type" | "requestId" | "conversationId"
>;

/** The only place notifications are inserted, so email scheduling can hook in here. */
export async function createNotification(ctx: MutationCtx, input: NotificationInput) {
  return ctx.db.insert("notifications", input);
}

/** Deletes every notification about `requestId`, read or not. */
export async function deleteRequestNotifications(ctx: MutationCtx, requestId: Id<"matchRequests">) {
  const rows = await ctx.db
    .query("notifications")
    .withIndex("by_requestId", (q) => q.eq("requestId", requestId))
    .collect();
  for (const row of rows) await ctx.db.delete("notifications", row._id);
}

/** Unread notifications of `userId`, newest first. */
export async function unreadNotifications(ctx: Ctx, userId: Id<"users">, limit: number) {
  return ctx.db
    .query("notifications")
    .withIndex("by_userId_and_readAt", (q) => q.eq("userId", userId).eq("readAt", undefined))
    .order("desc")
    .take(limit);
}
