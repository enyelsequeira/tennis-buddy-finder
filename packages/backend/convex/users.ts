import { v } from "convex/values";

import { internalMutation } from "./_generated/server";
import { getProfileForUser, userMutation, userQuery } from "./model/auth";
import { createUserFromAuth, deleteAccountData as deleteAccountDataBatch } from "./model/users";
import schema from "./schema";

export const me = userQuery({
  args: {},
  returns: v.object({
    user: schema.doc("users"),
    profile: v.union(schema.doc("profiles"), v.null()),
  }),
  handler: async (ctx) => {
    const { user } = ctx;
    const profile = await getProfileForUser(ctx, user._id);
    return { user, profile };
  },
});

export const setEmailNotifications = userMutation({
  args: { enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = ctx;
    await ctx.db.patch("users", user._id, { emailNotifications: args.enabled });
    return null;
  },
});

/**
 * Creates the app `users` row for a Better Auth user. The `onCreate` trigger in
 * `auth.ts` does this automatically; this entry point exists for scripts and
 * backfills. Idempotent on `authId`.
 */
export const internalCreateFromAuth = internalMutation({
  args: {
    authId: v.string(),
    email: v.string(),
    name: v.string(),
    image: v.optional(v.string()),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => createUserFromAuth(ctx, args),
});

/** Next batch of `deleteAccountData`, scheduled until the deleted account has nothing left. */
export const deleteAccountData = internalMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await deleteAccountDataBatch(ctx, args.userId);
    return null;
  },
});
