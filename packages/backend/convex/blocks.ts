import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { getCurrentUser, getProfileForUser } from "./model/auth";
import { fail } from "./model/errors";

export const block = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (args.userId === me._id) fail("CANNOT_BLOCK_SELF");
    const target = await ctx.db.get("users", args.userId);
    if (!target) fail("NOT_FOUND");
    const existing = await ctx.db
      .query("blocks")
      .withIndex("by_blockerId_and_blockedId", (q) =>
        q.eq("blockerId", me._id).eq("blockedId", args.userId),
      )
      .unique();
    if (!existing) {
      await ctx.db.insert("blocks", { blockerId: me._id, blockedId: args.userId });
    }
    return null;
  },
});

export const unblock = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    const existing = await ctx.db
      .query("blocks")
      .withIndex("by_blockerId_and_blockedId", (q) =>
        q.eq("blockerId", me._id).eq("blockedId", args.userId),
      )
      .unique();
    if (existing) await ctx.db.delete("blocks", existing._id);
    return null;
  },
});

export const listMine = query({
  args: {},
  returns: v.array(v.object({ userId: v.id("users"), displayName: v.string() })),
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    const blocks = await ctx.db
      .query("blocks")
      .withIndex("by_blockerId_and_blockedId", (q) => q.eq("blockerId", me._id))
      .take(500);
    const rows = [];
    for (const block of blocks) {
      const profile = await getProfileForUser(ctx, block.blockedId);
      rows.push({ userId: block.blockedId, displayName: profile?.displayName ?? "Deleted user" });
    }
    return rows;
  },
});
