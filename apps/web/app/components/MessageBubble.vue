<script setup lang="ts">
defineProps<{
  /** Sent by the current user: blue, right-aligned. */
  mine?: boolean;
  time: string;
}>();
</script>

<template>
  <div class="flex" :class="mine ? 'justify-end' : 'justify-start'">
    <div
      class="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm"
      :class="
        mine
          ? 'bg-primary text-inverted rounded-br-md'
          : 'bg-elevated text-default ring ring-default rounded-bl-md'
      "
    >
      <p><slot /></p>
      <p class="text-[10px] mt-1 text-end" :class="mine ? 'text-inverted/70' : 'text-dimmed'">
        {{ time }}
      </p>
    </div>
  </div>
</template>
