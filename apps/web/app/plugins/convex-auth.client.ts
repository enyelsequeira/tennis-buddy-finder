import { authClient } from "~/utils/auth-client";

type FetchTokenOptions = { forceRefreshToken: boolean };

/**
 * Wires Better Auth into the Convex client (client-only).
 *
 * Whenever the Better Auth session id changes, the Convex client is given a
 * token fetcher that exchanges the session cookie for a Convex JWT via
 * `authClient.convex.token()`; when the session disappears the Convex auth is
 * cleared. This is the only place `setAuth` / `clearAuth` are called - pages,
 * composables and components never touch Convex auth directly.
 *
 * `useConvexAuthReady()` mirrors the client's authenticated state: it turns
 * true once Convex has accepted a token (mutations are safe to call) and
 * false the moment the session goes away.
 */
export default defineNuxtPlugin(() => {
  const convex = useConvexClient();
  const session = authClient.useSession();
  const ready = useConvexAuthReady();

  let cachedToken: string | null = null;
  let pendingToken: Promise<string | null> | null = null;

  async function requestToken() {
    try {
      const { data } = await authClient.convex.token({ fetchOptions: { throw: false } });
      cachedToken = data?.token ?? null;
    } catch {
      cachedToken = null;
    }
    return cachedToken;
  }

  function fetchAccessToken({ forceRefreshToken }: FetchTokenOptions): Promise<string | null> {
    if (!forceRefreshToken) {
      if (cachedToken) return Promise.resolve(cachedToken);
      if (pendingToken) return pendingToken;
    }
    pendingToken = requestToken().finally(() => {
      pendingToken = null;
    });
    return pendingToken;
  }

  watch(
    () => session.value.data?.session.id,
    (sessionId) => {
      cachedToken = null;
      if (sessionId) {
        convex.setAuth(fetchAccessToken, (isAuthenticated) => {
          ready.value = isAuthenticated;
        });
      } else {
        ready.value = false;
        // `clearAuth` lives on the underlying BaseConvexClient, not the wrapper.
        convex.client.clearAuth();
      }
    },
    { immediate: true },
  );
});
