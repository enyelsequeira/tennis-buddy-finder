<script setup lang="ts">
const { t } = useI18n();
const route = useRoute();
const localePath = useLocalePath();
const { hasUnreadRequests, hasUnreadMessages } = useUnreadNotifications();

const tabs = computed(() => [
  { label: t("nav.find"), to: "/find", icon: "i-lucide-search" },
  { label: t("nav.calendar"), to: "/calendar", icon: "i-lucide-calendar-days" },
  {
    label: t("nav.requests"),
    to: "/requests",
    icon: "i-lucide-inbox",
    unread: hasUnreadRequests.value,
  },
  {
    label: t("nav.messages"),
    to: "/messages",
    icon: "i-lucide-message-circle",
    unread: hasUnreadMessages.value,
  },
  { label: t("nav.me"), to: "/settings", icon: "i-lucide-user-round" },
]);

const isActive = (path: string) => route.path.startsWith(localePath(path));

/** A conversation is full screen on mobile, so the tab bar steps aside entirely. */
const inThread = computed(() => isActive("/messages") && Boolean(route.params.id));
</script>

<template>
  <nav
    v-if="!inThread"
    class="md:hidden fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-5 border-t border-default bg-elevated pb-[env(safe-area-inset-bottom,0px)]"
    :aria-label="t('nav.main')"
  >
    <ULink
      v-for="tab in tabs"
      :key="tab.to"
      :to="localePath(tab.to)"
      raw
      class="flex flex-col items-center justify-center gap-1 text-[10.5px] font-medium focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
      :class="isActive(tab.to) ? 'text-primary' : 'text-dimmed'"
      :aria-current="isActive(tab.to) ? 'page' : undefined"
    >
      <UChip color="warning" :show="!!tab.unread">
        <UIcon :name="tab.icon" class="size-5" />
      </UChip>
      {{ tab.label }}
      <span v-if="tab.unread" class="sr-only">{{ t("notifications.unread") }}</span>
    </ULink>
  </nav>
</template>
