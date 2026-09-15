import { type AuthFunctions, createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";

import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";
import { createUserFromAuth, getUserByAuthId } from "./model/users";

// Typed explicitly to break the type cycle between `internal.auth` and the
// trigger exports below.
const authFunctions: AuthFunctions = internal.auth;

/**
 * Better Auth component client. The `user` triggers keep the app `users`
 * table in sync with the component's own user table; `doc._id` there is the
 * value `ctx.auth.getUserIdentity().subject` carries, mirrored as
 * `users.authId`.
 */
export const authComponent = createClient<DataModel>(components.betterAuth, {
  authFunctions,
  triggers: {
    user: {
      onCreate: async (ctx, doc) => {
        await createUserFromAuth(ctx, {
          authId: doc._id,
          email: doc.email,
          name: doc.name,
          image: doc.image,
        });
      },
      onUpdate: async (ctx, newDoc, oldDoc) => {
        const changed =
          newDoc.email !== oldDoc.email ||
          newDoc.name !== oldDoc.name ||
          newDoc.image !== oldDoc.image;
        if (!changed) return;
        const user = await getUserByAuthId(ctx, newDoc._id);
        if (!user) return;
        await ctx.db.patch("users", user._id, {
          email: newDoc.email,
          name: newDoc.name,
          image: newDoc.image ?? undefined,
        });
      },
      onDelete: async (ctx, doc) => {
        // Only the mirrored `users` row is removed here. The full cascade
        // (profile, slots, requests, messages, ...) is driven by the app-side
        // account deletion mutation in a later plan.
        const user = await getUserByAuthId(ctx, doc._id);
        if (!user) return;
        await ctx.db.delete("users", user._id);
      },
    },
  },
});

/** Internal mutations the component calls to run the triggers above. */
export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var ${name}. Set it with: npx convex env set ${name}=<value>`);
  }
  return value;
}

/**
 * OAuth providers are only registered when both halves of their credentials
 * exist on the deployment, so a missing OAuth app never breaks a deploy.
 */
function socialProviders() {
  const google =
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {};
  const facebook =
    process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET
      ? {
          facebook: {
            clientId: process.env.FACEBOOK_CLIENT_ID,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
          },
        }
      : {};
  return { ...google, ...facebook };
}

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  // The Nuxt app origin. Its server proxies `/api/auth/*` to the Convex site
  // URL and forwards the browser's Origin header, so it must be trusted here.
  const siteUrl = requireEnv("SITE_URL");
  return betterAuth({
    baseURL: siteUrl,
    trustedOrigins: [siteUrl],
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      // TODO(email plan): flip to `true` once verification emails are sent via
      // Resend. The spec requires verification before login.
      requireEmailVerification: false,
    },
    socialProviders: socialProviders(),
    plugins: [convex({ authConfig })],
  });
};
