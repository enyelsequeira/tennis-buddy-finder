<script setup lang="ts">
/** Placeholder body for app pages that are not built yet. */
const { t } = useI18n();
</script>

<template>
  <UEmpty
    icon="i-lucide-construction"
    :title="t('shell.comingSoonTitle')"
    :description="t('shell.comingSoonDescription')"
    :ui="{ root: 'py-16 rounded-2xl bg-elevated ring ring-default' }"
  />
</template>
