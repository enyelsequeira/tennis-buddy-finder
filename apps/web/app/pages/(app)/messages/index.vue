<script setup lang="ts">
const { t } = useI18n();
</script>

<template>
  <UEmpty
    icon="i-lucide-messages-square"
    :title="t('chat.pickTitle')"
    :description="t('chat.pickDescription')"
    :ui="{ root: 'flex-1 py-16' }"
  />
</template>
