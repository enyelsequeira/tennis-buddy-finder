import { authClient } from "~/utils/auth-client";

/**
 * Signs the user out of Better Auth and sends them to the localized login page.
 * The Convex token is dropped by `plugins/convex-auth.client.ts` when the
 * session disappears; the cached session and current-user data are cleared so
 * no guard can act on a stale value.
 */
export function useSignOut() {
  const localePath = useLocalePath();
  const isPending = ref(false);

  async function signOut() {
    isPending.value = true;
    try {
      await authClient.signOut();
      clearNuxtData(["auth-session", "current-user"]);
      await navigateTo(localePath("/login"), { replace: true });
    } finally {
      isPending.value = false;
    }
  }

  return { signOut, isPending };
}
