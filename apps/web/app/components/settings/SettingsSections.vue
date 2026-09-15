<script setup lang="ts">
import { api } from "@tennis-buddy-finder/backend/convex/_generated/api";
import type { Id } from "@tennis-buddy-finder/backend/convex/_generated/dataModel";
import type { ProfileInput } from "@tennis-buddy-finder/backend/convex/model/profileSchema";
import type { SlotPlayer } from "~/types/slots";

/**
 * The data-driven part of `/settings`. Mounted by the page only once
 * `useConvexAuthReady()` is true, so the reactive queries and mutations below
 * run over a Convex client that already holds a token.
 */
const { t } = useI18n();
const localePath = useLocalePath();
const toast = useToast();
const { ageFromBirthDate } = useLisbonTime();
const { signOut, isPending: isSigningOut } = useSignOut();

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

// Profile edit
const editing = ref(false);
const { mutate: updateProfile, isPending: isSaving } = useConvexMutation(api.profiles.update);

async function onProfileSubmit(input: ProfileInput) {
  if (!profile.value) return;
  try {
    // `bio: ""` (not `undefined`) so clearing the bio is persisted by the patch.
    await updateProfile({ ...input, bio: input.bio ?? "", birthDate: profile.value.birthDate });
    editing.value = false;
    toast.add({ title: t("settings.profileUpdated"), icon: "i-lucide-check" });
    await refreshNuxtData("current-user");
  } catch {
    toast.add({ title: t("onboarding.errors.generic"), color: "error" });
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
    toast.add({ title: t("settings.saveFailed"), color: "error" });
  }
}

// Blocked players
const { mutate: unblock } = useConvexMutation(api.blocks.unblock);
const unblocking = ref<Id<"users"> | null>(null);

async function onUnblock(userId: Id<"users">) {
  unblocking.value = userId;
  try {
    await unblock({ userId });
    toast.add({ title: t("settings.unblocked"), icon: "i-lucide-check" });
  } catch {
    toast.add({ title: t("settings.saveFailed"), color: "error" });
  } finally {
    unblocking.value = null;
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Profile -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <h2 class="font-display font-bold text-[15px] text-highlighted">
            {{ t("settings.profile") }}
          </h2>
          <UButton
            v-if="profile"
            :label="editing ? t('settings.cancelEdit') : t('settings.editProfile')"
            :icon="editing ? 'i-lucide-x' : 'i-lucide-pencil'"
            color="neutral"
            variant="outline"
            size="sm"
            @click="editing = !editing"
          />
        </div>
      </template>

      <div v-if="isPending" class="space-y-3">
        <div class="flex items-center gap-3">
          <USkeleton class="size-12 rounded-full" />
          <div class="space-y-2">
            <USkeleton class="h-4 w-40" />
            <USkeleton class="h-3 w-56" />
          </div>
        </div>
        <USkeleton class="h-4 w-full" />
        <USkeleton class="h-4 w-2/3" />
      </div>

      <UAlert
        v-else-if="error"
        color="error"
        variant="soft"
        icon="i-lucide-triangle-alert"
        :title="t('onboarding.errors.generic')"
      />

      <template v-else-if="me && profile && player">
        <ProfileForm
          v-if="editing"
          :initial="profile"
          hide-birth-date
          :submit-label="t('settings.saveProfile')"
          :pending="isSaving"
          @submit="onProfileSubmit"
        />

        <div v-else class="space-y-4">
          <PlayerIdentity :player="player" :venue="location" />

          <div class="flex flex-wrap gap-1.5">
            <UBadge v-for="fact in facts" :key="fact" color="neutral" variant="soft">
              {{ fact }}
            </UBadge>
          </div>

          <p v-if="profile.bio" class="text-sm text-default max-w-prose whitespace-pre-line">
            {{ profile.bio }}
          </p>

          <ULink
            :to="localePath(`/players/${me.user._id}`)"
            class="inline-flex items-center gap-1 text-sm font-medium text-primary"
          >
            {{ t("settings.publicProfile") }}
            <UIcon name="i-lucide-arrow-right" class="size-4" />
          </ULink>
        </div>
      </template>
    </UCard>

    <!-- Notifications -->
    <UCard>
      <template #header>
        <h2 class="font-display font-bold text-[15px] text-highlighted">
          {{ t("settings.notifications") }}
        </h2>
      </template>
      <USwitch
        :model-value="emailNotifications"
        :label="t('settings.emailNotifications')"
        :description="t('settings.emailNotificationsHelp')"
        :disabled="isPending || !!error"
        :loading="isSavingNotifications"
        @update:model-value="onNotificationsChange"
      />
    </UCard>

    <!-- Language -->
    <UCard>
      <template #header>
        <h2 class="font-display font-bold text-[15px] text-highlighted">
          {{ t("settings.language") }}
        </h2>
      </template>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm text-muted">{{ t("settings.languageHelp") }}</p>
        <LocaleSwitcher />
      </div>
    </UCard>

    <!-- Appearance -->
    <UCard>
      <template #header>
        <h2 class="font-display font-bold text-[15px] text-highlighted">
          {{ t("settings.appearance") }}
        </h2>
      </template>
      <UColorModeSelect color="neutral" class="w-full sm:w-56" />
    </UCard>

    <!-- Blocked players -->
    <UCard>
      <template #header>
        <h2 class="font-display font-bold text-[15px] text-highlighted">
          {{ t("settings.blocked") }}
        </h2>
      </template>

      <div v-if="blockedPending" class="space-y-2">
        <USkeleton class="h-8 w-full" />
        <USkeleton class="h-8 w-full" />
      </div>
      <p v-else-if="!blocked?.length" class="text-sm text-muted">
        {{ t("settings.blockedEmpty") }}
      </p>
      <ul v-else class="divide-y divide-default">
        <li
          v-for="row in blocked"
          :key="row.userId"
          class="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
        >
          <span class="text-sm font-medium text-highlighted truncate">{{ row.displayName }}</span>
          <UButton
            :label="t('settings.unblock')"
            color="neutral"
            variant="ghost"
            size="sm"
            :loading="unblocking === row.userId"
            @click="onUnblock(row.userId)"
          />
        </li>
      </ul>
    </UCard>

    <!-- Account -->
    <UCard>
      <template #header>
        <h2 class="font-display font-bold text-[15px] text-highlighted">
          {{ t("settings.account") }}
        </h2>
      </template>
      <UButton
        :label="t('nav.signOut')"
        icon="i-lucide-log-out"
        color="neutral"
        variant="outline"
        :loading="isSigningOut"
        @click="signOut()"
      />
    </UCard>
  </div>
</template>
