<script setup lang="ts">
import { Group, Paper, Text } from "@mantine-vue/core";

defineProps<{
  /** Sent by the current user: blue, right-aligned. */
  mine?: boolean;
  time: string;
}>();

/** Speech-bubble tail: the corner nearest the sender is tightened. */
const tail = "var(--mantine-radius-sm)";
</script>

<template>
  <Group :justify="mine ? 'flex-end' : 'flex-start'" wrap="nowrap">
    <Paper
      maw="85%"
      radius="lg"
      px="md"
      py="xs"
      :withBorder="!mine"
      :bg="mine ? 'court' : undefined"
      :c="mine ? 'white' : undefined"
      :style="mine ? { borderEndEndRadius: tail } : { borderEndStartRadius: tail }"
    >
      <Text size="sm"><slot /></Text>
      <Text
        :fz="10"
        :mt="4"
        ta="end"
        :c="mine ? 'white' : 'dimmed'"
        :opacity="mine ? 0.7 : undefined"
      >
        {{ time }}
      </Text>
    </Paper>
  </Group>
</template>
