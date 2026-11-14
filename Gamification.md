# Gamification

Nov 14, 2026 · @Assem Zhakipbayeva

## Summary

**Every SkillSwap member gets a one-of-a-kind pixel kitty that lives on the website, behaves like a real cat, and grows as its owner teaches and learns.** Around the kitty sit three systems: XP and levels, seven ranks, and outfits and accessories unlocked by real activity. The kitty is the reward; ranks are the status; nothing is for sale with hours.

### What it adds

| Piece | What the member sees | Why it helps SkillSwap |
| --- | --- | --- |
| Kitty | A unique pixel cat that naps, grooms, follows the cursor and reacts to your sessions | A reason to come back daily; an emotional face for an abstract time bank |
| XP and levels | A quiet level number and a thin progress bar on the profile | Rewards the behaviors the platform needs: teaching, finishing sessions, kind reviews |
| Ranks | Seven named ranks from Kitten to Legend, shown as a word next to the name | Signals experience to other members, alongside trust levels |
| Outfits and accessories | Hats, scarves, glasses, beds and room items for the kitty | Visible progress and self-expression without changing anything about hours |
| Achievements | Small badges for milestones and for teaching across categories | Nudges members to try new categories |

### Rules that keep it honest and laconic

1. **XP is not money and not hours.** It can't be traded, gifted, bought or turned into hours, so the time bank stays a time bank.
2. **Only confirmed, two-sided activity earns XP.** Clicking around earns nothing; a settled session with a real counterpart does.
3. **The kitty never dies and is never sad because you were away.** Neglect only makes it sleepier; there is no guilt mechanic.
4. **Laconic presentation.** The kitty is the only playful element on screen; ranks and levels are plain text. No confetti, no streak pressure, no pop-ups during sessions.
5. **Always optional.** One switch hides the kitty and mutes all game notices; progress keeps counting quietly.

## Pixel art style

**The kitty follows your reference: a chunky front-facing kitten with a thick dark outline, soft pastel fur, a white muzzle and chest, pink inner ears and cheeks, and a few tabby stripes.** Every kitty, outfit and room item is drawn to the same spec so layers always line up.

### Sprite spec

| Property | Rule |
| --- | --- |
| Frame size | 48 × 48 px per frame; the cat itself about 32 px tall, feet on row 44 |
| Views | Front sitting (idle, reactions) and side (walk, run, jump); side frames mirrored for the other direction |
| Outline | 1 px, a single very dark plum, never pure black; outline drawn on the body layer only |
| Shading | Flat fills, one shadow tone and one highlight tone per material, hue-shifted (shadows lean purple, highlights lean warm) |
| Anti-aliasing | None; no dithering on fur |
| Palette | One master palette of 32 colors; each kitty uses an 8-color slice swapped at render time |
| Scale | Whole-number scaling only: 3× on desktop (144 px), 2× on mobile (96 px); CSS `image-rendering: pixelated` |
| Ground | A soft 2-tone ground shadow under the feet, like the reference |
| Frame rate | 8–12 frames per second depending on the animation |

### Reference

&#91;image: Pixel kitty style reference\]

The target look: lavender-gray tabby, white muzzle and chest, pink ears and cheeks, plum outline, soft ground shadow.

## Progression

**XP comes only from confirmed activity, levels run from 1 to 50, and ranks need both a level and real teaching, so nobody reaches the top by only taking lessons.** All numbers are starting values to tune with real data.

### XP sources

| Action | XP | Limit |
| --- | --- | --- |
| Teach a settled session | 10 per 30 min | Group classes ×1.5 |
| Learn in a settled session | 8 per 30 min | — |
| Deliver an async review | 10 | — |
| Complete a swap cycle | +15 for each member | Once per cycle |
| First session with a new counterpart | +10 | Once per pair |
| First time teaching in a new category | +25 | Once per category |
| Write a review | +3 | One per session |
| Receive a 5-star review | +5 | — |
| Serve on a dispute panel | +15 | Once per case |
| Gift hours to the community pool | +2 per 30 min | 20 XP a week |
| Complete your profile | +20 | Once |
| Visit and pet your kitty | +1 | 7 XP a week |

**Anti-farming limits:** at most 300 XP a day; at most 60 XP a week from the same counterpart; XP from a session that is later refunded through a dispute is revoked.

### Level curve

```latex
XP_{total}(n) = \mathrm{round}\left(40 \cdot (n - 1)^{1.7}\right), \quad 1 \le n \le 50
```

Level 2 needs 40 XP, level 10 needs 1,676 and level 50 needs 29,881. A member who teaches 2 hours and learns 2 hours a week earns about 72 XP a week from sessions alone, reaching about level 15 in a year: early levels come fast, the top takes years.

### Ranks

| Rank | Level | Extra condition | Unlocks |
| --- | --- | --- | --- |
| Kitten | 1 | — | Basic kitty, 2 outfit slots |
| Tabby | 5 (422 XP) | 1 session taught | Collar slot, first room item |
| Alley Cat | 10 (1,676 XP) | 5 hours taught | Glasses and back slots |
| Lynx | 18 (4,941 XP) | 20 hours taught | Animated accessories, rank shown on profile card |
| Puma | 26 (9,518 XP) | Taught in 3 categories | Second room theme, kitty can visit other profiles |
| Snow Leopard | 35 (16,054 XP) | Trust level 3 | Rare coat effect (subtle sparkle on the tail) |
| Lion | 45 (24,885 XP) | 200 hours taught | Crown slot, Legend frame on profile |

Rank never drops. If XP is revoked, the level can fall, but an earned rank stays.

## The kitty

**Each kitty is generated from a genome: a short code of genes for coat, pattern, markings, eyes, ears, tail, body and personality, rolled from a seeded random generator and guaranteed unique by a database constraint.** Members pick one of three kittens on their first visit and name it; choosing builds attachment.

### Genes

| Gene | Options | Notes |
| --- | --- | --- |
| Base coat | 12 colors (lavender gray as in the reference, orange, cream, black, white, brown, blue-gray, cinnamon, fawn, silver, chocolate, smoke) | Palette slice per color |
| Pattern | Solid, tabby stripes, spotted, tuxedo, bicolor, calico, tortoiseshell, colorpoint | Pattern is its own sprite layer |
| Pattern layout | 4 variants per pattern | Where the stripes or patches fall |
| White markings | None, muzzle, chest, socks, blaze, muzzle and chest | Like the reference's white face and chest |
| Eyes | Green, amber, blue, copper, odd-eyed | Odd-eyed is rare (2%) |
| Ears | Upright, tufted, folded | Folded is rare (3%) |
| Tail | Long, fluffy, short bob | — |
| Body | Slim, round | Changes the walk and sit sprites |
| Shade | Light, normal, deep | Shifts the palette slice |
| Personality | Five traits from 0 to 1: playful, sleepy, curious, affectionate, sassy | Not visible; changes how often each behavior happens |

Visible combinations: 12 × 8 × 4 × 6 × 5 × 3 × 3 × 2 × 3 = 622,080, before personality and outfits. That covers early growth; new genes and layouts (each multiplies the total) are added well before the member count gets close.

### Generation

1. **Seed:** SHA-256 of the member id plus a server secret, so nobody can predict or grind for a genome.
2. **Roll:** a small seeded generator (xoshiro128) picks each gene by weighted tables, rare options included.
3. **Encode:** the genome becomes a compact versioned code such as `v1.c03.p2.l1.w5.e0.r0.t1.b1.s2`.
4. **Uniqueness:** the visible part of the code has a unique index; on a collision the generator re-rolls with the next counter value.
5. **Choice:** three kittens are rolled (counters 0, 1, 2); the member keeps one, names it, and the other two are discarded.

### Growth stages

| Stage | Levels | Look |
| --- | --- | --- |
| Kitten | 1–9 | Big head, short legs, about 26 px tall |
| Young cat | 10–25 | Longer body and tail, about 30 px tall |
| Adult | 26–50 | Full size, about 32 px tall, calmer idle poses |

Rare genes are random and purely cosmetic. They are never sold, so there is nothing to chase with money.

## Kitty behavior

**The kitty runs on a utility AI: every few seconds it scores each possible behavior from its needs, its personality, the time of day and what is happening on the page, then picks one, with a little randomness so it never feels scripted.** It sleeps most of the day like a real cat and wakes up for short bursts.

&#91;embedded content: kitty behavior loop · 8 behaviors around one calm state\]

Personality weights tilt the choice: a sleepy kitty loafs more, a playful one hunts the cursor more, an affectionate one comes to be petted.

### Grounded in real cat behavior

- **Lots of sleep, in short naps.** Most cats sleep 12 to 18 hours a day, in several short periods rather than one long stretch ([CitizenShipper](https://citizenshipper.com/blog/are-cats-nocturnal/)). The kitty naps often and briefly.
- **Busiest at dawn and dusk.** Cats are crepuscular, most active at dawn and dusk ([PDSA](https://www.pdsa.org.uk/what-we-do/blog/why-do-cats-sleep-so-much)). The kitty uses the member's local time: playful around sunrise and sunset, sleepy at midday and late at night.
- **The slow blink as a smile.** Researchers found slow blink sequences may work as positive emotional communication between cats and humans ([Humphrey et al., Scientific Reports, 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7536207/)). When the member hovers calmly near the kitty, it slow-blinks back; this is its "I trust you".

### Needs

| Need | Falls when | Restored by | At its lowest |
| --- | --- | --- | --- |
| Energy | Playing, exploring | Sleeping, loafing | Falls asleep wherever it is |
| Hunger | Slowly over hours | Kibble (free, any time) or a treat (earned) | Sits by the bowl and meows softly; never gets sick |
| Play | Long idle stretches | Toy play, chasing the cursor | Knocks a small item off a card edge |
| Affection | Time without petting | Petting, slow blinks | Walks over and head-boops the cursor |

Needs are stored as a value plus a timestamp and computed on read, so the kitty keeps "living" while the member is away without any server ticking. **There is no death, sickness or sad face:** the worst state is a sleepy cat that perks up the moment you return.

### Behavior catalog

| Group | Behaviors |
| --- | --- |
| Rest | Curled sleep, loaf, sleep on a warm element (your balance card), stretch and yawn on waking |
| Care | Groom paws and face, eat, drink, scratch the post on the profile |
| Explore | Walk along card tops and edges, sniff new items, sit at the window and chatter at the cursor |
| Play | Stalk and pounce on the cursor, bat a toy, zoomies across the page, hide in a box |
| Social | Purr when petted, slow blink, head boop, tail-up greeting when you arrive, knead before sleeping |
| Sass | Tail flicks when petted too long, sits on the paragraph you are reading, pushes a small item off an edge |

### Reactions to SkillSwap events

| Event | Kitty reaction |
| --- | --- |
| Member arrives | Tail-up trot toward the cursor, then sits |
| Session starts in 5 minutes | Walks to the Join button and sits beside it |
| During a live session | Curls up and sleeps; never moves or makes sound |
| Session settled | Happy hop, gets a treat, then grooms |
| New 5-star review | Slow blink and purr |
| Level up | Stretch, then the new size or pose; one quiet line of text, no confetti |
| New message | Ears perk toward the inbox icon |
| Long time away | Found asleep; wakes with a stretch and a soft meow |

### Interactions

- **Pet:** hover and move slowly over the kitty; it purrs, and past its tolerance it flicks its tail and walks off.
- **Feed:** click the bowl for kibble any time, or give a treat earned from settled sessions.
- **Play:** drag a toy; the kitty stalks and pounces.
- **Pick up and drop:** drag the kitty to another spot; it lands on its feet and grooms, a little offended.
- **Visit:** at rank Puma, a kitty can wander onto a profile you are viewing and greet that member's kitty.

## Outfits and accessories

**Items are earned, never bought: by level, by rank, by achievements, and by teaching in a category, so a kitty's outfit tells other members what its owner actually does.** Each item attaches to anchor points the body sprite defines frame by frame, so one item drawing fits every pose.

### Slots

| Slot | Anchor | Examples | Unlocked at |
| --- | --- | --- | --- |
| Head | Top of head | Beanie, beret, chef hat, crown | Kitten |
| Neck | Neck | Bandana, bow tie, scarf | Kitten |
| Collar charm | Neck center | Bell, star, category charms | Tabby |
| Face | Eyes | Round glasses, sunglasses, monocle | Alley Cat |
| Back | Back | Tiny backpack, cape, wings | Alley Cat |
| Tail | Tail tip | Ribbon, pom-pom | Lynx |
| Bed | Ground under the cat | Basket, cushion, cardboard box | Tabby |
| Room | Background scene on the profile | Window, plant, bookshelf, rug | Tabby (one), Puma (second theme) |
| Toy | Near the cat | Yarn ball, feather wand, mouse | Kitten |

### How items are earned

| Source | Rule | Examples |
| --- | --- | --- |
| Level | Every 5 levels unlocks one item from a fixed track | Level 5 scarf, level 15 backpack, level 30 cape |
| Rank | Each rank adds a signature item | Lynx animated bell, Snow Leopard tail sparkle, Lion crown |
| Teaching a category | 5 hours taught in a category unlocks its themed item | Cooking: chef hat · Music: headphones · Tech: tiny laptop · Design: beret · Languages: globe charm · Fitness: sweatband · DIY: tool belt · Academic: graduation cap · Garden: flower crown |
| Achievements | Each badge can carry an item | Swap Cycle: chain-link charm; Community Pool donor: heart bell |
| Seasonal | Small sets each season, returning every year so nobody misses them forever | Winter scarf, autumn leaf hat |

### Item data

Each item is a row with: id, slot, name, unlock rule (as data, for example `{"type":"category_hours","category":"cooking","minutes":300}`), rarity tag, animated or not, and sprite references for each growth stage and view. The unlock engine evaluates rules on every XP event, so adding an item never needs new code.

Items are equipped from a simple wardrobe sheet: slots in a list, the kitty preview on top, one Save button.

## Achievements and badges

**Achievements reward breadth, kindness and reliability, not grinding.** Each is a rule in the database, evaluated by the same engine as item unlocks, and shown as a small monochrome pixel badge on the profile.

| Badge | Condition | Reward |
| --- | --- | --- |
| First Paw | First settled session, either side | Yarn ball toy |
| First Lesson Given | First session taught | Bell charm |
| Full Circle | Complete a swap cycle | Chain-link charm |
| Polyglot Paws | Learn in 3 language skills | Globe charm |
| Jack of All Trades | Teach in 5 categories | Patchwork scarf |
| Reliable | 20 sessions in a row with no late cancel or no-show | Pocket watch charm |
| Kind Words | Write 25 reviews | Heart bandana |
| Crowd Favorite | 10 five-star reviews | Star charm |
| Group Leader | Teach 5 group classes | Tiny megaphone |
| Open Paws | Gift 10 hours to the community pool | Heart bell |
| Fair Judge | Serve on 5 dispute panels | Scales charm |
| Early Bird | Attend 5 sessions before 8 am local time | Sunrise room window |
| Night Owl | Attend 5 sessions after 9 pm local time | Moon room window |
| Mentor's Mentor | Someone you taught later teaches the same skill | Gold whisker effect |
| Cat Whisperer | Get 50 slow blinks from your kitty | Cushion bed |
| Explorer | Visit 25 skill pages in different categories | Tiny map backpack |

Badges never expire and are never taken away, except when the session behind them is reversed in a dispute.

## Rendering engine

**The kitty is a client-only canvas layer that loads after the page is idle, treats the tops of marked page elements as platforms it can walk and jump on, and never covers anything the member is trying to use.**

### Components

| Module | Job |
| --- | --- |
| `KittyLayer` | React component mounted once in the root layout, loaded with a dynamic import after `requestIdleCallback`; owns the canvas and the loop |
| `Compositor` | Builds the kitty's frames: recolors grayscale-keyed body sprites with the genome's palette slice, stacks pattern, markings and eyes, then draws outfit items at each frame's anchor points; caches results as `ImageBitmap`s |
| `Brain` | Utility AI: scores behaviors from needs, personality, local time and page events; picks one with weighted randomness |
| `Motor` | Turns a chosen behavior into movement: walking, jumping arcs, landing, with simple gravity |
| `PerchMap` | Finds page elements marked `data-perch`, keeps their top edges as platforms, updates on scroll, resize and DOM changes |
| `Animator` | Plays sprite animations at 8–12 fps on a fixed-step loop |
| `Input` | Petting, dragging, toy play and slow-blink detection on a small hit area over the kitty only |
| `Bus` | Receives SkillSwap events (session settled, message, level up) from the app's realtime channel |

### Drawing

- One full-viewport `<canvas>` with `pointer-events: none`; a small transparent element follows the kitty to receive pointer events.
- Canvas backing size = CSS size × device pixel ratio; `imageSmoothingEnabled = false`; positions rounded to whole pixels after scaling, so pixels stay crisp.
- Sprite atlas: one PNG per growth stage plus a JSON frame map with anchor points (Aseprite export format).
- Palette swap: body sprites use reserved gray keys; the compositor maps each key to the genome's colors once and caches the result.

### Walking on the page

1. Elements such as cards, section headers and the balance card carry `data-perch`; buttons, inputs and the session room carry `data-no-perch`.
2. `PerchMap` reads their rectangles with `getBoundingClientRect`, kept fresh by `ResizeObserver`, a passive scroll listener and a throttled `MutationObserver`.
3. Platforms form a small graph: an edge exists where a jump arc can reach another platform. The motor picks a path with a breadth-first search.
4. On a platform the kitty moves with the content as you scroll; on the floor it stays at the bottom of the viewport.
5. It steps aside if the cursor heads for a button it is near, and never sits on the focused element or on selected text.

### Performance budget

| Item | Budget |
| --- | --- |
| Code | Under 25 KB gzipped, loaded after first paint |
| Sprites | Under 80 KB per growth stage, cached by the service worker |
| CPU | Loop at full rate only while the kitty moves; 10 fps while it sleeps; stopped when the tab is hidden |
| Layout | No forced layout in the loop; rectangles are read only on scroll, resize and DOM change |
| Tabs | `BroadcastChannel` keeps one awake kitty, in the focused tab; other tabs show it asleep |

### Accessibility and comfort

- With `prefers-reduced-motion`, the kitty stays in one corner and changes pose slowly.
- The canvas is `aria-hidden`; a labeled Kitty button reads its state ("Miso is napping") and opens the kitty panel.
- Sound is off by default, and never plays during a session.
- One setting hides the kitty everywhere.

## Server architecture and data model

**Gamification is one more module in the SkillSwap monolith. It listens to domain events from the outbox, keeps its own append-only XP log, and never reads or writes the hour ledger.** The server owns everything that can be earned; the browser only animates.

### Event flow

1. A domain action (session settled, review written, cycle completed, dispute resolved, hours gifted) writes its event to the `outbox` in the same transaction.
2. An Inngest function `gamification.onEvent` receives it and grants XP idempotently, keyed by the event id, so retries never double-count.
3. Caps are applied (daily, per counterpart, per source).
4. In one transaction: insert the XP event, update the member's total, level and rank, and evaluate unlock rules for items and achievements.
5. Results are published on the member's Ably channel; the kitty reacts in any open tab.
6. A refund through a dispute emits a reversing XP event that points to the original; rank is kept, as the rules say.

### What lives where

| State | Owner | Why |
| --- | --- | --- |
| XP, level, rank, items, achievements | Server | Earned value; must be cheat-proof |
| Genome, name, stage | Server | Identity of the kitty, shown to others |
| Needs (hunger, energy, play, affection) and treats | Server, as value + timestamp | Shared decay function in TypeScript runs identically on client and server |
| Position, current behavior, animation | Browser only | Pure presentation; nothing to cheat |

### Tables

| Table | Key fields | Notes |
| --- | --- | --- |
| `kitties` | member\_id (primary key), genome\_code, name, personality (JSON), stage, treats, created\_at | Unique index on the visible part of the genome |
| `kitty_needs` | member\_id, hunger, energy, play, affection, updated\_at | Values at `updated_at`; current values computed on read |
| `xp_events` | id, member\_id, source\_event\_id, source, amount, reverses\_id, created\_at | Append-only; unique on (member\_id, source\_event\_id) |
| `member_progress` | member\_id, xp\_total, level, rank, rank\_reached\_at | Rebuildable from `xp_events` |
| `items` | id, slot, name, unlock\_rule (JSON), rarity, animated, sprites (JSON) | Catalog is data |
| `member_items` | member\_id, item\_id, unlocked\_at, source\_event\_id | What the member owns |
| `equipped` | member\_id, slot, item\_id | One item per slot |
| `achievements` | id, name, rule (JSON), item\_id | Rules evaluated by the unlock engine |
| `member_achievements` | member\_id, achievement\_id, earned\_at, source\_event\_id | — |
| `seasons` | id, name, starts\_at, ends\_at, item\_ids | Seasonal sets |

### Server actions and endpoints

| Name | Purpose |
| --- | --- |
| `adoptKitty(choice)` | Keep one of three rolled kittens; only once per member |
| `renameKitty`, `equip`, `unequip` | Wardrobe and name |
| `feed(kind)` | Kibble any time; treats use the earned count |
| `pet()` | Rate-limited; updates affection and the small weekly XP |
| `GET /api/v1/kitty/[handle]` | Public render data for another member's kitty: genome, stage, equipped items |
| `GET /api/v1/progress/me` | Level, rank, next unlocks |

### Anti-cheat

- XP from sessions comes only from server events after both sides confirmed.
- Client interactions (petting, feeding) are capped at a few XP a week.
- The SkillSwap collusion rules apply: per-counterpart caps, device fingerprint checks, dispute reversals.
- Unlock rules run on the server; the browser can request an item but never grant one.

There is no public leaderboard by default, to keep the experience calm; circles can opt in to a monthly "hours taught" board.

## Sprite production pipeline

**Artists draw each body frame once; patterns are painted once per view as small textures and wrapped onto every frame at runtime through a UV map, so 32 pattern variants don't mean 32 copies of every animation.**

### Layers in each Aseprite file

| Layer | Content |
| --- | --- |
| `outline` | The 1 px plum outline |
| `keys` | Fill drawn with reserved gray keys (fur, shadow, highlight, inner ear, nose, eye white, iris) for palette swapping |
| `uv` | Each fur pixel's color encodes where it sits on the pattern texture (red = x, green = y) |
| `anchors` | Single colored pixels marking head top, eyes, neck, back and tail tip |

At runtime the compositor recolors the `keys`, samples the pattern texture through the `uv` layer, adds white markings, and draws outfit items at the anchors.

### Animation list

| View | Animation | Frames |
| --- | --- | --- |
| Front | Idle sit (breathing) | 4 |
| Front | Blink, slow blink | 3, 6 |
| Front | Groom, yawn, meow, purr | 8, 6, 4, 4 |
| Front | Eat, knead, tail flick | 6, 6, 4 |
| Front | Happy hop, level-up stretch | 6, 8 |
| Front | Curled sleep (breathing) | 4 |
| Side | Walk, run (zoomies) | 6, 6 |
| Side | Jump: crouch, air, land | 2, 2, 2 |
| Side | Stalk, pounce, loaf, push item | 4, 6, 2, 6 |

About 105 frames per growth stage, about 315 in total; outfit items need one drawing per view and stage, not per frame.

### Build script

1. Aseprite command line exports each file as a sprite sheet with a JSON frame map and split layers.
2. A Node script (with `sharp`) packs the sheets into one atlas per growth stage and writes a typed TypeScript manifest of animation names, frame timings and anchors.
3. Validation fails the build if a pixel uses a color outside the reserved keys, a frame is missing an anchor, or an animation has the wrong frame count.
4. Assets are content-hashed and served from the CDN; the service worker caches them.

A small internal page, `/dev/kitty`, renders every genome gene, animation and item side by side so art problems show up before release.

## UI integration and settings

**The kitty and progress fit into the existing laconic UI without new navigation: one Kitty button, one line of rank text, and a small profile card.**

| Place | What appears |
| --- | --- |
| Every page | The kitty on its perches; a small Kitty button in the corner with its name and state |
| Kitty panel (sheet on mobile, popover on desktop) | Needs as four thin bars, Feed and Play buttons, treat count, Wardrobe link |
| Wardrobe | Kitty preview, slots as a list, locked items shown as outlines with their unlock rule in one line |
| Profile card | The member's kitty in its outfit and room, rank as a word, level and a thin XP bar |
| Other members' profiles | Their kitty, rank and badges; your kitty may visit (rank Puma and up) |
| Session room | Kitty hidden; it is "sleeping" until the session ends |
| After a settled session | One line: "+20 XP · Miso got a treat"; no modal |
| Onboarding | Last step: pick one of three kittens and name it |

### Settings

- Show kitty: on or off.
- Kitty can roam the page, or stays in its corner.
- Sounds: off by default.
- Game notices (XP lines, unlock notes): on or off.
- Show my rank and badges on my profile: on or off.

## Build scope

**For the 24-hour hackathon, ship one growth stage, the core behaviors and real XP from settled sessions; the judge adopts a kitty in onboarding and sees it react when their demo session settles.**

| Area | MVP (24 hours) | Later |
| --- | --- | --- |
| Kitty | Genome generation, adopt one of three, name it; kitten stage only | Young and adult stages, kitty visits |
| Art | Front idle, blink, slow blink, sleep, happy hop; side walk; 3 patterns, 6 coat colors | Full animation list, all patterns and layouts |
| Behavior | Utility AI with sleep, idle, walk, hunt the cursor, pet and purr; reacts to session settled | Zoomies, knead, push item, full event reactions, time-of-day rhythm |
| Page movement | Floor and 3 perch types (cards, headers, balance card) | Full platform graph with jumps |
| Progression | XP from settled sessions and reviews, levels, first 3 ranks | All ranks, caps tuning, reversals UI |
| Items | 6 items in head and neck slots | All slots, category items, seasonal sets |
| Achievements | First Paw, First Lesson Given, Full Circle | Full list |
| Settings | Hide kitty | All settings |

### Demo moment

During the SkillSwap demo, the judge picks a kitten at the end of onboarding. When their session settles, the kitty hops, gets a treat, the line "+20 XP" appears and the level ticks up; the profile card shows the new rank word.

## Open questions

- [ ] Does the XP curve feel right? Test with simulated members before launch.
- [ ] Should the Plus subscription include any cosmetic items, or stay fully earn-only?
- [ ] Who draws the art: one pixel artist for the core set, or a style-locked set drawn in-house?
- [ ] Sound: include purr and meow at all, given the calm UI?
- [ ] Kitty visits between members: opt-in per member, or on by default?

## Sources

- [CitizenShipper: cat sleep and crepuscular activity](https://citizenshipper.com/blog/are-cats-nocturnal/)
- [PDSA: why cats sleep so much](https://www.pdsa.org.uk/what-we-do/blog/why-do-cats-sleep-so-much)
- [Humphrey et al. (2020), The role of cat eye narrowing movements in cat–human communication, Scientific Reports](https://pmc.ncbi.nlm.nih.gov/articles/PMC7536207/)
