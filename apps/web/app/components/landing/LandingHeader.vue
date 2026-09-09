<script setup lang="ts">
import type { NavigationMenuItem } from "@nuxt/ui";

const { t } = useI18n();

// Anchor items are never "active": they match "/" and would all light up at once.
const items = computed<NavigationMenuItem[]>(() => [
  { label: t("nav.howItWorks"), to: "/#how-it-works", active: false },
  { label: t("nav.yourLevel"), to: "/#your-level", active: false },
  { label: t("nav.safety"), to: "/#safety", active: false },
  { label: t("nav.demo"), to: "/demo", icon: "i-lucide-flask-conical" },
]);
</script>

<template>
  <UHeader to="/" :title="t('app.name')" :ui="{ root: 'bg-elevated/90' }">
    <template #title>
      <AppWordmark />
    </template>

    <UNavigationMenu :items="items" />

    <template #right>
      <LocaleSwitcher class="hidden md:flex" />
      <UButton :label="t('nav.signIn')" to="/login" color="neutral" variant="ghost" />
      <UButton :label="t('nav.createAccount')" to="/register" color="primary" variant="soft" />
    </template>

    <template #body>
      <UNavigationMenu :items="items" orientation="vertical" class="-mx-2.5" />
      <USeparator class="my-4" />
      <div class="flex flex-col gap-2">
        <UButton :label="t('nav.createAccount')" to="/register" color="primary" block />
        <UButton :label="t('nav.signIn')" to="/login" color="neutral" variant="outline" block />
      </div>
      <USeparator class="my-4" />
      <LocaleSwitcher />
    </template>
  </UHeader>
</template>
