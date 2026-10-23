<script setup lang="ts">
import type { ButtonProps } from "@nuxt/ui";

const { t } = useI18n();
const localePath = useLocalePath();

const links = computed<ButtonProps[]>(() => [
  { label: t("nav.createAccount"), to: localePath("/register"), color: "primary", size: "xl" },
  {
    label: t("nav.signIn"),
    to: localePath("/login"),
    color: "neutral",
    variant: "ghost",
    size: "xl",
  },
]);
</script>

<template>
  <UContainer class="pb-16 sm:pb-20 lg:pb-24">
    <UPageCTA
      :title="t('cta.title')"
      :description="t('cta.description')"
      :links="links"
      variant="outline"
      :ui="{ root: 'bg-elevated', description: 'max-w-prose mx-auto' }"
    />
  </UContainer>
</template>
