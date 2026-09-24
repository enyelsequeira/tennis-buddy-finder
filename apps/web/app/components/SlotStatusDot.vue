<script setup lang="ts">
import { Box } from "@mantine-vue/core";
import type { SlotStatus } from "~/types/slots";

defineProps<{ status: SlotStatus }>();

const { t } = useI18n();
</script>

<template>
  <Box
    component="span"
    display="inline-block"
    :w="10"
    :h="10"
    bdrs="50%"
    flex="0 0 auto"
    :class="[$style.dot, status === 'open' ? $style.open : $style.matched]"
    role="img"
    :aria-label="t(`slot.status.${status}`)"
  />
</template>

<style module>
/* Fill + 3px ring; the ring is a box-shadow so the dot keeps its 10px box. */
.dot {
  background-color: var(--dot-fill);
  box-shadow: 0 0 0 rem(3px) var(--dot-ring);
}

.open {
  --dot-fill: var(--mantine-color-ball-5);
  --dot-ring: var(--mantine-color-ball-1);
}

.matched {
  --dot-fill: var(--mantine-color-surround-5);
  --dot-ring: var(--mantine-color-surround-1);
}
</style>
