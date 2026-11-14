"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { setPlainMode } from "@/app/actions/village";
import { formatHours } from "@/modules/platform/format";
import { PixelIcon } from "../pixel/icons";
import { village } from "./store";

/**
 * The HUD — four elements only (§7): Balance (top-left), Map + Menu (top-right), the context prompt
 * (bottom-centre, only when something is in range) and the Kitty button (bottom-right, from KittyRoot).
 * Deliberately absent: XP bar, rank, chat log, minimap, player list, notifications bell.
 */
export function Hud() {
  const v = useSyncExternalStore(village.subscribe, village.get, village.get);
  const s = v.state;
  if (!s) return null;
  return (
    <>
      <Balance />
      <MapMenu />
      {v.prompt ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <button
            type="button"
            className="panel pointer-events-auto min-h-11 px-4 font-pixel text-label anim-fade"
            onClick={() => village.command({ c: "interact" })}
            aria-label={`${v.prompt.verb} ${v.prompt.target}`}
          >
            <kbd className="mr-2 font-pixel">E</kbd>· {v.prompt.verb}
            {v.prompt.target ? ` ${v.prompt.target}` : ""}
          </button>
        </div>
      ) : null}
      {/* Off-screen live region: nearby interactables are announced for screen readers (§9). */}
      <p aria-live="polite" className="sr-only">
        {v.announce}
      </p>
    </>
  );
}

function Balance() {
  const router = useRouter();
  const s = useSyncExternalStore(village.subscribe, village.get, village.get).state!;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const next = s.viewer.nextSession;
  const mins = next ? Math.round((Date.parse(next.startsAt) - now) / 60_000) : null;
  const soon = next && mins !== null && mins <= 10 && mins > -60;
  return (
    <div className="fixed top-4 left-4 z-40 grid justify-items-start gap-2">
      <button
        type="button"
        onClick={() => router.push("/bank")}
        className="panel flex min-h-11 items-center gap-2 px-3"
        aria-label={`Balance ${formatHours(s.viewer.balanceMin)}, ${formatHours(s.viewer.heldMin)} held. Open the bank`}
      >
        <PixelIcon name="hourglass" size={16} />
        <span className="tnum text-body font-medium">{formatHours(s.viewer.balanceMin)}</span>
        {s.viewer.heldMin ? (
          <span className="tnum text-meta text-ink-soft">
            ({formatHours(s.viewer.heldMin).replace(" h", "")} held)
          </span>
        ) : null}
      </button>
      {soon ? (
        <div className="panel flex min-h-11 items-center gap-3 py-1 pr-1 pl-3 text-body anim-fade">
          <span>
            Lesson{next.with ? ` with ${next.with.split(" ")[0]}` : ""} {mins! > 0 ? `in ${mins} min` : "now"}
          </span>
          {/* "Go" quick-travels you to the Lantern Room. */}
          <a href={`/sessions/${next.id}`} className="btn btn-primary">
            Go
          </a>
        </div>
      ) : null}
    </div>
  );
}

function MapMenu() {
  const router = useRouter();
  const s = useSyncExternalStore(village.subscribe, village.get, village.get).state!;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const count = s.viewer.unread + s.viewer.swapsWaiting;
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e instanceof PointerEvent && ref.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener("keydown", close);
    window.addEventListener("pointerdown", close);
    ref.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    return () => {
      window.removeEventListener("keydown", close);
      window.removeEventListener("pointerdown", close);
    };
  }, [open]);
  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };
  return (
    <div ref={ref} className="fixed top-4 right-4 z-40 flex items-start gap-2">
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => village.set({ overlay: "map" })}
        aria-keyshortcuts="M"
      >
        <PixelIcon name="map" size={16} />
        Map
      </button>
      <div className="relative">
        <button
          type="button"
          className="btn btn-secondary px-3"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Menu${count ? `, ${count} new` : ""}`}
          onClick={() => setOpen(!open)}
        >
          <PixelIcon name="menu" size={16} />
          {count ? <span className="tnum font-sans text-meta">{count}</span> : null}
        </button>
        {open ? (
          <div role="menu" className="panel absolute top-14 right-0 grid w-56 gap-1 p-2 anim-sheet">
            <MenuItem onClick={() => go("/inbox")} icon="mailbox" label="Inbox" count={s.viewer.unread} />
            <MenuItem onClick={() => go("/sessions")} icon="lantern" label="Sessions" />
            <MenuItem onClick={() => go("/hut")} icon="sign" label="Profile" />
            <MenuItem
              onClick={() => go("/tavern")}
              icon="search"
              label="Swaps"
              count={s.viewer.swapsWaiting}
            />
            <MenuItem
              onClick={async () => {
                setOpen(false);
                await setPlainMode({ on: true });
                window.location.href = "/board";
              }}
              icon="book"
              label="Plain mode"
            />
            <MenuItem onClick={() => go("/hall")} icon="gear" label="Settings" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MenuItem({
  onClick,
  icon,
  label,
  count,
}: {
  onClick: () => void;
  icon: Parameters<typeof PixelIcon>[0]["name"];
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex min-h-11 items-center gap-3 px-2 text-left font-pixel text-label hover:bg-paper-shade focus-visible:bg-paper-shade"
    >
      <PixelIcon name={icon} size={16} />
      <span className="flex-1">{label}</span>
      {count ? <span className="tnum font-sans text-meta">{count}</span> : null}
    </button>
  );
}

export function FadeOverlay() {
  const fade = useSyncExternalStore(
    village.subscribe,
    () => village.get().fade,
    () => false,
  );
  // §10.5 quick-travel: 200 ms fade to paper, then back in.
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60] bg-paper transition-opacity duration-200"
      style={{ opacity: fade ? 1 : 0 }}
    />
  );
}

export { Link };
