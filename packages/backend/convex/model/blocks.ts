import type { Id } from "../_generated/dataModel";

import type { Ctx } from "./auth";

export async function getBlock(ctx: Ctx, blockerId: Id<"users">, blockedId: Id<"users">) {
  return ctx.db
    .query("blocks")
    .withIndex("by_blockerId_and_blockedId", (q) =>
      q.eq("blockerId", blockerId).eq("blockedId", blockedId),
    )
    .unique();
}

export async function isBlockedEitherWay(ctx: Ctx, a: Id<"users">, b: Id<"users">) {
  if (await getBlock(ctx, a, b)) return true;
  return (await getBlock(ctx, b, a)) !== null;
}

/**
 * A banned user is invisible to every other player. A missing `users` row is
 * not a ban: deleted players keep their "deleted player" handling.
 */
export async function isBanned(ctx: Ctx, userId: Id<"users">) {
  const user = await ctx.db.get("users", userId);
  return user?.bannedAt !== undefined;
}

/**
 * Whether `other` must look like they do not exist to `viewer`: a block in
 * either direction, or `other` is banned.
 */
export async function isHiddenFrom(ctx: Ctx, viewer: Id<"users">, other: Id<"users">) {
  if (await isBanned(ctx, other)) return true;
  return isBlockedEitherWay(ctx, viewer, other);
}
