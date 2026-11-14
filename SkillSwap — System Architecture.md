# SkillSwap — System Architecture

Nov 14, 2026 · @Assem Zhakipbayeva

## Summary

**SkillSwap is a time bank for skills: you teach or help for an hour, you earn one hour, and you spend that hour learning anything from anyone in any category.** One hour always equals one hour, whatever the skill. The platform is built from five engines: a tamper-evident hour ledger, a multi-party swap matcher, a session escrow, a trust system and an honest AI concierge. Track: Skills.

### How this version fixes the earlier failures

| Earlier failure          | What went wrong                                                                                              | Fix in this architecture                                                                                                                                                                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Not unique"             | 1:1 skill-swap apps already exist (Sycloop, Nuvra, Swapzo; HelloTalk and Tandem for languages)               | Three things none of them combine: multi-party swap cycles (A teaches B, B teaches C, C teaches A), **pooled group hours** (ten people pool hours to book one expert for a group class), and a verifiable public ledger                                                                                                                  |
| "It doesn't make sense"  | Direct barter needs a double coincidence: the person you want to learn from must want exactly what you teach | Hours are a shared currency, so you teach whoever needs you and learn from whoever you need; direct match is optional                                                                                                                                                                                                                    |
| Cold start               | An empty marketplace has nothing to swap                                                                     | Every new member gets 2 starter hours; group pools and circles bring their own people; an AI practice partner covers gaps until a human match appears                                                                                                                                                                                    |
| Why not just pay a tutor | Money changes the dynamic and the taxes                                                                      | Hours are never convertible to dollars. That keeps the platform a time bank: the IRS has said in private rulings that informal, non-commercial time-dollar programs are not barter exchanges, partly because the credits can't easily be turned into dollars ([Community Currencies Law](https://www.communitycurrencieslaw.org/barter)) |
| Login wall for judges    | The brief requires a production link usable with no sign-up                                                  | Guest identity generated in the browser (a WebCrypto key pair); email is optional and only needed to recover the account                                                                                                                                                                                                                 |
| Hardcoded demo           | Judges read the repo and test the core                                                                       | Matching, ledger, escrow and audit all run for real on live data; only sample members are seeded, and they are labeled                                                                                                                                                                                                                   |

### Five design rules

1. **One hour = one hour.** No skill is worth more than another; no pricing, no bidding.
2. **No cash in, no cash out for hours.** Money only ever pays for an optional subscription, never for hours.
3. **Every hour is earned or granted, and every movement is on the ledger.** Nothing is minted silently.
4. **Both sides confirm.** An hour moves only when learner and teacher both sign off, or a dispute resolves it.
5. **Laconic by default.** One primary action per screen, no decoration that doesn't carry information.

## Service categories

**The platform covers any skill or hands-on help one adult can give another, in four session formats, with licensed professional work and anything involving minors excluded.** Categories are data, not code: a two-level taxonomy table (category, then skill) with per-category rules, so adding a category is a database row.

### Session formats

| Format       | How it runs                                                                                        | Hours counted                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Live 1:1     | In-app video room                                                                                  | Booked length, confirmed by both                                                                           |
| Group class  | One teacher, up to 12 learners, in-app video                                                       | Teacher earns 2× the length; learners split that evenly (10 learners in a 1-hour class pay 0.2 hours each) |
| In person    | Public place by default; home visits only for hands-on categories and only after trust level 2     | Booked length, confirmed by both with a location check-in                                                  |
| Async review | Learner uploads work (code, essay, recording, photo); teacher returns written or recorded feedback | Fixed size: 0.5 or 1 hour, set at booking                                                                  |

### Category taxonomy

| Category                  | Example skills                                               | Formats                | Category rules                                             |
| ------------------------- | ------------------------------------------------------------ | ---------------------- | ---------------------------------------------------------- |
| Languages                 | English, Spanish, Mandarin, ASL, conversation practice       | Live, group, async     | Level tags (A1–C2)                                         |
| Tech and coding           | Web dev, Python, SQL, Excel, AI tools, cybersecurity basics  | Live, group, async     | Screen share on                                            |
| Design and creative       | Figma, UI/UX, branding, illustration, 3D                     | Live, group, async     | Portfolio link optional                                    |
| Video, photo and audio    | Editing, color, photography, podcast production              | Live, async            | —                                                          |
| Music                     | Guitar, piano, voice, production, theory                     | Live, group, in person | —                                                          |
| Writing and communication | Essays, copywriting, public speaking, storytelling           | Live, group, async     | —                                                          |
| Career and business       | Resume review, interview practice, marketing, sales, product | Live, async            | Mentoring, not hiring                                      |
| Academic tutoring         | Math, science, history, test prep for adults                 | Live, group, async     | Adults only                                                |
| Money basics              | Budgeting tools, spreadsheets, how credit works              | Live, group            | Education only, no personal investment advice              |
| Fitness and sports        | Running form, climbing, tennis, swimming technique           | In person, live        | Waiver on booking                                          |
| Mind and wellness         | Yoga, meditation, breathing                                  | Live, group            | No therapy or medical claims                               |
| Cooking and food          | Recipes, baking, knife skills, meal prep                     | Live, group, in person | Allergy note on booking                                    |
| Home and DIY              | Furniture assembly, painting, basic repairs, tools           | In person, live        | No work that needs a license (electrical, gas, structural) |
| Garden and outdoors       | Gardening, composting, hiking, fishing basics                | In person, live        | —                                                          |
| Vehicles and bikes        | Bike repair, car basics, maintenance checks                  | In person, live        | Teaching only, no paid repair work                         |
| Tech help                 | Setting up phones, laptops, smart home, privacy settings     | Live, in person        | Never ask for passwords                                    |
| Crafts and making         | Sewing, knitting, woodworking, 3D printing                   | Live, in person, group | —                                                          |
| Style and beauty          | Styling, makeup, hair basics                                 | Live, in person        | No licensed cosmetology services                           |
| Games and hobbies         | Chess, board games, cards, puzzles                           | Live, group, in person | No gambling                                                |
| Helping hands             | Moving help, errands, pet sitting, plant care, proofreading  | In person, async       | Trust level 2 required                                     |

**Excluded everywhere:** legal, medical, therapy and personalized financial advice; childcare and any session involving minors; rides and driving; anything adults-only or illegal. Licensed professional work also risks turning hours into taxable barter: a lawyer giving legal hours would likely owe tax, while everyday help like dog walking likely would not ([Community Currencies Law](https://www.communitycurrencieslaw.org/income-tax)).

## Feature catalog

**Sixteen modules cover the full service; each feature below is tagged in the build scope section as MVP or later.**

### 1. Identity and onboarding

- Guest identity: a key pair generated in the browser on first visit; no sign-up to browse, book or teach.
- Optional account recovery: email magic link or passkey, linked to the same key.
- Three-step onboarding: what you can teach, what you want to learn, when you're free.
- Profile: skills with levels, languages, timezone, formats offered, short bio, optional photo.
- Starter grant: 2 hours on joining, written to the ledger as a visible grant entry.

### 2. Discovery and search

- Search by skill, category or plain sentence ("help me learn chords for one song").
- Filters: format, level, language, time window, distance (in person), trust level, rating.
- Skill pages: who teaches it, open requests, upcoming group classes.
- Teacher profiles with reviews, endorsements, sessions taught and response time.
- Area view for in-person skills, shown as blurred area cells, never exact homes.

### 3. Matching

- Direct match: people who teach what you want and are free when you are.
- Swap cycles: suggested loops of 2–5 people where everyone teaches and learns at once.
- "Match me": one tap posts a request and the matcher proposes the best options.
- Waitlist alerts when someone who fits joins or opens a slot.
- AI practice partner as a fallback for practice-type skills (language conversation, interview practice) while a human match is found; costs no hours.

### 4. Requests, offers and booking

- Requests board ("I want to learn X") and offers board ("I can teach Y").
- Booking against the teacher's availability, in both timezones.
- Holds: the learner's hours are held at booking, not spent.
- Reschedule and cancel rules: free until 12 hours before; later cancels cost the canceller.
- Reminders and calendar file export.

### 5. Sessions

- Video room with screen share, chat, timer and shared notes.
- Async review: upload work, receive written or recorded feedback.
- In-person check-in: both tap "started" within 200 m of the agreed place.
- End-of-session confirm screen for both sides.

### 6. Hours wallet and ledger

- Balance, held hours, history and a receipt for every movement.
- Overdraft floor of −2 hours so new members can learn before they teach.
- Gift hours to a person or to the community pool.
- Public audit page that recomputes the whole ledger chain in the browser.

### 7. Pools and circles

- Group pools: several learners pool hours to book one teacher for a group class.
- Circles: private groups (a campus, a company, friends) with their own boards and pools.
- Community pool: donated hours that new or low-balance members can request.

### 8. Trust and safety

- Two-sided confirmation before any hour moves.
- Ratings and short reviews after each session; skill endorsements from learners.
- Trust levels 0–3 that unlock formats (in person and helping hands need level 2).
- Report and block; safety guide for in-person sessions.
- No-show handling and disputes decided by a small panel of trusted members.
- Automatic moderation of profiles, messages and uploads.

### 9. Learning progress

- Learning goals with a simple path of sessions.
- Session notes and homework kept per skill.
- Progress view: hours learned and taught per skill.

### 10. AI concierge

- Turns a plain request into a structured one (skill, level, format, time).
- Explains why a match or swap cycle was suggested.
- Drafts a session agenda before and a summary with next steps after.
- Live translation of chat between members with different languages.
- Always says it is an AI; proposes actions and never books, cancels or moves hours without the member's tap.

### 11. Messaging and notifications

- In-app chat per booking and per request.
- Web push and email notifications, with a daily digest option.

### 12. Teacher tools

- Availability editor, offerings with lengths and formats.
- Group class builder with a seat limit.
- Reusable session templates and a taught-hours history.

### 13. Plans

- Free: everything needed to teach and learn.
- Plus subscription: unlimited AI concierge, priority matching, larger group classes.
- Circles for organizations: private spaces with admin tools.
- Hours are never sold or bought, on any plan.

### 14. Admin and operations

- Moderation queue, dispute console, category and rules manager.
- Ledger reconciliation job and alerts.
- Product metrics dashboard and feature flags.

### 15. Accessibility and language

- WCAG 2.2 AA, full keyboard use, captions in video rooms.
- Interface translation and timezone-correct times everywhere.

### 16. Privacy controls

- Profile visibility settings, data export, account deletion.

## System architecture

**Browsers talk to one Next.js app; the app owns all business logic and writes everything that matters to Postgres in one transaction, then fans out events to hosted services.**

&#91;embedded content: system architecture · app, data and hosted services\]

The browser also connects straight to Jitsi for video and subscribes to Ably channels for live chat; uploads go to R2 through signed URLs the app issues.

## Tech stack

**A modular monolith on Next.js and Postgres: one deployable app, one database, with each engine in its own module behind a typed interface.** It ships in 24 hours and splits into services later only where load demands it.

| Layer                 | Choice                                                                                                                                        | Why                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Framework             | Next.js (App Router, React Server Components), TypeScript strict                                                                              | Server-rendered pages, server actions for writes, one codebase           |
| UI                    | Tailwind CSS + shadcn/ui (Radix primitives) + Lucide icons                                                                                    | Accessible primitives, easy to keep minimal and consistent               |
| Validation            | Zod schemas shared by forms, actions and API                                                                                                  | One source of truth for every input                                      |
| Database              | Postgres on Neon + Drizzle ORM and migrations                                                                                                 | Transactions for the ledger, typed queries, branching for previews       |
| Search                | Postgres full-text + pg\_trgm, pgvector for semantic skill match                                                                              | No extra search service to run                                           |
| Identity              | WebCrypto ECDSA P-256 key per device, signed challenge → HTTP-only session cookie; optional magic link (Resend) and passkeys (SimpleWebAuthn) | No sign-up wall; recovery when the member wants it                       |
| Realtime              | Ably channels for chat, presence and live updates                                                                                             | Works on serverless hosting without long-lived servers                   |
| Video                 | Jitsi Meet rooms for the MVP; LiveKit Cloud later for recording and captions                                                                  | Zero setup now, full control later                                       |
| Background jobs       | Inngest durable functions                                                                                                                     | Reminders, hold expiry, nightly matching, ledger reconciliation, retries |
| Cache and rate limits | Upstash Redis + @upstash/ratelimit                                                                                                            | Protects booking, chat and AI endpoints                                  |
| Files                 | Cloudflare R2 (or Vercel Blob) with signed upload URLs                                                                                        | Async review uploads without passing through the app server              |
| AI                    | Claude API through the Vercel AI SDK with tool calls; an embeddings model for skills                                                          | Concierge, summaries, translation, semantic matching                     |
| Email                 | Resend + React Email                                                                                                                          | Magic links, reminders, digests                                          |
| Payments              | Stripe Billing (test mode in the demo)                                                                                                        | Plus subscription only; never used for hours                             |
| Maps                  | MapLibre GL + OpenStreetMap tiles, h3-js area cells                                                                                           | In-person discovery without exact addresses                              |
| Observability         | Sentry, PostHog (analytics, feature flags), pino logs, OpenTelemetry traces                                                                   | See errors, usage and slow paths                                         |
| Quality               | Vitest, fast-check property tests, Playwright end-to-end, Biome lint and format                                                               | The ledger and matcher are tested by invariant, not by example only      |
| Delivery              | GitHub Actions + Vercel preview and production deploys, Neon branch per preview                                                               | Every pull request gets its own live app and database                    |

## Domain and data model

**Time is stored as whole minutes (integers), and the ledger is double-entry: every movement debits one account and credits another, so the sum of all balances is always zero.** Starter grants come from a system issuing account that goes negative by exactly the hours granted. All ids are UUIDs; all tables carry `created_at`.

| Area      | Table                          | Key fields                                                                                                                                 | Notes                                                     |
| --------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Identity  | `members`                      | handle, display\_name, bio, timezone, languages\[\], trust\_level, email (encrypted, nullable), deleted\_at                                | Email is optional                                         |
| Identity  | `devices`                      | member\_id, public\_key (SPKI), last\_seen\_at                                                                                             | One member, many devices                                  |
| Catalog   | `categories`                   | slug, name, parent\_id, rules (JSON: formats, min\_trust, waiver, notes)                                                                   | Category rules are data                                   |
| Catalog   | `skills`                       | category\_id, slug, name, embedding (vector)                                                                                               | Seeded taxonomy, members can propose new skills           |
| Profile   | `member_skills`                | member\_id, skill\_id, direction (teach or learn), level, formats\[\]                                                                      | Drives matching                                           |
| Profile   | `availability`                 | member\_id, weekly rule, timezone                                                                                                          | Stored as recurrence rules                                |
| Market    | `requests`                     | member\_id, skill\_id, level, format, length\_min, window, text, embedding, status                                                         | "I want to learn X"                                       |
| Market    | `offers`                       | member\_id, skill\_id, formats\[\], lengths\[\], group\_max                                                                                | "I can teach Y"                                           |
| Sessions  | `bookings`                     | kind (live, group, in\_person, async), skill\_id, teacher\_id, starts\_at, length\_min, area\_cell, room\_url, status, cycle\_id, pool\_id | Status follows the session state machine                  |
| Sessions  | `booking_participants`         | booking\_id, member\_id, role, cost\_min, confirmed\_at, signature                                                                         | Signature = device-key signature of the confirmation      |
| Ledger    | `accounts`                     | owner\_type (member, pool, community, system), owner\_id, cached\_balance\_min                                                             | Cached balance is rebuilt by reconciliation               |
| Ledger    | `ledger_entries`               | seq, kind, debit\_account, credit\_account, amount\_min, booking\_id, memo, prev\_hash, hash, signer\_key                                  | Append-only: a database trigger rejects UPDATE and DELETE |
| Ledger    | `holds`                        | account\_id, booking\_id, amount\_min, status (held, released, captured), expires\_at                                                      | Holds reserve hours without moving them                   |
| Matching  | `swap_cycles`                  | members (ordered), edges, score, status, expires\_at                                                                                       | Proposed loops of 2–5 members                             |
| Groups    | `pools`, `pool_contributions`  | target\_min, skill\_id, status, booking\_id; member\_id, amount\_min                                                                       | Learners pooling for a group class                        |
| Groups    | `circles`, `circle_members`    | name, visibility, invite\_code; role                                                                                                       | Private groups                                            |
| Trust     | `reviews`, `endorsements`      | booking\_id, author\_id, subject\_id, rating, text; skill\_id                                                                              | One review per side per session                           |
| Trust     | `disputes`, `dispute_votes`    | booking\_id, reason, status, jurors\[\]; juror\_id, decision                                                                               | Panel of 3 trusted members                                |
| Trust     | `reports`, `blocks`            | reporter, subject, reason, status                                                                                                          | Feeds the moderation queue                                |
| Messaging | `threads`, `messages`          | context (booking or request); sender\_id, body, translation                                                                                | Realtime through Ably                                     |
| AI        | `ai_runs`                      | member\_id, purpose, input\_hash, output, tokens, proposed\_action, approved\_at                                                           | Every AI suggestion is logged; actions need approval      |
| Billing   | `subscriptions`                | member\_id, stripe\_customer\_id, plan, status                                                                                             | Plus plan only                                            |
| Ops       | `notifications`, `admin_audit` | member\_id, kind, read\_at; actor, action, target                                                                                          | Admin actions are logged too                              |

## Core engines

**Five engines carry the product; each is a pure TypeScript module with its own tests, called only through server actions and jobs.**

### 1. Hour ledger

- **Write path:** every movement runs in one database transaction: take a transaction-level advisory lock on the ledger, read the last entry's hash, compute `hash = SHA-256(prev_hash + canonical JSON of the entry)`, insert, update cached balances, check that no member account falls below the floor of −120 minutes.
- **Entry kinds:** grant, hold, release, capture, gift, pool contribution, refund, no-show penalty, correction. A correction can only reference an earlier entry through a resolved dispute; nothing is edited.
- **Consent:** both participants' confirmations are signed with their device keys and stored, so anyone can verify that a capture had both sides' agreement.
- **Audit page:** fetches entries page by page and recomputes the chain in the browser with WebCrypto; shows the head hash and the first broken link if any.
- **Anchoring:** a nightly job publishes the day's head hash to a public file in the repository, so even the operator can't rewrite history unnoticed.
- **Invariants, checked by property tests and a nightly reconciliation job:** all balances sum to zero; replaying every entry reproduces the cached balances; the chain verifies; a capture never exceeds its hold; no member is below the floor.

### 2. Matching

- **Graph:** members are nodes; an edge A → B exists when A can teach something B wants, at a fitting level and format, with overlapping availability.
- **Score per edge:** semantic similarity between the request and the skill (pgvector cosine) × level fit × time overlap × trust × recent activity.
- **Direct matches:** top results for one request, straight from SQL with a vector index.
- **Swap cycles:** a depth-limited search finds loops of 2–5 members, each counted once by starting from its smallest id; a greedy pass (an integer program later) picks the set of non-overlapping cycles with the highest total score. Runs nightly and on demand.
- **Why cycles matter:** in a cycle everyone teaches one hour and learns one hour, so the net cost is zero and a brand-new member with no balance can join one.
- **Group proposals:** when enough open requests share a skill and level, the matcher proposes a group class to a fitting teacher and opens a pool.
- **Acceptance:** a cycle or group proposal becomes bookings only when every member accepts within 48 hours; otherwise it expires and the matcher tries again.

### 3. Session escrow

Every booking follows one state machine (drawn below). Hours are held when the learner books, captured only after both confirmations, and released on every failure path. If one side confirms and the other stays silent for 48 hours, the session settles automatically.

&#91;embedded content: session escrow · 5 states, 5 exits\]

The top row is the only path that moves hours; every exit below it either releases the hold, applies a penalty, or goes to a steward vote.

### 4. Trust and reputation

| Level       | How it is reached                                             | What it unlocks                                  |
| ----------- | ------------------------------------------------------------- | ------------------------------------------------ |
| 0 — New     | Joining                                                       | Online sessions, up to 2 open bookings           |
| 1 — Active  | 3 confirmed sessions and a recovery method                    | Group classes, async reviews, more open bookings |
| 2 — Trusted | 10 confirmed sessions, rating at least 4.5, no upheld reports | In-person sessions and helping hands             |
| 3 — Steward | 30 sessions and a clean record                                | Serving on dispute panels                        |

- **Ratings:** a Bayesian average weighted by the number of distinct counterparts, so a few friends can't inflate a score.
- **Collusion checks:** a weekly cap on hours earned from the same counterpart; flags for tight rings of mutual top ratings; new accounts on the same device fingerprint can't confirm sessions with each other.
- **Disputes:** three stewards with no link to either side see the session evidence (chat, check-ins, notes) and vote within 72 hours: settle, refund, or split. Jurors earn 15 minutes from the community pool per case.

### 5. AI concierge

- **Read tools:** search skills, find matches, explain a match, draft an agenda, summarize a session, translate a message.
- **Proposal tools:** draft a request, a booking or a cycle acceptance. Proposals are only drafts; nothing executes until the member taps and their device signs.
- **Guardrails:** always identifies itself as an AI; enforces category rules (no legal, medical or financial advice); output moderation; per-member token budgets in Redis; every run logged in `ai_runs`.
- **Practice partner:** a role-play chat for practice-type skills, free and rate-limited, clearly labeled as AI.

## API and routes

**Pages read through server components, writes go through server actions, and only the few things outsiders need (audit, calendar, webhooks, AI streaming) are public HTTP endpoints.**

### Every write follows one path

1. Zod validates the input.
2. The session cookie resolves the member; sensitive actions also require a fresh device signature.
3. Upstash rate limit for that action and member.
4. The domain module runs inside one database transaction.
5. The same transaction writes an event to an `outbox` table.
6. A relay sends outbox events to Inngest (jobs) and Ably (live updates), so no event is lost if a send fails.

### Pages

| Route                                               | Purpose                                               |
| --------------------------------------------------- | ----------------------------------------------------- |
| `/`                                                 | Search bar, your next session, your balance           |
| `/explore`, `/explore/[category]`, `/skills/[slug]` | Browse categories and skills                          |
| `/u/[handle]`                                       | Member profile                                        |
| `/requests/new`, `/requests/[id]`                   | Post and track a learning request                     |
| `/match`                                            | Proposals: direct matches, swap cycles, group classes |
| `/book/[offerId]`                                   | Pick a time and confirm a booking                     |
| `/sessions`, `/sessions/[id]`                       | Upcoming and past sessions; room, check-in, confirm   |
| `/wallet`, `/wallet/[entryId]`                      | Balance, holds, history, receipts                     |
| `/pools/[id]`, `/circles/[id]`                      | Group pools and private circles                       |
| `/audit`                                            | Public ledger verification                            |
| `/settings`                                         | Profile, availability, recovery, privacy, plan        |
| `/admin/*`                                          | Moderation, disputes, categories, ledger health       |

### Server actions by module

- **identity:** createGuest, verifyChallenge, addRecoveryEmail, addPasskey, addDevice.
- **profile:** update, setSkills, setAvailability.
- **market:** createRequest, createOffer, closeRequest.
- **booking:** request, accept, decline, cancel, reschedule, checkIn, confirm.
- **matching:** acceptProposal, declineProposal.
- **groups:** createPool, contribute, createCircle, join.
- **wallet:** gift, donateToCommunity.
- **trust:** review, endorse, report, block, openDispute, castVote.

### Public endpoints

| Endpoint                                    | Purpose                                                      |
| ------------------------------------------- | ------------------------------------------------------------ |
| `GET /api/v1/ledger?after=<seq>`            | Paged ledger entries for the audit page and anyone verifying |
| `GET /api/v1/ledger/head`                   | Current head hash and sequence number                        |
| `GET /api/v1/skills`                        | Public skill taxonomy                                        |
| `POST /api/v1/ai/chat`                      | Streaming concierge chat                                     |
| `GET /api/v1/calendar/[token].ics`          | Private calendar feed                                        |
| `POST /api/webhooks/stripe`, `/api/inngest` | Payment and job webhooks, signature-checked                  |

### Background jobs

| Job                                      | Trigger                                 |
| ---------------------------------------- | --------------------------------------- |
| Session reminders                        | 24 hours and 1 hour before start        |
| Hold expiry                              | Request not accepted in time            |
| Auto-settle                              | One side confirmed, 48 hours of silence |
| Nightly matching                         | Daily, plus on demand                   |
| Proposal and pool expiry                 | 48-hour deadline                        |
| Dispute timeout                          | 72 hours without a majority             |
| Ledger reconciliation and head anchoring | Nightly                                 |
| Daily digest                             | Morning in the member's timezone        |
| Embedding refresh                        | Skill or request text changed           |

## UI system (laconic)

**Laconic here means: one primary action per screen, monochrome with a single accent, text before decoration, and nothing on screen that doesn't help the next decision.**

### Principles

1. **One job per screen.** Each screen has one filled button; everything else is secondary or a link.
2. **Numbers speak.** Balance, time and seats are shown large and plain; no badges, confetti or gamified streaks.
3. **Gray first, accent for intent.** The accent color marks only the primary action and the member's own hours.
4. **Words, not icons alone.** Icons always carry a text label.
5. **Calm motion.** 150 ms fades and slides only; no bouncing, no parallax.
6. **Mobile first.** Designed at 375 px, then widened; a four-tab bottom bar on mobile (Home, Explore, Sessions, Wallet), a slim left rail on desktop.

### Design tokens

| Token   | Value                                                                                               |
| ------- | --------------------------------------------------------------------------------------------------- |
| Color   | Neutral gray scale (50–950) + one accent; status colors only for errors and success; full dark mode |
| Type    | Inter (or Geist); sizes 13 / 15 / 17 / 22 / 32; two weights: 400 and 600                            |
| Spacing | 4-point grid; 16 page padding on mobile, 24 on desktop                                              |
| Shape   | 8 px radius; 1 px borders; no shadows except on menus and dialogs                                   |
| Layout  | Single column up to 640 px content width; two columns only on wide screens                          |
| Numbers | Tabular figures for hours, times and balances                                                       |

### Components

Button (primary, secondary, ghost), input, select, combobox, chip, card, list row, sheet (mobile) and dialog (desktop), tabs, calendar slot picker, avatar, toast, empty state, skeleton loader, hour amount, status pill, ledger row, review stars.

### Screens and their one primary action

| Screen                 | Shows                                       | Primary action         |
| ---------------------- | ------------------------------------------- | ---------------------- |
| Home                   | Search, next session, balance               | Search a skill         |
| Onboarding (3 steps)   | Teach, learn, availability                  | Continue               |
| Explore and skill page | Categories, teachers, group classes         | Request this skill     |
| Profile                | Skills, reviews, availability               | Book a session         |
| Match                  | Direct matches, cycles, group classes       | Accept proposal        |
| Booking                | Time slots in both timezones, cost in hours | Confirm and hold hours |
| Session room           | Video, notes, timer                         | End and confirm        |
| Confirm                | Summary, rating, short review               | Confirm session        |
| Wallet                 | Balance, holds, history                     | Gift hours             |
| Pool                   | Target, contributors, deadline              | Add my hours           |
| Audit                  | Head hash, verification progress            | Verify the ledger      |
| Concierge              | Chat with clearly labeled AI                | Approve proposal       |

### Microcopy rules

- Short verbs on buttons: "Book", "Confirm", "Add hours".
- Hours always written the same way: "1 h", "30 min".
- Every empty state says what to do next in one sentence.

## Security, privacy and compliance

**The private key never leaves the device, the ledger can't be edited even by the operator, and the platform collects only what a session needs.**

| Area              | Measure                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keys              | Device keys created as non-extractable WebCrypto keys and stored in IndexedDB; the server keeps only public keys                                        |
| Sessions          | HTTP-only, Secure, SameSite=Lax cookies; short life with rotation; CSRF protection built into server actions                                            |
| Sensitive actions | Confirming a session, gifting hours and voting require a fresh device signature over the exact payload                                                  |
| Ledger integrity  | Append-only trigger, hash chain, nightly public head-hash anchor, reconciliation alerts                                                                 |
| Database          | Least-privilege roles (the app role can't drop the trigger); encrypted email column; point-in-time recovery on Neon                                     |
| Input and output  | Zod on every input; React escaping; strict Content Security Policy; signed, size-limited upload URLs with file-type checks                              |
| Abuse             | Rate limits per action; bot checks on guest creation (Cloudflare Turnstile); device fingerprint limits on self-dealing                                  |
| Content safety    | Automatic moderation of profiles, messages and uploads; report and block; human review queue                                                            |
| In-person safety  | Trust level 2 required; public places by default; check-in; share-my-session link to a friend                                                           |
| Privacy           | No exact addresses stored for discovery (area cells only); data export and deletion; ledger rows of deleted members keep only a pseudonymous account id |
| AI                | AI identifies itself; no action without the member's signed approval; prompts and outputs logged without secrets                                        |
| Taxes             | Hours are never sold, bought or priced in dollars, keeping the platform a time bank; licensed professional services are excluded                        |
| Webhooks          | Stripe and Inngest signatures verified; idempotency keys on every handler                                                                               |

## Infrastructure, testing and delivery

**Everything runs on managed services with free tiers: Vercel for the app, Neon for Postgres, and hosted services for realtime, jobs, cache and files.**

### Environments

- **Preview:** every pull request gets a Vercel preview and its own Neon database branch with seed data.
- **Production:** one Vercel project, one Neon main branch, migrations run in CI before deploy.
- **Seed:** a deterministic script creates the category taxonomy and labeled sample members, so every environment and demo looks the same.

### Repository layout

```
app/            routes, pages, server actions
modules/
  identity/     keys, sessions, recovery
  ledger/       append, verify, reconcile
  matching/     scoring, cycles, proposals
  booking/      state machine, holds
  trust/        levels, reviews, disputes
  ai/           tools, prompts, guardrails
  groups/       pools, circles
db/             Drizzle schema, migrations, seed
jobs/           Inngest functions
ui/             design tokens, components
tests/          unit, property, e2e
```

### Testing

| Level                   | What it covers                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Unit (Vitest)           | State machine transitions, scoring, trust levels, category rules                                                 |
| Property (fast-check)   | Ledger invariants over thousands of random operation sequences; cycle finder never repeats a member or exceeds 5 |
| Integration             | Server actions against a real Neon branch                                                                        |
| End to end (Playwright) | Guest join → book → session → both confirm → balances move → audit verifies                                      |

### Observability

- Sentry for errors, with release tags.
- PostHog for funnels (join → first booking → first confirmed session) and feature flags.
- OpenTelemetry traces on server actions; pino structured logs.
- Alerts: ledger reconciliation mismatch, job failures, error-rate spikes.

### CI pipeline

Typecheck → Biome lint → unit and property tests → migration dry-run on a Neon branch → Playwright on the preview URL → deploy.

## Build scope

**The 24-hour MVP proves the three things judges test: no-login use, real hour movement with both-sided confirmation, and a ledger anyone can verify. Swap cycles are the headline novelty.**

| Module               | MVP (24 hours)                                              | Later                                                       |
| -------------------- | ----------------------------------------------------------- | ----------------------------------------------------------- |
| Identity             | Guest device key, session cookie                            | Magic link, passkeys, multi-device                          |
| Catalog              | Full taxonomy seeded, all categories browsable              | Member-proposed skills                                      |
| Discovery            | Search and filters, skill pages, profiles                   | Area map for in-person                                      |
| Matching             | Direct matches, swap cycles (2–5), "Match me"               | Group proposals, integer-program optimizer, waitlist alerts |
| Booking and sessions | Live 1:1 with Jitsi, holds, both-sided confirm, auto-settle | Group classes, in person, async review, reschedule          |
| Ledger               | Double-entry, hash chain, starter grant, audit page         | Nightly anchoring, reconciliation dashboard                 |
| Trust                | Reviews, trust level 0–1, report                            | Levels 2–3, disputes with jurors, collusion checks          |
| Groups               | —                                                           | Pools, circles, community pool                              |
| AI                   | Request parser and match explanation                        | Agenda, summaries, translation, practice partner            |
| Plans                | —                                                           | Plus subscription, organization circles                     |
| Admin                | Seed and reset script                                       | Moderation queue, dispute console                           |

### Demo path (3 minutes)

1. A judge opens the link: no sign-up, 2 starter hours already on the ledger.
2. They type "I want to learn guitar chords"; the concierge turns it into a request.
3. The match screen shows a 3-person swap cycle that includes them; they accept.
4. A session runs with a labeled sample member who confirms automatically; the judge confirms with a device signature; balances move.
5. The audit page recomputes the chain and verifies; a tampered copy fails.

## Open questions

- [ ] Confirm with a tax professional how the time-bank treatment applies to a for-profit platform with a paid subscription; the IRS private rulings concern informal, non-commercial programs and can't be relied on as precedent ([Community Currencies Law](https://www.communitycurrencieslaw.org/barter)).
- [ ] Group class rate: is 2× the length the right reward for teaching a group?
- [ ] Starter grant and overdraft floor sizes (2 hours and −2 hours) need testing against abuse.
- [ ] Whether in-person sessions need ID verification before launch outside the demo.
- [ ] Final product name ("SkillSwap" is generic and used by others).

## Sources

- [Community Currencies Law: barter exchange tax reporting](https://www.communitycurrencieslaw.org/barter)
- [Community Currencies Law: income tax and time banks](https://www.communitycurrencieslaw.org/income-tax)
