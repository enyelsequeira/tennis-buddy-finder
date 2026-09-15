import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/vue";

/**
 * Better Auth client for the browser and SSR.
 *
 * The Better Auth server runs inside Convex (`packages/backend/convex/auth.ts`)
 * and is reached through the same-origin Nitro proxy at `/api/auth/*`
 * (`server/api/auth/[...all].ts`), so no `baseURL` is needed here and the
 * session cookie stays first-party.
 *
 * The `convexClient` plugin adds `authClient.convex.token()`, which the
 * `plugins/convex-auth.client.ts` plugin uses to feed a JWT to the Convex client.
 */
export const authClient = createAuthClient({
  plugins: [convexClient()],
});
