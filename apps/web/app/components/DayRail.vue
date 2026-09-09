<script setup lang="ts">
import type { RailDay } from "~/types/slots";

defineProps<{ days: RailDay[] }>();

/** Start of the selected day, milliseconds since epoch. */
const selected = defineModel<number>({ required: true });

const { t } = useI18n();
const { formatWeekday, formatDayNumber, formatLongDay } = useLisbonTime();
</script>

<template>
  <div
    class="flex gap-2 overflow-x-auto snap-x -mx-4 px-4 pb-1 md:mx-0 md:px-0 md:grid md:grid-cols-7 md:overflow-visible"
    role="group"
    :aria-label="t('demo.pickDay')"
  >
    <button
      v-for="day in days"
      :key="day.startAt"
      type="button"
      class="snap-start shrink-0 w-[4.5rem] md:w-auto rounded-xl py-2.5 flex flex-col items-center gap-0.5 ring transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      :class="
        day.startAt === selected
          ? 'bg-primary text-inverted ring-primary'
          : 'bg-elevated text-default ring-default hover:bg-accented'
      "
      :aria-pressed="day.startAt === selected"
      :aria-label="formatLongDay(day.startAt)"
      @click="selected = day.startAt"
    >
      <span class="text-xs" :class="day.startAt === selected ? 'text-inverted/80' : 'text-muted'">
        {{ formatWeekday(day.startAt) }}
      </span>
      <span class="font-display font-bold text-lg leading-tight">
        {{ formatDayNumber(day.startAt) }}
      </span>
      <span
        class="size-1.5 rounded-full"
        :class="day.hasOpen ? 'bg-warning' : 'bg-transparent'"
        aria-hidden="true"
      />
    </button>
  </div>
</template>
