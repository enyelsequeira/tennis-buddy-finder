import { api } from "@tennis-buddy-finder/backend/convex/_generated/api";
import type { OpenSlot } from "~/types/slots";

export function useAskToPlay() {
  const { data: sent } = useAuthedQuery(api.matchRequests.sent);
  const requested = computed(
    () =>
      new Set(
        sent.value
          ?.filter(({ request }) => request.status === "pending")
          .map(({ request }) => request.slotId),
      ),
  );

  const asking = ref<OpenSlot>();
  const askOpen = ref(false);

  function ask(slot: OpenSlot) {
    asking.value = slot;
    askOpen.value = true;
  }

  return { requested, asking, askOpen, ask };
}
