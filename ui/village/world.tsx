"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { setOnboardingStep, setPlainMode } from "@/app/actions/village";
import { KittyRoot } from "../kitty/root";
import { PixelIcon } from "../pixel/icons";
import { PlaceBanner } from "../place-banner";
import { Dialogues } from "./dialogue";
import { QuestCard, Tour, tourSeen, useGuideWaypoint } from "./guide";
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
      // A first-time visitor's guest session is still being created (GuestBootstrap); wait for it.
      let state = await loadVillageState();
      for (let i = 0; !state && !cancelled && i < 60; i++) {
        await new Promise((r) => setTimeout(r, 700));
        state = await loadVillageState();
      }
      if (cancelled || !state) return;
      village.set({ state });
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const nav = navigator as Navigator & { deviceMemory?: number };
      const lowEnd = (navigator.hardwareConcurrency ?? 8) <= 2 || (nav.deviceMemory ?? 8) <= 2;
      const zoom = window.innerWidth < 640 || lowEnd ? 2 : 3;
      // Nameplates are drawn into the canvas once, so the pixel face must be loaded before the world starts.
      const family = getComputedStyle(document.documentElement).getPropertyValue("--font-pixelify").trim();
      if (family && document.fonts)
        await Promise.race([
          Promise.all([document.fonts.load(`500 16px ${family}`), document.fonts.load(`600 16px ${family}`)]),
          new Promise((r) => setTimeout(r, 1500)),
        ]).catch(() => {});
      const { startVillage } = await import("./engine");
      if (cancelled || !host.current) return;
      gameRef.current = startVillage(host.current, {
        // Pushing the URL that's already open would make Next.js reload that route without its sheet
        // context and drop the world underneath; a second request for the same place is a no-op.
        navigate: (r) => {
          if (r !== window.location.pathname + window.location.search) routerRef.current.push(r);
        },
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
    let cancelled = false;
    let tourTimer = 0;
    (async () => {
      // Coming back from a sheet, our copy of your progress can be a step behind (you just finished one).
      // Read it fresh before opening the next sheet, or we'd send you back to a step you've done.
      const fresh = await loadVillageState();
      if (cancelled || !fresh) return;
      const now = fresh.viewer.onboardingStep;
      if (now !== step) {
        village.set({ state: fresh });
        return; // this effect runs again with the new step
      }
      if (now <= 3) router.push(now === 1 ? "/gate" : now === 2 ? "/gate/villager" : "/gate/kitty");
      // First time in the world: a short tour of the HUD, once.
      if (now === 4 && !tourSeen()) tourTimer = window.setTimeout(() => village.set({ tour: true }), 700);
      if (now === 5) router.push("/well?first=1");
      if (now === 6) router.push("/board?teach=1");
      if (now === 7) {
        const own = fresh.huts.find((h) => h.isYou);
        if (own) village.command({ c: "travel", to: { handle: own.handle } });
        village.set({ dialog: { kind: "own-hut" } });
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(tourTimer);
    };
  }, [step, v.ready, pathname, router]);
  useGuideWaypoint();
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
      {/* Targets for the tour's spotlight: you (the camera keeps you centred) and where prompts appear. */}
      <div
        data-guide="player"
        aria-hidden
        // placed every frame by the engine over your villager (the camera can't centre you at map edges)
        className="pointer-events-none fixed top-0 left-0 h-[104px] w-16"
      />
      <div
        data-guide="prompt-zone"
        aria-hidden
        className="pointer-events-none fixed bottom-6 left-1/2 h-11 w-72 -translate-x-1/2"
      />
      <div className="pointer-events-none fixed bottom-4 left-4 z-40">
        <QuestCard />
      </div>
      {/* the guide's goal, when it's off screen: an arrow at the edge pointing the way (placed by the engine) */}
      <div data-guide="offscreen" hidden className="pointer-events-none fixed top-0 left-0 z-30">
        <span className="panel flex min-h-9 items-center gap-2 px-2.5 py-1 font-pixel text-label">
          <span data-arrow className="inline-grid transition-transform duration-150">
            <PixelIcon name="arrow" size={16} />
          </span>
          <span data-label />
        </span>
      </div>
      <MapOverlay />
      <SearchOverlay />
      <SayBox />
      <Dialogues />
      <FadeOverlay />
      <KittyRoot mode="village" />
      <Tour />
      {!v.ready ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-paper p-4">
          <div className="panel parchment grid w-full max-w-[420px] gap-4 overflow-hidden pb-6">
            <PlaceBanner scene={{ place: "gate" }} className="border-b-2 border-ink" />
            <p className="flex items-center justify-center gap-2 font-pixel text-label" role="status">
              Opening the gate
              <span aria-hidden className="loading-dots" />
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
