"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { rename, saveOutfit } from "@/app/actions/game";
import type { Stage } from "@/modules/game/genome";
import type { Slot } from "@/modules/game/ranks";
import { Button } from "@/ui/button";
import { cn } from "@/ui/cn";
import { FormError, Input } from "@/ui/field";
import { ItemIcon } from "@/ui/kitty/item-icon";
import { KittyPreview } from "@/ui/kitty/preview";
import { pokeKitty } from "@/ui/kitty/store";

const SLOT_NAME: Record<Slot, string> = {
  head: "Head",
  neck: "Neck",
  charm: "Collar charm",
  face: "Face",
  back: "Back",
  tail: "Tail",
  bed: "Bed",
  room: "Room",
  toy: "Toy",
};
const ORDER: Slot[] = ["head", "face", "neck", "charm", "back", "tail", "toy", "bed", "room"];

type ItemRow = { id: string; slot: Slot; name: string; rarity: string; owned: boolean; rule: string };

export function Wardrobe({
  kitty,
  items,
  slots,
  canTwilight,
  progress,
}: {
  kitty: {
    code: string;
    stage: Stage;
    name: string;
    equipped: Partial<Record<Slot, string>>;
    roomTheme: "cozy" | "twilight";
  };
  items: ItemRow[];
  slots: { slot: Slot; open: boolean; opensAt: string }[];
  canTwilight: boolean;
  progress: {
    level: number;
    xp: number;
    levelStart: number;
    levelNext: number;
    fraction: number;
    rankName: string;
    nextRank: { name: string; level: number; condition: string } | null;
    treats: number;
  };
}) {
  const router = useRouter();
  const [sel, setSel] = useState<Partial<Record<Slot, string | null>>>(kitty.equipped);
  const [theme, setTheme] = useState(kitty.roomTheme);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const equipped = useMemo(
    () => Object.fromEntries(Object.entries(sel).filter(([, v]) => v)) as Partial<Record<Slot, string>>,
    [sel],
  );
  const dirty = JSON.stringify(equipped) !== JSON.stringify(kitty.equipped) || theme !== kitty.roomTheme;
  const open = new Map(slots.map((s) => [s.slot, s]));

  return (
    <div className="grid gap-10 lg:grid-cols-[400px_1fr] lg:items-start">
      <div className="grid gap-5 lg:sticky lg:top-24">
        <div data-perch="" className="overflow-hidden border-2 border-ink">
          <KittyPreview
            code={kitty.code}
            stage={kitty.stage}
            equipped={equipped}
            scale={4}
            room={{ theme, item: equipped.room, bed: equipped.bed }}
            label={`${kitty.name} in its room`}
          />
        </div>
        <div className="grid gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-body">
              <span className="font-semibold">Level {progress.level}</span>{" "}
              <span className="text-ink-soft">{progress.rankName}</span>
            </span>
            <span className="text-meta tabular-nums text-ink-soft">{progress.xp} XP</span>
          </div>
          <div
            className="h-1.5 overflow-hidden bg-paper-shade"
            role="progressbar"
            aria-label="Progress to the next level"
            aria-valuenow={Math.round(progress.fraction * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full bg-ink" style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
          </div>
          <p className="text-meta text-ink-soft">
            {progress.level < 50
              ? `${progress.levelNext - progress.xp} XP to level ${progress.level + 1}. `
              : ""}
            {progress.nextRank
              ? `${progress.nextRank.name} at level ${progress.nextRank.level}${progress.nextRank.condition ? ` and ${progress.nextRank.condition}` : ""}.`
              : "Top rank."}
          </p>
        </div>
      </div>

      <form
        className="grid gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            setError(null);
            setSaved(false);
            const full = Object.fromEntries(ORDER.map((s) => [s, sel[s] ?? null]));
            const res = await saveOutfit({ equipped: full, roomTheme: theme });
            if (!res.ok) return setError(res.error);
            setSaved(true);
            pokeKitty();
            router.refresh();
          });
        }}
      >
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-name">Wardrobe</h2>
          <span className="text-meta text-ink-soft">Items are earned, never bought.</span>
        </div>
        <ul className="grid gap-3">
          {ORDER.filter((s) => open.has(s)).map((slot) => {
            const info = open.get(slot)!;
            const list = items
              .filter((i) => i.slot === slot)
              .sort((a, b) => Number(b.owned) - Number(a.owned));
            return (
              <li
                key={slot}
                data-perch=""
                className={cn(
                  "grid gap-3 border-2 p-4",
                  info.open ? "border-paper-shade" : "border-dashed border-paper-shade",
                )}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{SLOT_NAME[slot]}</span>
                  <span className="text-meta text-ink-soft">
                    {info.open
                      ? sel[slot]
                        ? list.find((i) => i.id === sel[slot])?.name
                        : "Nothing"
                      : `Opens at ${info.opensAt}`}
                  </span>
                </div>
                <fieldset className="flex flex-wrap gap-2">
                  <legend className="sr-only">{SLOT_NAME[slot]}</legend>
                  {info.open ? (
                    <button
                      type="button"
                      aria-pressed={!sel[slot]}
                      onClick={() => setSel({ ...sel, [slot]: null })}
                      className={cn(
                        "grid h-[60px] w-[60px] place-items-center border-2 text-meta",
                        !sel[slot] ? "border-ink" : "border-paper-shade text-ink-soft hover:border-ink",
                      )}
                    >
                      None
                    </button>
                  ) : null}
                  {list.map((it) => {
                    const usable = it.owned && info.open;
                    const on = sel[slot] === it.id;
                    return (
                      <button
                        key={it.id}
                        type="button"
                        aria-pressed={on}
                        aria-disabled={!usable}
                        title={it.owned ? it.name : `${it.name}: ${it.rule}`}
                        onClick={() => usable && setSel({ ...sel, [slot]: it.id })}
                        className={cn(
                          "grid h-[60px] w-[60px] place-items-center border-2",
                          on
                            ? "border-ink bg-paper-shade"
                            : it.owned
                              ? "border-paper-shade hover:border-ink"
                              : "cursor-default border-dashed border-paper-shade",
                        )}
                      >
                        <ItemIcon id={it.id} locked={!it.owned} size={44} />
                        <span className="sr-only">
                          {it.owned ? it.name : `${it.name}, locked: ${it.rule}`}
                        </span>
                      </button>
                    );
                  })}
                </fieldset>
                {list.some((i) => !i.owned) ? (
                  <ul className="grid gap-0.5 text-meta text-ink-soft">
                    {list
                      .filter((i) => !i.owned)
                      .slice(0, 3)
                      .map((i) => (
                        <li key={i.id}>
                          <span className="text-ink-soft">{i.name}:</span> {i.rule}
                        </li>
                      ))}
                    {list.filter((i) => !i.owned).length > 3 ? (
                      <li>and {list.filter((i) => !i.owned).length - 3} more</li>
                    ) : null}
                  </ul>
                ) : null}
                {slot === "room" && info.open ? (
                  <div className="flex flex-wrap items-center gap-2 border-t-2 border-paper-shade pt-3 text-meta">
                    <span className="text-ink-soft">Theme</span>
                    {(["cozy", "twilight"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={theme === t}
                        disabled={t === "twilight" && !canTwilight}
                        onClick={() => setTheme(t)}
                        className={cn(
                          "h-8 border-2 px-3 disabled:opacity-50",
                          theme === t ? "border-ink" : "border-paper-shade",
                        )}
                      >
                        {t === "cozy" ? "Cozy" : "Twilight"}
                      </button>
                    ))}
                    {!canTwilight ? <span className="text-ink-soft">Twilight opens at Puma</span> : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        <FormError message={error} />
        <div className="flex items-center gap-4">
          <Button type="submit" variant="primary" disabled={pending || !dirty}>
            {pending ? "Saving…" : "Save outfit"}
          </Button>
          {saved && !dirty ? (
            <span className="text-meta text-ok">Saved. {kitty.name} is wearing it now.</span>
          ) : null}
        </div>
      </form>
    </div>
  );
}

export function RenameKitty({ name }: { name: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!editing)
    return (
      <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
        Rename
      </Button>
    );
  return (
    <form
      className="flex items-start gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await rename({ name: value });
          if (!res.ok) return setError(res.error);
          setEditing(false);
          pokeKitty();
          router.refresh();
        });
      }}
    >
      <div className="grid gap-1">
        <label htmlFor="rename" className="sr-only">
          New name
        </label>
        <Input
          id="rename"
          value={value}
          maxLength={16}
          onChange={(e) => setValue(e.target.value)}
          className="h-9 w-44"
          autoFocus
        />
        <FormError message={error} />
      </div>
      <Button type="submit" size="sm" disabled={pending || !value.trim()}>
        Save name
      </Button>
    </form>
  );
}
