import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

type NotificationInput = Pick<
  Doc<"notifications">,
  "userId" | "type" | "requestId" | "conversationId"
>;

/** The only place notifications are inserted, so email scheduling can hook in here. */
export async function createNotification(ctx: MutationCtx, input: NotificationInput) {
  return ctx.db.insert("notifications", input);
}
