<script setup lang="ts">
import type { NuxtError } from "#app";

const props = defineProps<{ error: NuxtError }>();

const { locale, t } = useI18n();
const localePath = useLocalePath();
const head = useLocaleHead({ lang: true });

const notFound = computed(() => props.error.statusCode === 404);
const title = computed(() => t(notFound.value ? "errorPage.notFoundTitle" : "errorPage.title"));

// error.vue replaces app.vue, so its titleTemplate and lang attribute are set again here.
useHead({
  htmlAttrs: { lang: () => head.value.htmlAttrs?.lang ?? locale.value },
  title: () => `${title.value} · Tennis Buddy`,
});
</script>

<template>
  <UError
    :error="{
      statusCode: props.error.statusCode,
      statusMessage: title,
      message: t(notFound ? 'errorPage.notFoundDescription' : 'errorPage.description'),
    }"
    :redirect="localePath('/')"
    :clear="{ label: t('errorPage.home') }"
  />
</template>
