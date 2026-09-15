/**
 * Guest-only pages (landing, login, register): `definePageMeta({ middleware: "guest" })`.
 * Signed-in visitors are sent straight into the app.
 */
export default defineNuxtRouteMiddleware(async () => {
  const localePath = useLocalePath();
  const { isSignedIn } = await useAuthSession();

  if (isSignedIn.value) {
    return navigateTo(localePath("/find"));
  }
});
