<script setup lang="ts">
import type { PlayFormat, SlotStatus } from "~/types/slots";

/**
 * Translation playground. Shows every kind of translated output on one page
 * so a locale switch can be checked at a glance: static copy, dates from
 * useLisbonTime, plurals, status labels and the shared slot components.
 */

definePageMeta({
  layout: "landing",
});

const { t, locale, locales } = useI18n();
const time = useLisbonTime();
const { now, startOfDay, addDays, atTime, formatLongDay, formatShortDay, formatWeekday } = time;

useSeoMeta({
  title: () => t("playground.title"),
  description: () => t("playground.description"),
});

const firstDayMs = useState("landing-demo-first-day", () => startOfDay(now()));

const slots = computed(() => buildDemoSlots({ firstDayMs: firstDayMs.value, time }));
const sampleSlot = computed(() => slots.value[2]!);

const week = computed(() =>
  Array.from({ length: 7 }, (_, offset) => addDays(firstDayMs.value, offset)),
);

const sampleRange = computed(() => ({
  startAt: atTime({ dayMs: firstDayMs.value, hour: 18 }),
  endAt: atTime({ dayMs: firstDayMs.value, hour: 19, minute: 30 }),
}));

const COUNTS = [0, 1, 2, 7];
const REQUEST_STATUSES = ["pending", "accepted", "declined", "cancelled"] as const;
const SLOT_STATUSES: SlotStatus[] = ["open", "matched"];
const FORMATS: PlayFormat[] = ["singles", "doubles", "both"];

const requested = ref(false);
</script>

<template>
  <UContainer class="py-10 sm:py-14 flex flex-col gap-8">
    <div class="flex flex-col gap-2">
      <h1 class="font-display font-bold tracking-[-0.015em] text-3xl sm:text-4xl text-highlighted">
        {{ t("playground.title") }}
      </h1>
      <p class="text-muted max-w-prose">{{ t("playground.description") }}</p>
    </div>

    <div class="grid gap-4 md:grid-cols-2">
      <UCard>
        <template #header>
          <h2 class="font-semibold text-highlighted">{{ t("playground.locale") }}</h2>
        </template>
        <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt class="text-muted">{{ t("playground.current") }}</dt>
          <dd class="text-highlighted font-semibold">{{ locale }}</dd>
          <dt class="text-muted">{{ t("playground.available") }}</dt>
          <dd>{{ locales.map((entry) => `${entry.code} (${entry.language})`).join(", ") }}</dd>
          <dt class="text-muted">{{ t("playground.switch") }}</dt>
          <dd><LocaleSwitcher /></dd>
        </dl>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold text-highlighted">{{ t("playground.dates") }}</h2>
        </template>
        <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt class="text-muted">{{ t("playground.longDay") }}</dt>
          <dd>{{ formatLongDay(firstDayMs) }}</dd>
          <dt class="text-muted">{{ t("playground.shortDay") }}</dt>
          <dd>{{ formatShortDay(firstDayMs) }}</dd>
          <dt class="text-muted">{{ t("playground.weekdays") }}</dt>
          <dd>{{ week.map(formatWeekday).join(" · ") }}</dd>
          <dt class="text-muted">{{ t("playground.range") }}</dt>
          <dd class="font-display font-bold">{{ time.formatRange(sampleRange) }}</dd>
          <dt class="text-muted">{{ t("playground.duration") }}</dt>
          <dd>{{ time.formatDuration(sampleRange) }}</dd>
        </dl>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold text-highlighted">{{ t("playground.plurals") }}</h2>
        </template>
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-muted">
              <th class="font-medium pb-2">n</th>
              <th class="font-medium pb-2">slot.openCount</th>
              <th class="font-medium pb-2">slot.count</th>
              <th class="font-medium pb-2">player.playingYears</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="n in COUNTS" :key="n">
              <td class="py-1.5 tabular-nums">{{ n }}</td>
              <td class="py-1.5">{{ t("slot.openCount", n) }}</td>
              <td class="py-1.5">{{ t("slot.count", n) }}</td>
              <td class="py-1.5">{{ t("player.playingYears", n) }}</td>
            </tr>
          </tbody>
        </table>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold text-highlighted">{{ t("playground.statuses") }}</h2>
        </template>
        <div class="flex flex-col gap-4 text-sm">
          <div class="flex flex-wrap items-center gap-2">
            <RequestStatusBadge v-for="status in REQUEST_STATUSES" :key="status" :status="status" />
          </div>
          <div class="flex flex-wrap items-center gap-4">
            <span
              v-for="status in SLOT_STATUSES"
              :key="status"
              class="inline-flex items-center gap-2"
            >
              <SlotStatusDot :status="status" />
              {{ t(`slot.status.${status}`) }}
            </span>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <UBadge
              v-for="format in FORMATS"
              :key="format"
              :label="t(`player.formats.${format}`)"
              color="neutral"
              variant="soft"
            />
          </div>
        </div>
      </UCard>
    </div>

    <div class="flex flex-col gap-3">
      <h2 class="font-semibold text-highlighted">{{ t("playground.components") }}</h2>
      <div class="grid gap-4 md:grid-cols-2">
        <SlotCard :slot="sampleSlot" :requested="requested" @ask="requested = true" />
        <div class="rounded-2xl bg-elevated ring ring-default p-3.5 flex flex-col gap-2">
          <SlotRow v-bind="sampleSlot" />
          <SlotRow v-bind="sampleRange" status="matched" venue="Parque das Abadias" />
          <UButton
            v-if="requested"
            :label="t('playground.reset')"
            color="neutral"
            variant="outline"
            size="sm"
            class="self-start"
            @click="requested = false"
          />
        </div>
      </div>
    </div>
  </UContainer>
</template>
