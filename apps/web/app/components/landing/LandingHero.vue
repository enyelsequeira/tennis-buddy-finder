<script setup lang="ts">
import type { ButtonProps } from "@nuxt/ui";

const { t } = useI18n();

const links = computed<ButtonProps[]>(() => [
  { label: t("hero.primary"), to: "/register", color: "primary", size: "xl" },
  {
    label: t("hero.secondary"),
    to: "#how-it-works",
    color: "neutral",
    variant: "ghost",
    size: "xl",
  },
]);
</script>

<template>
  <UPageHero
    :title="t('hero.title')"
    :description="t('hero.description')"
    orientation="horizontal"
    :links="links"
    :ui="{
      container: 'py-16 sm:py-20 lg:py-24 lg:gap-12',
      title: 'text-4xl sm:text-5xl lg:text-[3.5rem] lg:leading-[1.05] max-w-[18ch]',
      description: 'max-w-prose',
    }"
  >
    <LandingDemo />
  </UPageHero>
</template>
