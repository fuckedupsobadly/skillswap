import { ICONS } from "./icon-art";

/**
 * 16 × 16 pixel icons drawn in-house (§10.3) — never emoji. o = ink, l = lantern, w = paper, s = paper-shade,
 * g = grass-shade, b = water, t = stone. Rendered as crisp SVG rects so they scale with whole pixels.
 */
const COLORS: Record<string, string> = {
  o: "var(--ink)",
  l: "var(--lantern)",
  w: "var(--paper)",
  s: "var(--paper-shade)",
  g: "var(--grass-shade)",
  b: "var(--water)",
  t: "var(--stone)",
  n: "var(--path-shade)",
};

export type IconName = keyof typeof ICONS;

/** Runs of same-colour pixels per row become one rect: small, crisp SVG. */
function rects(rows: readonly string[]) {
  const out: { x: number; y: number; w: number; c: string }[] = [];
  const pad = Math.floor((16 - rows.length) / 2);
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === "." || !COLORS[ch]) {
        x++;
        continue;
      }
      let w = 1;
      while (row[x + w] === ch) w++;
      out.push({ x, y: y + pad, w, c: COLORS[ch] });
      x += w;
    }
  });
  return out;
}

const CACHE = new Map<string, ReturnType<typeof rects>>();

export function PixelIcon({
  name,
  size = 16,
  title,
  className,
}: {
  name: IconName;
  size?: 16 | 24 | 32 | 48;
  title?: string;
  className?: string;
}) {
  let r = CACHE.get(name);
  if (!r) {
    r = rects(ICONS[name]);
    CACHE.set(name, r);
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      className={className}
    >
      {title ? <title>{title}</title> : null}
      {r.map((p, i) => (
        <rect key={i} x={p.x} y={p.y} width={p.w} height={1} fill={p.c} />
      ))}
    </svg>
  );
}
