<script setup lang="ts">
import type { SlotSummary } from "~/types/slots";

const props = defineProps<{
  slot: SlotSummary;
  /** Set once the current user has asked to play; swaps the button for "Requested". */
  requested?: boolean;
  /** On a player's own profile the page already is the identity. */
  hideIdentity?: boolean;
  linkProfile?: boolean;
  hideAsk?: boolean;
}>();

const emit = defineEmits<{ ask: [slot: SlotSummary] }>();

const { t } = useI18n();
const localePath = useLocalePath();
const { formatRange, formatDuration } = useLisbonTime();

const range = computed(() => formatRange(props.slot));
const duration = computed(() => formatDuration(props.slot));
</script>

<template>
  <article
    class="rounded-2xl bg-elevated ring ring-default p-3.5 flex flex-col gap-3"
    :aria-label="t('slot.withPlayer', { range, name: slot.player.displayName })"
  >
    <div class="flex items-center gap-2.5">
      <SlotStatusDot :status="slot.status" />
      <time class="font-display font-bold text-base text-highlighted">{{ range }}</time>
      <span class="text-sm text-muted">{{ duration }}</span>
    </div>

    <p v-if="hideIdentity" class="text-sm text-muted">{{ slot.venue ?? t("slot.anyVenue") }}</p>
    <ULink
      v-else-if="linkProfile"
      :to="localePath(`/players/${slot.player.id}`)"
      class="block -m-1.5 p-1.5 rounded-lg hover:bg-accented/60"
    >
      <PlayerIdentity :player="slot.player" :venue="slot.venue" />
    </ULink>
    <PlayerIdentity v-else :player="slot.player" :venue="slot.venue" />

    <USeparator />

    <div class="flex items-center justify-between gap-3">
      <p class="text-sm text-muted">
        {{ slot.player.age }} · {{ t("player.playingYears", slot.player.yearsPlaying) }}
      </p>
      <UButton
        v-if="slot.status === 'open' && !requested && !hideAsk"
        :label="t('slot.askToPlay')"
        color="primary"
        @click="emit('ask', slot)"
      />
      <UButton
        v-else-if="requested"
        :label="t('slot.requested')"
        variant="outline"
        color="neutral"
        disabled
      />
    </div>
  </article>
</template>
