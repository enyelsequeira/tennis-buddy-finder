<script setup lang="ts">
/**
 * Loading state for `/players/[id]`, shaped like `PlayerProfile`: identity
 * card (avatar, name, meta, bio, facts) and the slots column.
 */
import { Flex, Group, Paper, Skeleton, Stack } from "@mantine-vue/core";
</script>

<template>
  <Flex
    :direction="{ base: 'column', md: 'row' }"
    :align="{ base: 'stretch', md: 'flex-start' }"
    :gap="{ base: 'md', md: 'lg' }"
    aria-busy="true"
  >
    <Paper withBorder radius="xl" p="lg" :w="{ base: '100%', md: 320 }" :class="$style.identity">
      <Stack gap="md">
        <Group gap="md" wrap="nowrap" align="center">
          <Skeleton :height="72" circle />
          <Stack gap="xs" flex="1">
            <Skeleton :height="20" :width="144" />
            <Skeleton :height="12" :width="176" />
            <Skeleton :height="12" :width="128" />
          </Stack>
        </Group>
        <Stack gap="xs">
          <Skeleton :height="12" />
          <Skeleton :height="12" width="83%" />
          <Skeleton :height="12" width="66%" />
        </Stack>
        <Group gap="xs">
          <Skeleton :height="24" :width="80" radius="xl" />
          <Skeleton :height="24" :width="64" radius="xl" />
          <Skeleton :height="24" :width="96" radius="xl" />
        </Group>
      </Stack>
    </Paper>
    <Stack gap="sm" flex="1" miw="0">
      <Skeleton :height="16" :width="128" />
      <Skeleton :height="118" radius="xl" />
      <Skeleton :height="118" radius="xl" />
    </Stack>
  </Flex>
</template>

<style module>
.identity {
  flex-shrink: 0;
}
</style>
