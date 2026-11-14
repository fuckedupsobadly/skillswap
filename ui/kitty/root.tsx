"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { feedKitty, petKitty, playWithKitty, saveGameSettings, slowBlink } from "@/app/actions/game";
import { NEED_KEYS, NEED_LABEL } from "@/modules/game/needs";
import { cn } from "../cn";
import type { KittyEngine } from "./engine";
import { KittyPreview } from "./preview";
import { fetchProgress, kittyStore, STATUS_TEXT } from "./store";

/**
 * Mounted once in the root layout. Loads the engine only after the page is idle, so the kitty never
 * competes with first paint. Renders the full-viewport canvas (aria-hidden) and the Kitty dock.
 */
/** mode "page": the kitty roams page elements (plain mode). "village": the field kitty in the world replaces it; only the dock shows. */
export function KittyRoot({ mode = "page" }: { mode?: "page" | "village" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useSyncExternalStore(kittyStore.subscribe, kittyStore.get, kittyStore.get);
  const p = state.progress;

  useEffect(() => {
    let engine: KittyEngine | null = null;
    let cancelled = false;
    let booting = false;
    /** Read progress; start the engine as soon as there's a kitty to show (also right after adopting). */
    const ensure = async () => {
      if (booting || cancelled) return;
      booting = true;
      try {
        const progress = await fetchProgress();
        if (cancelled || !progress) return;
        kittyStore.set({ progress });
        if (
          mode === "village" ||
          engine ||
          !progress.kitty ||
          !progress.settings.showKitty ||
          !canvasRef.current
        )
          return;
        const { KittyEngine } = await import("./engine");
        if (cancelled || !canvasRef.current) return;
        engine = new KittyEngine(canvasRef.current, progress, {
          pet: () => petKitty(),
          slowBlink: () => slowBlink(),
          play: () => playWithKitty(),
          feed: async (kind) => {
            const r = await feedKitty({ kind });
            return r.ok ? { ok: true } : { ok: false, error: r.error };
          },
        });
        engine.start();
      } finally {
        booting = false;
      }
    };
    const onPoke = () => {
      if (!engine) void ensure();
    };
    window.addEventListener("skillswap:kitty-poke", onPoke);
    const ric = (
      window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
    ).requestIdleCallback;
    const handle = ric
      ? ric(() => void ensure(), { timeout: 2500 })
      : window.setTimeout(() => void ensure(), 600);
    return () => {
      cancelled = true;
      engine?.stop();
      window.removeEventListener("skillswap:kitty-poke", onPoke);
      if (!ric) clearTimeout(handle);
    };
  }, [mode]);

  if (p && !p.settings.showKitty) return null;
  return (
    <>
      {mode === "page" ? (
        <canvas
          ref={canvasRef}
          aria-hidden
          className="pointer-events-none fixed inset-0 z-30 h-full w-full"
        />
      ) : null}
      {p ? <Dock /> : null}
    </>
  );
}

function Dock() {
  const {
    progress: p,
    status,
    notice,
    panelOpen,
  } = useSyncExternalStore(kittyStore.subscribe, kittyStore.get, kittyStore.get);
  const [shown, setShown] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!notice) return;
    setShown(notice.text);
    const t = window.setTimeout(() => setShown(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (!panelOpen) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && kittyStore.set({ panelOpen: false });
    const outside = (e: PointerEvent) => {
      if (!(e.target as Element).closest("[data-kitty-dock]")) kittyStore.set({ panelOpen: false });
    };
    window.addEventListener("keydown", close);
    window.addEventListener("pointerdown", outside);
    panelRef.current?.querySelector<HTMLElement>("button, a")?.focus();
    return () => {
      window.removeEventListener("keydown", close);
      window.removeEventListener("pointerdown", outside);
    };
  }, [panelOpen]);

  if (!p) return null;
  const k = p.kitty;

  if (!k) {
    return (
      <div data-kitty-dock data-no-perch className="fixed right-4 bottom-4 z-40">
        <Link href="/gate/kitty" className="btn btn-secondary">
          Adopt a kitty
        </Link>
      </div>
    );
  }

  const label = `${k.name} ${STATUS_TEXT[status]}`;
  return (
    <div data-kitty-dock data-no-perch className="fixed right-4 bottom-4 z-40 grid justify-items-end gap-2">
      <p
        aria-live="polite"
        className={cn(
          "panel px-3 py-1 text-meta transition-opacity duration-300",
          shown ? "opacity-100" : "opacity-0",
        )}
      >
        {shown ?? ""}
      </p>
      {panelOpen ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={`${k.name}, your kitty`}
          className="panel w-[320px] max-w-[calc(100vw-32px)] p-6"
        >
          <div className="flex items-center gap-3">
            <KittyPreview code={k.code} stage={k.stage} equipped={k.equipped} scale={1.5} label={k.name} />
            <div className="grid gap-0.5">
              <span className="font-name text-name">{k.name}</span>
              <span className="text-meta">
                Level {p.level}, {p.rankName}
              </span>
            </div>
          </div>
          <div className="mt-3 grid gap-1">
            <div
              className="h-1.5 overflow-hidden  bg-paper-shade"
              title={`${p.xp - p.levelStart} of ${p.levelNext - p.levelStart} XP`}
            >
              <div className="h-full bg-ink" style={{ width: `${Math.round(p.levelFraction * 100)}%` }} />
            </div>
            <span className="text-meta text-ink-soft">
              {p.level < 50 ? `${p.levelNext - p.xp} XP to level ${p.level + 1}` : "Top level"}
            </span>
          </div>
          {p.needs ? (
            <dl className="mt-3 grid grid-cols-[64px_1fr] items-center gap-x-3 gap-y-1.5">
              {NEED_KEYS.map((n) => (
                <div key={n} className="contents">
                  <dt className="text-meta">{NEED_LABEL[n]}</dt>
                  <dd>
                    <PixelBar
                      value={p.needs![n]}
                      label={`${NEED_LABEL[n]}: ${Math.round(p.needs![n] * 100)}%`}
                    />
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          {p.treats === 0 ? (
            <p className="mt-3 text-meta text-ink-soft">Each settled session earns {k.name} a treat.</p>
          ) : null}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <button type="button" className="btn btn-secondary px-2" onClick={() => kittyStore.ask("feed")}>
              Feed
            </button>
            <button
              type="button"
              className="btn btn-secondary px-2"
              disabled={p.treats === 0}
              onClick={() => kittyStore.ask("treat")}
              title={p.treats ? "" : "Each settled session earns a treat"}
            >
              Treat {p.treats ? <span className="tabular-nums">{p.treats}</span> : null}
            </button>
            <button type="button" className="btn btn-secondary px-2" onClick={() => kittyStore.ask("play")}>
              Play
            </button>
          </div>
          <div className="mt-4 flex items-center justify-between text-meta">
            <Link
              href="/kitty"
              className="font-pixel underline underline-offset-2"
              onClick={() => kittyStore.set({ panelOpen: false })}
            >
              Wardrobe
            </Link>
            <button
              type="button"
              className="text-ink-soft underline underline-offset-2"
              onClick={async () => {
                await saveGameSettings({ showKitty: false });
                window.location.reload();
              }}
            >
              Hide kitty
            </button>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        aria-expanded={panelOpen}
        aria-label={`${label}. Open the kitty panel`}
        onClick={() => kittyStore.set({ panelOpen: !panelOpen })}
        className="btn btn-secondary gap-2 pr-3 pl-2"
      >
        <span aria-hidden className="h-6 w-6 overflow-hidden">
          <span className="-mt-[9px] -ml-[9px] block">
            <KittyPreview code={k.code} stage={k.stage} equipped={k.equipped} scale={0.875} label="" still />
          </span>
        </span>
        <span className="font-pixel text-label">
          <span className="font-semibold">{k.name}</span> {STATUS_TEXT[status]}
        </span>
      </button>
    </div>
  );
}

/** Ten pixel blocks: needs read at a glance, in the kitty's own visual language. */
export function PixelBar({ value, label }: { value: number; label: string }) {
  const n = Math.round(Math.max(0, Math.min(1, value)) * 10);
  return (
    <div className="relative">
      <meter className="sr-only" min={0} max={1} value={value} aria-label={label}>
        {label}
      </meter>
      <div aria-hidden className="flex gap-[2px]">
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className={cn("h-2.5 flex-1", i < n ? (n <= 2 ? "bg-danger" : "bg-ink") : "bg-paper-shade")}
          />
        ))}
      </div>
    </div>
  );
}
