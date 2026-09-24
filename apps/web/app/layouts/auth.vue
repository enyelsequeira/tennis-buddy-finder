<script setup lang="ts">
import { Anchor, Box, Flex } from "@mantine-vue/core";
import { NuxtLinkLocale } from "#components";

const { t } = useI18n();
const route = useRoute();
const column = computed(() => (route.meta.authWide ? 560 : 400));
</script>

<template>
  <Box :class="$style.shell">
    <!-- Grid wrapper so the showcase stretches to the full column height. -->
    <Box visibleFrom="md" display="grid">
      <AuthShowcase />
    </Box>

    <Flex direction="column" mih="100vh" :px="{ base: 'md', sm: 28 }">
      <Flex
        direction="column"
        flex="1"
        w="100%"
        mx="auto"
        :maw="column"
        :py="{ base: 'xl', sm: 48 }"
        :justify="{ base: 'flex-start', md: 'center' }"
      >
        <Flex component="header" mb="xl" :justify="{ base: 'center', md: 'flex-start' }">
          <Anchor
            :component="NuxtLinkLocale"
            to="/"
            display="inline-flex"
            underline="never"
            bdrs="sm"
            :aria-label="t('app.name')"
          >
            <AppWordmark size="lg" />
          </Anchor>
        </Flex>

        <Box component="main">
          <slot />
        </Box>

        <Flex component="footer" mt="xl" :justify="{ base: 'center', md: 'flex-start' }">
          <LocaleSwitcher />
        </Flex>
      </Flex>
    </Flex>
  </Box>
</template>

<style module>
/* One column until `md`, then the showcase and the form side by side. */
.shell {
  display: grid;
  min-height: 100vh;
}

@media (min-width: $mantine-breakpoint-md) {
  .shell {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
