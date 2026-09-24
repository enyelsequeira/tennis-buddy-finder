<script setup lang="ts">
/**
 * Mobile app shell navigation (below `md`): a fixed 64px bottom bar with the
 * five sections from the visual spec. Pages that use another layout (auth,
 * onboarding) never render it.
 */
const { t } = useI18n();
const route = useRoute();
const localePath = useLocalePath();

const tabs = computed(() => [
  { label: t("nav.find"), to: "/find", icon: "i-lucide-search" },
  { label: t("nav.calendar"), to: "/calendar", icon: "i-lucide-calendar-days" },
  { label: t("nav.requests"), to: "/requests", icon: "i-lucide-inbox" },
  { label: t("nav.messages"), to: "/messages", icon: "i-lucide-message-circle" },
  { label: t("nav.me"), to: "/settings", icon: "i-lucide-user-round" },
]);

const isActive = (path: string) => route.path.startsWith(localePath(path));
</script>

<template>
  <nav
    class="md:hidden fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-5 border-t border-default bg-elevated pb-[env(safe-area-inset-bottom,0px)]"
    :aria-label="t('nav.main')"
  >
    <ULink
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      raw
      class="flex flex-col items-center justify-center gap-1 text-[10.5px] font-medium focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
      :class="isActive(tab.to) ? 'text-primary' : 'text-dimmed'"
      :aria-current="isActive(tab.to) ? 'page' : undefined"
    >
      <UIcon :name="tab.icon" class="size-5" />
      {{ tab.label }}
    </ULink>
  </nav>
</template>
