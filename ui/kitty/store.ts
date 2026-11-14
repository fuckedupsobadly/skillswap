"use client";
import type { Progress } from "@/modules/game/service";

/**
 * A tiny external store shared by the kitty engine (canvas) and the React dock. The engine writes what the
 * kitty is doing; the dock writes what the member asked for (feed, play). React reads with useSyncExternalStore.
 */
export type KittyStatus =
  | "napping"
  | "loafing"
  | "sitting"
  | "grooming"
  | "exploring"
  | "hunting"
  | "playing"
  | "eating"
  | "purring"
  | "zooming"
  | "waiting"
  | "sleeping"
  | "stretching";

export type KittyState = {
  progress: Progress | null;
  status: KittyStatus;
  notice: { id: number; text: string } | null;
  /** Requests from the dock to the engine. */
  request: { id: number; kind: "feed" | "treat" | "play" } | null;
  panelOpen: boolean;
};

let state: KittyState = { progress: null, status: "sitting", notice: null, request: null, panelOpen: false };
const subs = new Set<() => void>();

export const kittyStore = {
  get: () => state,
  subscribe(fn: () => void) {
    subs.add(fn);
    return () => subs.delete(fn);
  },
  set(patch: Partial<KittyState>) {
    state = { ...state, ...patch };
    for (const fn of subs) fn();
  },
  notice(text: string) {
    state = { ...state, notice: { id: Date.now(), text } };
    for (const fn of subs) fn();
  },
  ask(kind: "feed" | "treat" | "play") {
    state = { ...state, request: { id: Date.now(), kind } };
    for (const fn of subs) fn();
  },
};

export const STATUS_TEXT: Record<KittyStatus, string> = {
  napping: "is napping",
  loafing: "is loafing",
  sitting: "is sitting",
  grooming: "is grooming",
  exploring: "is exploring",
  hunting: "is stalking something",
  playing: "is playing",
  eating: "is eating",
  purring: "is purring",
  zooming: "has the zoomies",
  waiting: "is waiting by the bowl",
  sleeping: "is sleeping",
  stretching: "is stretching",
};

export async function fetchProgress(): Promise<Progress | null> {
  try {
    const res = await fetch("/api/v1/progress/me", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Progress;
  } catch {
    return null;
  }
}

/** Ask the kitty layer to re-read progress now (after a settled session, a feed, an equip). */
export const pokeKitty = () => window.dispatchEvent(new Event("skillswap:kitty-poke"));
