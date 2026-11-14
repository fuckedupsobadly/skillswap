import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

/** Every time value is stored as whole minutes (integers); every id is a UUID; every table has created_at. */
const id = () => uuid("id").primaryKey().defaultRandom();
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();
const emptyArray = sql`'{}'`;

export const EMBEDDING_DIMENSIONS = 1536;

// ── Enums ────────────────────────────────────────────────────────────────────
export const formatEnum = pgEnum("session_format", ["live", "group", "in_person", "async"]);
export const directionEnum = pgEnum("skill_direction", ["teach", "learn"]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "requested",
  "accepted",
  "live",
  "confirming",
  "settled",
  "declined",
  "expired",
  "cancelled",
  "no_show",
  "disputed",
]);
export const participantRoleEnum = pgEnum("participant_role", ["teacher", "learner"]);
export const accountOwnerEnum = pgEnum("account_owner", ["member", "pool", "community", "system"]);
export const entryKindEnum = pgEnum("entry_kind", [
  "grant",
  "hold",
  "release",
  "capture",
  "gift",
  "pool_contribution",
  "refund",
  "no_show_penalty",
  "correction",
]);
export const holdStatusEnum = pgEnum("hold_status", ["held", "released", "captured"]);
export const requestStatusEnum = pgEnum("request_status", ["open", "matched", "closed"]);
export const cycleStatusEnum = pgEnum("cycle_status", ["proposed", "booked", "declined", "expired"]);
export const reportStatusEnum = pgEnum("report_status", ["open", "upheld", "dismissed"]);
export const disputeStatusEnum = pgEnum("dispute_status", ["open", "settle", "refund", "split"]);

// ── Identity ─────────────────────────────────────────────────────────────────
export const members = pgTable("members", {
  id: id(),
  handle: text("handle").notNull().unique(),
  displayName: text("display_name").notNull(),
  bio: text("bio").notNull().default(""),
  timezone: text("timezone").notNull().default("UTC"),
  languages: text("languages").array().notNull().default(emptyArray),
  trustLevel: smallint("trust_level").notNull().default(0),
  /** AES-GCM ciphertext; optional, only needed for account recovery. */
  email: text("email"),
  emailVerifiedAt: ts("email_verified_at"),
  /** Seeded demo members are always labelled in the UI. */
  isSample: boolean("is_sample").notNull().default(false),
  onboardedAt: ts("onboarded_at"),
  lastActiveAt: ts("last_active_at").notNull().defaultNow(),
  deletedAt: ts("deleted_at"),
  createdAt: createdAt(),
});

export const devices = pgTable(
  "devices",
  {
    id: id(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    /** Base64 SPKI of an ECDSA P-256 public key. The private key never leaves the browser. */
    publicKey: text("public_key").notNull().unique(),
    fingerprint: text("fingerprint").notNull(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [index("devices_member_idx").on(t.memberId)],
);

/** Private keys for labelled sample members only, so their automatic confirmations are real signatures. */
export const botKeys = pgTable("bot_keys", {
  memberId: uuid("member_id")
    .primaryKey()
    .references(() => members.id),
  deviceId: uuid("device_id")
    .notNull()
    .references(() => devices.id),
  privateJwk: jsonb("private_jwk").notNull(),
  createdAt: createdAt(),
});

// ── Catalog ──────────────────────────────────────────────────────────────────
export type CategoryRules = {
  formats: ("live" | "group" | "in_person" | "async")[];
  minTrust: number;
  waiver?: boolean;
  levelTags?: boolean;
  screenShare?: boolean;
  notes?: string;
};

export const categories = pgTable("categories", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  parentId: uuid("parent_id"),
  position: smallint("position").notNull().default(0),
  rules: jsonb("rules").$type<CategoryRules>().notNull(),
  createdAt: createdAt(),
});

export const skills = pgTable(
  "skills",
  {
    id: id(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    keywords: text("keywords").notNull().default(""),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    createdAt: createdAt(),
  },
  (t) => [index("skills_category_idx").on(t.categoryId)],
);

// ── Profile ──────────────────────────────────────────────────────────────────
export const memberSkills = pgTable(
  "member_skills",
  {
    id: id(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id),
    direction: directionEnum("direction").notNull(),
    /** 1 beginner · 2 elementary · 3 intermediate · 4 advanced · 5 expert */
    level: smallint("level").notNull(),
    formats: formatEnum("formats").array().notNull().default(sql`'{live}'`),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("member_skills_unique").on(t.memberId, t.skillId, t.direction),
    index("member_skills_skill_idx").on(t.skillId, t.direction),
  ],
);

/** One weekly recurrence rule per row: weekday + minute range in the member's timezone. */
export const availability = pgTable(
  "availability",
  {
    id: id(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    weekday: smallint("weekday").notNull(), // 0 = Sunday
    startMin: smallint("start_min").notNull(),
    endMin: smallint("end_min").notNull(),
    timezone: text("timezone").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("availability_member_idx").on(t.memberId)],
);

// ── Market ───────────────────────────────────────────────────────────────────
export const requests = pgTable(
  "requests",
  {
    id: id(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id),
    level: smallint("level").notNull(),
    format: formatEnum("format").notNull().default("live"),
    lengthMin: smallint("length_min").notNull(),
    window: jsonb("window").$type<{ from?: string; to?: string } | null>(),
    text: text("text").notNull().default(""),
    /** How sure the parser was that `skill_id` is what the member meant (0–1). Feeds the match score. */
    confidence: real("confidence").notNull().default(1),
    parsedBy: text("parsed_by").$type<"ai" | "rules" | "form">().notNull().default("form"),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    status: requestStatusEnum("status").notNull().default("open"),
    createdAt: createdAt(),
  },
  (t) => [
    index("requests_skill_status_idx").on(t.skillId, t.status),
    index("requests_member_idx").on(t.memberId),
  ],
);

export const offers = pgTable(
  "offers",
  {
    id: id(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id),
    formats: formatEnum("formats").array().notNull().default(sql`'{live}'`),
    lengths: smallint("lengths").array().notNull().default(sql`'{30,60}'`),
    groupMax: smallint("group_max").notNull().default(1),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("offers_member_skill").on(t.memberId, t.skillId),
    index("offers_skill_idx").on(t.skillId),
  ],
);

// ── Sessions ─────────────────────────────────────────────────────────────────
export const swapCycles = pgTable("swap_cycles", {
  id: id(),
  /** Ordered: members[i] teaches members[i+1]; the last teaches the first. */
  members: uuid("members").array().notNull(),
  edges: jsonb("edges").$type<CycleEdgeRecord[]>().notNull(),
  score: real("score").notNull(),
  status: cycleStatusEnum("status").notNull().default("proposed"),
  acceptedBy: uuid("accepted_by").array().notNull().default(emptyArray),
  expiresAt: ts("expires_at").notNull(),
  createdAt: createdAt(),
});

export type CycleEdgeRecord = {
  teacherId: string;
  learnerId: string;
  skillId: string;
  offerId: string;
  requestId: string | null;
  lengthMin: number;
  startsAt: string;
  score: number;
  factors: Record<string, number>;
  /** Plain-language reasons computed from the real factors when the proposal was made. */
  reasons?: string[];
};

export const bookings = pgTable(
  "bookings",
  {
    id: id(),
    kind: formatEnum("kind").notNull().default("live"),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id),
    offerId: uuid("offer_id").references(() => offers.id),
    requestId: uuid("request_id").references(() => requests.id),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => members.id),
    startsAt: ts("starts_at").notNull(),
    lengthMin: smallint("length_min").notNull(),
    areaCell: text("area_cell"),
    roomUrl: text("room_url"),
    status: bookingStatusEnum("status").notNull().default("requested"),
    cycleId: uuid("cycle_id").references(() => swapCycles.id),
    poolId: uuid("pool_id"),
    notes: text("notes").notNull().default(""),
    startedAt: ts("started_at"),
    firstConfirmedAt: ts("first_confirmed_at"),
    settledAt: ts("settled_at"),
    closedBy: uuid("closed_by"),
    createdAt: createdAt(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("bookings_teacher_idx").on(t.teacherId), index("bookings_status_idx").on(t.status)],
);

export const bookingParticipants = pgTable(
  "booking_participants",
  {
    id: id(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    role: participantRoleEnum("role").notNull(),
    costMin: smallint("cost_min").notNull().default(0),
    confirmedAt: ts("confirmed_at"),
    /** Device-key signature (base64 P1363) over `signed_payload`. */
    signature: text("signature"),
    signedPayload: text("signed_payload"),
    signerKey: text("signer_key"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("booking_participants_unique").on(t.bookingId, t.memberId),
    index("booking_participants_member_idx").on(t.memberId),
  ],
);

// ── Ledger ───────────────────────────────────────────────────────────────────
export const accounts = pgTable(
  "accounts",
  {
    id: id(),
    ownerType: accountOwnerEnum("owner_type").notNull(),
    ownerId: uuid("owner_id").notNull(),
    label: text("label").notNull().default(""),
    /** Rebuilt by reconciliation; the ledger is the source of truth. */
    cachedBalanceMin: integer("cached_balance_min").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("accounts_owner_unique").on(t.ownerType, t.ownerId)],
);

/** Append-only. A trigger (migration 0002) rejects UPDATE and DELETE. */
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    seq: bigint("seq", { mode: "number" }).primaryKey(),
    id: uuid("id").notNull().unique(),
    kind: entryKindEnum("kind").notNull(),
    debitAccount: uuid("debit_account")
      .notNull()
      .references(() => accounts.id),
    creditAccount: uuid("credit_account")
      .notNull()
      .references(() => accounts.id),
    amountMin: integer("amount_min").notNull(),
    bookingId: uuid("booking_id"),
    memo: text("memo").notNull().default(""),
    prevHash: text("prev_hash").notNull(),
    hash: text("hash").notNull().unique(),
    signerKey: text("signer_key").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("ledger_debit_idx").on(t.debitAccount),
    index("ledger_credit_idx").on(t.creditAccount),
    index("ledger_booking_idx").on(t.bookingId),
  ],
);

export const holds = pgTable(
  "holds",
  {
    id: id(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id),
    amountMin: integer("amount_min").notNull(),
    status: holdStatusEnum("status").notNull().default("held"),
    expiresAt: ts("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("holds_booking_account").on(t.bookingId, t.accountId)],
);

// ── Trust ────────────────────────────────────────────────────────────────────
export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id),
    authorId: uuid("author_id")
      .notNull()
      .references(() => members.id),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => members.id),
    rating: smallint("rating").notNull(),
    text: text("text").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("reviews_one_per_side").on(t.bookingId, t.authorId),
    index("reviews_subject_idx").on(t.subjectId),
  ],
);

export const endorsements = pgTable(
  "endorsements",
  {
    id: id(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id),
    authorId: uuid("author_id")
      .notNull()
      .references(() => members.id),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => members.id),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("endorsements_unique").on(t.bookingId, t.authorId, t.skillId)],
);

export const disputes = pgTable("disputes", {
  id: id(),
  bookingId: uuid("booking_id")
    .notNull()
    .unique()
    .references(() => bookings.id),
  openedBy: uuid("opened_by")
    .notNull()
    .references(() => members.id),
  reason: text("reason").notNull(),
  status: disputeStatusEnum("status").notNull().default("open"),
  jurors: uuid("jurors").array().notNull().default(emptyArray),
  createdAt: createdAt(),
});

export const disputeVotes = pgTable(
  "dispute_votes",
  {
    id: id(),
    disputeId: uuid("dispute_id")
      .notNull()
      .references(() => disputes.id),
    jurorId: uuid("juror_id")
      .notNull()
      .references(() => members.id),
    decision: disputeStatusEnum("decision").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("dispute_votes_unique").on(t.disputeId, t.jurorId)],
);

export const reports = pgTable("reports", {
  id: id(),
  reporterId: uuid("reporter_id")
    .notNull()
    .references(() => members.id),
  subjectId: uuid("subject_id")
    .notNull()
    .references(() => members.id),
  bookingId: uuid("booking_id"),
  reason: text("reason").notNull(),
  status: reportStatusEnum("status").notNull().default("open"),
  createdAt: createdAt(),
});

export const blocks = pgTable(
  "blocks",
  {
    blockerId: uuid("blocker_id")
      .notNull()
      .references(() => members.id),
    blockedId: uuid("blocked_id")
      .notNull()
      .references(() => members.id),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] })],
);

// ── Messaging ────────────────────────────────────────────────────────────────
export const threads = pgTable(
  "threads",
  {
    id: id(),
    contextType: text("context_type").$type<"booking" | "request">().notNull(),
    contextId: uuid("context_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("threads_context_unique").on(t.contextType, t.contextId)],
);

export const messages = pgTable(
  "messages",
  {
    id: id(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => threads.id),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => members.id),
    body: text("body").notNull(),
    translation: text("translation"),
    createdAt: createdAt(),
  },
  (t) => [index("messages_thread_idx").on(t.threadId, t.createdAt)],
);

// ── AI ───────────────────────────────────────────────────────────────────────
export const aiRuns = pgTable("ai_runs", {
  id: id(),
  memberId: uuid("member_id").references(() => members.id),
  purpose: text("purpose").notNull(),
  engine: text("engine").$type<"ai" | "rules">().notNull(),
  model: text("model"),
  inputHash: text("input_hash").notNull(),
  output: jsonb("output"),
  tokens: integer("tokens").notNull().default(0),
  proposedAction: jsonb("proposed_action"),
  approvedAt: ts("approved_at"),
  createdAt: createdAt(),
});

// ── Ops ──────────────────────────────────────────────────────────────────────
export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    kind: text("kind").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_member_idx").on(t.memberId, t.createdAt)],
);

/** Transactional outbox: written in the same transaction as the change, relayed to jobs and live updates after commit. */
export const outbox = pgTable(
  "outbox",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    topic: text("topic").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    attempts: smallint("attempts").notNull().default(0),
    /** Exponential backoff: a failing event waits 2^attempts seconds and never blocks the ones behind it. */
    nextAttemptAt: ts("next_attempt_at").notNull().defaultNow(),
    deliveredAt: ts("delivered_at"),
    lastError: text("last_error"),
    createdAt: createdAt(),
  },
  (t) => [index("outbox_pending_idx").on(t.id).where(sql`delivered_at IS NULL`)],
);

// ── Gamification ─────────────────────────────────────────────────────────────
// Its own module: it listens to domain events and never reads or writes the hour ledger.

export type GameSettings = {
  showKitty: boolean;
  roam: boolean;
  sounds: boolean;
  notices: boolean;
  showRank: boolean;
};
export const DEFAULT_GAME_SETTINGS: GameSettings = {
  showKitty: true,
  roam: true,
  sounds: false,
  notices: true,
  showRank: true,
};

export const kitties = pgTable("kitties", {
  memberId: uuid("member_id")
    .primaryKey()
    .references(() => members.id),
  /** Visible genes only; the unique index guarantees one-of-a-kind kitties. */
  genomeCode: text("genome_code").notNull().unique(),
  name: text("name").notNull(),
  personality: jsonb("personality")
    .$type<{ playful: number; sleepy: number; curious: number; affectionate: number; sassy: number }>()
    .notNull(),
  stage: text("stage").$type<"kitten" | "young" | "adult">().notNull().default("kitten"),
  roomTheme: text("room_theme").$type<"cozy" | "twilight">().notNull().default("cozy"),
  createdAt: createdAt(),
});

export const kittyNeeds = pgTable("kitty_needs", {
  memberId: uuid("member_id")
    .primaryKey()
    .references(() => members.id),
  hunger: real("hunger").notNull(),
  energy: real("energy").notNull(),
  play: real("play").notNull(),
  affection: real("affection").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/** Append-only. Unique on (member, source event), so a retried event never counts twice. */
export const xpEvents = pgTable(
  "xp_events",
  {
    id: id(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    sourceEventId: text("source_event_id").notNull(),
    source: text("source").notNull(),
    amount: integer("amount").notNull(),
    /** The asked-for amount before caps, kept so tuning can see what the caps cut. */
    requested: integer("requested").notNull(),
    counterpartId: uuid("counterpart_id"),
    bookingId: uuid("booking_id"),
    reversesId: uuid("reverses_id"),
    occurredAt: ts("occurred_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("xp_events_source_unique").on(t.memberId, t.sourceEventId),
    index("xp_events_member_time").on(t.memberId, t.occurredAt),
  ],
);

/** Rebuildable from xp_events. Rank never drops. */
export const memberProgress = pgTable("member_progress", {
  memberId: uuid("member_id")
    .primaryKey()
    .references(() => members.id),
  xpTotal: integer("xp_total").notNull().default(0),
  level: smallint("level").notNull().default(1),
  rank: text("rank").notNull().default("kitten"),
  rankReachedAt: ts("rank_reached_at").notNull().defaultNow(),
  treats: integer("treats").notNull().default(0),
  slowBlinks: integer("slow_blinks").notNull().default(0),
  settings: jsonb("settings").$type<GameSettings>().notNull().default(DEFAULT_GAME_SETTINGS),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/** The catalogue is data: adding an item is a row, never new code. */
export const items = pgTable("items", {
  id: text("id").primaryKey(),
  slot: text("slot").notNull(),
  name: text("name").notNull(),
  unlockRule: jsonb("unlock_rule").notNull(),
  rarity: text("rarity").notNull(),
  animated: boolean("animated").notNull().default(false),
  sprites: jsonb("sprites").$type<{ art: string }>().notNull(),
  createdAt: createdAt(),
});

export const memberItems = pgTable(
  "member_items",
  {
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id),
    unlockedAt: ts("unlocked_at").notNull().defaultNow(),
    sourceEventId: text("source_event_id"),
  },
  (t) => [primaryKey({ columns: [t.memberId, t.itemId] })],
);

export const equipped = pgTable(
  "equipped",
  {
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    slot: text("slot").notNull(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id),
  },
  (t) => [primaryKey({ columns: [t.memberId, t.slot] })],
);

export const achievements = pgTable("achievements", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  rule: jsonb("rule").notNull(),
  itemId: text("item_id").references(() => items.id),
  createdAt: createdAt(),
});

export const memberAchievements = pgTable(
  "member_achievements",
  {
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    achievementId: text("achievement_id")
      .notNull()
      .references(() => achievements.id),
    earnedAt: ts("earned_at").notNull().defaultNow(),
    sourceEventId: text("source_event_id"),
  },
  (t) => [primaryKey({ columns: [t.memberId, t.achievementId] })],
);

/** Seasonal sets recur every year (months), so nobody misses one forever. */
export const seasons = pgTable("seasons", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  months: smallint("months").array().notNull(),
  itemIds: text("item_ids").array().notNull(),
});

/** Distinct skill pages a member has opened (Explorer badge). */
export const skillVisits = pgTable(
  "skill_visits",
  {
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id),
    visitedAt: ts("visited_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.memberId, t.skillId] })],
);

// ── Village ─────────────────────────────────────────────────────────────────

export type VillagerLook = {
  body: number; // 3 builds
  skin: number; // 8 tones
  hair: number; // 16 styles
  hairColor: number; // 10 colours
  eyes: number; // 6 styles
  brows: number; // 4
  top: number; // 12
  topColor: number;
  bottom: number; // 8
  bottomColor: number;
  shoes: number; // 6
  accessory: "none" | "glasses" | "scarf" | "hat" | "bag";
};
export type HutLook = { roof: 0 | 1 | 2; door: number; garden: number; sign: number };

/** Free now / Busy / Away is chosen by the member; AFK and "in a session" are automatic (§4). */
export const presenceEnum = pgEnum("presence_status", ["free", "busy", "away"]);

export const villagers = pgTable("villagers", {
  memberId: uuid("member_id")
    .primaryKey()
    .references(() => members.id),
  look: jsonb("look").$type<VillagerLook>().notNull(),
  hut: jsonb("hut").$type<HutLook>().notNull(),
  status: presenceEnum("status").notNull().default("busy"),
  /** The member's own line, quoted in their dialogue box. Empty = no quote. */
  statusLine: text("status_line").notNull().default(""),
  /** Privacy: show only my hut, never my position. */
  hideMe: boolean("hide_me").notNull().default(false),
  plainMode: boolean("plain_mode").notNull().default(false),
  onboardingStep: smallint("onboarding_step").notNull().default(1),
  /** Last activity anywhere in the product; idle over 10 minutes = AFK. */
  lastInputAt: ts("last_input_at").notNull().defaultNow(),
  lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
  createdAt: createdAt(),
});

/** The mailbox: notes left at someone's hut. */
export const notes = pgTable(
  "notes",
  {
    id: id(),
    fromId: uuid("from_id").references(() => members.id),
    toId: uuid("to_id")
      .notNull()
      .references(() => members.id),
    /** System notes (a wish found a match) carry a kind and no sender. */
    kind: text("kind").$type<"note" | "match" | "booking">().notNull().default("note"),
    body: text("body").notNull(),
    link: text("link"),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notes_to_idx").on(t.toId, t.createdAt)],
);

/** Anonymous walk counts per tile per ISO week; nobody's route is stored, only totals. */
export const walkCounts = pgTable(
  "walk_counts",
  {
    week: text("week").notNull(),
    x: smallint("x").notNull(),
    y: smallint("y").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.week, t.x, t.y] })],
);

/** Worn paths, recomputed weekly from walk counts: 1 light wear … 3 a real dirt path. */
export const wornTiles = pgTable(
  "worn_tiles",
  {
    x: smallint("x").notNull(),
    y: smallint("y").notNull(),
    level: smallint("level").notNull(),
    computedAt: ts("computed_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.x, t.y] })],
);
