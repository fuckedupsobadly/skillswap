/**
 * PerchMap: the tops of elements marked `data-perch` become platforms the kitty can walk and sit on.
 * Rectangles are read only on scroll, resize and DOM change — never inside the animation loop.
 */
export type Platform = {
  id: number;
  el: Element | null;
  left: number;
  right: number;
  top: number;
  warm: boolean;
};

const HEADER = 64; // the sticky header; nothing above it is walkable
const EDGE = 14;

export class PerchMap {
  platforms: Platform[] = [];
  private ids = new WeakMap<Element, number>();
  private nextId = 1;
  private dirty = true;
  private ro: ResizeObserver;
  private mo: MutationObserver;
  private moTimer = 0;

  constructor(private onChange: () => void) {
    this.ro = new ResizeObserver(() => this.invalidate());
    this.mo = new MutationObserver(() => {
      if (this.moTimer) return;
      this.moTimer = window.setTimeout(() => {
        this.moTimer = 0;
        this.observe();
        this.invalidate();
      }, 250);
    });
    this.mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", this.invalidate, { passive: true });
    window.addEventListener("resize", this.invalidate, { passive: true });
    this.observe();
  }

  private observe() {
    this.ro.disconnect();
    for (const el of document.querySelectorAll("[data-perch]")) this.ro.observe(el);
  }

  invalidate = () => {
    this.dirty = true;
    this.onChange();
  };

  /** Fresh platforms (cheap when nothing changed). The floor is always id 0. */
  read(): Platform[] {
    if (!this.dirty) return this.platforms;
    this.dirty = false;
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const out: Platform[] = [{ id: 0, el: null, left: EDGE, right: vw - EDGE, top: floorY(), warm: false }];
    for (const el of document.querySelectorAll("[data-perch]")) {
      if (el.closest("[data-no-perch]")) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 120 || r.top < HEADER + 40 || r.top > vh - 90) continue;
      let id = this.ids.get(el);
      if (!id) {
        id = this.nextId++;
        this.ids.set(el, id);
      }
      out.push({
        id,
        el,
        left: r.left + EDGE,
        right: r.right - EDGE,
        top: r.top,
        warm: el.getAttribute("data-perch") === "warm",
      });
    }
    this.platforms = out;
    return out;
  }

  byId(id: number) {
    return this.read().find((p) => p.id === id) ?? null;
  }

  destroy() {
    this.ro.disconnect();
    this.mo.disconnect();
    window.removeEventListener("scroll", this.invalidate);
    window.removeEventListener("resize", this.invalidate);
  }
}

export const floorY = () => window.innerHeight - 6;

/** Can a cat get from one platform to another in one jump? Up is limited; down is easy. */
export function reachable(a: Platform, b: Platform) {
  const gap = Math.max(0, Math.max(a.left, b.left) - Math.min(a.right, b.right));
  const up = a.top - b.top;
  return gap <= 360 && up <= 300;
}

/** Breadth-first search over platforms: the hops to reach `to` from `from`. */
export function path(platforms: Platform[], from: number, to: number): number[] | null {
  const prev = new Map<number, number>([[from, -1]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === to) break;
    const a = platforms.find((p) => p.id === cur);
    if (!a) continue;
    for (const b of platforms) {
      if (prev.has(b.id) || !reachable(a, b)) continue;
      prev.set(b.id, cur);
      queue.push(b.id);
    }
  }
  if (!prev.has(to)) return null;
  const out: number[] = [];
  for (let at = to; at !== from; at = prev.get(at)!) out.unshift(at);
  return out;
}
