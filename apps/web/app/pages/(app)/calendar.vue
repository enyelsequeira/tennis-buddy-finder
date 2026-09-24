<script setup lang="ts">
definePageMeta({ middleware: ["auth", "onboarded"] });

const { t } = useI18n();

useSeoMeta({ title: () => t("pages.calendar.title") });
</script>

<template>
  <div class="space-y-4">
    <h1
      class="font-display font-bold tracking-[-0.015em] text-[22px] md:text-[26px] text-highlighted"
    >
      {{ t("pages.calendar.title") }}
    </h1>
    <ComingSoon />
  </div>
</template>
