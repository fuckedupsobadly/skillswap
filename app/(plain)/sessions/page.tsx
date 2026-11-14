import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/app/_lib/viewer";
import { getDb } from "@/db/client";
import { OPEN } from "@/modules/booking/machine";
import { sessionsFor } from "@/modules/booking/service";
import { formatDateTime } from "@/modules/booking/slots";
import { formatMinutes } from "@/modules/platform/format";
import { Empty, Page, Section } from "@/ui/bits";
import { STATUS_TEXT } from "./status";

export const metadata = { title: "Lantern Rooms" };

/** The row of Lantern Rooms beside the Town Hall (§3.1): your booked lessons, next first. */
export default async function Sessions() {
  const viewer = await getViewer();
  if (!viewer) redirect("/gate");
  const all = await sessionsFor(await getDb(), viewer.memberId);
  const upcoming = all
    .filter((s) => OPEN.includes(s.status))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const past = all.filter((s) => !OPEN.includes(s.status));
  const tz = viewer.member.timezone;
  const row = (s: (typeof all)[number]) => (
    <li key={s.id}>
      <Link href={`/sessions/${s.id}`} className="card flex min-h-14 items-center gap-3 px-3 py-2">
        <div className="grid min-w-0 flex-1 gap-0.5">
          <span className="font-medium">
            {s.role === "teacher" ? "Teaching" : "Learning"} {s.skill} with {s.otherName.split(" ")[0]}
            {s.otherIsSample ? <span className="text-meta font-normal text-ink-soft"> · Sample</span> : null}
          </span>
          <span className="tnum text-meta text-ink-soft">
            {formatDateTime(s.startsAt, tz)} · {formatMinutes(s.lengthMin)}
          </span>
        </div>
        <span className={`text-right text-meta ${s.status === "live" ? "font-medium" : "text-ink-soft"}`}>
          {STATUS_TEXT[s.status]}
        </span>
      </Link>
    </li>
  );
  return (
    <Page
      title="Lantern Rooms"
      sub="Video happens only here, after a booking. No one is ever put on camera by walking past."
    >
      <Section title="Coming up">
        {upcoming.length ? (
          <ul className="grid gap-2">{upcoming.map(row)}</ul>
        ) : (
          <Empty
            action={
              <Link href="/board" className="btn btn-secondary">
                Find a teacher
              </Link>
            }
          >
            Nothing booked. Find a lit lantern on the Notice Board, or make a wish.
          </Empty>
        )}
      </Section>
      {past.length ? (
        <Section title="Earlier">
          <ul className="grid gap-2">{past.map(row)}</ul>
        </Section>
      ) : null}
    </Page>
  );
}
