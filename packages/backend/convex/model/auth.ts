import { customCtx, customMutation, customQuery } from "convex-helpers/server/customFunctions";

import type { Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";

import { fail } from "./errors";
import { getUserByAuthId } from "./users";

export type Ctx = QueryCtx | MutationCtx;

/**
 * Resolves the calling identity to its `users` row. The identity `subject`
 * is the Better Auth user id, mirrored in `users.authId`.
 */
export async function getCurrentUser(ctx: Ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) fail("UNAUTHENTICATED");
  const user = await getUserByAuthId(ctx, identity.subject);
  if (!user || user.bannedAt !== undefined) fail("UNAUTHENTICATED");
  return user;
}

export async function getProfileForUser(ctx: Ctx, userId: Id<"users">) {
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

/** `query` / `mutation` whose handler gets the signed-in caller as `ctx.user`. */
export const userQuery = customQuery(
  query,
  customCtx(async (ctx) => ({ user: await getCurrentUser(ctx) })),
);
export const userMutation = customMutation(
  mutation,
  customCtx(async (ctx) => ({ user: await getCurrentUser(ctx) })),
);

/** Like `userQuery` / `userMutation`, plus the caller's `ctx.profile` (PROFILE_REQUIRED without one). */
export const profileQuery = customQuery(
  query,
  customCtx(async (ctx) => getCurrentProfile(ctx)),
);
export const profileMutation = customMutation(
  mutation,
  customCtx(async (ctx) => getCurrentProfile(ctx)),
);
