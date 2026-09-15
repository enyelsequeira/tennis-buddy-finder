import { createEnv } from "@t3-oss/env-nuxt";
import { z } from "zod";

const convexUrlSchema = (exampleHost: string) =>
  z.url().refine((url) => new URL(url).hostname !== exampleHost, {
    message: `Replace the ${exampleHost} placeholder before running the app`,
  });

/**
 * Nuxt env validation - validates at build time when imported in nuxt.config.ts
 * For runtime access in components/plugins, use useRuntimeConfig() instead:
 *   const config = useRuntimeConfig()
 *   config.public.convex.url (NUXT_PUBLIC_CONVEX_URL) and config.convexSiteUrl (NUXT_CONVEX_SITE_URL)
 */
export const env = createEnv({
  server: {
    // *.convex.site URL of the deployment; target of the Nitro /api/auth/* proxy.
    NUXT_CONVEX_SITE_URL: convexUrlSchema("example.convex.site"),
  },
  client: {
    NUXT_PUBLIC_CONVEX_URL: convexUrlSchema("example.convex.cloud"),
  },
  emptyStringAsUndefined: true,
});
