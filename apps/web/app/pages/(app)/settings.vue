<script setup lang="ts">
const { t } = useI18n();

useSeoMeta({ title: () => t("pages.settings.title") });
</script>

<template>
  <div class="space-y-4">
    <h1
      class="font-display font-bold tracking-[-0.015em] text-[22px] md:text-[26px] text-highlighted"
    >
      {{ t("pages.settings.title") }}
    </h1>

    <SettingsSections />
  </div>
</template>
