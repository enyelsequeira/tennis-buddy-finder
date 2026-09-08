# Tennis Buddy Finder: visual design spec

Date: 2026-09-08
Status: approved in brainstorming (mockups reviewed in browser), pending written review
Companion to: `2026-09-08-tennis-buddy-finder-design.md` (product and data spec). This document only decides how the frontend in `apps/web` looks and is laid out. Behaviour, data and routes come from the product spec and are not repeated here.

## 1. Direction

Name: **Hard Court**. The palette is the US Open daytime court: the blue of the playing surface, the green of the surround, white court lines, and the optic yellow of the ball. Light-first, mobile-first, with a full desktop layout.

The one memorable element is the **slot chip**: a time range, the player's identity, an NTRP badge and a ball-yellow marker meaning "open". It appears in search, calendar, player profile, requests and pinned at the top of every chat, so learning it once teaches the whole app.

Rules that hold on every screen:

1. Colour means state. Ball yellow is used for exactly one thing: an open slot or a request that is waiting. Green means matched or accepted. Red means declined, cancelled or destructive. Nothing else is yellow, ever; not buttons, not highlights, not decoration.
2. Chrome is neutral. Header, tab bar, cards, dividers and text use the `slate` neutral scale. Blue appears on the active nav item, the single primary action of a view, the NTRP badge and the unread count. Nowhere else.
3. One solid primary button per view. Every other action is `outline`, `soft` or `ghost`. The green "Add availability" button in the desktop header is the sole exception, and it is `secondary`, never `primary`.
4. Small, consistent radius; one shadow level, used only for sheets and popovers; no gradients, no decorative bands, no ALL-CAPS labels.
5. Motion only answers a user action (a sheet rising, a card confirming). No entrance animations. `prefers-reduced-motion` is respected.

Rejected in brainstorming: "Night Session" (dark navy plus yellow), "Centre Court" (Wimbledon green plus purple), a feed layout for search, a court-card layout for search, and a sidebar shell with a seven-column week board for desktop.

## 2. Tokens

### Colour scales

Three custom scales are declared in `apps/web/app/assets/css/main.css` under `@theme static`, then assigned to Nuxt UI semantic colours in `app/app.config.ts`. Shade 500 is the brand value; Nuxt UI uses 500 in light mode and 400 in dark mode for the semantic colour.

| Scale | 50 | 100 | 200 | 300 | 400 | **500** | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `court` (blue) | #EFF5FB | #DCE9F6 | #B4CDEA | #7FAAD9 | #4F8AC7 | **#2F6FB3** | #25598F | #1F4A75 | #1B3D5F | #16314D | #0E1F33 |
| `surround` (green) | #EEF7F2 | #D6ECDF | #AEDAC2 | #7CC09D | #4E9E78 | **#2E7D5B** | #246549 | #1E523C | #1A4232 | #16372A | #0B1F17 |
| `ball` (yellow) | #FAFEE6 | #F6FBD3 | #EDF8A3 | #E4F56B | #DDF43C | **#D9F21B** | #B8CF0D | #8E9F0C | #6B7A0A | #55600F | #2E3505 |

### Semantic assignment (`app.config.ts`)

| Nuxt UI colour | Scale | Used for |
|---|---|---|
| `primary` | `court` | the one primary button per view, active nav item, links, selected day, focus rings |
| `secondary` | `surround` | "Add availability" button in the desktop header, matched state |
| `success` | `surround` | accepted / matched badges, success toasts |
| `warning` | `ball` | open slot marker, "Waiting" badge, unread dot on the bell and Requests tab |
| `error` | `red` (Tailwind default) | declined / cancelled, delete and block actions, validation |
| `info` | `court` | informational alerts |
| `neutral` | `slate` | all chrome, text, borders, backgrounds |

Text on ball yellow is never white. When yellow carries text (the "Waiting" badge) use `ball-50` background with `ball-800` text. The open marker itself is a 10px dot of `ball-500` with a 3px ring of `ball-100`.

### Typography

Two families, loaded automatically by `@nuxt/fonts` when declared in `@theme`:

- `--font-display`: **Bricolage Grotesque**, weight 700, used for page titles, day numbers, and every time range ("18:00–19:30"). Times set in the display face are what makes a slot chip recognisable at arm's length.
- `--font-sans`: **Instrument Sans**, weights 400, 500, 600, for everything else.

Scale (mobile / desktop):

| Role | Size | Family, weight |
|---|---|---|
| Page title | 22px / 26px, tracking -0.015em | display 700 |
| Section or day heading | 14px / 15px | display 700 |
| Time range in a slot chip | 16px | display 700 |
| Body, names | 14px, names 600 | sans |
| Meta (formats, languages, venue, age) | 12px, `text-muted` | sans 400 |
| Badge | 11px | sans 600 |
| Tab bar label | 10.5px | sans 500 |

Line length in prose (bios, onboarding help) is capped at 65 characters with `max-w-prose`.

### Shape, elevation, spacing

- `--ui-radius: 0.375rem`. Cards and sheets use `rounded-2xl` (16px), chips and inputs `rounded-lg`, badges `rounded-md`, avatars and the open dot fully round.
- Elevation: cards are `bg-elevated` with `border-default` and no shadow. Only bottom sheets, popovers and the desktop notification panel carry a shadow (`shadow-xl`).
- Page background is `bg-default` (slate-50 in light mode). Cards sit on it as white.
- Spacing on the 4px grid. Page gutter 16px on mobile, 28px on desktop. Card padding 14px. Gap between cards 8px on mobile, 12px on desktop.
- `--ui-container: 72rem` (1152px) for desktop content width. The search page content column is capped at 1040px.

### Icons

Lucide only, via `i-lucide-*`. Nav: `search`, `calendar-days`, `inbox`, `message-circle`, `user-round`. Actions: `plus`, `x`, `bell`, `copy`, `map-pin`, `ellipsis-vertical`, `send`, `chevron-left`, `chevron-right`. Never mix in a second icon set.

### Dark mode

Supported through Nuxt UI's semantic tokens, not designed separately. The colour mode toggle lives on the settings page, not in the header. Before release, verify contrast of `court-400` on slate-900 and of the ball dot on dark cards; adjust the dark-mode `--ui-primary` shade if needed.

## 3. App shell

Two breakpoints matter: `md` (768px) switches the shell, `lg` (1024px) adds side panels.

### Below `md`: tab bar

- No top navigation. Each page owns its title in a compact header row: title on the left in the display face, an optional subtitle under it in `text-muted`, one secondary action or the notification bell on the right.
- Bottom tab bar, 64px, five items: **Find** (`/`), **Calendar** (`/calendar`), **Requests** (`/requests`), **Messages** (`/messages`), **Me** (`/settings`). Icon over label, active item in `primary`, inactive in `text-dimmed`. Requests and Messages show a `ball-500` dot when there is anything unread or waiting.
- The tab bar is hidden on `/messages/[id]`, `/onboarding`, and all auth pages.
- The notification bell sits in the page header row on Find and Calendar. Opening it shows a `USlideover` from the bottom listing notifications and marks them read.

### `md` and up: top bar

`UHeader` on every app page, 56px:

- Left: wordmark, a `ball-500` circle (18px) followed by "Tennis Buddy" in the display face.
- Centre: `UNavigationMenu` with Find, Calendar, Requests, Messages. Active item gets `court-50` background and `court-600` text. Requests and Messages carry the same unread dot.
- Right: "Add availability" (`color="secondary"`, `variant="solid"`, `icon="i-lucide-plus"`, opens the add-slot sheet for today), the bell (`variant="ghost"`, opens a `UPopover` panel), and the user avatar as a `UDropdownMenu` with Settings and Sign out.
- Content inside `UContainer`. Page title row repeats under the header at 26px with its subtitle.

### Auth layout

`/login`, `/register`, `/verify-email`, `/onboarding` use a second layout: no tab bar, no nav. A centred column, max 420px (onboarding 560px), wordmark at the top, one `UCard`. Background `bg-default`.

## 4. Shared components

All in `apps/web/app/components`, auto-imported. Names are the file names.

| Component | Purpose | Notes |
|---|---|---|
| `AppTabBar` | mobile bottom navigation | reads unread counts from the notifications query |
| `AppHeader` | desktop `UHeader` | replaces the scaffold's `Header.vue` |
| `NotificationBell` | bell with unread dot, opens panel | slideover below `md`, popover above |
| `NtrpBadge` | `UBadge` `color="primary" variant="soft"` with the rating | always next to a name, never alone |
| `SlotStatusDot` | 10px dot; `warning` for open, `success` for matched | the only place `ball-500` is painted |
| `PlayerIdentity` | avatar, display name, `NtrpBadge`, meta line (age, formats, languages) | avatar from `avatarStorageId` or initial on a slate gradient |
| `SlotCard` | search result: `SlotStatusDot` + time range + duration, `PlayerIdentity`, venue, divider, age/years line and the "Ask to play" button | the full slot chip; used on `/` and `/players/[id]` |
| `SlotRow` | compact one-line slot: dot, time range, venue, trailing action | used in the calendar sheet, request cards, chat pin |
| `DayRail` | horizontal strip of days; each shows weekday, day number, and a `ball-500` dot if that day has open results | 7 visible on desktop, scrolls on mobile; selected day is `primary` solid |
| `SearchFilters` | date range, time of day, NTRP range, format, venue | panel at `lg`, chip row plus a `USlideover` below |
| `CalendarMonth` | `UCalendar` with a custom day cell: dots under the number for open (yellow) and matched (green) slots, past days dimmed | month navigation with chevrons |
| `DaySheet` | selected day's `SlotRow`s with delete, plus the add-slot form | `USlideover side="bottom"` below `md`, right column at `md` and up |
| `RequestCard` | `PlayerIdentity`, `SlotRow`, optional message, status badge, actions | Accept solid primary, Decline outline neutral; accepted state shows "Open chat" |
| `RequestStatusBadge` | Waiting (`warning soft`), Accepted (`success soft`), Declined and Cancelled (`neutral soft`) | |
| `ConversationRow` | avatar, name, last message preview, time, unread count | used on `/messages` |
| `MessageBubble` | mine: `primary` solid, white text, right aligned; theirs: white card, left aligned | time inside bubble at 10px |
| `MessageComposer` | rounded `UTextarea` (auto-grow) and a round send button | pinned to the bottom |
| `EmptyState` | thin wrapper on `UEmpty` with icon, one sentence, one action | copy per page in section 6 |

Loading states use `USkeleton` blocks shaped like the component they replace (a `SlotCard` skeleton is 118px tall with the same padding), never a spinner in the content area. The route-level `NuxtLoadingIndicator` uses `court-500`.

## 5. Pages

Each page is described at mobile, then how it changes on desktop.

### `/` Find a game

Mobile: title row ("Find a game", bell). `DayRail` for the next 7 days. Filter chip row (time of day, NTRP range, format, venue) that opens `SearchFilters` in a bottom sheet. Day heading with an "N open" count on the right. A single column of `SlotCard`s for the selected day, "Ask to play" as the only blue button in each card. Infinite scroll while the paginated query is not done.

Desktop (`lg`): two columns inside the 1040px content width. Left, a 250px `SearchFilters` panel: dates as a range picker, time of day as a segmented control, NTRP as a `USlider` with two handles, format checkboxes, venue select. Right, the `DayRail` stretched to show all 7 days, the day heading, and `SlotCard`s in a two-column grid. Between `md` and `lg`, the filters stay as chips and the grid is two-up.

Tapping "Ask to play" opens a `UModal` with the `SlotRow`, an optional message (`UTextarea`, 300 chars, counter), and a primary "Send request". On success the card's button becomes a disabled "Requested" outline and a toast says "Request sent".

### `/calendar` My availability

Mobile: title row ("My availability", subtitle "When you can play", secondary "Copy last week" as `variant="soft"`). `CalendarMonth` full width. Selecting a day raises `DaySheet` over the lower half: the date, the day's `SlotRow`s each with an `x` delete (matched slots show "Cancel" in error soft instead, with a confirm modal), then "Add a slot": start and end as 30-minute `USelect`s, venue `USelect` (optional), note `UInput` (optional), and a primary "Add slot".

Desktop: month on the left (max 520px) and the `DaySheet` as a permanent right column (360px) that shows today until a day is picked.

### `/players/[id]` Player profile

Mobile: large avatar (72px), name with `NtrpBadge`, meta line, bio in prose width, a facts row (formats, handedness, years playing, languages as `neutral soft` badges). Then "Open slots" heading and `SlotCard`s without the identity block (the page already is the identity). Overflow menu (`ellipsis-vertical`) with Block and Report.

Desktop: identity card on the left (320px), slots on the right in a single column.

### `/requests` Requests

Segmented control (`UTabs` styled as a pill): "Received · N" and "Sent". Each tab lists `RequestCard`s newest first, waiting ones before responded ones, responded ones at 75% opacity. Received: Accept and Decline. Sent: "Cancel request" in `error soft` while waiting, status badge otherwise. Empty received: "No requests yet. Add availability and players near you can ask to play." with a button to the calendar.

Desktop: single column capped at 640px, centred.

### `/messages` and `/messages/[id]`

Mobile: `/messages` lists `ConversationRow`s sorted by last message; unread rows show the count in a `primary solid` badge. `/messages/[id]` hides the tab bar, shows a back chevron, the other player's `PlayerIdentity`, and the overflow menu. The matched slot is pinned at the top of the thread as a white chip with a green dot. Bubbles follow `MessageBubble`; date separators are 11px `text-dimmed`. `MessageComposer` is pinned to the bottom.

Desktop: split view inside the container, conversation list 320px on the left, thread on the right, `/messages` alone shows the list with an empty right pane saying "Pick a conversation".

### `/settings` Me

Sections as `UCard`s stacked in a 640px column: Profile (edit form, same fields as onboarding minus birth date), Notifications (email toggle), Appearance (colour mode), Blocked players (list with Unblock), Account (Sign out, then "Delete account" in `error outline` with a typed confirmation modal).

### Auth and onboarding

`/login` and `/register`: wordmark, title, Google and Facebook as `neutral outline` full-width buttons with their icons, a divider "or with email", then the email form with one primary button ("Sign in" / "Create account"). `/verify-email`: single card with the instruction and a "Resend email" soft button.

`/onboarding`: one long `UForm` in sections with headings: About you (display name, birth date, gender), Your tennis (NTRP as a `URadioGroup` in card style where each option shows the rating and a one-line description, years playing, formats, handedness), Languages, Photo and bio. Municipality and district are shown as read-only text "Figueira da Foz, Coimbra". Primary button "Finish" at the bottom. The form validates on blur with the shared zod schemas.

### `/admin/reports`

Plain `UTable` inside the app shell: reporter, reported player, reason, details, message excerpt, created. Row actions: "Mark reviewed" (`primary soft`) and "Dismiss" (`neutral ghost`). No special styling; this page is for the owner.

## 6. Copy

Vocabulary is fixed so the same word appears in the button, the toast and the status:

| Action / state | Word |
|---|---|
| Send a match request | "Ask to play" → toast "Request sent" → button "Requested" |
| Respond | "Accept" → toast "Accepted, chat is open"; "Decline" → toast "Declined" |
| Withdraw own request | "Cancel request" → toast "Request cancelled" |
| Add availability | "Add slot" → toast "Slot added"; delete is an `x` with tooltip "Remove slot" |
| Copy previous week | "Copy last week" → toast "Copied N slots" |
| Request states | Waiting, Accepted, Declined, Cancelled |
| Slot states | open (dot only, no word), Matched, Cancelled |
| Nav | Find, Calendar, Requests, Messages, Me |
| Page titles | "Find a game", "My availability", "Requests", "Messages", "Settings" |

Empty states, one sentence plus one action:

- Find: "No one is free on this day yet. Try another day or widen the level range." Action: "Clear filters".
- Calendar: "You have no slots this month. Add when you can play and players can find you." Action: "Add slot".
- Messages: "Chats open when a request is accepted." Action: "Find a game".

Errors state what happened and what to do, in the interface's voice, no apologies: "Couldn't send the request. Check your connection and try again." Validation messages come from the shared zod schemas.

## 7. Accessibility and quality floor

- Every interactive element has a visible focus ring in `court-500`, 2px offset.
- The open marker is never the only signal: a slot card also says the time in the display face and the request button is present only when open; the "Waiting" badge carries text.
- Colour contrast: body text slate-900 on white, meta slate-600 on white, white on `court-500` (buttons), `ball-800` on `ball-50` (badge). All above 4.5:1.
- Tab bar and header are keyboard navigable; sheets trap focus and close on Escape.
- Touch targets at least 44px on mobile; the `x` delete on a `SlotRow` is a 44px hit area around a 16px icon.
- `prefers-reduced-motion` disables sheet slide and any transition longer than 150ms.
- Mobile-first CSS: no horizontal scroll at 360px width.

## 8. Implementation notes

For the frontend plan; not a plan itself.

- `main.css`: `@import "tailwindcss"; @import "@nuxt/ui";` then `@theme static` with the three scales and the two font variables, then `:root { --ui-radius: 0.375rem; --ui-container: 72rem; }`.
- `app.config.ts`: `ui.colors` per section 2; `ui.button.defaultVariants` unchanged; `ui.card.slots.root` to `rounded-2xl`.
- `nuxt.config.ts`: `fonts` needs no change; `@nuxt/fonts` picks up the families from `@theme`.
- Layouts: `default.vue` (shell) and `auth.vue`. The scaffold's `Header.vue` is replaced by `AppHeader.vue`; `todos.vue` is already removed by the backend plan.
- Component props are typed from `Doc<"availabilitySlots">`, `Doc<"profiles">` and the search result shape returned by `api.availability.search`.
- The slot chip components (`SlotCard`, `SlotRow`, `SlotStatusDot`) must be built first and reused; no page may render a time range with its own markup.
- Slot and request data shape is owned by the backend plan; this spec does not add fields.

## 9. Out of scope

Landing or marketing page (the app opens on `/login` or `/`), a dedicated dark-mode design, custom illustrations, avatar cropping UI, a desktop week-board view of the calendar, animations beyond sheet transitions, and a design system package shared with other apps.