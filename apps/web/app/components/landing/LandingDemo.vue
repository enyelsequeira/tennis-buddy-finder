<script setup lang="ts">
import { EmptyState, Group, Paper, Stack, Text, Title } from "@mantine-vue/core";
import { notifications } from "@mantine-vue/notifications";
import { Icon } from "#components";
import type { SlotSummary } from "~/types/slots";

/**
 * Interactive preview of the Find page with sample players.
 * Picking a day and asking to play both work, so a visitor learns the
 * slot chip before creating an account.
 */

const { t } = useI18n();
const time = useLisbonTime();
const { now, startOfDay, addDays, formatLongDay } = time;

// Seeded once on the server and carried in the payload so SSR and client agree.
const firstDayMs = useState("landing-demo-first-day", () => startOfDay(now()));

const slots = computed(() => buildDemoSlots({ firstDayMs: firstDayMs.value, time }));

const slotsByDay = computed(() => {
  const map = new Map<number, SlotSummary[]>();
  for (const slot of slots.value) {
    const day = startOfDay(slot.startAt);
    map.set(day, [...(map.get(day) ?? []), slot]);
  }
  return map;
});

const days = computed(() =>
  Array.from({ length: DEMO_DAY_COUNT }, (_, offset) => {
    const startAt = addDays(firstDayMs.value, offset);
    return { startAt, hasOpen: slotsByDay.value.has(startAt) };
  }),
);

const selectedDay = ref(addDays(firstDayMs.value, 1));

const visibleSlots = computed(() => slotsByDay.value.get(selectedDay.value) ?? []);

const requested = ref(new Set<string>());

function askToPlay(slot: SlotSummary) {
  requested.value = new Set(requested.value).add(slot.id);
  notifications.show({
    title: t("demo.toastTitle"),
    message: t("demo.toastDescription", { name: slot.player.displayName.split(" ")[0] }),
    icon: h(Icon, { name: "lucide:send", size: 18 }),
  });
}
</script>

<template>
  <Stack gap="sm">
    <Paper withBorder radius="xl" :p="{ base: 'md', xs: 'lg' }" bg="var(--mantine-color-body)">
      <Stack gap="md">
        <DayRail v-model="selectedDay" :days="days" />

        <Group justify="space-between" align="baseline" gap="sm">
          <Title :order="2" :fz="15">{{ formatLongDay(selectedDay) }}</Title>
          <Text size="sm" c="dimmed" aria-live="polite">
            {{ t("slot.openCount", visibleSlots.length) }}
          </Text>
        </Group>

        <Stack
          v-if="visibleSlots.length"
          component="ul"
          gap="sm"
          p="0"
          m="0"
          style="list-style: none"
          :aria-label="t('demo.openSlots')"
        >
          <li v-for="slot in visibleSlots" :key="slot.id">
            <SlotCard :slot="slot" :requested="requested.has(slot.id)" @ask="askToPlay" />
          </li>
        </Stack>

        <Paper v-else withBorder radius="xl" :py="40" px="md">
          <EmptyState :title="t('demo.emptyTitle')" :description="t('demo.emptyDescription')">
            <template #icon>
              <Icon name="lucide:calendar-days" size="32" aria-hidden="true" />
            </template>
          </EmptyState>
        </Paper>
      </Stack>
    </Paper>

    <Text size="xs" c="dimmed" ta="center">{{ t("demo.caption") }}</Text>
  </Stack>
</template>
