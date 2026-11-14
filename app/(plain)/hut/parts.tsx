"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { saveHutLook, setPresence } from "@/app/actions/village";
import type { HutLook } from "@/db/schema";
import * as B from "@/modules/village/art/buildings";
import { fieldKitty } from "@/modules/village/art/people";
import type { Px } from "@/modules/village/art/pixels";
import { ChoiceRow } from "@/ui/choice";
import { FormError } from "@/ui/field";
import { PixelIcon } from "@/ui/pixel/icons";
import { village } from "@/ui/village/store";

type Status = "free" | "busy" | "away";

const STATUS: { id: Status; label: string; line: string }[] = [
  { id: "free", label: "Free now", line: "Anyone can book a lesson that starts now." },
  { id: "busy", label: "Busy", line: "Closed sign on the door. People leave a note or book later." },
  { id: "away", label: "Away", line: "People book from the hours you're usually around." },
];

/**
 * The lantern (§4, §11 step 7). Status is only ever chosen by you; AFK after 10 idle minutes and
 * "In a lesson" during a booked session are automatic. The quote is your own line in your dialogue box.
 */
export function LanternForm({ status: s0, statusLine: l0 }: { status: Status; statusLine: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(s0);
  const [line, setLine] = useState(l0);
  const [saved, setSaved] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = (next: Status, nextLine = line) =>
    start(async () => {
      setError(null);
      const r = await setPresence({ status: next, statusLine: nextLine });
      if (!r.ok) return setError(r.error);
      setSaved(next);
      village.command({ c: "reload" });
      router.refresh();
    });
  const pick = (next: Status) => {
    setStatus(next);
    save(next);
  };
  const lit = status === "free";
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        {/* The lantern is gold only when it is really lit: a teacher available now. */}
        <svg width="32" height="32" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden>
          <rect x="6" y="1" width="4" height="1" fill="var(--ink)" />
          <rect x="7" y="2" width="2" height="1" fill="var(--ink)" />
          <rect x="4" y="3" width="8" height="1" fill="var(--ink)" />
          <rect x="3" y="4" width="1" height="8" fill="var(--ink)" />
          <rect x="12" y="4" width="1" height="8" fill="var(--ink)" />
          <rect x="4" y="4" width="8" height="8" fill={lit ? "var(--lantern)" : "var(--paper-shade)"} />
          <rect x="7" y="6" width="2" height="4" fill={lit ? "var(--lantern-glow)" : "var(--stone)"} />
          <rect x="4" y="12" width="8" height="1" fill="var(--ink)" />
          <rect x="5" y="13" width="6" height="1" fill="var(--ink)" />
        </svg>
        <p className="min-w-0 flex-1">
          <span className="font-pixel text-label">
            {lit ? "Lantern lit" : status === "busy" ? "Lantern out" : "Hut dark"}
          </span>
          <span className="block text-meta text-ink-soft">{STATUS.find((x) => x.id === status)!.line}</span>
        </p>
      </div>
      <ChoiceRow
        name="status"
        legend="Your status"
        value={status}
        disabled={pending}
        options={STATUS.map((o) => ({ value: o.id, label: o.label }))}
        onChange={pick}
      />
      <form
        className="grid gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          save(status);
        }}
      >
        <label htmlFor="status-line" className="font-pixel text-label">
          Your line
        </label>
        <div className="flex gap-2">
          <input
            id="status-line"
            className="field"
            maxLength={80}
            value={line}
            placeholder="I'm around till 19:00 if you want a chord lesson."
            onChange={(e) => setLine(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary" disabled={pending || line === l0}>
            Save
          </button>
        </div>
        <p className="text-meta text-ink-soft">
          Quoted in your dialogue box. Leave it empty and people just see your skills.
        </p>
      </form>
      <FormError message={error} />
      <p className="sr-only" aria-live="polite">
        {saved ? `Status saved: ${STATUS.find((x) => x.id === saved)!.label}` : ""}
      </p>
    </div>
  );
}

const ROOFS = ["Gable", "Hip", "Round"] as const;
const GARDEN_NAMES = ["Flowers", "Pumpkin", "Birdbath", "Bench", "Barrel", "Nothing"] as const;
const SIGNS = ["Plaque", "Hanging sign", "Stone tile"] as const;

function blit(ctx: CanvasRenderingContext2D, p: Px, x: number, y: number) {
  const c = document.createElement("canvas");
  c.width = p.w;
  c.height = p.h;
  c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(p.data), p.w, p.h), 0, 0);
  ctx.drawImage(c, x, y);
}

/** Your hut at 3×, drawn by the same art module the world uses: what you see here is what neighbours see. */
function HutPreview({
  roof,
  look,
  status,
  kitty,
}: {
  roof: string;
  look: HutLook;
  status: Status;
  kitty: string | null;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = JSON.stringify(look);
  useEffect(() => {
    const ctx = ref.current!.getContext("2d")!;
    ctx.clearRect(0, 0, 64, 56);
    ctx.fillStyle = "#a8cf8e";
    ctx.fillRect(0, 0, 64, 56);
    ctx.fillStyle = "#ddbd8f";
    ctx.fillRect(30, 51, 10, 5); // the path to your door
    const l: HutLook = JSON.parse(key);
    blit(ctx, B.hut(roof, l), 8, 4);
    blit(ctx, B.hutWindow(status === "free" ? "lit" : "dark"), 18, 34);
    if (status === "busy") blit(ctx, B.doorSign("closed"), 33, 36);
    const g = B.gardenItem(l.garden);
    blit(ctx, g, 10, 51 - g.h);
    // your kitty on the step, asleep while you're away
    if (kitty) blit(ctx, fieldKitty(kitty, "down", status === "away" ? "sleep" : "sit", 0), 42, 35);
  }, [key, roof, status, kitty]);
  return (
    <canvas
      ref={ref}
      width={64}
      height={56}
      role="img"
      aria-label={`Your hut: ${ROOFS[look.roof].toLowerCase()} roof, ${GARDEN_NAMES[look.garden % 6].toLowerCase()} in the garden, ${SIGNS[look.sign % 3].toLowerCase()}`}
      style={{ width: 192, height: 168, imageRendering: "pixelated" }}
    />
  );
}

export function HutLookForm({
  initial,
  roof,
  guild,
  status,
  kitty,
}: {
  initial: HutLook;
  roof: string;
  guild: string | null;
  status: Status;
  kitty: string | null;
}) {
  const router = useRouter();
  const [look, setLook] = useState<HutLook>(initial);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(look) !== JSON.stringify(initial);
  const cyc = (k: "roof" | "garden" | "sign", n: number, d: number) => {
    setDone(false);
    setLook({ ...look, [k]: (((look[k] + d) % n) + n) % n } as HutLook);
  };
  return (
    <div className="grid gap-5 sm:grid-cols-[192px_1fr]">
      <div className="grid content-start gap-2">
        <HutPreview roof={roof} look={look} status={status} kitty={kitty} />
        <p className="text-meta text-ink-soft">
          {guild
            ? `Your roof takes the colour of the ${guild}, where your first skill belongs.`
            : "Your roof takes your guild's colour once you pick something to teach."}
        </p>
      </div>
      <form
        className="grid content-start gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            setError(null);
            const r = await saveHutLook(look);
            if (!r.ok) return setError(r.error);
            setDone(true);
            village.command({ c: "reload" });
            router.refresh();
          });
        }}
      >
        <Picker label="Roof" names={ROOFS} value={look.roof} onStep={(d) => cyc("roof", ROOFS.length, d)} />
        <div className="grid grid-cols-[64px_1fr] items-center gap-2">
          <span aria-hidden className="font-pixel text-label">
            Door
          </span>
          <ChoiceRow
            name="door"
            legend="Door colour"
            value={look.door}
            options={B.DOOR_COLORS.map((c, i) => ({ value: i, swatch: c, aria: `Door colour ${i + 1}` }))}
            onChange={(i) => {
              setDone(false);
              setLook({ ...look, door: i });
            }}
          />
        </div>
        <Picker
          label="Garden"
          names={GARDEN_NAMES}
          value={look.garden}
          onStep={(d) => cyc("garden", GARDEN_NAMES.length, d)}
        />
        <Picker label="Sign" names={SIGNS} value={look.sign} onStep={(d) => cyc("sign", SIGNS.length, d)} />
        <div className="flex items-center gap-3 pt-1">
          <button type="submit" className="btn btn-secondary" disabled={pending || !dirty}>
            <PixelIcon name="sign" size={16} />
            Save the hut
          </button>
          {done ? <span className="text-meta text-ok">Saved. Neighbours see it now.</span> : null}
        </div>
        <FormError message={error} />
      </form>
    </div>
  );
}

/** ‹ name › stepper for one hut layer. */
function Picker({
  label,
  names,
  value,
  onStep,
}: {
  label: string;
  names: readonly string[];
  value: number;
  onStep: (d: number) => void;
}) {
  return (
    <div className="grid grid-cols-[64px_1fr] items-center gap-2">
      <span className="font-pixel text-label">{label}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="btn btn-tertiary px-2"
          aria-label={`Previous ${label.toLowerCase()}`}
          onClick={() => onStep(-1)}
        >
          ‹
        </button>
        <span className="min-w-28 text-center" aria-live="polite">
          {names[value % names.length]}
        </span>
        <button
          type="button"
          className="btn btn-tertiary px-2"
          aria-label={`Next ${label.toLowerCase()}`}
          onClick={() => onStep(1)}
        >
          ›
        </button>
      </div>
    </div>
  );
}
