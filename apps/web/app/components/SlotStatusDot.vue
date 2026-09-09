<script setup lang="ts">
import type { SlotStatus } from "~/types/slots";

defineProps<{ status: SlotStatus }>();

const { t } = useI18n();
</script>

<template>
  <span
    class="inline-block size-2.5 shrink-0 rounded-full ring-3"
    :class="
      status === 'open'
        ? 'bg-warning ring-(--ui-color-warning-100)'
        : 'bg-success ring-(--ui-color-success-100)'
    "
    role="img"
    :aria-label="t(`slot.status.${status}`)"
  />
</template>
