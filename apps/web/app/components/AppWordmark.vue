<script setup lang="ts">
import { Box, Group, Text } from "@mantine-vue/core";

withDefaults(defineProps<{ size?: "md" | "lg" }>(), { size: "md" });

const { t } = useI18n();
</script>

<template>
  <Group component="span" display="inline-flex" gap="xs" align="center" wrap="nowrap">
    <!-- The ball: the only place optic yellow appears outside an open slot. -->
    <Box
      component="span"
      bg="ball"
      bdrs="50%"
      flex="0 0 auto"
      :w="size === 'lg' ? 20 : 18"
      :h="size === 'lg' ? 20 : 18"
      aria-hidden="true"
    />
    <Text
      component="span"
      ff="heading"
      fw="700"
      lh="1.35"
      lts="-0.015em"
      c="var(--mantine-color-text)"
      :fz="size === 'lg' ? 24 : 20"
    >
      {{ t("app.name") }}
    </Text>
  </Group>
</template>
