import { sql } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/app/_lib/viewer";
import { getDb, rows } from "@/db/client";
import { formatDateTime } from "@/modules/booking/slots";
import { progressFor } from "@/modules/game/service";
import { OPEN_BOOKING_LIMIT, TRUST_NAMES } from "@/modules/trust/reputation";
import { ensureVillager } from "@/modules/village/service";
import { Mono, Page, Section } from "@/ui/bits";
import { KittySettings } from "./kitty-settings";
import { VillageSettings } from "./settings";

export const metadata = { title: "Town Hall" };

const LADDER = [
  { reach: "Joining the village", unlocks: `Video lessons, up to ${OPEN_BOOKING_LIMIT[0]} open bookings` },
  {
    reach: "3 confirmed sessions and a way to recover your account",
    unlocks: `Group classes, work reviews, ${OPEN_BOOKING_LIMIT[1]} open bookings`,
  },
  {
    reach: "10 confirmed sessions, rating 4.5 or more, no upheld reports",
    unlocks: "In-person lessons and Helping hands",
  },
  { reach: "30 sessions and a clean record", unlocks: "A seat on the stewards' bench" },
] as const;

/** Town Hall (§3.1): settings, trust level and the disputes court. */
export default async function Hall() {
  const viewer = await getViewer();
  if (!viewer) redirect("/gate");
  const db = await getDb();
  const [v, game] = await Promise.all([
    ensureVillager(db, viewer.memberId),
    progressFor(db, viewer.memberId),
  ]);
  const [stats] = rows<{ settled: number }>(
    await db.execute(sql`select count(*)::int as settled from bookings b join booking_participants bp on bp.booking_id = b.id
      where bp.member_id = ${viewer.memberId} and b.status = 'settled'`),
  );
  const disputes = rows<{ id: string; skill: string; startsAt: Date; other: string }>(
    await db.execute(sql`select b.id, s.name as skill, b.starts_at as "startsAt",
        (select m.display_name from booking_participants o join members m on m.id = o.member_id where o.booking_id = b.id and o.member_id <> ${viewer.memberId} limit 1) as other
      from bookings b join skills s on s.id = b.skill_id join booking_participants bp on bp.booking_id = b.id
      where bp.member_id = ${viewer.memberId} and b.status = 'disputed' order by b.starts_at desc`),
  );
  const level = viewer.member.trustLevel;
  const tz = viewer.member.timezone;
  return (
    <Page title="Town Hall" sub="Settings, your trust level, and the stewards' bench.">
      <Section title="The village and you">
        <VillageSettings plain={v.plainMode} hideMe={v.hideMe} />
      </Section>

      <Section title="Trust">
        <p>
          You're <span className="font-pixel text-label">{TRUST_NAMES[level]}</span>
          <span className="text-ink-soft">
            {" "}
            · <span className="tnum">{stats?.settled ?? 0}</span> confirmed{" "}
            {stats?.settled === 1 ? "session" : "sessions"}
          </span>
        </p>
        <ol className="grid">
          {LADDER.map((l, i) => (
            <li
              key={TRUST_NAMES[i]}
              className="grid grid-cols-[88px_1fr] gap-3 border-t-2 border-paper-shade py-2.5 first:border-t-0"
            >
              <span className={`font-pixel text-label ${i > level ? "text-ink-soft" : ""}`}>
                {TRUST_NAMES[i]}
                {i === level ? <span className="sr-only"> (you)</span> : null}
              </span>
              <span className={i > level ? "text-ink-soft" : ""}>
                {l.unlocks}
                <span className="block text-meta text-ink-soft">{i === 0 ? "From day one" : l.reach}</span>
              </span>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Stewards' bench">
        {disputes.length ? (
          <ul className="grid">
            {disputes.map((d) => (
              <li key={d.id} className="border-t-2 border-paper-shade first:border-t-0">
                <Link href={`/sessions/${d.id}`} className="group flex min-h-11 items-baseline gap-3 py-2.5">
                  <span className="min-w-0 flex-1 group-hover:underline group-hover:underline-offset-4">
                    {d.skill}
                    {d.other ? ` with ${d.other.split(" ")[0]}` : ""}
                  </span>
                  <span className="tnum text-meta text-ink-soft">
                    {formatDateTime(new Date(d.startsAt), tz)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-soft">
            No disputes. If a session goes wrong, open one from the Lantern Room before you confirm; the hours
            stay held until stewards decide.
          </p>
        )}
      </Section>

      <Section title="Kitty">
        <KittySettings initial={game.settings} kittyName={game.kitty?.name ?? null} />
      </Section>

      <Section title="This device">
        <div className="grid gap-2 text-ink-soft">
          <p>
            You're signed in with a key made in this browser. Its private half can't be exported, even by
            SkillSwap; clearing this site's data removes it, and with it this guest account.
          </p>
          <span className="font-pixel text-label text-ink">Key fingerprint</span>
          <Mono>{viewer.signerKey}</Mono>
        </div>
      </Section>
    </Page>
  );
}
