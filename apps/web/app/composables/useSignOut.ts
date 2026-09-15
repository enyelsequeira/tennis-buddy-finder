import { authClient } from "~/utils/auth-client";

/**
 * Signs the user out of Better Auth and sends them to the localized login page.
 * The Convex token is dropped by `plugins/convex-auth.client.ts` when the
 * session disappears; nothing else needs to run.
 */
export function useSignOut() {
  const localePath = useLocalePath();
  const isPending = ref(false);

  async function signOut() {
    isPending.value = true;
    try {
      await authClient.signOut();
      await navigateTo(localePath("/login"));
    } finally {
      isPending.value = false;
    }
  }

  return { signOut, isPending };
}
