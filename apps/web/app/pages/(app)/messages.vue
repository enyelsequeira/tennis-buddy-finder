<script setup lang="ts">
import type { Id } from "@tennis-buddy-finder/backend/convex/_generated/dataModel";

/**
 * Messages shell. Desktop: conversation list (320px) beside the thread, both
 * inside one card. Mobile: `/messages` is the list alone and `/messages/[id]`
 * is the thread alone, full screen over the tab bar.
 */
const { t } = useI18n();
const route = useRoute();

useSeoMeta({ title: () => t("pages.messages.title") });

const activeId = computed(() =>
  route.params.id ? (String(route.params.id) as Id<"conversations">) : undefined,
);
</script>

<template>
  <div class="space-y-4">
    <h1
      class="font-display font-bold tracking-[-0.015em] text-[22px] md:text-[26px] text-highlighted"
      :class="{ 'max-md:hidden': activeId }"
    >
      {{ t("pages.messages.title") }}
    </h1>

    <div
      class="md:flex md:h-[calc(100dvh-var(--ui-header-height)-8rem)] md:min-h-112 md:overflow-hidden md:rounded-2xl md:bg-elevated md:ring md:ring-default"
    >
      <aside
        class="flex-col md:flex md:w-80 md:shrink-0 md:border-e md:border-default"
        :class="activeId ? 'hidden' : 'flex'"
      >
        <MessagesConversationList :active-id="activeId" />
      </aside>

      <section class="min-w-0 flex-1 md:flex md:flex-col" :class="activeId ? 'flex' : 'hidden'">
        <NuxtPage />
      </section>
    </div>
  </div>
</template>
