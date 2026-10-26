import { authClient } from "~/utils/auth-client";

type FetchTokenOptions = { forceRefreshToken: boolean };

/**
 * Wires Better Auth into the Convex client (client-only).
 *
 * Whenever the Better Auth session id changes, the Convex client is given a
 * token fetcher that exchanges the session cookie for a Convex JWT via
 * `fetchConvexToken()`; when the session disappears the Convex auth is
 * cleared. This is the only place `setAuth` / `clearAuth` are called - pages,
 * composables and components never touch Convex auth directly.
 *
 * `useConvexAuthReady()` mirrors the client's authenticated state: it turns
 * true once Convex has accepted a token (mutations are safe to call) and
 * false the moment the session goes away.
 *
 * A session that goes away while an app page is open (e.g. signed out in
 * another tab) sends the user to the login page, since no route guard re-runs.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const convex = useConvexClient();
  const session = authClient.useSession();
  const ready = useConvexAuthReady();

  let cachedToken: string | null = null;
  let pendingToken: Promise<string | null> | null = null;

  async function requestToken() {
    try {
      cachedToken = await fetchConvexToken();
    } catch {
      cachedToken = null;
    }
    return cachedToken;
  }

  function fetchAccessToken({ forceRefreshToken }: FetchTokenOptions): Promise<string | null> {
    // A forced refresh while a request is in flight reuses it: that token is just as fresh.
    if (pendingToken) return pendingToken;
    if (!forceRefreshToken && cachedToken) return Promise.resolve(cachedToken);
    pendingToken = requestToken().finally(() => {
      pendingToken = null;
    });
    return pendingToken;
  }

  watch(
    () => session.value.data?.session.id,
    (sessionId, previousSessionId) => {
      cachedToken = null;
      if (sessionId) {
        convex.setAuth(fetchAccessToken, (isAuthenticated) => {
          ready.value = isAuthenticated;
        });
      } else {
        ready.value = false;
        // `clearAuth` lives on the underlying BaseConvexClient, not the wrapper.
        convex.client.clearAuth();
        // Only on signed-in -> signed-out; the first run (session still loading) has no previous id.
        if (previousSessionId) {
          void nuxtApp.runWithContext(() => {
            // `useRoute()` warns when this runs inside a navigation (same-tab sign-out).
            if (!useRouter().currentRoute.value.meta.groups?.includes("app")) return;
            return navigateTo(useLocalePath()("/login"), { replace: true });
          });
        }
      }
    },
    { immediate: true },
  );
});
