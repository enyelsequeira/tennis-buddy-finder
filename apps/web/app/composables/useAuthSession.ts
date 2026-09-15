import { authClient } from "~/utils/auth-client";

/** `{ session, user }` as the Better Auth client infers it from the server config. */
export type AuthSession = typeof authClient.$Infer.Session;

const SESSION_KEY = "auth-session";

/**
 * `useFetch` shaped for `authClient.useSession(...)`.
 *
 * Nuxt keeps one async-data entry per key and only re-runs it while hydrating
 * or when no "success" entry exists. Nothing unmounts a middleware call, so
 * without an explicit refresh a client-side navigation after sign-in/sign-out
 * would reuse a stale session. `dedupe: "defer"` lets that refresh share an
 * in-flight initial request instead of doubling it.
 */
function useSessionFetch(url: string) {
  const result = useFetch<AuthSession | null>(url, { key: SESSION_KEY, dedupe: "defer" });
  if (import.meta.client && !useNuxtApp().isHydrating) {
    return result.refresh().then(() => result);
  }
  return result;
}

/**
 * SSR-aware Better Auth session for pages and route middleware:
 * `{ session, isSignedIn }` computed refs.
 *
 * Fetches `/api/auth/get-session` through Nuxt's `useFetch` so the server
 * render forwards the request cookie, the result hydrates once, and every
 * client-side navigation re-checks it. Client-only widgets that need a live,
 * self-updating session ref should use `authClient.useSession()` directly.
 */
export async function useAuthSession() {
  const { data } = await authClient.useSession(useSessionFetch);

  const session = computed(() => data.value?.session ?? null);
  const isSignedIn = computed(() => session.value !== null);

  return { session, isSignedIn };
}
