import "@tennis-buddy-finder/env/web";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "latest",
  devtools: { enabled: true },
  experimental: {
    payloadExtraction: "client",
  },
  modules: ["@nuxt/ui", "convex-nuxt"],
  css: ["~/assets/css/main.css"],
  devServer: {
    port: 3001,
  },
  convex: {
    url: process.env.NUXT_PUBLIC_CONVEX_URL,
  },
});
