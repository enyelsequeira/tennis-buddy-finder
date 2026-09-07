<script setup lang="ts">
import { api } from "@tennis-buddy-finder/backend/convex/_generated/api";
import { useConvexQuery } from "convex-vue";

const TITLE_TEXT = `
 ██████╗ ███████╗████████╗████████╗███████╗██████╗
 ██╔══██╗██╔════╝╚══██╔══╝╚══██╔══╝██╔════╝██╔══██╗
 ██████╔╝█████╗     ██║      ██║   █████╗  ██████╔╝
 ██╔══██╗██╔══╝     ██║      ██║   ██╔══╝  ██╔══██╗
 ██████╔╝███████╗   ██║      ██║   ███████╗██║  ██║
 ╚═════╝ ╚══════╝   ╚═╝      ╚═╝   ╚══════╝╚═╝  ╚═╝

 ████████╗    ███████╗████████╗ █████╗  ██████╗██╗  ██╗
 ╚══██╔══╝    ██╔════╝╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝
    ██║       ███████╗   ██║   ███████║██║     █████╔╝
    ██║       ╚════██║   ██║   ██╔══██║██║     ██╔═██╗
    ██║       ███████║   ██║   ██║  ██║╚██████╗██║  ██╗
    ╚═╝       ╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝
 `;

const healthCheck = useConvexQuery(api.healthCheck.get, {});
</script>

<template>
  <UContainer class="py-8">
    <pre class="overflow-x-auto font-mono text-sm whitespace-pre-wrap">{{ TITLE_TEXT }}</pre>

    <div class="grid gap-6 mt-6">
      <UCard>
        <template #header>
          <div class="font-medium">API Status</div>
        </template>

        <div class="flex items-center gap-2">
          <UIcon
            :name="
              healthCheck === undefined
                ? 'i-lucide-loader-2'
                : healthCheck.data.value === 'OK'
                  ? 'i-lucide-check-circle'
                  : 'i-lucide-x-circle'
            "
            :class="[
              healthCheck === undefined ? 'animate-spin text-muted' : '',
              healthCheck?.data.value === 'OK' ? 'text-success' : 'text-error',
            ]"
          />
          <span class="text-sm">
            {{
              healthCheck === undefined
                ? "Checking..."
                : healthCheck.data.value === "OK"
                  ? "Connected"
                  : "Error"
            }}
          </span>
        </div>
      </UCard>
    </div>
  </UContainer>
</template>
