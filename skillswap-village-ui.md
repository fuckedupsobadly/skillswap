# SkillSwap Village — UI Design

*Version 1 · 14 Nov 2026 · private working document*

> **One idea:** SkillSwap is a small pixel village. You walk it as your own character. Every member owns a hut. When a member is free to teach right now, **a lantern is lit in their window**. At dusk the village glows with the people you could learn from.

---

## 0. TL;DR for the team

| Question | Answer |
|---|---|
| What is the screen? | A top-down pixel village (Stardew/Gather-like) that *is* the product: places in the village are product features. |
| Who are the NPCs? | Real members. Online members walk around; offline/away members are shown **AFK in their hut**. Scenery critters are clearly scenery, never fake people. |
| How does it stay laconic? | The world carries the decoration; the UI carries almost none. Four HUD elements, one accent color reserved for the primary action, short dialogue boxes, no confetti. |
| What do people remember? | Lit lanterns = teachers available now. The Wishing Well = post a learning request. Paths that wear in where the community actually walks. |
| What if someone can't or won't walk around? | Every place has a plain twin page (`Plain mode`). Search, keyboard, screen readers and mobile all work without walking. |

---

## 1. Research summary

Refero's live tools were not connected in this session, so research used the bundled Refero craft guides plus product evidence from shipped spatial and pixel-art products.

| Reference | What it proves | What we adapt | What we reject |
|---|---|---|---|
| **Gather** (2D virtual office) | Walking into someone's range starts a conversation; walking away ends it. Status is explicit: Active, Busy, Away — setting Away makes your avatar leave the office. | Proximity-to-talk; explicit 3-state presence; "away" shown spatially, not as a gray dot. | Auto-opening video on proximity (too intrusive for strangers); toolbar-heavy bottom bar. |
| **WorkAdventure** (open-source 16-bit RPG office) | Pixel tile maps (32×32 tiles, built in the free Tiled editor) work in a browser; map building is the real barrier for non-technical teams. | Tiled as the map pipeline; web-native rendering. | Letting users build maps. We generate member huts procedurally; only staff edit the core village. |
| **Stardew Valley** dialogue + its mod scene | The text box with a portrait and nameplate is the familiar standard; modders keep moving the portrait/name *above* the box and adding a relationship indicator. | Portrait + nameplate above the box; a single compact relationship/trust line. | Long typewriter monologues. Our dialogue is 1–3 lines then buttons. |
| **Pixel-font practice** | Pixel fonts tire the eye in paragraphs; pair one pixel display face with a clean sans for body; keep pixel text to roughly 15–20% of the page. Pixelify Sans ships four weights, unusual for a pixel font. | Pixelify Sans for names, labels, buttons; a clean sans for anything longer than one line. | Press Start 2P everywhere (loud, wide, unreadable at length). |
| **Refero anti-slop rules** | No indigo, no dark-by-default, cards only where the user interacts, one memorable detail, token roles never drift. | One CTA-only accent; light HUD even at village night; cards only for things you click. | Glow gradients, emoji icons, left accent stripes. |

### Reference lock

```text
Primary direction:   Cozy top-down pixel village (Stardew-like tile world) as the whole app.
Preserve:            1) world-first composition, HUD at the edges only
                     2) chunky plum-outlined pixel sprites, pastel palette from the kitty reference
                     3) dialogue box with portrait + nameplate above
                     4) explicit presence shown spatially (hut lantern / sleeping sprite)
Borrow only:         Gather's proximity-to-interact + 3-state status;
                     WorkAdventure's Tiled map pipeline.
Role rules:          Lantern gold = primary action AND "available now" lantern only.
                     Pixel font = names, labels, buttons only. Never paragraphs.
                     Night tint = world layer only; HUD panels never go dark.
Media strategy:      All world art is real pixel sprites/tiles (16 px tiles, 3× scale).
                     Placeholders are flat colored tiles with a label, never fake CSS art.
Reject:              Dark-mode HUD, neon/cyber retro, indigo, wooden RPG frames with
                     ornate corners, confetti, XP pop-ups mid-task, auto video.
```

---

## 2. Design principles

1. **The village is the menu.** Navigation happens by place: the Well, the Notice Board, the Tavern, the Bank. The HUD has four elements, not a nav bar.
2. **Real people, honest presence.** Every humanoid character is a real member. Ambient life (chickens, ducks, birds, cats, smoke, weather) is scenery and looks like scenery.
3. **Walking is optional.** Any place is one click away through the Map or search. Walking is for discovery and delight, never a tax on getting something done.
4. **One line, then a choice.** Dialogue boxes say one to three short lines and then offer buttons. No walls of pixel text.
5. **Quiet UI, loud world.** Color, animation and personality live in the world layer. Panels are flat cream paper with a plum pixel border.
6. **Same rules as SkillSwap.** One hour = one hour; nothing in the village sells hours or XP; the AI barkeep always says it is an AI.

---

## 3. The village map

### 3.1 Districts → product features

| Place | In the world | Product feature it opens | Who's there |
|---|---|---|---|
| **The Gate** | Wooden arch, signpost, map stand | Arrival, character creation, Plain mode switch | Newcomers |
| **Wishing Well** (Town Square center) | Stone well with a rope bucket; coins glint when wishes are granted | Post a learning request ("I want to learn…") | Anyone |
| **Notice Board** | Cork board covered in pinned paper notes | Requests board + offers board, filterable | Anyone |
| **The Swapped Mug** (tavern) | Warm-lit tavern, long tables, fireplace | Matching: each table is a proposed swap cycle; group class proposals on the chalkboard | Online members, the Barkeep |
| **The Barkeep** | Friendly NPC behind the bar, nameplate says "Barkeep · AI" | AI concierge: parse requests, explain matches, draft bookings | AI (labeled) |
| **Hourglass Bank** | Small stone bank with a giant hourglass in the window | Wallet: balance, holds, history, gifting | Teller desk (UI only) |
| **Clock Tower** | Tower on the square, chimes on the hour | Public ledger audit: climb the tower to "check the gears" = verify the chain | Anyone |
| **Town Hall** | Columned hall with a bell | Settings, trust level, disputes court (stewards' bench) | Stewards |
| **Lantern Rooms** | Row of small study rooms beside the Town Hall | Live session rooms (enter = join video) | Booked members |
| **Guild Quarter** | Ring of guild halls, one per category (see 3.2) | Category browsing, group classes, category notice boards | Teachers of that category |
| **Residential Lanes** | Winding lanes of member huts | Member profiles, booking, notes | Members (online in hut / AFK / away) |
| **Your Hut** | Your own hut, kitty on the step | Profile editing, wardrobe, kitty home | You |
| **Market Row** | Stalls with awnings | Career and business skills; Plus subscription booth (clearly labeled, sells no hours) | Members |
| **Community Pond** | Pond with ducks and a donation lantern on the dock | Community hours pool: gift and request hours | Anyone |

### 3.2 Guild Quarter (every category gets a building)

| Guild hall | Categories | Roof color | Silhouette cue |
|---|---|---|---|
| Scriptorium | Languages, writing, academic tutoring | Slate blue | Tall windows, book sign |
| Tinker's Workshop | Tech and coding, tech help | Teal | Gear sign, chimney with sparks |
| Painter's Loft | Design, video, photo, audio | Coral | Easel on the balcony |
| Bard's Hall | Music | Plum-rose | Lute sign, music notes drift out when a class runs |
| Bakehouse | Cooking and food | Warm yellow | Bread oven, steam |
| Training Grounds | Fitness and sports | Grass green | Open yard with a target and track |
| Tea House | Mind and wellness | Pale sage | Lanterns and a little stone garden |
| Carpenter's Yard | Home and DIY, crafts and making, vehicles and bikes | Brown | Sawhorse, wood stack |
| Greenhouse | Garden and outdoors | Glass green | Glass roof, plants |
| Game Parlor | Games and hobbies | Mustard | Chessboard sign |
| Tailor | Style and beauty | Dusty pink | Mannequin in the window |
| Counting House | Money basics (education only) | Gray-blue | Abacus sign |
| Helpers' Lodge | Helping hands | Leaf green | Cart and boxes outside |

Roof color = category color everywhere (hut roofs, notice-board pins, map pins), so wayfinding works without reading.

### 3.3 Overall layout (top-down)

```text
                         N
   ┌───────────────────────────────────────────────────────────┐
   │  Greenhouse    Training Grounds        Tea House          │
   │      ▲               ▲                     ▲              │
   │  ── Guild Quarter ring road ─────────────────────────     │
   │  Scriptorium  Tinker's   Painter's  Bard's   Bakehouse    │
   │                                                           │
   │   Residential      ┌──────── TOWN SQUARE ────────┐  Res.  │
   │   Lanes (W)        │ Notice   ( Well )   Clock   │  Lanes │
   │   ⌂ ⌂ ⌂ ⌂          │ Board              Tower    │  (E)   │
   │   ⌂ ⌂ ⌂ ⌂          │ Tavern   Bank      Town Hall│  ⌂ ⌂ ⌂ │
   │   ⌂ ⌂ ⌂ ⌂          └──────────┬──────────────────┘  ⌂ ⌂ ⌂ │
   │                       Lantern Rooms   Market Row          │
   │   Pond ~~~                    │                           │
   │                          ═ The Gate ═                      │
   └───────────────────────────────────────────────────────────┘
                         S   (you arrive here)
```

The square is a hub: every key feature is within ~12 tiles of the Well, so a new member reaches anything in about 3 seconds of walking (4 tiles per second).

### 3.4 Making it feel populated — honestly

An empty village is the fastest way to kill this concept. Population comes from five honest sources:

| Source | What it looks like | Rule |
|---|---|---|
| **Online members** | Characters walking, chatting, sitting at tavern tables | Real-time; position updates only for people near you |
| **AFK and offline members** | Their sprite asleep at a desk, reading by a window, or a dark hut with a "back soon" sign | Every hut on screen belongs to a real member |
| **Activity traces** | Fresh notes on the Notice Board, smoke from a guild chimney while a class runs, coins in the Well | Each trace is a real event from the last 24 hours |
| **Worn paths** | Grass slowly wears into dirt where many members actually walk | Computed weekly from anonymous walk counts; the village literally shows its desire lines |
| **Scenery life** | Chickens, ducks on the pond, birds, the market cat, weather, the clock chime | Non-human, no nameplates, never clickable as "people" |

**Neighborhood sizing.** One village instance shows up to ~60 walking members and ~200 huts. Huts are chosen per viewer: people who teach what you want to learn and are free in your hours live on *your* side of the lanes. A new village is opened before an instance gets crowded; friends and circle members are always placed together.

**Never fake people.** No bots dressed as members. If the instance is quiet, the world gets quieter (fewer lit lanterns, more scenery), not fuller with fakes.

---

## 4. Presence: how a real member appears

| Member state | In the world | On their hut | Can you… |
|---|---|---|---|
| **Free now** (online, available to teach) | Walking or sitting near their hut | **Lantern lit** in the window, chimney smoke | Walk up and chat; book a session that starts now |
| **Online, busy** | Walking; small "busy" tag | Lantern off, door closed sign | Leave a note; book later |
| **In a session** | Not on the map; shown inside a Lantern Room | Sign: "In a lesson · back 15:30" | Leave a note |
| **AFK** (idle >10 min) | Sprite inside the hut, asleep at the desk ("z" puffs) | Curtains half drawn | Read their sign; book from availability; leave a note |
| **Offline** | Not walking | Hut dark, kitty asleep on the step | Book from availability; leave a note in the mailbox |

Status is chosen by the member (Free now / Busy / Away), plus automatic AFK after 10 minutes idle and automatic "In a session" from bookings. Never inferred from anything else.

Text labels always accompany the visual state (screen readers and color-blind users get "Mira · Free now · teaches Guitar, Spanish").

---

## 5. Your character

### 5.1 Sprite spec

| Property | Village character | Kitty (field sprite) |
|---|---|---|
| Frame | 16 × 32 px (1 × 2 tiles) | 16 × 16 px (1 tile) |
| Views | 4 directions; left/right mirrored where clothing allows | 4 directions |
| Outline | 1 px plum, same as the kitty reference | Same |
| Scale on screen | 3× desktop (tile = 48 px), 2× mobile (tile = 32 px), whole numbers only | Same |
| Animations | Idle (2), walk (4), sit (1), wave (3), sleep-at-desk (2), read (2), teach-point (3) | Walk (4), sit (1), sleep (2), follow |

The 48 × 48 kitty from the Gamification doc stays the **close-up** sprite (hut interior, profile, panels). In the open village a 16 × 16 field version follows you, so the cat is never as tall as its owner.

### 5.2 Customization (layers)

| Layer | Options at launch | Unlocks later |
|---|---|---|
| Body | 3 builds | — |
| Skin tone | 8 tones | — |
| Hair | 16 styles × 10 colors | Rank styles |
| Face | 6 eye styles, 4 brows | — |
| Top | 12 shirts/sweaters | Guild jackets (5 h taught in a category) |
| Bottom | 8 | — |
| Shoes | 6 | — |
| Accessory | Glasses, scarf, hat, bag | Rank and achievement items (shared slots with kitty set where it makes sense: matching scarves) |
| Hut | Roof shape (3), door color, garden item, sign style | Badges become garden decorations |

Palette swap like the kitty: sprites authored with reserved gray keys and recolored at runtime, so 10 hair colors cost zero extra drawings.

### 5.3 Character creator screen

```text
┌──────────────────────────────────────────────────────────────┐
│  Make your villager                                  Step 1/3 │
├───────────────────────────┬──────────────────────────────────┤
│                           │  Skin   ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣           │
│        ┌──────────┐       │  Hair   ‹  Short bob  ›   ● ● ●   │
│        │  (you,   │       │  Eyes   ‹  Round      ›           │
│        │  3× live │       │  Top    ‹  Knit sweater ›  ● ● ●  │
│        │  preview)│       │  Bottom ‹  Trousers   ›   ● ● ●   │
│        └──────────┘       │  Shoes  ‹  Boots      ›           │
│     ↻ turn   ▶ walk       │                                  │
│                           │  [ Surprise me ]                 │
├───────────────────────────┴──────────────────────────────────┤
│  Name in the village  [ Aru            ]      [ Continue → ] │
└──────────────────────────────────────────────────────────────┘
```

- Live preview walks in place so outfits are judged in motion.
- "Surprise me" rolls a full look; one tap undo.
- Continue is the only lantern-gold element on the screen.

---

## 6. Interaction model

### 6.1 Moving

| Input | Behavior |
|---|---|
| WASD / arrows | Tile-snapped walking, 4 tiles per second; hold Shift to run (6) |
| Click / tap on ground | Path-finds there (A* on the walk grid), shows a small destination marker |
| Click / tap on a place or person | Walks to the nearest free tile in front of it, then opens the interaction |
| `M` | Full map; click a place to quick-travel (a short fade, no walking) |
| `/` | Search anything: skills, members, places |
| Gamepad | Supported (left stick + A) |

### 6.2 Interacting

- When you stand next to anything interactive, a small prompt appears above it: **`E · Talk`**, **`E · Read`**, **`E · Enter`**. On touch devices the prompt is a tappable pill.
- Members who are online and walking can be greeted: a wave and a speech bubble (short text chat, max 140 characters, nearby only). **No auto video.** Video exists only inside Lantern Rooms after a booking.
- Private chat moves to the Inbox (the mailbox at your hut) once you leave the area.

### 6.3 Dialogue box (Stardew-informed, laconic)

```text
            ┌──────────┐
            │ portrait │  Mira  ·  Free now  ·  Trust 2
            │  (48×48) │  Teaches Guitar, Spanish · 4.9 (23)
┌───────────┴──────────┴───────────────────────────────────────┐
│  "Hey! I'm around till 19:00 if you want a chord lesson."    │
│                                                              │
│  [ Book 30 min · 0.5 h ]   [ Leave a note ]   [ Profile ]    │
└──────────────────────────────────────────────────────────────┘
                                                  Esc · close
```

- Portrait and nameplate sit **above** the box (the fix Stardew modders converge on), leaving the box for words and actions.
- The quote is the member's own status line, written by them. If empty, no quote: just their skills.
- Max three buttons. The first is the primary (lantern gold) only when the action is really available.
- Text appears instantly (no typewriter) for anything functional. A typewriter effect is used only for the Barkeep's scripted greetings and can be skipped with any key.

### 6.4 Talking to an AFK hut

When the member is AFK or offline, you talk to their **hut sign**:

```text
┌──────────────────────────────────────────────────────────────┐
│  ⌂ Mira's hut · Away · usually back weekday evenings         │
│                                                              │
│  Teaches  Guitar (beginner–intermediate) · Spanish (A1–B1)   │
│  Learning Photography                                        │
│  Next free  Tue 18:00 · Wed 19:30 · Thu 18:00                │
│                                                              │
│  [ Book Tue 18:00 ]   [ Other times ]   [ Leave a note ]     │
└──────────────────────────────────────────────────────────────┘
```

You can see her through the window, asleep at the desk with her kitty on the shelf. The hut tells you everything needed to book without her being online — that is the whole point of the AFK hut.

---

## 7. HUD — four elements only

```text
┌──────────────────────────────────────────────────────────────────────┐
│ ⧗ 3 h  (0.5 held)                                   [ Map ] [ ☰ ]    │
│                                                                      │
│                                                                      │
│                       ( the village fills the screen )               │
│                                                                      │
│                                                                      │
│                                                                      │
│                         E · Talk to Mira                             │
│                                                               (kitty)│
└──────────────────────────────────────────────────────────────────────┘
```

| Element | Position | Contents |
|---|---|---|
| Balance | Top-left | Hours available, held hours in small text; click → Bank |
| Map + Menu | Top-right | Map (`M`); menu: Inbox, Sessions, Profile, Plain mode, Settings |
| Context prompt | Bottom-center, only when something is in range | One verb + target |
| Kitty button | Bottom-right | Kitty state; opens kitty panel (from Gamification doc) |

What is deliberately **not** on the HUD: XP bar, rank, chat log, minimap, player list, notifications bell. Rank sits on your nameplate; notifications arrive as a flag on your mailbox and a count on the menu.

**Next session reminder:** 10 minutes before a booked session, the Balance pill area shows one line: `Lesson with Mira in 10 min · Go`. "Go" quick-travels you to the Lantern Room.

---

## 8. Key overlays and screens

All overlays are **parchment sheets** that slide up from the bottom (mobile) or open centered (desktop) over a dimmed world. The world keeps moving behind them.

### 8.1 Wishing Well — post a request

```text
┌──────────────────────────────────────────────────────────────┐
│  Make a wish                                                 │
│                                                              │
│  I want to learn  [ chords for one song on guitar        ]   │
│                                                              │
│  Level   ( ) New to it  (•) A little  ( ) Comfortable        │
│  How     [x] Video  [ ] In person  [ ] Send my work          │
│  When    Weekday evenings · Sat mornings     [ change ]      │
│                                                              │
│  The Barkeep (AI) read this as: Guitar · Beginner · 30 min   │
│                                                              │
│                               [ Toss the coin · 0 h now ]    │
└──────────────────────────────────────────────────────────────┘
```

On submit the coin animation plays once (6 frames). When a match appears later, the Well glints and a note lands in your mailbox.

### 8.2 Notice Board — the accessible heart

```text
┌──────────────────────────────────────────────────────────────┐
│  Notice Board                         [ Requests | Offers ]  │
│  Search [ guitar                 ]   Guild ▾  Format ▾  When ▾ │
├──────────────────────────────────────────────────────────────┤
│  ▪ Guitar · Beginner        Mira · Free now        [ Book ]  │
│  ▪ Guitar · Fingerstyle     Tomas · Away · Tue     [ Book ]  │
│  ▪ Music theory basics      Group class · 4/8 seats [ Join ] │
│  ▪ Ukulele                  Dana · Offline · Sat   [ Book ]  │
└──────────────────────────────────────────────────────────────┘
```

- This is the same data as the village, as a list. It is the default view in Plain mode and on small phones.
- Each row's square pin uses the guild color; status is always also written in words.
- "Show on map" on any row walks you (or quick-travels you) to that hut.

### 8.3 Tavern — swap cycles

Inside The Swapped Mug, each proposed swap cycle is a **table with chairs**: your chair plus the others in the loop. Sitting at a table opens:

```text
┌──────────────────────────────────────────────────────────────┐
│  A swap for three                                            │
│                                                              │
│   You ──teach Excel──▶ Mira ──teach Guitar──▶ Leo            │
│    ▲                                            │            │
│    └──────────────teach Spanish─────────────────┘            │
│                                                              │
│  Everyone teaches 1 h and learns 1 h. Net cost: 0 h.         │
│  2 of 3 have accepted · expires in 41 h                      │
│                                                              │
│  [ Accept my seat ]          [ Not now ]                     │
└──────────────────────────────────────────────────────────────┘
```

Group class proposals are on the chalkboard by the fireplace. The Barkeep explains any match on request; his nameplate always reads "Barkeep · AI".

### 8.4 Booking scroll

```text
┌──────────────────────────────────────────────────────────────┐
│  Book Mira · Guitar                                          │
│                                                              │
│  Length   [ 30 min ] [ 1 h ]                                 │
│  Day      Tue 18  Wed 19  Thu 20  Fri 21                     │
│  Time     18:00   18:30   19:00                (your time)   │
│           = 15:00 for Mira                                    │
│                                                              │
│  Cost 0.5 h · held now, paid after you both confirm          │
│                                                              │
│                                   [ Hold 0.5 h and book ]    │
└──────────────────────────────────────────────────────────────┘
```

### 8.5 Lantern Room (live session)

Entering the booked Lantern Room switches to a calm **session layout**: the video takes the screen; the pixel world is reduced to a small window strip at the top showing the lantern lit. No walking, no kitty roaming, no game notices. Leaving shows the two-sided confirm screen from the SkillSwap architecture.

### 8.6 Bank and Clock Tower

- **Bank:** the teller window shows Balance, Held, History (one list, newest first, each row "+1 h · taught Excel to Leo · Tue").
- **Clock Tower:** climbing it runs the ledger audit; the gears turn as chunks verify, and the final state is plain text: `Ledger verified · 18,204 entries · head 9f3c…a71e`.

---

## 9. Plain mode, mobile and accessibility

Spatial UIs fail people who can't or won't navigate space. Every village place has a plain twin.

| Need | Solution |
|---|---|
| Screen reader / keyboard only | `Plain mode`: standard pages (`/board`, `/u/mira`, `/bank`, `/sessions`), same features, semantic HTML. The canvas is `aria-hidden`; an off-screen live region announces nearby interactables ("Notice Board ahead, press E"). |
| Motion sensitivity | `prefers-reduced-motion`: quick-travel only (no walking camera), no weather, no idle bobbing |
| Small phones | Notice Board is the home screen; village opens on demand at 2× scale with tap-to-move and a bottom sheet for every interaction |
| Low-end devices | Lower render scale, 30 fps cap, scenery critters off |
| Color vision | Status always has text and shape (lit lantern vs. closed sign), guild colors always paired with a sign icon |
| Text size | HUD and panels respect browser font size; the world stays pixel-scaled while UI text scales |
| Focus | 2 px plum focus ring with 2 px offset on every control (`:focus-visible`) |
| Touch targets | Minimum 44 × 44 px for every pill and button |

---

## 10. Visual system

### 10.1 Color tokens

| Token | Hex | Role (never used outside it) |
|---|---|---|
| `ink` | `#2B1B33` | Outlines, all UI text, focus ring |
| `paper` | `#FBF6EC` | Panel background |
| `paper-shade` | `#EADFCB` | Panel inner divisions, pressed states |
| `lantern` | `#F2B33D` | **Primary action button AND lit lanterns only** (a teacher available now). Text on it is `ink`. |
| `lantern-glow` | `#FFE3A1` | World-only light halo around lit windows at dusk |
| `grass` / `grass-shade` | `#A8CF8E` / `#76A86A` | World ground |
| `path` / `path-shade` | `#DDBD8F` / `#B9935F` | Roads; wear-in blends grass → path |
| `water` | `#86BEDF` | Well, pond |
| `stone` | `#B7B2C2` | Square paving, bank, tower |
| `danger` | `#B03F3A` | Destructive confirms and errors only |
| `ok` | `#357344` | Success text only (never decoration) |
| Guild roofs | 13 colors (see 3.2) | Category identity only |

- The palette continues the kitty reference: pastel fills, plum outline, warm ground.
- **Night** is a multiply layer on the world canvas (tinted `#3A3260` at 35–55%) with lantern-glow punched through. Panels and HUD stay `paper` at all times; the product is never in dark mode.
- Contrast (WCAG): `ink` on `paper` 14.9:1; `ink` on `lantern` 8.6:1; `danger` on `paper` 5.4:1; `ok` on `paper` 5.3:1 — all pass AA for body text.

### 10.2 Type

| Use | Font | Size (desktop) | Rule |
|---|---|---|---|
| Names, nameplates, place titles | Pixelify Sans 600 | 20 px | Pixel face, short text only |
| Buttons, prompts, labels | Pixelify Sans 500 | 16 px | Max ~4 words |
| Body, dialogue, lists | Inter 400/500 | 16 px, line height 1.5 | Everything longer than one line |
| Numbers (hours, times) | Inter, tabular figures | 16 px | Always `1 h`, `30 min` |
| Small meta | Inter 500, +0.02em | 13 px | Never below 13 px |

Pixel text stays under roughly a fifth of all text on any screen.

### 10.3 Panels and controls

- **Panel:** `paper` fill, 2 px `ink` pixel border (drawn with a 9-slice PNG so corners are stepped, not rounded), 4 px hard drop shadow in `ink` at 20% (no blur).
- **Primary button:** `lantern` fill, `ink` text, stepped corners, 2 px bottom edge in `#C98F22` that disappears on press (button sinks 2 px).
- **Secondary button:** `paper` fill, `ink` border.
- **Tertiary:** text only with underline on hover.
- **Inputs:** `paper` fill, 2 px `ink` border, focus ring per §9.
- **Cards** exist only for clickable rows (Notice Board items, table seats). Everything else is plain rows and dividers.
- **Icons:** 16 × 16 pixel icons drawn in-house (hourglass, map, menu, mailbox, lantern), never emoji.

### 10.4 Grid and scale

- World tile: 16 × 16 px, rendered at 3× (48 px) on desktop, 2× (32 px) on phones; camera snaps to whole pixels.
- UI spacing: 4 px base unit; panel padding 24 px; button height 44 px.
- Panels max 640 px wide; one column.

### 10.5 Motion and sound

| What | Spec |
|---|---|
| Sprites | 8–12 fps frame animation |
| Panels | 120 ms in, 90 ms out, `steps(4)` for the pixel slide feel |
| Camera | Follows with a 120 ms ease, never shakes |
| Quick-travel | 200 ms fade to `paper`, then in |
| Day/night | Follows the viewer's local time; dawn and dusk transitions over 30 real minutes |
| Weather | Rare, light (drizzle, falling leaves), off in reduced motion |
| Sound | Off by default; ambient village loop, tavern murmur, clock chime; never during sessions |

---

## 11. Onboarding flow

| Step | Place | What happens | Exit |
|---|---|---|---|
| 1 | The Gate | One line: "Welcome to the village. Teach an hour, learn an hour." Two buttons: Enter / Plain mode | Enter |
| 2 | Gate (creator) | Make your villager (§5.3) | Continue |
| 3 | Gate (kitty) | Pick one of three kittens, name it (Gamification doc) | Continue |
| 4 | Path to the square | Walk 8 tiles; the kitty follows; the Barkeep waves from the tavern door | Reach the Well |
| 5 | Wishing Well | Make your first wish (§8.1) | Toss the coin |
| 6 | Notice Board | Pick what you can teach (3 taps) | Done |
| 7 | Your hut appears in the lanes | "This is your hut. Light the lantern when you're free to teach." | Light lantern / Later |

Total: under two minutes; every step skippable; a progress dot row at the top of each sheet.

---

## 12. How it's built (front end)

| Layer | Choice | Why |
|---|---|---|
| World renderer | **Phaser 3** in a client-only React island | Mature tilemaps, cameras, sprite animation and pathing helpers; ships in a web bundle |
| Maps | **Tiled** JSON (16 px tiles), core village hand-made, residential lanes generated from templates | Same pipeline WorkAdventure uses; huts placed procedurally so non-artists never touch maps |
| Pathfinding | A* on a collision grid exported from Tiled | Click-to-move and NPC-free walking |
| UI overlays | React + the SkillSwap design system (shadcn/Radix) restyled with the tokens above | Real accessible controls, not canvas buttons |
| Presence | Ably channels per village instance; position updates at 8 Hz only for players within ~20 tiles; client interpolation | Cheap and smooth; nobody downloads the whole village's movement |
| Assets | Sprite atlases per category, palette-swapped at runtime; service-worker cached | First load under ~1.5 MB; repeat visits instant |
| Twin pages | Next.js routes for every place (`/board`, `/tavern`, `/bank`…) | Plain mode, deep links, SEO, and no-JS fallbacks |

Performance budget: world bundle ≤ 350 KB gzipped, loaded after the HUD; 60 fps on a mid-range laptop at 3×; 30 fps cap on phones.

---

## 13. Decision ledger

| Decision | Source | Role rule | Why |
|---|---|---|---|
| Village = product navigation | User brief | Places map 1:1 to features | Makes an abstract time bank tangible and memorable |
| AFK members shown inside huts | User brief + Gather "Away makes your avatar leave the office" | Presence is spatial and explicit | Lets you book someone who isn't online, which is the common case |
| Proximity prompt, no auto video | Gather proximity model, adapted | Video only in Lantern Rooms | Strangers on a skills platform shouldn't be pushed into camera |
| Lit lantern = available now | Original synthesis | `lantern` color shared only by CTA and available lanterns | The one memorable detail; ties "act now" to "someone's here now" |
| Portrait + nameplate above dialogue box | Stardew dialogue mods | Box holds words and actions only | Cleaner hierarchy, room for three buttons |
| Tiled maps, 16 px tiles | WorkAdventure | Staff edit the core map; huts are generated | Proven web pipeline; avoids the map-building barrier |
| Pixelify Sans + Inter | Pixel-font pairing practice | Pixel face for ≤4-word labels and names | Pixel look without paragraph fatigue |
| Light paper HUD, night only in world | Refero anti-slop (no dark default) | Night tint never touches panels | Readable at all hours; avoids dark-mode slop |
| Plain mode twin pages | Craft accessibility rules + spatial UI risk | Same data, no walking | Keyboard, screen reader, mobile and speed users |
| Honest population | Product ethics | No fake members, ever | Trust is the product; fake NPCs would poison it |
| Worn paths from real walking | Original synthesis | Real, anonymized, weekly | A living village that reflects its community |

---

## 14. Risks and how the design answers them

| Risk | Answer |
|---|---|
| Walking slows down real tasks | Map quick-travel, `/` search, Notice Board list, deep links; walking is never required |
| Village feels empty early on | Per-viewer hut placement, activity traces, scenery life, small instances, friends placed together |
| Too game-like for adults paying with their time | Calm palette, no XP pop-ups, session mode strips all game layers, Plain mode one click away |
| Accessibility of a canvas world | Twin pages, live-region announcements, keyboard first, reduced motion |
| Performance on phones | List-first home on phones, 2× scale, 30 fps cap, critters off |
| Privacy (who sees me where) | Exact position visible only to people in your instance and range; status is your choice; hide-me option shows only your hut |
| Art workload | 16 px tiles, palette swaps, generated huts, one artist can ship the core set |

---

## 15. MVP for the hackathon (24 h)

| In | Out (later) |
|---|---|
| Town Square with Well, Notice Board, Tavern, Bank, Clock Tower; one residential lane | Guild Quarter buildings (use signposts to category boards) |
| Character creator: skin, hair, top, 3 options each | Full wardrobe, hut customization |
| Online members walking + AFK huts with sign dialogue and booking | Group classes, chalkboard, pond |
| Lit-lantern availability | Worn paths, weather |
| Swap-cycle table in the tavern | Barkeep chat beyond parsing a wish |
| Plain mode Notice Board as fallback | All twin pages |

**Demo moment:** the judge enters at the Gate, makes a villager, tosses a wish into the Well, walks to a hut with a lit lantern, books, and sees the tavern table for their swap cycle. Then they toggle Plain mode to see the same thing as a list.

---

## Sources

- Gather — Getting Started (status: Active/Busy/Away; Away makes your avatar leave the office): https://support.help.gather.town/articles/1982412443-getting-started-guide
- Gather — Guest guide (proximity starts and ends conversations): https://s3.wp.wsu.edu/uploads/sites/167/2021/09/guest-guide-to-gather.pdf
- WorkAdventure — map building with Tiled, 32×32 tiles: https://meta.wikimedia.org/wiki/WikiProject_remote_event_participation/WorkAdventure/fr
- WorkAdventure — map building as the barrier for non-technical teams: https://unsubbed.pages.dev/tools/workadventure/
- Stardew Valley dialogue redesign mod (portrait and name above the box): https://www.nexusmods.com/stardewvalley/mods/30870
- Pixel font pairing guide (pixel display + sans body, 15–20% rule): https://pixelfontpicks-u4.pages.dev/how-to-use-pixel-fonts-in-modern-web-design-free-pixel-font-downloads
- Pixelify Sans (four weights): https://speckyboy.com/free-pixel-fonts.md
- Refero design craft guides (anti-slop, craft details, color) — bundled with the refero-design skill
- SkillSwap — System Architecture and Gamification docs (internal)
