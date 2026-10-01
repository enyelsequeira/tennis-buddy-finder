/**
 * True once the Convex client holds a token for the current Better Auth
 * session, i.e. authenticated mutations and actions are safe to call.
 * Written only by `plugins/convex-auth.client.ts`. Queries wait for it inside
 * `useAuthedQuery`; the only page that reads it is onboarding, to gate its
 * submit button. Always false during SSR.
 */
export function useConvexAuthReady() {
  return useState("convex-auth-ready", () => false);
}
