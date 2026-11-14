import { eq, sql } from "drizzle-orm";
import type { DB } from "./client";
import { rows } from "./client";
import { categories, members, offers, requests, skills } from "./schema";
import { TAXONOMY } from "./taxonomy";

/**
 * Deterministic seed: the full category taxonomy, plus labelled sample members whose history is created by
 * running real sessions through the real services — so every hour in the seeded ledger was actually earned,
 * held, confirmed by two signatures and captured. Nothing is written to the ledger directly.
 */

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PEOPLE: [name: string, tz: string, langs: string[]][] = [
  ["Aigerim Sadykova", "Asia/Almaty", ["Kazakh", "Russian", "English"]],
  ["Marcus Feldman", "Europe/Berlin", ["German", "English"]],
  ["Priya Raman", "Asia/Kolkata", ["English", "Tamil", "Hindi"]],
  ["Lucía Moreno", "Europe/Madrid", ["Spanish", "English"]],
  ["Kenji Watanabe", "Asia/Tokyo", ["Japanese", "English"]],
  ["Amara Okafor", "Africa/Lagos", ["English", "Igbo"]],
  ["Tomás Ribeiro", "America/Sao_Paulo", ["Portuguese", "Spanish", "English"]],
  ["Hannah Lindqvist", "Europe/Stockholm", ["Swedish", "English"]],
  ["Daniyar Bekov", "Asia/Almaty", ["Kazakh", "Russian", "English"]],
  ["Sofia Rossi", "Europe/Rome", ["Italian", "English", "French"]],
  ["Wei Chen", "Asia/Shanghai", ["Mandarin", "English"]],
  ["Grace Mensah", "Europe/London", ["English", "Twi"]],
  ["Omar Haddad", "Asia/Dubai", ["Arabic", "English", "French"]],
  ["Elena Petrova", "Europe/Belgrade", ["Russian", "Serbian", "English"]],
  ["Jamal Carter", "America/New_York", ["English"]],
  ["Mei Lin Tan", "Asia/Singapore", ["English", "Mandarin", "Malay"]],
  ["Ana Kovač", "Europe/Zagreb", ["Croatian", "English"]],
  ["Ravi Shah", "Europe/London", ["English", "Gujarati"]],
  ["Chloé Martin", "Europe/Paris", ["French", "English"]],
  ["Diego Alvarez", "America/Mexico_City", ["Spanish", "English"]],
  ["Yuki Tanaka", "Asia/Tokyo", ["Japanese", "English"]],
  ["Leila Karimi", "Europe/Berlin", ["Persian", "German", "English"]],
  ["Noah Williams", "America/Los_Angeles", ["English", "ASL"]],
  ["Zarina Nurlanovna", "Asia/Almaty", ["Kazakh", "English"]],
  ["Felix Wagner", "Europe/Vienna", ["German", "English"]],
  ["Isabela Costa", "America/Sao_Paulo", ["Portuguese", "English"]],
  ["Arjun Mehta", "Asia/Kolkata", ["Hindi", "English"]],
  ["Olivia Brown", "Australia/Sydney", ["English"]],
  ["Samir Benali", "Europe/Paris", ["French", "Arabic", "English"]],
  ["Ingrid Hansen", "Europe/Oslo", ["Norwegian", "English"]],
  ["Kwame Asante", "Africa/Accra", ["English", "Twi"]],
  ["Nadia Volkova", "Asia/Almaty", ["Russian", "Kazakh", "English"]],
  ["Lucas Dubois", "America/Toronto", ["French", "English"]],
  ["Hyejin Park", "Asia/Seoul", ["Korean", "English"]],
  ["Mateo Fernández", "America/Bogota", ["Spanish", "English"]],
  ["Sara Ahmed", "Africa/Cairo", ["Arabic", "English"]],
];

/** Skills a new member is most likely to say they can teach; sample members want these so cycles close. */
const POPULAR = [
  "english",
  "python",
  "excel",
  "web-development",
  "math",
  "home-cooking",
  "photography",
  "public-speaking",
  "guitar",
  "chess",
  "figma",
  "interview-practice",
  "spanish",
  "russian",
  "kazakh",
  "video-editing",
  "essay-writing",
  "piano",
  "data-analysis",
  "yoga",
  "resume-review",
  "baking",
  "ai-tools",
  "sql",
];

export async function ensureSeeded(db: DB) {
  const [{ n }] = rows<{ n: number }>(await db.execute(sql`select count(*)::int as n from categories`));
  if (n > 0) return false;
  await seed(db);
  return true;
}

export async function seed(db: DB, opts: { members?: number; history?: number; log?: boolean } = {}) {
  const log = opts.log ? console.log : () => {};
  const rand = mulberry32(20261114);
  const pickN = <T>(list: T[], k: number, exclude: Set<T> = new Set()) => {
    const pool = list.filter((x) => !exclude.has(x));
    const out: T[] = [];
    while (out.length < k && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
    return out;
  };

  // 1. Taxonomy
  const skillIds = new Map<string, string>();
  const liveSkills: string[] = [];
  for (const [i, cat] of TAXONOMY.entries()) {
    const [c] = await db
      .insert(categories)
      .values({ slug: cat.slug, name: cat.name, rules: cat.rules, position: i })
      .returning();
    const inserted = await db
      .insert(skills)
      .values(cat.skills.map(([slug, name, keywords]) => ({ categoryId: c.id, slug, name, keywords })))
      .returning();
    for (const s of inserted) {
      skillIds.set(s.slug, s.id);
      if (cat.rules.formats.includes("live")) liveSkills.push(s.slug);
    }
  }
  log(`taxonomy: ${TAXONOMY.length} categories, ${skillIds.size} skills`);

  // Domain services are imported lazily so db/client stays free of import cycles.
  const svc = {
    ...(await import("@/modules/identity/service")),
    ...(await import("@/modules/ledger/service")),
    ...(await import("@/modules/market/service")),
    ...(await import("@/modules/booking/service")),
  };

  // 2. Sample members — labelled, available any time so the demo works around the clock.
  const count = Math.min(opts.members ?? PEOPLE.length, PEOPLE.length);
  const ids: string[] = [];
  const teaches = new Map<string, string[]>();
  const order = pickN(liveSkills, liveSkills.length);
  for (let i = 0; i < count; i++) {
    const [name, tz, langs] = PEOPLE[i];
    const teach = [
      order[(i * 3) % order.length],
      order[(i * 3 + 1) % order.length],
      order[(i * 3 + 2) % order.length],
    ];
    const popular = POPULAR[i % POPULAR.length];
    if (!teach.includes(popular)) teach.push(popular);
    const teachSet = new Set(teach);
    const learn = [
      ...pickN(
        POPULAR.filter((s) => skillIds.has(s)),
        3,
        teachSet,
      ),
      ...pickN(liveSkills, 2, new Set([...teachSet, ...POPULAR])),
    ];
    const handle = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[^a-z ]/g, "")
      .split(" ")
      .join("-");
    const teachNames = teach
      .map((s) => TAXONOMY.flatMap((c) => c.skills).find(([slug]) => slug === s)?.[1])
      .filter(Boolean);
    const id = await db.transaction(async (tx) => {
      const [m] = await tx
        .insert(members)
        .values({
          handle,
          displayName: name,
          bio: `Sample member. Teaches ${teachNames.slice(0, 2).join(" and ")}; always happy to swap.`,
          timezone: tz,
          languages: langs,
          isSample: true,
          onboardedAt: new Date(),
        })
        .returning();
      await svc.memberAccount(tx, m.id);
      await svc.grantStarterHours(tx, m.id, "Starter grant (sample member)");
      await svc.setSkills(
        tx,
        m.id,
        teach.map((s) => ({ skillId: skillIds.get(s)!, level: 3 + Math.floor(rand() * 3) })),
        learn.map((s) => ({ skillId: skillIds.get(s)!, level: 1 + Math.floor(rand() * 2) })),
      );
      return m.id;
    });
    await svc.createBotIdentity(db, id);
    ids.push(id);
    teaches.set(id, teach);
  }
  log(`sample members: ${ids.length}`);

  // 3. History: real sessions between sample members, run through the escrow and signed by both bots.
  const history = opts.history ?? 90;
  const allOffers = await db.select().from(offers).where(eq(offers.active, true));
  const start = Date.now() - 60 * 86_400_000;
  const DAY = 86_400_000;
  let done = 0;
  for (let k = 0; k < history; k++) {
    const offer = allOffers[Math.floor(rand() * allOffers.length)];
    const learner = ids[Math.floor(rand() * ids.length)];
    if (learner === offer.memberId) continue;
    const startsAt = new Date(Math.floor((start + (k / history) * 58 * DAY) / 300_000) * 300_000);
    const at = (minutes: number) => ({ now: new Date(startsAt.getTime() + minutes * 60_000) });
    try {
      const learnerDevice = await botDevice(db, learner);
      const teacherDevice = await botDevice(db, offer.memberId);
      const bookingId = await svc.requestBooking(
        db,
        { memberId: learner, deviceId: learnerDevice, signerKey: "sample-bot" },
        { offerId: offer.id, startsAt, lengthMin: 60 },
        at(-24 * 60),
      );
      await svc.acceptBooking(
        db,
        { memberId: offer.memberId, deviceId: teacherDevice, signerKey: "sample-bot" },
        bookingId,
        at(-20 * 60),
      );
      await svc.startBooking(
        db,
        { memberId: learner, deviceId: learnerDevice, signerKey: "sample-bot" },
        bookingId,
        at(0),
      );
      for (const [who, device] of [
        [learner, learnerDevice],
        [offer.memberId, teacherDevice],
      ] as const) {
        const payload = { action: "confirm_session" as const, bookingId, ts: Date.now() };
        const signed = await svc.botSign(db, who, payload);
        await svc.confirmBooking(
          db,
          { memberId: who, deviceId: device },
          {
            bookingId,
            payload,
            signature: signed.signature,
            rating: rand() < 0.85 ? 5 : 4,
            review: REVIEWS[Math.floor(rand() * REVIEWS.length)],
          },
          at(65),
        );
      }
      done++;
    } catch {
      // A random pairing can trip a real rule (weekly cap, floor). That's the rules working; skip it.
    }
  }
  log(`seeded sessions: ${done}`);

  // 4. A few open requests so skill pages show demand.
  for (let i = 0; i < Math.min(12, ids.length); i++) {
    const slug = POPULAR[(i * 5) % POPULAR.length];
    if (teaches.get(ids[i])?.includes(slug)) continue;
    await db
      .insert(requests)
      .values({
        memberId: ids[i],
        skillId: skillIds.get(slug)!,
        level: 1,
        lengthMin: 60,
        text: `Looking for someone to help me start with ${slug.replace("-", " ")}.`,
        parsedBy: "form",
      })
      .onConflictDoNothing();
  }
  await svc.communityAccount(db);
  return { members: ids.length, sessions: done };
}

async function botDevice(db: DB, memberId: string) {
  const res = rows<{ deviceId: string }>(
    await db.execute(sql`select device_id as "deviceId" from bot_keys where member_id = ${memberId}`),
  );
  return res[0].deviceId;
}

const REVIEWS = [
  "Clear and patient. Came away with a plan for next week.",
  "Exactly what I needed, very practical.",
  "Great explanations, we covered more than I expected.",
  "Friendly and well prepared.",
  "Helpful session, would book again.",
  "Gave me exercises I can actually do on my own.",
];
