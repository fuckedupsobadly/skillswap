import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/app/_lib/viewer";
import { getDb } from "@/db/client";
import { memberSkillsOf } from "@/modules/market/service";
import { directMatches, proposalsFor } from "@/modules/matching/service";
import { Empty, Page, Section } from "@/ui/bits";
import { MatchMeButton } from "./match-me";

export const metadata = { title: "The Swapped Mug" };

const SIZE = ["", "", "two", "three", "four", "five"];

/** The tavern's plain twin (§8.3): each proposed swap cycle is a table; group classes are on the chalkboard. */
export default async function Tavern() {
  const viewer = await getViewer();
  if (!viewer) redirect("/gate");
  const db = await getDb();
  const [proposals, direct, mine] = await Promise.all([
    proposalsFor(db, viewer.memberId),
    directMatches(db, viewer.memberId, { limit: 4 }),
    memberSkillsOf(db, viewer.memberId),
  ]);
  const tables = proposals.filter((p) => p.status === "proposed");
  const teaches = mine.some((s) => s.direction === "teach");
  return (
    <Page
      title="The Swapped Mug"
      sub="Swap cycles: everyone teaches one session and learns one. Net cost 0 h."
    >
      <Section title="Tables" aside={<MatchMeButton />}>
        {!teaches ? (
          <Empty
            action={
              <Link href="/hut#skills" className="btn btn-secondary">
                Add a skill you teach
              </Link>
            }
          >
            A swap needs one thing you can teach.
          </Empty>
        ) : tables.length === 0 ? (
          <Empty
            action={
              <Link href="/well" className="btn btn-secondary">
                Make a wish
              </Link>
            }
          >
            No table has your seat yet. A wish gives the matcher something to work with.
          </Empty>
        ) : (
          <ul className="grid gap-2">
            {tables.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/tavern/${t.id}`}
                  className="card flex min-h-14 items-center justify-between gap-3 px-3 py-2"
                >
                  <span>
                    <span className="font-pixel text-label">A swap for {SIZE[t.members.length]}</span>
                    <span className="block text-meta text-ink-soft">
                      You learn {t.edgesNamed.find((e) => e.learnerId === viewer.memberId)?.skillName} · you
                      teach {t.edgesNamed.find((e) => e.teacherId === viewer.memberId)?.skillName}
                    </span>
                  </span>
                  <span className="tnum text-meta">
                    {t.acceptedBy.length} of {t.members.length} accepted
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Chalkboard">
        <p className="text-ink-soft">
          No group classes yet. When enough people wish for the same skill, the matcher proposes one here.
        </p>
      </Section>
      <Section title="Teachers for your wishes">
        {direct.length === 0 ? (
          <p className="text-ink-soft">Make a wish and the best teachers show up here.</p>
        ) : (
          <ul className="grid gap-2">
            {direct.map((m) => (
              <li key={m.data.offerId}>
                <Link
                  href={`/book/${m.data.offerId}`}
                  className="card flex min-h-14 items-center justify-between gap-3 px-3 py-2"
                >
                  <span>
                    <span className="font-medium">{m.teacher.displayName}</span>
                    {m.teacher.isSample ? <span className="text-meta text-ink-soft"> · Sample</span> : null}
                    <span className="block text-meta text-ink-soft">
                      {m.data.skillName} · {m.reasons.slice(0, 2).join(" · ")}
                    </span>
                  </span>
                  <span className="font-pixel text-label">Book</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="The Barkeep">
        <p>
          The Barkeep is an AI. Ask him to explain a match or read a wish.{" "}
          <Link href="/tavern/barkeep" className="underline underline-offset-2">
            Talk to the Barkeep
          </Link>
        </p>
      </Section>
    </Page>
  );
}
