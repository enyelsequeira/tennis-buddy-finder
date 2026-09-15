<script setup lang="ts">
withDefaults(defineProps<{ size?: "md" | "lg" }>(), { size: "md" });

const { t } = useI18n();
</script>

<template>
  <span class="inline-flex items-center gap-2">
    <span
      class="rounded-full bg-warning shrink-0"
      :class="size === 'lg' ? 'size-5' : 'size-4.5'"
      aria-hidden="true"
    />
    <span
      class="font-display font-bold tracking-[-0.015em] text-highlighted"
      :class="size === 'lg' ? 'text-2xl' : 'text-xl'"
    >
      {{ t("app.name") }}
    </span>
  </span>
</template>
