<script setup lang="ts">
import { Box, Container, Group, Paper, SimpleGrid, Stack, Text, Title } from "@mantine-vue/core";

const { t } = useI18n();

// Translation keys cannot contain dots, so the rating is carried separately.
const LEVELS = [
  { rating: 2.5, key: "ntrp25" },
  { rating: 3.0, key: "ntrp30" },
  { rating: 3.5, key: "ntrp35" },
  { rating: 4.0, key: "ntrp40" },
  { rating: 4.5, key: "ntrp45" },
  { rating: 5.0, key: "ntrp50" },
] as const;
</script>

<template>
  <Container
    id="your-level"
    component="section"
    size="72rem"
    :py="{ base: 64, xs: 80, md: 96 }"
    style="scroll-margin-top: 4rem"
  >
    <SimpleGrid :cols="{ base: 1, md: 2 }" :spacing="{ base: 32, xs: 64 }">
      <Stack gap="md" justify="center">
        <Title :order="2" :fz="{ base: 30, xs: 36, md: 48 }" textWrap="balance">
          {{ t("levels.title") }}
        </Title>
        <Text :fz="{ base: 'md', xs: 'lg' }" c="dimmed" maw="65ch">
          {{ t("levels.description") }}
        </Text>
      </Stack>

      <Paper component="dl" withBorder radius="xl" m="0">
        <Group
          v-for="level in LEVELS"
          :key="level.key"
          :class="$style.row"
          align="flex-start"
          gap="md"
          wrap="nowrap"
          px="lg"
          :py="14"
        >
          <Box component="dt" flex="0 0 auto" :pt="2">
            <NtrpBadge :rating="level.rating" />
          </Box>
          <Text component="dd" size="sm" m="0">{{ t(`levels.items.${level.key}`) }}</Text>
        </Group>
      </Paper>
    </SimpleGrid>
  </Container>
</template>

<style module>
/* Hairline between rows; a sibling selector is the one thing props cannot express. */
.row + .row {
  border-top: 1px solid var(--mantine-color-default-border);
}
</style>
