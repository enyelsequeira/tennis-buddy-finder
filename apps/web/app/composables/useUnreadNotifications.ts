import { api } from "@tennis-buddy-finder/backend/convex/_generated/api";

export function useUnreadNotifications() {
  const { data: unread, error } = useAuthedQuery(api.notifications.unread);

  // One new_message notification per conversation, so this counts unread conversations.
  const unreadMessageCount = computed(
    () => unread.value?.filter(({ type }) => type === "new_message").length ?? 0,
  );
  const unreadRequestCount = computed(
    () => unread.value?.filter(({ type }) => type !== "new_message").length ?? 0,
  );

  return { unread, error, unreadRequestCount, unreadMessageCount };
}
