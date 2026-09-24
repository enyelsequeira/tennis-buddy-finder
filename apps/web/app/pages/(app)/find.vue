<script setup lang="ts">
import { Stack, Title } from "@mantine-vue/core";

definePageMeta({ middleware: ["auth", "onboarded"] });

const { t } = useI18n();

useSeoMeta({ title: () => t("pages.find.title") });
</script>

<template>
  <Stack gap="md">
    <Title :order="1" :fz="{ base: 22, sm: 26 }">{{ t("pages.find.title") }}</Title>
    <ComingSoon />
  </Stack>
</template>
