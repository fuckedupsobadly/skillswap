import { sql } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/app/_lib/viewer";
import { STATUS_TEXT } from "@/app/(plain)/sessions/status";
import { accept, cancel, decline, dispute, noShow, start } from "@/app/actions/booking";
import { getDb, rows } from "@/db/client";
import { availableActions, START_WINDOW_MIN } from "@/modules/booking/machine";
import { sessionDetail } from "@/modules/booking/service";
import { formatDateTime } from "@/modules/booking/slots";
import { kittyFor, progressFor, xpForBooking } from "@/modules/game/service";
import { formatMinutes } from "@/modules/platform/format";
import { ActionButton } from "@/ui/action-button";
import { AutoRefresh } from "@/ui/auto-refresh";
import { Hours, Mono, Section } from "@/ui/bits";
import { Chat, ConfirmForm } from "./parts";
import { LiveRoom, RoomStrip } from "./room";

export const metadata = { title: "Lantern Room" };

const EXIT_TEXT: Record<string, string> = {
  declined: "The teacher declined. Your hours went back to you.",
  expired: "This session expired before it started. Held hours went back.",
  cancelled: "This session was cancelled. The receipt shows exactly what moved.",
  no_show: "Marked as a no-show. The receipt shows exactly what moved.",
  disputed: "Disputed. The hours stay held until three stewards decide: settle, refund or split.",
};

/**
 * A Lantern Room (§8.5). Live: the calm session layout — video fills the screen, the world shrinks to a strip
 * with the lantern lit, nothing game-like runs. Leaving shows the two-sided confirm screen. Before and after,
 * the room is a quiet panel under the same strip.
 */
export default async function LanternRoom({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/gate");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await getDb();
  const s = await sessionDetail(db, id, viewer.memberId);
  if (!s) notFound();
  const { booking, skill, me, other } = s;
  const [kitty, xp, game, liveOrder] = await Promise.all([
    kittyFor(db, viewer.memberId),
    booking.status === "settled" ? xpForBooking(db, viewer.memberId, id) : null,
    progressFor(db, viewer.memberId),
    db.execute(sql`select id from bookings where status = 'live' order by started_at nulls last, id`),
  ]);
  // The village lights rooms in order of when lessons started, so this room matches the one lit in the world.
  const liveIdx = rows<{ id: string }>(liveOrder).findIndex((r) => r.id === id);
  const room = liveIdx >= 0 ? Math.min(3, liveIdx) : Number.parseInt(id.slice(0, 2), 16) % 4;
  const role = me.p.role;
  const otherFirst = other.m.displayName.split(" ")[0];
  const minutesToStart = (booking.startsAt.getTime() - Date.now()) / 60_000;
  const actions = availableActions(booking.status, role, {
    minutesToStart,
    minutesSinceStart: -minutesToStart,
    selfConfirmed: Boolean(me.p.confirmedAt),
  });
  const canConfirm = booking.status === "live" || (booking.status === "confirming" && !me.p.confirmedAt);
  const waiting =
    (booking.status === "requested" && role === "learner") ||
    (booking.status === "confirming" && Boolean(me.p.confirmedAt)) ||
    booking.status === "accepted";
  const input = { bookingId: booking.id };
  const open = ["requested", "accepted", "live", "confirming"].includes(booking.status);
  const title = `${role === "teacher" ? "Teaching" : "Learning"} ${skill.name} with ${otherFirst}`;
  const tz = viewer.member.timezone;

  const sides = (
    <ul className="grid">
      {[me, other].map((x) => (
        <li
          key={x.m.id}
          className="flex min-h-11 items-center justify-between gap-3 border-t-2 border-paper-shade first:border-t-0"
        >
          <span className="font-pixel text-label">
            {x.m.id === me.m.id ? "You" : x.m.displayName.split(" ")[0]}
          </span>
          <span className={x.p.confirmedAt ? "text-ok" : "text-ink-soft"}>
            {x.p.confirmedAt ? "Confirmed" : "Not yet"}
          </span>
        </li>
      ))}
    </ul>
  );
  const confirm = canConfirm ? (
    <ConfirmForm bookingId={booking.id} otherName={otherFirst} role={role} lengthMin={booking.lengthMin} />
  ) : (
    <p className="text-ink-soft">
      You confirmed. Waiting for {otherFirst}; if they stay silent for 48 h, the session settles on its own.
    </p>
  );
  const chat = (
    <Chat
      bookingId={booking.id}
      me={viewer.memberId}
      messages={s.messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
      names={{ [me.m.id]: "You", [other.m.id]: otherFirst }}
    />
  );
  const wrong = actions.some((a) => ["cancel", "report_no_show", "dispute"].includes(a)) ? (
    <div className="divider grid gap-3 pt-5">
      <h2 className="font-pixel text-label">Something wrong?</h2>
      <div className="flex flex-wrap gap-2">
        {actions.includes("cancel") ? (
          <ActionButton action={cancel} input={input} variant="secondary">
            {minutesToStart < 12 * 60 && booking.status === "accepted"
              ? "Cancel (late, costs hours)"
              : "Cancel"}
          </ActionButton>
        ) : null}
        {actions.includes("report_no_show") ? (
          <ActionButton action={noShow} input={input} variant="secondary">
            {otherFirst} didn't show
          </ActionButton>
        ) : null}
        {actions.includes("dispute") ? (
          <ActionButton action={dispute} input={input} variant="secondary">
            Open a dispute
          </ActionButton>
        ) : null}
      </div>
    </div>
  ) : null;

  if (booking.status === "live" && booking.roomUrl) {
    return (
      <>
        <AutoRefresh everyMs={4000} />
        {/* During a live session the kitty sleeps; it never moves or makes a sound. */}
        <div data-kitty-asleep hidden />
        <LiveRoom
          room={room}
          roomUrl={booking.roomUrl}
          startedAt={booking.startedAt?.toISOString() ?? null}
          lengthMin={booking.lengthMin}
          title={title}
          sides={sides}
          confirm={confirm}
          chat={chat}
          wrong={wrong}
        />
      </>
    );
  }

  return (
    <div className="min-h-dvh bg-paper-shade">
      {waiting ? <AutoRefresh everyMs={2500} /> : null}
      <RoomStrip room={room} lit={false}>
        <div className="grid min-w-0 flex-1 gap-0.5">
          <span className="font-pixel text-label">Lantern Room {room + 1}</span>
          <span className="text-meta text-ink-soft">{STATUS_TEXT[booking.status] ?? booking.status}</span>
        </div>
        <nav aria-label="Leave" className="flex gap-1">
          <Link href="/sessions" className="btn btn-tertiary">
            All sessions
          </Link>
          <a href="/?village=1" className="btn btn-secondary">
            Back to the village
          </a>
        </nav>
      </RoomStrip>
      <main className="mx-auto w-full max-w-[640px] px-4 py-8">
        <article className="panel grid gap-6 p-6">
          <header className="grid gap-1">
            <h1 className="font-name text-name">{title}</h1>
            <p className="tnum text-ink-soft">
              {formatDateTime(booking.startsAt, tz)} · {formatMinutes(booking.lengthMin)}
              {other.m.isSample ? " · Sample member" : ""} ·{" "}
              <Link href={`/u/${other.m.handle}`} className="text-ink underline underline-offset-4">
                {otherFirst}'s profile
              </Link>
            </p>
          </header>

          {booking.status === "requested" && role === "teacher" ? (
            <div className="grid gap-4">
              <p>
                {other.m.displayName} asked you to teach {skill.name}. Accept and you earn{" "}
                <Hours min={booking.lengthMin} /> once you both confirm.
              </p>
              <div className="flex gap-2">
                <ActionButton action={accept} input={input} variant="primary">
                  Accept
                </ActionButton>
                <ActionButton action={decline} input={input} variant="ghost">
                  Decline
                </ActionButton>
              </div>
            </div>
          ) : null}
          {booking.status === "requested" && role === "learner" ? (
            <p className="text-ink-soft">
              Waiting for {otherFirst} to accept. <Hours min={me.p.costMin} /> held meanwhile.
            </p>
          ) : null}
          {booking.status === "accepted" ? (
            actions.includes("start") ? (
              <div className="grid justify-items-start gap-3">
                <p>The room is open. Light the lantern when you're both ready.</p>
                <div data-kitty-join>
                  <ActionButton action={start} input={input} variant="primary">
                    Start the lesson
                  </ActionButton>
                </div>
              </div>
            ) : (
              <p className="text-ink-soft">
                Booked. The room opens {START_WINDOW_MIN} minutes before the start.
                {role === "learner" ? (
                  <>
                    {" "}
                    <Hours min={me.p.costMin} /> held.
                  </>
                ) : null}
              </p>
            )
          ) : null}
          {booking.status === "confirming" ? (
            <div className="grid gap-4">
              <h2 className="font-pixel text-label">Both sides confirm</h2>
              {sides}
              {confirm}
            </div>
          ) : null}
          {booking.status === "settled" ? (
            <div className="grid gap-1">
              <p className="font-medium text-ok">Settled. You both confirmed.</p>
              <p className="text-ink-soft">
                {role === "teacher" ? (
                  <>
                    You earned <Hours min={booking.lengthMin} />.
                  </>
                ) : (
                  <>
                    You spent <Hours min={me.p.costMin} />.
                  </>
                )}{" "}
                Each confirmation is signed by that person's device.
              </p>
              {/* Game notices stay out of the room itself; this is after the lesson, and only if you want them. */}
              {xp && xp.total > 0 && game.settings.notices ? (
                <p className="text-meta text-ink-soft">
                  +{xp.total} XP{kitty ? ` · ${kitty.name} got a treat` : ""}
                </p>
              ) : null}
            </div>
          ) : null}
          {EXIT_TEXT[booking.status] ? <p className="text-ink-soft">{EXIT_TEXT[booking.status]}</p> : null}

          {open && booking.status !== "confirming" ? <Section title="Messages">{chat}</Section> : null}
          {wrong}

          {s.entries.length ? (
            <Section title="Receipt">
              <ol className="grid">
                {s.entries.map((e) => (
                  <li key={e.seq} className="border-t-2 border-paper-shade first:border-t-0">
                    <Link href={`/bank/${e.id}`} className="group flex min-h-11 items-baseline gap-3 py-2">
                      <span className="min-w-0 flex-1 group-hover:underline group-hover:underline-offset-4 first-letter:uppercase">
                        {e.kind.replace("_", " ")}
                      </span>
                      <span className="tnum text-meta text-ink-soft">#{e.seq}</span>
                      <Hours min={e.amountMin} className="w-16 text-right font-medium" />
                    </Link>
                  </li>
                ))}
              </ol>
            </Section>
          ) : null}

          {[me, other].some((x) => x.p.signature) ? (
            <Section title="Signatures">
              <ul className="grid gap-3">
                {[me, other]
                  .filter((x) => x.p.signature)
                  .map((x) => (
                    <li key={x.m.id} className="grid gap-1">
                      <span className="text-meta">
                        {x.m.id === me.m.id ? "You" : x.m.displayName} · key {x.p.signerKey}
                      </span>
                      <Mono>{x.p.signedPayload}</Mono>
                    </li>
                  ))}
              </ul>
            </Section>
          ) : null}
        </article>
      </main>
    </div>
  );
}
