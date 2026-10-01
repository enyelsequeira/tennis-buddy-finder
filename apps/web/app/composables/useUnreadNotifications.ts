import { api } from "@tennis-buddy-finder/backend/convex/_generated/api";

export function useUnreadNotifications() {
  const { data: unread, error } = useAuthedQuery(api.notifications.unread);

  const hasUnreadMessages = computed(
    () => unread.value?.some(({ type }) => type === "new_message") ?? false,
  );
  const hasUnreadRequests = computed(
    () => unread.value?.some(({ type }) => type !== "new_message") ?? false,
  );

  return { unread, error, hasUnreadRequests, hasUnreadMessages };
}
