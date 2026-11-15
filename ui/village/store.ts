"use client";
import type { HutLook, VillagerLook } from "@/db/schema";
import type { HutView } from "@/modules/village/service";

/** What /api/v1/village/state returns. */
export type VillageState = {
  viewer: {
    memberId: string;
    handle: string;
    name: string;
    timezone: string;
    look: VillagerLook;
    status: "free" | "busy" | "away";
    statusLine: string;
    hideMe: boolean;
    plainMode: boolean;
    onboardingStep: number;
    balanceMin: number;
    heldMin: number;
    unread: number;
    swapsWaiting: number;
    kitty: { name: string; code: string } | null;
    nextSession: { id: string; skill: string; with: string | null; startsAt: string; status: string } | null;
  };
  huts: HutView[];
  traces: { wishes: number; notes: number; chimneys: string[]; liveRooms: number };
  worn: [number, number, number][];
};

export type Prompt = { key: string; verb: string; target: string; action: Interact };
export type Interact =
  | { kind: "place"; placeId: string; route: string }
  | { kind: "member"; handle: string }
  | { kind: "sign"; handle: string }
  | { kind: "own-hut" }
  | { kind: "mailbox" }
  | { kind: "barkeep" }
  | { kind: "table"; cycleId: string }
  | { kind: "chalkboard" }
  | { kind: "exit-tavern" }
  | { kind: "map-stand" };

export type Dialog =
  | { kind: "member"; handle: string }
  | { kind: "sign"; handle: string }
  | { kind: "barkeep" }
  | { kind: "own-hut" }
  | { kind: "chalkboard" };

type S = {
  state: VillageState | null;
  prompt: Prompt | null;
  announce: string;
  dialog: Dialog | null;
  overlay: "map" | "search" | "say" | null;
  fade: boolean;
  scene: "village" | "tavern";
  notice: string | null;
  ready: boolean;
  /** The first-time guide: the spotlight tour is open. */
  tour: boolean;
  /** Where the guide points in the world: an arrow over it and footprints leading there. */
  waypoint: { x: number; y: number; label: string } | null;
};

let s: S = {
  state: null,
  prompt: null,
  announce: "",
  dialog: null,
  overlay: null,
  fade: false,
  scene: "village",
  notice: null,
  ready: false,
  tour: false,
  waypoint: null,
};
const subs = new Set<() => void>();
const cmds = new Set<(c: Command) => void>();

export type Command =
  | { c: "travel"; to: { placeId: string } | { handle: string } | { x: number; y: number } }
  | { c: "interact" }
  | { c: "say"; text: string }
  | { c: "wave" }
  | { c: "reload" }
  | { c: "exit-tavern" }
  | { c: "look"; look: VillagerLook }
  | { c: "hut"; hut: HutLook };

export const village = {
  get: () => s,
  subscribe(fn: () => void) {
    subs.add(fn);
    return () => subs.delete(fn);
  },
  set(patch: Partial<S>) {
    s = { ...s, ...patch };
    for (const fn of subs) fn();
  },
  /** React → world. */
  command(c: Command) {
    for (const fn of cmds) fn(c);
  },
  onCommand(fn: (c: Command) => void) {
    cmds.add(fn);
    return () => cmds.delete(fn);
  },
  /** Anything over the world (sheet, dialogue, overlay) pauses walking input; the world keeps moving. */
  inputBlocked() {
    if (s.dialog || s.overlay || s.fade || s.tour) return true;
    if (typeof document !== "undefined") {
      if (document.querySelector("[data-sheet-open]")) return true;
      const a = document.activeElement;
      if (
        a &&
        (a.tagName === "INPUT" ||
          a.tagName === "TEXTAREA" ||
          a.tagName === "SELECT" ||
          (a as HTMLElement).isContentEditable)
      )
        return true;
    }
    return false;
  },
};

export async function loadVillageState(): Promise<VillageState | null> {
  try {
    const r = await fetch("/api/v1/village/state", { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as VillageState;
  } catch {
    return null;
  }
}
