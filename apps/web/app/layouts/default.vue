<script setup lang="ts">
/**
 * App shell for signed-in, onboarded pages: `AppHeader` from `md` up and
 * `AppTabBar` below it. The bottom padding keeps content clear of the tab bar.
 */
</script>

<template>
  <div class="min-h-screen bg-default">
    <AppHeader />
    <UMain>
      <UContainer class="pb-24 pt-4 md:pb-8 md:pt-8">
        <slot />
      </UContainer>
    </UMain>
    <AppTabBar />
  </div>
</template>
