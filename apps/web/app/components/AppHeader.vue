<script setup lang="ts">
import {
  Anchor,
  Avatar,
  Box,
  Button,
  Container,
  Group,
  Menu,
  UnstyledButton,
} from "@mantine-vue/core";
import { NuxtLinkLocale } from "#components";

/**
 * Desktop app shell header (`sm` and up): wordmark, the four main sections
 * and the avatar menu with Settings and Sign out. Below `sm` the page title
 * row and `AppTabBar` take over, so the whole header is hidden there.
 */
const { t } = useI18n();
const route = useRoute();
const localePath = useLocalePath();
const { signOut, isPending } = useSignOut();
const { me } = await useCurrentUser();

const isActive = (path: string) => route.path.startsWith(localePath(path));

const items = computed(() => [
  { label: t("nav.find"), to: "/find" },
  { label: t("nav.calendar"), to: "/calendar" },
  { label: t("nav.requests"), to: "/requests" },
  { label: t("nav.messages"), to: "/messages" },
]);

const displayName = computed(() => me.value?.profile?.displayName ?? me.value?.user.name ?? "");
</script>

<template>
  <Box component="header" visibleFrom="sm" :class="$style.header">
    <Container size="72rem" :h="64">
      <Group h="100%" justify="space-between" align="center" wrap="nowrap" gap="md">
        <Anchor
          :component="NuxtLinkLocale"
          to="/find"
          display="inline-flex"
          underline="never"
          bdrs="sm"
          :aria-label="t('app.name')"
        >
          <AppWordmark />
        </Anchor>

        <!-- Active link: court light background + court text, everything else neutral. -->
        <Group component="nav" :gap="4" wrap="nowrap" :aria-label="t('nav.main')">
          <Button
            v-for="item in items"
            :key="item.to"
            :component="NuxtLinkLocale"
            :to="item.to"
            size="sm"
            fw="500"
            :variant="isActive(item.to) ? 'light' : 'subtle'"
            :color="isActive(item.to) ? 'court' : 'gray'"
            :aria-current="isActive(item.to) ? 'page' : undefined"
          >
            {{ item.label }}
          </Button>
        </Group>

        <Group gap="sm" align="center" wrap="nowrap">
          <LocaleSwitcher />
          <Menu position="bottom-end" :width="200" shadow="md">
            <Menu.Target>
              <UnstyledButton :p="4" bdrs="xl" :aria-label="displayName || t('nav.account')">
                <Avatar
                  size="sm"
                  color="court"
                  :name="displayName || undefined"
                  :alt="displayName"
                />
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item :component="NuxtLinkLocale" to="/settings">
                <template #leftSection><Icon name="lucide:settings" size="16" /></template>
                {{ t("nav.settings") }}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item :disabled="isPending" @click="signOut()">
                <template #leftSection><Icon name="lucide:log-out" size="16" /></template>
                {{ t("nav.signOut") }}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>
    </Container>
  </Box>
</template>

<style module>
/* Sticky, translucent elevated surface over the page content. */
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
