"use client";
import { useEffect, useRef } from "react";
import { ART, ITEM_COLORS, spriteFor } from "@/modules/game/rig/items";

/** An item at pixel scale. Locked items are drawn as their outline only — you can see what's coming. */
export function ItemIcon({
  id,
  locked = false,
  scale = 2,
  size = 40,
}: {
  id: string;
  locked?: boolean;
  scale?: number;
  size?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const art = ART[id];
    if (!c || !art) return;
    const sprite = spriteFor(art, art.only === "side" ? "side" : "front");
    if (!sprite) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    const w = sprite[0].length;
    const h = sprite.length;
    const fit = Math.max(1, Math.min(scale, Math.floor(size / Math.max(w, h))));
    const ox = Math.floor((size - w * fit) / 2);
    const oy = Math.floor((size - h * fit) / 2);
    const outline = getComputedStyle(c).getPropertyValue("--line-strong").trim() || "#cbc2d7";
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const ch = sprite[y][x];
        if (ch === "." || (locked && ch !== "o")) continue;
        ctx.fillStyle = locked ? outline : ITEM_COLORS[ch];
        ctx.fillRect(ox + x * fit, oy + y * fit, fit, fit);
      }
  }, [id, locked, scale, size]);
  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      aria-hidden
      style={{ width: size, height: size, imageRendering: "pixelated" }}
    />
  );
}
