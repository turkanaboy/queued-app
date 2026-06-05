# Handoff: Queued — Full UI Redesign

## Overview

This is a **high-fidelity redesign** of the [queued-app](https://github.com/turkanaboy/queued-app) — a shared multimedia recommendation app for movies, TV, books, and albums. The redesign covers:

- **Profile / My Queue** — completely rebuilt as "Option B: Expandable Dashboard"
- **Friends** — sleeker card list with requests, search, view-list
- **Discover** — medium-tabbed poster grid with queue/rate
- **Shared List** — per-friend recommendation playlist (both directions)
- **Overlays** — Add to queue, Rate & finish, Recommend to friend, Ask Bot

The prototypes in this bundle are **high-fidelity HTML design references** — not production code. The task is to **re-implement these designs inside the existing React + Vite + Tailwind + Supabase codebase** at `turkanaboy/queued-app`, following its established router (React Router), auth hooks (`useAuth`), Supabase queries, and Tailwind class patterns. Where Tailwind cannot express a value precisely, use inline styles.

---

## Design Principles

1. **Green-forward**: The deep-green background is the ground; cream/brass read as accents *on* it — not the other way around.
2. **Professional, not playful**: Replace emoji with clean SVG glyphs. Use IBM Plex Mono for numbers/labels; Plus Jakarta Sans for everything else.
3. **Progressive disclosure**: Stats expand on demand; filters hide behind a toggle; shelves limit what's visible at once.
4. **Brass spine**: Row-based lists carry an `inset 3px 0 0 rgba(184,115,51,0.62)` left box-shadow as a brand accent.

---

## Design Tokens

### Fonts
```
body / UI:   "Plus Jakarta Sans", system-ui, sans-serif
numbers / labels: "IBM Plex Mono", ui-monospace, monospace
```
Load both from Google Fonts (already in `index.html` or add):
```html
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
```

### Color palette

#### Background
```
body background:
  radial-gradient(circle at 50% -10%, rgba(184,115,51,0.16), transparent 34%),
  radial-gradient(120% 70% at 50% 118%, rgba(45,212,143,0.12), transparent 60%),
  linear-gradient(166deg, #03150E 0%, #0A3A28 56%, #0F4E37 100%)
background-attachment: fixed
```

#### Brand surfaces
| Token | Value | Usage |
|---|---|---|
| `--cream` | `#F4E9D1` | Primary CTA buttons, active tabs, active chips |
| `--cream-text` | `#F7F1E4` | Body text, headings |
| `--brass` | `#B87333` | Left spine accent, logo eyebrow, gradient ring |
| `--gold` | `#D8A84A` | Active borders, stat values, rating stars, Bot label |
| `--terra` | `#C96B4B` | Copper action button (+ FAB, Save), bot label text |
| `--mint` | `#2DD48F` | Finished status dot, bot strip accent, emerald glow |
| `--ink` | `#052016` | Text on cream backgrounds |

#### Green surface system
| Token | Value | Usage |
|---|---|---|
| `--g-hero` | `radial-gradient(120% 130% at 0% 0%, rgba(45,212,143,0.16), transparent 46%), linear-gradient(158deg, #11543C 0%, #0C3F2C 58%, #082A1D 100%)` | Hero stat card |
| `--g-hero-border` | `rgba(216,168,74,0.36)` | Hero stat card border |
| `--g-panel` | `rgba(12,62,44,0.55)` | Card/list container background |
| `--g-panel-line` | `rgba(150,214,180,0.16)` | Card borders, section dividers |
| `--g-row-line` | `rgba(150,214,180,0.12)` | Inter-row separators |
| `--g-track` | `rgba(190,236,210,0.13)` | Distribution bar background |
| `--g-spine` | `rgba(184,115,51,0.62)` | Left brass spine shadow |
| `--g-tab-bar` | `rgba(8,46,32,0.72)` | Medium tab wrapper bg |
| `--g-ctrl-bg` | `rgba(10,52,36,0.7)` | Filter/Status toggle button bg |
| `--g-chip-bg` | `rgba(9,46,32,0.66)` | Inactive chip bg |
| `--g-text-dim` | `rgba(214,240,224,0.70)` | Secondary text |
| `--g-text-faint` | `rgba(214,240,224,0.50)` | Tertiary text, labels |

#### Status dot colors
| Status | Dot color |
|---|---|
| `not_yet_viewed` | `#D8A84A` |
| `queued` | `#C99A52` |
| `in_progress` | `#C96B4B` |
| `finished` | `#2DD48F` |
| `skipped` | `#7E8C84` |
| `bailed` | `#B5544A` |

### Border radius
- Phone device: `48px`
- Large cards (hero, sheet): `22px`
- List container: `18px`
- Individual rows: no radius (clipped by container)
- Chips / pills: `999px`
- Small cards, posters: `10–14px`
- Control buttons: `14px`
- Status menu popover: `14px`

### Shadows
```css
/* Hero stat card */
box-shadow: 0 18px 40px rgba(2,16,11,0.45), inset 0 1px 0 rgba(190,236,210,0.10);

/* Brass spine (list containers) */
box-shadow: inset 3px 0 0 rgba(184,115,51,0.62);

/* Primary CTA (cream button) */
box-shadow: 0 6px 0 rgba(184,115,51,0.32);

/* Copper FAB / action buttons */
box-shadow: 0 8px 22px rgba(0,0,0,0.35);

/* Status menu popover */
box-shadow: 0 18px 40px rgba(0,0,0,0.5);
```

### Avatar gradient ring
```css
.avatar-ring {
  background: linear-gradient(135deg, #F4E9D1, #D8A84A, #B87333);
  padding: 3px; /* lg: 4px */
  border-radius: 9999px;
}
.avatar-ring__inner {
  background: linear-gradient(135deg, hsl(HUE, 42%, 72%), #F4E9D1);
  /* HUE: deterministic from name charcode, e.g. Mara→330, Theo→205, Jules→158 */
  color: #052016;
  font-weight: 800;
}
```

---

## Bottom Navigation

Replace the existing nav bar. Four tabs + center FAB:

```
[ Friends ] [ Discover ] [ ⊕ FAB ] [ Search ] [ Profile ]
```

**Container**
- `background: rgba(4,26,18,0.9)`, `backdrop-filter: blur(20px)`
- `border: 1px solid rgba(150,214,180,0.16)`, `border-radius: 26px`
- `padding: 10px 20px`, `box-shadow: 0 18px 40px rgba(0,0,0,0.4)`
- Sits in a `padding: 8px 16px calc(18px + env(safe-area-inset-bottom))` wrapper

**Inactive tab** — 38×38px circle, `background: rgba(6,40,28,0.7)`, `border: 1px solid rgba(150,214,180,0.16)`, icon in `#F4E9D1`

**Active tab** — same size circle, `background: #F4E9D1`, icon in `#052016`

**FAB (center, +)**
- 50×50px circle, `margin-top: -22px` (lifts above bar)
- `background: linear-gradient(135deg, #C96B4B, #B87333)`
- `border: 1px solid rgba(216,168,74,0.36)`, `box-shadow: 0 8px 22px rgba(0,0,0,0.35)`
- Opens **Recommend sheet**

**Tab labels** — 9px, weight 700, `color: #F7F1E4` (active) / `rgba(214,240,224,0.5)` (inactive)

---

## Screen: Profile (My Queue)

**File to replace:** `src/pages/ProfilePage.jsx`

### Header
- Left: eyebrow `QUEUED` in IBM Plex Mono 10.5px, letterspacing 3px, color `#B87333`; title `My Queue` in PJS 26px/800
- Right: 42×42px avatar with gradient ring; initials from display name
- `padding: 52px 18px 12px` (top clears status bar + dynamic island)

### Medium tabs
Wrapping shell: `background: rgba(8,46,32,0.72)`, `border-radius: 18px`, `padding: 3px`, `border: 1px solid rgba(150,214,180,0.16)`.

Four segments: **Movies / TV / Books / Albums**. Each segment:
- Icon: minimal SVG glyph (film = rounded-rect + play triangle; TV = rounded-rect + stand; Book = rect + spine line; Album = circle + center dot). 15×15px.
- Label: PJS 11px/700
- Count: IBM Plex Mono 9.5px/600, color `rgba(214,240,224,0.5)`
- **Active**: `background: #F4E9D1`, `border: 1px solid #D8A84A`, icon+label color `#052016`
- **Inactive**: transparent background, icon+label color cream

Switching tabs resets status filter to `all` and collapses the hero breakdown.

### Hero stat card (expandable)
`background: G.hero gradient`, `border: 1px solid rgba(216,168,74,0.36)`, `border-radius: 22px`, `box-shadow: 0 18px 40px rgba(2,16,11,0.45), inset 0 1px 0 rgba(190,236,210,0.10)`

**Collapsed state** (default):
- Big number: IBM Plex Mono 36px/600, color `#F7F1E4`
- Green halo behind number: `position: absolute`, 64×64px circle, `background: radial-gradient(circle, rgba(45,212,143,0.32), transparent 68%)`, `filter: blur(4px)`
- Subtitle: "in your movies queue" (or current medium), PJS 13px/600, color `rgba(214,240,224,0.72)`
- Mini stats row (gap 16px): **Finished** in `#2DD48F`, **Avg** ★ in `#D8A84A`, **From friends** in `#D8A84A`. Each: IBM Plex Mono 14px/600 value + PJS 10px uppercase faint label.
- "Breakdown ↓" link top-right: PJS 11px/700, color `#D8A84A`
- Distribution bar: `height: 8px`, `padding: 2px`, `background: rgba(190,236,210,0.13)`, `border-radius: 6px`. Inner segments use status dot colors, `flex` proportional to count. Opacity 0.25 for non-active filters.

**Expanded state** (tap Breakdown):
- Animates `max-height` from 0 → ~360px, `transition: max-height 0.3s ease`
- `border-top: 1px solid rgba(150,214,180,0.16)` separates from collapsed area
- Per-status rows (all 6 statuses):
  - 8px colored dot + status label (PJS 13.5px/600) + mini progress bar (80px wide, 5px tall) + count (IBM Plex Mono 13px/600)
  - Tapping a row sets `statusFilter` to that status (toggle — tap again to clear)
  - Active row: `background: rgba(45,212,143,0.12)`, `box-shadow: inset 2px 0 0 rgba(45,212,143,0.7)`, `border-radius: 11px`
  - Disabled (count = 0): `opacity: 0.32`, no pointer events

### Bot strip
Appears between the hero card and the controls row. Four states:

**1. CTA (no active bot rec)** — dashed border `rgba(45,212,143,0.35)`, `border-radius: 16px`, icon + "Ask Queued Bot for a pick" (PJS 13.5px/700) + chevron right.

**2. Thinking** — animated spinning SVG circle (stroke-dasharray), "Queued Bot is thinking…" PJS 13.5px/600.

**3. Reason card (just added)** — `background: rgba(12,62,44,0.72)`, `border: 1px solid rgba(45,212,143,0.27)`, `border-radius: 18px`, `box-shadow: inset 2px 0 0 rgba(45,212,143,0.5)`. Shows poster placeholder + title + creator/year + bot's reason text (PJS 12px, `rgba(214,240,224,0.7)`) + inline StatusMenu. Dismiss ✕ top-right.

**4. Waiting** — small gold dot + "Bot is waiting on [title] — mark it done for a new pick." PJS 12.5px.

**Bot logic** (matches existing `requestBotRecommendation`):
- Only one active bot rec at a time (statuses: `not_yet_viewed`, `queued`, `in_progress`)
- If active exists → show waiting state
- Else → call edge function, add rec, show reason card

### Controls row
`display: flex`, `justify-content: space-between`, `align-items: center`, `margin: 16px 0 10px`.
- Left: `{n} titles [· Status label]` in IBM Plex Mono 11px, color `rgba(214,240,224,0.5)`
- Right: **Status** toggle pill + **+** copper button

**Status toggle**: `background: G.ctrl-bg` (inactive) / `#F4E9D1` (active), `border: 1px solid G.panel-line`, `border-radius: 999px`, `padding: 7px 13px`, PJS 12.5px/700. Has filter icon SVG left.

**+ button**: 35×35px circle, `background: linear-gradient(135deg, #C96B4B, #B87333)`, `border-radius: 999px`, `box-shadow: 0 4px 12px rgba(0,0,0,0.3)`. Opens **Add Title sheet**.

### Status chips (hidden by default)
`max-height: 0 → 72px`, `transition: max-height 0.25s ease`. Horizontal scroll, `scrollbar-width: none`.
Chips: All / New / Queued / In progress / Finished / Skipped / Bailed.
- Active chip: `background: #F4E9D1`, `border: 1px solid #D8A84A`, text `#052016`
- Inactive: `background: rgba(9,46,32,0.66)`, `border: 1px solid rgba(150,214,180,0.16)`, text `rgba(214,240,224,0.7)`
- PJS 12px/700, `border-radius: 999px`, `padding: 6px 12px`

### Dense list
Container: `background: rgba(12,62,44,0.55)`, `border: 1px solid rgba(150,214,180,0.16)`, `border-radius: 18px`, `box-shadow: inset 3px 0 0 rgba(184,115,51,0.62)`.

**Empty state** (no items in medium):
- 46×46px icon tile, `background: rgba(45,212,143,0.12)`, `border-radius: 14px`
- Title PJS 14.5px/700, body PJS 12.5px faint, optional action button

**Each row** (`border-top: 1px solid rgba(150,214,180,0.12)` on rows 2+, `padding: 11px 13px`, `display: flex`, `align-items: center`, `gap: 12px`):
1. **Poster placeholder** (34×52px, `border-radius: 8px`): gradient tile using medium-specific dark tones (`#33271a / #1c130b` for movies; `#2a3b2f / #16241b` for TV; `#3a2a1c / #211610` for books; `#3a2330 / #1e131b` for albums). Diagonal stripe overlay at 5% opacity. 2-letter initials in IBM Plex Mono 600. Tapping opens Rate sheet.
2. **Title** PJS 14px/700 `#F7F1E4`, truncated. Optional ★ rating in `#D8A84A` IBM Plex Mono 11px/600.
3. **Subtitle**: `{creator} · {originLabel}` PJS 11.5px `rgba(214,240,224,0.5)`. Bot-origin items append ` · Bot` in `#C96B4B`.
4. **StatusMenu** (right): see component spec below.

### Streaming platforms section
Keep existing logic. Restyle platform pills: `background: {p.color}`, `border-radius: 999px`, PJS 12px/700 white text. Edit button: PJS 12px `rgba(214,240,224,0.5)`.

---

## Screen: Friends

**File to replace:** `src/pages/FriendsPage.jsx`

### Layout
- Header: `QUEUED` eyebrow + `Friends` title (PJS 28px/800) + subtitle. Same `padding: 52px 18px 14px`.
- Search field (full-width): `background: rgba(2,17,12,0.7)`, `border: 1.5px solid rgba(150,214,180,0.16)`, `border-radius: 14px`, `padding: 12px 14px 12px 40px`. Search icon SVG at `left: 14px`.
- Search results dropdown: same list container style (panel + spine), renders on `query.length >= 2`.

### Incoming requests
Container: `background: rgba(45,212,143,0.08)`, `border: 1px solid rgba(45,212,143,0.25)`, `border-radius: 18px`, `box-shadow: inset 2px 0 0 rgba(45,212,143,0.5)`.
Buttons: **Decline** in ghost style, **Accept** in cream solid style.

### Friends list
Same brass-spine list container. Each row: avatar (40px) + name/username/stats + **List** ghost button.
Sub-stats: `{queue} in queue · {sent+recv} recs shared` PJS 11.5px faint.
"List" button → navigates to SharedListPage for that friend.

### Sent pending
Separate section, `opacity: 0.65`, no actions.

### Section headers
IBM Plex Mono 10.5px/600 UPPERCASE, letterspacing 1.6px, color `rgba(214,240,224,0.5)`. Followed by a `flex: 1; height: 1px; background: rgba(150,214,180,0.12)` hairline.

---

## Screen: Discover

**File to replace:** `src/pages/CollectionPage.jsx`

### Layout
Same header pattern. Medium tabs (same component). Below tabs: legend row (mint dot "In your queue" / gold dot "Rated").

### Poster grid
`display: grid`, `grid-template-columns: 1fr 1fr 1fr`, `gap: 12px`.

Each **DiscoverCard**:
- Poster placeholder (full column width, 120px tall, `border-radius: 12px`)
- **+ queue button** (26×26px, top-right corner, `background: rgba(2,12,8,0.7)`, `backdrop-filter: blur(4px)`): adds to queue, shows checkmark (mint bg) when queued
- **Rating badge** (bottom-left): `background: rgba(2,12,8,0.82)`, `backdrop-filter: blur(4px)`, ★ gold 9px + IBM Plex Mono 10.5px rating. Shows when rated.
- Tap card → opens **Rate & Finish sheet**
- Title: PJS 12px/700, 2-line clamp
- Creator: PJS 10.5px faint, 1-line truncate

### Queued section (below grid)
`SectionTitle` + brass-spine list of items in queue for this medium. Each row: poster + title/creator + "★ Rate" gold chip button → opens Rate sheet.

---

## Screen: Shared List

**File to replace:** `src/pages/SharedListPage.jsx`

### Header
Back `←` button (glass panel style) + `SHARED LIST` eyebrow + friend name title + friend avatar.

### Summary stat pills
4 pills in a row: **Total / Finished / From them / From you**. Each: `background: rgba(12,62,44,0.55)`, `border-radius: 13px`, IBM Plex Mono 18px/600 value (Finished in `#2DD48F`, others in `#F7F1E4`) + PJS 10px faint uppercase label.

### Filter chips (3 rows)
Type (All / Films / TV / Books / Albums), Direction (All / From them / From you), Status (All / New / Queued / Watching / Finished). Same chip style as profile.

### Rec cards
`background: rgba(12,62,44,0.55)`, `border: 1px solid rgba(150,214,180,0.16)`, `border-radius: 18px`, `padding: 12px 13px`.
Brass spine: gold-tinted `rgba(216,168,74,0.55)` for "from them", brass `rgba(184,115,51,0.62)` for "from you".
Contents: poster (52×76) + title/creator + direction label (dot + "From Mara" / "From you") + comment count icon + StatusMenu + optional "★ Rate" chip (only for received, non-finished).

---

## Overlay: Add Title Sheet

**Component:** `LogMediaSheet.jsx` (restyle)

Bottom sheet with `border-radius: 26px 26px 0 0`, green gradient bg.
1. **Type pills**: All / Movies / TV / Books / Albums (same chip style)
2. **Search field** (same SearchField style)
3. **Results list** (max-height 280px, scroll): each row = poster tile + title + creator·type·year + "+" icon right
4. **Selected state**: shows poster + title/creator + "← Pick another" link + two CTA buttons: ghost "I've finished it" + solid "Add to queue"

---

## Overlay: Rate & Finish Sheet

**Component:** `RatingModal.jsx` (restyle)

1. Poster + title + creator/year header
2. **1–10 pip selector**: 10 equal-width `height: 30px` buttons, `border-radius: 7px`. Filled: `background: linear-gradient(180deg, #E7C674, #C99A52)`. Empty: `background: rgba(2,17,12,0.5), inset shadow`. IBM Plex Mono 11px/600 number label.
3. Optional review textarea
4. Ghost cancel + solid "Mark finished"

---

## Overlay: Recommend to Friend Sheet

**Component:** `AddRecommendationPage.jsx` (restyle as bottom sheet)

1. **Friend selector**: horizontal scroll of avatar+first-name buttons. Selected friend gets `background: rgba(45,212,143,0.5)` halo ring.
2. **Type pills** + **search field** + results list (same as Add Title)
3. **Selected title**: compact row in panel with ✕ dismiss
4. Optional **note textarea**
5. Send button: `Send to {firstName}` once both picked; disabled (opacity 0.4) until both selected

---

## Shared Components

### StatusMenu (dropdown)
A pill button showing current status (dot + IBM Plex Mono short label + chevron). On click:
- Full-screen transparent backdrop closes menu
- Popover: `background: rgba(6,30,21,0.98)`, `border: 1px solid rgba(244,233,209,0.26)`, `border-radius: 14px`, `padding: 5px`, `box-shadow: 0 18px 40px rgba(0,0,0,0.5)`, `backdrop-filter: blur(10px)`
- 6 status options as buttons. Active: `background: rgba(244,233,209,0.10)`. Checkmark in gold at right.

### Sheet (bottom sheet shell)
- Backdrop: `background: rgba(2,10,7,0.55)`, `backdrop-filter: blur(2px)`, `animation: qFade 0.2s ease`
- Sheet: `background: linear-gradient(180deg, #0a3526, #062318)`, `border-top: 1px solid rgba(244,233,209,0.26)`, `border-radius: 26px 26px 0 0`, `animation: qUp 0.28s cubic-bezier(0.16,1,0.3,1)`
- Drag handle: 38×4px, `background: rgba(244,233,209,0.26)`, `border-radius: 99px`, centered, margin-bottom 14px

### Toast
`position: absolute`, `bottom: 112px`, `left/right: 18px`, `z-index: 100`
`background: rgba(8,48,33,0.97)`, `border: 1px solid rgba(150,214,180,0.20)`, `border-radius: 14px`, `padding: 12px 16px`
PJS 13.5px/700 `#F7F1E4`, centred, `backdrop-filter: blur(12px)`, `animation: qFade 0.2s ease`. Auto-dismiss after ~2.2s.

---

## Animations

```css
@keyframes qFade { from { opacity: 0 } to { opacity: 1 } }
@keyframes qUp   { from { transform: translateY(100%) } to { transform: translateY(0) } }
```

Hero breakdown expand: `max-height 0 → ~360px, transition: max-height 0.3s ease`
Status chips reveal: `max-height 0 → 72px, transition: max-height 0.25s ease`
Breakdown chevron: `transform: rotate(0deg → 180deg), transition: transform 0.2s`
All interactive elements: `transition: transform 0.1s, opacity 0.1s` + `:active { transform: scale(0.95); opacity: 0.85; }`

---

## State Changes from Existing Code

| Change | Detail |
|---|---|
| Remove `typeFilter` from URL/filter row | Medium is now the top-level tab, not a filter |
| `statusFilter` now driven by hero breakdown tap OR chips | Both set the same state variable |
| Stats grid (12 StatCard components) → single expandable hero | Keep the same data queries, new presentation |
| `originFilter` row removed from main view | Moved into the Add sheet's source selection |
| Bot strip replaces inline `botMessage` string | Four distinct visual states (see above) |
| Dense rows replace `queue-strip` cards | Smaller poster (34×52), single line of meta |

---

## Files in This Package

| File | Description |
|---|---|
| `Queued App.html` | Full navigable prototype — the primary reference |
| `Queued Profile Redesign.html` | Three-option comparison canvas (Options A, B, C) |
| `shared.jsx` | Design tokens, sample data, base components (Poster, StatusMenu, Sheet, MediumTabs, etc.) |
| `app-data.jsx` | Green palette (G), friends/discover/bot data, Avatar, AppBottomNav, ScreenHeader, EmptyState |
| `app-sheets.jsx` | RatingSheet, AddTitleSheet, RecommendSheet |
| `screen-profile.jsx` | ProfileScreen + BotStrip (full Option B build-out) |
| `screen-friends.jsx` | FriendsScreen |
| `screen-discover.jsx` | DiscoverScreen |
| `screen-shared.jsx` | SharedListScreen |

Open `Queued App.html` in a browser for the interactive reference. All nav, sheets, status changes, bot flow, and rating interactions are live.

---

## Notes for Claude Code

- The existing `src/index.css` has `.glass`, `.glass-dark`, `.queue-strip`, `.btn-cream`, `.btn-copper`, `.paper-tabs` etc. These can largely be replaced or augmented with the green surface system above.
- `InitialsAvatar` in `Layout.jsx` → restyle as the gradient-ring `Avatar` described above.
- Keep all existing Supabase queries unchanged; only touch the render layer.
- `LogMediaSheet`, `RatingModal`, `RecommendationCard` all need restyling per the overlay specs; no logic changes needed.
- The bottom nav in `Layout.jsx` needs the new FAB + 4-tab structure.
