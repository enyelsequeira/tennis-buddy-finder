<script setup lang="ts">
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  SegmentedControl,
  Skeleton,
  Stack,
  Switch,
  Text,
  Title,
  type MantineColorScheme,
} from "@mantine-vue/core";
import { notifications } from "@mantine-vue/notifications";
import { api } from "@tennis-buddy-finder/backend/convex/_generated/api";
import type { Id } from "@tennis-buddy-finder/backend/convex/_generated/dataModel";
import type { ProfileInput } from "@tennis-buddy-finder/backend/convex/model/profileSchema";
import { h } from "vue";
import { Icon, NuxtLinkLocale } from "#components";
import type { SlotPlayer } from "~/types/slots";

/**
 * The data-driven part of `/settings`. Mounted by the page only once
 * `useConvexAuthReady()` is true, so the reactive queries and mutations below
 * run over a Convex client that already holds a token.
 */
const { t } = useI18n();
const { ageFromBirthDate } = useLisbonTime();
const { signOut, isPending: isSigningOut } = useSignOut();
const { scheme, setScheme } = useAppColorScheme();

const { data: me, isPending, error } = useConvexQuery(api.users.me, {}, { server: false });
const { data: blocked, isPending: blockedPending } = useConvexQuery(
  api.blocks.listMine,
  {},
  { server: false },
);

const profile = computed(() => me.value?.profile ?? null);

const player = computed<SlotPlayer | null>(() => {
  if (!me.value?.profile) return null;
  const { profile: p } = me.value;
  return {
    id: me.value.user._id,
    displayName: p.displayName,
    ntrp: p.ntrp,
    age: ageFromBirthDate(p.birthDate),
    yearsPlaying: p.yearsPlaying,
    formats: p.formats,
    languages: p.languages,
  };
});

const location = computed(() =>
  profile.value ? `${profile.value.municipality}, ${profile.value.district}` : undefined,
);

const languageLabel = (code: string) =>
  isProfileLanguage(code) ? t(`onboarding.languageOptions.${code}`) : code.toUpperCase();

const facts = computed(() => {
  const p = profile.value;
  if (!p) return [];
  return [
    t(`onboarding.formatOptions.${p.formats}`),
    ...(p.handedness ? [t(`onboarding.handednessOptions.${p.handedness}`)] : []),
    t("player.playingYears", p.yearsPlaying),
    ...p.languages.map(languageLabel),
  ];
});

const checkIcon = () => h(Icon, { name: "lucide:check", size: 18 });

// Profile edit
const editing = ref(false);
const { mutate: updateProfile, isPending: isSaving } = useConvexMutation(api.profiles.update);

async function onProfileSubmit(input: ProfileInput) {
  if (!profile.value) return;
  try {
    // `bio: ""` (not `undefined`) so clearing the bio is persisted by the patch.
    await updateProfile({ ...input, bio: input.bio ?? "", birthDate: profile.value.birthDate });
    editing.value = false;
    notifications.show({
      message: t("settings.profileUpdated"),
      icon: checkIcon(),
      color: "surround",
    });
    await refreshNuxtData("current-user");
  } catch {
    notifications.show({ message: t("onboarding.errors.generic"), color: "red" });
  }
}

// Email notifications: local copy so the switch answers immediately; the
// live query overwrites it whenever the server value changes.
const emailNotifications = ref(false);
watch(
  () => me.value?.user.emailNotifications,
  (value) => {
    if (value !== undefined) emailNotifications.value = value;
  },
  { immediate: true },
);
const { mutate: setEmailNotifications, isPending: isSavingNotifications } = useConvexMutation(
  api.users.setEmailNotifications,
);

async function onNotificationsChange(enabled: boolean) {
  const previous = emailNotifications.value;
  emailNotifications.value = enabled;
  try {
    await setEmailNotifications({ enabled });
  } catch {
    emailNotifications.value = previous;
    notifications.show({ message: t("settings.saveFailed"), color: "red" });
  }
}

// Appearance
const COLOR_SCHEMES = ["light", "dark", "auto"] as const satisfies readonly MantineColorScheme[];
const schemeItems = computed(() => [
  { value: "light", label: t("settings.theme.light") },
  { value: "dark", label: t("settings.theme.dark") },
  { value: "auto", label: t("settings.theme.system") },
]);

function onSchemeChange(value: string | number) {
  const next = COLOR_SCHEMES.find((scheme) => scheme === value);
  if (next) setScheme(next);
}

// Blocked players
const { mutate: unblock } = useConvexMutation(api.blocks.unblock);
const unblocking = ref<Id<"users"> | null>(null);

async function onUnblock(userId: Id<"users">) {
  unblocking.value = userId;
  try {
    await unblock({ userId });
    notifications.show({ message: t("settings.unblocked"), icon: checkIcon(), color: "surround" });
  } catch {
    notifications.show({ message: t("settings.saveFailed"), color: "red" });
  } finally {
    unblocking.value = null;
  }
}
</script>

<template>
  <Stack gap="md">
    <!-- Profile -->
    <Card with-border radius="xl" padding="lg">
      <Card.Section inherit-padding with-border py="sm">
        <Group justify="space-between" gap="sm" wrap="nowrap">
          <Title :order="2" :fz="15">{{ t("settings.profile") }}</Title>
          <Button v-if="profile" variant="default" size="sm" @click="editing = !editing">
            <template #leftSection>
              <Icon :name="editing ? 'lucide:x' : 'lucide:pencil'" size="16" />
            </template>
            {{ editing ? t("settings.cancelEdit") : t("settings.editProfile") }}
          </Button>
        </Group>
      </Card.Section>

      <Stack v-if="isPending" gap="sm" mt="lg">
        <Group gap="sm" wrap="nowrap">
          <Skeleton :height="48" circle />
          <Stack gap="xs">
            <Skeleton :height="16" :width="160" />
            <Skeleton :height="12" :width="224" />
          </Stack>
        </Group>
        <Skeleton :height="16" />
        <Skeleton :height="16" width="66%" />
      </Stack>

      <Alert
        v-else-if="error"
        color="red"
        variant="light"
        mt="lg"
        :title="t('onboarding.errors.generic')"
      >
        <template #icon><Icon name="lucide:triangle-alert" size="18" /></template>
      </Alert>

      <Box v-else-if="me && profile && player" mt="lg">
        <ProfileForm
          v-if="editing"
          :initial="profile"
          hide-birth-date
          :submit-label="t('settings.saveProfile')"
          :pending="isSaving"
          @submit="onProfileSubmit"
        />

        <Stack v-else gap="md" align="flex-start">
          <PlayerIdentity :player="player" :venue="location" />

          <Group :gap="6">
            <Badge v-for="fact in facts" :key="fact" variant="light" color="gray">
              {{ fact }}
            </Badge>
          </Group>

          <Text v-if="profile.bio" size="sm" maw="65ch" style="white-space: pre-line">
            {{ profile.bio }}
          </Text>

          <Anchor
            :component="NuxtLinkLocale"
            :to="`/players/${me.user._id}`"
            size="sm"
            fw="500"
            display="inline-flex"
            style="align-items: center; gap: 0.25rem"
          >
            {{ t("settings.publicProfile") }}
            <Icon name="lucide:arrow-right" size="16" />
          </Anchor>
        </Stack>
      </Box>
    </Card>

    <!-- Notifications -->
    <Card with-border radius="xl" padding="lg">
      <Card.Section inherit-padding with-border py="sm">
        <Title :order="2" :fz="15">{{ t("settings.notifications") }}</Title>
      </Card.Section>
      <Switch
        mt="lg"
        :model-value="emailNotifications"
        :label="t('settings.emailNotifications')"
        :description="t('settings.emailNotificationsHelp')"
        :disabled="isPending || !!error || isSavingNotifications"
        @update:model-value="onNotificationsChange"
      />
    </Card>

    <!-- Language -->
    <Card with-border radius="xl" padding="lg">
      <Card.Section inherit-padding with-border py="sm">
        <Title :order="2" :fz="15">{{ t("settings.language") }}</Title>
      </Card.Section>
      <Group justify="space-between" gap="sm" mt="lg">
        <Text size="sm" c="dimmed">{{ t("settings.languageHelp") }}</Text>
        <LocaleSwitcher />
      </Group>
    </Card>

    <!-- Appearance -->
    <Card with-border radius="xl" padding="lg">
      <Card.Section inherit-padding with-border py="sm">
        <Title :order="2" :fz="15">{{ t("settings.appearance") }}</Title>
      </Card.Section>
      <SegmentedControl
        mt="lg"
        :w="{ base: '100%', xs: 224 }"
        :model-value="scheme"
        :data="schemeItems"
        @update:model-value="onSchemeChange"
      />
    </Card>

    <!-- Blocked players -->
    <Card with-border radius="xl" padding="lg">
      <Card.Section inherit-padding with-border py="sm">
        <Title :order="2" :fz="15">{{ t("settings.blocked") }}</Title>
      </Card.Section>

      <Stack v-if="blockedPending" gap="xs" mt="lg">
        <Skeleton :height="32" />
        <Skeleton :height="32" />
      </Stack>
      <Text v-else-if="!blocked?.length" size="sm" c="dimmed" mt="lg">
        {{ t("settings.blockedEmpty") }}
      </Text>
      <Stack v-else :gap="0" mt="md">
        <template v-for="(row, index) in blocked" :key="row.userId">
          <Divider v-if="index > 0" />
          <Group justify="space-between" gap="sm" wrap="nowrap" py="xs">
            <Text size="sm" fw="500" truncate>{{ row.displayName }}</Text>
            <Button
              variant="subtle"
              color="gray"
              size="sm"
              :loading="unblocking === row.userId"
              @click="onUnblock(row.userId)"
            >
              {{ t("settings.unblock") }}
            </Button>
          </Group>
        </template>
      </Stack>
    </Card>

    <!-- Account -->
    <Card with-border radius="xl" padding="lg">
      <Card.Section inherit-padding with-border py="sm">
        <Title :order="2" :fz="15">{{ t("settings.account") }}</Title>
      </Card.Section>
      <Group mt="lg">
        <Button variant="default" :loading="isSigningOut" @click="signOut()">
          <template #leftSection><Icon name="lucide:log-out" size="18" /></template>
          {{ t("nav.signOut") }}
        </Button>
      </Group>
    </Card>
  </Stack>
</template>
