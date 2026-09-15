import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config";
import type { AuthConfig } from "convex/server";

/**
 * Registers the Better Auth component as the JWT issuer for this deployment.
 * Without this file `ctx.auth.getUserIdentity()` is always `null`.
 */
export default {
  providers: [getAuthConfigProvider()],
} satisfies AuthConfig;
