<script setup lang="ts">
import * as locales from "@nuxt/ui/locale";

const { locale, t } = useI18n();
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

// shortcut: Nuxt UI 4.11 UToaster passes no label to reka's ToastViewport, whose English
// "Notifications (F8)" region mounts client-only into <body>; relabel it until UToaster forwards one.
function labelToastRegion() {
  const region = document.querySelector('[role="region"]:has(> [data-slot="viewport"])');
  const label = t("notifications.toastRegion", { hotkey: "F8" });
  if (region && region.getAttribute("aria-label") !== label)
    region.setAttribute("aria-label", label);
}
onMounted(() => {
  useMutationObserver(document.body, labelToastRegion, { childList: true });
  watchEffect(labelToastRegion);
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
