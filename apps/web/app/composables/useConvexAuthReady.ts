/**
 * True once the Convex client holds a token for the current Better Auth
 * session, i.e. authenticated mutations and actions are safe to call.
 * Written only by `plugins/convex-auth.client.ts`; read by pages that gate a
 * submit button on it (onboarding). Always false during SSR.
 */
export function useConvexAuthReady() {
  return useState("convex-auth-ready", () => false);
}
