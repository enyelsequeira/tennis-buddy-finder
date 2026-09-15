<script setup lang="ts">
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
const toast = useToast();

function askToPlay(slot: SlotSummary) {
  requested.value = new Set(requested.value).add(slot.id);
  toast.add({
    title: t("demo.toastTitle"),
    description: t("demo.toastDescription", { name: slot.player.displayName.split(" ")[0] }),
    icon: "i-lucide-send",
  });
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="rounded-2xl bg-default ring ring-default p-4 sm:p-5 flex flex-col gap-4">
      <DayRail v-model="selectedDay" :days="days" />

      <div class="flex items-baseline justify-between gap-3">
        <h2 class="font-display font-bold text-[15px] text-highlighted">
          {{ formatLongDay(selectedDay) }}
        </h2>
        <p class="text-sm text-muted" aria-live="polite">
          {{ t("slot.openCount", visibleSlots.length) }}
        </p>
      </div>

      <ul
        v-if="visibleSlots.length"
        class="flex flex-col gap-2 sm:gap-3"
        :aria-label="t('demo.openSlots')"
      >
        <li v-for="slot in visibleSlots" :key="slot.id">
          <SlotCard :slot="slot" :requested="requested.has(slot.id)" @ask="askToPlay" />
        </li>
      </ul>

      <UEmpty
        v-else
        icon="i-lucide-calendar-days"
        :title="t('demo.emptyTitle')"
        :description="t('demo.emptyDescription')"
        :ui="{ root: 'py-10 rounded-2xl bg-elevated ring ring-default' }"
      />
    </div>

    <p class="text-xs text-muted text-center">{{ t("demo.caption") }}</p>
  </div>
</template>
