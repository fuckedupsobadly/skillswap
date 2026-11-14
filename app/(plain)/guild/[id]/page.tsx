import { inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/app/_lib/viewer";
import { getDb } from "@/db/client";
import { categories } from "@/db/schema";
import { boardRows } from "@/modules/village/board";
import { guildById } from "@/modules/village/guilds";
import { traces } from "@/modules/village/service";
import { Empty, Page, Section } from "@/ui/bits";
import { PixelIcon } from "@/ui/pixel/icons";
import { BoardList } from "../../board/list";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: guildById.get((await params).id)?.name ?? "Guild" };
}

/** A guild hall (§3.2): its category notice board, who teaches here, and group classes. */
export default async function GuildHall({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = guildById.get(id);
  if (!g) notFound();
  const viewer = await getViewer();
  if (!viewer) redirect("/gate");
  const db = await getDb();
  const [cats, offers, requests, t] = await Promise.all([
    db
      .select({ slug: categories.slug, name: categories.name })
      .from(categories)
      .where(inArray(categories.slug, g.categories)),
    boardRows(db, viewer.memberId, { tab: "offers", guild: g.id }),
    boardRows(db, viewer.memberId, { tab: "requests", guild: g.id }),
    traces(db),
  ]);
  const running = t.chimneys.includes(g.id);
  const free = offers.filter((o) => "presence" in o && o.presence === "free").length;
  return (
    <Page
      title={g.name}
      sub={cats.map((c) => c.name).join(", ")}
      action={
        <span aria-hidden className="grid h-11 w-11 place-items-center" style={{ background: g.roof }}>
          <PixelIcon name={g.icon} size={24} />
        </span>
      }
    >
      <p className="-mt-2 text-ink-soft">
        <span className="tnum">{offers.length}</span> {offers.length === 1 ? "teacher" : "teachers"} in this
        guild
        {free ? (
          <>
            , <span className="tnum">{free}</span> free now
          </>
        ) : null}
        .{" "}
        {running
          ? "Smoke from the chimney: a lesson is running right now."
          : "The chimney is quiet: no lesson running."}
      </p>

      <Section
        title="Teaching here"
        aside={
          <Link href={`/board?guild=${g.id}`} className="btn btn-tertiary -my-2 -mr-2">
            Filter the board
          </Link>
        }
      >
        {offers.length ? (
          <BoardList list={offers} />
        ) : (
          <Empty
            action={
              <Link href="/hut#skills" className="btn btn-secondary">
                Teach something here
              </Link>
            }
          >
            No one teaches in this guild yet. You could be the first.
          </Empty>
        )}
      </Section>

      <Section title="Wishes for this guild">
        {requests.length ? (
          <BoardList list={requests} />
        ) : (
          <Empty
            action={
              <Link href="/well" className="btn btn-secondary">
                Make a wish
              </Link>
            }
          >
            No open wishes here right now.
          </Empty>
        )}
      </Section>

      <Section title="Group classes">
        <p className="text-ink-soft">
          No group classes are open in this guild. Proposals appear on the Tavern chalkboard first, then here
          once enough people sign up.
        </p>
      </Section>
    </Page>
  );
}
