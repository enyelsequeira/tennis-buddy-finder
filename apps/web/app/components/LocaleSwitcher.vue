<script setup lang="ts">
import { Group } from "@mantine-vue/core";

/**
 * Language switcher. `SwitchLocalePathLink` renders a real link to the same
 * page in the other locale (crawlable, SSR-correct for dynamic routes).
 * The cookie is updated on click so browser detection keeps the choice.
 * See https://i18n.nuxtjs.org/docs/components/switch-locale-path-link
 */
const { t, locale, locales, setLocaleCookie } = useI18n();
</script>

<template>
  <Group component="nav" :gap="2" align="center" wrap="nowrap" :aria-label="t('nav.language')">
    <SwitchLocalePathLink
      v-for="entry in locales"
      :key="entry.code"
      :locale="entry.code"
      :class="[$style.pill, entry.code === locale && $style.active]"
      :aria-current="entry.code === locale ? 'true' : undefined"
      :aria-label="entry.name"
      @click="setLocaleCookie(entry.code)"
    >
      {{ entry.code.toUpperCase() }}
    </SwitchLocalePathLink>
  </Group>
</template>

<style module>
/* SwitchLocalePathLink is a plain NuxtLink, so the pill styling lives here. */
.pill {
  display: inline-block;
  padding: 4px 8px;
  border-radius: var(--mantine-radius-sm);
  font-size: var(--mantine-font-size-sm);
  font-weight: 500;
  line-height: var(--mantine-line-height-sm);
  color: var(--mantine-color-dimmed);
  text-decoration: none;
  transition:
    color 150ms ease,
    background-color 150ms ease;
}

.pill:hover {
  color: var(--mantine-color-text);
}

.pill:focus-visible {
  outline: 2px solid var(--mantine-color-court-filled);
  outline-offset: 2px;
}

.active {
  color: var(--mantine-color-text);
  background-color: light-dark(var(--mantine-color-slate-2), var(--mantine-color-slate-7));
}
</style>
