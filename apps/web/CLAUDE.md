# apps/web — Nuxt frontend

Nuxt 4 frontend for **Tennis Buddy Finder** (Portugal-only: find people to play tennis
with nearby). It is a thin client over the Convex backend in `packages/backend`; all data
and business logic live in Convex functions, this app renders and calls them.

Stack: Nuxt 4 (`app/` dir), Vue 3 `<script setup lang="ts">`, @nuxt/ui v4 (Reka UI +
Tailwind v4), `convex-nuxt` + `convex-vue`, lucide icons via `@iconify-json/lucide`,
zod v4. Deployed to Cloudflare Workers via Alchemy (`packages/infra/alchemy.run.ts`).

## Commands (run from repo root)

| Task | Command |
| --- | --- |
| Dev server (port 3001) | `pnpm run dev:web` |
| Convex backend dev | `pnpm run dev:server` (needed for any data on screen) |
| Build | `pnpm run build` |
| Typecheck (`nuxt typecheck` / vue-tsc) | `pnpm run check-types` |
| Lint + format (oxlint, oxfmt --write) | `pnpm run check` |

- `nuxt prepare` runs on `postinstall` and regenerates `.nuxt/` (types, auto-import
  stubs, `tsconfig.*.json` that the root `tsconfig.json` references). **Never edit
  `.nuxt/`**; if types look stale run `pnpm install` or `pnpm --filter web exec nuxt prepare`.
- Env: `NUXT_PUBLIC_CONVEX_URL` in `apps/web/.env`. It is validated at build time by
  `@tennis-buddy-finder/env/web` (imported at the top of `nuxt.config.ts`) and passed to
  the `convex` module option. At runtime read it via `useRuntimeConfig().public.convex.url`,
  never `process.env` in components.

## Directory conventions (Nuxt 4 `app/` layout)

```
app/
  app.vue              root: NuxtAnnouncer/RouteAnnouncer/LoadingIndicator > UApp > NuxtLayout > NuxtPage
  app.config.ts        @nuxt/ui theme (primary: emerald, neutral: neutral)
  assets/css/main.css  `@import "tailwindcss"; @import "@nuxt/ui";` — add global CSS here only
  pages/               file-based routing (index.vue, todos.vue, [id].vue, nested dirs)
  layouts/             default.vue = <Header /> + <UMain><slot /></UMain>
  components/          auto-imported, PascalCase, name = file name (Header.vue -> <Header />)
  composables/         auto-imported `use*.ts` (create dir when needed)
  middleware/          route guards: `auth.ts` -> definePageMeta({ middleware: "auth" }); `*.global.ts` runs everywhere
  utils/               auto-imported plain helpers
  plugins/             defineNuxtPlugin (e.g. wiring auth tokens into Convex)
server/                Nitro routes (api/, routes/) — only if truly needed; empty today
public/                static files (favicon, robots.txt)
```

- Always `<script setup lang="ts">`. Vue/Nuxt APIs (`ref`, `computed`, `useRoute`,
  `navigateTo`, `useState`, `definePageMeta`) are auto-imported; explicit imports from
  `vue` are tolerated but unnecessary.
- Page-level options go in `definePageMeta({ layout, middleware, name })`, not in props.
- Shared client state across components/pages: `useState("key", () => init)`. Do not
  reach for Pinia; Convex queries are already the reactive source of truth for server data.
- SEO/head: `useSeoMeta` / `useHead` inside the page.
- Nuxt's `useFetch`/`useAsyncData` are for HTTP endpoints only — for Convex data use the
  Convex composables below.

## Nuxt UI v4

- Use `U*` components exclusively (`UButton`, `UCard`, `UInput`, `UForm`, `UFormField`,
  `USelect`, `UCalendar`, `UModal`, `UAlert`, `USkeleton`, `UEmpty`, `UHeader`,
  `UNavigationMenu`, `UContainer`, `UMain`, `UColorModeButton`, ...). Do not add another
  component library or a second icon set.
- Icons: `i-lucide-<name>` (e.g. `icon="i-lucide-trash-2"`, `<UIcon name="i-lucide-map-pin" />`).
- Theming: semantic color aliases in `app/app.config.ts` (`ui.colors.primary/neutral`,
  can also set `secondary/success/warning/error/info`). Component-level defaults go
  under `ui.<component>` in the same file; per-instance overrides via the `:ui` prop.
- Styling: Tailwind v4 utilities and Nuxt UI semantic classes (`text-muted`,
  `text-success`, `text-error`, `bg-elevated`, `border-default`). Avoid custom CSS
  unless a utility genuinely does not exist.
- Toasts: `const toast = useToast(); toast.add({ title, color: "error" })` (needs `UApp`, already in `app.vue`).
- Types: `import type { NavigationMenuItem, FormSubmitEvent } from "@nuxt/ui"`.
- Slots/variants for any component: check `node_modules/@nuxt/ui` docs or the generated
  theme in `.nuxt/ui/` before guessing prop names.

## Convex usage

`convex-nuxt` auto-imports these from `convex-vue` (explicit import also fine):
`useConvexQuery`, `useConvexMutation`, `useConvexClient`, `useConvexHttpQuery`.
There is **no** `useConvexAction` in this version — call actions with
`useConvexClient().action(api.x.y, args)`.

```ts
import { api } from "@tennis-buddy-finder/backend/convex/_generated/api";
import type { Id, Doc } from "@tennis-buddy-finder/backend/convex/_generated/dataModel";

// Reactive, realtime query. Args may be a plain object, ref, or getter.
const { data, error, isPending, suspense } = useConvexQuery(api.todos.getAll, {});
const { data: byUser } = useConvexQuery(api.matches.byUser, () => ({ userId: userId.value }));

// Mutation
const { mutate: createTodo, isPending: isCreating, error: createError } =
  useConvexMutation(api.todos.create, { optimisticUpdate: /* optional */ undefined });
await createTodo({ text }); // returns the mutation result, throws on failure
```

Rules:
- `data` is `undefined` while loading; always branch on `isPending` / `error` / `data`
  (see `app/pages/todos.vue` for the canonical loading -> error -> empty -> list pattern
  with `USkeleton`, `UAlert`, `UEmpty`). The composable's return object itself is never
  `undefined`, only `data.value` is.
- Queries subscribe on the client and are prefetched on the server for SSR; pass
  `{ server: false }` as the options arg to skip SSR for a query.
- Keep validation and business rules in Convex functions (`packages/backend/convex/*.ts`),
  not in components. Components only shape UI state and call `mutate`.
- Use `Id<"table">` / `Doc<"table">` from the generated `dataModel` for ids and rows;
  never type ids as `string`.
- `server/` routes (Nitro) have no reactive client. If one ever needs Convex data, use
  `ConvexHttpClient` from `convex/browser` with `useRuntimeConfig().public.convex.url`,
  or `useConvexHttpQuery` from `convex-vue` in a Nuxt context. Prefer not to add server
  routes at all; talk to Convex directly from pages.
- `api` types come from `packages/backend/convex/_generated/` — they update when the
  backend dev server (`pnpm run dev:server`) is running. If a function is missing from
  `api`, the backend generated files are stale, not the frontend.

## Forms and validation

- Use `UForm :schema :state @submit` with `UFormField name=...` wrappers; validation
  runs before `@submit` fires and `event.data` is the parsed output.
- Schemas are zod v4 (`import * as z from "zod"`; use `z.email()`, `z.url()` etc., not
  `z.string().email()`). Define the schema once; when a Convex mutation validates the
  same shape, put the zod schema in the backend package and import it here rather than
  duplicating it.

```vue
<script setup lang="ts">
import * as z from "zod";
import type { FormSubmitEvent } from "@nuxt/ui";

const schema = z.object({ city: z.string().min(2), level: z.enum(["beginner", "intermediate", "advanced"]) });
type Schema = z.output<typeof schema>;
const state = reactive<Partial<Schema>>({});

async function onSubmit(event: FormSubmitEvent<Schema>) { await mutate(event.data); }
</script>

<template>
  <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
    <UFormField name="city" label="City" required><UInput v-model="state.city" /></UFormField>
    <UButton type="submit" :loading="isPending">Save</UButton>
  </UForm>
</template>
```

## Auth (placeholder, not implemented yet)

- Auth will use a Convex-compatible provider (TBD). The wiring pattern is a Nuxt plugin
  in `app/plugins/` that calls `useConvexClient().setAuth(getToken)`; Convex functions
  then read `ctx.auth.getUserIdentity()`.
- Protected pages must declare `definePageMeta({ middleware: "auth" })` backed by
  `app/middleware/auth.ts` (redirect with `navigateTo("/login")` when unauthenticated).
  Do not gate pages with ad-hoc `v-if` checks.

## Before finishing

From the repo root run `pnpm run check-types` and `pnpm run check`; both must pass.
`pnpm run check` rewrites formatting (oxfmt), so re-read touched files if you keep editing.
