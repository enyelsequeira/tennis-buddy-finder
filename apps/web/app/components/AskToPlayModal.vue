<script setup lang="ts">
import type { FormSubmitEvent } from "@nuxt/ui";
import { api } from "@tennis-buddy-finder/backend/convex/_generated/api";
import * as z from "zod";
import type { OpenSlot } from "~/types/slots";

const props = defineProps<{ slot: OpenSlot }>();
const open = defineModel<boolean>("open", { required: true });

const MESSAGE_MAX = 300;

const ASK_ERROR_KEYS = {
  SLOT_NOT_OPEN: "notOpen",
  SLOT_IN_PAST: "inPast",
  CANNOT_REQUEST_OWN_SLOT: "ownSlot",
  BLOCKED: "blocked",
  REQUEST_EXISTS: "exists",
  INVALID_MESSAGE: "messageTooLong",
  NOT_FOUND: "notFound",
} as const;

const { t } = useI18n();
const toast = useToast();
const { formatLongDay } = useLisbonTime();

const schema = computed(() =>
  z.object({ message: z.string().trim().max(MESSAGE_MAX, t("ask.errors.messageTooLong")) }),
);
type AskInput = z.output<typeof schema.value>;

const state = reactive<AskInput>({ message: "" });

watch(open, (isOpen) => {
  if (isOpen) state.message = "";
});

const { mutate: send, isPending: isSending } = useConvexMutation(api.matchRequests.send);

async function onSubmit({ data }: FormSubmitEvent<AskInput>) {
  try {
    await send({ slotId: props.slot.id, message: data.message || undefined });
    open.value = false;
    toast.add({ title: t("ask.sent"), icon: "i-lucide-send" });
  } catch (error) {
    toast.add({ title: t(`ask.errors.${convexErrorKey(error, ASK_ERROR_KEYS)}`), color: "error" });
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('ask.title', { name: slot.player.displayName })"
    :description="formatLongDay(slot.startAt)"
  >
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <SlotRow
          :start-at="slot.startAt"
          :end-at="slot.endAt"
          :status="slot.status"
          :venue="slot.venue"
          class="rounded-lg bg-elevated ring ring-default px-3"
        />

        <UFormField
          name="message"
          :label="t('ask.message')"
          :hint="t('onboarding.optional')"
          :help="t('ask.messageCounter', { count: state.message.length })"
        >
          <UTextarea
            v-model="state.message"
            :maxlength="MESSAGE_MAX"
            :rows="3"
            autoresize
            class="w-full"
            :placeholder="t('ask.messagePlaceholder')"
          />
        </UFormField>

        <UButton
          type="submit"
          :label="t('ask.send')"
          icon="i-lucide-send"
          :loading="isSending"
          block
        />
      </UForm>
    </template>
  </UModal>
</template>
