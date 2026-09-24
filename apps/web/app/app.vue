<script setup lang="ts">
import { MantineProvider } from "@mantine-vue/core";
import { Notifications } from "@mantine-vue/notifications";
import { theme } from "~/theme";

const { locale } = useI18n();
const head = useLocaleHead({ lang: true, seo: true });
const { scheme } = useAppColorScheme();

useHead({
  htmlAttrs: {
    lang: () => head.value.htmlAttrs?.lang ?? locale.value,
    "data-mantine-color-scheme": () => (scheme.value === "dark" ? "dark" : "light"),
  },
  link: () => head.value.link ?? [],
  meta: () => head.value.meta ?? [],
  titleTemplate: (chunk) => chunk ?? "Tennis Buddy",
});
</script>

<template>
  <NuxtAnnouncer />
  <NuxtRouteAnnouncer />
  <NuxtLoadingIndicator />
  <MantineProvider :theme="theme" :default-color-scheme="scheme" deduplicate-inline-styles>
    <Notifications position="top-right" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </MantineProvider>
</template>
