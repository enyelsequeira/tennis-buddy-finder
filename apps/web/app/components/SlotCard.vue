<script setup lang="ts">
import { Button, Divider, Group, Paper, Stack, Text } from "@mantine-vue/core";
import type { SlotSummary } from "~/types/slots";

const props = defineProps<{
  slot: SlotSummary;
  /** Set once the current user has asked to play; swaps the button for "Requested". */
  requested?: boolean;
  /** On a player's own profile the page already is the identity. */
  hideIdentity?: boolean;
}>();

const emit = defineEmits<{ ask: [slot: SlotSummary] }>();

const { t } = useI18n();
const { formatRange, formatDuration } = useLisbonTime();

const range = computed(() => formatRange(props.slot));
const duration = computed(() => formatDuration(props.slot));
</script>

<template>
  <Paper
    component="article"
    withBorder
    radius="xl"
    p="md"
    :aria-label="t('slot.withPlayer', { range, name: slot.player.displayName })"
  >
    <Stack gap="sm">
      <Group gap="xs" wrap="nowrap">
        <SlotStatusDot :status="slot.status" />
        <Text component="time" ff="heading" fw="700">{{ range }}</Text>
        <Text size="sm" c="dimmed">{{ duration }}</Text>
      </Group>

      <PlayerIdentity v-if="!hideIdentity" :player="slot.player" :venue="slot.venue" />
      <Text v-else size="sm" c="dimmed">{{ slot.venue ?? t("slot.anyVenue") }}</Text>

      <Divider />

      <Group justify="space-between" gap="sm" wrap="nowrap">
        <Text size="sm" c="dimmed">
          {{ slot.player.age }} · {{ t("player.playingYears", slot.player.yearsPlaying) }}
        </Text>
        <Button v-if="slot.status === 'open' && !requested" @click="emit('ask', slot)">
          {{ t("slot.askToPlay") }}
        </Button>
        <Button v-else-if="requested" variant="default" disabled>
          {{ t("slot.requested") }}
        </Button>
      </Group>
    </Stack>
  </Paper>
</template>
