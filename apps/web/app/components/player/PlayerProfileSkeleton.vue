<script setup lang="ts">
/**
 * Loading state for `/players/[id]`, shaped like `PlayerProfile`: identity
 * card (avatar, name, meta, bio, facts) and the slots column.
 */
</script>

<template>
  <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6" aria-busy="true">
    <div class="rounded-2xl bg-elevated ring ring-default p-5 space-y-4 lg:w-80 lg:shrink-0">
      <div class="flex items-center gap-4">
        <USkeleton class="size-18 rounded-full shrink-0" />
        <div class="flex-1 space-y-2">
          <USkeleton class="h-5 w-36" />
          <USkeleton class="h-3 w-44" />
          <USkeleton class="h-3 w-32" />
        </div>
      </div>
      <div class="space-y-2">
        <USkeleton class="h-3 w-full" />
        <USkeleton class="h-3 w-5/6" />
        <USkeleton class="h-3 w-2/3" />
      </div>
      <div class="flex flex-wrap gap-2">
        <USkeleton class="h-6 w-20 rounded-md" />
        <USkeleton class="h-6 w-16 rounded-md" />
        <USkeleton class="h-6 w-24 rounded-md" />
      </div>
    </div>
    <div class="flex-1 min-w-0 space-y-3">
      <USkeleton class="h-4 w-32" />
      <USkeleton class="h-[118px] w-full rounded-2xl" />
      <USkeleton class="h-[118px] w-full rounded-2xl" />
    </div>
  </div>
</template>
