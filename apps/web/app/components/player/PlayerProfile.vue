<script setup lang="ts">
/**
 * Public profile of one player, reached from search results. Mounted by
 * `pages/(app)/players/[id].vue` only once the Convex client is authenticated,
 * so both queries subscribe with a token.
 */
import { api } from "@tennis-buddy-finder/backend/convex/_generated/api";
import type { Id } from "@tennis-buddy-finder/backend/convex/_generated/dataModel";
import type { DropdownMenuItem } from "@nuxt/ui";

const props = defineProps<{ userId: Id<"users"> }>();

const { t } = useI18n();
const localePath = useLocalePath();
const toast = useToast();

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

const menu = computed<DropdownMenuItem[]>(() => [
  {
    label: t("playerPage.block"),
    icon: "i-lucide-ban",
    color: "error",
    onSelect: () => {
      blockOpen.value = true;
    },
  },
]);

const { mutate: block, isPending: isBlocking } = useConvexMutation(api.blocks.block);

async function confirmBlock() {
  try {
    await block({ userId: props.userId });
    blockOpen.value = false;
    toast.add({ title: t("playerPage.blocked"), icon: "i-lucide-ban" });
    await navigateTo(localePath("/find"));
  } catch {
    toast.add({ title: t("playerPage.blockError"), color: "error" });
  }
}
</script>

<template>
  <PlayerProfileSkeleton v-if="isPending" />

  <UEmpty
    v-else-if="error || !profile"
    icon="i-lucide-user-round-x"
    :title="t('playerPage.notFoundTitle')"
    :description="t('playerPage.notFoundDescription')"
    :actions="[
      {
        label: t('playerPage.backToFind'),
        icon: 'i-lucide-arrow-left',
        color: 'neutral',
        variant: 'outline',
        to: localePath('/find'),
      },
    ]"
    :ui="{ root: 'py-16 rounded-2xl bg-elevated ring ring-default' }"
  />

  <div v-else class="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
    <section
      class="rounded-2xl bg-elevated ring ring-default p-5 space-y-4 lg:w-80 lg:shrink-0"
      :aria-label="profile.displayName"
    >
      <div class="flex items-start gap-4">
        <UAvatar
          :alt="profile.displayName"
          :text="profile.displayName.charAt(0)"
          class="shrink-0 bg-accented"
          :ui="{ root: 'size-18 text-3xl', fallback: 'text-muted font-semibold' }"
        />
        <div class="min-w-0 flex-1 space-y-1">
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1
              class="font-display font-bold text-[22px] leading-tight text-highlighted break-words"
            >
              {{ profile.displayName }}
            </h1>
            <NtrpBadge :rating="profile.ntrp" />
          </div>
          <p class="text-xs text-muted">{{ meta }}</p>
          <p class="text-xs text-muted flex items-start gap-1">
            <UIcon name="i-lucide-map-pin" class="size-3.5 shrink-0 mt-0.5" />
            <span>{{ location }}</span>
          </p>
        </div>

        <UDropdownMenu v-if="!isMe" :items="menu" :content="{ align: 'end' }">
          <UButton
            icon="i-lucide-ellipsis-vertical"
            color="neutral"
            variant="ghost"
            :aria-label="t('playerPage.menu')"
          />
        </UDropdownMenu>
      </div>

      <p v-if="profile.bio" class="text-sm text-default max-w-prose whitespace-pre-line">
        {{ profile.bio }}
      </p>

      <ul class="flex flex-wrap gap-2">
        <li v-for="fact in facts" :key="fact">
          <UBadge color="neutral" variant="subtle" :label="fact" />
        </li>
      </ul>

      <div
        v-if="isMe"
        class="rounded-lg bg-default ring ring-default p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <p class="text-xs text-muted">{{ t("playerPage.thisIsYou") }}</p>
        <UButton
          :label="t('playerPage.editProfile')"
          icon="i-lucide-pencil"
          color="neutral"
          variant="outline"
          size="sm"
          to="/settings"
          class="shrink-0"
        />
      </div>
    </section>

    <div class="flex-1 min-w-0 space-y-3">
      <h2 class="font-display font-bold text-sm md:text-[15px] text-highlighted">
        {{ t("playerPage.openSlots") }}
      </h2>
      <ComingSoon />
    </div>

    <UModal
      v-model:open="blockOpen"
      :title="t('playerPage.blockTitle', { name: profile.displayName })"
      :description="t('playerPage.blockDescription')"
    >
      <template #footer="{ close }">
        <div class="flex w-full justify-end gap-2">
          <UButton
            :label="t('playerPage.cancel')"
            color="neutral"
            variant="outline"
            :disabled="isBlocking"
            @click="close"
          />
          <UButton
            :label="t('playerPage.blockConfirm')"
            icon="i-lucide-ban"
            color="error"
            :loading="isBlocking"
            @click="confirmBlock"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
