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

/** Unread notifications of `userId`, newest first. */
export async function unreadNotifications(ctx: Ctx, userId: Id<"users">, limit: number) {
  return ctx.db
    .query("notifications")
    .withIndex("by_userId_and_readAt", (q) => q.eq("userId", userId).eq("readAt", undefined))
    .order("desc")
    .take(limit);
}
