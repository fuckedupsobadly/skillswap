import { and, eq, isNull, sql } from "drizzle-orm";
import type { DB, Q } from "@/db/client";
import { rows } from "@/db/client";
import {
  type HutLook,
  members,
  notes,
  type VillagerLook,
  villagers,
  walkCounts,
  wornTiles,
} from "@/db/schema";
import { bookableSlots } from "@/modules/booking/service";
import { kittyFor } from "@/modules/game/service";
import { communityAccount, memberAccount, post, walletSummary } from "@/modules/ledger/service";
import { DomainError } from "@/modules/platform/errors";
import { bayesianRating } from "@/modules/trust/reputation";
import { lookFromSeed } from "./art/people";
import { categoryColor, categoryIcon, guildForCategory } from "./guilds";
import { PLOTS } from "./map";

/**
 * Presence (§4). Status is chosen by the member (Free now / Busy / Away); AFK after 10 minutes idle and
 * "In a session" from bookings are automatic. Nothing else is inferred.
 */
export type Presence = "free" | "busy" | "session" | "afk" | "away" | "offline";
export const PRESENCE_LABEL: Record<Presence, string> = {
  free: "Free now",
  busy: "Busy",
  session: "In a lesson",
  afk: "AFK",
  away: "Away",
  offline: "Offline",
};
export const ONLINE_MS = 2 * 60_000;
export const AFK_MS = 10 * 60_000;

export const DEFAULT_HUT = (seed: string): HutLook => {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  const r = (n: number, k: number) => Math.abs((h >> k) % n);
  return { roof: r(3, 1) as 0 | 1 | 2, door: r(6, 3), garden: r(6, 5), sign: r(3, 7) };
};

export async function ensureVillager(q: Q, memberId: string) {
  const [v] = await q.select().from(villagers).where(eq(villagers.memberId, memberId));
  if (v) return v;
  const [m] = await q.select({ isSample: members.isSample }).from(members).where(eq(members.id, memberId));
  const [created] = await q
    .insert(villagers)
    .values({
      memberId,
      look: lookFromSeed(memberId),
      hut: DEFAULT_HUT(memberId),
      status: m?.isSample ? sampleStatus(memberId) : "busy",
      onboardingStep: m?.isSample ? 99 : 1,
    })
    .onConflictDoNothing()
    .returning();
  return created ?? (await q.select().from(villagers).where(eq(villagers.memberId, memberId)))[0];
}

/**
 * Sample members are automated and accept any booking, so any of them *could* light the lantern. A village
 * where every lantern is lit says nothing, so each sample keeps a fixed, labelled status instead: about a
 * third free now, the rest busy or away (§3.4 — a quiet village gets quieter, never fuller with fakes).
 */
export function sampleStatus(memberId: string): "free" | "busy" | "away" {
  let h = 0;
  for (const ch of memberId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const r = h % 10;
  return r < 3 ? "free" : r < 7 ? "busy" : "away";
}

/** Every member gets a villager row lazily; sample members at startup. */
export async function ensureSampleVillagers(db: DB) {
  const missing = rows<{ id: string }>(
    await db.execute(
      sql`select m.id from members m left join villagers v on v.member_id = m.id where v.member_id is null and m.deleted_at is null`,
    ),
  );
  for (const m of missing) await ensureVillager(db, m.id);
  const samples = rows<{ id: string; status: "free" | "busy" | "away" }>(
    await db.execute(sql`select m.id, v.status from members m join villagers v on v.member_id = m.id where m.is_sample`),
  );
  for (const m of samples) {
    const want = sampleStatus(m.id);
    if (m.status !== want) await db.update(villagers).set({ status: want }).where(eq(villagers.memberId, m.id));
  }
}

export function presenceOf(
  v: { status: "free" | "busy" | "away"; lastSeenAt: Date; lastInputAt: Date },
  opts: { isSample: boolean; inSessionUntil: Date | null; now?: Date },
): Presence {
  const now = (opts.now ?? new Date()).getTime();
  if (opts.inSessionUntil) return "session";
  if (opts.isSample) return v.status === "away" ? "away" : v.status;
  if (v.status === "away") return "away";
  if (now - v.lastSeenAt.getTime() > ONLINE_MS) return "offline";
  if (now - v.lastInputAt.getTime() > AFK_MS) return "afk";
  return v.status;
}

export async function touch(q: Q, memberId: string, input: boolean) {
  const now = new Date();
  await ensureVillager(q, memberId);
  await q
    .update(villagers)
    .set(input ? { lastSeenAt: now, lastInputAt: now } : { lastSeenAt: now })
    .where(eq(villagers.memberId, memberId));
}

export async function setStatus(
  q: Q,
  memberId: string,
  status: "free" | "busy" | "away",
  statusLine?: string,
) {
  await ensureVillager(q, memberId);
  const patch: Partial<typeof villagers.$inferInsert> = {
    status,
    lastInputAt: new Date(),
    lastSeenAt: new Date(),
  };
  if (statusLine !== undefined) patch.statusLine = statusLine.trim().slice(0, 80);
  await q.update(villagers).set(patch).where(eq(villagers.memberId, memberId));
}

export const saveLook = (q: Q, memberId: string, look: VillagerLook) =>
  q.update(villagers).set({ look }).where(eq(villagers.memberId, memberId));
export const saveHut = (q: Q, memberId: string, hut: HutLook) =>
  q.update(villagers).set({ hut }).where(eq(villagers.memberId, memberId));

// ── Huts and members ───────────────────────────────────────────────────────

export type HutView = {
  memberId: string;
  handle: string;
  name: string;
  isSample: boolean;
  isYou: boolean;
  plot: number;
  presence: Presence;
  presenceLabel: string;
  backAt: string | null;
  statusLine: string;
  roof: string;
  hut: HutLook;
  look: VillagerLook;
  teaches: string[];
  category: string | null;
  kitty: string | null;
  hideMe: boolean;
};

/**
 * Up to ~one hut per plot. Huts are chosen per viewer (§3.4): your own hut first, then people who teach
 * what you want to learn, free people, then everyone else — nearest plots to the square go first.
 */
export async function hutsFor(q: Q, viewerId: string, now = new Date()) {
  const list = rows<{
    id: string;
    handle: string;
    name: string;
    isSample: boolean;
    status: "free" | "busy" | "away";
    statusLine: string;
    lastSeenAt: Date;
    lastInputAt: Date;
    hut: HutLook;
    look: VillagerLook;
    hideMe: boolean;
    teaches: string[] | null;
    categories: string[] | null;
    relevant: boolean;
    sessionUntil: Date | null;
    kitty: string | null;
  }>(
    await q.execute(sql`
      select m.id, m.handle, m.display_name as name, m.is_sample as "isSample",
        v.status, v.status_line as "statusLine", v.last_seen_at as "lastSeenAt", v.last_input_at as "lastInputAt",
        v.hut, v.look, v.hide_me as "hideMe",
        (select array_agg(s.name order by s.name) from member_skills ms join skills s on s.id = ms.skill_id
          where ms.member_id = m.id and ms.direction = 'teach') as teaches,
        (select array_agg(c.slug) from member_skills ms join skills s on s.id = ms.skill_id join categories c on c.id = s.category_id
          where ms.member_id = m.id and ms.direction = 'teach') as categories,
        exists (select 1 from member_skills t join member_skills w on w.skill_id = t.skill_id
          where t.member_id = m.id and t.direction = 'teach' and w.member_id = ${viewerId} and w.direction = 'learn') as relevant,
        (select b.started_at + b.length_min * interval '1 minute' from bookings b join booking_participants bp on bp.booking_id = b.id
          where bp.member_id = m.id and b.status = 'live' limit 1) as "sessionUntil",
        (select genome_code from kitties k where k.member_id = m.id) as kitty
      from members m join villagers v on v.member_id = m.id
      where m.deleted_at is null`),
  );
  const scored = list.map((m) => {
    const presence = presenceOf(
      { status: m.status, lastSeenAt: new Date(m.lastSeenAt), lastInputAt: new Date(m.lastInputAt) },
      { isSample: m.isSample, inSessionUntil: m.sessionUntil ? new Date(m.sessionUntil) : null, now },
    );
    const you = m.id === viewerId;
    const score =
      (you ? 1000 : 0) +
      (m.relevant ? 100 : 0) +
      (presence === "free" ? 20 : presence === "busy" || presence === "afk" ? 10 : 0) +
      (m.isSample ? 0 : 5);
    return { m, presence, score };
  });
  scored.sort((a, b) => b.score - a.score || a.m.handle.localeCompare(b.m.handle));
  const huts: HutView[] = scored.slice(0, PLOTS.length).map(({ m, presence }, i) => {
    // Your own hut takes plot 0's side; mirror it so relevant people live on "your side" of the lanes.
    const category = m.categories?.[0] ?? null;
    return {
      memberId: m.id,
      handle: m.handle,
      name: m.name,
      isSample: m.isSample,
      isYou: m.id === viewerId,
      plot: PLOTS[i].id,
      presence,
      presenceLabel: PRESENCE_LABEL[presence],
      backAt: m.sessionUntil ? new Date(m.sessionUntil).toISOString() : null,
      statusLine: m.statusLine,
      roof: category ? categoryColor(category) : "#b7a28c",
      hut: m.hut,
      look: m.look,
      teaches: m.teaches ?? [],
      category,
      kitty: m.kitty,
      hideMe: m.hideMe,
    };
  });
  return huts;
}

/** Everything a dialogue box or hut sign needs for one member. */
export async function memberCard(q: Q, viewerId: string, handle: string, now = new Date()) {
  const [m] = await q
    .select()
    .from(members)
    .where(and(eq(members.handle, handle), isNull(members.deletedAt)));
  if (!m) return null;
  const v = await ensureVillager(q, m.id);
  const skillRows = rows<{
    name: string;
    slug: string;
    direction: "teach" | "learn";
    level: number;
    offerId: string | null;
    lengths: number[] | null;
    category: string;
  }>(
    await q.execute(sql`select s.name, s.slug, ms.direction, ms.level, o.id as "offerId", o.lengths, c.slug as category
      from member_skills ms join skills s on s.id = ms.skill_id join categories c on c.id = s.category_id
      left join offers o on o.member_id = ms.member_id and o.skill_id = ms.skill_id and o.active
      where ms.member_id = ${m.id} order by s.name`),
  );
  const revs = rows<{ authorId: string; rating: number }>(
    await q.execute(sql`select author_id as "authorId", rating from reviews where subject_id = ${m.id}`),
  );
  const live = rows<{ until: Date }>(
    await q.execute(sql`select b.started_at + b.length_min * interval '1 minute' as until from bookings b join booking_participants bp on bp.booking_id = b.id
      where bp.member_id = ${m.id} and b.status = 'live' limit 1`),
  )[0];
  const presence = presenceOf(v, {
    isSample: m.isSample,
    inSessionUntil: live ? new Date(live.until) : null,
    now,
  });
  const teach = skillRows.filter((s) => s.direction === "teach");
  const firstOffer = teach.find((s) => s.offerId);
  const slots =
    firstOffer && viewerId !== m.id ? (await bookableSlots(q, m.id, viewerId, 30, { now })).slice(0, 12) : [];
  // "Next free": the first slot on three different days.
  const nextFree: string[] = [];
  const days = new Set<string>();
  for (const s of slots) {
    const d = s.toISOString().slice(0, 10);
    if (days.has(d) && nextFree.length) continue;
    days.add(d);
    nextFree.push(s.toISOString());
    if (nextFree.length === 3) break;
  }
  const kitty = await kittyFor(q, m.id);
  return {
    memberId: m.id,
    handle: m.handle,
    name: m.displayName,
    isSample: m.isSample,
    isYou: m.id === viewerId,
    trustLevel: m.trustLevel,
    timezone: m.timezone,
    presence,
    presenceLabel: PRESENCE_LABEL[presence],
    backAt: live ? new Date(live.until).toISOString() : null,
    statusLine: v.statusLine,
    look: v.look,
    rating: bayesianRating(revs),
    reviews: revs.length,
    teaches: teach.map((s) => ({
      name: s.name,
      slug: s.slug,
      level: s.level,
      offerId: s.offerId,
      lengths: s.lengths ?? [60],
      color: categoryColor(s.category),
      icon: categoryIcon(s.category),
      guild: guildForCategory(s.category)?.name ?? "Market Row",
    })),
    learning: skillRows.filter((s) => s.direction === "learn").map((s) => s.name),
    nextFree,
    kitty: kitty
      ? { name: kitty.name, code: kitty.code, stage: kitty.stage, equipped: kitty.equipped }
      : null,
  };
}
export type MemberCard = NonNullable<Awaited<ReturnType<typeof memberCard>>>;

// ── Activity traces (§3.4): each one is a real event from the last 24 h ──

export async function traces(q: Q) {
  const r = rows<{ wishes: number; notes: number }>(
    await q.execute(sql`select
      (select count(*)::int from requests where created_at > now() - interval '24 hours') as wishes,
      (select count(*)::int from requests where status = 'open' and created_at > now() - interval '24 hours') as notes`),
  )[0];
  const live = rows<{ category: string }>(
    await q.execute(
      sql`select c.slug as category from bookings b join skills s on s.id = b.skill_id join categories c on c.id = s.category_id where b.status = 'live'`,
    ),
  );
  const chimneys = [
    ...new Set(live.map((l) => guildForCategory(l.category)?.id).filter(Boolean)),
  ] as string[];
  return { wishes: r.wishes, notes: r.notes, chimneys, liveRooms: Math.min(4, live.length) };
}

// ── Worn paths (§3.4): anonymous walk counts, recomputed weekly ──

export const isoWeek = (d = new Date()) => {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / 86_400_000 + 1) / 7);
  return `${y}-W${String(w).padStart(2, "0")}`;
};

/** Add anonymous tile counts (no member id is stored). */
export async function recordWalks(q: Q, counts: [number, number, number][]) {
  const week = isoWeek();
  for (const [x, y, n] of counts.slice(0, 400)) {
    if (x < 0 || y < 0 || x > 200 || y > 200 || n <= 0) continue;
    await q
      .insert(walkCounts)
      .values({ week, x, y, count: Math.min(n, 50) })
      .onConflictDoUpdate({
        target: [walkCounts.week, walkCounts.x, walkCounts.y],
        set: { count: sql`${walkCounts.count} + ${Math.min(n, 50)}` },
      });
  }
}

/** Weekly: the last 4 weeks of walking become wear levels 1–3, relative to the busiest tile. */
export async function computeWear(db: DB) {
  const counts = rows<{ x: number; y: number; n: number }>(
    await db.execute(
      sql`select x, y, sum(count)::int as n from walk_counts group by x, y order by n desc limit 2000`,
    ),
  );
  const max = counts[0]?.n ?? 0;
  await db.transaction(async (tx) => {
    await tx.delete(wornTiles);
    if (max < 20) return;
    const rowsOut = counts
      .map((c) => ({
        x: c.x,
        y: c.y,
        level: c.n > max * 0.5 ? 3 : c.n > max * 0.2 ? 2 : c.n > max * 0.06 ? 1 : 0,
      }))
      .filter((c) => c.level > 0);
    for (let i = 0; i < rowsOut.length; i += 200)
      await tx.insert(wornTiles).values(rowsOut.slice(i, i + 200));
  });
}

// ── The mailbox ───────────────────────────────────────────────────────────

export async function leaveNote(
  q: Q,
  fromId: string | null,
  toHandleOrId: string,
  body: string,
  opts: { kind?: "note" | "match" | "booking"; link?: string } = {},
) {
  const text = body.trim();
  if (!text) throw new DomainError("invalid", "Write something first.");
  if (text.length > 500) throw new DomainError("invalid", "Notes are 500 characters at most.");
  const [to] = await q
    .select({ id: members.id })
    .from(members)
    .where(sql`${members.handle} = ${toHandleOrId} or ${members.id}::text = ${toHandleOrId}`);
  if (!to) throw new DomainError("not_found", "No member with that name.");
  if (to.id === fromId) throw new DomainError("invalid", "That's your own mailbox.");
  const [n] = await q
    .insert(notes)
    .values({ fromId, toId: to.id, body: text, kind: opts.kind ?? "note", link: opts.link ?? null })
    .returning({ id: notes.id });
  return n.id;
}

export async function inbox(q: Q, memberId: string) {
  return rows<{
    id: string;
    kind: string;
    body: string;
    link: string | null;
    readAt: Date | null;
    createdAt: Date;
    fromName: string | null;
    fromHandle: string | null;
    toName: string;
    mine: boolean;
  }>(
    await q.execute(sql`select n.id, n.kind, n.body, n.link, n.read_at as "readAt", n.created_at as "createdAt",
        f.display_name as "fromName", f.handle as "fromHandle", t.display_name as "toName", (n.from_id = ${memberId}) as mine
      from notes n left join members f on f.id = n.from_id join members t on t.id = n.to_id
      where n.to_id = ${memberId} or n.from_id = ${memberId}
      order by n.created_at desc limit 100`),
  );
}

export async function unreadCount(q: Q, memberId: string) {
  return rows<{ n: number }>(
    await q.execute(sql`select count(*)::int as n from notes where to_id = ${memberId} and read_at is null`),
  )[0].n;
}

export async function markRead(q: Q, memberId: string) {
  await q
    .update(notes)
    .set({ readAt: new Date() })
    .where(and(eq(notes.toId, memberId), isNull(notes.readAt)));
}

// ── Community Pond: the hours pool ─────────────────────────────────────────

export const POOL_MAX_BALANCE = 60; // you can ask the pool when you have under 1 h
export const POOL_GRANT = 60;
export const POOL_EVERY_DAYS = 30;

export async function poolStatus(q: Q, memberId: string) {
  const community = await communityAccount(q);
  const [pool] = rows<{ b: number }>(
    await q.execute(sql`select cached_balance_min as b from accounts where id = ${community}`),
  );
  const mine = await memberAccount(q, memberId);
  const last = rows<{ at: Date }>(
    await q.execute(
      sql`select created_at as at from ledger_entries where debit_account = ${community} and credit_account = ${mine} order by seq desc limit 1`,
    ),
  )[0];
  const wallet = await walletSummary(q, memberId);
  const nextAt = last ? new Date(new Date(last.at).getTime() + POOL_EVERY_DAYS * 86_400_000) : null;
  const eligible =
    wallet.balanceMin < POOL_MAX_BALANCE && (!nextAt || nextAt <= new Date()) && (pool?.b ?? 0) >= POOL_GRANT;
  const donors = rows<{ n: number; min: number }>(
    await q.execute(
      sql`select count(distinct debit_account)::int as n, coalesce(sum(amount_min),0)::int as min from ledger_entries where credit_account = ${community} and kind = 'gift'`,
    ),
  )[0];
  return {
    poolMin: pool?.b ?? 0,
    balanceMin: wallet.balanceMin,
    eligible,
    nextAt: nextAt?.toISOString() ?? null,
    donors: donors.n,
    donatedMin: donors.min,
  };
}

/** Ask the pool for 1 h: only under 1 h of balance, once per 30 days, and only what the pool holds. */
export async function requestFromPool(db: DB, memberId: string) {
  return db.transaction(async (tx) => {
    const s = await poolStatus(tx, memberId);
    if (s.balanceMin >= POOL_MAX_BALANCE)
      throw new DomainError("policy", "The pool is for members with under 1 h.");
    if (s.nextAt && new Date(s.nextAt) > new Date())
      throw new DomainError("policy", "You can ask the pool once every 30 days.");
    if (s.poolMin < POOL_GRANT)
      throw new DomainError("policy", "The pool is empty right now. Gifts refill it.");
    const [from, to] = await Promise.all([communityAccount(tx), memberAccount(tx, memberId)]);
    await post(tx, [
      {
        kind: "gift",
        debit: from,
        credit: to,
        amountMin: POOL_GRANT,
        memo: "From the community pool",
        signerKey: "system",
      },
    ]);
  });
}

/** Teachers of one skill whose lantern is lit right now — what the Well points at after a wish (§8.1). */
export async function litLanternsFor(q: Q, skillId: string, viewerId: string, now = new Date()) {
  const list = rows<{
    handle: string;
    name: string;
    isSample: boolean;
    status: "free" | "busy" | "away";
    lastSeenAt: Date;
    lastInputAt: Date;
    live: boolean;
  }>(
    await q.execute(sql`select m.handle, m.display_name as name, m.is_sample as "isSample", v.status, v.last_seen_at as "lastSeenAt", v.last_input_at as "lastInputAt",
        exists (select 1 from bookings b join booking_participants bp on bp.booking_id = b.id where bp.member_id = m.id and b.status = 'live') as live
      from offers o join members m on m.id = o.member_id join villagers v on v.member_id = m.id
      where o.skill_id = ${skillId} and o.active and m.deleted_at is null and m.id <> ${viewerId}`),
  );
  return list
    .filter(
      (m) =>
        presenceOf(
          { status: m.status, lastSeenAt: new Date(m.lastSeenAt), lastInputAt: new Date(m.lastInputAt) },
          { isSample: m.isSample, inSessionUntil: m.live ? new Date(now.getTime() + 60_000) : null, now },
        ) === "free",
    )
    .slice(0, 3)
    .map((m) => ({ handle: m.handle, name: m.name.split(" ")[0], isSample: m.isSample }));
}
