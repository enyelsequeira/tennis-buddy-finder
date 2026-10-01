import type { OptionalRestArgs } from "convex-vue";
import type { FunctionReference, FunctionReturnType } from "convex/server";

// `useConvexQuery` for signed-in data: subscribes only once the WebSocket client
// holds a token and reports pending until then (convex-vue has no `skip` option).
export function useAuthedQuery<Query extends FunctionReference<"query">>(
  query: Query,
  ...[args]: OptionalRestArgs<Query>
) {
  const data = shallowRef<FunctionReturnType<Query>>();
  const error = ref<Error | null>(null);
  const isPending = computed(() => data.value === undefined && error.value === null);

  if (import.meta.server) return { data, error, isPending };

  const convex = useConvexClient();
  const ready = useConvexAuthReady();

  watch(
    () => (ready.value ? (toValue(args) ?? {}) : null),
    (queryArgs, _previous, onCleanup) => {
      if (!queryArgs) {
        data.value = undefined;
        error.value = null;
        return;
      }
      const unsubscribe = convex.onUpdate(
        query,
        queryArgs,
        (result) => {
          data.value = result;
          error.value = null;
        },
        (failure) => {
          data.value = undefined;
          error.value = failure;
        },
      );
      onCleanup(unsubscribe);
    },
    { immediate: true },
  );

  return { data, error, isPending };
}
