import "@tennis-buddy-finder/env/web";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "latest",
  devtools: { enabled: true },
  experimental: {
    payloadExtraction: "client",
  },
  modules: ["@nuxt/ui", "@vueuse/nuxt", "@nuxtjs/i18n", "convex-nuxt"],
  css: ["~/assets/css/main.css"],
  devServer: {
    port: 3001,
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
});
