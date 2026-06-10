# Parties — Requirements
**Date:** 2026-06-09  
**Status:** Ready for planning

---

## Problem

When 3+ friends want to agree on what to watch together, the current peer-to-peer rec flow (1→1) breaks down. They fall back to group texts — chaotic, slow, and no shared record of what they decided. Parties replace that chaos with a structured, persistent shared space for a friend group's movie nights.

---

## Core Concept

A **party** is a persistent, named group with a shared media list and a built-in way to decide what to watch next. Any member can invite others via a private link. The list grows over time and doubles as the group's watch history.

---

## Users

Any Queued user who watches media with a recurring group of people — friends, family, a couple. The primary actor is the party creator, but all members are equal participants once inside.

---

## Functional Requirements

### Party creation & membership

- Any user can create a party with a name.
- The creator receives a private invite link they can share; **any current member** can also share this link (not just the creator).
- The link is **not publicly discoverable** — it only works if shared directly. There is no party search or browse surface.
- Joining requires the invite link. No friendship with existing members is required.
- A user can be a member of multiple parties.
- The creator can remove members or disband the party. Members can leave at any time.

### Shared list

- The party has a single shared media list all members contribute to.
- Any member can add any media item (movie, TV show, game, etc.) to the list.
- Members can add items from their personal queue with one tap ("Add from my queue" shortcut).
- The app surfaces **queue overlap** as non-blocking suggestions: "3 of you already have Severance queued — add it?" Members can dismiss or accept.
- Items on the list have a status: **unwatched** (default) or **watched**.
- The list is the group's living history — watched items stay visible, marked as watched.
- The list refreshes on page load and pull-to-refresh. No real-time sync required — members vote async at their own pace.

### Decision modes

Both modes are **optional tools** — the group can simply use the shared list informally and pick something without any structured mechanism. When they want structure, two modes are available:

**Vote mode**
- Any member can open a vote on any unwatched item.
- Members cast a thumbs-up or thumbs-down.
- Vote concludes automatically when **50%+ of members have voted for the same item**.
- The winning item is highlighted and the group is notified.

**Rotation / designated picker mode**
- Turn order is set by **join order** (first member to join picks first).
- The current picker is clearly displayed to all members.
- The picker selects any unwatched item from the list. No vote required.
- After a pick, the turn advances to the next member in join order (wraps around).
- Turn history is visible so the group can see whose pick was whose.

### Post-pick behaviour

When an item is picked (via either mode):
- Its status on the party list updates to **watched**.
- The item is **auto-logged to every member's personal media log** with status `finished`.
- If a member already has the item in their personal log, their existing entry is updated to `finished` (not duplicated).
- Members can add their own rating on the item from the party list view after it's picked.

---

## Out of Scope

- Ephemeral / per-session parties (parties are always persistent)
- Public party discovery or search
- Mandatory friendship between all members
- Chat or messaging within a party
- Party-level ratings or aggregated scores (members rate individually via personal logs)
- Real-time "watch together" / sync playback features

---

## Success Criteria

- A group can go from party creation to a picked item without leaving the app.
- The shared list is never stale — live updates mean members don't have to refresh.
- Post-pick fan-out to personal logs means the group's watch history feeds each member's individual history naturally.
- Both decision modes work for a group of 2 up to ~10 members.

---

## Open Questions

- **Party size limit**: no cap discussed — worth setting one (e.g. 20) as a soft ceiling, though voting mechanics being optional makes this less critical.
- **Notifications**: should members be notified when someone adds to the list, or only when a vote opens / pick is made?
- **Majority vote tie-breaking**: if no item reaches 50%+ and voting stalls, the party leader (creator) breaks the tie manually.

---

## Dependencies

- Personal media log fan-out on pick requires upsert logic (item may already exist in a member's log).
- Invite link mechanism can reuse the pattern from `src/lib/invites.js` and `src/pages/FriendsPage.jsx`.
