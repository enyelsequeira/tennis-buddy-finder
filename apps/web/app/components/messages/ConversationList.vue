<script setup lang="ts">
import { api } from "@tennis-buddy-finder/backend/convex/_generated/api";
import type { Id } from "@tennis-buddy-finder/backend/convex/_generated/dataModel";

defineProps<{ activeId?: Id<"conversations"> }>();

const { t } = useI18n();
const localePath = useLocalePath();
const { data: conversations, error, isPending } = useAuthedQuery(api.conversations.list);
</script>

<template>
  <nav class="flex min-h-0 flex-1 flex-col" :aria-label="t('chat.listLabel')">
    <div v-if="isPending" class="space-y-1 p-2">
      <div v-for="n in 4" :key="n" class="flex items-center gap-3 px-3 py-3">
        <USkeleton class="size-10 shrink-0 rounded-full" />
        <div class="flex-1 space-y-2">
          <USkeleton class="h-3.5 w-1/2" />
          <USkeleton class="h-3 w-3/4" />
        </div>
      </div>
    </div>

    <UAlert
      v-else-if="error"
      class="m-2"
      color="error"
      variant="soft"
      icon="i-lucide-triangle-alert"
      :title="t('chat.loadError')"
    />

    <ul v-else-if="conversations?.length" class="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
      <li v-for="conversation in conversations" :key="conversation.conversationId">
        <MessagesConversationRow
          :conversation="
            conversation.conversationId === activeId
              ? { ...conversation, unreadCount: 0 }
              : conversation
          "
          :active="conversation.conversationId === activeId"
        />
      </li>
    </ul>

    <UEmpty
      v-else
      icon="i-lucide-message-circle"
      :title="t('chat.emptyTitle')"
      :description="t('chat.emptyDescription')"
      :actions="[
        {
          label: t('chat.emptyAction'),
          icon: 'i-lucide-search',
          color: 'neutral',
          variant: 'outline',
          to: localePath('/find'),
        },
      ]"
      :ui="{ root: 'py-16' }"
    />
  </nav>
</template>
