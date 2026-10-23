<script setup lang="ts">
import type { NavigationMenuItem } from "@nuxt/ui";

const { t } = useI18n();
const localePath = useLocalePath();
const { now, formatYear } = useLisbonTime();

const items = computed<NavigationMenuItem[]>(() => [
  { label: t("nav.howItWorks"), to: localePath("/#how-it-works"), active: false },
  { label: t("nav.yourLevel"), to: localePath("/#your-level"), active: false },
  { label: t("nav.safety"), to: localePath("/#safety"), active: false },
  { label: t("nav.signIn"), to: localePath("/login") },
]);

const year = formatYear(now());
</script>

<template>
  <UFooter :ui="{ root: 'border-t border-default bg-elevated' }">
    <template #left>
      <div class="flex flex-col items-center lg:items-start gap-1">
        <AppWordmark />
        <p class="text-sm text-muted">{{ t("app.location") }}</p>
      </div>
    </template>

    <UNavigationMenu :items="items" variant="link" />

    <template #right>
      <p class="text-sm text-muted">{{ t("footer.copyright", { year }) }}</p>
    </template>
  </UFooter>
</template>
