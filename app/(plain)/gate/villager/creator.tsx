"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { saveVillager, setOnboardingStep } from "@/app/actions/village";
import type { VillagerLook } from "@/db/schema";
import {
  ACCESSORIES,
  BODIES,
  BOTTOMS,
  BROWS,
  CLOTH,
  EYE_STYLES,
  HAIR_COLORS,
  HAIR_STYLES,
  SHOES,
  SKIN,
  TOPS,
  type View,
  villagerFrame,
} from "@/modules/village/art/people";
import { ChoiceRow } from "@/ui/choice";
import { FormError } from "@/ui/field";
import { PixelIcon } from "@/ui/pixel/icons";
import { village } from "@/ui/village/store";
import { Dots } from "../../board/parts";

const VIEWS: { v: View; flip: boolean }[] = [
  { v: "down", flip: false },
  { v: "right", flip: false },
  { v: "up", flip: false },
  { v: "right", flip: true },
];

/** §5.3 Make your villager: live preview walking in place, outfits judged in motion. */
export function Creator({
  initial,
  name,
  onboarding,
}: {
  initial: VillagerLook;
  name: string;
  onboarding: boolean;
}) {
  const router = useRouter();
  const [look, setLook] = useState<VillagerLook>(initial);
  const [undo, setUndo] = useState<VillagerLook | null>(null);
  const [villageName, setName] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (patch: Partial<VillagerLook>) => setLook({ ...look, ...patch });
  const cycle = (k: keyof VillagerLook, n: number, d: number) =>
    set({ [k]: ((((look[k] as number) + d) % n) + n) % n } as Partial<VillagerLook>);
  const surprise = () => {
    setUndo(look);
    const r = (n: number) => Math.floor(Math.random() * n);
    setLook({
      body: r(3),
      skin: r(8),
      hair: r(16),
      hairColor: r(10),
      eyes: r(6),
      brows: r(4),
      top: r(12),
      topColor: r(10),
      bottom: r(8),
      bottomColor: r(10),
      shoes: r(6),
      accessory: ACCESSORIES[r(5)],
    });
  };
  const rows: {
    label: string;
    k: keyof VillagerLook;
    names: readonly string[];
    colors?: { k: keyof VillagerLook; list: string[] };
  }[] = [
    { label: "Hair", k: "hair", names: HAIR_STYLES, colors: { k: "hairColor", list: HAIR_COLORS } },
    { label: "Eyes", k: "eyes", names: EYE_STYLES },
    { label: "Brows", k: "brows", names: BROWS },
    { label: "Top", k: "top", names: TOPS, colors: { k: "topColor", list: CLOTH } },
    { label: "Bottom", k: "bottom", names: BOTTOMS, colors: { k: "bottomColor", list: CLOTH } },
    { label: "Shoes", k: "shoes", names: SHOES },
    { label: "Build", k: "body", names: BODIES },
  ];
  return (
    <form
      className="grid gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          const r = await saveVillager({ look, name: villageName });
          if (!r.ok) return setError(r.error);
          village.command({ c: "look", look });
          if (onboarding) {
            await setOnboardingStep({ step: 3 });
            router.replace("/gate/kitty");
          } else router.back();
        });
      }}
    >
      {onboarding ? <Dots step={2} /> : null}
      <div className="grid gap-6 sm:grid-cols-[180px_1fr]">
        <div className="self-start sm:sticky sm:top-0">
          <Preview look={look} />
        </div>
        <div className="grid content-start gap-3">
          <div className="grid grid-cols-[64px_1fr] items-center gap-2">
            <span aria-hidden className="field-label">
              Skin
            </span>
            <ChoiceRow
              name="skin"
              legend="Skin tone"
              value={look.skin}
              options={SKIN.map((c, i) => ({ value: i, swatch: c, aria: `Skin tone ${i + 1}` }))}
              onChange={(i) => set({ skin: i })}
            />
          </div>
          {rows.map((r) => (
            <div key={r.label} className="grid grid-cols-[64px_1fr] items-start gap-2">
              <span className="field-label flex min-h-11 items-center">{r.label}</span>
              <div className="grid">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-tertiary px-2"
                    aria-label={`Previous ${r.label.toLowerCase()}`}
                    onClick={() => cycle(r.k, r.names.length, -1)}
                  >
                    ‹
                  </button>
                  <span className="min-w-28 text-center text-body" aria-live="polite">
                    {r.names[look[r.k] as number]}
                  </span>
                  <button
                    type="button"
                    className="btn btn-tertiary px-2"
                    aria-label={`Next ${r.label.toLowerCase()}`}
                    onClick={() => cycle(r.k, r.names.length, 1)}
                  >
                    ›
                  </button>
                </div>
                {r.colors ? (
                  <ChoiceRow
                    small
                    name={`${r.label}-colour`}
                    legend={`${r.label} colour`}
                    value={look[r.colors.k] as number}
                    options={r.colors.list.map((c, i) => ({
                      value: i,
                      swatch: c,
                      aria: `${r.label} colour ${i + 1}`,
                    }))}
                    onChange={(i) => set({ [r.colors!.k]: i } as Partial<VillagerLook>)}
                  />
                ) : null}
              </div>
            </div>
          ))}
          <div className="grid grid-cols-[64px_1fr] items-center gap-2">
            <span className="field-label">Extra</span>
            <div className="flex flex-wrap gap-1">
              {ACCESSORIES.map((a) => (
                <button
                  key={a}
                  type="button"
                  aria-pressed={look.accessory === a}
                  onClick={() => set({ accessory: a })}
                  className={`btn ${look.accessory === a ? "btn-secondary" : "btn-tertiary"} px-2`}
                >
                  {a === "none" ? "None" : a[0].toUpperCase() + a.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary" onClick={surprise}>
              Surprise me
            </button>
            {undo ? (
              <button
                type="button"
                className="btn btn-tertiary"
                onClick={() => {
                  setLook(undo);
                  setUndo(null);
                }}
              >
                Undo
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <div className="divider flex flex-wrap items-end gap-3 pt-5">
        <div className="grid min-w-48 flex-1 gap-1.5">
          <label htmlFor="village-name" className="field-label">
            Name in the village
          </label>
          <input
            id="village-name"
            className="field"
            value={villageName}
            maxLength={24}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={pending || villageName.trim().length < 2}>
          Continue <PixelIcon name="arrow" size={16} />
        </button>
      </div>
      <FormError message={error} />
    </form>
  );
}

/** 3× live preview that walks in place; turn and walk/pause. */
function Preview({ look }: { look: VillagerLook }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState(0);
  const [walking, setWalking] = useState(true);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let f = 0;
    const draw = () => {
      const { v, flip } = VIEWS[view];
      const p = villagerFrame(
        look,
        v,
        walking && !reduced ? "walk" : "idle",
        walking && !reduced ? f % 4 : 0,
      );
      ctx.clearRect(0, 0, 16, 32);
      const tmp = document.createElement("canvas");
      tmp.width = 16;
      tmp.height = 32;
      tmp.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(p.data), 16, 32), 0, 0);
      ctx.save();
      if (flip) {
        ctx.translate(16, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(tmp, 0, 0);
      ctx.restore();
      f++;
    };
    draw();
    const t = window.setInterval(draw, 120);
    return () => clearInterval(t);
  }, [look, view, walking]);
  return (
    <div className="grid justify-items-center gap-2">
      <div className="grid h-[132px] w-[96px] place-items-center bg-grass">
        <canvas
          ref={ref}
          width={16}
          height={32}
          role="img"
          aria-label="Your villager"
          style={{ width: 48, height: 96, imageRendering: "pixelated" }}
        />
      </div>
      <div className="flex gap-1">
        <button type="button" className="btn btn-tertiary px-2" onClick={() => setView((view + 1) % 4)}>
          ↻ turn
        </button>
        <button
          type="button"
          className="btn btn-tertiary px-2"
          onClick={() => setWalking(!walking)}
          aria-pressed={walking}
        >
          {walking ? "Pause" : "▶ walk"}
        </button>
      </div>
    </div>
  );
}
