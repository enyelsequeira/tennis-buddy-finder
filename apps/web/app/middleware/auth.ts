/**
 * Protects a page: `definePageMeta({ middleware: "auth" })`.
 * Unauthenticated visitors go to the localized `/login` with the original
 * path in `?redirect=` so the login page can send them back.
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
