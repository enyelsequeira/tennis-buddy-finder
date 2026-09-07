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
 *   config.public.serverUrl (NUXT_PUBLIC_SERVER_URL maps to serverUrl)
 */
export const env = createEnv({
  client: {
    NUXT_PUBLIC_CONVEX_URL: convexUrlSchema("example.convex.cloud"),
  },
  emptyStringAsUndefined: true,
});
