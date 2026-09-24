<script setup lang="ts">
import {
  Anchor,
  Box,
  Burger,
  Button,
  Container,
  Divider,
  Drawer,
  Group,
  NavLink,
  Stack,
} from "@mantine-vue/core";
import { useDisclosure } from "@mantine-vue/hooks";
import { NuxtLinkLocale } from "#components";

const { t } = useI18n();
const route = useRoute();
const [opened, { toggle, close }] = useDisclosure(false);

// Anchor items are never "active": they match "/" and would all light up at once.
const items = computed(() => [
  { label: t("nav.howItWorks"), to: "/#how-it-works" },
  { label: t("nav.yourLevel"), to: "/#your-level" },
  { label: t("nav.safety"), to: "/#safety" },
  { label: t("nav.demo"), to: "/demo", icon: "lucide:flask-conical" },
]);

// Close the mobile menu on every navigation, hash jumps on the landing page included.
watch(() => route.fullPath, close);

const LinkButton = Button.withProps({
  component: NuxtLinkLocale,
  variant: "subtle",
});
</script>

<template>
  <Box component="header">
    <Container size="72rem" :h="64">
      <Group h="100%" justify="space-between" align="center" wrap="nowrap" gap="md">
        <LinkButton
          :component="NuxtLinkLocale"
          to="/"
          display="inline-flex"
          underline="never"
          bdrs="sm"
          :aria-label="t('app.name')"
        >
          <AppWordmark />
        </LinkButton>

        <Group component="nav" :gap="4" wrap="nowrap" visibleFrom="sm" :aria-label="t('nav.main')">
          <LinkButton
            v-for="item in items"
            :key="item.to"
            :to="item.to"
            size="sm"
            fw="500"
            variant="subtle"
            color="gray"
          >
            <template v-if="item.icon" #leftSection><Icon :name="item.icon" size="16" /></template>
            {{ item.label }}
          </LinkButton>
        </Group>

        <Group gap="sm" align="center" wrap="nowrap" visibleFrom="sm">
          <LocaleSwitcher />
          <LinkButton to="/login" variant="subtle" color="gray">
            {{ t("nav.signIn") }}
          </LinkButton>
          <LinkButton to="/register" variant="light">
            {{ t("nav.createAccount") }}
          </LinkButton>
        </Group>

        <Burger
          hiddenFrom="sm"
          size="sm"
          :opened="opened"
          :aria-label="opened ? t('nav.closeMenu') : t('nav.openMenu')"
          @click="toggle"
        />
      </Group>
    </Container>

    <Drawer
      :opened="opened"
      position="right"
      size="xs"
      :close-button-props="{ 'aria-label': t('nav.closeMenu') }"
      @close="close"
    >
      <template #title>
        <AppWordmark />
      </template>

      <Stack component="nav" :gap="4" :aria-label="t('nav.main')">
        <NavLink
          v-for="item in items"
          :key="item.to"
          :component="NuxtLinkLocale"
          :to="item.to"
          :label="item.label"
          bdrs="md"
          fw="500"
          @click="close"
        >
          <template v-if="item.icon" #leftSection><Icon :name="item.icon" size="18" /></template>
        </NavLink>
      </Stack>

      <Divider my="md" />

      <Stack gap="xs">
        <LinkButton to="/register" fullWidth variant="default">
          {{ t("nav.createAccount") }}
        </LinkButton>
        <LinkButton to="/login" variant="default" fullWidth>
          {{ t("nav.signIn") }}
        </LinkButton>
      </Stack>

      <Divider my="md" />

      <LocaleSwitcher />
    </Drawer>
  </Box>
</template>

<style module>
/* Sticky, translucent elevated surface over the marketing sections. */
.header {
  position: sticky;
  top: 0;
  z-index: 50;
  border-bottom: 1px solid var(--mantine-color-default-border);
  background-color: color-mix(in srgb, var(--app-color-elevated) 90%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
</style>
