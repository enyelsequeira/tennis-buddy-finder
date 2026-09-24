<script setup lang="ts">
import { Anchor, Box, Container, Flex, Group, Text } from "@mantine-vue/core";
import { NuxtLinkLocale } from "#components";

const { t } = useI18n();
const { now, formatYear } = useLisbonTime();

const items = computed(() => [
  { label: t("nav.howItWorks"), to: "/#how-it-works" },
  { label: t("nav.yourLevel"), to: "/#your-level" },
  { label: t("nav.safety"), to: "/#safety" },
  { label: t("nav.signIn"), to: "/login" },
]);

const year = formatYear(now());
</script>

<template>
  <Box component="footer" :class="$style.footer">
    <Container size="72rem" py="xl">
      <!-- Stacked and centred on small screens, one row from `md` up. -->
      <Flex
        :direction="{ base: 'column', md: 'row' }"
        align="center"
        justify="space-between"
        gap="lg"
      >
        <Flex direction="column" :align="{ base: 'center', md: 'flex-start' }" :gap="4">
          <AppWordmark />
          <Text size="sm" c="dimmed">{{ t("app.location") }}</Text>
        </Flex>

        <Group component="nav" gap="lg" justify="center">
          <Anchor
            v-for="item in items"
            :key="item.to"
            :component="NuxtLinkLocale"
            :to="item.to"
            size="sm"
            fw="500"
            c="dimmed"
          >
            {{ item.label }}
          </Anchor>
        </Group>

        <Text size="sm" c="dimmed">{{ t("footer.copyright", { year }) }}</Text>
      </Flex>
    </Container>
  </Box>
</template>

<style module>
.footer {
  border-top: 1px solid var(--mantine-color-default-border);
  background-color: var(--app-color-elevated);
}
</style>
