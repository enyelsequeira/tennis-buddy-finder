<script setup lang="ts">
import type { Doc } from "@tennis-buddy-finder/backend/convex/_generated/dataModel";
import type { SearchFilterValues } from "~/types/slots";

const props = defineProps<{ venues: Doc<"venues">[] }>();

const filters = defineModel<SearchFilterValues>({ required: true });

const { t } = useI18n();

const TIMES = ["any", "morning", "afternoon", "evening"] as const;
const FORMATS = ["singles", "doubles"] as const;

const timeItems = computed(() =>
  TIMES.map((value) => ({ value, label: t(`find.times.${value}`) })),
);
const formatItems = computed(() =>
  FORMATS.map((value) => ({ value, label: t(`player.formats.${value}`) })),
);
const venueItems = computed(() => [
  { value: "any" as const, label: t("slot.anyVenue") },
  ...props.venues.map((venue) => ({ value: venue._id, label: venue.name })),
]);

function update(patch: Partial<SearchFilterValues>) {
  filters.value = { ...filters.value, ...patch };
}

// shortcut: Nuxt UI 4.11 USlider drops range-thumb aria-labels, so reka writes English
// "Minimum"/"Maximum" (also after mount); relabel on every write until USlider forwards them.
const root = useTemplateRef<HTMLElement>("root");
function labelNtrpThumbs() {
  const labels = [t("find.ntrpMin"), t("find.ntrpMax")];
  root.value?.querySelectorAll('[role="slider"]').forEach((thumb, index) => {
    const label = labels[index];
    if (label && thumb.getAttribute("aria-label") !== label)
      thumb.setAttribute("aria-label", label);
  });
}
// Started on mount so the observer is attached before reka's post-mount relabel.
onMounted(() => {
  useMutationObserver(root, labelNtrpThumbs, { subtree: true, attributeFilter: ["aria-label"] });
  watchEffect(labelNtrpThumbs);
});
</script>

<template>
  <div ref="root" class="flex flex-col gap-5">
    <UFormField :label="t('find.timeOfDay')">
      <URadioGroup
        :model-value="filters.timeOfDay"
        :items="timeItems"
        value-key="value"
        variant="card"
        indicator="hidden"
        size="sm"
        :ui="{ fieldset: 'grid grid-cols-2 gap-1.5' }"
        @update:model-value="(timeOfDay) => update({ timeOfDay })"
      />
    </UFormField>

    <UFormField
      :label="
        t('find.ntrpRange', { min: filters.ntrp[0].toFixed(1), max: filters.ntrp[1].toFixed(1) })
      "
    >
      <USlider
        :model-value="filters.ntrp"
        :min="NTRP_MIN"
        :max="NTRP_MAX"
        :step="0.5"
        @update:model-value="(ntrp) => ntrp && update({ ntrp })"
      />
    </UFormField>

    <UFormField :label="t('find.format')">
      <UCheckboxGroup
        :model-value="filters.formats"
        :items="formatItems"
        value-key="value"
        orientation="horizontal"
        @update:model-value="(formats) => update({ formats })"
      />
    </UFormField>

    <UFormField :label="t('find.venue')">
      <USelect
        :model-value="filters.venue"
        :items="venueItems"
        value-key="value"
        class="w-full"
        @update:model-value="(venue) => update({ venue })"
      />
    </UFormField>
  </div>
</template>
