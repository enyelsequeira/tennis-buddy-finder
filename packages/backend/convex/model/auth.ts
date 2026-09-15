import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

import { fail } from "./errors";

export type Ctx = QueryCtx | MutationCtx;

/**
 * Resolves the calling identity to its `users` row. The identity `subject`
 * is the Better Auth user id, mirrored in `users.authId`.
 */
export async function getCurrentUser(ctx: Ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) fail("UNAUTHENTICATED");
  const user = await ctx.db
    .query("users")
    .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
    .unique();
  if (!user || user.bannedAt !== undefined) fail("UNAUTHENTICATED");
  return user;
}

export async function getProfileForUser(ctx: Ctx, userId: Doc<"users">["_id"]) {
  return ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

export async function getCurrentProfile(ctx: Ctx) {
  const user = await getCurrentUser(ctx);
  const profile = await getProfileForUser(ctx, user._id);
  if (!profile) fail("PROFILE_REQUIRED");
  return { user, profile };
}
