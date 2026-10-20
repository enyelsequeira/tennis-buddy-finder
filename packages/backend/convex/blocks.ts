import { v } from "convex/values";

import { getProfileForUser, userMutation, userQuery } from "./model/auth";
import { getBlock, isBanned } from "./model/blocks";
import { fail } from "./model/errors";
import { cancelPendingBetween } from "./model/requests";

export const block = userMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const me = ctx.user;
    if (args.userId === me._id) fail("CANNOT_BLOCK_SELF");
    const target = await ctx.db.get("users", args.userId);
    // A banned player looks like they do not exist, as everywhere else.
    if (!target || target.bannedAt !== undefined) fail("NOT_FOUND");
    const existing = await getBlock(ctx, me._id, args.userId);
    if (!existing) {
      await ctx.db.insert("blocks", { blockerId: me._id, blockedId: args.userId });
    }
    await cancelPendingBetween(ctx, { userId: me._id, otherUserId: args.userId });
    return null;
  },
});

export const unblock = userMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const me = ctx.user;
    const existing = await getBlock(ctx, me._id, args.userId);
    if (existing) await ctx.db.delete("blocks", existing._id);
    return null;
  },
});

export const listMine = userQuery({
  args: {},
  returns: v.array(v.object({ userId: v.id("users"), displayName: v.string() })),
  handler: async (ctx) => {
    const me = ctx.user;
    const blocks = await ctx.db
      .query("blocks")
      .withIndex("by_blockerId_and_blockedId", (q) => q.eq("blockerId", me._id))
      .take(500);
    const rows = [];
    for (const block of blocks) {
      // The block row stays, so it applies again if the ban is lifted.
      if (await isBanned(ctx, block.blockedId)) continue;
      const profile = await getProfileForUser(ctx, block.blockedId);
      rows.push({ userId: block.blockedId, displayName: profile?.displayName ?? "Deleted user" });
    }
    return rows;
  },
});
