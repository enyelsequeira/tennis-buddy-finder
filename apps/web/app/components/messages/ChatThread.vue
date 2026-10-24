<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";
import { api } from "@tennis-buddy-finder/backend/convex/_generated/api";
import type { Id } from "@tennis-buddy-finder/backend/convex/_generated/dataModel";
import type { SlotStatus } from "~/types/slots";

/**
 * One conversation: header with the other player, the matched slot pinned on top,
 * the messages (`UChatMessages` / `UChatMessage`) and the composer. Mount it with
 * `:key="conversationId"` so switching threads starts from a clean state.
 */
const props = defineProps<{ conversationId: Id<"conversations"> }>();

const PAGE_SIZE = 50;
/** Within this distance of the bottom, an incoming message scrolls the thread down. */
const STICK_TO_BOTTOM_PX = 120;

const { t } = useI18n();
const toast = useToast();
const localePath = useLocalePath();
const { now, formatTime, formatLongDay, formatDayLabel, isSameDay } = useLisbonTime();

const limit = ref(PAGE_SIZE);

const thread = useAuthedQuery(api.conversations.get, () => ({
  conversationId: props.conversationId,
}));
const list = useAuthedQuery(api.messages.list, () => ({
  conversationId: props.conversationId,
  limit: limit.value,
}));
const { data: venues } = useAuthedQuery(api.venues.list);

const player = computed(() => thread.data.value?.player ?? null);
/** Empty while loading, so nothing announces a "deleted player" that is just not here yet. */
const name = computed(() => {
  if (!thread.data.value) return "";
  return player.value?.displayName ?? t("chat.deletedPlayer");
});
const messages = computed(() => list.data.value?.messages ?? []);
const loadError = computed(() => thread.error.value ?? list.error.value);
/** Missing, not a member, blocked or a malformed id; anything else is a load error. */
const notFound = computed(() => {
  const error = loadError.value;
  if (!error) return false;
  return (
    convexErrorCode(error) === "NOT_FOUND" ||
    /ArgumentValidationError|Validator/i.test(error instanceof Error ? error.message : "")
  );
});
const failed = computed(() => Boolean(loadError.value) && !notFound.value);
const isPending = computed(() => thread.isPending.value || list.isPending.value);

useSeoMeta({ title: () => (player.value ? player.value.displayName : t("pages.messages.title")) });

/** Messages with a date separator label on the first message of each Lisbon day. */
const items = computed(() =>
  messages.value.map((message, index) => {
    const previous = messages.value[index - 1];
    const newDay = !previous || !isSameDay(previous._creationTime, message._creationTime);
    return { ...message, dayLabel: newDay ? formatDayLabel(message._creationTime) : null };
  }),
);

const pinned = computed(() => {
  const slot = thread.data.value?.slot;
  if (!slot) return null;
  const status: SlotStatus =
    slot.status === "open" || slot.status === "matched" ? slot.status : "closed";
  const venue = venues.value?.find((row) => row._id === slot.venueId)?.name;
  return { slot, status, venue, day: formatLongDay(slot.startAt) };
});

// Bubbles: mine solid court blue on the right, theirs a white card on the left.
const bubble = {
  container: "pb-1 max-w-[85%] sm:max-w-[75%]",
  content: "px-3.5 py-2 min-h-0 rounded-2xl text-sm",
};
const mineProps = {
  side: "right",
  variant: "solid",
  color: "primary",
  ui: { ...bubble, content: `${bubble.content} rounded-br-md` },
} as const;
const theirsProps = {
  side: "left",
  variant: "outline",
  color: "neutral",
  ui: { ...bubble, content: `${bubble.content} bg-elevated rounded-bl-md` },
} as const;

// ---- scrolling -------------------------------------------------------------

const scroller = useTemplateRef<HTMLElement>("scroller");
const { arrivedState } = useScroll(scroller, { offset: { bottom: STICK_TO_BOTTOM_PX } });

function scrollToBottom(behavior: ScrollBehavior = "smooth") {
  const el = scroller.value;
  if (el) el.scrollTo({ top: el.scrollHeight, behavior });
}

const messageEl = (id: string) =>
  scroller.value?.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(id)}"]`) ?? null;

/**
 * Set while older messages load: the first visible message and its offset, so
 * the view stays put whatever renders above it (older rows, the button going away).
 */
let anchor: { id: string; top: number } | null = null;

function loadEarlier() {
  const first = messages.value[0];
  const el = first && messageEl(first._id);
  if (el) anchor = { id: first._id, top: el.getBoundingClientRect().top };
  limit.value += PAGE_SIZE;
}

// Any new response after "load earlier" settles the anchor, even if nothing older came back.
watch(
  () => list.data.value,
  () => {
    if (!anchor) return;
    const el = messageEl(anchor.id);
    if (el && scroller.value)
      scroller.value.scrollTop += el.getBoundingClientRect().top - anchor.top;
    anchor = null;
  },
  { flush: "post" },
);

watch(
  () => messages.value.at(-1)?._id,
  (lastId, previousLastId) => {
    if (!scroller.value || anchor || lastId === previousLastId) return;
    // `arrivedState` was last updated by a scroll, i.e. before this message rendered.
    if (messages.value.at(-1)?.mine || arrivedState.bottom || !previousLastId) scrollToBottom();
  },
  { flush: "post" },
);

// The composer growing (or the keyboard opening) shrinks the thread: stay pinned.
useResizeObserver(scroller, () => {
  if (arrivedState.bottom) scrollToBottom("auto");
});

// ---- read state ------------------------------------------------------------

const visibility = useDocumentVisibility();
const { mutate: markRead } = useConvexMutation(api.conversations.markRead);

const markReadSoon = useDebounceFn(async () => {
  if (visibility.value !== "visible" || notFound.value) return;
  try {
    await markRead({ conversationId: props.conversationId });
  } catch {
    // Read state is best effort; the next message or visit retries it.
  }
}, 300);

/** The newest message from the other player; own and optimistic sends never trigger a read. */
const lastIncomingId = computed(() => messages.value.findLast((message) => !message.mine)?._id);

watch(
  [() => list.data.value !== undefined, lastIncomingId, visibility],
  ([loaded, id]) => {
    if (loaded && id) markReadSoon();
  },
  { immediate: true },
);

// ---- sending ---------------------------------------------------------------

const draft = ref("");
let optimisticCount = 0;

const { mutate: send } = useConvexMutation(api.messages.send, {
  optimisticUpdate: (store, args) => {
    for (const query of store.getAllQueries(api.messages.list)) {
      if (query.args.conversationId !== args.conversationId || !query.value) continue;
      store.setQuery(api.messages.list, query.args, {
        ...query.value,
        messages: [
          ...query.value.messages,
          {
            _id: `optimistic:${++optimisticCount}` as Id<"messages">,
            _creationTime: now(),
            body: args.body.trim(),
            mine: true,
          },
        ],
      });
    }
  },
});

async function onSend(body: string) {
  draft.value = "";
  try {
    await send({ conversationId: props.conversationId, body });
  } catch (error) {
    // Give the text back so nothing typed is lost.
    if (!draft.value) draft.value = body;
    const unavailable = convexErrorCode(error) === "NOT_FOUND";
    toast.add({ title: t(unavailable ? "chat.unavailable" : "chat.sendError"), color: "error" });
  }
}

// ---- menu and block --------------------------------------------------------

const blockOpen = ref(false);
const { mutate: block, isPending: isBlocking } = useConvexMutation(api.blocks.block);

const menu = computed<DropdownMenuItem[]>(() => {
  const otherUserId = thread.data.value?.otherUserId;
  if (!otherUserId || !player.value) return [];
  return [
    {
      label: t("chat.viewProfile"),
      icon: "i-lucide-user-round",
      to: localePath(`/players/${otherUserId}`),
    },
    {
      label: t("playerPage.block"),
      icon: "i-lucide-ban",
      color: "error",
      onSelect: () => {
        blockOpen.value = true;
      },
    },
  ];
});

async function confirmBlock() {
  const userId = thread.data.value?.otherUserId;
  if (!userId) return;
  try {
    await block({ userId });
    blockOpen.value = false;
    toast.add({ title: t("playerPage.blocked"), icon: "i-lucide-ban" });
    await navigateTo(localePath("/messages"));
  } catch {
    toast.add({ title: t("playerPage.blockError"), color: "error" });
  }
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <header
      class="flex shrink-0 items-center gap-2 border-b border-default bg-elevated px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] md:px-4"
    >
      <UButton
        :to="localePath('/messages')"
        icon="i-lucide-chevron-left"
        color="neutral"
        variant="ghost"
        class="md:hidden"
        :aria-label="t('chat.back')"
      />

      <div v-if="isPending && !notFound" class="flex items-center gap-3">
        <USkeleton class="size-10 rounded-full" />
        <USkeleton class="h-4 w-32" />
      </div>

      <template v-else-if="!notFound">
        <ULink
          v-if="player && thread.data.value"
          :to="localePath(`/players/${thread.data.value.otherUserId}`)"
          class="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-primary"
        >
          <UAvatar
            :alt="name"
            :text="name.charAt(0)"
            size="md"
            class="shrink-0 bg-accented"
            :ui="{ fallback: 'text-muted font-semibold' }"
          />
          <span class="truncate font-semibold text-highlighted">{{ name }}</span>
          <NtrpBadge :rating="player.ntrp" />
        </ULink>
        <span v-else class="truncate font-semibold text-muted">{{ name }}</span>

        <UDropdownMenu v-if="menu.length" :items="menu" :content="{ align: 'end' }">
          <UButton
            icon="i-lucide-ellipsis-vertical"
            color="neutral"
            variant="ghost"
            class="ms-auto"
            :aria-label="t('chat.menu')"
          />
        </UDropdownMenu>
      </template>
    </header>

    <UEmpty
      v-if="notFound"
      icon="i-lucide-message-circle-off"
      :title="t('chat.notFoundTitle')"
      :description="t('chat.notFoundDescription')"
      :actions="[
        {
          label: t('chat.back'),
          icon: 'i-lucide-arrow-left',
          color: 'neutral',
          variant: 'outline',
          to: localePath('/messages'),
        },
      ]"
      :ui="{ root: 'flex-1 py-16' }"
    />

    <template v-else>
      <UAlert
        v-if="failed"
        class="m-3"
        color="error"
        variant="soft"
        icon="i-lucide-triangle-alert"
        :title="t('chat.threadError')"
      />

      <section
        v-if="pinned"
        class="shrink-0 border-b border-default bg-elevated/60 px-3 md:px-4"
        :aria-label="t('chat.matchedSlot')"
      >
        <p class="pt-2 text-[11px] text-dimmed">{{ t("chat.matchedSlot") }} · {{ pinned.day }}</p>
        <SlotRow
          :start-at="pinned.slot.startAt"
          :end-at="pinned.slot.endAt"
          :status="pinned.status"
          :venue="pinned.venue"
        />
      </section>

      <!-- Positioned wrapper: the "jump to latest" button sits over the visible area. -->
      <div class="relative min-h-0 flex-1">
        <div
          ref="scroller"
          class="h-full overflow-y-auto overscroll-contain px-3 py-4 md:px-5"
          role="log"
          :aria-label="name ? t('chat.threadLabel', { name }) : t('pages.messages.title')"
        >
          <div v-if="isPending" class="space-y-3">
            <USkeleton class="h-10 w-2/3 rounded-2xl" />
            <USkeleton class="ms-auto h-10 w-1/2 rounded-2xl" />
            <USkeleton class="h-14 w-3/5 rounded-2xl" />
          </div>

          <UEmpty
            v-else-if="!items.length"
            icon="i-lucide-hand"
            :title="t('chat.startTitle', { name })"
            :description="t('chat.startDescription')"
            :ui="{ root: 'py-12' }"
          />

          <template v-else>
            <div v-if="list.data.value?.hasMore" class="flex justify-center pb-3">
              <UButton
                :label="t('chat.loadEarlier')"
                icon="i-lucide-chevrons-up"
                color="neutral"
                variant="soft"
                size="sm"
                @click="loadEarlier"
              />
            </div>

            <UChatMessages :ui="{ root: 'gap-0 px-0', viewport: 'top-auto bottom-4' }">
              <template #viewport="{ onClick }">
                <UButton
                  icon="i-lucide-arrow-down"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  class="absolute right-1/2 bottom-0 translate-x-1/2 rounded-full shadow-sm"
                  :aria-label="t('chat.jumpToLatest')"
                  @click="onClick"
                />
              </template>
              <template v-for="item in items" :key="item._id">
                <p v-if="item.dayLabel" class="py-3 text-center text-[11px] text-dimmed">
                  {{ item.dayLabel }}
                </p>
                <UChatMessage
                  :id="item._id"
                  :data-message-id="item._id"
                  :role="item.mine ? 'user' : 'assistant'"
                  :parts="[{ type: 'text', text: item.body }]"
                  compact
                  v-bind="item.mine ? mineProps : theirsProps"
                  :aria-label="
                    item.mine
                      ? t('chat.sentAt', { time: formatTime(item._creationTime) })
                      : t('chat.fromThem', { name, time: formatTime(item._creationTime) })
                  "
                >
                  <template #content>
                    <p class="whitespace-pre-wrap break-words">{{ item.body }}</p>
                    <p class="mt-0.5 text-end text-[10px]" :class="item.mine ? '' : 'text-dimmed'">
                      <time>{{ formatTime(item._creationTime) }}</time>
                    </p>
                  </template>
                </UChatMessage>
              </template>
            </UChatMessages>
          </template>
        </div>
      </div>

      <div
        class="shrink-0 border-t border-default bg-default px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:px-4 md:pb-3"
      >
        <MessagesComposer v-model="draft" :disabled="isPending || failed" @send="onSend" />
      </div>
    </template>

    <UModal
      v-model:open="blockOpen"
      :title="t('playerPage.blockTitle', { name })"
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
