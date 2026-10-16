<script setup lang="ts">
import type { SlotStatus } from "~/types/slots";

defineProps<{ status: SlotStatus }>();

const { t } = useI18n();

const COLORS: Record<SlotStatus, string> = {
  open: "bg-warning ring-(--ui-color-warning-100)",
  matched: "bg-success ring-(--ui-color-success-100)",
  closed: "bg-(--ui-text-dimmed) ring-(--ui-bg-accented)",
};
</script>

<template>
  <span
    class="inline-block size-2.5 shrink-0 rounded-full ring-3"
    :class="COLORS[status]"
    role="img"
    :aria-label="t(`slot.status.${status}`)"
  />
</template>
