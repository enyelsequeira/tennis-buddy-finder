<script setup lang="ts">
import { Box, UnstyledButton } from "@mantine-vue/core";
import { NuxtLinkLocale } from "#components";

/**
 * Mobile app shell navigation (below `sm`): a fixed 64px bottom bar with the
 * five sections from the visual spec. Pages that use another layout (auth,
 * onboarding) never render it.
 */
const { t } = useI18n();
const route = useRoute();
const localePath = useLocalePath();

const tabs = computed(() => [
  { label: t("nav.find"), to: "/find", icon: "lucide:search" },
  { label: t("nav.calendar"), to: "/calendar", icon: "lucide:calendar-days" },
  { label: t("nav.requests"), to: "/requests", icon: "lucide:inbox" },
  { label: t("nav.messages"), to: "/messages", icon: "lucide:message-circle" },
  { label: t("nav.me"), to: "/settings", icon: "lucide:user-round" },
]);

const isActive = (path: string) => route.path.startsWith(localePath(path));
</script>

<template>
  <Box component="nav" hiddenFrom="sm" :class="$style.bar" :aria-label="t('nav.main')">
    <UnstyledButton
      v-for="tab in tabs"
      :key="tab.to"
      :component="NuxtLinkLocale"
      :to="tab.to"
      :class="$style.tab"
      :c="isActive(tab.to) ? 'court' : 'dimmed'"
      :aria-current="isActive(tab.to) ? 'page' : undefined"
    >
      <Icon :name="tab.icon" size="20" />
      {{ tab.label }}
    </UnstyledButton>
  </Box>
</template>

<style module>
/* Fixed to the viewport bottom, padded for the iOS home indicator. */
.bar {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  z-index: 40;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  height: calc(64px + env(safe-area-inset-bottom, 0px));
  padding-bottom: env(safe-area-inset-bottom, 0px);
  border-top: 1px solid var(--mantine-color-default-border);
  background-color: var(--app-color-elevated);
}

.tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 10.5px;
  font-weight: 500;
  line-height: 1;
}

.tab:focus-visible {
  outline: 2px solid var(--mantine-color-court-filled);
  outline-offset: -2px;
}
</style>
