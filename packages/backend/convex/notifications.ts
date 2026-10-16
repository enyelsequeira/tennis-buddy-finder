import { doc } from "convex-helpers/validators";
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./model/auth";
import { fail } from "./model/errors";
import schema from "./schema";

const MAX_UNREAD = 50;
const MAX_MARKED_PER_CALL = 200;

export const unread = query({
  args: {},
  returns: v.array(doc(schema, "notifications")),
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    return ctx.db
      .query("notifications")
      .withIndex("by_userId_and_readAt", (q) => q.eq("userId", me._id).eq("readAt", undefined))
      .order("desc")
      .take(MAX_UNREAD);
  },
});

export const markAllRead = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    const readAt = Date.now();
    // Newest first, so the ones `unread` shows are always among those marked.
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_userId_and_readAt", (q) => q.eq("userId", me._id).eq("readAt", undefined))
      .order("desc")
      .take(MAX_MARKED_PER_CALL);
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
