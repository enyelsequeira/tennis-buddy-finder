<script setup lang="ts">
import {
  MAX_MESSAGE_LENGTH,
  messageBodySchema,
} from "@tennis-buddy-finder/backend/convex/model/messageSchema";
import { breakpointsTailwind } from "@vueuse/core";

/**
 * Chat composer: `UChatPrompt` (auto-growing textarea) plus a round send button.
 * Enter sends on desktop, Shift+Enter adds a line; on touch screens Enter adds a
 * line and the button sends. Emits the trimmed body; the parent owns the mutation.
 */
const props = defineProps<{ disabled?: boolean }>();
const emit = defineEmits<{ send: [body: string] }>();
const body = defineModel<string>({ default: "" });

const { t } = useI18n();
const isDesktop = useBreakpoints(breakpointsTailwind).greaterOrEqual("md");

const COUNTER_FROM = MAX_MESSAGE_LENGTH - 200;
const length = computed(() => body.value.trim().length);
const tooLong = computed(() => length.value > MAX_MESSAGE_LENGTH);
const canSend = computed(() => messageBodySchema.safeParse(body.value).success);

const prompt = useTemplateRef("prompt");
const focus = () => prompt.value?.textareaRef?.focus();

// Native autofocus fires while the prompt is still disabled; focus once it is ready.
watch(
  () => !props.disabled && isDesktop.value,
  (ready) => {
    if (ready) nextTick(focus);
  },
  { immediate: true },
);

function onSubmit() {
  if (!canSend.value) return;
  emit("send", body.value.trim());
  // Keep typing after a click on the send button too.
  if (isDesktop.value) nextTick(focus);
}
</script>

<template>
  <div class="space-y-1">
    <UChatPrompt
      ref="prompt"
      v-model="body"
      variant="subtle"
      :placeholder="t('chat.placeholder')"
      :submit-on-enter="isDesktop"
      :maxrows="6"
      :disabled="disabled"
      :aria-label="t('chat.placeholder')"
      :ui="{
        root: 'rounded-3xl bg-elevated py-1.5 ps-4 pe-1.5',
        body: 'flex w-full items-end gap-2',
        base: 'flex-1 py-1.5',
      }"
      @submit="onSubmit"
    >
      <UChatPromptSubmit
        icon="i-lucide-send"
        class="shrink-0 rounded-full"
        :disabled="disabled || !canSend"
        :aria-label="t('chat.send')"
      />
    </UChatPrompt>
    <p
      v-if="length > COUNTER_FROM"
      class="px-4 text-end text-[11px]"
      :class="tooLong ? 'text-error' : 'text-dimmed'"
    >
      <span v-if="tooLong" role="alert">{{ t("chat.tooLong", { max: MAX_MESSAGE_LENGTH }) }}</span>
      {{ length }}/{{ MAX_MESSAGE_LENGTH }}
    </p>
  </div>
</template>
