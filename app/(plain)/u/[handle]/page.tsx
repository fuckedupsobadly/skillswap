import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer } from "@/app/_lib/viewer";
import { getDb } from "@/db/client";
import { achievementById } from "@/modules/game/catalog";
import { rankIndex } from "@/modules/game/ranks";
import { publicProfileGame } from "@/modules/game/service";
import { profileByHandle } from "@/modules/market/service";
import { formatMinutes, levelName } from "@/modules/platform/format";
import { TRUST_NAMES } from "@/modules/trust/reputation";
import { memberCard } from "@/modules/village/service";
import { describeAvailability } from "@/modules/village/when";
import { Empty, Hours, Page, Section, Stars } from "@/ui/bits";
import { ItemIcon } from "@/ui/kitty/item-icon";
import { KittyPreview } from "@/ui/kitty/preview";
import { PixelIcon } from "@/ui/pixel/icons";
import { Portrait } from "@/ui/portrait";
import { ShowOnMap } from "@/ui/show-on-map";
import { ReportBlock } from "./report";

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const p = await profileByHandle(await getDb(), (await params).handle);
  return { title: p ? `${p.member.displayName}'s hut` : "Member" };
}

const timeIn = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  }).format(new Date(iso));

/**
 * A member's hut, as a page (§6.3/§6.4 twin): portrait and nameplate, their own line, what they teach with a
 * way to book each, when they're usually around, and the kitty on the step.
 */
export default async function Profile({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const db = await getDb();
  const viewer = await getViewer();
  const [p, card] = await Promise.all([
    profileByHandle(db, handle),
    memberCard(db, viewer?.memberId ?? "00000000-0000-0000-0000-000000000000", handle),
  ]);
  if (!p || !card) notFound();
  const [game, mine] = await Promise.all([
    publicProfileGame(db, p.member.id),
    viewer ? publicProfileGame(db, viewer.memberId) : null,
  ]);
  const { member } = p;
  const isMe = viewer?.memberId === member.id;
  const first = member.displayName.split(" ")[0];
  const free = card.presence === "free";
  // At rank Puma and up, your kitty may wander over and visit this member's kitty.
  const canVisit = Boolean(
    viewer && !isMe && game.kitty && mine?.kitty && rankIndex(mine.rank) >= rankIndex("puma"),
  );
  const tz = viewer?.member.timezone ?? member.timezone;
  const usually = describeAvailability(p.availability);

  return (
    <Page
      title={`${first}'s hut`}
      action={
        !isMe ? (
          <ShowOnMap handle={member.handle} className="btn btn-tertiary -mr-2" />
        ) : (
          <Link href="/hut" className="btn btn-secondary">
            Edit your hut
          </Link>
        )
      }
    >
      {/* Portrait and nameplate above the words, as in the dialogue box. */}
      <div className="-mt-2 flex items-center gap-4">
        <div className="bg-paper-shade">
          <Portrait look={card.look} size={48} />
        </div>
        <div className="grid min-w-0 gap-0.5">
          <span className="font-name text-name">{member.displayName}</span>
          <span className="text-meta text-ink-soft">
            {card.presenceLabel} · Trust {member.trustLevel} ({TRUST_NAMES[member.trustLevel]}) ·{" "}
            <Stars value={p.rating} count={p.reviews.length} />
            {game.showRank ? ` · ${game.rankName}` : ""}
            {member.isSample ? " · Sample" : ""}
          </span>
        </div>
      </div>
      {card.statusLine ? (
        <blockquote className="-mt-2 border-l-4 border-paper-shade pl-3">“{card.statusLine}”</blockquote>
      ) : null}
      {member.isSample ? (
        <p className="-mt-2 text-meta text-ink-soft">
          Sample members are seeded for the demo. They accept and confirm on their own, so their lantern is
          really lit.
        </p>
      ) : null}

      <Section title="Teaches">
        {card.teaches.length === 0 ? (
          <Empty>Not teaching anything yet.</Empty>
        ) : (
          <ul className="grid gap-2">
            {card.teaches.map((t, i) => {
              const len = Math.min(...t.lengths);
              const href =
                t.offerId && !isMe
                  ? `/book/${t.offerId}?len=${len}${free ? "&now=1" : ""}`
                  : `/skills/${t.slug}`;
              return (
                <li key={t.slug}>
                  <Link href={href} className="card flex min-h-14 items-center gap-3 px-3 py-2">
                    <span
                      aria-hidden
                      className="grid h-7 w-7 shrink-0 place-items-center"
                      style={{ background: t.color }}
                    >
                      <PixelIcon name={t.icon} size={16} />
                    </span>
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="font-medium">{t.name}</span>
                      <span className="text-meta text-ink-soft">
                        {levelName(t.level)} · {t.guild}
                      </span>
                    </span>
                    {t.offerId && !isMe ? (
                      // The first row's button is gold only when a lesson can really start now.
                      <span className={`btn ${free && i === 0 ? "btn-primary" : "btn-secondary"}`}>
                        Book {formatMinutes(len)}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {card.learning.length ? (
        <Section title="Learning">
          <p>{card.learning.join(", ")}</p>
        </Section>
      ) : null}

      <Section title="Usually around">
        <p>
          {usually}
          <span className="text-meta text-ink-soft"> · {member.timezone.replace("_", " ")}</span>
        </p>
        {card.nextFree.length && !isMe ? (
          <p className="tnum text-ink-soft">
            Next free {card.nextFree.map((n) => timeIn(n, tz)).join(" · ")}
          </p>
        ) : null}
        {!isMe && viewer ? (
          <div className="flex flex-wrap gap-2">
            <Link href={`/inbox?to=${member.handle}`} className="btn btn-secondary">
              <PixelIcon name="mailbox" size={16} />
              Leave a note
            </Link>
          </div>
        ) : null}
      </Section>

      {member.bio ? (
        <Section title="About">
          <p className="whitespace-pre-line">{member.bio}</p>
          <p className="text-meta text-ink-soft">
            {p.stats.taught} taught · {p.stats.learned} learned · <Hours min={p.stats.taughtMin} /> given
            {member.languages.length ? ` · speaks ${member.languages.join(", ")}` : ""}
          </p>
        </Section>
      ) : null}

      {game.kitty ? (
        <Section title="On the step">
          <figure data-perch="" data-kitty-visit={canVisit ? "" : undefined} className="grid gap-3">
            <div className="justify-self-start border-2 border-ink">
              <KittyPreview
                code={game.kitty.code}
                stage={game.kitty.stage}
                equipped={game.kitty.equipped}
                scale={3}
                room={{
                  theme: game.kitty.roomTheme,
                  item: game.kitty.equipped.room,
                  bed: game.kitty.equipped.bed,
                }}
                label={`${game.kitty.name}, ${first}'s kitty`}
              />
            </div>
            <figcaption className="text-ink-soft">
              <span className="font-pixel text-label text-ink">{game.kitty.name}</span>
              {game.showRank ? ` · level ${game.level}` : ""}
            </figcaption>
            {game.badges.length ? (
              <ul className="flex flex-wrap gap-1.5" aria-label="Badges">
                {game.badges.map((b) => (
                  <li key={b.id} title={b.name} className="grid h-10 w-10 place-items-center bg-paper-shade">
                    <ItemIcon id={achievementById.get(b.id)?.itemId ?? "yarn"} size={30} />
                    <span className="sr-only">{b.name}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </figure>
        </Section>
      ) : null}

      <Section title={`Reviews (${p.reviews.length})`}>
        {p.reviews.length === 0 ? (
          <Empty>No reviews yet.</Empty>
        ) : (
          <ul className="grid">
            {p.reviews.slice(0, 8).map((r) => (
              <li
                key={`${r.author}${String(r.createdAt)}`}
                className="grid gap-1 border-t-2 border-paper-shade py-3 first:border-t-0 first:pt-0"
              >
                <span className="tnum text-meta text-ink-soft">
                  {r.rating} of 5 · {r.author}
                </span>
                {r.text ? <p>{r.text}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {!isMe && viewer ? (
        <div className="divider pt-4">
          <ReportBlock subjectId={member.id} />
        </div>
      ) : null}
    </Page>
  );
}
