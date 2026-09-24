<script setup lang="ts">
import { Box, Group, Text } from "@mantine-vue/core";
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
  <Group gap="xs" wrap="nowrap" :mih="44">
    <SlotStatusDot :status="status" />
    <Text component="time" ff="heading" fw="700">{{ range }}</Text>
    <Text size="sm" c="dimmed" truncate :miw="0">{{ venue ?? t("slot.anyVenue") }}</Text>
    <Box v-if="$slots.trailing" ms="auto" flex="0 0 auto">
      <slot name="trailing" />
    </Box>
  </Group>
</template>
