import { api } from "@tennis-buddy-finder/backend/convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import type { FunctionReturnType } from "convex/server";

/** `{ user, profile }` for the signed-in user, as `api.users.me` returns it. */
export type CurrentUser = FunctionReturnType<typeof api.users.me>;

const KEY = "current-user";

async function loadCurrentUser(convexUrl: string) {
  const token = await fetchConvexToken();
  if (!token) return null;
  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(token);
  try {
    return await client.query(api.users.me, {});
  } catch {
    // UNAUTHENTICATED (no users row yet, banned) reads as signed out.
    return null;
  }
}

/**
 * The signed-in user's `users` row and profile, or null when signed out.
 *
 * Reads `api.users.me` over an authenticated `ConvexHttpClient`, so it works
 * during SSR (cookie exchanged for a token on the server) and on the client
 * without waiting for the WebSocket client to receive its token. Fetched once
 * per request on the server, re-fetched on every client-side navigation so
 * route guards never act on a stale profile. Live data on pages should use
 * `useConvexQuery(api.users.me, {}, { server: false })` instead.
 */
export async function useCurrentUser() {
  const convexUrl = useRuntimeConfig().public.convex.url;
  const result = await useAsyncData(KEY, () => loadCurrentUser(convexUrl), {
    dedupe: "defer",
    default: () => null,
  });
  if (import.meta.client && !useNuxtApp().isHydrating) {
    await result.refresh();
  }
  return { me: result.data, refresh: () => result.refresh() };
}
