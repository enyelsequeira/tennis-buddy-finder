<script setup lang="ts">
import { Badge, type MantineColor } from "@mantine-vue/core";

type RequestStatus = "pending" | "accepted" | "declined" | "cancelled";

const props = defineProps<{ status: RequestStatus }>();

const { t } = useI18n();

const COLORS: Record<RequestStatus, MantineColor> = {
  pending: "ball",
  accepted: "surround",
  declined: "gray",
  cancelled: "gray",
};

const color = computed(() => COLORS[props.status]);
</script>

<template>
  <Badge :color="color" variant="light" size="sm" :c="status === 'pending' ? 'ball.8' : undefined">
    {{ t(`request.status.${status}`) }}
  </Badge>
</template>
