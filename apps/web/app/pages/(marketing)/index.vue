<script setup lang="ts">
definePageMeta({
  layout: "landing",
  middleware: "guest",
});

const { t } = useI18n();

useSeoMeta({
  title: () => t("seo.title"),
  description: () => t("seo.description"),
  ogTitle: () => t("seo.title"),
  ogDescription: () => t("seo.description"),
  ogType: "website",
  twitterCard: "summary",
});
</script>

<template>
  <div>
    <LandingHero />
    <LandingSteps />
    <LandingLevels />
    <LandingSafety />
    <LandingCta />
  </div>
</template>
