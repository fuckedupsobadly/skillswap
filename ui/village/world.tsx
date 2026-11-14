"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { setOnboardingStep, setPlainMode } from "@/app/actions/village";
import { KittyRoot } from "../kitty/root";
import { Dialogues } from "./dialogue";
import { FadeOverlay, Hud } from "./hud";
import { MapOverlay, SayBox, SearchOverlay } from "./overlays";
import { loadVillageState, village } from "./store";

/**
 * The village island: HUD first, world bundle after (§12 performance budget). Small phones get the Notice
 * Board as home; the village opens on demand (§9).
 */
export function VillageWorld() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const host = useRef<HTMLDivElement>(null);
  const gameRef = useRef<{ destroy: (b: boolean) => void } | null>(null);
  const v = useSyncExternalStore(village.subscribe, village.get, village.get);
  const [hint, setHint] = useState<string | null>(null);

  // Boot once: state, then the world. Sheets change the URL (and its search params) while the world stays
  // mounted underneath, so nothing here may depend on the current URL — or every sheet would restart Phaser.
  const routerRef = useRef(router);
  routerRef.current = router;
  const bootParams = useRef(params);
  useEffect(() => {
    const entering = Boolean(bootParams.current.get("village"));
    if (window.innerWidth < 480 && !entering) {
      routerRef.current.replace("/board");
      return;
    }
    // "Enter the village" turns Plain mode off for this member and this device.
    if (entering) void setPlainMode({ on: false });
    let cancelled = false;
    (async () => {
      const state = await loadVillageState();
      if (cancelled || !state) return;
      village.set({ state });
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const nav = navigator as Navigator & { deviceMemory?: number };
      const lowEnd = (navigator.hardwareConcurrency ?? 8) <= 2 || (nav.deviceMemory ?? 8) <= 2;
      const zoom = window.innerWidth < 640 || lowEnd ? 2 : 3;
      const { startVillage } = await import("./engine");
      if (cancelled || !host.current) return;
      gameRef.current = startVillage(host.current, {
        navigate: (r) => routerRef.current.push(r),
        reduced,
        lowEnd,
        zoom,
      });
    })();
    return () => {
      cancelled = true;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  // "Show on map" from a Notice Board row: quick-travel to that member's hut.
  useEffect(() => {
    const show = (e: Event) =>
      village.command({ c: "travel", to: { handle: (e as CustomEvent<string>).detail } });
    window.addEventListener("village:show", show);
    return () => window.removeEventListener("village:show", show);
  }, []);
  useEffect(() => {
    const h = params.get("show");
    if (h && v.ready) village.command({ c: "travel", to: { handle: h } });
  }, [params, v.ready]);

  // Keyboard: `/` searches anything.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || village.inputBlocked()) return;
      e.preventDefault();
      village.set({ overlay: "search" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Coming back from a sheet: re-read the village (a booking, a lit lantern, a new note).
  const last = useRef(pathname);
  useEffect(() => {
    if (pathname === "/" && last.current !== "/") village.command({ c: "reload" });
    last.current = pathname;
  }, [pathname]);

  // Onboarding (§11): Gate → villager → kitty happen in sheets; then walk to the Well, make a wish, pick
  // what you teach, and meet your hut.
  const step = v.state?.viewer.onboardingStep ?? 99;
  useEffect(() => {
    if (!v.ready || pathname !== "/") return;
    if (step <= 3) router.push(step === 1 ? "/gate" : step === 2 ? "/gate/villager" : "/gate/kitty");
    if (step === 4)
      setHint(
        v.state?.viewer.kitty
          ? `Walk to the Wishing Well. ${v.state.viewer.kitty.name} follows.`
          : "Walk up the path to the Wishing Well in the square.",
      );
    else setHint(null);
    if (step === 5) router.push("/well?first=1");
    if (step === 6) router.push("/board?teach=1");
    if (step === 7) {
      const own = v.state?.huts.find((h) => h.isYou);
      if (own) village.command({ c: "travel", to: { handle: own.handle } });
      village.set({ dialog: { kind: "own-hut" } });
    }
  }, [step, v.ready, pathname, router, v.state?.huts, v.state?.viewer.kitty]);
  useEffect(() => {
    const reached = async () => {
      await setOnboardingStep({ step: 5 });
      const s = await loadVillageState();
      if (s) village.set({ state: s });
    };
    window.addEventListener("village:reached-well", reached);
    return () => window.removeEventListener("village:reached-well", reached);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-grass">
      {/* The canvas is decoration for screen readers; every place has a plain twin and the live region speaks. */}
      <div ref={host} aria-hidden className="absolute inset-0" />
      <h1 className="sr-only">SkillSwap Village</h1>
      <Hud />
      {hint ? (
        <div className="pointer-events-none fixed inset-x-0 top-20 z-40 flex justify-center px-4">
          <div className="panel pointer-events-auto flex items-center gap-4 px-4 py-2 anim-sheet">
            <p>{hint}</p>
            <button
              type="button"
              className="btn btn-tertiary"
              onClick={async () => {
                await setOnboardingStep({ step: 5 });
                const s = await loadVillageState();
                if (s) village.set({ state: s });
              }}
            >
              Skip
            </button>
          </div>
        </div>
      ) : null}
      <MapOverlay />
      <SearchOverlay />
      <SayBox />
      <Dialogues />
      <FadeOverlay />
      <KittyRoot mode="village" />
      {!v.ready ? (
        <div className="fixed inset-0 grid place-items-center bg-paper">
          <p className="font-pixel text-label">Opening the gate…</p>
        </div>
      ) : null}
    </div>
  );
}
