# Tennis Buddy Finder: design spec

Date: 2026-09-08
Status: approved in brainstorming, pending written review

## 1. Purpose

A web app where amateur tennis players in Portugal publish when they can play, find other players who are free at the same time and at a similar level, and arrange a match through in-app chat. Launch is limited to one city, Figueira da Foz (district Coimbra), but the data model must support adding cities without migration.

Stack is fixed by the existing scaffold: Nuxt 4 + Nuxt UI v4 frontend in `apps/web`, Convex backend in `packages/backend`, deployed to Cloudflare through Alchemy in `packages/infra`.

## 2. Decisions taken

| Topic | Decision |
|---|---|
| Availability model | Concrete slots only. Each slot is one row with start and end time. No recurring patterns. "Copy last week" in the UI covers regulars. |
| Location | `district` and `municipality` stored on profiles and slots. UI fixed to Figueira da Foz / Coimbra for now. Optional curated `venues` table. |
| Connecting players | Match request on a slot, accept opens an in-app conversation. No phone numbers stored or revealed. |
| Skill level | NTRP rating, 1.0 to 7.0, self-declared, stored as a number. |
| Auth | Better Auth running inside Convex via the official `@convex-dev/better-auth` component. Email + password with mandatory verification, Google, Facebook. |
| Match tracking | None in this version. Request rows are shaped so a future `matches` table can reference them. |
| Safety | Block and report from day one. Reports reviewed on a single admin page. |
| Notifications | In-app plus email via the official Convex Resend component. Web push later. |
| Email domain | TBD. Resend free tier is sufficient at launch scale; a verified domain is required to email users other than the owner. |
| Minimum age | 18. Enforced at onboarding from birth date. |

## 3. Data model

All tables live in `packages/backend/convex/schema.ts`. Timestamps are milliseconds since epoch, UTC. Ids reference other tables with `v.id()`. Every query path below is backed by a named index; `.filter()` is not used on database queries.

Better Auth keeps its own users, sessions and accounts inside its component. The app never reads those tables directly.

### users

Mirror of the auth user, inserted by the Better Auth `onCreateUser` trigger.

| Field | Type | Notes |
|---|---|---|
| `authId` | string | Better Auth user id |
| `email` | string | |
| `name` | string | |
| `image` | string, optional | provider avatar URL |
| `role` | `"user"` \| `"admin"` | default `"user"` |
| `emailNotifications` | boolean | default `true` |
| `bannedAt` | number, optional | set from the Convex dashboard; treated as unauthenticated |

Indexes: `by_authId`.

### profiles

One per user, created at onboarding. Absence of a row means onboarding is incomplete.

| Field | Type | Notes |
|---|---|---|
| `userId` | id users | |
| `displayName` | string | |
| `bio` | string, optional | max 500 chars |
| `avatarStorageId` | id _storage, optional | |
| `birthDate` | string | ISO date `YYYY-MM-DD`; must yield age >= 18 |
| `gender` | `"male"` \| `"female"` \| `"other"` \| `"unspecified"`, optional | |
| `ntrp` | number | 1.0 to 7.0 in 0.5 steps |
| `yearsPlaying` | number | integer >= 0 |
| `formats` | `"singles"` \| `"doubles"` \| `"both"` | |
| `handedness` | `"right"` \| `"left"`, optional | |
| `district` | string | e.g. `"Coimbra"` |
| `municipality` | string | e.g. `"Figueira da Foz"` |
| `languages` | array of string | ISO 639-1 codes, at least one |

Indexes: `by_userId`, `by_municipality_and_ntrp`.

### venues

Hand-seeded list of courts. Figueira da Foz only at launch.

| Field | Type |
|---|---|
| `name` | string |
| `district` | string |
| `municipality` | string |
| `address` | string, optional |
| `surface` | `"hard"` \| `"clay"` \| `"grass"` \| `"other"`, optional |
| `isActive` | boolean |

Indexes: `by_municipality`.

### availabilitySlots

| Field | Type | Notes |
|---|---|---|
| `userId` | id users | |
| `startAt` | number | |
| `endAt` | number | > `startAt`, both on 30-minute boundaries |
| `district` | string | copied from profile at creation |
| `municipality` | string | copied from profile at creation |
| `venueId` | id venues, optional | |
| `note` | string, optional | max 200 chars |
| `status` | `"open"` \| `"matched"` \| `"cancelled"` | |

Indexes: `by_userId_and_startAt`, `by_municipality_and_startAt`.

Rules: no overlapping slots for the same user; `startAt` must be in the future at creation; max slot length 6 hours.

### matchRequests

| Field | Type | Notes |
|---|---|---|
| `slotId` | id availabilitySlots | |
| `fromUserId` | id users | |
| `toUserId` | id users | slot owner, denormalised for indexing |
| `message` | string, optional | max 300 chars |
| `status` | `"pending"` \| `"accepted"` \| `"declined"` \| `"cancelled"` | |
| `respondedAt` | number, optional | |
| `conversationId` | id conversations, optional | set on accept |

Indexes: `by_slotId_and_fromUserId`, `by_slotId_and_status`, `by_toUserId_and_status`, `by_fromUserId_and_status`.

### conversations

| Field | Type | Notes |
|---|---|---|
| `userAId` | id users | lower id of the pair |
| `userBId` | id users | higher id of the pair |
| `lastMessageAt` | number | |

Indexes: `by_userAId_and_userBId` (one conversation per pair).

### conversationMembers

| Field | Type |
|---|---|
| `conversationId` | id conversations |
| `userId` | id users |
| `lastReadAt` | number, optional |

Indexes: `by_userId`, `by_conversationId_and_userId`.

### messages

| Field | Type | Notes |
|---|---|---|
| `conversationId` | id conversations | |
| `senderId` | id users, optional | `undefined` after sender deleted their account |
| `body` | string | max 2000 chars |

Indexes: `by_conversationId`. Ordering uses `_creationTime`.

### blocks

| Field | Type |
|---|---|
| `blockerId` | id users |
| `blockedId` | id users |

Indexes: `by_blockerId_and_blockedId`, `by_blockedId`.

### reports

| Field | Type |
|---|---|
| `reporterId` | id users |
| `reportedUserId` | id users |
| `reason` | `"harassment"` \| `"inappropriate"` \| `"fake_profile"` \| `"no_show"` \| `"other"` |
| `details` | string, optional |
| `messageId` | id messages, optional |
| `status` | `"open"` \| `"reviewed"` \| `"dismissed"` |

Indexes: `by_status`.

### notifications

| Field | Type |
|---|---|
| `userId` | id users |
| `type` | `"request_received"` \| `"request_accepted"` \| `"request_declined"` \| `"new_message"` |
| `requestId` | id matchRequests, optional |
| `conversationId` | id conversations, optional |
| `readAt` | number, optional |
| `emailedAt` | number, optional |

Indexes: `by_userId_and_readAt`, `by_userId`.

## 4. Auth and onboarding

- Better Auth via `@convex-dev/better-auth`. Methods: email + password (verification email required before login), Google, Facebook. OAuth users are considered verified.
- The component's `onCreateUser` trigger inserts the `users` row. `onDeleteUser` is not used; deletion is driven from the app side (see below).
- One helper, `getCurrentUser(ctx)` in `convex/model/auth.ts`, resolves the identity to the `users` row and throws if unauthenticated, unverified, or banned. No other code reads `ctx.auth`. A `getCurrentProfile(ctx)` helper additionally requires a profile row.
- Nuxt route middleware, three states: logged out redirects to `/login`; logged in without profile redirects to `/onboarding`; complete users pass. Admin routes also require `role === "admin"`.
- Onboarding form fields: display name, birth date, NTRP with inline level descriptions, years playing, formats, languages, optional bio and avatar. Municipality and district are fixed to Figueira da Foz / Coimbra and not editable.
- Age rule: birth date must give an age of at least 18 at submission, checked server side.
- Account deletion mutation: delete profile, slots, requests (both directions), blocks (both directions), notifications, conversation memberships, reports authored; set `senderId` to `undefined` on the user's messages; delete the `users` row; delete the Better Auth user through the component API. Runs as one mutation where possible; message tombstoning may be batched by a scheduled internal mutation if the count is large.

## 5. Availability and search

### My calendar (`/calendar`)

- Month view of upcoming days. Selecting a day opens a sheet listing that day's slots and a form to add one: start, end (30-minute steps), optional venue, optional note.
- Delete removes an open slot. A matched slot cannot be deleted, only cancelled, which also cancels the accepted request and notifies the other player.
- "Copy last week" clones every open slot from the previous 7 days forward by 7 days, skipping any that would overlap or be in the past.

### Slot lifecycle

- Created as `open`.
- Accepting a request sets `matched`, hides the slot from search, and declines every other pending request on it.
- Daily cron sets past `open` slots to `cancelled` and cancels pending requests whose slot has passed.

### Search (`/`)

- Filters: date or range (default next 7 days), time of day (morning, afternoon, evening, any), NTRP range (default caller's rating ± 0.5), format, venue.
- Query: `availabilitySlots.by_municipality_and_startAt` for the caller's municipality and the time range, `status === "open"`, then load each slot's profile and apply NTRP and format filters in memory. Exclude the caller's own slots and any user in a block relation with the caller in either direction. Paginated with `paginationOptsValidator`.
- Results grouped by day. Each item shows the player card: display name, age, NTRP, formats, languages, venue if set, and a request button.
- Day boundaries are computed on the client in `Europe/Lisbon` and sent as timestamps. The backend does no timezone math.

### Player profile (`/players/[id]`)

Visible to any complete user who is not blocked either way. Shows the profile and that player's open future slots, each with a request button. Includes block and report actions.

## 6. Requests and chat

### Sending

Mutation `matchRequests.send(slotId, message?)`. Checks: slot exists, is `open`, is in the future; caller is not the owner; no block in either direction; no existing `pending` request from caller on this slot. Inserts the request and a `request_received` notification.

### Responding

- `accept(requestId)`: caller must be `toUserId`, request must be `pending`, slot must still be `open`. Sets request `accepted`, slot `matched`, declines other pending requests on the slot (each with a `request_declined` notification), finds or creates the conversation for the pair, creates both memberships if new, links `conversationId` on the request, notifies the sender with `request_accepted`.
- `decline(requestId)`: sets `declined`, notifies sender.
- `cancel(requestId)`: caller must be `fromUserId`, request must be `pending`. Sets `cancelled`, no notification.

### Inbox (`/requests`)

Received tab: pending requests to me, via `by_toUserId_and_status`. Sent tab: my pending and recently responded requests, via `by_fromUserId_and_status`.

### Conversations

- Created only by an accepted request. One per user pair; a second match between the same two people reuses it.
- `messages.send(conversationId, body)`: caller must be a member; no block in either direction; body 1 to 2000 chars. Inserts the message, updates `lastMessageAt`, sets the sender's `lastReadAt` to now, and creates a `new_message` notification for the other member only if that member has no unread messages in the conversation (see email rule).
- `conversations.markRead(conversationId)`: sets caller's `lastReadAt` to now and marks related notifications read.
- List (`/messages`): caller's memberships via `by_userId`, joined to conversations, sorted by `lastMessageAt`, with unread count computed as messages after `lastReadAt`. Conversations involving a blocked user are excluded.
- Thread (`/messages/[id]`): paginated messages via `by_conversationId`, reactive.

## 7. Safety

### Blocking

`blocks.block(userId)` inserts the row, cancels pending requests between the two users in both directions, and is idempotent. `unblock(userId)` deletes it. Effects enforced server side: excluded from search both ways, request send rejected both ways, message send rejected, conversations hidden from both lists. The blocked user is not notified.

### Reporting

`reports.create(reportedUserId, reason, details?, messageId?)`. Reason is the fixed list in the schema. The UI offers an "also block" checkbox that calls `block` after a successful report.

### Admin (`/admin/reports`)

Lists `open` reports via `by_status` with reporter, reported user, reason, details and the referenced message body if any. Actions: `markReviewed`, `dismiss`. All admin functions check `role === "admin"` through a `requireAdmin(ctx)` helper. Banning is done by setting `bannedAt` in the Convex dashboard.

## 8. Notifications and email

- Every notification-worthy event writes a `notifications` row in the same mutation that causes it.
- In-app bell reads unread rows via `by_userId_and_readAt`; opening the panel marks them read.
- Email is sent through `@convex-dev/resend`. The mutation that writes the notification schedules an internal action that renders and sends the email, then patches `emailedAt`.
- Email rules: `request_received`, `request_accepted`, `request_declined` always email. `new_message` emails only when the recipient had no unread messages in that conversation at send time, so one email per conversation until it is read.
- All emails respect `users.emailNotifications`. Each email carries an unsubscribe link that hits an HTTP action with a signed token and sets the flag to `false`.
- Sending domain: TBD. Until a domain is verified in Resend, only the owner's address receives mail. The Resend API key lives in Convex env vars.

### Housekeeping cron (`convex/crons.ts`, daily)

1. Cancel pending requests whose slot `startAt` has passed.
2. Set past `open` slots to `cancelled`.
3. Delete notifications older than 90 days.

Each step runs as an internal mutation over an index in batches.

## 9. Frontend

Nuxt 4, `app/` directory, Nuxt UI v4 components, Tailwind v4, mobile-first.

Pages: `/login`, `/register`, `/verify-email`, `/onboarding`, `/` (search), `/calendar`, `/players/[id]`, `/requests`, `/messages`, `/messages/[id]`, `/settings`, `/admin/reports`.

- Route middleware in `app/middleware` implements the auth states and the admin guard.
- Convex access via the auto-imported `convex-vue` composables. Components call one mutation and render one query; no business rules in components.
- Shared zod v4 schemas for profile input, slot input, request message and chat message live in the backend package and are imported by `UForm` on the frontend, so validation matches on both sides.
- `useLisbonTime` composable owns all `Europe/Lisbon` formatting and day-boundary computation.
- Settings page: edit profile, email notifications toggle, blocked users list with unblock, delete account with confirmation.

## 10. Testing

- `convex-test` unit tests for every mutation's rules: slot overlap, past-time and length rejection; duplicate request rejection; accept cascade (slot status, other requests declined, conversation reuse); block enforcement in search, requests and messages; account deletion cascade and message tombstones; new-message email debounce; age check at onboarding.
- Multi-user end-to-end scenarios via the `convex-verify` skill: two seeded users, post slot, search, request, accept, chat, block, verify hidden.
- Frontend: `pnpm run check-types` and `pnpm run check` must pass. No component test framework in this version. Manual browser smoke test per feature before it is considered done.

## 11. Out of scope for this version

Matches table and match history, NTRP adjustment from results, web push, court booking, multiple cities in the UI, identity or photo verification, admin panel beyond the reports list, image moderation on avatars, message attachments, group or doubles matching with more than two players.

## 12. Open items

- Email sending domain (needed before emailing real users).
- Google and Facebook OAuth app registration and redirect URLs for local and production.
- Initial venues list for Figueira da Foz.
