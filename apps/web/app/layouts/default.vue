<script setup lang="ts">
import { Box, Container } from "@mantine-vue/core";

/**
 * App shell for signed-in, onboarded pages: `AppHeader` from `sm` up and
 * `AppTabBar` below it. The bottom padding keeps content clear of the tab bar.
 */
</script>

<template>
  <Box mih="100vh">
    <AppHeader />
    <Box component="main">
      <Container size="72rem" :pt="{ base: 'md', sm: 'xl' }" :pb="{ base: 96, sm: 'xl' }">
        <slot />
      </Container>
    </Box>
    <AppTabBar />
  </Box>
</template>
