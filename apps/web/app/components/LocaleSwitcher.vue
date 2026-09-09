<script setup lang="ts">
/**
 * Language switcher. `SwitchLocalePathLink` renders a real link to the same
 * page in the other locale (crawlable, SSR-correct for dynamic routes).
 * The cookie is updated on click so browser detection keeps the choice.
 * See https://i18n.nuxtjs.org/docs/components/switch-locale-path-link
 */
const { t, locale, locales, setLocaleCookie } = useI18n();
</script>

<template>
  <nav :aria-label="t('nav.language')" class="flex items-center gap-0.5 text-sm font-medium">
    <SwitchLocalePathLink
      v-for="entry in locales"
      :key="entry.code"
      :locale="entry.code"
      class="rounded-md px-2 py-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      :class="
        entry.code === locale ? 'text-highlighted bg-accented' : 'text-muted hover:text-default'
      "
      :aria-current="entry.code === locale ? 'true' : undefined"
      :aria-label="entry.name"
      @click="setLocaleCookie(entry.code)"
    >
      {{ entry.code.toUpperCase() }}
    </SwitchLocalePathLink>
  </nav>
</template>
