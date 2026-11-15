"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { sendNote, setOnboardingStep, setPresence } from "@/app/actions/village";
import { formatHours, formatMinutes, levelName } from "@/modules/platform/format";
import { BARKEEP_LOOK } from "@/modules/village/art/people";
import type { MemberCard } from "@/modules/village/service";
import { PixelIcon } from "../pixel/icons";
import { Portrait } from "../portrait";
import { type Dialog, village } from "./store";

const timeIn = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  }).format(new Date(iso));
const hhmm = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(
    new Date(iso),
  );

/** One line, then a choice (§2.4). Esc closes. */
export function Dialogues() {
  const d = useSyncExternalStore(
    village.subscribe,
    () => village.get().dialog,
    () => null,
  );
  useEffect(() => {
    if (!d) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && village.set({ dialog: null });
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [d]);
  if (!d) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-6">
      <DialogBody d={d} />
    </div>
  );
}

function DialogBody({ d }: { d: Dialog }) {
  if (d.kind === "member" || d.kind === "sign")
    return <MemberDialog handle={d.handle} sign={d.kind === "sign"} />;
  if (d.kind === "barkeep") return <Barkeep />;
  if (d.kind === "chalkboard") return <Chalkboard />;
  return <HutIntro />;
}

const close = () => village.set({ dialog: null });

function Frame({
  portrait,
  nameplate,
  children,
  label,
}: {
  portrait?: React.ReactNode;
  nameplate: React.ReactNode;
  children: React.ReactNode;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button, a, textarea")?.focus();
  }, []);
  return (
    <div ref={ref} role="dialog" aria-label={label} className="w-full max-w-[680px] anim-sheet">
      {/* Portrait and nameplate sit above the box (§6.3), leaving the box for words and actions: the
          portrait in a wooden frame, the name on a plank hung over the box's edge. */}
      <div className="relative z-10 flex items-end gap-3 pl-6">
        {portrait ? (
          <div className="sign p-1.5">
            <div className="window">{portrait}</div>
          </div>
        ) : null}
        <div className="sign mb-[-14px] px-3.5 pt-1.5 pb-2">{nameplate}</div>
      </div>
      <div className="panel parchment relative -mt-1 grid gap-4 px-7 pt-8 pb-4">
        <button
          type="button"
          onClick={close}
          aria-label="Close (Esc)"
          title="Close · Esc"
          className="btn btn-tertiary absolute top-1.5 right-1.5 size-11 p-0"
        >
          <PixelIcon name="close" size={16} />
        </button>
        {children}
        <p className="justify-self-end text-meta text-ink-soft">
          <kbd className="keycap mr-1">Esc</kbd> close
        </p>
      </div>
    </div>
  );
}

function MemberDialog({ handle, sign }: { handle: string; sign: boolean }) {
  const router = useRouter();
  const [m, setM] = useState<MemberCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const tz = village.get().state?.viewer.timezone ?? "UTC";
  useEffect(() => {
    let ok = true;
    void fetch(`/api/v1/village/member/${encodeURIComponent(handle)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("This member's hut is closed right now."))))
      .then((x) => ok && setM(x))
      .catch((e: Error) => ok && setError(e.message));
    return () => {
      ok = false;
    };
  }, [handle]);
  if (error)
    return (
      <Frame label="Member" nameplate={<span className="font-name text-name">Hut</span>}>
        {
          <>
            <p>{error}</p>
            <div>
              <button type="button" className="btn btn-secondary" onClick={close}>
                Close
              </button>
            </div>
          </>
        }
      </Frame>
    );
  if (!m)
    return (
      <Frame label="Loading" nameplate={<span className="font-pixel text-label text-ink-soft">…</span>}>
        <p className="text-ink-soft">Knocking…</p>
      </Frame>
    );
  const first = m.name.split(" ")[0];
  const offer = m.teaches.find((t) => t.offerId);
  const len = offer?.lengths.includes(30) ? 30 : (offer?.lengths[0] ?? 60);
  const free = m.presence === "free";
  const go = (href: string) => {
    close();
    router.push(href);
  };
  const nameplate = (
    <div className="grid gap-0.5">
      <p>
        <span className="font-name text-name">{sign ? `${first}'s hut` : first}</span>
        <span className="text-body">
          {" "}
          · {m.presenceLabel}
          {m.backAt ? ` · back ${hhmm(m.backAt, tz)}` : ""} · Trust {m.trustLevel}
          {m.isSample ? " · Sample" : ""}
        </span>
      </p>
      <p className="text-meta">
        {m.teaches.length ? `Teaches ${m.teaches.map((t) => t.name).join(", ")}` : "Not teaching yet"}
        {m.rating !== null ? ` · ${m.rating.toFixed(1)} (${m.reviews})` : ""}
      </p>
    </div>
  );
  const noteBox =
    note !== null ? (
      <form
        className="grid gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await sendNote({ to: m.handle, body: note });
          if (!r.ok) return setError(r.error);
          setSent(true);
          setNote(null);
        }}
      >
        <label htmlFor="note" className="field-label">
          Note for {first}
        </label>
        <textarea
          id="note"
          className="field min-h-20"
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary" disabled={!note.trim()}>
            Leave the note
          </button>
          <button type="button" className="btn btn-tertiary" onClick={() => setNote(null)}>
            Cancel
          </button>
        </div>
      </form>
    ) : null;

  if (sign) {
    // §6.4: talk to the hut sign when the member is away — everything needed to book is here.
    return (
      <Frame
        label={`${first}'s hut`}
        portrait={<Portrait look={m.look} label={m.name} size={64} />}
        nameplate={nameplate}
      >
        <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-1">
          <dt className="field-label">Teaches</dt>
          <dd>
            {m.teaches.length
              ? m.teaches.map((t) => `${t.name} (${levelName(t.level).toLowerCase()})`).join(" · ")
              : "Nothing yet"}
          </dd>
          {m.learning.length ? (
            <>
              <dt className="field-label">Learning</dt>
              <dd>{m.learning.join(", ")}</dd>
            </>
          ) : null}
          <dt className="field-label">Next free</dt>
          <dd className="tnum">
            {m.nextFree.length
              ? m.nextFree.map((s) => timeIn(s, tz)).join(" · ")
              : "No shared time this week"}
          </dd>
        </dl>
        {noteBox}
        {sent ? <p className="text-ok">Note left in {first}'s mailbox.</p> : null}
        {note === null ? (
          <div className="flex flex-wrap gap-2">
            {offer && m.nextFree[0] ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  go(`/book/${offer.offerId}?at=${encodeURIComponent(m.nextFree[0])}&len=${len}`)
                }
              >
                Book {timeIn(m.nextFree[0], tz)}
              </button>
            ) : null}
            {offer ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => go(`/book/${offer.offerId}`)}
              >
                Other times
              </button>
            ) : null}
            {!m.isYou ? (
              <button type="button" className="btn btn-secondary" onClick={() => setNote("")}>
                Leave a note
              </button>
            ) : null}
          </div>
        ) : null}
      </Frame>
    );
  }
  return (
    <Frame label={first} portrait={<Portrait look={m.look} label={m.name} size={64} />} nameplate={nameplate}>
      {/* The quote is the member's own status line; if empty, no quote — just their skills above. */}
      {m.statusLine ? <p className="text-body">“{m.statusLine}”</p> : null}
      {noteBox}
      {sent ? <p className="text-ok">Note left in {first}'s mailbox.</p> : null}
      {note === null ? (
        <div className="flex flex-wrap gap-2">
          {offer ? (
            <button
              type="button"
              className={free ? "btn btn-primary" : "btn btn-secondary"}
              onClick={() => go(`/book/${offer.offerId}?len=${len}${free ? "&now=1" : ""}`)}
            >
              Book {formatMinutes(len)} · {formatHours(len)}
            </button>
          ) : null}
          <button type="button" className="btn btn-secondary" onClick={() => setNote("")}>
            Leave a note
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => go(`/u/${m.handle}`)}>
            Profile
          </button>
        </div>
      ) : null}
    </Frame>
  );
}

const BARKEEP_LINE =
  "Evening! I'm the Barkeep — an AI, not a member. I can read a wish, explain a match, or draft a booking for you to approve.";

function Barkeep() {
  const router = useRouter();
  const reduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [n, setN] = useState(reduced ? BARKEEP_LINE.length : 0);
  useEffect(() => {
    if (n >= BARKEEP_LINE.length) return;
    // The only typewriter in the village: scripted greetings, skippable with any key (§6.3).
    const skip = () => setN(BARKEEP_LINE.length);
    window.addEventListener("keydown", skip, { once: true });
    const t = window.setTimeout(() => setN((x) => x + 2), 22);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", skip);
    };
  }, [n]);
  const go = (href: string) => {
    close();
    router.push(href);
  };
  return (
    <Frame
      label="The Barkeep"
      portrait={<Portrait look={BARKEEP_LOOK} label="The Barkeep" size={64} />}
      nameplate={<span className="font-name text-name">Barkeep · AI</span>}
    >
      <p className="min-h-12 text-body" aria-live="polite">
        {BARKEEP_LINE.slice(0, n)}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={() => go("/well")}>
          Make a wish
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => go("/tavern/barkeep")}>
          Explain my matches
        </button>
        <button type="button" className="btn btn-tertiary" onClick={close}>
          Not now
        </button>
      </div>
    </Frame>
  );
}

function Chalkboard() {
  return (
    <Frame label="Chalkboard" nameplate={<span className="font-name text-name">Group classes</span>}>
      <p>
        No group classes on the chalkboard yet. When enough people wish for the same skill, the matcher
        proposes one here and a pool opens.
      </p>
      <div>
        <button type="button" className="btn btn-secondary" onClick={close}>
          Close
        </button>
      </div>
    </Frame>
  );
}

/** Onboarding step 7: "This is your hut. Light the lantern when you're free to teach." */
function HutIntro() {
  const done = async (light: boolean) => {
    if (light) await setPresence({ status: "free" });
    await setOnboardingStep({ step: 99 });
    close();
    village.command({ c: "reload" });
  };
  return (
    <Frame label="Your hut" nameplate={<span className="font-name text-name">Your hut</span>}>
      <p>This is your hut. Light the lantern when you're free to teach.</p>
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary" onClick={() => done(true)}>
          Light lantern
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => done(false)}>
          Later
        </button>
      </div>
    </Frame>
  );
}
