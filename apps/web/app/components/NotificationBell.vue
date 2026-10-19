<script setup lang="ts">
import { api } from "@tennis-buddy-finder/backend/convex/_generated/api";
import type { Doc } from "@tennis-buddy-finder/backend/convex/_generated/dataModel";
import { breakpointsTailwind } from "@vueuse/core";

const ICONS = {
  request_received: "i-lucide-inbox",
  request_accepted: "i-lucide-check",
  request_declined: "i-lucide-x",
  new_message: "i-lucide-message-circle",
} satisfies Record<Doc<"notifications">["type"], string>;

const { t } = useI18n();
const { formatShortDay, formatTime } = useLisbonTime();
const { unread, error } = useUnreadNotifications();
const { mutate: markAllRead } = useConvexMutation(api.notifications.markAllRead);

const isDesktop = useBreakpoints(breakpointsTailwind).greaterOrEqual("md");
const reducedMotion = usePreferredReducedMotion();
const [DefineRows, ReuseRows] = createReusableTemplate();

/** Message and acceptance notifications open the chat; request ones open the inbox. */
function linkFor(row: Doc<"notifications">) {
  if (row.conversationId && (row.type === "new_message" || row.type === "request_accepted")) {
    return `/messages/${row.conversationId}`;
  }
  return row.type === "new_message" ? "/messages" : "/requests";
}

const open = ref(false);
const rows = shallowRef<Doc<"notifications">[]>();

// Marking them read empties the live query, so the panel keeps the list it opened with
// (taken on the first result when it opens before the query has loaded).
watch([open, unread], async ([isOpen, list], [wasOpen]) => {
  if (!isOpen || (wasOpen && rows.value)) return;
  rows.value = list;
  if (list?.length) await markAllRead({});
});
</script>

<template>
  <div>
    <DefineRows>
      <UAlert
        v-if="!rows && error"
        color="error"
        variant="soft"
        icon="i-lucide-triangle-alert"
        :title="t('notifications.loadError')"
      />

      <div v-else-if="!rows" class="space-y-2">
        <USkeleton class="h-11 w-full" />
        <USkeleton class="h-11 w-full" />
      </div>

      <p v-else-if="!rows.length" class="text-sm text-muted">{{ t("notifications.empty") }}</p>

      <ul v-else class="divide-y divide-default">
        <li v-for="row in rows" :key="row._id">
          <ULink
            :to="linkFor(row)"
            class="flex items-start gap-3 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            @click="open = false"
          >
            <UIcon :name="ICONS[row.type]" class="mt-0.5 size-4 shrink-0 text-muted" />
            <span class="min-w-0">
              <span class="block text-sm text-highlighted">
                {{ t(`notifications.types.${row.type}`) }}
              </span>
              <span class="block text-xs text-muted">
                {{ formatShortDay(row._creationTime) }}, {{ formatTime(row._creationTime) }}
              </span>
            </span>
          </ULink>
        </li>
      </ul>
    </DefineRows>

    <UPopover
      :open="open && isDesktop"
      :content="{ align: 'end' }"
      :ui="{ content: 'w-80 max-h-[70dvh] overflow-y-auto rounded-2xl p-4 shadow-xl' }"
      @update:open="open = $event"
    >
      <UButton
        color="neutral"
        variant="ghost"
        class="size-11 justify-center"
        :aria-label="unread?.length ? t('notifications.titleUnread') : t('notifications.title')"
      >
        <UChip color="warning" :show="!!unread?.length">
          <UIcon name="i-lucide-bell" class="size-5" />
        </UChip>
      </UButton>

      <template #content>
        <h2 class="mb-1 font-display font-bold text-[15px] text-highlighted">
          {{ t("notifications.title") }}
        </h2>
        <ReuseRows />
      </template>
    </UPopover>

    <USlideover
      :open="open && !isDesktop"
      side="bottom"
      :title="t('notifications.title')"
      :transition="reducedMotion !== 'reduce'"
      :ui="{
        content: 'max-h-[85dvh] rounded-t-2xl shadow-xl',
        title: 'font-display font-bold text-[15px]',
      }"
      @update:open="open = $event"
    >
      <template #body>
        <ReuseRows />
      </template>
    </USlideover>
  </div>
</template>
