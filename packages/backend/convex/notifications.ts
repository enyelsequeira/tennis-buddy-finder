import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { getCurrentUser, type Ctx } from "./model/auth";
import { isHiddenFrom } from "./model/blocks";
import { otherMemberId } from "./model/conversations";
import { fail } from "./model/errors";
import { unreadNotifications } from "./model/notifications";
import schema from "./schema";

const MAX_UNREAD = 50;
/** Unread rows scanned to fill `MAX_UNREAD`, so hidden ones do not eat the cap. */
const MAX_UNREAD_SCANNED = 200;
/** At least `MAX_UNREAD_SCANNED`, so every row `unread` can show gets marked. */
const MAX_MARKED_PER_CALL = MAX_UNREAD_SCANNED;

/** The other player a notification is about, if it points at a request or conversation. */
async function counterpartOf(ctx: Ctx, row: Doc<"notifications">) {
  if (row.requestId) {
    const request = await ctx.db.get("matchRequests", row.requestId);
    if (request) return request.fromUserId === row.userId ? request.toUserId : request.fromUserId;
  }
  if (row.conversationId) {
    const conversation = await ctx.db.get("conversations", row.conversationId);
    if (conversation) return otherMemberId(conversation, row.userId);
  }
  return null;
}

export const unread = query({
  args: {},
  returns: v.array(schema.doc("notifications")),
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    const rows = await unreadNotifications(ctx, me._id, MAX_UNREAD_SCANNED);
    // Rows about a banned or blocked player are not shown, as their request or chat looks
    // like it does not exist. They stay unread and come back if that changes, unless
    // `markAllRead` swept them meanwhile.
    const hidden = new Map<Id<"users">, boolean>();
    const visible = [];
    for (const row of rows) {
      const counterpart = await counterpartOf(ctx, row);
      if (counterpart) {
        if (!hidden.has(counterpart)) {
          hidden.set(counterpart, await isHiddenFrom(ctx, me._id, counterpart));
        }
        if (hidden.get(counterpart)) continue;
      }
      visible.push(row);
      if (visible.length === MAX_UNREAD) break;
    }
    return visible;
  },
});

export const markAllRead = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    const readAt = Date.now();
    // Newest first, so the ones `unread` shows are always among those marked.
    const rows = await unreadNotifications(ctx, me._id, MAX_MARKED_PER_CALL);
    for (const row of rows) await ctx.db.patch("notifications", row._id, { readAt });
    return null;
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    const row = await ctx.db.get("notifications", args.notificationId);
    if (!row) fail("NOT_FOUND");
    if (row.userId !== me._id) fail("FORBIDDEN");
    if (row.readAt === undefined) {
      await ctx.db.patch("notifications", row._id, { readAt: Date.now() });
    }
    return null;
  },
});
