<template>
  <div class="min-h-screen flex flex-col">
    <LandingHeader />
    <UMain class="flex-1">
      <slot />
    </UMain>
    <LandingFooter />
  </div>
</template>
