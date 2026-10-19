import type { Id } from "../_generated/dataModel";

import type { Ctx } from "./auth";

export async function isBlockedEitherWay(ctx: Ctx, a: Id<"users">, b: Id<"users">) {
  const ab = await ctx.db
    .query("blocks")
    .withIndex("by_blockerId_and_blockedId", (q) => q.eq("blockerId", a).eq("blockedId", b))
    .unique();
  if (ab) return true;
  const ba = await ctx.db
    .query("blocks")
    .withIndex("by_blockerId_and_blockedId", (q) => q.eq("blockerId", b).eq("blockedId", a))
    .unique();
  return ba !== null;
}

/** A banned (or deleted) user is invisible to every other player. */
export async function isBanned(ctx: Ctx, userId: Id<"users">) {
  const user = await ctx.db.get("users", userId);
  return !user || user.bannedAt !== undefined;
}

/**
 * Whether `other` must look like they do not exist to `viewer`: a block in
 * either direction, or `other` is banned.
 */
export async function isHiddenFrom(ctx: Ctx, viewer: Id<"users">, other: Id<"users">) {
  if (await isBanned(ctx, other)) return true;
  return isBlockedEitherWay(ctx, viewer, other);
}
