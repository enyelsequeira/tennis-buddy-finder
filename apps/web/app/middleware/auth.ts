/**
 * Protects a page outside `pages/(app)` that only needs a session
 * (onboarding): `definePageMeta({ middleware: "auth" })`. Pages in the group
 * are covered by `app.global.ts`. Unauthenticated visitors go to the localized
 * `/login` with the original path in `?redirect=` so the login page can send
 * them back.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const localePath = useLocalePath();
  const { isSignedIn } = await useAuthSession();

  if (!isSignedIn.value) {
    return navigateTo(
      { path: localePath("/login"), query: { redirect: to.fullPath } },
      { replace: true },
    );
  }
});
