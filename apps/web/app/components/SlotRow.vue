<script setup lang="ts">
import type { SlotStatus } from "~/types/slots";

const props = defineProps<{
  startAt: number;
  endAt: number;
  status: SlotStatus;
  venue?: string;
}>();

const { t } = useI18n();
const { formatRange } = useLisbonTime();

const range = computed(() => formatRange(props));
</script>

<template>
  <div class="flex items-center gap-2.5 min-h-11">
    <SlotStatusDot :status="status" />
    <time class="font-display font-bold text-base text-highlighted">{{ range }}</time>
    <span class="text-sm text-muted truncate">{{ venue ?? t("slot.anyVenue") }}</span>
    <div v-if="$slots.trailing" class="ms-auto shrink-0">
      <slot name="trailing" />
    </div>
  </div>
</template>
