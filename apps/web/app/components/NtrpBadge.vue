<script setup lang="ts">
const props = defineProps<{ rating: number }>();

const { t } = useI18n();

const label = computed(() => props.rating.toFixed(1));
</script>

<template>
  <UBadge
    color="primary"
    variant="soft"
    size="sm"
    :aria-label="t('player.ntrp', { rating: label })"
  >
    {{ label }}
  </UBadge>
</template>
