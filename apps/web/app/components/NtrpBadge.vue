<script setup lang="ts">
import { Badge } from "@mantine-vue/core";

const props = defineProps<{ rating: number }>();

const { t } = useI18n();

const label = computed(() => props.rating.toFixed(1));
</script>

<template>
  <Badge variant="light" size="sm" :aria-label="t('player.ntrp', { rating: label })">
    {{ label }}
  </Badge>
</template>
