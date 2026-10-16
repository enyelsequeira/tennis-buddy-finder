/**
 * Admin pages under `pages/(app)`: `definePageMeta({ middleware: "admin" })`.
 * Runs after the group guard in `app.global.ts`; anyone who is not an admin
 * lands on the app home instead.
 */
export default defineNuxtRouteMiddleware(async () => {
  const localePath = useLocalePath();
  const { me } = await useCurrentUser();

  if (me.value?.user.role !== "admin") {
    return navigateTo(localePath("/find"), { replace: true });
  }
});
