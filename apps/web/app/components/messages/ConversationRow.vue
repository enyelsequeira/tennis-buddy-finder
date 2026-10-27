<script setup lang="ts">
import { api } from "@tennis-buddy-finder/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

const props = defineProps<{
  conversation: FunctionReturnType<typeof api.conversations.list>[number];
  active?: boolean;
}>();

const { t } = useI18n();
const localePath = useLocalePath();
const { formatStamp } = useLisbonTime();

const name = computed(() => props.conversation.player?.displayName ?? t("chat.deletedPlayer"));
const unread = computed(() => props.conversation.unreadCount);

const preview = computed(() => {
  const last = props.conversation.lastMessage;
  if (!last) return t("chat.noMessagesYet");
  // An empty body is a message whose sender deleted their account.
  return last.mine ? t("chat.you", { body: last.body }) : last.body || t("chat.messageDeleted");
});

const stamp = computed(() =>
  formatStamp(props.conversation.lastMessage?.sentAt ?? props.conversation.lastMessageAt),
);
</script>

<template>
  <ULink
    :to="localePath(`/messages/${conversation.conversationId}`)"
    raw
    class="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-default focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
    :class="active ? 'bg-primary/10 hover:bg-primary/10' : ''"
    :aria-current="active ? 'page' : undefined"
  >
    <UAvatar
      :alt="name"
      :text="avatarInitial(name)"
      size="lg"
      class="shrink-0 bg-accented"
      :ui="{ fallback: 'text-muted font-semibold' }"
    />
    <span class="min-w-0 flex-1">
      <span class="flex items-center gap-2">
        <span
          class="truncate text-sm text-highlighted"
          :class="unread ? 'font-semibold' : 'font-medium'"
        >
          {{ name }}
        </span>
        <NtrpBadge v-if="conversation.player" :rating="conversation.player.ntrp" />
        <span class="ms-auto shrink-0 text-[11px] text-dimmed">{{ stamp }}</span>
      </span>
      <span class="mt-0.5 flex items-center gap-2">
        <span class="truncate text-xs" :class="unread ? 'text-default' : 'text-muted'">
          {{ preview }}
        </span>
        <UBadge
          v-if="unread"
          :label="unreadBadge(unread)"
          color="primary"
          size="sm"
          class="ms-auto shrink-0 rounded-full"
          :aria-label="t('chat.unreadCount', unread)"
        />
      </span>
    </span>
  </ULink>
</template>
