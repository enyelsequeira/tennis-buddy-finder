import "@tennis-buddy-finder/env/web";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "latest",
  devtools: { enabled: true },
  experimental: {
    payloadExtraction: "client",
  },
  modules: ["@nuxt/icon", "@nuxt/fonts", "@vueuse/nuxt", "@nuxtjs/i18n", "convex-nuxt"],
  // Order matters: notifications styles must come after the core styles.
  css: [
    "@mantine-vue/core/styles.css",
    "@mantine-vue/notifications/styles.css",
    "~/assets/css/main.css",
  ],
  fonts: {
    families: [
      { name: "Instrument Sans", provider: "google", weights: [400, 500, 600, 700] },
      { name: "Bricolage Grotesque", provider: "google", weights: [700] },
    ],
  },
  icon: {
    // Icon names are Iconify ids (`lucide:map-pin`). Only lucide (UI) and
    // simple-icons (brand marks on the auth pages) are bundled.
    serverBundle: { collections: ["lucide", "simple-icons"] },
    clientBundle: { scan: true },
  },
  postcss: {
    plugins: {
      "postcss-preset-mantine": { autoRem: true },
      "postcss-simple-vars": {
        variables: {
          "mantine-breakpoint-xs": "36em",
          "mantine-breakpoint-sm": "48em",
          "mantine-breakpoint-md": "62em",
          "mantine-breakpoint-lg": "75em",
          "mantine-breakpoint-xl": "88em",
        },
      },
    },
  },
  devServer: {
    port: 3001,
  },
  runtimeConfig: {
    // Server-only. Set via NUXT_CONVEX_SITE_URL (the *.convex.site URL of the
    // deployment); it is the target of the /api/auth/* proxy in server/api/auth.
    convexSiteUrl: "",
  },
  i18n: {
    // Portuguese (Portugal) is the product language; English is secondary.
    defaultLocale: "pt",
    strategy: "prefix_except_default",
    // Absolute origin for hreflang/canonical tags. Set NUXT_PUBLIC_SITE_URL in production.
    baseUrl: process.env.NUXT_PUBLIC_SITE_URL ?? "http://localhost:3001",
    locales: [
      { code: "pt", language: "pt-PT", name: "Português", file: "pt.json" },
      { code: "en", language: "en", name: "English", file: "en.json" },
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: "locale",
      redirectOn: "root",
    },
    experimental: {
      typedOptionsAndMessages: "default",
    },
  },
  convex: {
    url: process.env.NUXT_PUBLIC_CONVEX_URL,
  },
  vite: {
    optimizeDeps: {
      include: ["@mantine-vue/core", "@vue/devtools-core", "@vue/devtools-kit"],
    },
  },
});
