<script setup lang="ts">
import type { FormSubmitEvent } from "@nuxt/ui";
import { api } from "@tennis-buddy-finder/backend/convex/_generated/api";
import type { Id } from "@tennis-buddy-finder/backend/convex/_generated/dataModel";
import { MAX_SLOT_MS } from "@tennis-buddy-finder/backend/convex/model/time";
import * as z from "zod";

const props = defineProps<{
  /** Start of the Lisbon day, milliseconds since epoch. */
  day: number;
}>();

const NOTE_MAX = 200;

const SLOT_ERROR_KEYS = {
  SLOT_OVERLAP: "overlap",
  SLOT_IN_PAST: "inPast",
  SLOT_TOO_LONG: "tooLong",
  SLOT_INVALID_RANGE: "endAfterStart",
  SLOT_NOT_ON_GRID: "notOnGrid",
  SLOT_NOT_OPEN: "notOpen",
  INVALID_VENUE: "invalidVenue",
  INVALID_NOTE: "noteTooLong",
} as const;

const { t } = useI18n();
const toast = useToast();
const { atTime, dayBounds, halfHours, formatTime } = useLisbonTime();
const now = useTimestamp({ interval: 30_000 });

const {
  data: slots,
  isPending,
  error,
} = useAuthedQuery(api.availability.mine, () => dayBounds(props.day));
const { data: venues } = useAuthedQuery(api.venues.list);

const venueItems = computed(() =>
  (venues.value ?? []).map((venue) => ({ value: venue._id, label: venue.name })),
);

const rows = computed(() =>
  (slots.value ?? []).flatMap((slot) =>
    slot.status === "open" || slot.status === "matched"
      ? [
          {
            ...slot,
            status: slot.status,
            venue: venues.value?.find((venue) => venue._id === slot.venueId)?.name,
          },
        ]
      : [],
  ),
);

function errorMessage(error: unknown) {
  return t(`calendar.errors.${convexErrorKey(error, SLOT_ERROR_KEYS)}`);
}

const { mutate: removeSlot } = useConvexMutation(api.availability.remove);
const removing = ref<Id<"availabilitySlots"> | null>(null);

async function onRemove(slotId: Id<"availabilitySlots">) {
  removing.value = slotId;
  try {
    await removeSlot({ slotId });
  } catch (error) {
    toast.add({ title: errorMessage(error), color: "error" });
  } finally {
    removing.value = null;
  }
}

const { mutate: cancelSlot, isPending: isCancelling } = useConvexMutation(api.availability.cancel);
const cancelling = ref<Id<"availabilitySlots"> | null>(null);

async function confirmCancel() {
  if (!cancelling.value) return;
  try {
    await cancelSlot({ slotId: cancelling.value });
    cancelling.value = null;
    toast.add({ title: t("calendar.matchCancelled"), icon: "i-lucide-check" });
  } catch (error) {
    toast.add({ title: errorMessage(error), color: "error" });
  }
}

const schema = computed(() =>
  z
    .object({
      startAt: z.number(t("calendar.errors.startRequired")),
      endAt: z.number(t("calendar.errors.endRequired")),
      venueId: z.custom<Id<"venues">>().nullish(),
      note: z.string().trim().max(NOTE_MAX, t("calendar.errors.noteTooLong")),
    })
    .refine(({ startAt, endAt }) => endAt > startAt, {
      path: ["endAt"],
      error: t("calendar.errors.endAfterStart"),
    })
    .refine(({ startAt, endAt }) => endAt - startAt <= MAX_SLOT_MS, {
      path: ["endAt"],
      error: t("calendar.errors.tooLong"),
    }),
);
type SlotInput = z.output<typeof schema.value>;

const state = reactive<Partial<SlotInput>>({ note: "" });

const timeItems = computed(() =>
  halfHours(props.day).map((at) => ({ value: at, label: timeLabel(at, formatTime) })),
);
const startItems = computed(() =>
  timeItems.value
    .slice(0, -1)
    .filter(
      ({ value }) =>
        value > now.value &&
        !rows.value.some((slot) => slot.startAt <= value && value < slot.endAt),
    ),
);
const endItems = computed(() => {
  const startAt = state.startAt ?? 0;
  const latest = latestEnd(startAt, rows.value);
  return timeItems.value.slice(1).filter(({ value }) => value > startAt && value <= latest);
});

// The list opens at 00:00, so start from the first free evening time instead.
function defaultStart() {
  const evening = atTime({ dayMs: props.day, hour: 18 });
  return startItems.value.find(({ value }) => value >= evening)?.value;
}
// Keeps the picked times valid as the clock moves and the day's slots load or change.
watchEffect(() => {
  if (!startItems.value.some(({ value }) => value === state.startAt)) {
    state.startAt = defaultStart();
  }
  if (!endItems.value.some(({ value }) => value === state.endAt)) state.endAt = undefined;
});

const { mutate: createSlot, isPending: isCreating } = useConvexMutation(api.availability.create);

async function onSubmit({ data }: FormSubmitEvent<SlotInput>) {
  try {
    await createSlot({
      startAt: data.startAt,
      endAt: data.endAt,
      venueId: data.venueId ?? undefined,
      note: data.note || undefined,
    });
    Object.assign(state, { startAt: defaultStart(), endAt: undefined, note: "" });
    toast.add({ title: t("calendar.slotAdded"), icon: "i-lucide-check" });
  } catch (error) {
    toast.add({ title: errorMessage(error), color: "error" });
  }
}
</script>

<template>
  <div class="space-y-5">
    <div v-if="isPending" class="space-y-2">
      <USkeleton class="h-11 w-full" />
      <USkeleton class="h-11 w-full" />
    </div>

    <UAlert
      v-else-if="error"
      color="error"
      variant="soft"
      icon="i-lucide-triangle-alert"
      :title="t('calendar.loadError')"
    />

    <p v-else-if="!rows.length" class="text-sm text-muted">{{ t("calendar.dayEmpty") }}</p>

    <ul v-else class="divide-y divide-default">
      <li v-for="row in rows" :key="row._id">
        <SlotRow
          :start-at="row.startAt"
          :end-at="row.endAt"
          :status="row.status"
          :venue="row.venue"
        >
          <template #trailing>
            <UTooltip v-if="row.status === 'open'" :text="t('calendar.removeSlot')">
              <UButton
                icon="i-lucide-x"
                color="neutral"
                variant="ghost"
                class="size-11 justify-center"
                :ui="{ leadingIcon: 'size-4' }"
                :aria-label="t('calendar.removeSlot')"
                :loading="removing === row._id"
                @click="onRemove(row._id)"
              />
            </UTooltip>
            <UButton
              v-else
              :label="t('calendar.cancel')"
              color="error"
              variant="soft"
              size="sm"
              @click="cancelling = row._id"
            />
          </template>
        </SlotRow>
        <p v-if="row.note" class="pb-2 ps-5 text-xs text-muted">{{ row.note }}</p>
      </li>
    </ul>

    <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
      <h3 class="font-display font-bold text-sm text-highlighted">
        {{ t("calendar.addHeading") }}
      </h3>

      <div class="grid grid-cols-2 gap-3">
        <UFormField name="startAt" :label="t('calendar.start')" required>
          <USelect v-model="state.startAt" :items="startItems" value-key="value" class="w-full" />
        </UFormField>
        <UFormField name="endAt" :label="t('calendar.end')" required>
          <USelect v-model="state.endAt" :items="endItems" value-key="value" class="w-full" />
        </UFormField>
      </div>

      <UFormField name="venueId" :label="t('find.venue')" :hint="t('onboarding.optional')">
        <USelectMenu
          v-model="state.venueId"
          :items="venueItems"
          value-key="value"
          :search-input="false"
          clear
          :placeholder="t('slot.anyVenue')"
          class="w-full"
        />
      </UFormField>

      <UFormField name="note" :label="t('calendar.note')" :hint="t('onboarding.optional')">
        <UInput v-model="state.note" class="w-full" />
      </UFormField>

      <UButton
        type="submit"
        :label="t('calendar.addSlot')"
        icon="i-lucide-plus"
        :loading="isCreating"
        block
      />
    </UForm>

    <UModal
      :open="!!cancelling"
      :title="t('calendar.cancelTitle')"
      :description="t('calendar.cancelDescription')"
      @update:open="cancelling = null"
    >
      <template #footer="{ close }">
        <div class="flex w-full justify-end gap-2">
          <UButton
            :label="t('calendar.cancelKeep')"
            color="neutral"
            variant="outline"
            :disabled="isCancelling"
            @click="close"
          />
          <UButton
            :label="t('calendar.cancelConfirm')"
            color="error"
            :loading="isCancelling"
            @click="confirmCancel"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
