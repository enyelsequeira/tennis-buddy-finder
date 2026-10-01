<script setup lang="ts">
import type { Id } from "@tennis-buddy-finder/backend/convex/_generated/dataModel";

const route = useRoute();

// A malformed id is rejected by the query's argument validator and shows the
// same not-found state as a missing profile.
const userId = computed(() => String(route.params.id) as Id<"users">);
</script>

<template>
  <PlayerProfile :user-id="userId" />
</template>
