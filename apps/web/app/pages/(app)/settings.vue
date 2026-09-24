<script setup lang="ts">
import { Skeleton, Stack, Title } from "@mantine-vue/core";

definePageMeta({ middleware: ["auth", "onboarded"] });

const { t } = useI18n();
// The sections use reactive queries and mutations, which need the WebSocket
// client to hold a token; until then a skeleton stands in for them.
const ready = useConvexAuthReady();

useSeoMeta({ title: () => t("pages.settings.title") });
</script>

<template>
  <Stack :maw="640" gap="md">
    <Title :order="1" :fz="{ base: 22, sm: 26 }" lts="-0.015em">
      {{ t("pages.settings.title") }}
    </Title>

    <SettingsSections v-if="ready" />

    <Stack v-else gap="md" aria-busy="true">
      <Skeleton :height="224" radius="xl" />
      <Skeleton :height="112" radius="xl" />
      <Skeleton :height="96" radius="xl" />
      <Skeleton :height="96" radius="xl" />
      <Skeleton :height="96" radius="xl" />
    </Stack>
  </Stack>
</template>
