<script setup lang="ts">
import { Box, Stack, Text, UnstyledButton } from "@mantine-vue/core";
import type { RailDay } from "~/types/slots";

defineProps<{ days: RailDay[] }>();

/** Start of the selected day, milliseconds since epoch. */
const selected = defineModel<number>({ required: true });

const { t } = useI18n();
const { formatWeekday, formatDayNumber, formatLongDay } = useLisbonTime();
</script>

<template>
  <Box :class="$style.rail" role="group" :aria-label="t('demo.pickDay')">
    <UnstyledButton
      v-for="day in days"
      :key="day.startAt"
      type="button"
      py="xs"
      bdrs="lg"
      :class="$style.day"
      :mod="{ selected: day.startAt === selected }"
      :aria-pressed="day.startAt === selected"
      :aria-label="formatLongDay(day.startAt)"
      @click="selected = day.startAt"
    >
      <Stack :gap="2" align="center">
        <Text
          size="xs"
          :c="day.startAt === selected ? undefined : 'dimmed'"
          :opacity="day.startAt === selected ? 0.8 : undefined"
        >
          {{ formatWeekday(day.startAt) }}
        </Text>
        <Text ff="heading" fw="700" size="lg" :lh="1.25">
          {{ formatDayNumber(day.startAt) }}
        </Text>
        <Box
          :w="6"
          :h="6"
          bdrs="50%"
          :bg="day.hasOpen ? 'ball.5' : 'transparent'"
          aria-hidden="true"
        />
      </Stack>
    </UnstyledButton>
  </Box>
</template>

<style module>
/* Mobile: one scroll-snapping row bleeding to the screen edges; from `sm` a 7-column grid. */
.rail {
  display: flex;
  gap: rem(8px);
  overflow-x: auto;
  scroll-snap-type: x proximity;
  margin-inline: calc(-1 * var(--mantine-spacing-md));
  padding-inline: var(--mantine-spacing-md);
  padding-bottom: rem(4px);

  @media (min-width: $mantine-breakpoint-sm) {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    overflow: visible;
    margin-inline: 0;
    padding-inline: 0;
  }
}

/* Scoped under .rail so it outranks UnstyledButton's own background/colour reset. */
.rail .day {
  flex-shrink: 0;
  width: rem(72px);
  scroll-snap-align: start;
  background-color: var(--app-color-elevated);
  border: rem(1px) solid var(--mantine-color-default-border);
  transition: background-color 150ms ease;

  @media (min-width: $mantine-breakpoint-sm) {
    width: auto;
  }

  @media (hover: hover) {
    &:not([data-selected]):hover {
      background-color: var(--mantine-color-default-hover);
    }
  }

  &[data-selected] {
    background-color: var(--mantine-color-court-filled);
    border-color: var(--mantine-color-court-filled);
    color: var(--mantine-color-white);
  }

  &:focus-visible {
    outline: rem(2px) solid var(--mantine-primary-color-filled);
    outline-offset: rem(2px);
  }
}
</style>
