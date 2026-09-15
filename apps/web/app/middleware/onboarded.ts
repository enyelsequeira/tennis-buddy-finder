/**
 * App pages: `definePageMeta({ middleware: ["auth", "onboarded"] })`.
 * A signed-in user without a profile is sent to onboarding. Runs after `auth`,
 * so a `null` user here only means the session is not usable yet; `auth` has
 * already redirected anonymous visitors.
 */
export default defineNuxtRouteMiddleware(async () => {
  const localePath = useLocalePath();
  const { me } = await useCurrentUser();

  if (me.value && me.value.profile === null) {
    return navigateTo(localePath("/onboarding"), { replace: true });
  }
});
