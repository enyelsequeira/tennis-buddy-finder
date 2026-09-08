# Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete Convex data layer for Tennis Buddy Finder: schema, auth helper, every domain function (profiles, venues, availability, search, match requests, conversations, messages, blocks, reports, notifications, housekeeping, account deletion) with `convex-test` coverage.

**Architecture:** Flat, normalized Convex tables with a named index behind every query path. One file per domain under `packages/backend/convex/`, shared non-function helpers under `convex/model/`. All caller identity flows through `getCurrentUser(ctx)`, which maps the auth identity `subject` to a `users` row. No frontend, no Better Auth component, no email sending in this plan; those are plan 2 (auth + email integration) and plan 3 (Nuxt frontend). This plan leaves seams for them: an internal mutation the auth trigger will call, a `createNotification` helper the email scheduler will hook into, and a `deleteAccount` mutation the auth plan will wrap.

**Tech Stack:** Convex 1.45 (`convex` ^1.45.0 via pnpm catalog), `convex-helpers` (doc validators), `convex-test` + `vitest` 5 + `@edge-runtime/vm` for tests, TypeScript 6, oxlint/oxfmt, pnpm 11 with Vite+ (`vp`) task runner.

**Spec:** `docs/superpowers/specs/2026-09-08-tennis-buddy-finder-design.md`

## Global Constraints

- All code lives under `packages/backend/convex/`. `convex/_generated/` is never hand-edited; `convex dev` (or `npx convex codegen`) regenerates it.
- Every registered function uses object syntax with `args` **and** `returns` validators. Public: `query` / `mutation`. Private: `internalQuery` / `internalMutation`. Imports from `./_generated/server` and `./_generated/api`, never from `convex/server` except `defineSchema`, `defineTable`, `cronJobs`, `paginationOptsValidator`.
- Never `.filter()` on a db query. Every lookup uses `.withIndex(...)`. Index names are `by_field1_and_field2`.
- Never an unbounded `.collect()` on a table that grows per user activity: use `.take(n)`, `.paginate()`, or an index range bounded by a user id.
- Client-facing failures throw `ConvexError("<CODE>")` with an upper snake case string code. Tests assert on the code.
- Timestamps are milliseconds since epoch, UTC, as `v.number()`. Slot bounds are on 30-minute boundaries, max 6 hours long.
- Minimum age 18, computed from ISO `YYYY-MM-DD` birth date.
- Location is `district` + `municipality` strings on profiles and slots. Onboarding is fixed to `"Coimbra"` / `"Figueira da Foz"` in this version.
- `ctx.db.get`, `ctx.db.patch`, `ctx.db.delete` take the table name first: `ctx.db.patch("users", id, {...})` (matches the existing `todos.ts` style and Convex 1.45).
- Tests are `packages/backend/convex/*.test.ts`, run with `pnpm --filter @tennis-buddy-finder/backend test`. They use fake timers pinned to `NOW = 2026-09-08T12:00:00Z`.
- Before finishing any task: `pnpm run check-types` and `pnpm run check` from the repo root pass, and the task's tests pass.
- Every commit message ends with the trailer line `Claude-Session: https://claude.ai/code/session_011WdotxYTNKaLaKeuBUtE1H`.

### Refinements to the spec made by this plan

These are small, deliberate deviations. They do not change product behaviour.

1. Slot status gains `"expired"`, set by the housekeeping cron for past open slots. The spec said `cancelled`; distinguishing lets "copy last week" copy expired slots but skip ones the user cancelled on purpose.
2. Search index is `by_municipality_and_status_and_startAt` (spec said `by_municipality_and_startAt`) so `status === "open"` is part of the index walk instead of an in-memory filter.
3. Extra indexes: `availabilitySlots.by_status_and_startAt` (cron), `messages.by_senderId` (account deletion tombstones), `matchRequests.by_slotId_and_status` (accept cascade), `reports.by_reporterId` (account deletion).
4. Time-of-day filtering in search is done on the client over the returned page. The backend receives only a `from` / `to` range.
5. Email verification is enforced by Better Auth refusing to sign in unverified users (plan 2), so `getCurrentUser` does not check it.
6. Conversations and memberships get `lastMessageAt` / `lastReadAt` set to the creation time, so the "no unread messages" email rule is a plain comparison.

---

## File structure

```
packages/backend/
  package.json                  # add test script + dev deps
  vitest.config.mts             # edge-runtime environment
  convex/
    schema.ts                   # all tables + indexes
    test.env.d.ts               # import.meta.glob typing for tests
    test.helpers.ts             # setup(), createUser(), time constants
    model/
      validators.ts             # shared literal unions, paginated() helper
      errors.ts                 # fail(code) helper
      auth.ts                   # getCurrentUser, getCurrentProfile, requireAdmin
      time.ts                   # slot time constants + checks, ageOn()
      blocks.ts                 # blockedUserIds(), isBlockedEitherWay()
      notifications.ts          # createNotification()
      conversations.ts          # getOrCreateConversation()
      requests.ts               # declinePendingForSlot(), cancelPendingBetween()
    users.ts                    # internalCreateFromAuth, me, setEmailNotifications, deleteAccount, tombstoneMessages
    profiles.ts                 # create, update, mine, getByUserId
    venues.ts                   # list, seedFigueira
    availability.ts             # create, remove, cancel, mine, listOpenForUser, copyLastWeek, search
    matchRequests.ts            # send, accept, decline, cancel, received, sent
    conversations.ts            # list, get, markRead
    messages.ts                 # send, list
    blocks.ts                   # block, unblock, listMine
    reports.ts                  # create, listOpen, markReviewed, dismiss
    notifications.ts            # unread, markAllRead
    housekeeping.ts             # expireSlots, purgeNotifications (internal)
    crons.ts                    # daily schedule
    *.test.ts                   # one test file per domain file
```

Deleted: `convex/todos.ts`, `apps/web/app/pages/todos.vue`, the Todos nav entry in `apps/web/app/components/Header.vue`.

---

### Task 1: Test tooling

**Files:**
- Modify: `packages/backend/package.json`
- Create: `packages/backend/vitest.config.mts`
- Create: `packages/backend/convex/test.env.d.ts`
- Create: `packages/backend/convex/test.helpers.ts`
- Test: `packages/backend/convex/healthCheck.test.ts`

**Interfaces:**
- Produces: `setup(): TestConvex` (fake timers pinned to `NOW`), `NOW`, `HOUR`, `DAY`, `modules` from `convex/test.helpers.ts`. `createUser` is added in Task 3.

- [ ] **Step 1: Add dependencies and test script**

Run from repo root:

```bash
pnpm --filter @tennis-buddy-finder/backend add -D convex-test vitest @edge-runtime/vm
pnpm --filter @tennis-buddy-finder/backend add convex-helpers
```

Then edit `packages/backend/package.json` scripts to add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 2: Create vitest config**

`packages/backend/vitest.config.mts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts"],
    server: { deps: { inline: ["convex-test"] } },
  },
});
```

- [ ] **Step 3: Type `import.meta.glob` for the convex tsconfig**

`packages/backend/convex/test.env.d.ts`:

```ts
// Vitest (via Vite) provides import.meta.glob at runtime. This declaration
// lets the Convex tsconfig typecheck test helpers without vite/client types.
interface ImportMeta {
  glob(pattern: string): Record<string, () => Promise<unknown>>;
}
```

- [ ] **Step 4: Create the test helper**

`packages/backend/convex/test.helpers.ts`:

```ts
import { convexTest } from "convex-test";
import { vi } from "vitest";

import schema from "./schema";

export const modules = import.meta.glob("./**/*.*s");

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;
/** 2026-09-08T12:00:00.000Z, a Tuesday. */
export const NOW = Date.UTC(2026, 8, 8, 12, 0, 0);

export type T = ReturnType<typeof convexTest>;

export function setup(): T {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  return convexTest(schema, modules);
}
```

- [ ] **Step 5: Write the smoke test**

`packages/backend/convex/healthCheck.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import { setup } from "./test.helpers";

describe("healthCheck", () => {
  it("returns OK", async () => {
    const t = setup();
    expect(await t.query(api.healthCheck.get, {})).toBe("OK");
  });
});
```

- [ ] **Step 6: Run the test**

Run: `pnpm --filter @tennis-buddy-finder/backend test`
Expected: 1 passed.

- [ ] **Step 7: Typecheck and lint**

Run from root: `pnpm run check-types && pnpm run check`
Expected: no errors. If `check-types` complains that `import.meta.glob` does not exist, confirm `convex/test.env.d.ts` is inside the `include` of `packages/backend/convex/tsconfig.json` (it is `./**/*`, so it should be).

- [ ] **Step 8: Commit**

```bash
git add packages/backend/package.json packages/backend/vitest.config.mts packages/backend/convex/test.env.d.ts packages/backend/convex/test.helpers.ts packages/backend/convex/healthCheck.test.ts pnpm-lock.yaml
git commit -m "test(backend): add convex-test + vitest tooling" -m "Claude-Session: https://claude.ai/code/session_011WdotxYTNKaLaKeuBUtE1H"
```

---

### Task 2: Schema and scaffold removal

**Files:**
- Create: `packages/backend/convex/model/validators.ts`
- Modify: `packages/backend/convex/schema.ts` (replace entirely)
- Delete: `packages/backend/convex/todos.ts`, `apps/web/app/pages/todos.vue`
- Modify: `apps/web/app/components/Header.vue:8`
- Test: `packages/backend/convex/schema.test.ts`

**Interfaces:**
- Produces: `schema` default export; validators `genderValidator`, `formatsValidator`, `handednessValidator`, `surfaceValidator`, `slotStatusValidator`, `requestStatusValidator`, `reportReasonValidator`, `reportStatusValidator`, `notificationTypeValidator`, `roleValidator`, and `paginated(item)` from `convex/model/validators.ts`.

- [ ] **Step 1: Write the failing schema test**

`packages/backend/convex/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { setup, NOW, HOUR } from "./test.helpers";

describe("schema", () => {
  it("accepts a user, profile and slot that follow the spec", async () => {
    const t = setup();
    const ids = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "auth_1",
        email: "a@test.pt",
        name: "Ana",
        role: "user",
        emailNotifications: true,
      });
      const profileId = await ctx.db.insert("profiles", {
        userId,
        displayName: "Ana",
        birthDate: "1990-05-01",
        ntrp: 3.5,
        yearsPlaying: 4,
        formats: "both",
        district: "Coimbra",
        municipality: "Figueira da Foz",
        languages: ["pt", "en"],
      });
      const slotId = await ctx.db.insert("availabilitySlots", {
        userId,
        startAt: NOW + HOUR,
        endAt: NOW + 2 * HOUR,
        district: "Coimbra",
        municipality: "Figueira da Foz",
        status: "open",
      });
      return { userId, profileId, slotId };
    });
    expect(ids.userId).toBeTruthy();
    expect(ids.profileId).toBeTruthy();
    expect(ids.slotId).toBeTruthy();
  });

  it("rejects an unknown slot status", async () => {
    const t = setup();
    await expect(
      t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          authId: "auth_2",
          email: "b@test.pt",
          name: "Bruno",
          role: "user",
          emailNotifications: true,
        });
        await ctx.db.insert("availabilitySlots", {
          userId,
          startAt: NOW,
          endAt: NOW + HOUR,
          district: "Coimbra",
          municipality: "Figueira da Foz",
          // bypass the compile-time check so the runtime schema validation is exercised
          status: "bogus" as unknown as "open",
        });
      }),
    ).rejects.toThrow();
  });
});
```

The removal of the `todos` table is verified by the typecheck in Step 7 (any leftover `api.todos` reference fails to compile).

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @tennis-buddy-finder/backend test`
Expected: FAIL (tables `users`, `profiles`, `availabilitySlots` unknown; `todos` still exists).

- [ ] **Step 3: Create shared validators**

`packages/backend/convex/model/validators.ts`:

```ts
import { v, type Validator } from "convex/values";

export const roleValidator = v.union(v.literal("user"), v.literal("admin"));

export const genderValidator = v.union(
  v.literal("male"),
  v.literal("female"),
  v.literal("other"),
  v.literal("unspecified"),
);

export const formatsValidator = v.union(
  v.literal("singles"),
  v.literal("doubles"),
  v.literal("both"),
);

export const handednessValidator = v.union(v.literal("right"), v.literal("left"));

export const surfaceValidator = v.union(
  v.literal("hard"),
  v.literal("clay"),
  v.literal("grass"),
  v.literal("other"),
);

export const slotStatusValidator = v.union(
  v.literal("open"),
  v.literal("matched"),
  v.literal("cancelled"),
  v.literal("expired"),
);

export const requestStatusValidator = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("declined"),
  v.literal("cancelled"),
);

export const reportReasonValidator = v.union(
  v.literal("harassment"),
  v.literal("inappropriate"),
  v.literal("fake_profile"),
  v.literal("no_show"),
  v.literal("other"),
);

export const reportStatusValidator = v.union(
  v.literal("open"),
  v.literal("reviewed"),
  v.literal("dismissed"),
);

export const notificationTypeValidator = v.union(
  v.literal("request_received"),
  v.literal("request_accepted"),
  v.literal("request_declined"),
  v.literal("new_message"),
);

/** Return validator for `.paginate()` results. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic validator bound
export function paginated<T extends Validator<any, "required", any>>(item: T) {
  return v.object({
    page: v.array(item),
    isDone: v.boolean(),
    continueCursor: v.string(),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    pageStatus: v.optional(
      v.union(v.literal("SplitRecommended"), v.literal("SplitRequired"), v.null()),
    ),
  });
}
```

- [ ] **Step 4: Replace the schema**

`packages/backend/convex/schema.ts`:

```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import {
  formatsValidator,
  genderValidator,
  handednessValidator,
  notificationTypeValidator,
  reportReasonValidator,
  reportStatusValidator,
  requestStatusValidator,
  roleValidator,
  slotStatusValidator,
  surfaceValidator,
} from "./model/validators";

export default defineSchema({
  users: defineTable({
    authId: v.string(),
    email: v.string(),
    name: v.string(),
    image: v.optional(v.string()),
    role: roleValidator,
    emailNotifications: v.boolean(),
    bannedAt: v.optional(v.number()),
  }).index("by_authId", ["authId"]),

  profiles: defineTable({
    userId: v.id("users"),
    displayName: v.string(),
    bio: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    birthDate: v.string(),
    gender: v.optional(genderValidator),
    ntrp: v.number(),
    yearsPlaying: v.number(),
    formats: formatsValidator,
    handedness: v.optional(handednessValidator),
    district: v.string(),
    municipality: v.string(),
    languages: v.array(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_municipality_and_ntrp", ["municipality", "ntrp"]),

  venues: defineTable({
    name: v.string(),
    district: v.string(),
    municipality: v.string(),
    address: v.optional(v.string()),
    surface: v.optional(surfaceValidator),
    isActive: v.boolean(),
  }).index("by_municipality", ["municipality"]),

  availabilitySlots: defineTable({
    userId: v.id("users"),
    startAt: v.number(),
    endAt: v.number(),
    district: v.string(),
    municipality: v.string(),
    venueId: v.optional(v.id("venues")),
    note: v.optional(v.string()),
    status: slotStatusValidator,
  })
    .index("by_userId_and_startAt", ["userId", "startAt"])
    .index("by_municipality_and_status_and_startAt", ["municipality", "status", "startAt"])
    .index("by_status_and_startAt", ["status", "startAt"]),

  matchRequests: defineTable({
    slotId: v.id("availabilitySlots"),
    fromUserId: v.id("users"),
    toUserId: v.id("users"),
    message: v.optional(v.string()),
    status: requestStatusValidator,
    respondedAt: v.optional(v.number()),
    conversationId: v.optional(v.id("conversations")),
  })
    .index("by_slotId_and_fromUserId", ["slotId", "fromUserId"])
    .index("by_slotId_and_status", ["slotId", "status"])
    .index("by_toUserId_and_status", ["toUserId", "status"])
    .index("by_fromUserId_and_status", ["fromUserId", "status"]),

  conversations: defineTable({
    userAId: v.id("users"),
    userBId: v.id("users"),
    lastMessageAt: v.number(),
  }).index("by_userAId_and_userBId", ["userAId", "userBId"]),

  conversationMembers: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    lastReadAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_conversationId_and_userId", ["conversationId", "userId"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.optional(v.id("users")),
    body: v.string(),
  })
    .index("by_conversationId", ["conversationId"])
    .index("by_senderId", ["senderId"]),

  blocks: defineTable({
    blockerId: v.id("users"),
    blockedId: v.id("users"),
  })
    .index("by_blockerId_and_blockedId", ["blockerId", "blockedId"])
    .index("by_blockedId", ["blockedId"]),

  reports: defineTable({
    reporterId: v.id("users"),
    reportedUserId: v.id("users"),
    reason: reportReasonValidator,
    details: v.optional(v.string()),
    messageId: v.optional(v.id("messages")),
    status: reportStatusValidator,
  })
    .index("by_status", ["status"])
    .index("by_reporterId", ["reporterId"]),

  notifications: defineTable({
    userId: v.id("users"),
    type: notificationTypeValidator,
    requestId: v.optional(v.id("matchRequests")),
    conversationId: v.optional(v.id("conversations")),
    readAt: v.optional(v.number()),
    emailedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_readAt", ["userId", "readAt"]),
});
```

- [ ] **Step 5: Remove the todos scaffold**

```bash
git rm packages/backend/convex/todos.ts apps/web/app/pages/todos.vue
```

In `apps/web/app/components/Header.vue`, delete the line

```ts
  { label: "Todos", to: "/todos", active: route.path.startsWith("/todos") },
```

If that leaves `route` unused in the file, delete the `const route = useRoute();` line as well.

- [ ] **Step 6: Regenerate codegen and run tests**

Run: `pnpm --filter @tennis-buddy-finder/backend exec convex codegen` (if it asks for a deployment, run `pnpm run dev:setup` from the root once, then retry).
Run: `pnpm --filter @tennis-buddy-finder/backend test`
Expected: schema tests pass, healthCheck still passes.

- [ ] **Step 7: Typecheck and lint**

Run from root: `pnpm run check-types && pnpm run check`
Expected: pass, including `apps/web` (no more `api.todos` references).

- [ ] **Step 8: Commit**

```bash
git add -A packages/backend/convex apps/web/app
git commit -m "feat(backend): define tennis buddy finder schema, drop todos scaffold" -m "Claude-Session: https://claude.ai/code/session_011WdotxYTNKaLaKeuBUtE1H"
```

---

### Task 3: Errors, auth helpers, users

**Files:**
- Create: `packages/backend/convex/model/errors.ts`
- Create: `packages/backend/convex/model/auth.ts`
- Create: `packages/backend/convex/users.ts`
- Modify: `packages/backend/convex/test.helpers.ts` (add `createUser`)
- Test: `packages/backend/convex/users.test.ts`

**Interfaces:**
- Produces:
  - `fail(code: string): never` in `model/errors.ts`, throws `ConvexError(code)`.
  - `getCurrentUser(ctx): Promise<Doc<"users">>`, `getCurrentProfile(ctx): Promise<{ user: Doc<"users">; profile: Doc<"profiles"> }>`, `requireAdmin(ctx): Promise<Doc<"users">>` in `model/auth.ts`. Codes: `UNAUTHENTICATED`, `PROFILE_REQUIRED`, `FORBIDDEN`.
  - `api.users.me` → `{ user, profile | null }`, `api.users.setEmailNotifications({ enabled })`, `internal.users.internalCreateFromAuth({ authId, email, name, image? })` → `Id<"users">` (idempotent on `authId`).
  - `createUser(t, overrides?)` in `test.helpers.ts` → `{ userId, authId, as }` where `as` is `t.withIdentity({ subject: authId })`.

- [ ] **Step 1: Add `createUser` to the test helper**

Append to `packages/backend/convex/test.helpers.ts`:

```ts
import type { Id } from "./_generated/dataModel";

let userCounter = 0;

type CreateUserOverrides = {
  authId?: string;
  role?: "user" | "admin";
  /** `false` skips creating a profile (simulates a user mid-onboarding). */
  profile?: false;
  ntrp?: number;
  formats?: "singles" | "doubles" | "both";
  municipality?: string;
  bannedAt?: number;
};

export async function createUser(t: T, overrides: CreateUserOverrides = {}) {
  const n = ++userCounter;
  const authId = overrides.authId ?? `auth_${n}`;
  const userId: Id<"users"> = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      authId,
      email: `user${n}@test.pt`,
      name: `User ${n}`,
      role: overrides.role ?? "user",
      emailNotifications: true,
      ...(overrides.bannedAt !== undefined ? { bannedAt: overrides.bannedAt } : {}),
    }),
  );
  if (overrides.profile !== false) {
    await t.run(async (ctx) =>
      ctx.db.insert("profiles", {
        userId,
        displayName: `User ${n}`,
        birthDate: "1990-01-01",
        ntrp: overrides.ntrp ?? 3.5,
        yearsPlaying: 5,
        formats: overrides.formats ?? "both",
        district: "Coimbra",
        municipality: overrides.municipality ?? "Figueira da Foz",
        languages: ["pt"],
      }),
    );
  }
  return { userId, authId, as: t.withIdentity({ subject: authId }) };
}
```

Move the `import type { Id }` line to the top of the file with the other imports.

- [ ] **Step 2: Write the failing tests**

`packages/backend/convex/users.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { api, internal } from "./_generated/api";
import { createUser, setup } from "./test.helpers";

describe("users.me", () => {
  it("throws UNAUTHENTICATED without identity", async () => {
    const t = setup();
    await expect(t.query(api.users.me, {})).rejects.toThrow("UNAUTHENTICATED");
  });

  it("throws UNAUTHENTICATED for an identity with no users row", async () => {
    const t = setup();
    await expect(
      t.withIdentity({ subject: "ghost" }).query(api.users.me, {}),
    ).rejects.toThrow("UNAUTHENTICATED");
  });

  it("throws UNAUTHENTICATED for a banned user", async () => {
    const t = setup();
    const banned = await createUser(t, { bannedAt: 1 });
    await expect(banned.as.query(api.users.me, {})).rejects.toThrow("UNAUTHENTICATED");
  });

  it("returns user and null profile before onboarding", async () => {
    const t = setup();
    const u = await createUser(t, { profile: false });
    const me = await u.as.query(api.users.me, {});
    expect(me.user._id).toBe(u.userId);
    expect(me.profile).toBeNull();
  });

  it("returns user and profile after onboarding", async () => {
    const t = setup();
    const u = await createUser(t);
    const me = await u.as.query(api.users.me, {});
    expect(me.profile?.userId).toBe(u.userId);
  });
});

describe("users.setEmailNotifications", () => {
  it("flips the flag", async () => {
    const t = setup();
    const u = await createUser(t);
    await u.as.mutation(api.users.setEmailNotifications, { enabled: false });
    const me = await u.as.query(api.users.me, {});
    expect(me.user.emailNotifications).toBe(false);
  });
});

describe("users.internalCreateFromAuth", () => {
  it("creates a users row and is idempotent on authId", async () => {
    const t = setup();
    const first = await t.mutation(internal.users.internalCreateFromAuth, {
      authId: "ba_1",
      email: "x@test.pt",
      name: "X",
    });
    const second = await t.mutation(internal.users.internalCreateFromAuth, {
      authId: "ba_1",
      email: "x@test.pt",
      name: "X",
    });
    expect(second).toBe(first);
    const me = await t.withIdentity({ subject: "ba_1" }).query(api.users.me, {});
    expect(me.user.role).toBe("user");
    expect(me.user.emailNotifications).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @tennis-buddy-finder/backend test`
Expected: FAIL, `api.users` does not exist.

- [ ] **Step 4: Create the errors helper**

`packages/backend/convex/model/errors.ts`:

```ts
import { ConvexError } from "convex/values";

/** Throw a client-facing error with a stable string code. */
export function fail(code: string): never {
  throw new ConvexError(code);
}
```

- [ ] **Step 5: Create the auth helpers**

`packages/backend/convex/model/auth.ts`:

```ts
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

import { fail } from "./errors";

export type Ctx = QueryCtx | MutationCtx;

/**
 * Resolves the calling identity to its `users` row. The identity `subject`
 * is the Better Auth user id, mirrored in `users.authId`.
 */
export async function getCurrentUser(ctx: Ctx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) fail("UNAUTHENTICATED");
  const user = await ctx.db
    .query("users")
    .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
    .unique();
  if (!user || user.bannedAt !== undefined) fail("UNAUTHENTICATED");
  return user;
}

export async function getProfileForUser(ctx: Ctx, userId: Doc<"users">["_id"]) {
  return ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

export async function getCurrentProfile(
  ctx: Ctx,
): Promise<{ user: Doc<"users">; profile: Doc<"profiles"> }> {
  const user = await getCurrentUser(ctx);
  const profile = await getProfileForUser(ctx, user._id);
  if (!profile) fail("PROFILE_REQUIRED");
  return { user, profile };
}

export async function requireAdmin(ctx: Ctx): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (user.role !== "admin") fail("FORBIDDEN");
  return user;
}
```

- [ ] **Step 6: Create users.ts**

`packages/backend/convex/users.ts`:

```ts
import { doc } from "convex-helpers/validators";
import { v } from "convex/values";

import { internalMutation, mutation, query } from "./_generated/server";
import { getCurrentUser, getProfileForUser } from "./model/auth";
import schema from "./schema";

export const me = query({
  args: {},
  returns: v.object({
    user: doc(schema, "users"),
    profile: v.union(doc(schema, "profiles"), v.null()),
  }),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    const profile = await getProfileForUser(ctx, user._id);
    return { user, profile };
  },
});

export const setEmailNotifications = mutation({
  args: { enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    await ctx.db.patch("users", user._id, { emailNotifications: args.enabled });
    return null;
  },
});

/** Called by the Better Auth `onCreateUser` trigger (plan 2). Idempotent. */
export const internalCreateFromAuth = internalMutation({
  args: {
    authId: v.string(),
    email: v.string(),
    name: v.string(),
    image: v.optional(v.string()),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", args.authId))
      .unique();
    if (existing) return existing._id;
    return ctx.db.insert("users", {
      authId: args.authId,
      email: args.email,
      name: args.name,
      image: args.image,
      role: "user",
      emailNotifications: true,
    });
  },
});
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm --filter @tennis-buddy-finder/backend test`
Expected: all pass. If `doc` is not exported from `convex-helpers/validators` in the installed version, check `node_modules/convex-helpers/validators.d.ts`; the helper is named `doc` and takes `(schema, tableName)`.

- [ ] **Step 8: Typecheck, lint, commit**

Run from root: `pnpm run check-types && pnpm run check`

```bash
git add packages/backend/convex
git commit -m "feat(backend): auth helpers and users functions" -m "Claude-Session: https://claude.ai/code/session_011WdotxYTNKaLaKeuBUtE1H"
```

---

### Task 4: Profiles

**Files:**
- Create: `packages/backend/convex/model/time.ts`
- Create: `packages/backend/convex/profiles.ts`
- Test: `packages/backend/convex/profiles.test.ts`

**Interfaces:**
- Consumes: `getCurrentUser`, `getCurrentProfile`, `getProfileForUser`, `fail`, validators.
- Produces:
  - `ageOn(birthDate: string, at: number): number` in `model/time.ts`.
  - `api.profiles.create(input)`, `api.profiles.update(input)`, `api.profiles.mine()`, `api.profiles.getByUserId({ userId })` → profile doc plus `age` (block check added in Task 6).
  - `profileInputFields` (args object shared by create/update) exported from `profiles.ts`.
  - Codes: `PROFILE_EXISTS`, `UNDERAGE`, `INVALID_NTRP`, `INVALID_BIRTH_DATE`, `INVALID_LANGUAGES`, `NOT_FOUND`.

- [ ] **Step 1: Write the failing tests**

`packages/backend/convex/profiles.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import { ageOn } from "./model/time";
import { createUser, setup, NOW } from "./test.helpers";

const validInput = {
  displayName: "Ana",
  birthDate: "1990-05-01",
  ntrp: 3.5,
  yearsPlaying: 4,
  formats: "both" as const,
  languages: ["pt"],
};

describe("ageOn", () => {
  it("counts a birthday that already happened this year", () => {
    expect(ageOn("2008-09-08", NOW)).toBe(18);
  });
  it("does not count a birthday still to come this year", () => {
    expect(ageOn("2008-09-09", NOW)).toBe(17);
  });
});

describe("profiles.create", () => {
  it("creates a profile fixed to Figueira da Foz / Coimbra", async () => {
    const t = setup();
    const u = await createUser(t, { profile: false });
    await u.as.mutation(api.profiles.create, validInput);
    const mine = await u.as.query(api.profiles.mine, {});
    expect(mine.municipality).toBe("Figueira da Foz");
    expect(mine.district).toBe("Coimbra");
    expect(mine.displayName).toBe("Ana");
  });

  it("rejects a second profile", async () => {
    const t = setup();
    const u = await createUser(t);
    await expect(u.as.mutation(api.profiles.create, validInput)).rejects.toThrow(
      "PROFILE_EXISTS",
    );
  });

  it("rejects under 18", async () => {
    const t = setup();
    const u = await createUser(t, { profile: false });
    await expect(
      u.as.mutation(api.profiles.create, { ...validInput, birthDate: "2008-09-09" }),
    ).rejects.toThrow("UNDERAGE");
  });

  it("rejects a malformed birth date", async () => {
    const t = setup();
    const u = await createUser(t, { profile: false });
    await expect(
      u.as.mutation(api.profiles.create, { ...validInput, birthDate: "01/05/1990" }),
    ).rejects.toThrow("INVALID_BIRTH_DATE");
  });

  it("rejects NTRP outside 1.0..7.0 or off the 0.5 grid", async () => {
    const t = setup();
    const u = await createUser(t, { profile: false });
    await expect(
      u.as.mutation(api.profiles.create, { ...validInput, ntrp: 7.5 }),
    ).rejects.toThrow("INVALID_NTRP");
    await expect(
      u.as.mutation(api.profiles.create, { ...validInput, ntrp: 3.2 }),
    ).rejects.toThrow("INVALID_NTRP");
  });

  it("requires at least one language", async () => {
    const t = setup();
    const u = await createUser(t, { profile: false });
    await expect(
      u.as.mutation(api.profiles.create, { ...validInput, languages: [] }),
    ).rejects.toThrow("INVALID_LANGUAGES");
  });
});

describe("profiles.update", () => {
  it("updates fields and keeps location fixed", async () => {
    const t = setup();
    const u = await createUser(t);
    await u.as.mutation(api.profiles.update, { ...validInput, displayName: "Ana B", ntrp: 4 });
    const mine = await u.as.query(api.profiles.mine, {});
    expect(mine.displayName).toBe("Ana B");
    expect(mine.ntrp).toBe(4);
    expect(mine.municipality).toBe("Figueira da Foz");
  });

  it("throws PROFILE_REQUIRED when there is no profile", async () => {
    const t = setup();
    const u = await createUser(t, { profile: false });
    await expect(u.as.mutation(api.profiles.update, validInput)).rejects.toThrow(
      "PROFILE_REQUIRED",
    );
  });
});

describe("profiles.getByUserId", () => {
  it("returns another player's profile with computed age", async () => {
    const t = setup();
    const viewer = await createUser(t);
    const other = await createUser(t);
    const p = await viewer.as.query(api.profiles.getByUserId, { userId: other.userId });
    expect(p.userId).toBe(other.userId);
    expect(p.age).toBe(36);
  });

  it("throws NOT_FOUND for a user without profile", async () => {
    const t = setup();
    const viewer = await createUser(t);
    const other = await createUser(t, { profile: false });
    await expect(
      viewer.as.query(api.profiles.getByUserId, { userId: other.userId }),
    ).rejects.toThrow("NOT_FOUND");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tennis-buddy-finder/backend test`
Expected: FAIL, `./model/time` and `api.profiles` missing.

- [ ] **Step 3: Create time helpers**

`packages/backend/convex/model/time.ts`:

```ts
export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
export const SLOT_STEP_MS = 30 * MINUTE;
export const MAX_SLOT_MS = 6 * HOUR;
export const MIN_AGE = 18;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses `YYYY-MM-DD`; returns null when malformed or not a real date. */
export function parseIsoDate(value: string): { y: number; m: number; d: number } | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    return null;
  }
  return { y, m, d };
}

/** Whole years between an ISO birth date and a timestamp (UTC calendar). */
export function ageOn(birthDate: string, at: number): number {
  const parsed = parseIsoDate(birthDate);
  if (!parsed) throw new Error(`Invalid ISO date: ${birthDate}`);
  const now = new Date(at);
  let age = now.getUTCFullYear() - parsed.y;
  const beforeBirthday =
    now.getUTCMonth() + 1 < parsed.m ||
    (now.getUTCMonth() + 1 === parsed.m && now.getUTCDate() < parsed.d);
  if (beforeBirthday) age -= 1;
  return age;
}

export function isOnSlotGrid(ts: number): boolean {
  return ts % SLOT_STEP_MS === 0;
}
```

- [ ] **Step 4: Create profiles.ts**

`packages/backend/convex/profiles.ts`:

```ts
import { doc } from "convex-helpers/validators";
import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { getCurrentProfile, getCurrentUser, getProfileForUser } from "./model/auth";
import { fail } from "./model/errors";
import { ageOn, MIN_AGE, parseIsoDate } from "./model/time";
import { formatsValidator, genderValidator, handednessValidator } from "./model/validators";
import schema from "./schema";

/** Launch scope: one municipality. Widen when the picker ships. */
export const LAUNCH_DISTRICT = "Coimbra";
export const LAUNCH_MUNICIPALITY = "Figueira da Foz";

export const profileInputFields = {
  displayName: v.string(),
  bio: v.optional(v.string()),
  avatarStorageId: v.optional(v.id("_storage")),
  birthDate: v.string(),
  gender: v.optional(genderValidator),
  ntrp: v.number(),
  yearsPlaying: v.number(),
  formats: formatsValidator,
  handedness: v.optional(handednessValidator),
  languages: v.array(v.string()),
};

type ProfileInput = {
  displayName: string;
  bio?: string;
  avatarStorageId?: Doc<"profiles">["avatarStorageId"];
  birthDate: string;
  gender?: Doc<"profiles">["gender"];
  ntrp: number;
  yearsPlaying: number;
  formats: Doc<"profiles">["formats"];
  handedness?: Doc<"profiles">["handedness"];
  languages: string[];
};

function validateProfileInput(input: ProfileInput) {
  const name = input.displayName.trim();
  if (name.length < 2 || name.length > 40) fail("INVALID_DISPLAY_NAME");
  if (input.bio !== undefined && input.bio.length > 500) fail("INVALID_BIO");
  if (!parseIsoDate(input.birthDate)) fail("INVALID_BIRTH_DATE");
  if (ageOn(input.birthDate, Date.now()) < MIN_AGE) fail("UNDERAGE");
  if (input.ntrp < 1 || input.ntrp > 7 || (input.ntrp * 2) % 1 !== 0) fail("INVALID_NTRP");
  if (!Number.isInteger(input.yearsPlaying) || input.yearsPlaying < 0 || input.yearsPlaying > 90) {
    fail("INVALID_YEARS_PLAYING");
  }
  if (input.languages.length === 0 || input.languages.some((l) => !/^[a-z]{2}$/.test(l))) {
    fail("INVALID_LANGUAGES");
  }
  return { ...input, displayName: name };
}

const profileWithAge = v.object({
  ...schema.tables.profiles.validator.fields,
  _id: v.id("profiles"),
  _creationTime: v.number(),
  age: v.number(),
});

export function withAge(profile: Doc<"profiles">) {
  return { ...profile, age: ageOn(profile.birthDate, Date.now()) };
}

export const create = mutation({
  args: profileInputFields,
  returns: v.id("profiles"),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const existing = await getProfileForUser(ctx, user._id);
    if (existing) fail("PROFILE_EXISTS");
    const input = validateProfileInput(args);
    return ctx.db.insert("profiles", {
      ...input,
      userId: user._id,
      district: LAUNCH_DISTRICT,
      municipality: LAUNCH_MUNICIPALITY,
    });
  },
});

export const update = mutation({
  args: profileInputFields,
  returns: v.null(),
  handler: async (ctx, args) => {
    const { profile } = await getCurrentProfile(ctx);
    const input = validateProfileInput(args);
    await ctx.db.patch("profiles", profile._id, input);
    return null;
  },
});

export const mine = query({
  args: {},
  returns: doc(schema, "profiles"),
  handler: async (ctx) => {
    const { profile } = await getCurrentProfile(ctx);
    return profile;
  },
});

export const getByUserId = query({
  args: { userId: v.id("users") },
  returns: profileWithAge,
  handler: async (ctx, args) => {
    await getCurrentProfile(ctx);
    const profile = await getProfileForUser(ctx, args.userId);
    if (!profile) fail("NOT_FOUND");
    return withAge(profile);
  },
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @tennis-buddy-finder/backend test`
Expected: all pass. The `age` expectation of 36 comes from birth date `1990-01-01` in `createUser` and `NOW` in September 2026.

- [ ] **Step 6: Typecheck, lint, commit**

Run from root: `pnpm run check-types && pnpm run check`

```bash
git add packages/backend/convex
git commit -m "feat(backend): profiles create/update/read with age and NTRP rules" -m "Claude-Session: https://claude.ai/code/session_011WdotxYTNKaLaKeuBUtE1H"
```

---

### Task 5: Venues

**Files:**
- Create: `packages/backend/convex/venues.ts`
- Test: `packages/backend/convex/venues.test.ts`

**Interfaces:**
- Produces: `api.venues.list()` → active venues in the caller's municipality; `internal.venues.seedFigueira()` → number inserted (idempotent by name).

- [ ] **Step 1: Write the failing tests**

`packages/backend/convex/venues.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { api, internal } from "./_generated/api";
import { createUser, setup } from "./test.helpers";

describe("venues", () => {
  it("seed is idempotent and list returns active venues for my municipality", async () => {
    const t = setup();
    const first = await t.mutation(internal.venues.seedFigueira, {});
    const second = await t.mutation(internal.venues.seedFigueira, {});
    expect(first).toBeGreaterThan(0);
    expect(second).toBe(0);

    const u = await createUser(t);
    const venues = await u.as.query(api.venues.list, {});
    expect(venues.length).toBe(first);
    expect(venues.every((v) => v.municipality === "Figueira da Foz")).toBe(true);
  });

  it("hides inactive venues", async () => {
    const t = setup();
    await t.run(async (ctx) => {
      await ctx.db.insert("venues", {
        name: "Closed Club",
        district: "Coimbra",
        municipality: "Figueira da Foz",
        isActive: false,
      });
    });
    const u = await createUser(t);
    const venues = await u.as.query(api.venues.list, {});
    expect(venues.find((v) => v.name === "Closed Club")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tennis-buddy-finder/backend test`
Expected: FAIL, `api.venues` missing.

- [ ] **Step 3: Create venues.ts**

`packages/backend/convex/venues.ts`:

```ts
import { doc } from "convex-helpers/validators";
import { v } from "convex/values";

import { internalMutation, query } from "./_generated/server";
import { getCurrentProfile } from "./model/auth";
import schema from "./schema";

/**
 * Placeholder seed list. Replace names/addresses with the real courts before
 * launch (spec open item 3). Idempotent by name.
 */
const FIGUEIRA_VENUES = [
  { name: "Clube de Ténis da Figueira da Foz", surface: "clay" as const },
  { name: "Complexo Desportivo Municipal", surface: "hard" as const },
];

export const list = query({
  args: {},
  returns: v.array(doc(schema, "venues")),
  handler: async (ctx) => {
    const { profile } = await getCurrentProfile(ctx);
    const venues = await ctx.db
      .query("venues")
      .withIndex("by_municipality", (q) => q.eq("municipality", profile.municipality))
      .take(100);
    return venues.filter((venue) => venue.isActive);
  },
});

export const seedFigueira = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("venues")
      .withIndex("by_municipality", (q) => q.eq("municipality", "Figueira da Foz"))
      .take(100);
    const names = new Set(existing.map((venue) => venue.name));
    let inserted = 0;
    for (const venue of FIGUEIRA_VENUES) {
      if (names.has(venue.name)) continue;
      await ctx.db.insert("venues", {
        ...venue,
        district: "Coimbra",
        municipality: "Figueira da Foz",
        isActive: true,
      });
      inserted += 1;
    }
    return inserted;
  },
});
```

The `.filter(...)` on `venues` above is a JavaScript array filter over an already-fetched, bounded list, not a database query filter. That is allowed.

- [ ] **Step 4: Run tests, typecheck, lint, commit**

Run: `pnpm --filter @tennis-buddy-finder/backend test` then from root `pnpm run check-types && pnpm run check`.

```bash
git add packages/backend/convex/venues.ts packages/backend/convex/venues.test.ts
git commit -m "feat(backend): venues list and seed" -m "Claude-Session: https://claude.ai/code/session_011WdotxYTNKaLaKeuBUtE1H"
```

---

### Task 6: Blocks

**Files:**
- Create: `packages/backend/convex/model/blocks.ts`
- Create: `packages/backend/convex/blocks.ts`
- Modify: `packages/backend/convex/profiles.ts` (`getByUserId` hides blocked users)
- Test: `packages/backend/convex/blocks.test.ts`

**Interfaces:**
- Produces:
  - `blockedUserIds(ctx, userId): Promise<Set<Id<"users">>>` — users blocked by or blocking `userId`.
  - `isBlockedEitherWay(ctx, a, b): Promise<boolean>`.
  - `api.blocks.block({ userId })`, `api.blocks.unblock({ userId })`, `api.blocks.listMine()` → `{ userId, displayName }[]`.
  - Codes: `CANNOT_BLOCK_SELF`, `NOT_FOUND`.
- Note: cancelling pending requests between the two users on block is added in Task 10 once requests exist.

- [ ] **Step 1: Write the failing tests**

`packages/backend/convex/blocks.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import { isBlockedEitherWay } from "./model/blocks";
import { createUser, setup } from "./test.helpers";

describe("blocks", () => {
  it("block is idempotent and visible in listMine", async () => {
    const t = setup();
    const a = await createUser(t);
    const b = await createUser(t);
    await a.as.mutation(api.blocks.block, { userId: b.userId });
    await a.as.mutation(api.blocks.block, { userId: b.userId });
    const mine = await a.as.query(api.blocks.listMine, {});
    expect(mine).toHaveLength(1);
    expect(mine[0]?.userId).toBe(b.userId);
    await t.run(async (ctx) => {
      expect(await isBlockedEitherWay(ctx, a.userId, b.userId)).toBe(true);
      expect(await isBlockedEitherWay(ctx, b.userId, a.userId)).toBe(true);
    });
  });

  it("cannot block yourself", async () => {
    const t = setup();
    const a = await createUser(t);
    await expect(a.as.mutation(api.blocks.block, { userId: a.userId })).rejects.toThrow(
      "CANNOT_BLOCK_SELF",
    );
  });

  it("unblock removes the block", async () => {
    const t = setup();
    const a = await createUser(t);
    const b = await createUser(t);
    await a.as.mutation(api.blocks.block, { userId: b.userId });
    await a.as.mutation(api.blocks.unblock, { userId: b.userId });
    expect(await a.as.query(api.blocks.listMine, {})).toHaveLength(0);
  });

  it("hides profiles in both directions", async () => {
    const t = setup();
    const a = await createUser(t);
    const b = await createUser(t);
    await a.as.mutation(api.blocks.block, { userId: b.userId });
    await expect(
      a.as.query(api.profiles.getByUserId, { userId: b.userId }),
    ).rejects.toThrow("NOT_FOUND");
    await expect(
      b.as.query(api.profiles.getByUserId, { userId: a.userId }),
    ).rejects.toThrow("NOT_FOUND");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tennis-buddy-finder/backend test`
Expected: FAIL, `./model/blocks` and `api.blocks` missing.

- [ ] **Step 3: Create the model helper**

`packages/backend/convex/model/blocks.ts`:

```ts
import type { Id } from "../_generated/dataModel";

import type { Ctx } from "./auth";

/** Hard cap so a single user's block list cannot make queries unbounded. */
const MAX_BLOCKS = 500;

/** Every user id that `userId` has blocked or that has blocked `userId`. */
export async function blockedUserIds(ctx: Ctx, userId: Id<"users">): Promise<Set<Id<"users">>> {
  const outgoing = await ctx.db
    .query("blocks")
    .withIndex("by_blockerId_and_blockedId", (q) => q.eq("blockerId", userId))
    .take(MAX_BLOCKS);
  const incoming = await ctx.db
    .query("blocks")
    .withIndex("by_blockedId", (q) => q.eq("blockedId", userId))
    .take(MAX_BLOCKS);
  const ids = new Set<Id<"users">>();
  for (const block of outgoing) ids.add(block.blockedId);
  for (const block of incoming) ids.add(block.blockerId);
  return ids;
}

export async function isBlockedEitherWay(
  ctx: Ctx,
  a: Id<"users">,
  b: Id<"users">,
): Promise<boolean> {
  const ab = await ctx.db
    .query("blocks")
    .withIndex("by_blockerId_and_blockedId", (q) => q.eq("blockerId", a).eq("blockedId", b))
    .unique();
  if (ab) return true;
  const ba = await ctx.db
    .query("blocks")
    .withIndex("by_blockerId_and_blockedId", (q) => q.eq("blockerId", b).eq("blockedId", a))
    .unique();
  return ba !== null;
}
```

- [ ] **Step 4: Create blocks.ts**

`packages/backend/convex/blocks.ts`:

```ts
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { getCurrentUser, getProfileForUser } from "./model/auth";
import { fail } from "./model/errors";

export const block = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (args.userId === me._id) fail("CANNOT_BLOCK_SELF");
    const target = await ctx.db.get("users", args.userId);
    if (!target) fail("NOT_FOUND");
    const existing = await ctx.db
      .query("blocks")
      .withIndex("by_blockerId_and_blockedId", (q) =>
        q.eq("blockerId", me._id).eq("blockedId", args.userId),
      )
      .unique();
    if (!existing) {
      await ctx.db.insert("blocks", { blockerId: me._id, blockedId: args.userId });
    }
    return null;
  },
});

export const unblock = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    const existing = await ctx.db
      .query("blocks")
      .withIndex("by_blockerId_and_blockedId", (q) =>
        q.eq("blockerId", me._id).eq("blockedId", args.userId),
      )
      .unique();
    if (existing) await ctx.db.delete("blocks", existing._id);
    return null;
  },
});

export const listMine = query({
  args: {},
  returns: v.array(v.object({ userId: v.id("users"), displayName: v.string() })),
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    const blocks = await ctx.db
      .query("blocks")
      .withIndex("by_blockerId_and_blockedId", (q) => q.eq("blockerId", me._id))
      .take(500);
    const rows = [];
    for (const block of blocks) {
      const profile = await getProfileForUser(ctx, block.blockedId);
      rows.push({ userId: block.blockedId, displayName: profile?.displayName ?? "Deleted user" });
    }
    return rows;
  },
});
```

- [ ] **Step 5: Hide blocked profiles**

In `packages/backend/convex/profiles.ts`, add the import

```ts
import { isBlockedEitherWay } from "./model/blocks";
```

and change the `getByUserId` handler to:

```ts
  handler: async (ctx, args) => {
    const { user } = await getCurrentProfile(ctx);
    if (await isBlockedEitherWay(ctx, user._id, args.userId)) fail("NOT_FOUND");
    const profile = await getProfileForUser(ctx, args.userId);
    if (!profile) fail("NOT_FOUND");
    return withAge(profile);
  },
```

- [ ] **Step 6: Run tests, typecheck, lint, commit**

Run: `pnpm --filter @tennis-buddy-finder/backend test` then from root `pnpm run check-types && pnpm run check`.

```bash
git add packages/backend/convex
git commit -m "feat(backend): block/unblock with profile hiding" -m "Claude-Session: https://claude.ai/code/session_011WdotxYTNKaLaKeuBUtE1H"
```

---

### Task 7: Availability slots (own calendar)

**Files:**
- Create: `packages/backend/convex/availability.ts`
- Test: `packages/backend/convex/availability.test.ts`

**Interfaces:**
- Consumes: `getCurrentProfile`, `fail`, `SLOT_STEP_MS`, `MAX_SLOT_MS`, `DAY`, `isOnSlotGrid`, validators.
- Produces:
  - `api.availability.create({ startAt, endAt, venueId?, note? })` → `Id<"availabilitySlots">`
  - `api.availability.remove({ slotId })` (open slots only, hard delete; pending requests declined in Task 10)
  - `api.availability.cancel({ slotId })` (open → cancelled here; matched handled in Task 10)
  - `api.availability.mine({ from, to })` → slots
  - `api.availability.listOpenForUser({ userId })` → that user's open future slots (blocked → empty)
  - `api.availability.copyLastWeek()` → number created
  - `slotDoc` validator export.
  - Codes: `SLOT_IN_PAST`, `SLOT_NOT_ON_GRID`, `SLOT_TOO_LONG`, `SLOT_INVALID_RANGE`, `SLOT_OVERLAP`, `SLOT_NOT_OPEN`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_VENUE`, `INVALID_NOTE`.
- Search is Task 8.

- [ ] **Step 1: Write the failing tests**

`packages/backend/convex/availability.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import { createUser, setup, DAY, HOUR, NOW } from "./test.helpers";

const tomorrow10 = NOW + DAY - 2 * HOUR; // 2026-09-09T10:00Z

describe("availability.create", () => {
  it("creates an open slot copying the profile location", async () => {
    const t = setup();
    const u = await createUser(t);
    const id = await u.as.mutation(api.availability.create, {
      startAt: tomorrow10,
      endAt: tomorrow10 + 2 * HOUR,
    });
    const mine = await u.as.query(api.availability.mine, { from: NOW, to: NOW + 7 * DAY });
    expect(mine).toHaveLength(1);
    expect(mine[0]?._id).toBe(id);
    expect(mine[0]?.status).toBe("open");
    expect(mine[0]?.municipality).toBe("Figueira da Foz");
  });

  it("rejects past, off-grid, inverted and too long ranges", async () => {
    const t = setup();
    const u = await createUser(t);
    await expect(
      u.as.mutation(api.availability.create, { startAt: NOW - HOUR, endAt: NOW }),
    ).rejects.toThrow("SLOT_IN_PAST");
    await expect(
      u.as.mutation(api.availability.create, {
        startAt: tomorrow10 + 10 * 60 * 1000,
        endAt: tomorrow10 + HOUR,
      }),
    ).rejects.toThrow("SLOT_NOT_ON_GRID");
    await expect(
      u.as.mutation(api.availability.create, { startAt: tomorrow10 + HOUR, endAt: tomorrow10 }),
    ).rejects.toThrow("SLOT_INVALID_RANGE");
    await expect(
      u.as.mutation(api.availability.create, { startAt: tomorrow10, endAt: tomorrow10 + 7 * HOUR }),
    ).rejects.toThrow("SLOT_TOO_LONG");
  });

  it("rejects overlapping slots for the same user but allows touching ones", async () => {
    const t = setup();
    const u = await createUser(t);
    await u.as.mutation(api.availability.create, { startAt: tomorrow10, endAt: tomorrow10 + 2 * HOUR });
    await expect(
      u.as.mutation(api.availability.create, {
        startAt: tomorrow10 + HOUR,
        endAt: tomorrow10 + 3 * HOUR,
      }),
    ).rejects.toThrow("SLOT_OVERLAP");
    await u.as.mutation(api.availability.create, {
      startAt: tomorrow10 + 2 * HOUR,
      endAt: tomorrow10 + 3 * HOUR,
    });
  });

  it("rejects an unknown or inactive venue and a long note", async () => {
    const t = setup();
    const u = await createUser(t);
    const inactive = await t.run(async (ctx) =>
      ctx.db.insert("venues", {
        name: "Old",
        district: "Coimbra",
        municipality: "Figueira da Foz",
        isActive: false,
      }),
    );
    await expect(
      u.as.mutation(api.availability.create, {
        startAt: tomorrow10,
        endAt: tomorrow10 + HOUR,
        venueId: inactive,
      }),
    ).rejects.toThrow("INVALID_VENUE");
    await expect(
      u.as.mutation(api.availability.create, {
        startAt: tomorrow10,
        endAt: tomorrow10 + HOUR,
        note: "x".repeat(201),
      }),
    ).rejects.toThrow("INVALID_NOTE");
  });
});

describe("availability.remove / cancel", () => {
  it("removes my open slot and forbids touching someone else's", async () => {
    const t = setup();
    const a = await createUser(t);
    const b = await createUser(t);
    const id = await a.as.mutation(api.availability.create, {
      startAt: tomorrow10,
      endAt: tomorrow10 + HOUR,
    });
    await expect(b.as.mutation(api.availability.remove, { slotId: id })).rejects.toThrow(
      "FORBIDDEN",
    );
    await a.as.mutation(api.availability.remove, { slotId: id });
    expect(await a.as.query(api.availability.mine, { from: NOW, to: NOW + 7 * DAY })).toHaveLength(0);
  });

  it("cancel marks an open slot cancelled", async () => {
    const t = setup();
    const a = await createUser(t);
    const id = await a.as.mutation(api.availability.create, {
      startAt: tomorrow10,
      endAt: tomorrow10 + HOUR,
    });
    await a.as.mutation(api.availability.cancel, { slotId: id });
    const mine = await a.as.query(api.availability.mine, { from: NOW, to: NOW + 7 * DAY });
    expect(mine[0]?.status).toBe("cancelled");
  });
});

describe("availability.listOpenForUser", () => {
  it("returns only open future slots and nothing when blocked", async () => {
    const t = setup();
    const a = await createUser(t);
    const b = await createUser(t);
    await a.as.mutation(api.availability.create, { startAt: tomorrow10, endAt: tomorrow10 + HOUR });
    const cancelled = await a.as.mutation(api.availability.create, {
      startAt: tomorrow10 + 2 * HOUR,
      endAt: tomorrow10 + 3 * HOUR,
    });
    await a.as.mutation(api.availability.cancel, { slotId: cancelled });
    expect(await b.as.query(api.availability.listOpenForUser, { userId: a.userId })).toHaveLength(1);
    await a.as.mutation(api.blocks.block, { userId: b.userId });
    expect(await b.as.query(api.availability.listOpenForUser, { userId: a.userId })).toHaveLength(0);
  });
});

describe("availability.copyLastWeek", () => {
  it("copies last week forward 7 days, skipping past, cancelled and overlapping copies", async () => {
    const t = setup();
    const a = await createUser(t);
    const lastTue10 = NOW - 7 * DAY - 2 * HOUR; // 2026-09-01T10:00Z
    await t.run(async (ctx) => {
      const base = {
        userId: a.userId,
        district: "Coimbra",
        municipality: "Figueira da Foz",
      };
      // copy would land today 10:00, already in the past -> skipped
      await ctx.db.insert("availabilitySlots", { ...base, startAt: lastTue10, endAt: lastTue10 + HOUR, status: "expired" });
      // copy would land tomorrow 10:00 -> overlaps the pre-existing open slot below -> skipped
      await ctx.db.insert("availabilitySlots", { ...base, startAt: lastTue10 + DAY, endAt: lastTue10 + DAY + HOUR, status: "matched" });
      // cancelled on purpose -> never copied
      await ctx.db.insert("availabilitySlots", { ...base, startAt: lastTue10 + 2 * DAY, endAt: lastTue10 + 2 * DAY + HOUR, status: "cancelled" });
      // copy lands Friday 10:00 -> created
      await ctx.db.insert("availabilitySlots", { ...base, startAt: lastTue10 + 3 * DAY, endAt: lastTue10 + 3 * DAY + HOUR, status: "expired" });
      // pre-existing future slot at tomorrow 10:00
      await ctx.db.insert("availabilitySlots", { ...base, startAt: lastTue10 + 8 * DAY, endAt: lastTue10 + 8 * DAY + HOUR, status: "open" });
    });
    const created = await a.as.mutation(api.availability.copyLastWeek, {});
    expect(created).toBe(1);
    const mine = await a.as.query(api.availability.mine, { from: NOW, to: NOW + 7 * DAY });
    expect(mine.map((s) => s.startAt).sort()).toEqual([lastTue10 + 8 * DAY, lastTue10 + 10 * DAY]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tennis-buddy-finder/backend test`
Expected: FAIL, `api.availability` missing.

- [ ] **Step 3: Create availability.ts**

`packages/backend/convex/availability.ts`:

```ts
import { doc } from "convex-helpers/validators";
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { getCurrentProfile, type Ctx } from "./model/auth";
import { isBlockedEitherWay } from "./model/blocks";
import { fail } from "./model/errors";
import { DAY, isOnSlotGrid, MAX_SLOT_MS } from "./model/time";
import schema from "./schema";

export const slotDoc = doc(schema, "availabilitySlots");

const MAX_SLOTS_PER_QUERY = 200;
const MAX_NOTE = 200;

export function validateRange(startAt: number, endAt: number) {
  if (endAt <= startAt) fail("SLOT_INVALID_RANGE");
  if (!isOnSlotGrid(startAt) || !isOnSlotGrid(endAt)) fail("SLOT_NOT_ON_GRID");
  if (startAt <= Date.now()) fail("SLOT_IN_PAST");
  if (endAt - startAt > MAX_SLOT_MS) fail("SLOT_TOO_LONG");
}

/** True when the user already has a non-cancelled slot intersecting [startAt, endAt). */
export async function hasOverlap(
  ctx: Ctx,
  userId: Id<"users">,
  startAt: number,
  endAt: number,
): Promise<boolean> {
  // Any overlapping slot must start before `endAt` and, since slots are at
  // most MAX_SLOT_MS long, no earlier than startAt - MAX_SLOT_MS.
  const candidates = await ctx.db
    .query("availabilitySlots")
    .withIndex("by_userId_and_startAt", (q) =>
      q.eq("userId", userId).gte("startAt", startAt - MAX_SLOT_MS).lt("startAt", endAt),
    )
    .take(MAX_SLOTS_PER_QUERY);
  return candidates.some(
    (slot) => slot.status !== "cancelled" && slot.endAt > startAt && slot.startAt < endAt,
  );
}

async function validateVenue(ctx: Ctx, venueId: Id<"venues"> | undefined, municipality: string) {
  if (venueId === undefined) return;
  const venue = await ctx.db.get("venues", venueId);
  if (!venue || !venue.isActive || venue.municipality !== municipality) fail("INVALID_VENUE");
}

async function getOwnSlot(ctx: Ctx, userId: Id<"users">, slotId: Id<"availabilitySlots">) {
  const slot = await ctx.db.get("availabilitySlots", slotId);
  if (!slot) fail("NOT_FOUND");
  if (slot.userId !== userId) fail("FORBIDDEN");
  return slot;
}

export const create = mutation({
  args: {
    startAt: v.number(),
    endAt: v.number(),
    venueId: v.optional(v.id("venues")),
    note: v.optional(v.string()),
  },
  returns: v.id("availabilitySlots"),
  handler: async (ctx, args) => {
    const { user, profile } = await getCurrentProfile(ctx);
    validateRange(args.startAt, args.endAt);
    if (args.note !== undefined && args.note.length > MAX_NOTE) fail("INVALID_NOTE");
    await validateVenue(ctx, args.venueId, profile.municipality);
    if (await hasOverlap(ctx, user._id, args.startAt, args.endAt)) fail("SLOT_OVERLAP");
    return ctx.db.insert("availabilitySlots", {
      userId: user._id,
      startAt: args.startAt,
      endAt: args.endAt,
      district: profile.district,
      municipality: profile.municipality,
      venueId: args.venueId,
      note: args.note,
      status: "open",
    });
  },
});

export const remove = mutation({
  args: { slotId: v.id("availabilitySlots") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await getCurrentProfile(ctx);
    const slot = await getOwnSlot(ctx, user._id, args.slotId);
    if (slot.status !== "open") fail("SLOT_NOT_OPEN");
    await ctx.db.delete("availabilitySlots", slot._id);
    return null;
  },
});

export const cancel = mutation({
  args: { slotId: v.id("availabilitySlots") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await getCurrentProfile(ctx);
    const slot = await getOwnSlot(ctx, user._id, args.slotId);
    if (slot.status !== "open") fail("SLOT_NOT_OPEN");
    await ctx.db.patch("availabilitySlots", slot._id, { status: "cancelled" });
    return null;
  },
});

export const mine = query({
  args: { from: v.number(), to: v.number() },
  returns: v.array(slotDoc),
  handler: async (ctx, args) => {
    const { user } = await getCurrentProfile(ctx);
    return ctx.db
      .query("availabilitySlots")
      .withIndex("by_userId_and_startAt", (q) =>
        q.eq("userId", user._id).gte("startAt", args.from).lt("startAt", args.to),
      )
      .take(MAX_SLOTS_PER_QUERY);
  },
});

export const listOpenForUser = query({
  args: { userId: v.id("users") },
  returns: v.array(slotDoc),
  handler: async (ctx, args) => {
    const { user } = await getCurrentProfile(ctx);
    if (await isBlockedEitherWay(ctx, user._id, args.userId)) return [];
    const slots = await ctx.db
      .query("availabilitySlots")
      .withIndex("by_userId_and_startAt", (q) =>
        q.eq("userId", args.userId).gt("startAt", Date.now()),
      )
      .take(MAX_SLOTS_PER_QUERY);
    return slots.filter((slot) => slot.status === "open");
  },
});

export const copyLastWeek = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const { user } = await getCurrentProfile(ctx);
    const now = Date.now();
    const lastWeek: Doc<"availabilitySlots">[] = await ctx.db
      .query("availabilitySlots")
      .withIndex("by_userId_and_startAt", (q) =>
        q.eq("userId", user._id).gte("startAt", now - 7 * DAY).lt("startAt", now),
      )
      .take(MAX_SLOTS_PER_QUERY);
    let created = 0;
    for (const slot of lastWeek) {
      if (slot.status === "cancelled") continue;
      const startAt = slot.startAt + 7 * DAY;
      const endAt = slot.endAt + 7 * DAY;
      if (startAt <= now) continue;
      if (await hasOverlap(ctx, user._id, startAt, endAt)) continue;
      await ctx.db.insert("availabilitySlots", {
        userId: user._id,
        startAt,
        endAt,
        district: slot.district,
        municipality: slot.municipality,
        venueId: slot.venueId,
        note: slot.note,
        status: "open",
      });
      created += 1;
    }
    return created;
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @tennis-buddy-finder/backend test`
Expected: all pass.

- [ ] **Step 5: Typecheck, lint, commit**

Run from root: `pnpm run check-types && pnpm run check`

```bash
git add packages/backend/convex/availability.ts packages/backend/convex/availability.test.ts
git commit -m "feat(backend): availability slots CRUD and copy last week" -m "Claude-Session: https://claude.ai/code/session_011WdotxYTNKaLaKeuBUtE1H"
```

---

### Task 8: Search

**Files:**
- Modify: `packages/backend/convex/availability.ts` (add `search`)
- Test: `packages/backend/convex/availability.search.test.ts`

**Interfaces:**
- Consumes: `blockedUserIds`, `getCurrentProfile`, `withAge`, `paginated`, `slotDoc`.
- Produces: `api.availability.search({ from, to, minNtrp, maxNtrp, format?, venueId?, paginationOpts })` → paginated `{ slot, player: { userId, displayName, age, ntrp, formats, languages, avatarStorageId? } }`. The page is filtered after pagination, so a page may hold fewer items than requested; the client keeps loading while `isDone` is false. Code: `INVALID_RANGE` when `to <= from` or the range exceeds 31 days.

- [ ] **Step 1: Write the failing tests**

`packages/backend/convex/availability.search.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import { createUser, setup, DAY, HOUR, NOW } from "./test.helpers";

const day1 = NOW + DAY - 2 * HOUR;
const page = { numItems: 50, cursor: null };

async function slot(u: Awaited<ReturnType<typeof createUser>>, startAt: number) {
  return u.as.mutation(api.availability.create, { startAt, endAt: startAt + HOUR });
}

describe("availability.search", () => {
  it("returns open slots in my municipality within range and NTRP window, excluding mine", async () => {
    const t = setup();
    const me = await createUser(t, { ntrp: 3.5 });
    const close = await createUser(t, { ntrp: 4 });
    const far = await createUser(t, { ntrp: 5.5 });
    const elsewhere = await createUser(t, { ntrp: 3.5, municipality: "Coimbra" });
    await slot(me, day1);
    await slot(close, day1);
    await slot(far, day1);
    await slot(elsewhere, day1);
    await slot(close, day1 + 10 * DAY);

    const result = await me.as.query(api.availability.search, {
      from: NOW,
      to: NOW + 7 * DAY,
      minNtrp: 3,
      maxNtrp: 4,
      paginationOpts: page,
    });
    expect(result.page).toHaveLength(1);
    expect(result.page[0]?.player.userId).toBe(close.userId);
    expect(result.page[0]?.player.age).toBe(36);
    expect(result.page[0]?.slot.startAt).toBe(day1);
  });

  it("excludes cancelled slots, blocked users in both directions, and applies format and venue filters", async () => {
    const t = setup();
    const me = await createUser(t);
    const blockedByMe = await createUser(t);
    const blockedMe = await createUser(t);
    const singlesOnly = await createUser(t, { formats: "singles" });
    const withVenue = await createUser(t);
    const venueId = await t.run(async (ctx) =>
      ctx.db.insert("venues", {
        name: "V",
        district: "Coimbra",
        municipality: "Figueira da Foz",
        isActive: true,
      }),
    );
    await slot(blockedByMe, day1);
    await slot(blockedMe, day1);
    await slot(singlesOnly, day1);
    const cancelled = await slot(withVenue, day1 + 3 * HOUR);
    await withVenue.as.mutation(api.availability.cancel, { slotId: cancelled });
    await withVenue.as.mutation(api.availability.create, {
      startAt: day1,
      endAt: day1 + HOUR,
      venueId,
    });
    await me.as.mutation(api.blocks.block, { userId: blockedByMe.userId });
    await blockedMe.as.mutation(api.blocks.block, { userId: me.userId });

    const base = { from: NOW, to: NOW + 7 * DAY, minNtrp: 1, maxNtrp: 7, paginationOpts: page };
    const all = await me.as.query(api.availability.search, base);
    expect(all.page.map((r) => r.player.userId).sort()).toEqual(
      [singlesOnly.userId, withVenue.userId].sort(),
    );

    const doubles = await me.as.query(api.availability.search, { ...base, format: "doubles" });
    expect(doubles.page.map((r) => r.player.userId)).toEqual([withVenue.userId]);

    const atVenue = await me.as.query(api.availability.search, { ...base, venueId });
    expect(atVenue.page.map((r) => r.player.userId)).toEqual([withVenue.userId]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tennis-buddy-finder/backend test`
Expected: FAIL, `api.availability.search` missing.

- [ ] **Step 3: Add search to availability.ts**

Add these imports at the top of `packages/backend/convex/availability.ts`:

```ts
import { paginationOptsValidator } from "convex/server";

import { blockedUserIds } from "./model/blocks";
import { formatsValidator, paginated } from "./model/validators";
import { withAge } from "./profiles";
```

Append:

```ts
const playerCard = v.object({
  userId: v.id("users"),
  displayName: v.string(),
  age: v.number(),
  ntrp: v.number(),
  formats: formatsValidator,
  languages: v.array(v.string()),
  avatarStorageId: v.optional(v.id("_storage")),
});

const MAX_RANGE = 31 * DAY;

export const search = query({
  args: {
    from: v.number(),
    to: v.number(),
    minNtrp: v.number(),
    maxNtrp: v.number(),
    format: v.optional(formatsValidator),
    venueId: v.optional(v.id("venues")),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginated(v.object({ slot: slotDoc, player: playerCard })),
  handler: async (ctx, args) => {
    const { user, profile } = await getCurrentProfile(ctx);
    if (args.to <= args.from || args.to - args.from > MAX_RANGE) fail("INVALID_RANGE");
    const from = Math.max(args.from, Date.now());
    const excluded = await blockedUserIds(ctx, user._id);
    excluded.add(user._id);

    const result = await ctx.db
      .query("availabilitySlots")
      .withIndex("by_municipality_and_status_and_startAt", (q) =>
        q
          .eq("municipality", profile.municipality)
          .eq("status", "open")
          .gte("startAt", from)
          .lt("startAt", args.to),
      )
      .paginate(args.paginationOpts);

    const page = [];
    for (const slot of result.page) {
      if (excluded.has(slot.userId)) continue;
      if (args.venueId !== undefined && slot.venueId !== args.venueId) continue;
      const p = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", slot.userId))
        .unique();
      if (!p) continue;
      if (p.ntrp < args.minNtrp || p.ntrp > args.maxNtrp) continue;
      if (args.format !== undefined && p.formats !== "both" && p.formats !== args.format) continue;
      const { age } = withAge(p);
      page.push({
        slot,
        player: {
          userId: p.userId,
          displayName: p.displayName,
          age,
          ntrp: p.ntrp,
          formats: p.formats,
          languages: p.languages,
          avatarStorageId: p.avatarStorageId,
        },
      });
    }
    return { ...result, page };
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @tennis-buddy-finder/backend test`
Expected: all pass. The format rule: a player whose profile says `"both"` matches any requested format; `"singles"` only matches `"singles"`.

- [ ] **Step 5: Typecheck, lint, commit**

Run from root: `pnpm run check-types && pnpm run check`

```bash
git add packages/backend/convex/availability.ts packages/backend/convex/availability.search.test.ts
git commit -m "feat(backend): paginated availability search with NTRP, format, venue and block filters" -m "Claude-Session: https://claude.ai/code/session_011WdotxYTNKaLaKeuBUtE1H"
```

---

### Task 9: Notifications

**Files:**
- Create: `packages/backend/convex/model/notifications.ts`
- Create: `packages/backend/convex/notifications.ts`
- Test: `packages/backend/convex/notifications.test.ts`

**Interfaces:**
- Produces:
  - `createNotification(ctx: MutationCtx, input: { userId, type, requestId?, conversationId? }): Promise<Id<"notifications">>`. Plan 2 adds `ctx.scheduler.runAfter(0, internal.email.sendForNotification, { notificationId })` inside this helper; nothing else changes.
  - `api.notifications.unread()` → newest 50 unread; `api.notifications.markAllRead()`; `api.notifications.markRead({ notificationId })`.

- [ ] **Step 1: Write the failing tests**

`packages/backend/convex/notifications.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import { createNotification } from "./model/notifications";
import { createUser, setup } from "./test.helpers";

describe("notifications", () => {
  it("lists unread for me only and marks all read", async () => {
    const t = setup();
    const a = await createUser(t);
    const b = await createUser(t);
    await t.run(async (ctx) => {
      await createNotification(ctx, { userId: a.userId, type: "request_received" });
      await createNotification(ctx, { userId: a.userId, type: "new_message" });
      await createNotification(ctx, { userId: b.userId, type: "request_accepted" });
    });
    expect(await a.as.query(api.notifications.unread, {})).toHaveLength(2);
    await a.as.mutation(api.notifications.markAllRead, {});
    expect(await a.as.query(api.notifications.unread, {})).toHaveLength(0);
    expect(await b.as.query(api.notifications.unread, {})).toHaveLength(1);
  });

  it("markRead only touches my own notification", async () => {
    const t = setup();
    const a = await createUser(t);
    const b = await createUser(t);
    const id = await t.run(async (ctx) =>
      createNotification(ctx, { userId: a.userId, type: "request_received" }),
    );
    await expect(b.as.mutation(api.notifications.markRead, { notificationId: id })).rejects.toThrow(
      "FORBIDDEN",
    );
    await a.as.mutation(api.notifications.markRead, { notificationId: id });
    expect(await a.as.query(api.notifications.unread, {})).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tennis-buddy-finder/backend test`
Expected: FAIL.

- [ ] **Step 3: Create the model helper**

`packages/backend/convex/model/notifications.ts`:

```ts
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

type NotificationInput = {
  userId: Id<"users">;
  type: Doc<"notifications">["type"];
  requestId?: Id<"matchRequests">;
  conversationId?: Id<"conversations">;
};

/**
 * Single entry point for creating notifications. Plan 2 (email) schedules the
 * email action from here so every caller gets it for free.
 */
export async function createNotification(
  ctx: MutationCtx,
  input: NotificationInput,
): Promise<Id<"notifications">> {
  return ctx.db.insert("notifications", {
    userId: input.userId,
    type: input.type,
    requestId: input.requestId,
    conversationId: input.conversationId,
  });
}
```

- [ ] **Step 4: Create notifications.ts**

`packages/backend/convex/notifications.ts`:

```ts
import { doc } from "convex-helpers/validators";
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./model/auth";
import { fail } from "./model/errors";
import schema from "./schema";

const MAX_UNREAD = 50;

export const unread = query({
  args: {},
  returns: v.array(doc(schema, "notifications")),
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    return ctx.db
      .query("notifications")
      .withIndex("by_userId_and_readAt", (q) => q.eq("userId", me._id).eq("readAt", undefined))
      .order("desc")
      .take(MAX_UNREAD);
  },
});

export const markAllRead = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    const now = Date.now();
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_userId_and_readAt", (q) => q.eq("userId", me._id).eq("readAt", undefined))
      .take(200);
    for (const row of rows) await ctx.db.patch("notifications", row._id, { readAt: now });
    return null;
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    const row = await ctx.db.get("notifications", args.notificationId);
    if (!row) fail("NOT_FOUND");
    if (row.userId !== me._id) fail("FORBIDDEN");
    if (row.readAt === undefined) {
      await ctx.db.patch("notifications", row._id, { readAt: Date.now() });
    }
    return null;
  },
});
```

`q.eq("readAt", undefined)` matches documents where the optional field is absent; that is how "unread" is indexed.

- [ ] **Step 5: Run tests, typecheck, lint, commit**

Run: `pnpm --filter @tennis-buddy-finder/backend test` then from root `pnpm run check-types && pnpm run check`.

```bash
git add packages/backend/convex
git commit -m "feat(backend): notifications helper and unread/markRead functions" -m "Claude-Session: https://claude.ai/code/session_011WdotxYTNKaLaKeuBUtE1H"
```

---

### Task 10: Match requests and conversation creation

**Files:**
- Create: `packages/backend/convex/model/conversations.ts`
- Create: `packages/backend/convex/model/requests.ts`
- Create: `packages/backend/convex/matchRequests.ts`
- Modify: `packages/backend/convex/availability.ts` (`remove` declines pending requests; `cancel` handles matched slots)
- Modify: `packages/backend/convex/blocks.ts` (`block` cancels pending requests between the pair)
- Test: `packages/backend/convex/matchRequests.test.ts`

**Interfaces:**
- Consumes: `createNotification`, `isBlockedEitherWay`, `getCurrentProfile`, `withAge`, `slotDoc`.
- Produces:
  - `getOrCreateConversation(ctx, a, b): Promise<Id<"conversations">>` (pair ordered by id string; members created with `lastReadAt = now`).
  - `declinePendingForSlot(ctx, slotId, except?: Id<"matchRequests">)` exported from `model/requests.ts`.
  - `cancelPendingBetween(ctx, a, b)` exported from `model/requests.ts`.
  - Import direction is `matchRequests.ts → availability.ts → model/requests.ts`; nothing imports back from `matchRequests.ts`, so there is no cycle.
  - `api.matchRequests.send({ slotId, message? })` → `Id<"matchRequests">`; `accept`, `decline`, `cancel` `({ requestId })`; `received()` and `sent()` → `{ request, slot, player }[]`.
  - Codes: `SLOT_NOT_OPEN`, `SLOT_IN_PAST`, `CANNOT_REQUEST_OWN_SLOT`, `BLOCKED`, `REQUEST_EXISTS`, `REQUEST_NOT_PENDING`, `FORBIDDEN`, `NOT_FOUND`, `INVALID_MESSAGE`.

- [ ] **Step 1: Write the failing tests**

`packages/backend/convex/matchRequests.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import { createUser, setup, DAY, HOUR, NOW } from "./test.helpers";

const day1 = NOW + DAY - 2 * HOUR;

async function openSlot(u: Awaited<ReturnType<typeof createUser>>, startAt = day1) {
  return u.as.mutation(api.availability.create, { startAt, endAt: startAt + HOUR });
}

describe("matchRequests.send", () => {
  it("creates a pending request and notifies the owner", async () => {
    const t = setup();
    const owner = await createUser(t);
    const asker = await createUser(t);
    const slotId = await openSlot(owner);
    await asker.as.mutation(api.matchRequests.send, { slotId, message: "Up for a set?" });
    const received = await owner.as.query(api.matchRequests.received, {});
    expect(received).toHaveLength(1);
    expect(received[0]?.request.status).toBe("pending");
    expect(received[0]?.player.userId).toBe(asker.userId);
    const sent = await asker.as.query(api.matchRequests.sent, {});
    expect(sent).toHaveLength(1);
    const notes = await owner.as.query(api.notifications.unread, {});
    expect(notes[0]?.type).toBe("request_received");
  });

  it("rejects own slot, duplicates, blocked pairs, non-open slots and long messages", async () => {
    const t = setup();
    const owner = await createUser(t);
    const asker = await createUser(t);
    const slotId = await openSlot(owner);
    await expect(owner.as.mutation(api.matchRequests.send, { slotId })).rejects.toThrow(
      "CANNOT_REQUEST_OWN_SLOT",
    );
    await expect(
      asker.as.mutation(api.matchRequests.send, { slotId, message: "x".repeat(301) }),
    ).rejects.toThrow("INVALID_MESSAGE");
    await asker.as.mutation(api.matchRequests.send, { slotId });
    await expect(asker.as.mutation(api.matchRequests.send, { slotId })).rejects.toThrow(
      "REQUEST_EXISTS",
    );
    const other = await createUser(t);
    await owner.as.mutation(api.blocks.block, { userId: other.userId });
    await expect(other.as.mutation(api.matchRequests.send, { slotId })).rejects.toThrow("BLOCKED");
    const cancelledSlot = await openSlot(owner, day1 + 3 * HOUR);
    await owner.as.mutation(api.availability.cancel, { slotId: cancelledSlot });
    const third = await createUser(t);
    await expect(third.as.mutation(api.matchRequests.send, { slotId: cancelledSlot })).rejects.toThrow(
      "SLOT_NOT_OPEN",
    );
  });
});

describe("matchRequests.accept", () => {
  it("matches the slot, declines others, opens a conversation and notifies", async () => {
    const t = setup();
    const owner = await createUser(t);
    const a = await createUser(t);
    const b = await createUser(t);
    const slotId = await openSlot(owner);
    const reqA = await a.as.mutation(api.matchRequests.send, { slotId });
    const reqB = await b.as.mutation(api.matchRequests.send, { slotId });

    await owner.as.mutation(api.matchRequests.accept, { requestId: reqA });

    const slot = await t.run(async (ctx) => ctx.db.get("availabilitySlots", slotId));
    expect(slot?.status).toBe("matched");
    const [rowA, rowB] = await t.run(async (ctx) =>
      Promise.all([ctx.db.get("matchRequests", reqA), ctx.db.get("matchRequests", reqB)]),
    );
    expect(rowA?.status).toBe("accepted");
    expect(rowA?.conversationId).toBeTruthy();
    expect(rowB?.status).toBe("declined");

    const aNotes = await a.as.query(api.notifications.unread, {});
    expect(aNotes.map((n) => n.type)).toEqual(["request_accepted"]);
    const bNotes = await b.as.query(api.notifications.unread, {});
    expect(bNotes.map((n) => n.type)).toEqual(["request_declined"]);

    const convs = await a.as.query(api.conversations.list, {});
    expect(convs).toHaveLength(1);
    expect(convs[0]?.otherUserId).toBe(owner.userId);
  });

  it("reuses the conversation for the same pair", async () => {
    const t = setup();
    const owner = await createUser(t);
    const a = await createUser(t);
    const s1 = await openSlot(owner);
    const s2 = await openSlot(owner, day1 + 3 * HOUR);
    const r1 = await a.as.mutation(api.matchRequests.send, { slotId: s1 });
    const r2 = await a.as.mutation(api.matchRequests.send, { slotId: s2 });
    await owner.as.mutation(api.matchRequests.accept, { requestId: r1 });
    await owner.as.mutation(api.matchRequests.accept, { requestId: r2 });
    expect(await a.as.query(api.conversations.list, {})).toHaveLength(1);
  });

  it("only the slot owner can accept, and only pending requests", async () => {
    const t = setup();
    const owner = await createUser(t);
    const a = await createUser(t);
    const slotId = await openSlot(owner);
    const req = await a.as.mutation(api.matchRequests.send, { slotId });
    await expect(a.as.mutation(api.matchRequests.accept, { requestId: req })).rejects.toThrow(
      "FORBIDDEN",
    );
    await owner.as.mutation(api.matchRequests.decline, { requestId: req });
    await expect(owner.as.mutation(api.matchRequests.accept, { requestId: req })).rejects.toThrow(
      "REQUEST_NOT_PENDING",
    );
  });
});

describe("matchRequests.cancel", () => {
  it("sender cancels a pending request silently", async () => {
    const t = setup();
    const owner = await createUser(t);
    const a = await createUser(t);
    const slotId = await openSlot(owner);
    const req = await a.as.mutation(api.matchRequests.send, { slotId });
    await expect(owner.as.mutation(api.matchRequests.cancel, { requestId: req })).rejects.toThrow(
      "FORBIDDEN",
    );
    await a.as.mutation(api.matchRequests.cancel, { requestId: req });
    expect(await owner.as.query(api.matchRequests.received, {})).toHaveLength(0);
    expect(await owner.as.query(api.notifications.unread, {})).toHaveLength(1); // only request_received
  });
});

describe("slot and block cascades", () => {
  it("removing an open slot declines pending requests", async () => {
    const t = setup();
    const owner = await createUser(t);
    const a = await createUser(t);
    const slotId = await openSlot(owner);
    const req = await a.as.mutation(api.matchRequests.send, { slotId });
    await owner.as.mutation(api.availability.remove, { slotId });
    const row = await t.run(async (ctx) => ctx.db.get("matchRequests", req));
    expect(row?.status).toBe("declined");
  });

  it("cancelling a matched slot cancels the accepted request and notifies", async () => {
    const t = setup();
    const owner = await createUser(t);
    const a = await createUser(t);
    const slotId = await openSlot(owner);
    const req = await a.as.mutation(api.matchRequests.send, { slotId });
    await owner.as.mutation(api.matchRequests.accept, { requestId: req });
    await owner.as.mutation(api.availability.cancel, { slotId });
    const row = await t.run(async (ctx) => ctx.db.get("matchRequests", req));
    expect(row?.status).toBe("cancelled");
    const notes = await a.as.query(api.notifications.unread, {});
    expect(notes.map((n) => n.type).sort()).toEqual(["request_accepted", "request_declined"]);
  });

  it("blocking cancels pending requests in both directions", async () => {
    const t = setup();
    const a = await createUser(t);
    const b = await createUser(t);
    const sa = await openSlot(a);
    const sb = await openSlot(b);
    const rb = await b.as.mutation(api.matchRequests.send, { slotId: sa });
    const ra = await a.as.mutation(api.matchRequests.send, { slotId: sb });
    await a.as.mutation(api.blocks.block, { userId: b.userId });
    const [rowA, rowB] = await t.run(async (ctx) =>
      Promise.all([ctx.db.get("matchRequests", ra), ctx.db.get("matchRequests", rb)]),
    );
    expect(rowA?.status).toBe("cancelled");
    expect(rowB?.status).toBe("cancelled");
  });
});
```

`api.conversations.list` is implemented in Task 11; until then the two tests that use it fail. Implement Task 10 and Task 11 back to back, or temporarily skip those two tests with `it.skip` and un-skip them in Task 11.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tennis-buddy-finder/backend test`
Expected: FAIL, `api.matchRequests` missing.

- [ ] **Step 3: Create the conversation helper**

`packages/backend/convex/model/conversations.ts`:

```ts
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export function orderPair(a: Id<"users">, b: Id<"users">): [Id<"users">, Id<"users">] {
  return a < b ? [a, b] : [b, a];
}

/** Finds the conversation for a pair or creates it with both memberships. */
export async function getOrCreateConversation(
  ctx: MutationCtx,
  a: Id<"users">,
  b: Id<"users">,
): Promise<Id<"conversations">> {
  const [userAId, userBId] = orderPair(a, b);
  const existing = await ctx.db
    .query("conversations")
    .withIndex("by_userAId_and_userBId", (q) => q.eq("userAId", userAId).eq("userBId", userBId))
    .unique();
  if (existing) return existing._id;
  const now = Date.now();
  const conversationId = await ctx.db.insert("conversations", {
    userAId,
    userBId,
    lastMessageAt: now,
  });
  await ctx.db.insert("conversationMembers", { conversationId, userId: userAId, lastReadAt: now });
  await ctx.db.insert("conversationMembers", { conversationId, userId: userBId, lastReadAt: now });
  return conversationId;
}
```

- [ ] **Step 4: Create the request cascade helpers**

`packages/backend/convex/model/requests.ts`:

```ts
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

import { createNotification } from "./notifications";

const MAX_LIST = 100;

/** Decline every pending request on a slot except `except`, notifying senders. */
export async function declinePendingForSlot(
  ctx: MutationCtx,
  slotId: Id<"availabilitySlots">,
  except?: Id<"matchRequests">,
) {
  const pending = await ctx.db
    .query("matchRequests")
    .withIndex("by_slotId_and_status", (q) => q.eq("slotId", slotId).eq("status", "pending"))
    .take(MAX_LIST);
  const now = Date.now();
  for (const request of pending) {
    if (request._id === except) continue;
    await ctx.db.patch("matchRequests", request._id, { status: "declined", respondedAt: now });
    await createNotification(ctx, {
      userId: request.fromUserId,
      type: "request_declined",
      requestId: request._id,
    });
  }
}

/** Silently cancel pending requests between two users, both directions. */
export async function cancelPendingBetween(ctx: MutationCtx, a: Id<"users">, b: Id<"users">) {
  const now = Date.now();
  for (const [from, to] of [
    [a, b],
    [b, a],
  ] as const) {
    const pending = await ctx.db
      .query("matchRequests")
      .withIndex("by_fromUserId_and_status", (q) => q.eq("fromUserId", from).eq("status", "pending"))
      .take(MAX_LIST);
    for (const request of pending) {
      if (request.toUserId !== to) continue;
      await ctx.db.patch("matchRequests", request._id, { status: "cancelled", respondedAt: now });
    }
  }
}
```

- [ ] **Step 5: Create matchRequests.ts**

`packages/backend/convex/matchRequests.ts`:

```ts
import { doc } from "convex-helpers/validators";
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { slotDoc } from "./availability";
import { getCurrentProfile, getProfileForUser, type Ctx } from "./model/auth";
import { isBlockedEitherWay } from "./model/blocks";
import { getOrCreateConversation } from "./model/conversations";
import { fail } from "./model/errors";
import { createNotification } from "./model/notifications";
import { declinePendingForSlot } from "./model/requests";
import { withAge } from "./profiles";
import schema from "./schema";

const MAX_MESSAGE = 300;
const MAX_LIST = 100;

const requestDoc = doc(schema, "matchRequests");

const requestView = v.object({
  request: requestDoc,
  slot: slotDoc,
  player: v.object({
    userId: v.id("users"),
    displayName: v.string(),
    age: v.number(),
    ntrp: v.number(),
  }),
});

async function getRequest(ctx: Ctx, requestId: Id<"matchRequests">) {
  const request = await ctx.db.get("matchRequests", requestId);
  if (!request) fail("NOT_FOUND");
  return request;
}

async function toView(ctx: Ctx, request: Doc<"matchRequests">, playerId: Id<"users">) {
  const slot = await ctx.db.get("availabilitySlots", request.slotId);
  const profile = await getProfileForUser(ctx, playerId);
  if (!slot || !profile) return null;
  const { age } = withAge(profile);
  return {
    request,
    slot,
    player: { userId: profile.userId, displayName: profile.displayName, age, ntrp: profile.ntrp },
  };
}

export const send = mutation({
  args: { slotId: v.id("availabilitySlots"), message: v.optional(v.string()) },
  returns: v.id("matchRequests"),
  handler: async (ctx, args) => {
    const { user } = await getCurrentProfile(ctx);
    if (args.message !== undefined && args.message.length > MAX_MESSAGE) fail("INVALID_MESSAGE");
    const slot = await ctx.db.get("availabilitySlots", args.slotId);
    if (!slot) fail("NOT_FOUND");
    if (slot.userId === user._id) fail("CANNOT_REQUEST_OWN_SLOT");
    if (slot.status !== "open") fail("SLOT_NOT_OPEN");
    if (slot.startAt <= Date.now()) fail("SLOT_IN_PAST");
    if (await isBlockedEitherWay(ctx, user._id, slot.userId)) fail("BLOCKED");
    const existing = await ctx.db
      .query("matchRequests")
      .withIndex("by_slotId_and_fromUserId", (q) =>
        q.eq("slotId", slot._id).eq("fromUserId", user._id),
      )
      .take(10);
    if (existing.some((r) => r.status === "pending")) fail("REQUEST_EXISTS");
    const requestId = await ctx.db.insert("matchRequests", {
      slotId: slot._id,
      fromUserId: user._id,
      toUserId: slot.userId,
      message: args.message,
      status: "pending",
    });
    await createNotification(ctx, {
      userId: slot.userId,
      type: "request_received",
      requestId,
    });
    return requestId;
  },
});

export const accept = mutation({
  args: { requestId: v.id("matchRequests") },
  returns: v.id("conversations"),
  handler: async (ctx, args) => {
    const { user } = await getCurrentProfile(ctx);
    const request = await getRequest(ctx, args.requestId);
    if (request.toUserId !== user._id) fail("FORBIDDEN");
    if (request.status !== "pending") fail("REQUEST_NOT_PENDING");
    const slot = await ctx.db.get("availabilitySlots", request.slotId);
    if (!slot || slot.status !== "open") fail("SLOT_NOT_OPEN");
    if (await isBlockedEitherWay(ctx, user._id, request.fromUserId)) fail("BLOCKED");

    const now = Date.now();
    const conversationId = await getOrCreateConversation(ctx, user._id, request.fromUserId);
    await ctx.db.patch("matchRequests", request._id, {
      status: "accepted",
      respondedAt: now,
      conversationId,
    });
    await ctx.db.patch("availabilitySlots", slot._id, { status: "matched" });
    await declinePendingForSlot(ctx, slot._id, request._id);
    await createNotification(ctx, {
      userId: request.fromUserId,
      type: "request_accepted",
      requestId: request._id,
      conversationId,
    });
    return conversationId;
  },
});

export const decline = mutation({
  args: { requestId: v.id("matchRequests") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await getCurrentProfile(ctx);
    const request = await getRequest(ctx, args.requestId);
    if (request.toUserId !== user._id) fail("FORBIDDEN");
    if (request.status !== "pending") fail("REQUEST_NOT_PENDING");
    await ctx.db.patch("matchRequests", request._id, {
      status: "declined",
      respondedAt: Date.now(),
    });
    await createNotification(ctx, {
      userId: request.fromUserId,
      type: "request_declined",
      requestId: request._id,
    });
    return null;
  },
});

export const cancel = mutation({
  args: { requestId: v.id("matchRequests") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await getCurrentProfile(ctx);
    const request = await getRequest(ctx, args.requestId);
    if (request.fromUserId !== user._id) fail("FORBIDDEN");
    if (request.status !== "pending") fail("REQUEST_NOT_PENDING");
    await ctx.db.patch("matchRequests", request._id, {
      status: "cancelled",
      respondedAt: Date.now(),
    });
    return null;
  },
});

export const received = query({
  args: {},
  returns: v.array(requestView),
  handler: async (ctx) => {
    const { user } = await getCurrentProfile(ctx);
    const rows = await ctx.db
      .query("matchRequests")
      .withIndex("by_toUserId_and_status", (q) => q.eq("toUserId", user._id).eq("status", "pending"))
      .order("desc")
      .take(MAX_LIST);
    const views = [];
    for (const row of rows) {
      const view = await toView(ctx, row, row.fromUserId);
      if (view) views.push(view);
    }
    return views;
  },
});

export const sent = query({
  args: {},
  returns: v.array(requestView),
  handler: async (ctx) => {
    const { user } = await getCurrentProfile(ctx);
    const views = [];
    for (const status of ["pending", "accepted", "declined"] as const) {
      const rows = await ctx.db
        .query("matchRequests")
        .withIndex("by_fromUserId_and_status", (q) =>
          q.eq("fromUserId", user._id).eq("status", status),
        )
        .order("desc")
        .take(MAX_LIST);
      for (const row of rows) {
        const view = await toView(ctx, row, row.toUserId);
        if (view) views.push(view);
      }
    }
    return views.sort((a, b) => b.request._creationTime - a.request._creationTime);
  },
});
```

- [ ] **Step 6: Wire cascades into availability.ts and blocks.ts**

In `packages/backend/convex/availability.ts` add:

```ts
import { createNotification } from "./model/notifications";
import { declinePendingForSlot } from "./model/requests";
```

and replace the `remove` and `cancel` mutations with:

```ts
export const remove = mutation({
  args: { slotId: v.id("availabilitySlots") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await getCurrentProfile(ctx);
    const slot = await getOwnSlot(ctx, user._id, args.slotId);
    if (slot.status !== "open") fail("SLOT_NOT_OPEN");
    await declinePendingForSlot(ctx, slot._id);
    await ctx.db.delete("availabilitySlots", slot._id);
    return null;
  },
});

export const cancel = mutation({
  args: { slotId: v.id("availabilitySlots") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await getCurrentProfile(ctx);
    const slot = await getOwnSlot(ctx, user._id, args.slotId);
    if (slot.status !== "open" && slot.status !== "matched") fail("SLOT_NOT_OPEN");
    await declinePendingForSlot(ctx, slot._id);
    if (slot.status === "matched") {
      const accepted = await ctx.db
        .query("matchRequests")
        .withIndex("by_slotId_and_status", (q) => q.eq("slotId", slot._id).eq("status", "accepted"))
        .take(5);
      for (const request of accepted) {
        await ctx.db.patch("matchRequests", request._id, {
          status: "cancelled",
          respondedAt: Date.now(),
        });
        await createNotification(ctx, {
          userId: request.fromUserId,
          type: "request_declined",
          requestId: request._id,
        });
      }
    }
    await ctx.db.patch("availabilitySlots", slot._id, { status: "cancelled" });
    return null;
  },
});
```

In `packages/backend/convex/blocks.ts`, add `import { cancelPendingBetween } from "./model/requests";` and, inside `block` after the insert branch, call:

```ts
    await cancelPendingBetween(ctx, me._id, args.userId);
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm --filter @tennis-buddy-finder/backend test`
Expected: all pass except the two `conversations.list` tests if Task 11 is not done yet.

- [ ] **Step 8: Typecheck, lint, commit**

Run from root: `pnpm run check-types && pnpm run check`

```bash
git add packages/backend/convex
git commit -m "feat(backend): match requests with accept cascade and conversation creation" -m "Claude-Session: https://claude.ai/code/session_011WdotxYTNKaLaKeuBUtE1H"
```

---

### Task 11: Conversations and messages

**Files:**
- Create: `packages/backend/convex/conversations.ts`
- Create: `packages/backend/convex/messages.ts`
- Test: `packages/backend/convex/messages.test.ts`

**Interfaces:**
- Consumes: `getOrCreateConversation`, `isBlockedEitherWay`, `blockedUserIds`, `createNotification`, `getProfileForUser`, `paginated`.
- Produces:
  - `api.conversations.list()` → `{ conversationId, otherUserId, otherDisplayName, lastMessageAt, unreadCount }[]` sorted by `lastMessageAt` desc, excluding blocked pairs.
  - `api.conversations.get({ conversationId })` → `{ conversationId, otherUserId, otherDisplayName }`.
  - `api.conversations.markRead({ conversationId })`.
  - `api.messages.send({ conversationId, body })` → `Id<"messages">`; `api.messages.list({ conversationId, paginationOpts })` → paginated message docs, newest first.
  - Codes: `NOT_A_MEMBER`, `BLOCKED`, `INVALID_MESSAGE`, `NOT_FOUND`.

- [ ] **Step 1: Write the failing tests**

`packages/backend/convex/messages.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import { getOrCreateConversation } from "./model/conversations";
import { createUser, setup, NOW } from "./test.helpers";

const page = { numItems: 50, cursor: null };

async function pair(t: ReturnType<typeof setup>) {
  const a = await createUser(t);
  const b = await createUser(t);
  const conversationId = await t.run(async (ctx) =>
    getOrCreateConversation(ctx, a.userId, b.userId),
  );
  return { a, b, conversationId };
}

describe("messages.send / list", () => {
  it("members can exchange messages; list is newest first", async () => {
    const t = setup();
    const { a, b, conversationId } = await pair(t);
    await a.as.mutation(api.messages.send, { conversationId, body: "Olá" });
    vi.setSystemTime(NOW + 1000);
    await b.as.mutation(api.messages.send, { conversationId, body: "Olá!" });
    const list = await a.as.query(api.messages.list, { conversationId, paginationOpts: page });
    expect(list.page.map((m) => m.body)).toEqual(["Olá!", "Olá"]);
  });

  it("non-members cannot read or write", async () => {
    const t = setup();
    const { conversationId } = await pair(t);
    const c = await createUser(t);
    await expect(
      c.as.mutation(api.messages.send, { conversationId, body: "hi" }),
    ).rejects.toThrow("NOT_A_MEMBER");
    await expect(
      c.as.query(api.messages.list, { conversationId, paginationOpts: page }),
    ).rejects.toThrow("NOT_A_MEMBER");
  });

  it("rejects empty, whitespace and over-long bodies", async () => {
    const t = setup();
    const { a, conversationId } = await pair(t);
    await expect(a.as.mutation(api.messages.send, { conversationId, body: "  " })).rejects.toThrow(
      "INVALID_MESSAGE",
    );
    await expect(
      a.as.mutation(api.messages.send, { conversationId, body: "x".repeat(2001) }),
    ).rejects.toThrow("INVALID_MESSAGE");
  });

  it("blocked pairs cannot send and the conversation is hidden from both lists", async () => {
    const t = setup();
    const { a, b, conversationId } = await pair(t);
    await a.as.mutation(api.blocks.block, { userId: b.userId });
    await expect(
      b.as.mutation(api.messages.send, { conversationId, body: "hey" }),
    ).rejects.toThrow("BLOCKED");
    expect(await a.as.query(api.conversations.list, {})).toHaveLength(0);
    expect(await b.as.query(api.conversations.list, {})).toHaveLength(0);
  });

  it("notifies on the first unread message only, until the recipient reads", async () => {
    const t = setup();
    const { a, b, conversationId } = await pair(t);
    await a.as.mutation(api.messages.send, { conversationId, body: "1" });
    await a.as.mutation(api.messages.send, { conversationId, body: "2" });
    expect(await b.as.query(api.notifications.unread, {})).toHaveLength(1);

    await b.as.mutation(api.conversations.markRead, { conversationId });
    vi.setSystemTime(NOW + 5000);
    await a.as.mutation(api.messages.send, { conversationId, body: "3" });
    expect(await b.as.query(api.notifications.unread, {})).toHaveLength(1); // old one marked read, new one created

    const list = await b.as.query(api.conversations.list, {});
    expect(list[0]?.unreadCount).toBe(1);
  });
});

describe("conversations.list / get", () => {
  it("returns the other participant and unread counts sorted by activity", async () => {
    const t = setup();
    const { a, b, conversationId } = await pair(t);
    await a.as.mutation(api.messages.send, { conversationId, body: "hi" });
    const list = await b.as.query(api.conversations.list, {});
    expect(list).toHaveLength(1);
    expect(list[0]?.otherUserId).toBe(a.userId);
    expect(list[0]?.unreadCount).toBe(1);
    const got = await b.as.query(api.conversations.get, { conversationId });
    expect(got.otherUserId).toBe(a.userId);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tennis-buddy-finder/backend test`
Expected: FAIL, `api.messages` / `api.conversations` missing.

- [ ] **Step 3: Create conversations.ts**

`packages/backend/convex/conversations.ts`:

```ts
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { getCurrentProfile, getProfileForUser, type Ctx } from "./model/auth";
import { blockedUserIds } from "./model/blocks";
import { fail } from "./model/errors";

const MAX_CONVERSATIONS = 100;
const MAX_UNREAD_COUNT = 99;

export async function requireMembership(
  ctx: Ctx,
  conversationId: Id<"conversations">,
  userId: Id<"users">,
): Promise<{ conversation: Doc<"conversations">; member: Doc<"conversationMembers"> }> {
  const conversation = await ctx.db.get("conversations", conversationId);
  if (!conversation) fail("NOT_FOUND");
  const member = await ctx.db
    .query("conversationMembers")
    .withIndex("by_conversationId_and_userId", (q) =>
      q.eq("conversationId", conversationId).eq("userId", userId),
    )
    .unique();
  if (!member) fail("NOT_A_MEMBER");
  return { conversation, member };
}

export function otherParticipant(conversation: Doc<"conversations">, me: Id<"users">) {
  return conversation.userAId === me ? conversation.userBId : conversation.userAId;
}

async function unreadCount(ctx: Ctx, conversationId: Id<"conversations">, since: number) {
  const rows = await ctx.db
    .query("messages")
    .withIndex("by_conversationId", (q) =>
      q.eq("conversationId", conversationId).gt("_creationTime", since),
    )
    .take(MAX_UNREAD_COUNT);
  return rows.length;
}

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      conversationId: v.id("conversations"),
      otherUserId: v.id("users"),
      otherDisplayName: v.string(),
      lastMessageAt: v.number(),
      unreadCount: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const { user } = await getCurrentProfile(ctx);
    const excluded = await blockedUserIds(ctx, user._id);
    const memberships = await ctx.db
      .query("conversationMembers")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(MAX_CONVERSATIONS);
    const rows = [];
    for (const member of memberships) {
      const conversation = await ctx.db.get("conversations", member.conversationId);
      if (!conversation) continue;
      const otherUserId = otherParticipant(conversation, user._id);
      if (excluded.has(otherUserId)) continue;
      const profile = await getProfileForUser(ctx, otherUserId);
      rows.push({
        conversationId: conversation._id,
        otherUserId,
        otherDisplayName: profile?.displayName ?? "Deleted user",
        lastMessageAt: conversation.lastMessageAt,
        unreadCount: await unreadCount(ctx, conversation._id, member.lastReadAt ?? 0),
      });
    }
    return rows.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  },
});

export const get = query({
  args: { conversationId: v.id("conversations") },
  returns: v.object({
    conversationId: v.id("conversations"),
    otherUserId: v.id("users"),
    otherDisplayName: v.string(),
  }),
  handler: async (ctx, args) => {
    const { user } = await getCurrentProfile(ctx);
    const { conversation } = await requireMembership(ctx, args.conversationId, user._id);
    const otherUserId = otherParticipant(conversation, user._id);
    const profile = await getProfileForUser(ctx, otherUserId);
    return {
      conversationId: conversation._id,
      otherUserId,
      otherDisplayName: profile?.displayName ?? "Deleted user",
    };
  },
});

export const markRead = mutation({
  args: { conversationId: v.id("conversations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await getCurrentProfile(ctx);
    const { member } = await requireMembership(ctx, args.conversationId, user._id);
    const now = Date.now();
    await ctx.db.patch("conversationMembers", member._id, { lastReadAt: now });
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_userId_and_readAt", (q) => q.eq("userId", user._id).eq("readAt", undefined))
      .take(200);
    for (const n of unread) {
      if (n.type === "new_message" && n.conversationId === args.conversationId) {
        await ctx.db.patch("notifications", n._id, { readAt: now });
      }
    }
    return null;
  },
});
```

`q.gt("_creationTime", since)` on the `by_conversationId` index works because every index implicitly ends with `_creationTime`.

- [ ] **Step 4: Create messages.ts**

`packages/backend/convex/messages.ts`:

```ts
import { doc } from "convex-helpers/validators";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { otherParticipant, requireMembership } from "./conversations";
import { getCurrentProfile } from "./model/auth";
import { isBlockedEitherWay } from "./model/blocks";
import { fail } from "./model/errors";
import { createNotification } from "./model/notifications";
import { paginated } from "./model/validators";
import schema from "./schema";

const MAX_BODY = 2000;

export const send = mutation({
  args: { conversationId: v.id("conversations"), body: v.string() },
  returns: v.id("messages"),
  handler: async (ctx, args) => {
    const { user } = await getCurrentProfile(ctx);
    const body = args.body.trim();
    if (body.length === 0 || body.length > MAX_BODY) fail("INVALID_MESSAGE");
    const { conversation, member } = await requireMembership(ctx, args.conversationId, user._id);
    const otherUserId = otherParticipant(conversation, user._id);
    if (await isBlockedEitherWay(ctx, user._id, otherUserId)) fail("BLOCKED");

    // One "new_message" notification per conversation until the recipient reads it.
    const recipientUnread = await ctx.db
      .query("notifications")
      .withIndex("by_userId_and_readAt", (q) => q.eq("userId", otherUserId).eq("readAt", undefined))
      .take(200);
    const alreadyNotified = recipientUnread.some(
      (n) => n.type === "new_message" && n.conversationId === conversation._id,
    );

    const now = Date.now();
    const messageId = await ctx.db.insert("messages", {
      conversationId: conversation._id,
      senderId: user._id,
      body,
    });
    await ctx.db.patch("conversations", conversation._id, { lastMessageAt: now });
    await ctx.db.patch("conversationMembers", member._id, { lastReadAt: now });

    if (!alreadyNotified) {
      await createNotification(ctx, {
        userId: otherUserId,
        type: "new_message",
        conversationId: conversation._id,
      });
    }
    return messageId;
  },
});

export const list = query({
  args: { conversationId: v.id("conversations"), paginationOpts: paginationOptsValidator },
  returns: paginated(doc(schema, "messages")),
  handler: async (ctx, args) => {
    const { user } = await getCurrentProfile(ctx);
    await requireMembership(ctx, args.conversationId, user._id);
    return ctx.db
      .query("messages")
      .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
```

The debounce is "is there already an unread `new_message` notification for this recipient and conversation". `conversations.markRead` clears those, so the next message after a read produces a fresh notification. This is timestamp-free, so it behaves the same under fake timers and in production.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @tennis-buddy-finder/backend test`
Expected: all pass, including the two conversation tests from Task 10 (un-skip them if you skipped them).

- [ ] **Step 6: Typecheck, lint, commit**

Run from root: `pnpm run check-types && pnpm run check`

```bash
git add packages/backend/convex
git commit -m "feat(backend): conversations and messages with unread tracking and debounced notifications" -m "Claude-Session: https://claude.ai/code/session_011WdotxYTNKaLaKeuBUtE1H"
```

---

### Task 12: Reports and admin

**Files:**
- Create: `packages/backend/convex/reports.ts`
- Test: `packages/backend/convex/reports.test.ts`

**Interfaces:**
- Consumes: `getCurrentProfile`, `requireAdmin`, `getProfileForUser`, `reportReasonValidator`.
- Produces: `api.reports.create({ reportedUserId, reason, details?, messageId? })` → `Id<"reports">`; `api.reports.listOpen()` (admin) → `{ report, reporterName, reportedName, messageBody | null }[]`; `api.reports.markReviewed({ reportId })`, `api.reports.dismiss({ reportId })` (admin).
- Codes: `CANNOT_REPORT_SELF`, `NOT_FOUND`, `INVALID_DETAILS`, `INVALID_MESSAGE_REF`, `FORBIDDEN`.

- [ ] **Step 1: Write the failing tests**

`packages/backend/convex/reports.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import { getOrCreateConversation } from "./model/conversations";
import { createUser, setup } from "./test.helpers";

describe("reports", () => {
  it("a user can report another with an optional message reference; admin sees it", async () => {
    const t = setup();
    const a = await createUser(t);
    const b = await createUser(t);
    const admin = await createUser(t, { role: "admin" });
    const conversationId = await t.run(async (ctx) =>
      getOrCreateConversation(ctx, a.userId, b.userId),
    );
    const messageId = await b.as.mutation(api.messages.send, { conversationId, body: "rude" });

    await a.as.mutation(api.reports.create, {
      reportedUserId: b.userId,
      reason: "harassment",
      details: "See message",
      messageId,
    });

    const open = await admin.as.query(api.reports.listOpen, {});
    expect(open).toHaveLength(1);
    expect(open[0]?.messageBody).toBe("rude");
    expect(open[0]?.reportedName).toMatch(/^User \d+$/);
    expect(open[0]?.report.reportedUserId).toBe(b.userId);
    await admin.as.mutation(api.reports.markReviewed, { reportId: open[0]!.report._id });
    expect(await admin.as.query(api.reports.listOpen, {})).toHaveLength(0);
  });

  it("rejects self reports, a message from a conversation the reporter is not in, and long details", async () => {
    const t = setup();
    const a = await createUser(t);
    const b = await createUser(t);
    const c = await createUser(t);
    const conversationId = await t.run(async (ctx) =>
      getOrCreateConversation(ctx, b.userId, c.userId),
    );
    const foreign = await b.as.mutation(api.messages.send, { conversationId, body: "x" });
    await expect(
      a.as.mutation(api.reports.create, { reportedUserId: a.userId, reason: "other" }),
    ).rejects.toThrow("CANNOT_REPORT_SELF");
    await expect(
      a.as.mutation(api.reports.create, { reportedUserId: b.userId, reason: "other", messageId: foreign }),
    ).rejects.toThrow("INVALID_MESSAGE_REF");
    await expect(
      a.as.mutation(api.reports.create, {
        reportedUserId: b.userId,
        reason: "other",
        details: "x".repeat(1001),
      }),
    ).rejects.toThrow("INVALID_DETAILS");
  });

  it("non-admins cannot list or resolve", async () => {
    const t = setup();
    const a = await createUser(t);
    await expect(a.as.query(api.reports.listOpen, {})).rejects.toThrow("FORBIDDEN");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tennis-buddy-finder/backend test`
Expected: FAIL, `api.reports` missing.

- [ ] **Step 3: Create reports.ts**

`packages/backend/convex/reports.ts`:

```ts
import { doc } from "convex-helpers/validators";
import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { getCurrentProfile, getProfileForUser, requireAdmin } from "./model/auth";
import { fail } from "./model/errors";
import { reportReasonValidator } from "./model/validators";
import schema from "./schema";

const MAX_DETAILS = 1000;
const MAX_LIST = 100;

export const create = mutation({
  args: {
    reportedUserId: v.id("users"),
    reason: reportReasonValidator,
    details: v.optional(v.string()),
    messageId: v.optional(v.id("messages")),
  },
  returns: v.id("reports"),
  handler: async (ctx, args) => {
    const { user } = await getCurrentProfile(ctx);
    if (args.reportedUserId === user._id) fail("CANNOT_REPORT_SELF");
    const target = await ctx.db.get("users", args.reportedUserId);
    if (!target) fail("NOT_FOUND");
    if (args.details !== undefined && args.details.length > MAX_DETAILS) fail("INVALID_DETAILS");
    if (args.messageId !== undefined) {
      const message = await ctx.db.get("messages", args.messageId);
      if (!message || message.senderId !== args.reportedUserId) fail("INVALID_MESSAGE_REF");
      const membership = await ctx.db
        .query("conversationMembers")
        .withIndex("by_conversationId_and_userId", (q) =>
          q.eq("conversationId", message.conversationId).eq("userId", user._id),
        )
        .unique();
      if (!membership) fail("INVALID_MESSAGE_REF");
    }
    return ctx.db.insert("reports", {
      reporterId: user._id,
      reportedUserId: args.reportedUserId,
      reason: args.reason,
      details: args.details,
      messageId: args.messageId,
      status: "open",
    });
  },
});

export const listOpen = query({
  args: {},
  returns: v.array(
    v.object({
      report: doc(schema, "reports"),
      reporterName: v.string(),
      reportedName: v.string(),
      messageBody: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .order("desc")
      .take(MAX_LIST);
    const rows = [];
    for (const report of reports) {
      const reporter = await getProfileForUser(ctx, report.reporterId);
      const reported = await getProfileForUser(ctx, report.reportedUserId);
      const message = report.messageId ? await ctx.db.get("messages", report.messageId) : null;
      rows.push({
        report,
        reporterName: reporter?.displayName ?? "Deleted user",
        reportedName: reported?.displayName ?? "Deleted user",
        messageBody: message?.body ?? null,
      });
    }
    return rows;
  },
});

async function setStatus(
  ctx: MutationCtx,
  reportId: Id<"reports">,
  status: "reviewed" | "dismissed",
) {
  await requireAdmin(ctx);
  const report = await ctx.db.get("reports", reportId);
  if (!report) fail("NOT_FOUND");
  await ctx.db.patch("reports", reportId, { status });
}

export const markReviewed = mutation({
  args: { reportId: v.id("reports") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await setStatus(ctx, args.reportId, "reviewed");
    return null;
  },
});

export const dismiss = mutation({
  args: { reportId: v.id("reports") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await setStatus(ctx, args.reportId, "dismissed");
    return null;
  },
});
```

- [ ] **Step 4: Run tests, typecheck, lint, commit**

Run: `pnpm --filter @tennis-buddy-finder/backend test` then from root `pnpm run check-types && pnpm run check`.

```bash
git add packages/backend/convex/reports.ts packages/backend/convex/reports.test.ts
git commit -m "feat(backend): user reports and admin review" -m "Claude-Session: https://claude.ai/code/session_011WdotxYTNKaLaKeuBUtE1H"
```

---

### Task 13: Housekeeping cron

**Files:**
- Create: `packages/backend/convex/housekeeping.ts`
- Create: `packages/backend/convex/crons.ts`
- Test: `packages/backend/convex/housekeeping.test.ts`

**Interfaces:**
- Consumes: `declinePendingForSlot`.
- Produces: `internal.housekeeping.expireSlots()` → `{ expired: number }`, `internal.housekeeping.purgeNotifications()` → `{ deleted: number }`. Both process at most one batch and reschedule themselves when more work remains. `crons.ts` runs both daily at 03:00 UTC.

- [ ] **Step 1: Write the failing tests**

`packages/backend/convex/housekeeping.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import { internal } from "./_generated/api";
import { createNotification } from "./model/notifications";
import { createUser, setup, DAY, HOUR, NOW } from "./test.helpers";

describe("housekeeping.expireSlots", () => {
  it("expires past open slots, declines their pending requests, leaves future and matched alone", async () => {
    const t = setup();
    const owner = await createUser(t);
    const asker = await createUser(t);
    const ids = await t.run(async (ctx) => {
      const base = { userId: owner.userId, district: "Coimbra", municipality: "Figueira da Foz" };
      const pastOpen = await ctx.db.insert("availabilitySlots", { ...base, startAt: NOW - 3 * HOUR, endAt: NOW - 2 * HOUR, status: "open" });
      const pastMatched = await ctx.db.insert("availabilitySlots", { ...base, startAt: NOW - 3 * HOUR, endAt: NOW - 2 * HOUR, status: "matched" });
      const futureOpen = await ctx.db.insert("availabilitySlots", { ...base, startAt: NOW + DAY, endAt: NOW + DAY + HOUR, status: "open" });
      const request = await ctx.db.insert("matchRequests", { slotId: pastOpen, fromUserId: asker.userId, toUserId: owner.userId, status: "pending" });
      return { pastOpen, pastMatched, futureOpen, request };
    });

    const result = await t.mutation(internal.housekeeping.expireSlots, {});
    expect(result.expired).toBe(1);

    const rows = await t.run(async (ctx) => ({
      pastOpen: await ctx.db.get("availabilitySlots", ids.pastOpen),
      pastMatched: await ctx.db.get("availabilitySlots", ids.pastMatched),
      futureOpen: await ctx.db.get("availabilitySlots", ids.futureOpen),
      request: await ctx.db.get("matchRequests", ids.request),
    }));
    expect(rows.pastOpen?.status).toBe("expired");
    expect(rows.pastMatched?.status).toBe("matched");
    expect(rows.futureOpen?.status).toBe("open");
    expect(rows.request?.status).toBe("declined");
  });
});

describe("housekeeping.purgeNotifications", () => {
  it("deletes notifications older than 90 days", async () => {
    const t = setup();
    const u = await createUser(t);
    vi.setSystemTime(NOW - 100 * DAY);
    await t.run(async (ctx) => createNotification(ctx, { userId: u.userId, type: "new_message" }));
    vi.setSystemTime(NOW);
    await t.run(async (ctx) => createNotification(ctx, { userId: u.userId, type: "new_message" }));

    const result = await t.mutation(internal.housekeeping.purgeNotifications, {});
    expect(result.deleted).toBe(1);
    const remaining = await t.run(async (ctx) => ctx.db.query("notifications").collect());
    expect(remaining).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tennis-buddy-finder/backend test`
Expected: FAIL, `internal.housekeeping` missing.

- [ ] **Step 3: Create housekeeping.ts**

`packages/backend/convex/housekeeping.ts`:

```ts
import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { declinePendingForSlot } from "./model/requests";
import { DAY } from "./model/time";

const BATCH = 200;
const NOTIFICATION_TTL = 90 * DAY;

/** Marks past open slots as expired and declines their pending requests. */
export const expireSlots = internalMutation({
  args: {},
  returns: v.object({ expired: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    const slots = await ctx.db
      .query("availabilitySlots")
      .withIndex("by_status_and_startAt", (q) => q.eq("status", "open").lt("startAt", now))
      .take(BATCH);
    for (const slot of slots) {
      await declinePendingForSlot(ctx, slot._id);
      await ctx.db.patch("availabilitySlots", slot._id, { status: "expired" });
    }
    if (slots.length === BATCH) {
      await ctx.scheduler.runAfter(0, internal.housekeeping.expireSlots, {});
    }
    return { expired: slots.length };
  },
});

/** Deletes notifications older than NOTIFICATION_TTL. */
export const purgeNotifications = internalMutation({
  args: {},
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx) => {
    const cutoff = Date.now() - NOTIFICATION_TTL;
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_creation_time", (q) => q.lt("_creationTime", cutoff))
      .take(BATCH);
    for (const row of rows) await ctx.db.delete("notifications", row._id);
    if (rows.length === BATCH) {
      await ctx.scheduler.runAfter(0, internal.housekeeping.purgeNotifications, {});
    }
    return { deleted: rows.length };
  },
});
```

- [ ] **Step 4: Create crons.ts**

`packages/backend/convex/crons.ts`:

```ts
import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily("expire past slots", { hourUTC: 3, minuteUTC: 0 }, internal.housekeeping.expireSlots, {});
crons.daily(
  "purge old notifications",
  { hourUTC: 3, minuteUTC: 15 },
  internal.housekeeping.purgeNotifications,
  {},
);

export default crons;
```

- [ ] **Step 5: Run tests, typecheck, lint, commit**

Run: `pnpm --filter @tennis-buddy-finder/backend test` then from root `pnpm run check-types && pnpm run check`.

```bash
git add packages/backend/convex/housekeeping.ts packages/backend/convex/crons.ts packages/backend/convex/housekeeping.test.ts
git commit -m "feat(backend): daily housekeeping cron for expired slots and old notifications" -m "Claude-Session: https://claude.ai/code/session_011WdotxYTNKaLaKeuBUtE1H"
```

---

### Task 14: Account deletion

**Files:**
- Modify: `packages/backend/convex/users.ts` (add `deleteAccount`, `tombstoneMessages`)
- Test: `packages/backend/convex/users.delete.test.ts`

**Interfaces:**
- Produces: `api.users.deleteAccount()` → `null`. Cascade: profile, slots, requests both directions, blocks both directions, notifications, conversation memberships, reports authored; messages tombstoned by `internal.users.tombstoneMessages({ userId })` in batches; finally the `users` row. Plan 2 wraps this to also delete the Better Auth user.

- [ ] **Step 1: Write the failing test**

`packages/backend/convex/users.delete.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import { getOrCreateConversation } from "./model/conversations";
import { createUser, setup, DAY, HOUR, NOW } from "./test.helpers";

const day1 = NOW + DAY - 2 * HOUR;

describe("users.deleteAccount", () => {
  it("removes everything owned by the user and tombstones their messages", async () => {
    const t = setup();
    const gone = await createUser(t);
    const other = await createUser(t);
    const slotId = await gone.as.mutation(api.availability.create, { startAt: day1, endAt: day1 + HOUR });
    const otherSlot = await other.as.mutation(api.availability.create, { startAt: day1, endAt: day1 + HOUR });
    await other.as.mutation(api.matchRequests.send, { slotId });
    await gone.as.mutation(api.matchRequests.send, { slotId: otherSlot });
    const conversationId = await t.run(async (ctx) =>
      getOrCreateConversation(ctx, gone.userId, other.userId),
    );
    await gone.as.mutation(api.messages.send, { conversationId, body: "bye" });
    await other.as.mutation(api.messages.send, { conversationId, body: "ok" });
    await gone.as.mutation(api.blocks.block, { userId: other.userId });
    await gone.as.mutation(api.reports.create, { reportedUserId: other.userId, reason: "other" });

    await gone.as.mutation(api.users.deleteAccount, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const state = await t.run(async (ctx) => ({
      user: await ctx.db.get("users", gone.userId),
      profiles: await ctx.db.query("profiles").withIndex("by_userId", (q) => q.eq("userId", gone.userId)).collect(),
      slots: await ctx.db.query("availabilitySlots").withIndex("by_userId_and_startAt", (q) => q.eq("userId", gone.userId)).collect(),
      requestsFrom: await ctx.db.query("matchRequests").withIndex("by_fromUserId_and_status", (q) => q.eq("fromUserId", gone.userId)).collect(),
      requestsTo: await ctx.db.query("matchRequests").withIndex("by_toUserId_and_status", (q) => q.eq("toUserId", gone.userId)).collect(),
      blocks: await ctx.db.query("blocks").withIndex("by_blockerId_and_blockedId", (q) => q.eq("blockerId", gone.userId)).collect(),
      members: await ctx.db.query("conversationMembers").withIndex("by_userId", (q) => q.eq("userId", gone.userId)).collect(),
      notifications: await ctx.db.query("notifications").withIndex("by_userId", (q) => q.eq("userId", gone.userId)).collect(),
      messages: await ctx.db.query("messages").withIndex("by_conversationId", (q) => q.eq("conversationId", conversationId)).collect(),
      reports: await ctx.db.query("reports").collect(),
    }));

    expect(state.user).toBeNull();
    expect(state.profiles).toHaveLength(0);
    expect(state.slots).toHaveLength(0);
    expect(state.requestsFrom).toHaveLength(0);
    expect(state.requestsTo).toHaveLength(0);
    expect(state.blocks).toHaveLength(0);
    expect(state.members).toHaveLength(0);
    expect(state.notifications).toHaveLength(0);
    expect(state.reports).toHaveLength(0);
    expect(state.messages).toHaveLength(2);
    expect(state.messages.find((m) => m.body === "bye")?.senderId).toBeUndefined();
    expect(state.messages.find((m) => m.body === "ok")?.senderId).toBe(other.userId);

    // the other user still sees the conversation with a tombstoned partner
    const list = await other.as.query(api.conversations.list, {});
    expect(list[0]?.otherDisplayName).toBe("Deleted user");
  });
});
```

`t.finishAllScheduledFunctions(advanceTimers)` runs everything the mutation scheduled, including the re-scheduled batches; with fake timers `vi.runAllTimers` is the advancer. Add `vi` to the vitest import at the top of the file.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @tennis-buddy-finder/backend test`
Expected: FAIL, `api.users.deleteAccount` missing.

- [ ] **Step 3: Add deleteAccount and tombstoneMessages**

Append to `packages/backend/convex/users.ts` (add `internal` to the `./_generated/api` import and `Id` type import from `./_generated/dataModel`):

```ts
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const BATCH = 200;

async function deleteAllByIndex<T extends { _id: string }>(
  fetch: () => Promise<T[]>,
  remove: (row: T) => Promise<void>,
) {
  for (;;) {
    const rows = await fetch();
    for (const row of rows) await remove(row);
    if (rows.length < BATCH) return;
  }
}

/** Removes every row owned by the caller, then the caller. Plan 2 also deletes the auth user. */
export const deleteAccount = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    const uid = me._id;

    const profile = await getProfileForUser(ctx, uid);
    if (profile) await ctx.db.delete("profiles", profile._id);

    await deleteAllByIndex(
      () => ctx.db.query("availabilitySlots").withIndex("by_userId_and_startAt", (q) => q.eq("userId", uid)).take(BATCH),
      (row) => ctx.db.delete("availabilitySlots", row._id),
    );
    for (const status of ["pending", "accepted", "declined", "cancelled"] as const) {
      await deleteAllByIndex(
        () => ctx.db.query("matchRequests").withIndex("by_fromUserId_and_status", (q) => q.eq("fromUserId", uid).eq("status", status)).take(BATCH),
        (row) => ctx.db.delete("matchRequests", row._id),
      );
      await deleteAllByIndex(
        () => ctx.db.query("matchRequests").withIndex("by_toUserId_and_status", (q) => q.eq("toUserId", uid).eq("status", status)).take(BATCH),
        (row) => ctx.db.delete("matchRequests", row._id),
      );
    }
    await deleteAllByIndex(
      () => ctx.db.query("blocks").withIndex("by_blockerId_and_blockedId", (q) => q.eq("blockerId", uid)).take(BATCH),
      (row) => ctx.db.delete("blocks", row._id),
    );
    await deleteAllByIndex(
      () => ctx.db.query("blocks").withIndex("by_blockedId", (q) => q.eq("blockedId", uid)).take(BATCH),
      (row) => ctx.db.delete("blocks", row._id),
    );
    await deleteAllByIndex(
      () => ctx.db.query("notifications").withIndex("by_userId", (q) => q.eq("userId", uid)).take(BATCH),
      (row) => ctx.db.delete("notifications", row._id),
    );
    await deleteAllByIndex(
      () => ctx.db.query("conversationMembers").withIndex("by_userId", (q) => q.eq("userId", uid)).take(BATCH),
      (row) => ctx.db.delete("conversationMembers", row._id),
    );
    await deleteAllByIndex(
      () => ctx.db.query("reports").withIndex("by_reporterId", (q) => q.eq("reporterId", uid)).take(BATCH),
      (row) => ctx.db.delete("reports", row._id),
    );

    await ctx.scheduler.runAfter(0, internal.users.tombstoneMessages, { userId: uid });
    await ctx.db.delete("users", uid);
    return null;
  },
});

/** Clears `senderId` on a deleted user's messages in batches. */
export const tombstoneMessages = internalMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_senderId", (q) => q.eq("senderId", args.userId))
      .take(BATCH);
    for (const row of rows) await ctx.db.patch("messages", row._id, { senderId: undefined });
    if (rows.length === BATCH) {
      await ctx.scheduler.runAfter(0, internal.users.tombstoneMessages, { userId: args.userId });
    }
    return null;
  },
});
```

- [ ] **Step 4: Run tests, typecheck, lint, commit**

Run: `pnpm --filter @tennis-buddy-finder/backend test` then from root `pnpm run check-types && pnpm run check`.

```bash
git add packages/backend/convex/users.ts packages/backend/convex/users.delete.test.ts
git commit -m "feat(backend): account deletion cascade with message tombstones" -m "Claude-Session: https://claude.ai/code/session_011WdotxYTNKaLaKeuBUtE1H"
```

---

### Task 15: Deploy check and documentation

**Files:**
- Modify: `packages/backend/CLAUDE.md` (Layout section)

- [ ] **Step 1: Push to the dev deployment**

Run from `packages/backend`: `npx convex dev --once`
Expected: schema and functions push without errors, `_generated/` is up to date, crons registered. If there is no deployment yet, run `pnpm run dev:setup` from the root first.

- [ ] **Step 2: Seed venues**

Run from `packages/backend`: `npx convex run venues:seedFigueira`
Expected: prints the number inserted (2 with the placeholder list).

- [ ] **Step 3: Update the Layout section of `packages/backend/CLAUDE.md`**

Replace the code block under `## Layout` with:

```
convex/
  schema.ts            # all tables + indexes (source of truth)
  convex.config.ts     # defineApp(); components registered here
  crons.ts             # daily housekeeping schedule
  model/               # non-registered helpers: auth, blocks, conversations, errors, notifications, time, validators
  users.ts profiles.ts venues.ts availability.ts matchRequests.ts
  conversations.ts messages.ts blocks.ts reports.ts notifications.ts housekeeping.ts
  *.test.ts            # convex-test suites, run with `pnpm test` here
  test.helpers.ts      # setup(), createUser(), NOW/HOUR/DAY
  _generated/          # codegen output. NEVER hand-edit.
```

And add to the Commands table:

```
| Tests | `pnpm test` here (`vitest run`, edge-runtime env) |
```

- [ ] **Step 4: Full verification**

Run from root: `pnpm --filter @tennis-buddy-finder/backend test && pnpm run check-types && pnpm run check`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/CLAUDE.md packages/backend/convex/_generated
git commit -m "docs(backend): document domain layout and test command" -m "Claude-Session: https://claude.ai/code/session_011WdotxYTNKaLaKeuBUtE1H"
```

---

## Handoff to the next plans

- **Plan 2, auth and email integration:** register `@convex-dev/better-auth` in `convex.config.ts`, create `auth.config.ts` and `convex/auth.ts` with the `onCreateUser` trigger calling `internal.users.internalCreateFromAuth`, wrap `users.deleteAccount` to also delete the auth user, register `@convex-dev/resend`, add `convex/email.ts` with `sendForNotification` and hook it into `createNotification`, add the unsubscribe HTTP action, and configure the Nuxt Better Auth client.
- **Plan 3, Nuxt frontend:** pages and middleware listed in spec section 9, consuming the `api.*` surface defined above.
