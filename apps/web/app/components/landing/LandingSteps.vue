<script setup lang="ts">
/**
 * The four steps are a real sequence, so they are numbered.
 * Each vignette reuses the same slot chip components as the app.
 */

const { t } = useI18n();
const { now, startOfDay, addDays, atTime, formatShortDay } = useLisbonTime();

const firstDayMs = useState("landing-demo-first-day", () => startOfDay(now()));
const dayMs = computed(() => addDays(firstDayMs.value, 1));
const matchedDayMs = computed(() => addDays(firstDayMs.value, 4));

const calendarSlots = computed(() => [
  {
    startAt: atTime({ dayMs: dayMs.value, hour: 18 }),
    endAt: atTime({ dayMs: dayMs.value, hour: 19, minute: 30 }),
    venue: DEMO_VENUES.clube,
  },
  {
    startAt: atTime({ dayMs: dayMs.value, hour: 20 }),
    endAt: atTime({ dayMs: dayMs.value, hour: 21, minute: 30 }),
  },
]);

const matchedSlot = computed(() => ({
  startAt: atTime({ dayMs: matchedDayMs.value, hour: 19 }),
  endAt: atTime({ dayMs: matchedDayMs.value, hour: 20 }),
  venue: DEMO_VENUES.clube,
}));

const filters = computed(() => [
  { label: t("steps.filters.evening"), active: true },
  { label: t("steps.filters.ntrp"), active: true },
  { label: t("steps.filters.singles"), active: false },
  { label: t("steps.filters.venue"), active: false },
]);

const STEP_KEYS = ["add", "find", "ask", "chat"] as const;
</script>

<template>
  <UPageSection
    id="how-it-works"
    :title="t('steps.title')"
    :description="t('steps.description')"
    class="scroll-mt-16"
    :ui="{ container: 'py-16 sm:py-20 lg:py-24', body: 'mt-10 lg:mt-12' }"
  >
    <ol class="grid gap-4 sm:gap-5 md:grid-cols-2">
      <li
        v-for="(key, index) in STEP_KEYS"
        :key="key"
        class="rounded-2xl bg-elevated ring ring-default p-5 sm:p-6 flex flex-col gap-5"
      >
        <div
          class="rounded-xl bg-default ring ring-default p-4 min-h-40 flex flex-col justify-center gap-2"
        >
          <!-- 1: the calendar day sheet -->
          <template v-if="key === 'add'">
            <div class="flex items-baseline justify-between">
              <span class="font-display font-bold text-sm text-highlighted">
                {{ formatShortDay(dayMs) }}
              </span>
              <span class="text-xs text-muted">{{ t("slot.count", calendarSlots.length) }}</span>
            </div>
            <SlotRow
              v-for="slot in calendarSlots"
              :key="slot.startAt"
              v-bind="slot"
              status="open"
              class="border-t border-default"
            >
              <template #trailing>
                <UIcon name="i-lucide-x" class="size-4 text-dimmed" aria-hidden="true" />
              </template>
            </SlotRow>
          </template>

          <!-- 2: filters and a day count -->
          <template v-else-if="key === 'find'">
            <div class="flex flex-wrap gap-1.5">
              <UBadge
                v-for="filter in filters"
                :key="filter.label"
                :label="filter.label"
                :color="filter.active ? 'primary' : 'neutral'"
                :variant="filter.active ? 'soft' : 'outline'"
                size="md"
              />
            </div>
            <div class="flex items-baseline justify-between mt-2">
              <span class="font-display font-bold text-sm text-highlighted">
                {{ formatShortDay(dayMs) }}
              </span>
              <span class="text-xs text-muted">{{ t("slot.openCount", 3) }}</span>
            </div>
            <PlayerIdentity :player="DEMO_PLAYERS.ana" :venue="DEMO_VENUES.clube" />
          </template>

          <!-- 3: a request waiting for an answer -->
          <template v-else-if="key === 'ask'">
            <div class="flex items-center justify-between gap-3">
              <PlayerIdentity :player="DEMO_PLAYERS.rui" />
              <RequestStatusBadge status="pending" />
            </div>
            <SlotRow v-bind="calendarSlots[0]!" status="open" class="border-t border-default" />
            <p class="text-sm text-default">{{ t("steps.requestNote") }}</p>
          </template>

          <!-- 4: chat with the matched slot pinned -->
          <template v-else>
            <SlotRow
              v-bind="matchedSlot"
              status="matched"
              class="rounded-lg bg-elevated ring ring-default px-3 min-h-10"
            />
            <div class="flex flex-col gap-2 mt-1">
              <MessageBubble time="18:42">{{ t("steps.chatTheirs") }}</MessageBubble>
              <MessageBubble mine time="18:50">{{ t("steps.chatMine") }}</MessageBubble>
            </div>
          </template>
        </div>

        <div class="flex gap-4">
          <span
            class="font-display font-bold text-2xl leading-none text-primary tabular-nums shrink-0"
            aria-hidden="true"
          >
            {{ index + 1 }}
          </span>
          <div>
            <h3 class="font-semibold text-highlighted">
              <span class="sr-only">{{ t("steps.stepLabel", { n: index + 1 }) }} </span
              >{{ t(`steps.items.${key}.title`) }}
            </h3>
            <p class="text-[15px] text-muted mt-1 max-w-prose">
              {{ t(`steps.items.${key}.description`) }}
            </p>
          </div>
        </div>
      </li>
    </ol>
  </UPageSection>
</template>
