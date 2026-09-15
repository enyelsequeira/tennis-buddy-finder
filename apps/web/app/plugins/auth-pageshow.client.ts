import { authClient } from "~/utils/auth-client";

const SESSION_KEYS = ["auth-session", "current-user"];

function guardsOf(middleware: unknown) {
  return [middleware].flat().filter((entry): entry is string => typeof entry === "string");
}

/**
 * Back/forward-cache guard. When the browser restores a document from its
 * bfcache (`pageshow` with `persisted`), no route middleware runs, so a page
 * rendered while signed in would reappear after a sign-out elsewhere, and a
 * login page after a sign-in. Re-check the session against the page's guards.
 */
export default defineNuxtPlugin((nuxtApp) => {
  useEventListener(window, "pageshow", async (event) => {
    if (!event.persisted) return;
    await nuxtApp.runWithContext(async () => {
      const route = useRoute();
      const guards = guardsOf(route.meta.middleware);
      const needsAuth = guards.includes("auth");
      const guestOnly = guards.includes("guest");
      if (!needsAuth && !guestOnly) return;

      const { data } = await authClient.getSession({ fetchOptions: { throw: false } });
      const signedIn = data?.session != null;
      clearNuxtData(SESSION_KEYS);
      const localePath = useLocalePath();

      if (needsAuth && !signedIn) {
        return navigateTo(
          { path: localePath("/login"), query: { redirect: route.fullPath } },
          { replace: true },
        );
      }
      if (guestOnly && signedIn) {
        return navigateTo(localePath("/find"), { replace: true });
      }
    });
  });
});
