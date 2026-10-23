<script setup lang="ts">
import { api } from "@tennis-buddy-finder/backend/convex/_generated/api";
import type { Id } from "@tennis-buddy-finder/backend/convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";

const props = defineProps<{
  view: FunctionReturnType<typeof api.matchRequests.received>[number];
  venue?: string;
  sent?: boolean;
}>();

const REQUEST_ERROR_KEYS = {
  REQUEST_NOT_PENDING: "notPending",
  SLOT_NOT_OPEN: "slotNotOpen",
  FORBIDDEN: "forbidden",
  NOT_FOUND: "notFound",
} as const;

const { t } = useI18n();
const localePath = useLocalePath();
const toast = useToast();
const { formatLongDay, formatRange } = useLisbonTime();

const player = computed(() => toSlotPlayer(props.view.player));
const isWaiting = computed(() => props.view.request.status === "pending");
const slotStatus = computed(() => {
  const { status } = props.view.slot;
  return status === "open" || status === "matched" ? status : "closed";
});

const mutations = {
  accept: useConvexMutation(api.matchRequests.accept),
  decline: useConvexMutation(api.matchRequests.decline),
  cancel: useConvexMutation(api.matchRequests.cancel),
};
type Action = keyof typeof mutations;

const busy = ref<Action | null>(null);

const chatLink = (conversationId?: Id<"conversations">) =>
  localePath(conversationId ? `/messages/${conversationId}` : "/messages");

async function respond(action: Action) {
  busy.value = action;
  try {
    const result = await mutations[action].mutate({ requestId: props.view.request._id });
    toast.add({
      title: t(`request.toast.${action}`),
      icon: "i-lucide-check",
      actions:
        action === "accept"
          ? [{ label: t("request.openChat"), to: chatLink(result ?? undefined) }]
          : undefined,
    });
  } catch (error) {
    toast.add({
      title: t(`request.errors.${convexErrorKey(error, REQUEST_ERROR_KEYS)}`),
      color: "error",
    });
  } finally {
    busy.value = null;
  }
}
</script>

<template>
  <article
    class="rounded-2xl bg-elevated ring ring-default p-3.5 flex flex-col gap-3"
    :class="{ 'opacity-75': !isWaiting }"
    :aria-label="
      t('slot.withPlayer', { range: formatRange(view.slot), name: view.player.displayName })
    "
  >
    <div class="flex items-start justify-between gap-3">
      <ULink :to="localePath(`/players/${view.player.userId}`)" class="min-w-0">
        <PlayerIdentity :player="player" :venue="venue" />
      </ULink>
      <RequestStatusBadge :status="view.request.status" class="shrink-0" />
    </div>

    <div>
      <p class="text-sm font-medium text-default">{{ formatLongDay(view.slot.startAt) }}</p>
      <SlotRow
        :start-at="view.slot.startAt"
        :end-at="view.slot.endAt"
        :status="slotStatus"
        :venue="venue"
      />
    </div>

    <p
      v-if="view.request.message"
      class="rounded-lg bg-default px-3 py-2 text-sm text-default whitespace-pre-line break-words"
    >
      {{ view.request.message }}
    </p>

    <div v-if="isWaiting" class="flex justify-end gap-2">
      <UButton
        v-if="sent"
        :label="t('request.cancel')"
        color="error"
        variant="soft"
        :loading="busy === 'cancel'"
        @click="respond('cancel')"
      />
      <template v-else>
        <UButton
          :label="t('request.decline')"
          color="neutral"
          variant="outline"
          :loading="busy === 'decline'"
          :disabled="busy === 'accept'"
          @click="respond('decline')"
        />
        <UButton
          :label="t('request.accept')"
          :loading="busy === 'accept'"
          :disabled="busy === 'decline'"
          @click="respond('accept')"
        />
      </template>
    </div>

    <div v-else-if="view.request.status === 'accepted'" class="flex justify-end">
      <UButton
        :label="t('request.openChat')"
        icon="i-lucide-message-circle"
        variant="link"
        :to="chatLink(view.request.conversationId)"
      />
    </div>
  </article>
</template>
