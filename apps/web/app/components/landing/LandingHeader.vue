<script setup lang="ts">
import type { NavigationMenuItem } from "@nuxt/ui";

const { t } = useI18n();
const localePath = useLocalePath();

// Anchor items are never "active": they match "/" and would all light up at once.
const items = computed<NavigationMenuItem[]>(() => [
  { label: t("nav.howItWorks"), to: localePath("/#how-it-works"), active: false },
  { label: t("nav.yourLevel"), to: localePath("/#your-level"), active: false },
  { label: t("nav.safety"), to: localePath("/#safety"), active: false },
  { label: t("nav.demo"), to: localePath("/demo"), icon: "i-lucide-flask-conical" },
]);
</script>

<template>
  <UHeader :to="localePath('/')" :title="t('app.name')" :ui="{ root: 'bg-elevated/90' }">
    <template #title>
      <AppWordmark />
    </template>

    <UNavigationMenu :items="items" />

    <template #right>
      <LocaleSwitcher class="hidden md:flex" />
      <UButton
        :label="t('nav.signIn')"
        :to="localePath('/login')"
        color="neutral"
        variant="ghost"
      />
      <UButton
        :label="t('nav.createAccount')"
        :to="localePath('/register')"
        color="primary"
        variant="soft"
      />
    </template>

    <template #body>
      <UNavigationMenu :items="items" orientation="vertical" class="-mx-2.5" />
      <USeparator class="my-4" />
      <div class="flex flex-col gap-2">
        <UButton
          :label="t('nav.createAccount')"
          :to="localePath('/register')"
          color="primary"
          block
        />
        <UButton
          :label="t('nav.signIn')"
          :to="localePath('/login')"
          color="neutral"
          variant="outline"
          block
        />
      </div>
      <USeparator class="my-4" />
      <LocaleSwitcher />
    </template>
  </UHeader>
</template>
