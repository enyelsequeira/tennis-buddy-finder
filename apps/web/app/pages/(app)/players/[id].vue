<script setup lang="ts">
import type { Id } from "@tennis-buddy-finder/backend/convex/_generated/dataModel";

definePageMeta({ middleware: ["auth", "onboarded"] });

const route = useRoute();
const ready = useConvexAuthReady();

// A malformed id is rejected by the query's argument validator and shows the
// same not-found state as a missing profile.
const userId = computed(() => String(route.params.id) as Id<"users">);
</script>

<template>
  <PlayerProfile v-if="ready" :user-id="userId" />
  <PlayerProfileSkeleton v-else />
</template>
