<script setup lang="ts">
const { t } = useI18n();
const route = useRoute();
const column = computed(() => (route.meta.authWide ? "max-w-[560px]" : "max-w-[400px]"));
</script>

<template>
  <div class="min-h-screen bg-default lg:grid lg:grid-cols-2">
    <AuthShowcase class="hidden lg:flex" />

    <div class="flex min-h-screen flex-col px-4 md:px-7">
      <div
        class="mx-auto flex w-full flex-1 flex-col py-8 md:py-12 lg:justify-center"
        :class="column"
      >
        <header class="mb-8 flex justify-center lg:justify-start">
          <ULink
            to="/"
            :aria-label="t('app.name')"
            class="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <AppWordmark size="lg" />
          </ULink>
        </header>

        <main>
          <slot />
        </main>

        <footer class="mt-8 flex justify-center lg:justify-start">
          <LocaleSwitcher />
        </footer>
      </div>
    </div>
  </div>
</template>
