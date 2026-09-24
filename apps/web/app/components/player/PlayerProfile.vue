<script setup lang="ts">
/**
 * Public profile of one player, reached from search results. Mounted by
 * `pages/(app)/players/[id].vue` only once the Convex client is authenticated,
 * so both queries subscribe with a token.
 */
import { h } from "vue";
import { api } from "@tennis-buddy-finder/backend/convex/_generated/api";
import type { Id } from "@tennis-buddy-finder/backend/convex/_generated/dataModel";
import {
  ActionIcon,
  Avatar,
  Badge,
  Button,
  EmptyState,
  Flex,
  Group,
  Menu,
  Modal,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine-vue/core";
import { notifications } from "@mantine-vue/notifications";
import { Icon, NuxtLinkLocale } from "#components";

const props = defineProps<{ userId: Id<"users"> }>();

const { t } = useI18n();
const localePath = useLocalePath();

const {
  data: profile,
  error,
  isPending,
} = useConvexQuery(api.profiles.getByUserId, () => ({ userId: props.userId }), { server: false });
const { data: me } = useConvexQuery(api.users.me, {}, { server: false });

const isMe = computed(() => me.value?.user._id === props.userId);

useSeoMeta({
  title: () => {
    if (profile.value) return t("playerPage.seoTitle", { name: profile.value.displayName });
    return error.value ? t("playerPage.notFoundTitle") : undefined;
  },
});

const meta = computed(() => {
  if (!profile.value) return "";
  return [
    t("playerPage.age", { age: profile.value.age }),
    t(`player.formats.${profile.value.formats}`),
    profile.value.languages.map((code) => code.toUpperCase()).join(" "),
  ].join(" · ");
});

const location = computed(() =>
  profile.value
    ? t("playerPage.location", {
        municipality: profile.value.municipality,
        district: profile.value.district,
      })
    : "",
);

const facts = computed(() => {
  if (!profile.value) return [];
  const { formats, handedness, yearsPlaying, languages } = profile.value;
  return [
    t(`player.formats.${formats}`),
    ...(handedness ? [t(`playerPage.handedness.${handedness}`)] : []),
    t("player.playingYears", yearsPlaying),
    ...languages.map((code) => code.toUpperCase()),
  ];
});

const blockOpen = ref(false);

const { mutate: block, isPending: isBlocking } = useConvexMutation(api.blocks.block);

async function confirmBlock() {
  try {
    await block({ userId: props.userId });
    blockOpen.value = false;
    notifications.show({
      message: t("playerPage.blocked"),
      icon: h(Icon, { name: "lucide:ban", size: 18 }),
    });
    await navigateTo(localePath("/find"));
  } catch {
    notifications.show({ message: t("playerPage.blockError"), color: "red" });
  }
}
</script>

<template>
  <PlayerProfileSkeleton v-if="isPending" />

  <Paper v-else-if="error || !profile" withBorder radius="xl" py="xl">
    <EmptyState
      :title="t('playerPage.notFoundTitle')"
      :description="t('playerPage.notFoundDescription')"
    >
      <template #icon><Icon name="lucide:user-round-x" size="40" /></template>
      <EmptyState.Actions>
        <Button variant="default" :component="NuxtLinkLocale" to="/find">
          <template #leftSection><Icon name="lucide:arrow-left" size="16" /></template>
          {{ t("playerPage.backToFind") }}
        </Button>
      </EmptyState.Actions>
    </EmptyState>
  </Paper>

  <Flex
    v-else
    :direction="{ base: 'column', md: 'row' }"
    :align="{ base: 'stretch', md: 'flex-start' }"
    :gap="{ base: 'md', md: 'lg' }"
  >
    <Paper
      component="section"
      withBorder
      radius="xl"
      p="lg"
      :w="{ base: '100%', md: 320 }"
      :class="$style.identity"
      :aria-label="profile.displayName"
    >
      <Stack gap="md">
        <Group gap="md" align="flex-start" wrap="nowrap">
          <Avatar :size="72" radius="xl" variant="light" color="gray" :alt="profile.displayName">
            {{ profile.displayName.charAt(0) }}
          </Avatar>
          <Stack :gap="4" flex="1" miw="0">
            <Group gap="xs" align="center">
              <Title :order="1" :fz="22" lh="1.2" :class="$style.name">{{
                profile.displayName
              }}</Title>
              <NtrpBadge :rating="profile.ntrp" />
            </Group>
            <Text size="xs" c="dimmed">{{ meta }}</Text>
            <Group :gap="4" align="flex-start" wrap="nowrap" c="dimmed">
              <Icon name="lucide:map-pin" size="14" :class="$style.pin" />
              <Text size="xs" c="dimmed">{{ location }}</Text>
            </Group>
          </Stack>

          <Menu v-if="!isMe" position="bottom-end" shadow="md">
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" :aria-label="t('playerPage.menu')">
                <Icon name="lucide:ellipsis-vertical" size="18" />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item color="red" @click="blockOpen = true">
                <template #leftSection><Icon name="lucide:ban" size="16" /></template>
                {{ t("playerPage.block") }}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>

        <Text v-if="profile.bio" size="sm" maw="65ch" style="white-space: pre-line">
          {{ profile.bio }}
        </Text>

        <Group gap="xs">
          <Badge v-for="fact in facts" :key="fact" variant="light" color="gray">{{ fact }}</Badge>
        </Group>

        <Paper v-if="isMe" radius="md" bg="var(--mantine-color-body)" withBorder p="sm">
          <Group justify="space-between" gap="sm">
            <Text size="xs" c="dimmed">{{ t("playerPage.thisIsYou") }}</Text>
            <Button variant="default" size="xs" :component="NuxtLinkLocale" to="/settings">
              <template #leftSection><Icon name="lucide:pencil" size="14" /></template>
              {{ t("playerPage.editProfile") }}
            </Button>
          </Group>
        </Paper>
      </Stack>
    </Paper>

    <Stack gap="sm" flex="1" miw="0">
      <Title :order="2" :fz="{ base: 14, sm: 15 }">{{ t("playerPage.openSlots") }}</Title>
      <ComingSoon />
    </Stack>

    <Modal
      :opened="blockOpen"
      :title="t('playerPage.blockTitle', { name: profile.displayName })"
      centered
      @close="blockOpen = false"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">{{ t("playerPage.blockDescription") }}</Text>
        <Group justify="flex-end" gap="xs">
          <Button variant="default" :disabled="isBlocking" @click="blockOpen = false">
            {{ t("playerPage.cancel") }}
          </Button>
          <Button color="red" :loading="isBlocking" @click="confirmBlock">
            <template #leftSection><Icon name="lucide:ban" size="16" /></template>
            {{ t("playerPage.blockConfirm") }}
          </Button>
        </Group>
      </Stack>
    </Modal>
  </Flex>
</template>

<style module>
.identity {
  flex-shrink: 0;
}

.name {
  overflow-wrap: anywhere;
}

.pin {
  flex-shrink: 0;
  margin-top: rem(2px);
}
</style>
