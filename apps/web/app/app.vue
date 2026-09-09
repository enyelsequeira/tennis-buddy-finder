<script setup lang="ts">
import * as locales from "@nuxt/ui/locale";

const { locale } = useI18n();
const head = useLocaleHead({ lang: true, seo: true });

useHead({
  htmlAttrs: {
    lang: () => head.value.htmlAttrs?.lang ?? locale.value,
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
  <UApp :locale="locales[locale]">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
