<script setup lang="ts">
import { Avatar, Group, Stack, Text } from "@mantine-vue/core";
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
  <Group gap="sm" wrap="nowrap" :miw="0">
    <Avatar
      :src="player.avatarUrl"
      :alt="player.displayName"
      :size="40"
      variant="light"
      color="gray"
      flex="0 0 auto"
    >
      {{ player.displayName.charAt(0) }}
    </Avatar>
    <Stack gap="0" :miw="0">
      <Group :gap="8" wrap="nowrap">
        <Text fw="600" truncate :miw="0">{{ player.displayName }}</Text>
        <NtrpBadge :rating="player.ntrp" />
      </Group>
      <Group :gap="4" wrap="nowrap" c="dimmed">
        <Icon name="lucide:map-pin" size="12" aria-hidden="true" />
        <Text size="xs" c="dimmed" truncate :miw="0">{{ meta }}</Text>
      </Group>
    </Stack>
  </Group>
</template>
