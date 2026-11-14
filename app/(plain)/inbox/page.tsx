import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/app/_lib/viewer";
import { getDb } from "@/db/client";
import { formatDateTime } from "@/modules/booking/slots";
import { inbox } from "@/modules/village/service";
import { Empty, Page, Section } from "@/ui/bits";
import { MarkRead, NoteForm, Reply } from "./parts";

export const metadata = { title: "Mailbox" };

const FROM: Record<string, string> = { match: "The Barkeep · AI", booking: "Lantern Rooms" };

/** The mailbox at your hut (§6.2): notes from neighbours, swap matches and booking news, newest first. */
export default async function Inbox({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/gate");
  const { to } = await searchParams;
  const db = await getDb();
  const all = await inbox(db, viewer.memberId);
  const received = all.filter((n) => !n.mine);
  const sent = all.filter((n) => n.mine);
  const unread = received.filter((n) => !n.readAt).length;
  const tz = viewer.member.timezone;
  return (
    <Page
      title="Mailbox"
      sub={unread ? `${unread} new since you last looked.` : "Notes wait here until you're back."}
    >
      <MarkRead unread={unread} />
      {received.length === 0 ? (
        <Empty>
          Nothing yet. When someone leaves a note at your hut, or the Barkeep finds you a swap, it lands here.
        </Empty>
      ) : (
        <ol className="grid">
          {received.map((n) => {
            const from = n.fromName ?? FROM[n.kind] ?? "The village";
            return (
              <li
                key={n.id}
                className="grid gap-1.5 border-t-2 border-paper-shade py-4 first:border-t-0 first:pt-0"
              >
                <div className="flex items-baseline gap-2">
                  {!n.readAt ? (
                    <span className="inline-block size-2 shrink-0 self-center bg-ink" aria-hidden />
                  ) : null}
                  <span className="font-pixel text-label">{from}</span>
                  {!n.readAt ? <span className="text-meta">New</span> : null}
                  <span className="tnum ml-auto text-meta text-ink-soft">
                    {formatDateTime(new Date(n.createdAt), tz)}
                  </span>
                </div>
                <p className="whitespace-pre-line">{n.body}</p>
                {n.link ? (
                  <Link href={n.link} className="btn btn-secondary justify-self-start">
                    {n.kind === "match" ? "See the table" : "Open"}
                  </Link>
                ) : n.fromHandle ? (
                  <Reply handle={n.fromHandle} name={from.split(" ")[0]} />
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      <Section title="Leave a note">
        <NoteForm to={to ?? ""} />
      </Section>

      {sent.length ? (
        <Section title="Sent">
          <ol className="grid">
            {sent.slice(0, 20).map((n) => (
              <li key={n.id} className="grid gap-0.5 border-t-2 border-paper-shade py-2.5 first:border-t-0">
                <span className="text-meta text-ink-soft">
                  To {n.toName.split(" ")[0]} ·{" "}
                  <span className="tnum">{formatDateTime(new Date(n.createdAt), tz)}</span>
                </span>
                <p className="line-clamp-2 text-ink-soft">{n.body}</p>
              </li>
            ))}
          </ol>
        </Section>
      ) : null}
    </Page>
  );
}
