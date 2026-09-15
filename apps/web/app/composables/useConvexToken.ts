import { getToken } from "@convex-dev/better-auth/utils";

import { authClient } from "~/utils/auth-client";

/**
 * Convex JWT for the current Better Auth session, usable in both render
 * targets. On the server it exchanges the request cookie directly against
 * the Convex site URL; in the browser it goes through `authClient`.
 * Returns null when signed out.
 */
export async function fetchConvexToken() {
  if (import.meta.server) {
    const { convexSiteUrl } = useRuntimeConfig();
    const cookie = useRequestHeaders(["cookie"]).cookie;
    if (!convexSiteUrl || !cookie) return null;
    const { token } = await getToken(convexSiteUrl, new Headers({ cookie }));
    return token ?? null;
  }
  const { data } = await authClient.convex.token({ fetchOptions: { throw: false } });
  return data?.token ?? null;
}
