<script setup lang="ts">
import { api } from "@tennis-buddy-finder/backend/convex/_generated/api";
import type { OpenSlot, SearchFilterValues } from "~/types/slots";

const RAIL_DAYS = 7;
// The backend clamps `numItems` to this, so asking for more returns the same page.
const MAX_PAGE_SIZE = 100;

function noFilters(): SearchFilterValues {
  return { timeOfDay: "any", ntrp: [NTRP_MIN, NTRP_MAX], formats: [], venue: "any" };
}

const { t } = useI18n();
const { now, startOfDay, addDays, timeOfDay, formatLongDay, formatShortDay } = useLisbonTime();
const { me } = await useCurrentUser();

useSeoMeta({ title: () => t("pages.find.title") });

const today = startOfDay(now());
const week = ref(0);
const dayStart = (offset: number) => addDays(today, week.value * RAIL_DAYS + offset);
const selectedDay = ref(today);

function showWeek(index: number) {
  week.value = index;
  selectedDay.value = dayStart(0);
}

const rating = me.value?.profile?.ntrp;
const filters = ref(noFilters());
if (rating) {
  filters.value.ntrp = [Math.max(NTRP_MIN, rating - 0.5), Math.min(NTRP_MAX, rating + 0.5)];
}
const filtersOpen = ref(false);

const ntrp = refDebounced(
  computed(() => filters.value.ntrp),
  300,
);
const format = computed(() =>
  filters.value.formats.length === 1 ? filters.value.formats[0] : undefined,
);
const venueId = computed(() => (filters.value.venue === "any" ? undefined : filters.value.venue));

const pageSize = ref(50);

const { data: venues } = useAuthedQuery(api.venues.list);
const {
  data: results,
  error,
  isPending,
} = useAuthedQuery(api.availability.search, () => ({
  from: dayStart(0),
  to: dayStart(RAIL_DAYS),
  minNtrp: ntrp.value[0],
  maxNtrp: ntrp.value[1],
  format: format.value,
  venueId: venueId.value,
  paginationOpts: { numItems: pageSize.value, cursor: null },
}));

// The query only re-runs when data changes, so drop slots that started since on a ticking clock.
const clock = useTimestamp({ interval: 30_000 });

// The rail's dots need the whole week, so the page grows until the query is done.
watch(results, (value) => {
  if (value && !value.isDone) pageSize.value = Math.min(pageSize.value * 2, MAX_PAGE_SIZE);
});

const slotsByDay = computed(() => {
  const time = filters.value.timeOfDay;
  const map = new Map<number, OpenSlot[]>();
  for (const { slot, player } of results.value?.page ?? []) {
    if (!isUpcoming(slot, clock.value)) continue;
    if (time !== "any" && timeOfDay(slot.startAt) !== time) continue;
    const day = startOfDay(slot.startAt);
    map.set(day, [...(map.get(day) ?? []), toOpenSlot({ slot, player, venues: venues.value })]);
  }
  return map;
});

const days = computed(() =>
  Array.from({ length: RAIL_DAYS }, (_, offset) => {
    const startAt = dayStart(offset);
    return { startAt, hasOpen: slotsByDay.value.has(startAt) };
  }),
);

const visibleSlots = computed(() => slotsByDay.value.get(selectedDay.value) ?? []);

const chips = computed(() => {
  const {
    timeOfDay: time,
    ntrp: [min, max],
  } = filters.value;
  return [
    {
      label: time === "any" ? t("find.timeOfDay") : t(`find.times.${time}`),
      active: time !== "any",
    },
    {
      label: t("find.ntrpRange", { min: min.toFixed(1), max: max.toFixed(1) }),
      active: min > NTRP_MIN || max < NTRP_MAX,
    },
    {
      label: format.value ? t(`player.formats.${format.value}`) : t("find.format"),
      active: !!format.value,
    },
    {
      label: venues.value?.find((venue) => venue._id === venueId.value)?.name ?? t("find.venue"),
      active: !!venueId.value,
    },
  ];
});

const hasFilters = computed(() => chips.value.some((chip) => chip.active));

const { requested, asking, askOpen, ask } = useAskToPlay();
</script>

<template>
  <div class="mx-auto max-w-260 space-y-4">
    <div class="flex items-center justify-between gap-3">
      <h1
        class="font-display font-bold tracking-[-0.015em] text-[22px] md:text-[26px] text-highlighted"
      >
        {{ t("pages.find.title") }}
      </h1>
      <NotificationBell class="md:hidden" />
    </div>

    <div class="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)] lg:items-start lg:gap-6">
      <aside
        class="hidden lg:block rounded-2xl bg-elevated ring ring-default p-3.5"
        :aria-label="t('find.filters')"
      >
        <FindSearchFilters v-model="filters" :venues="venues ?? []" />
      </aside>

      <div class="flex min-w-0 flex-col gap-4">
        <div class="flex items-center justify-between gap-3">
          <p class="text-sm text-muted">
            {{ formatShortDay(dayStart(0)) }} – {{ formatShortDay(dayStart(RAIL_DAYS - 1)) }}
          </p>
          <div class="flex gap-1">
            <UButton
              icon="i-lucide-chevron-left"
              color="neutral"
              variant="ghost"
              size="sm"
              :disabled="week === 0"
              :aria-label="t('find.previousWeek')"
              @click="showWeek(week - 1)"
            />
            <UButton
              icon="i-lucide-chevron-right"
              color="neutral"
              variant="ghost"
              size="sm"
              :aria-label="t('find.nextWeek')"
              @click="showWeek(week + 1)"
            />
          </div>
        </div>

        <DayRail v-model="selectedDay" :days="days" />

        <div class="flex gap-2 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 lg:hidden">
          <UButton
            v-for="(chip, index) in chips"
            :key="index"
            :label="chip.label"
            color="neutral"
            :variant="chip.active ? 'subtle' : 'outline'"
            size="sm"
            class="shrink-0"
            @click="filtersOpen = true"
          />
        </div>

        <div class="flex items-baseline justify-between gap-3">
          <h2 class="font-display font-bold text-sm md:text-[15px] text-highlighted">
            {{ formatLongDay(selectedDay) }}
          </h2>
          <p v-if="results" class="text-sm text-muted" aria-live="polite">
            {{ t("slot.openCount", visibleSlots.length) }}
          </p>
        </div>

        <div v-if="isPending" class="grid gap-2 md:grid-cols-2 md:gap-3">
          <USkeleton v-for="n in 4" :key="n" class="h-[118px] rounded-2xl" />
        </div>

        <UAlert
          v-else-if="error"
          color="error"
          variant="soft"
          icon="i-lucide-triangle-alert"
          :title="t('find.error')"
        />

        <ul v-else-if="visibleSlots.length" class="grid gap-2 md:grid-cols-2 md:gap-3">
          <li v-for="slot in visibleSlots" :key="slot.id">
            <SlotCard
              :slot="slot"
              :requested="requested.has(slot.id)"
              link-profile
              @ask="ask(slot)"
            />
          </li>
        </ul>

        <UEmpty
          v-else
          icon="i-lucide-calendar-days"
          :title="t('find.emptyTitle')"
          :description="t('find.emptyDescription')"
          :ui="{ root: 'py-10 rounded-2xl bg-elevated ring ring-default' }"
        >
          <template v-if="hasFilters" #actions>
            <UButton
              :label="t('find.clearFilters')"
              color="neutral"
              variant="outline"
              @click="filters = noFilters()"
            />
          </template>
        </UEmpty>
      </div>
    </div>

    <USlideover
      v-model:open="filtersOpen"
      side="bottom"
      :title="t('find.filters')"
      :ui="{ content: 'rounded-t-2xl' }"
    >
      <template #body>
        <FindSearchFilters v-model="filters" :venues="venues ?? []" />
      </template>
    </USlideover>

    <AskToPlayModal v-if="asking" v-model:open="askOpen" :slot="asking" />
  </div>
</template>
