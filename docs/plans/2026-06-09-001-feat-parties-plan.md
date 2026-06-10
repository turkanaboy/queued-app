---
title: "feat: Add Parties — shared group media lists with voting and picker rotation"
date: 2026-06-09
sequence: "001"
type: feat
status: active
origin: docs/brainstorms/2026-06-09-parties-requirements.md
---

# feat: Parties — Shared Group Media Lists

## Summary

Introduces persistent "parties" — named groups where friends (and their friends) share a media list, add items from their personal queues, and converge on what to watch using optional vote or rotation modes. Post-pick, every member's personal media log is updated server-side via a dedicated Supabase RPC.

---

## Problem Frame

When 3+ users want to agree on what to watch, the current peer-to-peer recommendation flow breaks down. There is no group surface. Users fall back to group texts — unstructured, no shared record. Parties replace that with a persistent shared list and lightweight decision tooling, plugging directly into existing personal media logs. (see origin: `docs/brainstorms/2026-06-09-parties-requirements.md`)

---

## Success Criteria

- A user can create a party, share its invite link, and have others join without any friendship pre-requisite.
- All members can add items to the shared list and see each other's additions after a refresh.
- Vote mode: majority (≥50% of member count upvoting a single item) surfaces a clear "pick this" signal; the party leader can break a tie manually.
- Rotation mode: the current picker is clearly displayed; after a pick the turn advances to the next member by join order.
- When a pick is made, the item is marked watched on the party list and logged as `finished` in every member's personal media log — even if some members' browsers are closed.
- A new Parties section is accessible from the main nav.

---

## Scope Boundaries

### In scope
- Party creation, membership, and invite link flow
- Shared media list (manual add + "add from my queue" shortcut + queue overlap suggestions)
- Vote mode and rotation/picker mode (both optional — groups can also pick informally)
- Post-pick fan-out to all members' `user_media_log` via server-side RPC
- Parties list page and party detail page
- Navigation integration

### Deferred to follow-up work
- Push notifications when a vote opens or a pick is made
- Party size cap enforcement (schema supports it; UI cap is deferred)
- Member removal UI (creator data model supports it; admin UI is deferred)
- Overlap suggestions across all media types simultaneously (v1 may scope to one type at a time)

### Out of scope
- Real-time live updates (pull-to-refresh is sufficient for async "vote today" behavior)
- Friendship requirement for party membership
- Public party discovery or search
- In-party chat or messaging
- Aggregate party ratings or party-level scores
- Watch-together sync playback

---

## Key Technical Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Party invite token storage | One UUID column on `parties` row | One token per party, any member can share. Different from `invite_links` which is one token per user. |
| Fan-out on pick | Server-side `pick_party_item` RPC (security definer) | Atomic — completes even if picker's browser closes mid-loop. Consistent with `accept_friend_invite` pattern. |
| Invite URL shape | `/login?party_invite=<token>` | Mirrors existing friendship invite flow. Non-users can follow the link and join after signing up. Extends existing `InviteHandler`. |
| Rotation tracking | Derived: `pick_count % member_count` on ordered members | No separate turns table. Current picker = `party_members` ordered by `joined_at` at index `(watched_item_count % member_count)`. |
| Vote majority threshold | `upvote_count >= ceil(member_count / 2)` | 50% of all members (not votes cast) must upvote the same item. Leader can manually call a pick if no item reaches threshold. |
| Creator auto-membership | Trigger on `parties` insert | Creator is always a member. Trigger inserts into `party_members` immediately on party creation, ensuring no orphaned party. |
| Queue overlap suggestions | SQL query joining `user_media_log` across members | Items in ≥2 members' queues, not already on the party list. Runs client-side as a Supabase query, no edge function needed. |
| Downvote tracking | Boolean `vote` column in `party_votes` | Tracks both up and down explicitly per the UX spec (thumbs-up / thumbs-down). Majority is calculated on upvotes only. |

---

## High-Level Technical Design

*This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

### Data model

```
parties
  id (PK uuid)
  name (text)
  creator_id → users
  invite_token (uuid, unique, default gen_random_uuid())
  created_at

party_members
  id (PK uuid)
  party_id → parties (cascade delete)
  user_id → users (cascade delete)
  joined_at (default now())
  UNIQUE (party_id, user_id)

party_list_items
  id (PK uuid)
  party_id → parties (cascade delete)
  media_type, media_id, media_title, media_creator, media_poster_url
  added_by → users
  status: 'unwatched' | 'watched'
  watched_at (nullable)
  picked_by → users (nullable)
  created_at
  UNIQUE (party_id, media_type, media_id)

party_votes
  id (PK uuid)
  party_item_id → party_list_items (cascade delete)
  party_id → parties  ← denormalized for RLS efficiency
  user_id → users
  vote (boolean: true=up, false=down)
  created_at
  UNIQUE (party_item_id, user_id)
```

### Pick + fan-out sequence

```
Member taps "Pick this"
  → client calls supabase.rpc('pick_party_item', { p_item_id })
    → RPC verifies caller is party member
    → UPDATE party_list_items SET status='watched', watched_at=now(), picked_by=auth.uid()
    → FOR each user_id IN party_members WHERE party_id = item.party_id:
        INSERT INTO user_media_log (..., status='finished')
        ON CONFLICT (user_id, media_type, media_id) DO UPDATE SET status='finished'
    → returns void
  → client refreshes party list (pull-to-refresh / re-fetch)
```

### Rotation calculation (client-side, no extra table)

```
members = party_members ORDER BY joined_at ASC
pick_count = COUNT(party_list_items WHERE status='watched')
current_picker = members[ pick_count % members.length ]
```

---

## Implementation Units

### U1. Database schema migration

**Goal:** Create the four party tables, RLS policies, helper function, and trigger for creator auto-membership.

**Requirements:** All schema requirements for parties, members, list items, and votes. Foundation for all other units.

**Dependencies:** None

**Files:**
- `supabase/migrations/20260609000001_parties.sql`

**Approach:**
- Define `party_item_status` enum: `'unwatched'`, `'watched'`
- Create `parties`, `party_members`, `party_list_items`, `party_votes` tables per the data model above
- Create `public.is_party_member(p_party_id uuid)` helper (stable, security definer) analogous to `are_friends()`:
  ```
  SELECT EXISTS (SELECT 1 FROM party_members WHERE party_id = p_party_id AND user_id = auth.uid())
  ```
- Create trigger `on_party_created` (after insert on `parties`) that inserts `(new.id, new.creator_id)` into `party_members`
- RLS policies:
  - `parties`: select for members (`is_party_member(id)`), insert for authenticated (creator sets `creator_id = auth.uid()`), delete for creator only
  - `party_members`: select for members, insert/delete blocked (only via RPCs and trigger)
  - `party_list_items`: select/insert for members, update own adds only (or any member — decide: any member can mark watched via RPC so update policy allows members)
  - `party_votes`: select for members, insert/update/delete for own votes only
- Grants: `grant select, insert, update, delete on party_list_items, party_votes to authenticated`; `grant select on parties, party_members to authenticated`; `grant insert on parties to authenticated`
- Indexes: `(party_id, status)` on `party_list_items`; `(party_id, user_id)` on `party_members`; `(party_item_id)` on `party_votes`

**Patterns to follow:** `supabase/migrations/20260607_trivia_challenges.sql` for enum + table + RLS structure; `002_rls.sql` for `are_friends()` helper pattern; `013_security_hardening.sql` for security definer views and trigger enforcement.

**Test scenarios:**
- Creator auto-added: inserting a party row results in a `party_members` row for the creator
- `is_party_member` returns true for members, false for non-members and unauthenticated
- RLS select: non-member cannot see party rows or list items
- RLS insert on `party_list_items`: member can insert, non-member is rejected
- RLS insert on `party_votes`: member can vote on own party items; non-member rejected; duplicate vote (same `party_item_id, user_id`) is rejected by unique constraint
- Cascade delete: deleting a party removes all `party_members`, `party_list_items`, and `party_votes`
- Unique constraint on `(party_id, media_type, media_id)` prevents duplicate list entries

**Verification:** Migration applies cleanly with `supabase db push` (or equivalent). All RLS scenarios above pass with `supabase test db` or manual psql role-switching.

---

### U2. Supabase RPCs — join party and pick item

**Goal:** Two security-definer functions: `join_party` (membership via invite token) and `pick_party_item` (mark watched + fan-out to all member logs).

**Requirements:** Party invite flow; post-pick fan-out to personal media logs.

**Dependencies:** U1

**Files:**
- `supabase/migrations/20260609000002_party_rpcs.sql`

**Approach:**

`join_party(p_invite_token uuid) returns uuid` (returns party_id):
- Lookup party by `invite_token`; raise exception if not found
- Return early with party_id if caller is already a member
- Insert caller into `party_members`
- Return `party_id` so the client can redirect to `/parties/:partyId`
- Race condition: ON CONFLICT on unique `(party_id, user_id)` returns existing row safely

`pick_party_item(p_item_id uuid) returns void`:
- Fetch item row; verify `is_party_member(item.party_id)` — raise if not
- Verify item status is `'unwatched'` — raise if already picked
- `UPDATE party_list_items SET status='watched', watched_at=now(), picked_by=auth.uid() WHERE id=p_item_id`
- Loop over `party_members` for the party; for each member upsert into `user_media_log`:
  - Fields: `user_id`, `media_type`, `media_id`, `media_title`, `media_creator`, `media_poster_url`, `status='finished'`, `source_type='self'`
  - ON CONFLICT `(user_id, media_type, media_id)` DO UPDATE SET `status='finished'`
- Both RPCs: `language plpgsql security definer`

**Patterns to follow:** `private.accept_friend_invite` in `20260607013028_invite_friendship_rpc.sql` for security definer + membership insertion pattern.

**Test scenarios:**
- `join_party` with valid token: returns party_id, membership row created
- `join_party` with invalid token: raises exception
- `join_party` called twice by same user: idempotent, returns party_id without error or duplicate row
- `join_party` called by party creator (already a member): returns party_id cleanly
- `pick_party_item` by valid member: item status becomes `'watched'`, `picked_by` set to caller, all members get `user_media_log` row with `status='finished'`
- `pick_party_item` fan-out: member who already had the item with `status='queued'` gets updated to `'finished'`; member with no prior log entry gets a new `'finished'` entry
- `pick_party_item` by non-member: raises exception
- `pick_party_item` on already-watched item: raises exception (idempotency guard)

**Verification:** Both RPCs callable via `supabase.rpc()` from client. Fan-out verified by checking `user_media_log` for all party members after calling `pick_party_item`.

---

### U3. Party lib (`src/lib/parties.js`)

**Goal:** All client-side data access functions for parties — create, fetch, list operations, voting, and overlap suggestions.

**Requirements:** Data layer for all UI units.

**Dependencies:** U1, U2

**Files:**
- `src/lib/parties.js`

**Approach:**

Functions to implement:

- `createParty(name)` — insert into `parties` with `creator_id = session.user.id`. Returns new party row. Trigger handles creator membership.
- `getUserParties()` — fetch `parties` joined through `party_members` for current user. Include member count via `party_members(count)` nested select. Order by `created_at desc`.
- `getParty(partyId)` — fetch party row + `party_members` with nested `users(id, username, display_name)`. Include `party_list_items` with nested `party_votes`.
- `addToPartyList(partyId, mediaItem)` — insert into `party_list_items`. `mediaItem` shape matches existing media objects (media_type, media_id, media_title, media_creator, media_poster_url). Sets `added_by = session.user.id`, `status = 'unwatched'`.
- `castVote(partyItemId, partyId, isUp)` — upsert into `party_votes` with `onConflict: 'party_item_id,user_id'`. Passing `isUp = null` deletes the vote row (retract).
- `pickItem(itemId)` — calls `supabase.rpc('pick_party_item', { p_item_id: itemId })`.
- `joinParty(inviteToken)` — calls `supabase.rpc('join_party', { p_invite_token: inviteToken })`. Returns `partyId`.
- `buildPartyInviteLink(inviteToken)` — constructs `/login?party_invite=<token>` URL using `window.location.origin`. Analogous to `buildInviteLink` in `src/lib/invites.js`.
- `getMyQueueItems(partyId)` — fetch `user_media_log` where `user_id = session.user.id` and `status = 'queued'`, excluding items already on the party list. Join against `party_list_items` to filter.
- `getOverlapSuggestions(partyId)` — fetch items appearing in ≥2 party members' `user_media_log` with `status = 'queued'`, not already on the party list. Uses a Supabase query joining `user_media_log` through `party_members`. Groups by `(media_type, media_id)`, filters for `COUNT(DISTINCT user_id) >= 2`.
- `getCurrentPicker(members, watchedCount)` — pure function. `members` sorted by `joined_at asc`. Returns `members[watchedCount % members.length]`.

**Patterns to follow:** `src/lib/invites.js` for token/link pattern; `src/lib/mediaLog.js` for upsert and field conventions; direct `supabase` client calls as used throughout the codebase.

**Test scenarios:**
- `createParty` returns a row with `invite_token` populated; subsequent `getUserParties` includes the new party
- `addToPartyList` with a duplicate `(party_id, media_type, media_id)` surfaces a Supabase conflict error gracefully (caller should handle)
- `castVote` upsert: calling twice with different `isUp` values updates the existing vote row
- `castVote` retract (`isUp = null`): vote row is deleted, subsequent fetches reflect removal
- `getMyQueueItems` excludes items already on the party list
- `getOverlapSuggestions` returns only items with ≥2 distinct member queue entries and not on the list; single-member queued items are excluded
- `getCurrentPicker` with 3 members and 4 prior picks returns `members[4 % 3]` = `members[1]`
- `buildPartyInviteLink` produces a URL containing `/login?party_invite=` and the token

**Verification:** All functions callable from browser console / dev tools with a real Supabase session. `getOverlapSuggestions` returns non-empty results when two test members share a queued item.

---

### U4. Extend InviteHandler for party invites

**Goal:** Detect `?party_invite=<token>` in the URL on load, store it, and trigger `join_party` after authentication — mirroring how friendship invites work today.

**Requirements:** Party invite join flow.

**Dependencies:** U2, U3

**Files:**
- `src/App.jsx` (modify `InviteHandler` component)

**Approach:**
- In `InviteHandler`, read `URLSearchParams` for both `invite` (existing) and `party_invite` (new) params
- On detecting `party_invite`, store token in `localStorage` under key `pending_party_invite`
- After the user authenticates and completes setup (existing `RequireUsername` guard clears), check for `pending_party_invite` in localStorage
- Call `joinParty(token)` from `src/lib/parties.js`
- On success, clear the localStorage key and navigate to `/parties/:partyId`
- On failure (invalid token, already a member — idempotent), clear the key and navigate to `/parties`
- Guard: if the joining user is the party creator (returned partyId matches a party they already own), skip the RPC (already a member) and just navigate

**Patterns to follow:** Existing `InviteHandler` and `acceptStoredInvite()` flow in `src/App.jsx` and `src/lib/invites.js`.

**Test scenarios:**
- Visiting `/login?party_invite=<valid_token>` stores token in localStorage and clears `?party_invite` from the URL
- After auth and setup complete, `joinParty` is called once and user is redirected to `/parties/:partyId`
- Visiting with an invalid token: join fails, user lands on `/parties` without error crash
- Visiting as the party creator (already a member): idempotent — no duplicate membership, redirect succeeds
- Visiting without a `party_invite` param: existing friendship invite behavior is unchanged

**Verification:** Full invite flow testable by copying a party invite link, logging out, opening the link, signing in, and confirming navigation to the correct party page.

---

### U5. Parties list page

**Goal:** `/parties` — shows all parties the user belongs to, with a "Create party" entry point.

**Requirements:** Party creation, party list surface.

**Dependencies:** U1, U3

**Files:**
- `src/pages/PartiesPage.jsx` (new)
- `src/App.jsx` (add `/parties` route)

**Approach:**
- On mount: call `getUserParties()` and render a list of party cards
- Each party card: party name, member count, small member username strip (up to 3, then "+N more")
- "Create party" button opens an inline name input (no separate modal — inline form within the page, consistent with the app's pattern of no dedicated modal component)
- On submit: call `createParty(name)`, then navigate to `/parties/:partyId`
- Empty state: "No parties yet — create one or join via an invite link"
- Loading state during fetch
- Pull-to-refresh: re-call `getUserParties()` on a refresh gesture or on page focus

**Patterns to follow:** `src/pages/FriendsPage.jsx` for section layout, empty state, and inline action pattern. `src/lib/queuedDesign.jsx` for colors and `ScreenHeader`/`SectionTitle` primitives.

**Test scenarios:**
- User with no parties sees the empty state and create button
- Creating a party: name input validates non-empty; on submit, card appears in list; navigates to detail page
- Party card shows correct member count after another user joins
- Party created by another user (joined via invite) appears in list alongside owned parties
- Pull-to-refresh re-fetches and updates the list

**Verification:** Create a party, confirm it appears in the list, click through to the detail page.

---

### U6. Party detail page

**Goal:** `/parties/:partyId` — the core shared list UI: add items, vote, see rotation, mark picks, view watch history.

**Requirements:** Shared list, vote mode, rotation mode, post-pick fan-out (via RPC), overlap suggestions, "add from my queue" shortcut.

**Dependencies:** U1, U2, U3, U5

**Files:**
- `src/pages/PartyDetailPage.jsx` (new)
- `src/App.jsx` (add `/parties/:partyId` route)

**Approach:**

**Data fetching:** On mount, call `getParty(partyId)`. Derives members, list items, votes, current picker, and watch history from the single response. Re-fetches on pull-to-refresh.

**Page sections:**

1. **Header strip** — party name, member avatars (tappable → profile), "Share invite" button (calls `buildPartyInviteLink` + clipboard copy, same pattern as `copyInviteLink` in `FriendsPage`)

2. **Unwatched list** — items with `status = 'unwatched'`, sorted by `created_at asc` (oldest suggestion first). Each item shows: poster, title, added-by username, vote counts, thumbs-up/down buttons, majority indicator ("3/5 voted ✓" when threshold met).
   - Vote buttons: call `castVote(itemId, partyId, isUp)` then optimistically update local state
   - Majority indicator: `upvoteCount >= Math.ceil(memberCount / 2)`
   - When majority is met: item is highlighted, a "Pick this" button appears
   - Party leader also sees "Call it" (manual pick) on any item regardless of vote count
   - Rotation mode: the current picker badge ("Your pick" or "{name}'s pick") is shown at the top of the list; only the current picker sees a "My pick" button on items (in addition to the majority-triggered "Pick this")

3. **Add items panel** (collapsed by default, expands on tap) — two tabs:
   - "From my queue": calls `getMyQueueItems(partyId)`, renders a scrollable list, one-tap add calls `addToPartyList`
   - "Overlap suggestions": calls `getOverlapSuggestions(partyId)`, shows items 2+ members have queued with a "members also want this" label and one-tap add

4. **Watched list** (collapsed section) — items with `status = 'watched'`, sorted by `watched_at desc`. Shows who picked it and when. Tapping an item navigates to the media search/detail if available.

**Pick action flow:**
- Tap "Pick this" / "My pick" / "Call it" → call `pickItem(itemId)` → on success, re-fetch (`getParty`)
- Show loading state on the tapped button during the RPC call
- On error, surface toast-style error message

**Invite copy** — reuses `execCommand` fallback pattern from `FriendsPage.jsx:copyInviteLink`.

**Patterns to follow:** `src/pages/SharedListPage.jsx` for list rendering and filter patterns; `src/pages/FriendsPage.jsx` for copy-link pattern; `src/lib/queuedDesign.jsx` for `MEDIA`, `STATUS`, color constants.

**Test scenarios:**
- Member can add an item from their queue; item appears in unwatched list after refresh
- Overlap suggestion for an item both members have queued appears in the suggestions tab; adding it removes it from suggestions and adds to list
- Adding an item already on the list: Supabase conflict error is caught and shown as "Already on the list"
- Vote: thumbs-up increments upvote count; thumbs-down stores down vote; retracting a vote decrements count
- Majority indicator appears when `upvoteCount >= ceil(memberCount / 2)`; "Pick this" button appears
- Non-leader member does not see "Call it" button
- Party leader sees "Call it" on any unwatched item
- Picking an item: item moves to watched section; `user_media_log` for all members updated to `finished` (verify via ProfilePage)
- Current picker display: after N picks, badge shows correct member per `pick_count % member_count`
- Share invite button copies the correct URL with `?party_invite=<token>`
- Watched list renders collapsed; expanding shows items in reverse chronological order

**Verification:** Full flow — create party, add items, vote to majority, pick, confirm watched section updates, confirm personal media logs on both user accounts reflect `finished`.

---

### U7. Navigation integration

**Goal:** Add Parties to the bottom navigation so it is discoverable from anywhere in the app.

**Requirements:** New Parties section accessible from main nav.

**Dependencies:** U5

**Files:**
- `src/components/Layout.jsx` (add Parties nav item)
- `src/App.jsx` (register `/parties` and `/parties/:partyId` routes inside the authenticated Layout)

**Approach:**
- Add a "Parties" tab to the bottom nav in `Layout.jsx` alongside Friends, Queued, Collection, Profile
- Route `/parties` → `<PartiesPage />`, `/parties/:partyId` → `<PartyDetailPage />` — both inside the `RequireAuth` + `RequireUsername` + `Layout` wrapper
- Use an appropriate icon consistent with the existing nav icon style (film reel, group, etc.)
- Active state: highlight Parties tab when current path starts with `/parties`

**Patterns to follow:** Existing nav items in `src/components/Layout.jsx`.

**Test scenarios:**
- Parties tab is visible and tappable on all existing pages
- Tapping Parties from any page navigates to `/parties`
- Active highlight appears correctly on `/parties` and `/parties/:partyId`
- All existing nav tab routes (Friends, Queued, Collection, Profile) are unaffected

**Verification:** Navigate between all tabs. Parties tab active state works on both `/parties` and `/parties/:partyId`.

---

## System-Wide Impact

| Surface | Impact |
|---|---|
| `user_media_log` | Written to by the `pick_party_item` RPC for all party members. Existing upsert behavior and unique constraint are reused. No schema changes to this table. |
| `invite_links` | Unchanged. Party invites use a separate `invite_token` column on `parties`, not `invite_links`. |
| `InviteHandler` (`src/App.jsx`) | Extended to handle `?party_invite` param alongside existing `?invite` param. Both flows remain independent. |
| Bottom nav (`src/components/Layout.jsx`) | One new tab added. Existing tabs and routes are unaffected. |
| Auth/session flow | No changes. Party join happens post-auth via the same stored-token pattern as friendship invites. |

---

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Fan-out RPC fails mid-loop (DB error on one member's log insert) | Low | Medium — some members miss the `finished` entry | RPC runs in a single transaction; if any insert fails, the whole transaction rolls back and the item stays `unwatched`. Client surfaces the error; user can retry pick. |
| Overlap suggestion query is slow for large parties with many queued items | Low | Low — UX delay | Query is scoped to party members only (small N). Add an index on `(user_id, status)` on `user_media_log` if not already present. |
| `party_invite` token collision with `invite` token in localStorage | None | None | Keys are distinct: `pending_party_invite` vs the existing friendship invite key. |
| Member joins party they were already in (duplicate membership) | Low | None | `join_party` RPC handles via ON CONFLICT on `(party_id, user_id)` — idempotent. |
| Party with 0 unwatched items triggers divide-by-zero in rotation | Low | Low — UI glitch | `getCurrentPicker` guard: return null when `members.length === 0`; hide rotation section. |

---

## Deferred Implementation Notes

- Exact Supabase column constraint name for `user_media_log`'s unique index (`media_log_unique_by_type` or similar) — verify against migration 012 before writing the RPC's ON CONFLICT clause.
- Whether `user_media_log` needs an `updated_at` column for the fan-out upsert, or if updating `status` alone is sufficient — check existing upsert behavior in `src/lib/mediaLog.js`.
- Icon choice for the Parties nav tab — defer to implementation, consistent with existing nav icon set.
- Whether `getOverlapSuggestions` needs media-type filtering in v1 or returns all types — implementation can decide based on query performance.
