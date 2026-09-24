<script setup lang="ts">
import { EmptyState, Paper } from "@mantine-vue/core";

/** Placeholder body for app pages that are not built yet. */
const { t } = useI18n();
</script>

<template>
  <Paper withBorder radius="xl" px="lg" :py="64">
    <EmptyState
      :title="t('shell.comingSoonTitle')"
      :description="t('shell.comingSoonDescription')"
      withIndicatorBackground
    >
      <template #icon>
        <Icon name="lucide:construction" size="36" />
      </template>
    </EmptyState>
  </Paper>
</template>
