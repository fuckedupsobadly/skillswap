import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/app/_lib/viewer";
import { getDb } from "@/db/client";
import { proposalsFor } from "@/modules/matching/service";
import { Page } from "@/ui/bits";
import { AcceptSeat } from "../accept";

export const metadata = { title: "A swap" };
const SIZE = ["", "", "two", "three", "four", "five"];

/** §8.3: sitting at a table opens the swap. */
export default async function Swap({ params }: { params: Promise<{ cycleId: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/gate");
  const { cycleId } = await params;
  const c = (await proposalsFor(await getDb(), viewer.memberId)).find((x) => x.id === cycleId);
  if (!c) notFound();
  const name = (id: string) =>
    id === viewer.memberId
      ? "You"
      : (c.people.find((p) => p?.id === id)?.displayName.split(" ")[0] ?? "Member");
  const hours = Math.max(0, Math.round((c.expiresAt.getTime() - Date.now()) / 3_600_000));
  const edges = c.edgesNamed;
  const last = edges[edges.length - 1];
  return (
    <Page title={`A swap for ${SIZE[c.members.length]}`}>
      {/* The loop: you teach the next person, they teach the next, and the last teaches you. */}
      <figure aria-label="Who teaches whom" className="grid gap-1 overflow-x-auto">
        <div className="flex items-start">
          {edges.map((e) => (
            <div key={`${e.teacherId}-${e.learnerId}`} className="flex items-start">
              <span
                className={`pt-5 font-pixel text-label whitespace-nowrap ${e.teacherId === viewer.memberId ? "underline underline-offset-4" : ""}`}
              >
                {name(e.teacherId)}
              </span>
              <span className="grid min-w-28 justify-items-center px-1">
                <span className="text-meta whitespace-nowrap">teach {e.skillName}</span>
                <span aria-hidden className="flex w-full items-center">
                  <span className="h-0.5 flex-1 bg-ink" />
                  <span className="border-y-[5px] border-l-[8px] border-y-transparent border-l-ink" />
                </span>
              </span>
            </div>
          ))}
          <span className="pt-5 font-pixel text-label">{name(edges[0].teacherId)}</span>
        </div>
        <div aria-hidden className="mx-3 h-4 border-x-2 border-b-2 border-ink" />
        <figcaption className="sr-only">
          {edges.map((e) => `${name(e.teacherId)} teaches ${name(e.learnerId)} ${e.skillName}`).join("; ")}.
        </figcaption>
        <p className="text-center text-meta">
          and {name(last.teacherId)} teaches{" "}
          {name(last.learnerId).toLowerCase() === "you" ? "you" : name(last.learnerId)} {last.skillName}
        </p>
      </figure>
      <div className="grid gap-1">
        <p>Everyone teaches 1 h and learns 1 h. Net cost: 0 h.</p>
        <p className="tnum text-ink-soft">
          {c.acceptedBy.length} of {c.members.length} have accepted · expires in {hours} h
        </p>
      </div>
      <AcceptSeat cycleId={c.id} accepted={c.acceptedBy.includes(viewer.memberId)} />
    </Page>
  );
}
