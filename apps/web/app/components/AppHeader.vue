<script setup lang="ts">
import type { DropdownMenuItem, NavigationMenuItem } from "@nuxt/ui";

const { t } = useI18n();
const route = useRoute();
const localePath = useLocalePath();
const { signOut, isPending } = useSignOut();
const { unreadRequestCount, unreadMessageCount } = useUnreadNotifications();
const { me } = await useCurrentUser();

const isActive = (path: string) => route.path.startsWith(localePath(path));

const items = computed<NavigationMenuItem[]>(() => [
  { label: t("nav.find"), to: localePath("/find"), active: isActive("/find") },
  { label: t("nav.calendar"), to: localePath("/calendar"), active: isActive("/calendar") },
  {
    label: t("nav.requests"),
    to: localePath("/requests"),
    active: isActive("/requests"),
    slot: unreadRequestCount.value ? "unread" : undefined,
    unread: unreadRequestCount.value,
  },
  {
    label: t("nav.messages"),
    to: localePath("/messages"),
    active: isActive("/messages"),
    slot: unreadMessageCount.value ? "unread" : undefined,
    unread: unreadMessageCount.value,
  },
]);

const menu = computed<DropdownMenuItem[][]>(() => [
  [{ label: t("nav.settings"), icon: "i-lucide-settings", to: localePath("/settings") }],
  [
    {
      label: t("nav.signOut"),
      icon: "i-lucide-log-out",
      disabled: isPending.value,
      onSelect: () => signOut(),
    },
  ],
]);

const displayName = computed(() => me.value?.profile?.displayName ?? me.value?.user.name ?? "");
</script>

<template>
  <UHeader
    :to="localePath('/find')"
    :title="t('app.name')"
    :toggle="false"
    :ui="{ root: 'hidden md:block bg-elevated/90', center: 'flex' }"
  >
    <template #title>
      <AppWordmark />
    </template>

    <UNavigationMenu
      :items="items"
      :ui="{ link: 'data-[active=true]:bg-primary/10 data-[active=true]:text-primary' }"
    >
      <template #unread-trailing="{ index }">
        <UChip
          standalone
          color="warning"
          size="3xl"
          aria-hidden="true"
          :text="unreadBadge(items[index]?.unread)"
          :ui="{ base: 'px-1' }"
        />
        <span class="sr-only">{{
          t("notifications.unread", { count: items[index]?.unread })
        }}</span>
      </template>
    </UNavigationMenu>

    <template #right>
      <LocaleSwitcher class="hidden lg:flex" />
      <UButton
        :to="localePath('/calendar')"
        color="secondary"
        icon="i-lucide-plus"
        :label="t('nav.addAvailability')"
        :aria-label="t('nav.addAvailability')"
        :ui="{ label: 'hidden lg:inline' }"
      />
      <NotificationBell />
      <UDropdownMenu :items="menu">
        <UButton color="neutral" variant="ghost" :aria-label="displayName || t('nav.account')">
          <UAvatar :alt="displayName" :text="avatarInitial(displayName)" size="sm" />
        </UButton>
      </UDropdownMenu>
    </template>
  </UHeader>
</template>
