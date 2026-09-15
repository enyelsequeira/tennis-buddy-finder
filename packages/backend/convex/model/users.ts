import type { MutationCtx, QueryCtx } from "../_generated/server";

export type AuthUserInput = {
  /** Better Auth user id (`identity.subject`). */
  authId: string;
  email: string;
  name: string;
  image?: string | null;
};

/** Looks up the app `users` row mirroring a Better Auth user id. */
export async function getUserByAuthId(ctx: QueryCtx | MutationCtx, authId: string) {
  return ctx.db
    .query("users")
    .withIndex("by_authId", (q) => q.eq("authId", authId))
    .unique();
}

/**
 * Creates the app `users` row for a Better Auth user. Idempotent on `authId`:
 * a second call returns the existing row's id without touching it.
 */
export async function createUserFromAuth(ctx: MutationCtx, input: AuthUserInput) {
  const existing = await getUserByAuthId(ctx, input.authId);
  if (existing) return existing._id;
  return ctx.db.insert("users", {
    authId: input.authId,
    email: input.email,
    name: input.name,
    image: input.image ?? undefined,
    role: "user",
    emailNotifications: true,
  });
}
