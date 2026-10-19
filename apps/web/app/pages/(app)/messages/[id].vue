<script setup lang="ts">
import type { Id } from "@tennis-buddy-finder/backend/convex/_generated/dataModel";

const route = useRoute();

// A malformed id is rejected by the query's argument validator and shows the
// same not-found state as a conversation the user is not part of.
const conversationId = computed(() => String(route.params.id) as Id<"conversations">);
</script>

<template>
  <!-- Below md the thread covers the whole screen, tab bar included. -->
  <div class="fixed inset-0 z-50 flex flex-col bg-default md:static md:z-auto md:h-full md:flex-1">
    <MessagesChatThread :key="conversationId" :conversation-id="conversationId" />
  </div>
</template>
