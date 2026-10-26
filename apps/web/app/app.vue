<script setup lang="ts">
import * as locales from "@nuxt/ui/locale";

const { locale } = useI18n();
const head = useLocaleHead({ lang: true, seo: true });

// Nuxt UI's Portuguese locale uses pt-BR wording for the password toggle.
const uiLocales = {
  ...locales,
  pt: extendLocale(locales.pt, {
    messages: {
      authForm: { showPassword: "Mostrar palavra-passe", hidePassword: "Ocultar palavra-passe" },
    },
  }),
};

useHead({
  htmlAttrs: {
    lang: () => head.value.htmlAttrs?.lang ?? locale.value,
  },
  link: () => head.value.link ?? [],
  meta: () => head.value.meta ?? [],
  titleTemplate: (chunk) => (chunk ? `${chunk} · Tennis Buddy` : "Tennis Buddy"),
});
</script>

<template>
  <NuxtAnnouncer />
  <NuxtRouteAnnouncer />
  <NuxtLoadingIndicator />
  <UApp :locale="uiLocales[locale]">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
