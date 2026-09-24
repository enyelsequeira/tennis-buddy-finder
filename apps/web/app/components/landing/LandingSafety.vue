<script setup lang="ts">
import { Container, SimpleGrid, Stack, Text, ThemeIcon, Title } from "@mantine-vue/core";

const { t } = useI18n();

const ICONS = {
  verified: "lucide:shield-check",
  noPhone: "lucide:phone-off",
  block: "lucide:ban",
  adults: "lucide:id-card",
} as const;

const ITEM_KEYS = Object.keys(ICONS) as Array<keyof typeof ICONS>;
</script>

<template>
  <Container
    id="safety"
    component="section"
    size="72rem"
    :py="{ base: 64, xs: 80, md: 96 }"
    style="scroll-margin-top: 4rem"
  >
    <Stack gap="md" align="center">
      <Title :order="2" :fz="{ base: 30, xs: 36, md: 48 }" ta="center" textWrap="balance">
        {{ t("safety.title") }}
      </Title>
      <Text :fz="{ base: 'md', xs: 'lg' }" c="dimmed" ta="center" maw="65ch">
        {{ t("safety.description") }}
      </Text>
    </Stack>

    <SimpleGrid
      :cols="{ base: 1, xs: 2, md: 4 }"
      :spacing="{ base: 'xl', md: 32 }"
      :mt="{ base: 40, md: 48 }"
    >
      <Stack v-for="key in ITEM_KEYS" :key="key" gap="sm" align="flex-start">
        <ThemeIcon variant="light" color="surround" size="lg" radius="md">
          <Icon :name="ICONS[key]" size="20" aria-hidden="true" />
        </ThemeIcon>
        <Title :order="3" ff="text" fw="600" fz="md">
          {{ t(`safety.items.${key}.title`) }}
        </Title>
        <Text :fz="15" c="dimmed">{{ t(`safety.items.${key}.description`) }}</Text>
      </Stack>
    </SimpleGrid>
  </Container>
</template>
