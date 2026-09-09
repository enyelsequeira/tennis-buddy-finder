<script setup lang="ts">
const { t } = useI18n();

// Translation keys cannot contain dots, so the rating is carried separately.
const LEVELS = [
  { rating: 2.5, key: "ntrp25" },
  { rating: 3.0, key: "ntrp30" },
  { rating: 3.5, key: "ntrp35" },
  { rating: 4.0, key: "ntrp40" },
  { rating: 4.5, key: "ntrp45" },
  { rating: 5.0, key: "ntrp50" },
] as const;
</script>

<template>
  <UPageSection
    id="your-level"
    :title="t('levels.title')"
    :description="t('levels.description')"
    orientation="horizontal"
    class="scroll-mt-16"
    :ui="{
      container: 'py-16 sm:py-20 lg:py-24 lg:gap-16',
      description: 'max-w-prose',
    }"
  >
    <dl class="rounded-2xl bg-elevated ring ring-default divide-y divide-default">
      <div v-for="level in LEVELS" :key="level.key" class="flex items-start gap-4 px-5 py-3.5">
        <dt class="shrink-0 pt-0.5">
          <NtrpBadge :rating="level.rating" />
        </dt>
        <dd class="text-sm text-default">{{ t(`levels.items.${level.key}`) }}</dd>
      </div>
    </dl>
  </UPageSection>
</template>
