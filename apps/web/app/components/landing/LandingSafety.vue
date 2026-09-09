<script setup lang="ts">
import type { PageFeatureProps } from "@nuxt/ui";

const { t } = useI18n();

const ICONS = {
  verified: "i-lucide-shield-check",
  noPhone: "i-lucide-phone-off",
  block: "i-lucide-ban",
  adults: "i-lucide-id-card",
} as const;

const features = computed<PageFeatureProps[]>(() =>
  (Object.keys(ICONS) as Array<keyof typeof ICONS>).map((key) => ({
    icon: ICONS[key],
    title: t(`safety.items.${key}.title`),
    description: t(`safety.items.${key}.description`),
  })),
);
</script>

<template>
  <UPageSection
    id="safety"
    :title="t('safety.title')"
    :description="t('safety.description')"
    :features="features"
    class="scroll-mt-16"
    :ui="{
      container: 'py-16 sm:py-20 lg:py-24',
      description: 'max-w-prose mx-auto',
      features: 'sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8',
    }"
  />
</template>
