<script setup lang="ts">
import type { TabsItem } from "@nuxt/ui";
import { api } from "@tennis-buddy-finder/backend/convex/_generated/api";

const { t } = useI18n();

useSeoMeta({ title: () => t("pages.requests.title") });

const tab = ref<string | number>("received");
const isSent = computed(() => tab.value === "sent");

const received = useAuthedQuery(api.matchRequests.received);
const sent = useAuthedQuery(api.matchRequests.sent);
const { data: venues } = useAuthedQuery(api.venues.list);

const query = computed(() => (isSent.value ? sent : received));
const isPending = computed(() => query.value.isPending.value);
const error = computed(() => query.value.error.value);

const isWaiting = (status: string) => status === "pending";

// Both lists arrive newest first; the stable sort only lifts the waiting ones to the top.
const views = computed(() =>
  [...(query.value.data.value ?? [])].sort(
    (a, b) => Number(isWaiting(b.request.status)) - Number(isWaiting(a.request.status)),
  ),
);

const waitingCount = computed(
  () => received.data.value?.filter(({ request }) => isWaiting(request.status)).length ?? 0,
);

const tabs = computed<TabsItem[]>(() => [
  {
    value: "received",
    label: waitingCount.value
      ? t("request.tabs.receivedCount", { count: waitingCount.value })
      : t("request.tabs.received"),
  },
  { value: "sent", label: t("request.tabs.sent") },
]);

const venueNames = computed(() => new Map(venues.value?.map((venue) => [venue._id, venue.name])));
</script>

<template>
  <div class="mx-auto max-w-160 space-y-4">
    <h1
      class="font-display font-bold tracking-[-0.015em] text-[22px] md:text-[26px] text-highlighted"
    >
      {{ t("pages.requests.title") }}
    </h1>

    <UTabs v-model="tab" :items="tabs" :content="false" :ui="{ list: 'ring ring-default' }" />

    <div v-if="isPending" class="space-y-2 md:space-y-3">
      <USkeleton v-for="n in 3" :key="n" class="h-[188px] rounded-2xl" />
    </div>

    <UAlert
      v-else-if="error"
      color="error"
      variant="soft"
      icon="i-lucide-triangle-alert"
      :title="t('request.loadError')"
    />

    <ul v-else-if="views.length" class="space-y-2 md:space-y-3">
      <li v-for="view in views" :key="view.request._id">
        <RequestsRequestCard
          :view="view"
          :venue="view.slot.venueId && venueNames.get(view.slot.venueId)"
          :sent="isSent"
        />
      </li>
    </ul>

    <UEmpty
      v-else-if="isSent"
      icon="i-lucide-send"
      :title="t('request.empty.sentTitle')"
      :actions="[
        {
          label: t('pages.find.title'),
          icon: 'i-lucide-search',
          color: 'neutral',
          variant: 'outline',
          to: '/find',
        },
      ]"
      :ui="{ root: 'py-10 rounded-2xl bg-elevated ring ring-default' }"
    />

    <UEmpty
      v-else
      icon="i-lucide-inbox"
      :title="t('request.empty.receivedTitle')"
      :description="t('request.empty.receivedDescription')"
      :actions="[
        {
          label: t('pages.calendar.title'),
          icon: 'i-lucide-calendar-days',
          color: 'neutral',
          variant: 'outline',
          to: '/calendar',
        },
      ]"
      :ui="{ root: 'py-10 rounded-2xl bg-elevated ring ring-default' }"
    />
  </div>
</template>
