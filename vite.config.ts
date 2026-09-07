import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    ignorePatterns: [
      "node_modules/**",
      "**/node_modules/**",
      "apps/web/.nuxt/**",
      "apps/web/.output/**",
      "apps/web/.data/**",
      "apps/web/.nitro/**",
      "packages/backend/convex/_generated/**",
      ".alchemy/**",
      ".wrangler/**",
      "**/.wrangler/**",
    ],
    options: {
      typeAware: false,
      typeCheck: false,
    },
  },
  fmt: {
    ignorePatterns: [
      "node_modules/**",
      "**/node_modules/**",
      "apps/web/.nuxt/**",
      "apps/web/.output/**",
      "apps/web/.data/**",
      "apps/web/.nitro/**",
      "packages/backend/convex/_generated/**",
      ".alchemy/**",
      ".wrangler/**",
      "**/.wrangler/**",
    ],
    singleQuote: false,
    semi: true,
    sortPackageJson: true,
  },
  staged: {
    "*.{js,ts,jsx,tsx,vue,svelte,json,jsonc,css,md}": "vp check --fix",
  },
});
