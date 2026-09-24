import { doc } from "convex-helpers/validators";
import { v } from "convex/values";

import { internalMutation, mutation, query } from "./_generated/server";
import { getCurrentUser, getProfileForUser } from "./model/auth";
import { createUserFromAuth } from "./model/users";
import schema from "./schema";

export const me = query({
  args: {},
  returns: v.object({
    user: doc(schema, "users"),
    profile: v.union(doc(schema, "profiles"), v.null()),
  }),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    const profile = await getProfileForUser(ctx, user._id);
    return { user, profile };
  },
});

export const setEmailNotifications = mutation({
  args: { enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
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
