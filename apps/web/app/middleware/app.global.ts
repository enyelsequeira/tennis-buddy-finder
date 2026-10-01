// Guards every page under `pages/(app)`. A null user is ambiguous (signed out,
// or a session whose `users` row is not usable yet), so only then is the session
// checked: reading the second case as signed out would loop with `guest`.
export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.meta.groups?.includes("app")) return;

  const localePath = useLocalePath();
  const { me } = await useCurrentUser();

  if (me.value) {
    if (me.value.profile === null) {
      return navigateTo(localePath("/onboarding"), { replace: true });
    }
    return;
  }

  const { isSignedIn } = await useAuthSession();
  if (!isSignedIn.value) {
    return navigateTo(
      { path: localePath("/login"), query: { redirect: to.fullPath } },
      { replace: true },
    );
  }
});
