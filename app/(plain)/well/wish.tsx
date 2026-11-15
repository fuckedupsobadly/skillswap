"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { parseText, postRequest } from "@/app/actions/market";
import { setOnboardingStep } from "@/app/actions/village";
import type { ParsedRequest } from "@/modules/ai/concierge";
import { formatMinutes, levelName } from "@/modules/platform/format";
import { well } from "@/modules/village/art/buildings";
import { FormError } from "@/ui/field";
import { ShowOnMap } from "@/ui/show-on-map";
import { useToWorld } from "@/ui/to-world";
import { Dots } from "../board/parts";

const LEVELS = [
  { v: 1, label: "New to it" },
  { v: 2, label: "A little" },
  { v: 3, label: "Comfortable" },
] as const;

export function WishForm({
  when,
  ai,
  first,
  initial,
}: {
  when: string;
  ai: boolean;
  first: boolean;
  initial: string;
}) {
  const toWorld = useToWorld();
  const [text, setText] = useState(initial);
  const [level, setLevel] = useState(2);
  const [how, setHow] = useState({ live: true, in_person: false, async: false });
  const [parsed, setParsed] = useState<ParsedRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tossed, setTossed] = useState<{
    lit: { handle: string; name: string; isSample: boolean }[];
    swaps: number;
  } | null>(null);
  const [pending, start] = useTransition();
  const timer = useRef(0);

  // The Barkeep reads the wish as you type (debounced).
  useEffect(() => {
    clearTimeout(timer.current);
    if (text.trim().length < 3) return setParsed(null);
    timer.current = window.setTimeout(async () => {
      const r = await parseText({ text });
      if (r.ok) {
        setParsed(r.data);
        if (r.data.level) setLevel(Math.min(3, Math.max(1, r.data.level)));
      }
    }, 450);
    return () => clearTimeout(timer.current);
  }, [text]);

  const format = how.live ? "live" : how.in_person ? "in_person" : how.async ? "async" : "live";
  const reader =
    parsed?.engine === "ai" && ai
      ? "The Barkeep (AI) read this as"
      : "The Barkeep read this with simple rules (no AI model is set up) as";

  if (tossed)
    return (
      <div className="grid justify-items-start gap-4">
        {first ? <Dots step={5} /> : null}
        <Coin />
        <p>
          Your wish is in the Well. When a match appears, the Well glints and a note lands in your mailbox.
        </p>
        {tossed.lit.length ? (
          <div className="grid w-full gap-2">
            <p className="font-pixel text-label">Lantern lit right now</p>
            <ul className="grid gap-2">
              {tossed.lit.map((t) => (
                <li key={t.handle} className="card flex min-h-14 items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{t.name}</span>
                    <span className="text-meta text-ink-soft">
                      {" "}
                      · Free now{t.isSample ? " · Sample" : ""}
                    </span>
                  </span>
                  <ShowOnMap handle={t.handle} className="btn btn-secondary" />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="flex gap-2">
          <Link href="/tavern" className="btn btn-secondary">
            {tossed.swaps ? "See your swap" : "See swaps"}
          </Link>
          <button type="button" className="btn btn-tertiary" onClick={() => toWorld()}>
            Back to the village
          </button>
        </div>
      </div>
    );

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!parsed?.skill)
          return setError(
            "The Barkeep couldn't place that wish. Try naming the skill, like “guitar chords”.",
          );
        if (parsed.excluded) return setError(parsed.excluded);
        start(async () => {
          setError(null);
          const r = await postRequest({
            skillId: parsed.skill!.id,
            level,
            format,
            lengthMin: parsed.lengthMin,
            text,
            confidence: parsed.confidence,
            parsedBy: parsed.engine,
          });
          if (!r.ok) return setError(r.error);
          if (first) await setOnboardingStep({ step: 6 });
          setTossed({ lit: r.data.lit, swaps: r.data.swaps });
        });
      }}
    >
      {first ? <Dots step={5} /> : null}
      <div className="grid gap-1.5">
        <label htmlFor="wish" className="field-label">
          I want to learn
        </label>
        <input
          id="wish"
          className="field"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="chords for one song on guitar"
          maxLength={500}
          autoComplete="off"
        />
      </div>
      <fieldset className="grid grid-cols-[72px_1fr] items-center gap-x-3 gap-y-3">
        <legend className="sr-only">Details</legend>
        <span className="field-label">Level</span>
        <div className="flex flex-wrap gap-x-4 gap-y-1" role="radiogroup" aria-label="Level">
          {LEVELS.map((l) => (
            <label key={l.v} className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                name="level"
                className="size-4 accent-[var(--ink)]"
                checked={level === l.v}
                onChange={() => setLevel(l.v)}
              />
              {l.label}
            </label>
          ))}
        </div>
        <span className="field-label">How</span>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {(
            [
              ["live", "Video"],
              ["in_person", "In person"],
              ["async", "Send my work"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                className="size-4 accent-[var(--ink)]"
                checked={how[k]}
                onChange={(e) => setHow({ ...how, [k]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
        <span className="field-label">When</span>
        <div className="flex flex-wrap items-center gap-3">
          <span>{when}</span>
          <Link href="/hut#availability" className="btn btn-tertiary">
            change
          </Link>
        </div>
      </fieldset>
      <p className="min-h-6 text-body text-ink-soft" aria-live="polite">
        {parsed?.excluded
          ? parsed.excluded
          : parsed?.skill
            ? `${reader}: ${parsed.skill.name} · ${levelName(level)} · ${formatMinutes(parsed.lengthMin)}`
            : text.trim().length >= 3
              ? "The Barkeep is reading…"
              : ""}
      </p>
      <FormError message={error} />
      <div className="flex justify-end gap-2">
        {first ? (
          <button
            type="button"
            className="btn btn-tertiary"
            onClick={async () => {
              await setOnboardingStep({ step: 6 });
              toWorld();
            }}
          >
            Skip
          </button>
        ) : null}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={pending || !parsed?.skill || Boolean(parsed?.excluded)}
        >
          {pending ? "Tossing…" : "Toss the coin · 0 h now"}
        </button>
      </div>
    </form>
  );
}

/** The coin, 6 frames, once (§8.1). */
/**
 * The coin (§8.1): the real Well, drawn by the same art as the world. A coin drops in over six frames,
 * splashes, and the water glints. Plays once; reduced motion shows the glint straight away.
 */
function Coin() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const toCanvas = (p: ReturnType<typeof well>) => {
      const k = document.createElement("canvas");
      k.width = p.w;
      k.height = p.h;
      k.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(p.data), p.w, p.h), 0, 0);
      return k;
    };
    const still = toCanvas(well(3, false));
    const glint = toCanvas(well(4, true));
    const frame = (f: number) => {
      ctx.clearRect(0, 0, 48, 64);
      ctx.drawImage(f >= 8 ? glint : still, 0, 16);
      if (f < 6) {
        // the coin, falling into the basin
        const y = 2 + f * 7;
        ctx.fillStyle = "#2b1b33";
        ctx.fillRect(22, y - 1, 4, 5);
        ctx.fillStyle = "#e3c26b";
        ctx.fillRect(23, y, 2, 3);
      } else if (f < 8) {
        // a splash ring on the water
        ctx.fillStyle = "#e9f4fb";
        const r = f === 6 ? 3 : 6;
        ctx.fillRect(24 - r, 54, r * 2, 1);
        ctx.fillRect(24 - r + 1, 56, r * 2 - 2, 1);
      }
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return frame(8);
    let f = 0;
    frame(0);
    const t = window.setInterval(() => {
      f++;
      frame(f);
      if (f >= 8) clearInterval(t);
    }, 100);
    return () => clearInterval(t);
  }, []);
  return (
    <canvas
      ref={ref}
      width={48}
      height={64}
      aria-hidden
      className="window"
      style={{ width: 96, height: 128, imageRendering: "pixelated", background: "var(--stone)" }}
    />
  );
}
