<script setup lang="ts">
import type { ButtonProps } from "@nuxt/ui";
import { api } from "@tennis-buddy-finder/backend/convex/_generated/api";
import { breakpointsTailwind } from "@vueuse/core";

const { t } = useI18n();
const toast = useToast();
const { now, startOfDay, startOfMonth, monthBounds, formatLongDay } = useLisbonTime();

useSeoMeta({ title: () => t("pages.calendar.title") });

const isDesktop = useBreakpoints(breakpointsTailwind).greaterOrEqual("md");
const reducedMotion = usePreferredReducedMotion();

const today = startOfDay(now());
const day = ref(today);
const month = ref(startOfMonth(today));
const sheetOpen = ref(false);

const {
  data: slots,
  isPending,
  error,
} = useAuthedQuery(api.availability.mine, () => monthBounds(month.value));

const isEmpty = computed(
  () => slots.value?.every((slot) => slot.status !== "open" && slot.status !== "matched") ?? false,
);

function onSelect(dayMs: number) {
  day.value = dayMs;
  sheetOpen.value = true;
}

// From `md` up the add-slot form is already on screen, so the action is only for the sheet.
const emptyActions = computed<ButtonProps[]>(() =>
  isDesktop.value
    ? []
    : [
        {
          label: t("calendar.addSlot"),
          icon: "i-lucide-plus",
          color: "neutral",
          variant: "outline",
          onClick: () => onSelect(Math.max(today, month.value)),
        },
      ],
);

const { mutate: copyLastWeek, isPending: isCopying } = useConvexMutation(
  api.availability.copyLastWeek,
);

async function onCopy() {
  try {
    const count = await copyLastWeek({});
    toast.add({ title: t("calendar.copied", count), icon: "i-lucide-check" });
  } catch {
    toast.add({ title: t("calendar.errors.generic"), color: "error" });
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1
          class="font-display font-bold tracking-[-0.015em] text-[22px] md:text-[26px] text-highlighted"
        >
          {{ t("pages.calendar.title") }}
        </h1>
        <p class="mt-1 text-sm text-muted">{{ t("calendar.subtitle") }}</p>
      </div>
      <div class="flex items-center gap-1">
        <UButton
          :label="t('calendar.copyLastWeek')"
          icon="i-lucide-copy"
          color="neutral"
          variant="soft"
          class="shrink-0"
          :loading="isCopying"
          @click="onCopy"
        />
        <NotificationBell class="md:hidden" />
      </div>
    </div>

    <div class="grid gap-4 md:grid-cols-[minmax(0,520px)_360px] md:items-start md:gap-6">
      <div class="space-y-3">
        <UCard :ui="{ body: 'p-2 sm:p-4' }">
          <div v-if="isPending" class="space-y-4">
            <USkeleton class="h-9 w-full" />
            <div class="grid grid-cols-7 place-items-center gap-y-1">
              <USkeleton v-for="cell in 42" :key="cell" class="size-11 rounded-full" />
            </div>
          </div>

          <UAlert
            v-else-if="error"
            color="error"
            variant="soft"
            icon="i-lucide-triangle-alert"
            :title="t('calendar.loadError')"
          />

          <CalendarMonth
            v-else
            :slots="slots ?? []"
            :day="day"
            :month="month"
            @select="onSelect"
            @month="month = $event"
          />
        </UCard>

        <UEmpty
          v-if="isEmpty"
          icon="i-lucide-calendar-plus"
          :description="t('calendar.empty')"
          :actions="emptyActions"
        />
      </div>

      <ClientOnly>
        <UCard v-if="isDesktop">
          <template #header>
            <h2 class="font-display font-bold text-[15px] text-highlighted">
              {{ formatLongDay(day) }}
            </h2>
          </template>
          <CalendarDaySheet :key="day" :day="day" />
        </UCard>

        <USlideover
          v-else
          v-model:open="sheetOpen"
          side="bottom"
          :title="formatLongDay(day)"
          :transition="reducedMotion !== 'reduce'"
          :ui="{
            content: 'max-h-[85dvh] rounded-t-2xl shadow-xl',
            title: 'font-display font-bold text-[15px]',
          }"
        >
          <template #body>
            <CalendarDaySheet :key="day" :day="day" />
          </template>
        </USlideover>
      </ClientOnly>
    </div>
  </div>
</template>
