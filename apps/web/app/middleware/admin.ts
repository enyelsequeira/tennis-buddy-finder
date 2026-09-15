/**
 * Admin pages: `definePageMeta({ middleware: ["auth", "onboarded", "admin"] })`.
 * Anyone who is not an admin lands on the app home instead.
 */
export default defineNuxtRouteMiddleware(async () => {
  const localePath = useLocalePath();
  const { me } = await useCurrentUser();

  if (me.value?.user.role !== "admin") {
    return navigateTo(localePath("/find"));
  }
});
