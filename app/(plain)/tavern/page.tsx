import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/app/_lib/viewer";
import { getDb } from "@/db/client";
import { memberSkillsOf } from "@/modules/market/service";
import { directMatches, proposalsFor } from "@/modules/matching/service";
import { BARKEEP_LOOK } from "@/modules/village/art/people";
import { Columns, Empty, Page, Section, Stack } from "@/ui/bits";
import { Portrait } from "@/ui/portrait";
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
      scene={{ place: "tavern" }}
      sub="Swap cycles: everyone teaches one session and learns one. Net cost 0 h."
    >
      <Columns>
        <Stack>
          <Section title="Tables" icon="search" aside={<MatchMeButton />}>
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
                          You learn {t.edgesNamed.find((e) => e.learnerId === viewer.memberId)?.skillName} ·
                          you teach {t.edgesNamed.find((e) => e.teacherId === viewer.memberId)?.skillName}
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
          <Section title="Chalkboard" icon="book">
            {/* the chalkboard by the fireplace: slate, chalk letters, a smudge */}
            <div className="chalkboard grid gap-1 px-5 py-4">
              <p className="font-pixel text-label">Group classes</p>
              <p className="text-meta opacity-85">
                None proposed yet. When enough people wish for the same skill, the matcher chalks one up here.
              </p>
            </div>
          </Section>
        </Stack>
        <Stack>
          <Section title="Teachers for your wishes" icon="lute">
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
                        {m.teacher.isSample ? (
                          <span className="text-meta text-ink-soft"> · Sample</span>
                        ) : null}
                        <span className="block text-meta text-ink-soft">
                          {m.data.skillName} · {m.reasons.slice(0, 2).join(" · ")}
                        </span>
                      </span>
                      <span className="btn btn-secondary pointer-events-none">Book</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="The Barkeep" icon="mailbox">
            <div className="flex items-start gap-4">
              <div className="shrink-0 bg-paper-shade">
                <Portrait look={BARKEEP_LOOK} size={48} label="The Barkeep" />
              </div>
              <div className="grid gap-3">
                <p>
                  “I'm an AI, not a member. Ask me why a table was set, or tell me what you'd like to learn
                  and I'll write the wish for you to approve.”
                </p>
                <Link href="/tavern/barkeep" className="btn btn-secondary justify-self-start">
                  Talk to the Barkeep
                </Link>
              </div>
            </div>
          </Section>
        </Stack>
      </Columns>
    </Page>
  );
}
