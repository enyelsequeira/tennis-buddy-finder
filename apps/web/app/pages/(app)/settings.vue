<script setup lang="ts">
definePageMeta({ middleware: ["auth", "onboarded"] });

const { t } = useI18n();
// The sections use reactive queries and mutations, which need the WebSocket
// client to hold a token; until then a skeleton stands in for them.
const ready = useConvexAuthReady();

useSeoMeta({ title: () => t("pages.settings.title") });
</script>

<template>
  <div class="max-w-[640px] space-y-4">
    <h1
      class="font-display font-bold tracking-[-0.015em] text-[22px] md:text-[26px] text-highlighted"
    >
      {{ t("pages.settings.title") }}
    </h1>

    <SettingsSections v-if="ready" />

    <div v-else class="space-y-4" aria-busy="true">
      <USkeleton class="h-56 w-full rounded-2xl" />
      <USkeleton class="h-28 w-full rounded-2xl" />
      <USkeleton class="h-24 w-full rounded-2xl" />
      <USkeleton class="h-24 w-full rounded-2xl" />
      <USkeleton class="h-24 w-full rounded-2xl" />
    </div>
  </div>
</template>
