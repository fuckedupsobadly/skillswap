"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { C } from "@/modules/village/art/tiles";
import { GUILDS } from "@/modules/village/guilds";
import { groundGrid, MAP_H, MAP_W, PLACES, PLOTS } from "@/modules/village/map";
import { PixelIcon } from "../pixel/icons";
import { village } from "./store";

const CELL = 9;

/** Full map (§6.1 `M`): click a place to quick-travel there — a short fade, no walking. */
export function MapOverlay() {
  const open = useSyncExternalStore(
    village.subscribe,
    () => village.get().overlay === "map",
    () => false,
  );
  const ref = useRef<HTMLCanvasElement>(null);
  const s = village.get().state;
  useEffect(() => {
    if (!open) return;
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const g = groundGrid();
    const col = { grass: C.grass, path: C.path, stone: C.stone, water: C.water, dock: C.wood } as const;
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        ctx.fillStyle = col[g[y][x]];
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    for (const p of PLACES) {
      if (p.kind === "area") continue;
      const guild = p.id.startsWith("guild-") ? GUILDS.find((x) => `guild-${x.id}` === p.id) : null;
      ctx.fillStyle = guild?.roof ?? "#b7a28c";
      ctx.fillRect(p.x * CELL, p.y * CELL, p.w * CELL, p.h * CELL);
      ctx.strokeStyle = "#2b1b33";
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x * CELL + 1, p.y * CELL + 1, p.w * CELL - 2, p.h * CELL - 2);
    }
    for (const h of s?.huts ?? []) {
      const pl = PLOTS[h.plot];
      if (!pl) continue;
      ctx.fillStyle = h.roof;
      ctx.fillRect(pl.x * CELL, pl.y * CELL, 3 * CELL, 3 * CELL);
      if (h.presence === "free") {
        // a lit lantern on the map, too
        ctx.fillStyle = "#f2b33d";
        ctx.fillRect(pl.x * CELL + 8, pl.y * CELL + 10, 6, 6);
      }
    }
  }, [open, s]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) =>
      (e.key === "Escape" || e.key === "m" || e.key === "M") && village.set({ overlay: null });
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);
  if (!open) return null;
  const travel = (placeId: string) => {
    village.set({ overlay: null });
    village.command({ c: "travel", to: { placeId } });
  };
  const districts = ["Town Square", "Guild Quarter", "South"] as const;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[rgb(43_27_51/0.3)] p-4"
      onPointerDown={(e) => e.target === e.currentTarget && village.set({ overlay: null })}
    >
      <div
        role="dialog"
        aria-label="Village map"
        className="panel grid max-h-[92dvh] w-full max-w-[860px] gap-4 overflow-auto p-6 anim-sheet"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-name text-name">The village</h2>
          <button type="button" className="btn btn-tertiary" onClick={() => village.set({ overlay: null })}>
            M · close
          </button>
        </div>
        <div
          className="relative mx-auto"
          style={{ width: MAP_W * CELL, height: MAP_H * CELL, maxWidth: "100%" }}
        >
          <canvas
            ref={ref}
            width={MAP_W * CELL}
            height={MAP_H * CELL}
            aria-hidden
            className="block max-w-full"
            style={{ imageRendering: "pixelated" }}
          />
          {PLACES.filter((p) => p.kind !== "area" || p.id === "market" || p.id === "pond").map((p) => {
            const guild = p.id.startsWith("guild-") ? GUILDS.find((x) => `guild-${x.id}` === p.id) : null;
            // Guild halls are pinned by their sign (roof colour + icon) so names never collide; the list below
            // and the hover title carry the name.
            return guild ? (
              <button
                key={p.id}
                type="button"
                title={guild.name}
                aria-label={guild.name}
                onClick={() => travel(p.id)}
                className="absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center border-2 border-ink hover:scale-110 focus-visible:z-10"
                style={{ left: (p.x + p.w / 2) * CELL, top: (p.y + p.h / 2) * CELL, background: guild.roof }}
              >
                <PixelIcon name={guild.icon} size={16} />
              </button>
            ) : (
              <button
                key={p.id}
                type="button"
                onClick={() => travel(p.id)}
                className="absolute -translate-x-1/2 -translate-y-1/2 border-2 border-ink bg-paper px-1 font-pixel text-[12px] leading-4 whitespace-nowrap hover:bg-paper-shade focus-visible:z-10"
                style={{ left: (p.x + p.w / 2) * CELL, top: (p.y + p.h / 2) * CELL }}
              >
                {p.name}
              </button>
            );
          })}
        </div>
        {/* The same places as a list, for keyboards and screen readers. */}
        <nav aria-label="Places" className="grid gap-3 sm:grid-cols-3">
          {districts.map((d) => (
            <div key={d} className="grid content-start gap-1">
              <h3 className="font-pixel text-label">{d}</h3>
              {PLACES.filter((p) => p.district === d).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => travel(p.id)}
                  className="text-left text-body hover:underline"
                >
                  {p.name}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}

type Skill = { slug: string; name: string; category: string };

/** `/` searches anything: places, members, skills (§6.1). */
export function SearchOverlay() {
  const router = useRouter();
  const open = useSyncExternalStore(
    village.subscribe,
    () => village.get().overlay === "search",
    () => false,
  );
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  const [active, setActive] = useState(0);
  const [skills, setSkills] = useState<Skill[]>([]);
  const s = village.get().state;
  useEffect(() => {
    if (!open || skills.length) return;
    void fetch("/api/v1/skills")
      .then((r) => r.json())
      .then((d: { skills: Skill[] }) => setSkills(d.skills))
      .catch(() => {});
  }, [open, skills.length]);
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    const out: { kind: "Place" | "Member" | "Skill"; label: string; sub: string; go: () => void }[] = [];
    for (const p of PLACES)
      if (p.name.toLowerCase().includes(t) || p.blurb.toLowerCase().includes(t))
        out.push({
          kind: "Place",
          label: p.name,
          sub: p.blurb,
          go: () => village.command({ c: "travel", to: { placeId: p.id } }),
        });
    for (const h of s?.huts ?? [])
      if (h.name.toLowerCase().includes(t) || h.teaches.some((x) => x.toLowerCase().includes(t)))
        out.push({
          kind: "Member",
          label: h.name,
          sub: `${h.presenceLabel}${h.teaches.length ? ` · teaches ${h.teaches.slice(0, 2).join(", ")}` : ""}`,
          go: () => village.command({ c: "travel", to: { handle: h.handle } }),
        });
    for (const k of skills)
      if (k.name.toLowerCase().includes(t))
        out.push({
          kind: "Skill",
          label: k.name,
          sub: k.category,
          go: () => router.push(`/board?q=${encodeURIComponent(k.name)}`),
        });
    return out.slice(0, 12);
  }, [q, s, skills, router]);
  if (!open) return null;
  const pick = (i: number) => {
    const r = results[i];
    if (!r) return;
    village.set({ overlay: null });
    setQ("");
    r.go();
  };
  return (
    <div
      className="fixed inset-0 z-50 flex justify-center bg-[rgb(43_27_51/0.3)] px-4 pt-[12vh]"
      onPointerDown={(e) => e.target === e.currentTarget && village.set({ overlay: null })}
    >
      <div
        role="dialog"
        aria-label="Search"
        className="panel grid h-fit w-full max-w-[640px] gap-3 p-6 anim-sheet"
      >
        <label htmlFor="village-search" className="flex items-center gap-2 font-pixel text-label">
          <PixelIcon name="search" size={16} /> Search the village
        </label>
        <input
          id="village-search"
          ref={inputRef}
          type="search"
          className="field"
          placeholder="A skill, a member or a place"
          value={q}
          aria-describedby="village-search-count"
          aria-controls="village-search-results"
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") village.set({ overlay: null });
            if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, results.length - 1));
            if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
            if (e.key === "Enter") pick(active);
          }}
        />
        <p id="village-search-count" aria-live="polite" className="sr-only">
          {q
            ? `${results.length} ${results.length === 1 ? "result" : "results"}. Arrow keys move, Enter goes.`
            : ""}
        </p>
        {results.length ? (
          <ul id="village-search-results" className="grid gap-1">
            {results.map((r, i) => (
              <li key={`${r.kind}${r.label}`}>
                <button
                  type="button"
                  aria-current={i === active ? "true" : undefined}
                  onClick={() => pick(i)}
                  className={`grid w-full gap-0.5 px-2 py-2 text-left ${i === active ? "bg-paper-shade" : "hover:bg-paper-shade"}`}
                >
                  <span>
                    <span className="font-pixel text-label">{r.label}</span>{" "}
                    <span className="text-meta text-ink-soft">{r.kind}</span>
                  </span>
                  <span className="text-meta text-ink-soft">{r.sub}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : q ? (
          <p className="text-ink-soft">
            Nothing in the village matches “{q}”. Try a skill like guitar, or a place like Bank.
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Short nearby chat: max 140 characters, only people within range see it, nothing is stored (§6.2). */
export function SayBox() {
  const open = useSyncExternalStore(
    village.subscribe,
    () => village.get().overlay === "say",
    () => false,
  );
  const [text, setText] = useState("");
  const sayRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) sayRef.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
      <form
        className="panel flex w-full max-w-[520px] gap-2 p-3 anim-sheet"
        onSubmit={(e) => {
          e.preventDefault();
          village.command({ c: "say", text });
          setText("");
          village.set({ overlay: null });
        }}
      >
        <label htmlFor="say" className="sr-only">
          Say something nearby
        </label>
        <input
          id="say"
          ref={sayRef}
          className="field"
          maxLength={140}
          value={text}
          placeholder="Say something nearby"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && village.set({ overlay: null })}
        />
        <span className="tnum self-center text-meta text-ink-soft">{140 - text.length}</span>
        <button type="submit" className="btn btn-secondary" disabled={!text.trim()}>
          Say
        </button>
      </form>
    </div>
  );
}
