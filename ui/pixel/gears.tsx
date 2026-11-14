/**
 * The Clock Tower's gears (§8.6): two 21 × 21 frames, half a tooth apart. Stepping A → B → A reads as turning,
 * one step per verified chunk of the ledger. o ink, t stone, w paper.
 */
const A = [
  ".....................",
  ".........ooo.........",
  "....o....oto....o....",
  "...oto...oto...oto...",
  "..ottto.ottto.ottto..",
  "...otttotttttottto...",
  "....otttwwwwwttto....",
  ".....otwwooowwto.....",
  "....otwwo...owwto....",
  ".ooottwo.....owttooo.",
  ".ottttwo.....owtttto.",
  ".ooottwo.....owttooo.",
  "....otwwo...owwto....",
  ".....otwwooowwto.....",
  "....otttwwwwwttto....",
  "...otttotttttottto...",
  "..ottto.ottto.ottto..",
  "...oto...oto...oto...",
  "....o....oto....o....",
  ".........ooo.........",
  ".....................",
] as const;

const B = [
  ".....................",
  "......ooo...ooo......",
  ".....otto...otto.....",
  "......oto...oto......",
  "......ottoootto......",
  "..o...ottttttto...o..",
  ".otooottwwwwwttoooto.",
  ".otttttwwooowwttttto.",
  ".ooottwwo...owwttooo.",
  "....otwo.....owto....",
  "....otwo.....owto....",
  "....otwo.....owto....",
  ".ooottwwo...owwttooo.",
  ".otttttwwooowwttttto.",
  ".otooottwwwwwttoooto.",
  "..o...ottttttto...o..",
  "......ottoootto......",
  "......oto...oto......",
  ".....otto...otto.....",
  "......ooo...ooo......",
  ".....................",
] as const;

const COLORS: Record<string, string> = { o: "var(--ink)", t: "var(--stone)", w: "var(--paper)" };

function runs(rows: readonly string[]) {
  const out: { x: number; y: number; w: number; c: string }[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (!COLORS[ch]) {
        x++;
        continue;
      }
      let w = 1;
      while (row[x + w] === ch) w++;
      out.push({ x, y, w, c: COLORS[ch] });
      x += w;
    }
  });
  return out;
}
const FRAMES = [runs(A), runs(B)];

export function Gear({
  frame,
  scale = 3,
  className,
}: {
  frame: number;
  scale?: 2 | 3 | 4;
  className?: string;
}) {
  const r = FRAMES[frame % 2];
  return (
    <svg
      width={21 * scale}
      height={21 * scale}
      viewBox="0 0 21 21"
      shapeRendering="crispEdges"
      aria-hidden
      className={className}
    >
      {r.map((p, i) => (
        <rect key={i} x={p.x} y={p.y} width={p.w} height={1} fill={p.c} />
      ))}
    </svg>
  );
}
