"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { setOnboardingStep } from "@/app/actions/village";
import { PLOTS } from "@/modules/village/map";
import { FIRST_STEP_COUNT, FIRST_STEPS } from "@/modules/village/onboarding";
import { PixelIcon } from "../pixel/icons";
import { loadVillageState, village } from "./store";

/**
 * The first-time guide (§11 made explicit). Two parts:
 *  · a short spotlight tour of the HUD, shown once when you first step into the world (and from Menu → Guide);
 *  · the "First steps" card: where you are in the seven steps, what to do next, and "Take me there".
 * The world draws the matching arrow and footprints from `village.waypoint`.
 */

const TOUR_KEY = "ss.tour.v1";
export const tourSeen = () => {
  try {
    return localStorage.getItem(TOUR_KEY) === "done";
  } catch {
    return false;
  }
};
const markTourSeen = () => {
  try {
    localStorage.setItem(TOUR_KEY, "done");
  } catch {
    /* private mode: the tour may show again, which is fine */
  }
};

type TourStep = {
  target: string | null;
  title: string;
  body: React.ReactNode;
  icon: Parameters<typeof PixelIcon>[0]["name"];
};

const LIT = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    shapeRendering="crispEdges"
    aria-hidden
    className="inline-block align-[-2px]"
  >
    <rect x="4" y="2" width="8" height="1" fill="var(--ink)" />
    <rect x="3" y="3" width="10" height="10" fill="var(--ink)" />
    <rect x="4" y="4" width="8" height="8" fill="var(--lantern)" />
    <rect x="7" y="6" width="2" height="4" fill="var(--lantern-glow)" />
  </svg>
);

const STEPS: TourStep[] = [
  {
    target: "[data-guide=player]",
    icon: "steps",
    title: "This is you",
    body: (
      <>
        Walk with <kbd className="keycap">W</kbd> <kbd className="keycap">A</kbd>{" "}
        <kbd className="keycap">S</kbd> <kbd className="keycap">D</kbd> or the arrow keys, or click where you
        want to go. Hold <kbd className="keycap">Shift</kbd> to run. Walking is for fun: nothing ever needs
        it.
      </>
    ),
  },
  {
    target: "[data-guide=prompt-zone]",
    icon: "search",
    title: "Talk, read, enter",
    body: (
      <>
        Stand next to anything and a prompt appears here. Press <kbd className="keycap">E</kbd> or click it to
        talk to a neighbour, read a sign or go inside.
      </>
    ),
  },
  {
    target: "[data-guide=balance]",
    icon: "hourglass",
    title: "Your hours",
    body: "Teach an hour, earn an hour. You start with 2 h and may go down to −2 h to learn first. Click it to open the Bank.",
  },
  {
    target: "[data-guide=map]",
    icon: "map",
    title: "The map",
    body: (
      <>
        Every place is one click away: open the map and pick one. Shortcut <kbd className="keycap">M</kbd>;{" "}
        <kbd className="keycap">/</kbd> searches skills, people and places.
      </>
    ),
  },
  {
    target: "[data-guide=fullscreen]",
    icon: "expand",
    title: "Full screen",
    body: (
      <>
        Give the village the whole display. Press <kbd className="keycap">F</kbd> any time;{" "}
        <kbd className="keycap">Esc</kbd> brings the browser back.
      </>
    ),
  },
  {
    target: "[data-guide=menu]",
    icon: "menu",
    title: "Menu",
    body: "Mailbox, lessons, your hut, settings — and Plain mode, which shows the same village as simple pages. This guide lives here too.",
  },
  {
    target: "[data-guide=quest]",
    icon: "steps",
    title: "First steps",
    body: "Your next step is always written here. “Take me there” does the walking for you, and footprints show the way if you'd rather walk.",
  },
  {
    target: null,
    icon: "lantern",
    title: "One colour means “now”",
    body: (
      <>
        A gold lantern {LIT} in a window means that person is free to teach right now. A gold button means you
        can do it now. That's the only gold in the village.
      </>
    ),
  },
];

const PAD = 8;

/** Spotlight tour over the HUD. Esc skips, ← → step, Enter goes on. */
export function Tour() {
  const open = useSyncExternalStore(
    village.subscribe,
    () => village.get().tour,
    () => false,
  );
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  // the card's real height, measured after it renders, so it sits exactly above or below its target
  const [ch, setCh] = useState(250);
  const card = useRef<HTMLDivElement>(null);
  const steps = STEPS.filter(
    (s) => !s.target || typeof document === "undefined" || document.querySelector(s.target),
  );
  const step = steps[Math.min(i, steps.length - 1)];
  const finish = useCallback(() => {
    markTourSeen();
    setI(0);
    village.set({ tour: false });
  }, []);
  useLayoutEffect(() => {
    if (!open || !step) return;
    const measure = () => {
      const el = step.target ? document.querySelector(step.target) : null;
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, step]);
  useEffect(() => {
    if (!open) return;
    card.current?.querySelector<HTMLElement>("[data-next]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight") setI((x) => Math.min(x + 1, steps.length - 1));
      else if (e.key === "ArrowLeft") setI((x) => Math.max(x - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, finish, steps.length]);
  // each new step puts focus back on its "Next" button
  useEffect(() => {
    if (i >= 0) card.current?.querySelector<HTMLElement>("[data-next]")?.focus();
  }, [i]);
  if (!open || !step) return null;
  const last = i >= steps.length - 1;
  const measureCard = (el: HTMLDivElement | null) => {
    card.current = el;
    if (el && Math.abs(el.offsetHeight - ch) > 1) setCh(el.offsetHeight);
  };
  // Place the card beside the spotlight: below it if there's room, otherwise above; centred when no target.
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const W = Math.min(380, vw - 32);
  let left = vw / 2 - W / 2;
  let top = vh / 2 - ch / 2;
  let arrow: "up" | "down" | null = null;
  if (rect) {
    left = Math.max(16, Math.min(vw - W - 16, rect.left + rect.width / 2 - W / 2));
    if (rect.bottom + PAD + 16 + ch + 16 < vh) {
      top = rect.bottom + PAD + 16;
      arrow = "up";
    } else {
      top = Math.max(16, rect.top - PAD - 16 - ch);
      arrow = "down";
    }
  }
  const ax = rect ? Math.max(left + 20, Math.min(left + W - 20, rect.left + rect.width / 2)) - left : 0;
  return (
    <div className="fixed inset-0 z-[70]" role="presentation">
      {/* the dimmed world with a hole cut around what we're talking about */}
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none fixed border-2 border-paper outline-2 outline-ink transition-all duration-200 ease-[steps(4)] motion-reduce:transition-none"
          style={{
            left: rect.left - PAD,
            top: rect.top - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgb(43 27 51 / 0.58)",
          }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-[rgb(43_27_51/0.58)]" />
      )}
      <div
        ref={measureCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        // one column pinned to the card: nothing inside may widen it (that's what pushed text out of bounds)
        className="panel parchment fixed grid grid-cols-[minmax(0,1fr)] gap-3 px-5 pt-5 pb-4 anim-sheet"
        style={{ left, top, width: W }}
      >
        {arrow ? (
          <span
            aria-hidden
            className="absolute size-0 border-x-[9px] border-x-transparent"
            style={{
              left: ax - 9,
              ...(arrow === "up"
                ? { top: -13, borderBottom: "9px solid var(--ink)" }
                : { bottom: -13, borderTop: "9px solid var(--ink)" }),
            }}
          />
        ) : null}
        <div className="flex items-center gap-2.5">
          <span className="window grid size-9 shrink-0 place-items-center">
            <PixelIcon name={step.icon} size={16} />
          </span>
          <h2 id="tour-title" className="font-name text-name">
            {step.title}
          </h2>
        </div>
        <p className="leading-relaxed">{step.body}</p>
        {/* progress on its own row, the buttons below it, so the footer never needs more room than the card */}
        <div className="grid gap-2 pt-1">
          <div className="flex items-center gap-3">
            <ol aria-hidden className="flex gap-1">
              {steps.map((s, k) => (
                <li key={s.title} className={`h-1.5 ${k === i ? "w-5 bg-ink" : "w-2 bg-paper-shade"}`} />
              ))}
            </ol>
            <span className="tnum text-meta text-ink-soft">
              {i + 1} of {steps.length}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" className="btn btn-tertiary mr-auto -ml-2" onClick={finish}>
              Skip tour
            </button>
            {i > 0 ? (
              <button type="button" className="btn btn-secondary" onClick={() => setI(i - 1)}>
                Back
              </button>
            ) : null}
            <button
              type="button"
              data-next
              className="btn btn-primary"
              onClick={() => (last ? finish() : setI(i + 1))}
            >
              {last ? "Start" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** "First steps": the seven onboarding steps, the current one explained, and one button that does it. */
export function QuestCard() {
  const router = useRouter();
  const v = useSyncExternalStore(village.subscribe, village.get, village.get);
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const step = v.state?.viewer.onboardingStep ?? 99;
  if (!v.ready || step < 4 || step > FIRST_STEP_COUNT || v.scene !== "village") return null;
  const current = FIRST_STEPS[step - 1];
  const own = v.state?.huts.find((h) => h.isYou);
  const takeMeThere = () => {
    if (step === 4) village.command({ c: "travel", to: { placeId: "well" } });
    if (step === 5) router.push("/well?first=1");
    if (step === 6) router.push("/board?teach=1");
    if (step === 7) {
      if (own) village.command({ c: "travel", to: { handle: own.handle } });
      village.set({ dialog: { kind: "own-hut" } });
    }
  };
  const skip = async () => {
    setBusy(true);
    await setOnboardingStep({ step: step + 1 > FIRST_STEP_COUNT ? 99 : step + 1 });
    const s = await loadVillageState();
    if (s) village.set({ state: s });
    setBusy(false);
  };
  return (
    <section
      data-guide="quest"
      aria-label="First steps"
      className="panel parchment pointer-events-auto w-[312px] anim-sheet"
    >
      <header className="flex items-center gap-2 px-4 pt-3 pb-2">
        <PixelIcon name="steps" size={16} />
        <h2 className="font-pixel text-label">First steps</h2>
        <span className="tnum text-meta text-ink-soft">
          {step} of {FIRST_STEP_COUNT}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          className="btn btn-tertiary -mr-2 size-9 min-h-9 min-w-9 p-0"
          aria-expanded={open}
          aria-label={open ? "Fold the first steps" : "Unfold the first steps"}
          onClick={() => setOpen(!open)}
        >
          <span
            aria-hidden
            className={`inline-block font-sans transition-transform ${open ? "" : "-rotate-90"}`}
          >
            ▾
          </span>
        </button>
      </header>
      {open ? (
        <ol className="grid gap-0.5 px-4 pb-1">
          {FIRST_STEPS.map((s) => {
            const done = s.n < step;
            const now = s.n === step;
            return (
              <li key={s.n} className={`flex items-center gap-2.5 py-0.5 ${now ? "" : "text-ink-soft"}`}>
                <span
                  aria-hidden
                  className={`grid size-4 shrink-0 place-items-center border-2 border-ink ${done ? "bg-ink text-paper" : now ? "bg-paper" : "border-ink-soft bg-paper"}`}
                >
                  {done ? (
                    <svg width="8" height="8" viewBox="0 0 8 8" shapeRendering="crispEdges">
                      <path d="M1 4h1v1h1v1h1V5h1V4h1V3h1V2H6v1H5v1H4v1H3V4H2V3H1z" fill="var(--paper)" />
                    </svg>
                  ) : now ? (
                    <span className="size-1.5 bg-ink" />
                  ) : null}
                </span>
                <span className={now ? "font-semibold" : done ? "line-through decoration-ink-soft/60" : ""}>
                  {s.title}
                  <span className="sr-only">{done ? " (done)" : now ? " (now)" : ""}</span>
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}
      <div className="grid gap-3 border-t-2 border-dashed border-paper-shade px-4 pt-3 pb-4">
        <p className="text-meta">
          <span className="font-semibold">{current.title}. </span>
          {current.how}
        </p>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-secondary" onClick={takeMeThere} disabled={busy}>
            <PixelIcon name="map" size={16} />
            Take me there
          </button>
          <button type="button" className="btn btn-tertiary" onClick={skip} disabled={busy}>
            Skip
          </button>
        </div>
      </div>
    </section>
  );
}

/** The world points at the current step's place: the Well for step 4, your own hut for step 7. */
export function useGuideWaypoint() {
  const v = useSyncExternalStore(village.subscribe, village.get, village.get);
  const step = v.state?.viewer.onboardingStep ?? 99;
  const own = v.state?.huts.find((h) => h.isYou);
  const plot = own ? own.plot : null;
  useEffect(() => {
    let w: { x: number; y: number; label: string } | null = null;
    if (step === 4) w = { x: 31, y: 24, label: "Wishing Well" };
    const p = plot !== null ? PLOTS[plot] : null;
    if (step === 7 && p) w = { x: p.x + 1, y: p.y + 3, label: "Your hut" };
    const cur = village.get().waypoint;
    if (cur?.x !== w?.x || cur?.y !== w?.y) village.set({ waypoint: w });
  }, [step, plot]);
}
