<script setup lang="ts">
import type { BadgeProps } from "@nuxt/ui";

type RequestStatus = "pending" | "accepted" | "declined" | "cancelled";

const props = defineProps<{ status: RequestStatus; reason?: "slot_taken" }>();

const { t } = useI18n();

const COLORS: Record<RequestStatus, BadgeProps["color"]> = {
  pending: "warning",
  accepted: "success",
  declined: "neutral",
  cancelled: "neutral",
};

const color = computed(() => COLORS[props.status]);
</script>

<template>
  <UBadge
    :label="t(reason ? `request.reason.${reason}` : `request.status.${status}`)"
    :color="color"
    variant="soft"
    size="sm"
    :class="status === 'pending' && 'bg-warning-50 text-warning-800'"
  />
</template>
