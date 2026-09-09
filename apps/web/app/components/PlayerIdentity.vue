<script setup lang="ts">
import type { SlotPlayer } from "~/types/slots";

const props = defineProps<{
  player: SlotPlayer;
  venue?: string;
}>();

const { t } = useI18n();

const meta = computed(() =>
  [
    t(`player.formats.${props.player.formats}`),
    props.player.languages.map((code) => code.toUpperCase()).join(" "),
    props.venue ?? t("slot.anyVenue"),
  ].join(" · "),
);
</script>

<template>
  <div class="flex items-center gap-3 min-w-0">
    <UAvatar
      :src="player.avatarUrl"
      :alt="player.displayName"
      :text="player.displayName.charAt(0)"
      size="xl"
      class="shrink-0 bg-accented"
      :ui="{ fallback: 'text-muted font-semibold' }"
    />
    <div class="min-w-0">
      <div class="flex items-center gap-2">
        <span class="font-semibold text-highlighted truncate">{{ player.displayName }}</span>
        <NtrpBadge :rating="player.ntrp" />
      </div>
      <p class="text-xs text-muted truncate">{{ meta }}</p>
    </div>
  </div>
</template>
