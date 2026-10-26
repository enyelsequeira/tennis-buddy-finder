<script setup lang="ts">
import type { Doc } from "@tennis-buddy-finder/backend/convex/_generated/dataModel";

const props = defineProps<{
  slots: Doc<"availabilitySlots">[];
  day: number;
  month: number;
}>();

const emit = defineEmits<{
  select: [dayMs: number];
  month: [startMs: number];
}>();

const { t } = useI18n();
const { now, startOfDay, startOfMonth, toCalendarDate, startOfCalendarDay } = useLisbonTime();

const daysWith = (status: "open" | "matched") =>
  new Set(
    props.slots.filter((slot) => slot.status === status).map((slot) => startOfDay(slot.startAt)),
  );
const openDays = computed(() => daysWith("open"));
const matchedDays = computed(() => daysWith("matched"));
</script>

<template>
  <!-- `range` and `multiple` are spelled out so the selected value is typed as a single date. -->
  <UCalendar
    size="lg"
    :range="false"
    :multiple="false"
    prevent-deselect
    :week-starts-on="1"
    :calendar-label="t('pages.calendar.title')"
    :year-controls="false"
    :view-control="false"
    :model-value="toCalendarDate(day)"
    :default-placeholder="toCalendarDate(month)"
    :min-value="toCalendarDate(now())"
    :ui="{
      headingLabel: 'font-display font-bold',
      cellTrigger: 'size-11 font-display font-bold',
    }"
    @update:model-value="(date) => date && emit('select', startOfCalendarDay(date))"
    @update:placeholder="(date) => emit('month', startOfMonth(startOfCalendarDay(date)))"
  >
    <template #day="{ day }">
      {{ day.day }}
      <span class="absolute inset-x-0 bottom-1.5 flex justify-center gap-0.5" aria-hidden="true">
        <span
          v-if="openDays.has(startOfCalendarDay(day))"
          class="size-1.5 rounded-full bg-warning"
        />
        <span
          v-if="matchedDays.has(startOfCalendarDay(day))"
          class="size-1.5 rounded-full bg-success"
        />
      </span>
    </template>
  </UCalendar>
</template>
