import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { getViewer } from "@/app/_lib/viewer";
import { getDb } from "@/db/client";
import { skillBySlug } from "@/modules/catalog/service";
import { recordSkillVisit } from "@/modules/game/service";
import { openRequestsForSkill, teachersOfSkill } from "@/modules/market/service";
import { levelName } from "@/modules/platform/format";
import { TRUST_NAMES } from "@/modules/trust/reputation";
import { guildForCategory } from "@/modules/village/guilds";
import { litLanternsFor } from "@/modules/village/service";
import { Columns, Empty, Page, Section, Stack, Stars } from "@/ui/bits";
import { BoardRowActions } from "../../board/parts";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const found = await skillBySlug(await getDb(), (await params).slug);
  return { title: found?.skill.name ?? "Skill" };
}

/** One skill: who teaches it (lit lanterns first) and who wishes for it. */
export default async function SkillPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = await getDb();
  const found = await skillBySlug(db, slug);
  if (!found) notFound();
  const viewer = await getViewer();
  // Explorer badge: distinct skill pages visited. Logged after the response so it never slows the page.
  if (viewer) after(() => recordSkillVisit(db, viewer.memberId, found.skill.id));
  const [teachers, wanted, lit] = await Promise.all([
    teachersOfSkill(db, found.skill.id),
    openRequestsForSkill(db, found.skill.id),
    viewer ? litLanternsFor(db, found.skill.id, viewer.memberId) : [],
  ]);
  const free = new Set(lit.map((l) => l.handle));
  const sorted = [...teachers].sort((a, b) => Number(free.has(b.handle)) - Number(free.has(a.handle)));
  const cat = found.category.slug;
  const guild = guildForCategory(cat)?.name ?? "Market Row";
  return (
    <Page
      title={found.skill.name}
      sub={`${found.category.name} · ${guild}`}
      scene={guildForCategory(cat) ? { guild: guildForCategory(cat)!.id } : { place: "market" }}
    >
      <Columns>
        <Section
          title={`Teaching (${teachers.length})`}
          aside={
            <Link
              href={`/well?q=${encodeURIComponent(found.skill.name)}`}
              className="btn btn-tertiary -my-2 -mr-2"
            >
              Make a wish
            </Link>
          }
        >
          {sorted.length === 0 ? (
            <Empty
              action={
                <Link href={`/well?q=${encodeURIComponent(found.skill.name)}`} className="btn btn-secondary">
                  Make a wish
                </Link>
              }
            >
              Nobody teaches this yet. Make a wish and the Well tells you when someone arrives.
            </Empty>
          ) : (
            <ul className="grid gap-2">
              {sorted.map((t) => (
                <li key={t.offerId} className="card flex flex-wrap items-center gap-3 px-3 py-2">
                  <Link
                    href={`/u/${t.handle}`}
                    className="grid min-w-0 flex-1 gap-0.5 hover:underline hover:underline-offset-4"
                  >
                    <span className="font-medium">{t.displayName}</span>
                    <span className="text-meta text-ink-soft">
                      {free.has(t.handle) ? "Free now" : "Book ahead"} · {levelName(t.level ?? 3)} ·{" "}
                      {TRUST_NAMES[t.trustLevel]} · <Stars value={t.rating} />
                      {t.isSample ? " · Sample" : ""}
                    </span>
                  </Link>
                  {viewer && t.memberId !== viewer.memberId ? (
                    <BoardRowActions
                      row={{
                        kind: "offer",
                        id: t.offerId,
                        handle: t.handle,
                        who: t.displayName,
                        free: free.has(t.handle),
                        title: found.skill.name,
                        mine: false,
                      }}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Stack>
          <Section title={`Wishes (${wanted.length})`}>
            {wanted.length === 0 ? (
              <Empty>No open wishes for {found.skill.name}.</Empty>
            ) : (
              <ul className="grid">
                {wanted.map((r) => (
                  <li key={r.id} className="border-t-2 border-paper-shade first:border-t-0">
                    <Link href={`/u/${r.handle}`} className="group grid min-h-11 gap-0.5 py-2.5">
                      <span className="font-medium group-hover:underline group-hover:underline-offset-4">
                        {r.displayName}
                      </span>
                      <span className="text-meta text-ink-soft">
                        {levelName(r.level)}
                        {r.text ? ` · “${r.text}”` : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </Stack>
      </Columns>
    </Page>
  );
}
